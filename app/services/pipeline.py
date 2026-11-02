"""EquiSumm End-to-End Pipeline Service.

Executes:
1. Tokenization & Sentence-boundary source indexing.
2. Candidate generation with BART-base + LoRA adapter.
3. Cross-attention extraction for support, token entropy, and source coverage.
4. NLI verification using attention-selected premises.
5. Strict numeric and entity fact verification.
6. Reranking with hard constraints and fallbacks (Prune -> Extractive -> Escalate).

Caches models once per session to avoid per-click reloads and manages VRAM.
"""
from __future__ import annotations
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional
import logging
import torch

# Ensure project root and equisumm_mvp are on sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))
_EQUISUMM_DIR = _PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

from app.config import get_config

try:
    from equisumm_mvp.contracts import (
        Candidate,
        CandidateAttention,
        NLIResult,
        FactReport,
        CandidateReport,
    )
    from equisumm_mvp.hf_seq2seq import HFSeq2SeqSummarizer
    from equisumm_mvp.extractor import CrossAttentionExtractor
    from equisumm_mvp.nli_model import NLIVerifier
    from equisumm_mvp.fact_verifier import FactVerifier
except ImportError:
    from contracts import (
        Candidate,
        CandidateAttention,
        NLIResult,
        FactReport,
        CandidateReport,
    )
    from hf_seq2seq import HFSeq2SeqSummarizer
    from extractor import CrossAttentionExtractor
    from nli_model import NLIVerifier
    from fact_verifier import FactVerifier

from app.services.reranker import EquiSummReranker, RerankResult
from app.services.store import RunResult, RunStore

logger = logging.getLogger("equisumm.pipeline")


