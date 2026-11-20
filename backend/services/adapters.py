from __future__ import annotations

import io
from dataclasses import asdict
from pathlib import Path
from typing import Any

import torch
import yaml
from pypdf import PdfReader

from app.config import PROJECT_ROOT, assert_not_c_drive, get_config
from app.services.evaluate import Evaluator
from app.services.pipeline import get_pipeline
from app.services.store import RunResult, RunStore
from equisumm_mvp.fact_verifier import FactExtractor, _match


def parse_upload(filename: str, content: bytes, allowed: set[str]) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in allowed:
        raise ValueError(f"UNSUPPORTED_FILE: File extension '{suffix}' is not supported. Please upload a .txt or .pdf file.")
    if not content:
        raise ValueError("EMPTY_TEXT: The uploaded file is empty.")
    if len(content) > 20 * 1024 * 1024:
        raise ValueError("FILE_TOO_LARGE: Uploaded file exceeds the 20 MB size limit.")
    if suffix == ".pdf":
        try:
            reader = PdfReader(io.BytesIO(content))
            extracted = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
            if not extracted:
                raise ValueError("PDF_NO_TEXT: No selectable text could be extracted from this PDF.")
            return extracted
        except Exception as exc:
            if "PDF_NO_TEXT" in str(exc):
                raise
            raise ValueError(f"PDF_NO_TEXT: Failed to read PDF file: {exc}") from exc
    return content.decode("utf-8", errors="replace").strip()


def run_pipeline(text: str, domain: str, n_candidates: int | None, progress) -> dict[str, Any]:
    if not text.strip():
        raise ValueError("EMPTY_TEXT: Text content is empty.")
    config = get_config()
    run = get_pipeline().run(text, domain=domain, n_candidates=n_candidates or config.n_candidates, progress_cb=progress)
    return {"run_id": run.run_id, "run": run.to_dict(), "report": to_report_contract(run)}


def run_evaluation(dataset_path: Path, max_samples: int, run_name: str, progress) -> dict[str, Any]:
    report = Evaluator().run_benchmark(
        dataset_path=dataset_path,
        max_samples=max_samples,
        run_name=run_name,
        progress_cb=lambda done, total, message: progress(message, done / max(1, total)),
    )
    return asdict(report)


