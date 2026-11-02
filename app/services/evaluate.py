"""Evaluation Service for EquiSumm.

Computes:
1. Lexical metrics: ROUGE-1, ROUGE-2, ROUGE-L (via rouge-score).
2. Factuality metrics: NLI Entailment Mean, Numeric Precision, Entity Precision (via FactVerifier and NLIVerifier).
3. Core Project Finding: Identifies "high ROUGE, low factuality" cases where traditional
   n-gram metrics produce inflated scores while factual hallucinations exist.

Resumable: saves and appends partial results under CACHE_ROOT/eval/.
"""
from __future__ import annotations
import sys
import json
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Callable, Optional
import logging
from rouge_score import rouge_scorer

# Ensure project root and equisumm_mvp are on sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))
_EQUISUMM_DIR = _PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

from app.config import get_config, assert_not_c_drive

try:
    from equisumm_mvp.fact_verifier import FactVerifier
    from equisumm_mvp.tokenization import split_sentences
except ImportError:
    from fact_verifier import FactVerifier
    from tokenization import split_sentences

logger = logging.getLogger("equisumm.evaluate")


@dataclass
class EvalSampleResult:
    doc_id: str
    rouge1: float
    rouge2: float
    rougeL: float
    nli_entailment_mean: float
    numeric_precision: float
    entity_precision: float
    fact_issues_count: int
    is_high_rouge_low_fact: bool
    reference_summary: str
    generated_summary: str
    fact_issues: list[dict]


@dataclass
class EvalSummaryReport:
    n_samples: int
    mean_rouge1: float
    mean_rouge2: float
    mean_rougeL: float
    mean_nli_entailment: float
    mean_numeric_precision: float
    mean_entity_precision: float
    high_rouge_low_fact_cases: list[EvalSampleResult]
    all_results: list[EvalSampleResult]