class EquiSummPipeline:
    def __init__(
        self,
        adapter_dir: str | None = None,
        nli_model_id: str | None = None,
        device: str | None = None,
        fp16: bool | None = None,
        entailment_threshold: float = 0.5,
    ):
        cfg = get_config()
        self.adapter_dir = str(adapter_dir or cfg.adapter_dir)
        self.nli_model_id = str(nli_model_id or cfg.nli_model)
        self.device = device or cfg.device
        self.fp16 = cfg.fp16 if fp16 is None else fp16
        self.entailment_threshold = entailment_threshold

        self.summarizer: Optional[HFSeq2SeqSummarizer] = None
        self.extractor: Optional[CrossAttentionExtractor] = None
        self.nli: Optional[NLIVerifier] = None
        self.fact_verifier = FactVerifier()
        self.reranker = EquiSummReranker(
            entailment_threshold=self.entailment_threshold,
            weights=cfg.reranker_weights,
            extractive_top_k=cfg.extractive_top_k,
        )
        self.store = RunStore()

    def _ensure_summarizer(self):
        if self.summarizer is None:
            logger.info(f"Loading summarizer from {self.adapter_dir} on {self.device} (fp16={self.fp16})")
            self.summarizer = HFSeq2SeqSummarizer(
                adapter_dir=self.adapter_dir,
                device=self.device,
                fp16=self.fp16,
            )
            self.extractor = CrossAttentionExtractor(self.summarizer)

    def _ensure_nli(self):
        if self.nli is None:
            logger.info(f"Loading NLI verifier {self.nli_model_id} on {self.device} (fp16={self.fp16})")
            cfg = get_config()
            self.nli = NLIVerifier(
                model_id=self.nli_model_id,
                device=self.device,
                fp16=self.fp16,
                top_k=cfg.top_k_premise,
                window=cfg.premise_window,
                max_len=cfg.max_nli_length,
            )

    def _cleanup_cuda(self):
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    def run(
        self,
        text: str,
        domain: str = "general",
        n_candidates: int = 4,
        progress_cb: Optional[Callable[[str, float], None]] = None,
    ) -> RunResult:
        start_time = time.time()
        stage_times: dict[str, float] = {}

        def notify(msg: str, frac: float):
            if progress_cb:
                progress_cb(msg, frac)
            logger.info(f"[{frac*100:.0f}%] {msg}")

        # Stage 1: Preparation & indexing
        t0 = time.time()
        notify("Tokenizing source text & building index...", 0.10)
        self._ensure_summarizer()
        assert self.summarizer is not None
        assert self.extractor is not None

        source_sentences, source_index = self.summarizer.prepare(text)
        stage_times["index"] = time.time() - t0

        if not source_sentences:
            return RunResult(
                run_id=str(uuid.uuid4())[:8],
                timestamp=datetime.now().isoformat(),
                domain=domain,
                text=text,
                source_sentences=[],
                n_sentences=0,
                n_truncated_sentences=0,
                candidates=[],
                attentions=[],
                reports=[],
                rerank=RerankResult(
                    chosen_cand_id=None,
                    decision="ESCALATE",
                    decision_reason="Input text contains no valid sentences.",
                    chosen_sentences=[],
                    chosen_summary="",
                    scores=[],
                ),
                chosen_cand_id=None,
                chosen_summary="",
                chosen_sentences=[],
                decision="ESCALATE",
                decision_reason="Input text contains no valid sentences.",
                execution_time_seconds=time.time() - start_time,
                stage_times=stage_times,
            )

        # Stage 2: Candidate generation
        t0 = time.time()
        notify("Generating beam candidates via BART-base + LoRA...", 0.30)
        candidates = self.summarizer.generate(source_index, n_candidates=n_candidates)
        self._cleanup_cuda()
        stage_times["summarize"] = time.time() - t0

        # Stage 3: Teacher-forced cross-attention extraction
        t0 = time.time()
        notify("Extracting teacher-forced cross-attentions...", 0.50)
        attentions: list[CandidateAttention] = []
        for cand in candidates:
            att = self.extractor.extract(source_index, cand)
            attentions.append(att)
        self._cleanup_cuda()
        stage_times["attention"] = time.time() - t0

        # Stage 4: NLI verification
        t0 = time.time()
        notify("Verifying premise entailment via RoBERTa-large-MNLI...", 0.70)
        self._ensure_nli()
        assert self.nli is not None
        nli_results_by_cand: list[list[NLIResult]] = []
        for att in attentions:
            res = self.nli.verify(source_sentences, att)
            nli_results_by_cand.append(res)
        self._cleanup_cuda()
        stage_times["nli"] = time.time() - t0

        # Stage 5: Fact verification
        t0 = time.time()
        notify("Verifying numbers, scales, percentages, currencies & entities...", 0.85)
        reports: list[CandidateReport] = []
        for cand, att, nli_res in zip(candidates, attentions, nli_results_by_cand):
            fact_rep: FactReport = self.fact_verifier.verify(att.summary_sentences, source_sentences)
            rep = CandidateReport(cand_id=cand.cand_id, nli=nli_res, facts=fact_rep)
            reports.append(rep)
        stage_times["facts"] = time.time() - t0

        # Stage 6: Reranking & fallbacks
        t0 = time.time()
        notify("Reranking candidates and selecting final summary...", 0.95)
        rerank = self.reranker.rerank(
            candidates=candidates,
            attentions=attentions,
            reports=reports,
            source_sentences=source_sentences,
        )
        stage_times["rerank"] = time.time() - t0

        total_time = time.time() - start_time
        notify("Verification complete.", 1.0)

        run_result = RunResult(
            run_id=str(uuid.uuid4())[:8],
            timestamp=datetime.now().isoformat(),
            domain=domain,
            text=text,
            source_sentences=source_sentences,
            n_sentences=source_index.n_sentences,
            n_truncated_sentences=source_index.n_truncated_sentences,
            candidates=candidates,
            attentions=attentions,
            reports=reports,
            rerank=rerank,
            chosen_cand_id=rerank.chosen_cand_id,
            chosen_summary=rerank.chosen_summary,
            chosen_sentences=rerank.chosen_sentences,
            decision=rerank.decision,
            decision_reason=rerank.decision_reason,
            execution_time_seconds=total_time,
            stage_times=stage_times,
        )

        # Persist run
        try:
            self.store.save_run(run_result)
        except Exception as e:
            logger.warning(f"Failed to auto-save run: {e}")

        return run_result


# Singleton pipeline holder
_PIPELINE: Optional[EquiSummPipeline] = None


def get_pipeline() -> EquiSummPipeline:
    global _PIPELINE
    if _PIPELINE is None:
        _PIPELINE = EquiSummPipeline()
    return _PIPELINE