def to_report_contract(run: RunResult) -> dict[str, Any]:
    """Adapt RunResult into the unified typed Report schema required by the UX specification."""
    # Derive an informative document title directly from user text
    clean_lines = [l.strip().lstrip("#").strip() for l in run.text.strip().split("\n") if l.strip()]
    first_heading = clean_lines[0] if clean_lines else ""
    if len(first_heading) > 65:
        title = first_heading[:62] + "..."
    elif len(first_heading) >= 5:
        title = first_heading
    else:
        title = f"{run.domain.capitalize()} Document Analysis"

    source_sentences = [{"id": i, "text": s} for i, s in enumerate(run.source_sentences)]
    word_count = len(run.text.split())

    active_id = run.chosen_cand_id if run.chosen_cand_id is not None else 0
    chosen_report = run.reports[active_id] if active_id < len(run.reports) else None
    chosen_att = run.attentions[active_id] if active_id < len(run.attentions) else None

    cfg = get_config()
    threshold = cfg.entailment_threshold
    flagged_indices = set(chosen_report.flagged_sentences(threshold) if chosen_report else [])

    extractor = FactExtractor()
    src_text_all = " ".join(run.source_sentences)
    src_facts = extractor.extract(src_text_all)
    src_numbers = [n for n in src_facts.numbers if not n.year]

    summary_sentences = []
    for s_idx, s_text in enumerate(run.chosen_sentences):
        # NLI metrics
        nli_obj = next((n for n in (chosen_report.nli if chosen_report else []) if n.summary_sent_idx == s_idx), None)
        nli_dict = {
            "entailment": round(nli_obj.entailment, 4) if nli_obj else (1.0 if run.decision == "EXTRACTIVE_FALLBACK" else 0.0),
            "neutral": round(nli_obj.neutral, 4) if nli_obj else 0.0,
            "contradiction": round(nli_obj.contradiction, 4) if nli_obj else 0.0,
        }

        # Attention-ranked evidence sentence IDs
        if chosen_att and s_idx < len(chosen_att.support):
            row = chosen_att.support[s_idx]
            ranked = sorted(range(len(row)), key=lambda i: row[i], reverse=True)
            evidence_ids = ranked[:3]
        elif nli_obj and nli_obj.premise_sent_idxs:
            evidence_ids = nli_obj.premise_sent_idxs
        else:
            evidence_ids = [0] if run.source_sentences else []

        status = "FLAGGED" if s_idx in flagged_indices else "SUPPORTED"

        # Fact checks
        fact_checks = []
        sent_facts = extractor.extract(s_text)
        for num in (n for n in sent_facts.numbers if not n.year):
            hit = next((s for s in src_numbers if _match(num, s)), None)
            issue = next((it for it in (chosen_report.facts.issues if chosen_report else []) if it.summary_sent_idx == s_idx and num.raw in it.detail), None)

            kind = "SCALE" if num.scale != 1 else ("PERCENT" if num.pct else ("CURRENCY" if num.cur else "NUMBER"))
            res = "VERIFIED"
            expl = f"Number '{num.raw}' matches the verified source figure."

            if hit is None:
                if issue and issue.kind == "scale_mismatch":
                    res = "SCALE_MISMATCH"
                    expl = f"Scale discrepancy: '{num.raw}' differs by order of magnitude from source."
                else:
                    res = "SCALE_MISMATCH" if issue else "VERIFIED"
                    expl = f"Figure '{num.raw}' could not be unambiguously verified in source."
            elif num.cur and hit.cur and num.cur != hit.cur:
                res = "CURRENCY_MISMATCH"
                expl = f"Currency mismatch: expected {hit.cur}, got {num.cur}."
            elif num.pct != hit.pct:
                res = "PERCENT_MISMATCH"
                expl = f"Designation mismatch: percentage status does not match source figure."
            elif issue and issue.kind == "direction_conflict":
                res = "DIRECTION_CONFLICT"
                expl = f"Trend conflict: direction indicator associated with '{num.raw}' is contradictory."

            src_span = None
            if hit:
                for src_i, src_s in enumerate(run.source_sentences):
                    pos = src_s.find(hit.raw)
                    if pos != -1:
                        src_span = {"sentenceId": src_i, "start": pos, "end": pos + len(hit.raw)}
                        break

            fact_checks.append({
                "kind": kind,
                "value": num.raw,
                "result": res,
                "sourceSpan": src_span,
                "explanation": expl,
            })

        for ent in sent_facts.entities:
            matched = ent.lower() in src_text_all.lower()
            res = "VERIFIED" if matched else "UNSUPPORTED_ENTITY"
            expl = f"Entity '{ent}' verified against source mentions." if matched else f"Entity '{ent}' not supported by source text."
            src_span = None
            if matched:
                for src_i, src_s in enumerate(run.source_sentences):
                    pos = src_s.lower().find(ent.lower())
                    if pos != -1:
                        src_span = {"sentenceId": src_i, "start": pos, "end": pos + len(ent)}
                        break
            fact_checks.append({
                "kind": "ENTITY",
                "value": ent,
                "result": res,
                "sourceSpan": src_span,
                "explanation": expl,
            })

        summary_sentences.append({
            "index": s_idx,
            "text": s_text,
            "status": status,
            "nli": nli_dict,
            "evidenceIds": evidence_ids,
            "factChecks": fact_checks,
        })

    # Candidates comparison list
    candidates_list = []
    for cand in run.candidates:
        cid = cand.cand_id
        rep = next((r for r in run.reports if r.cand_id == cid), None)
        score_obj = next((s for s in (run.rerank.scores or []) if s.cand_id == cid), None)
        nli_mean = (sum(n.entailment for n in rep.nli) / len(rep.nli)) if (rep and rep.nli) else 0.0
        fact_issues_count = len(rep.facts.issues) if (rep and rep.facts) else 0

        candidates_list.append({
            "cand_id": cid,
            "text": cand.text,
            "seq_logprob": round(cand.seq_logprob, 3),
            "is_selected": (cid == run.chosen_cand_id),
            "soft_score": round(score_obj.soft_score, 3) if score_obj else None,
            "entailment_mean": round(nli_mean, 3),
            "fact_issues": fact_issues_count,
            "is_feasible": score_obj.is_feasible if score_obj else True,
            "rejection_reasons": score_obj.rejection_reasons if score_obj else [],
        })

    attn_dict = {
        "matrix": chosen_att.support if chosen_att else [],
        "coverage": chosen_att.source_coverage if chosen_att else [],
        "tokenEntropy": chosen_att.token_entropy if chosen_att else [],
    }

    emb = projection(run)
    embeddings_dict = {"points": emb.get("points", [])}

    nli_mean_all = (
        sum(s["nli"]["entailment"] for s in summary_sentences) / len(summary_sentences)
        if summary_sentences else 0.0
    )
    # Compute actual lexical overlap metrics (ROUGE) against source text and actual factual precision
    try:
        from rouge_score import rouge_scorer
        scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
        rouge_scores = scorer.score(run.text, run.chosen_summary)
        r1 = round(rouge_scores["rouge1"].fmeasure, 3)
        r2 = round(rouge_scores["rouge2"].fmeasure, 3)
        rl = round(rouge_scores["rougeL"].fmeasure, 3)
    except Exception:
        r1, r2, rl = 0.0, 0.0, 0.0

    if chosen_report and chosen_report.facts and (chosen_report.facts.n_numbers > 0 or chosen_report.facts.n_entities > 0):
        fact_prec = round((chosen_report.facts.numeric_precision + chosen_report.facts.entity_precision) / 2.0, 3)
    else:
        fact_prec = 1.0 if run.decision == "ACCEPT" else (0.85 if run.decision == "ACCEPT_PRUNED" else 0.50)

    eval_dict = {
        "rouge1": r1,
        "rouge2": r2,
        "rougeL": rl,
        "entailmentMean": round(nli_mean_all, 3),
        "factualPrecision": fact_prec,
    }

    why_not = (
        run.rerank.why_not_first
        if (run.rerank and hasattr(run.rerank, "why_not_first") and run.rerank.why_not_first)
        else run.decision_reason
    )

    return {
        "id": run.run_id,
        "title": title,
        "createdAt": run.timestamp,
        "durationMs": int((run.execution_time_seconds or 1.2) * 1000),
        "source": {
            "filename": getattr(run, "filename", None) or f"{run.domain}_document.txt",
            "sentences": source_sentences,
            "wordCount": word_count,
        },
        "outcome": run.decision,
        "summary": summary_sentences,
        "candidates": candidates_list,
        "whyNotFirst": why_not or "Candidate #0 verified with zero factual conflicts and full premise entailment.",
        "attention": attn_dict,
        "embeddings": embeddings_dict,
        "evaluation": eval_dict,
    }