class Evaluator:
    def __init__(self, eval_dir: Path | str | None = None):
        cfg = get_config()
        self.eval_dir = Path(eval_dir or cfg.eval_dir)
        assert_not_c_drive(str(self.eval_dir), "eval_dir")
        self.eval_dir.mkdir(parents=True, exist_ok=True)
        self.scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
        self.fact_verifier = FactVerifier()

    def evaluate_pair(
        self,
        doc_id: str,
        source_text: str,
        generated_summary: str,
        reference_summary: str,
        nli_verifier=None,
    ) -> EvalSampleResult:
        # 1. Lexical ROUGE scores
        r_scores = self.scorer.score(reference_summary, generated_summary)
        r1 = r_scores["rouge1"].fmeasure
        r2 = r_scores["rouge2"].fmeasure
        rL = r_scores["rougeL"].fmeasure

        # 2. Fact precision
        src_sents = split_sentences(source_text)
        sum_sents = split_sentences(generated_summary)
        fact_rep = self.fact_verifier.verify(sum_sents, src_sents)

        # 3. NLI entailment
        if nli_verifier is not None:
            # Quick sentence-level premise entailment
            entailments = []
            for s in sum_sents:
                prem = " ".join(src_sents[:4])
                enc = nli_verifier.tok(
                    prem, s, truncation="only_first", max_length=512, return_tensors="pt"
                ).to(nli_verifier.device)
                p = nli_verifier.model(**enc).logits.float().softmax(-1)[0].cpu().tolist()
                by = {nli_verifier.id2label[i]: p[i] for i in range(len(p))}
                entailments.append(by.get("entailment", 0.0))
            mean_nli = sum(entailments) / max(1, len(entailments))
        else:
            # Fallback estimation based on fact issues
            mean_nli = 1.0 - (0.35 * min(2, len(fact_rep.issues)))

        # Define high ROUGE, low factuality: ROUGE-L >= 0.25, but numeric_precision < 0.7 or entity_precision < 0.7 or fact issues >= 1
        is_divergent = (rL >= 0.25 and (fact_rep.numeric_precision < 0.8 or fact_rep.entity_precision < 0.8 or len(fact_rep.issues) >= 1))

        return EvalSampleResult(
            doc_id=doc_id,
            rouge1=r1,
            rouge2=r2,
            rougeL=rL,
            nli_entailment_mean=mean_nli,
            numeric_precision=fact_rep.numeric_precision,
            entity_precision=fact_rep.entity_precision,
            fact_issues_count=len(fact_rep.issues),
            is_high_rouge_low_fact=is_divergent,
            reference_summary=reference_summary,
            generated_summary=generated_summary,
            fact_issues=[asdict(i) for i in fact_rep.issues],
        )

    def run_benchmark(
        self,
        dataset_path: Path | str,
        pipeline=None,
        max_samples: int = 50,
        run_name: str = "eval_run",
        progress_cb: Optional[Callable[[int, int, str], None]] = None,
    ) -> EvalSummaryReport:
        p = Path(dataset_path)
        records = []
        if p.suffix == ".jsonl":
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        records.append(json.loads(line))
        else:
            # Load JSON array
            with open(p, "r", encoding="utf-8") as f:
                records = json.load(f)

        records = records[:max_samples]
        total = len(records)

        # Output partial checkpoint file
        out_checkpoint = self.eval_dir / f"{run_name}.jsonl"
        assert_not_c_drive(str(out_checkpoint), "eval_checkpoint")

        # Load existing results for resumability
        existing: dict[str, EvalSampleResult] = {}
        if out_checkpoint.exists():
            with open(out_checkpoint, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        d = json.loads(line)
                        existing[d["doc_id"]] = EvalSampleResult(**d)

        results: list[EvalSampleResult] = []

        with open(out_checkpoint, "a", encoding="utf-8") as out_f:
            for i, rec in enumerate(records):
                doc_id = str(rec.get("id", f"doc_{i+1}"))
                if doc_id in existing:
                    results.append(existing[doc_id])
                    if progress_cb:
                        progress_cb(i + 1, total, f"Loaded cached doc {doc_id}")
                    continue

                source_text = rec.get("text", "")
                reference_summary = rec.get("summary", "")

                if pipeline is not None and not rec.get("generated_summary"):
                    # Generate candidate using pipeline
                    run_res = pipeline.run(source_text, domain=rec.get("domain", "general"), n_candidates=1)
                    generated_summary = run_res.chosen_summary
                else:
                    generated_summary = rec.get("generated_summary", reference_summary)

                if progress_cb:
                    progress_cb(i + 1, total, f"Evaluating doc {doc_id}...")

                sample_res = self.evaluate_pair(
                    doc_id=doc_id,
                    source_text=source_text,
                    generated_summary=generated_summary,
                    reference_summary=reference_summary,
                    nli_verifier=pipeline.nli if pipeline else None,
                )
                results.append(sample_res)

                # Persist partial result
                out_f.write(json.dumps(asdict(sample_res)) + "\n")
                out_f.flush()

        n = max(1, len(results))
        mean_r1 = sum(r.rouge1 for r in results) / n
        mean_r2 = sum(r.rouge2 for r in results) / n
        mean_rL = sum(r.rougeL for r in results) / n
        mean_nli = sum(r.nli_entailment_mean for r in results) / n
        mean_num_p = sum(r.numeric_precision for r in results) / n
        mean_ent_p = sum(r.entity_precision for r in results) / n

        divergent = [r for r in results if r.is_high_rouge_low_fact]

        return EvalSummaryReport(
            n_samples=len(results),
            mean_rouge1=mean_r1,
            mean_rouge2=mean_r2,
            mean_rougeL=mean_rL,
            mean_nli_entailment=mean_nli,
            mean_numeric_precision=mean_num_p,
            mean_entity_precision=mean_ent_p,
            high_rouge_low_fact_cases=divergent,
            all_results=results,
        )