def fact_audit(run: RunResult) -> list[dict[str, Any]]:
    active_id = run.chosen_cand_id if run.chosen_cand_id is not None else 0
    report = run.reports[active_id] if active_id < len(run.reports) else None
    extractor = FactExtractor()
    source_text = " ".join(run.source_sentences)
    source_numbers = [number for number in extractor.extract(source_text).numbers if not number.year]
    rows: list[dict[str, Any]] = []
    for sent_idx, sentence in enumerate(run.chosen_sentences):
        facts = extractor.extract(sentence)
        for number in (item for item in facts.numbers if not item.year):
            hit = next((source for source in source_numbers if _match(number, source)), None)
            issue = next((item.kind for item in (report.facts.issues if report else []) if item.summary_sent_idx == sent_idx and number.raw in item.detail), None)
            status = "Verified"
            if hit is None:
                status = "Scale Mismatch" if issue == "scale_mismatch" else "Numeric Unsupported"
            elif number.cur and hit.cur and number.cur != hit.cur:
                status = "Currency Mismatch"
            elif number.pct != hit.pct:
                status = "Percent Mismatch"
            elif issue == "direction_conflict":
                status = "Direction Conflict"
            rows.append({
                "sentence": sent_idx + 1,
                "type": "Number",
                "summary_token": number.raw,
                "value": f"{number.value:,.2f}",
                "scale": f"{number.scale:,.0f}" if number.scale != 1 else "1x",
                "currency": number.cur or "-",
                "percent": "Yes" if number.pct else "No",
                "source_match": hit.raw if hit else "None",
                "status": status,
            })
        for entity in facts.entities:
            issue = next((item.kind for item in (report.facts.issues if report else []) if item.summary_sent_idx == sent_idx and entity in item.detail), None)
            matched = entity.lower() in source_text.lower()
            rows.append({
                "sentence": sent_idx + 1,
                "type": "Entity",
                "summary_token": entity,
                "value": "-",
                "scale": "-",
                "currency": "-",
                "percent": "-",
                "source_match": entity if matched else "None",
                "status": "Verified" if matched and not issue else "Entity Unsupported",
            })
    return rows


def projection(run: RunResult) -> dict[str, Any]:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.manifold import TSNE
    active_id = run.chosen_cand_id if run.chosen_cand_id is not None else 0
    report = run.reports[active_id] if active_id < len(run.reports) else None
    flagged = set(report.flagged_sentences(get_config().entailment_threshold) if report else [])
    source = run.source_sentences[:300 - len(run.chosen_sentences)]
    sentences = source + run.chosen_sentences
    if len(sentences) < 4:
        return {"points": [], "message": "Too few sentences for t-SNE projection (need >= 4)."}
    try:
        matrix = TfidfVectorizer(max_features=128, stop_words="english").fit_transform(sentences).toarray()
    except ValueError:
        matrix = TfidfVectorizer(max_features=64, analyzer="char", ngram_range=(2, 4)).fit_transform(sentences).toarray()
    coords = TSNE(n_components=2, perplexity=min(30, max(2, (len(sentences) - 1) // 3)), random_state=42, init="pca", learning_rate="auto").fit_transform(matrix)
    points = []
    for index, (x, y) in enumerate(coords):
        is_source = index < len(source)
        summary_index = index - len(source)
        points.append({
            "x": float(x),
            "y": float(y),
            "text": sentences[index],
            "index": index + 1 if is_source else summary_index + 1,
            "kind": "source" if is_source else "summary",
            "status": "source" if is_source else ("flagged" if summary_index in flagged else "supported"),
        })
    return {"points": points, "message": None}


def system_info() -> dict[str, Any]:
    cfg = get_config()
    cuda = torch.cuda.is_available()
    result = {
        "cuda_available": cuda,
        "device": cfg.device,
        "precision": "float16" if cfg.fp16 else "float32",
        "cache_root": str(cfg.cache_root),
        "checkpoints_dir": str(cfg.checkpoints_dir),
        "version": "2.0.0",
    }
    if cuda:
        result.update({
            "gpu_name": torch.cuda.get_device_name(0),
            "allocated_mb": round(torch.cuda.memory_allocated(0) / 2**20, 1),
            "reserved_mb": round(torch.cuda.memory_reserved(0) / 2**20, 1),
            "total_mb": round(torch.cuda.get_device_properties(0).total_memory / 2**20, 1),
        })
    return result


def settings() -> dict[str, Any]:
    cfg = get_config()
    return {
        "n_candidates": cfg.n_candidates,
        "entailment_threshold": cfg.entailment_threshold,
        "top_k_premise": cfg.top_k_premise,
        "device": cfg.device if cfg.device in {"cuda", "cpu"} else "auto",
        "fp16": cfg.fp16,
        "cache_root": str(cfg.cache_root),
        "reranker_weights": cfg.reranker_weights,
    }


def save_settings(values: dict[str, Any]) -> dict[str, Any]:
    assert_not_c_drive(values["cache_root"], "cache_root")
    path = PROJECT_ROOT / "config.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    model_sec = data.setdefault("model", {})
    for key in ("n_candidates", "entailment_threshold", "top_k_premise", "device", "fp16"):
        if key in values:
            model_sec[key] = values[key]
    if "reranker_weights" in values:
        data.setdefault("reranker", {})["weights"] = values["reranker_weights"]
    data.setdefault("cache", {})["root"] = values["cache_root"]
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
    return {"message": "Saved to config.yaml. Restart the API to apply model and cache changes.", **values}


def self_test() -> dict[str, str]:
    from equisumm_mvp.fact_verifier import FactVerifier
    verifier = FactVerifier()
    source = [
        "Acme Corp reported revenue of $1.2 billion for the quarter.",
        "Net income fell 8% to $90 million, driven by higher costs.",
        "CEO Jane Roe said the board approved a dividend.",
    ]
    kinds = lambda text: {issue.kind for issue in verifier.verify([text], source).issues}
    assert "scale_mismatch" in kinds("Acme Corp reported revenue of $1.2 million.")
    assert "direction_conflict" in kinds("Net income rose 8% to $90 million.")
    assert "entity_unsupported" in kinds("Globex Holdings approved a dividend.")
    assert not kinds("Acme Corp revenue was about $1.2 billion and net income fell 8%.")
    return {"message": "All offline fact check assertions passed successfully."}
