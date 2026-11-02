"""Run storage service for EquiSumm.

Saves and loads runs as JSON under CACHE_ROOT/runs.
Supports JSON, Markdown, and CSV export.
"""
from __future__ import annotations
import sys
import json
import uuid
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Any, Optional
import csv
import io
import logging

# Ensure project root and equisumm_mvp are on sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))
_EQUISUMM_DIR = _PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

from app.config import get_config, assert_not_c_drive

try:
    from equisumm_mvp.contracts import (
        SourceTokenIndex,
        Candidate,
        CandidateAttention,
        NLIResult,
        FactIssue,
        FactReport,
        CandidateReport,
    )
except ImportError:
    from contracts import (
        SourceTokenIndex,
        Candidate,
        CandidateAttention,
        NLIResult,
        FactIssue,
        FactReport,
        CandidateReport,
    )

from app.services.reranker import SoftScoreBreakdown, RerankResult

logger = logging.getLogger("equisumm.store")


@dataclass
class RunResult:
    run_id: str
    timestamp: str
    domain: str
    text: str
    source_sentences: list[str]
    n_sentences: int
    n_truncated_sentences: int
    candidates: list[Candidate]
    attentions: list[CandidateAttention]
    reports: list[CandidateReport]
    rerank: RerankResult
    chosen_cand_id: Optional[int]
    chosen_summary: str
    chosen_sentences: list[str]
    decision: str
    decision_reason: str
    execution_time_seconds: float = 0.0
    stage_times: dict[str, float] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "timestamp": self.timestamp,
            "domain": self.domain,
            "text": self.text,
            "source_sentences": self.source_sentences,
            "n_sentences": self.n_sentences,
            "n_truncated_sentences": self.n_truncated_sentences,
            "candidates": [asdict(c) for c in self.candidates],
            "attentions": [asdict(a) for a in self.attentions],
            "reports": [
                {
                    "cand_id": r.cand_id,
                    "nli": [asdict(n) for n in r.nli],
                    "facts": {
                        "entity_precision": r.facts.entity_precision,
                        "numeric_precision": r.facts.numeric_precision,
                        "n_entities": r.facts.n_entities,
                        "n_numbers": r.facts.n_numbers,
                        "issues": [asdict(i) for i in r.facts.issues],
                    },
                }
                for r in self.reports
            ],
            "rerank": {
                "chosen_cand_id": self.rerank.chosen_cand_id,
                "decision": self.rerank.decision,
                "decision_reason": self.rerank.decision_reason,
                "chosen_sentences": self.rerank.chosen_sentences,
                "chosen_summary": self.rerank.chosen_summary,
                "why_not_first": self.rerank.why_not_first,
                "scores": [asdict(s) for s in self.rerank.scores],
            },
            "chosen_cand_id": self.chosen_cand_id,
            "chosen_summary": self.chosen_summary,
            "chosen_sentences": self.chosen_sentences,
            "decision": self.decision,
            "decision_reason": self.decision_reason,
            "execution_time_seconds": self.execution_time_seconds,
            "stage_times": self.stage_times or {},
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RunResult:
        candidates = [Candidate(**c) for c in data.get("candidates", [])]
        attentions = [CandidateAttention(**a) for a in data.get("attentions", [])]
        reports = []
        for r_dict in data.get("reports", []):
            nli = [NLIResult(**n) for n in r_dict.get("nli", [])]
            f_dict = r_dict.get("facts", {})
            issues = [FactIssue(**i) for i in f_dict.get("issues", [])]
            facts = FactReport(
                entity_precision=f_dict.get("entity_precision", 1.0),
                numeric_precision=f_dict.get("numeric_precision", 1.0),
                n_entities=f_dict.get("n_entities", 0),
                n_numbers=f_dict.get("n_numbers", 0),
                issues=issues,
            )
            reports.append(CandidateReport(cand_id=r_dict["cand_id"], nli=nli, facts=facts))

        rr_dict = data.get("rerank", {})
        scores = [SoftScoreBreakdown(**s) for s in rr_dict.get("scores", [])]
        rerank = RerankResult(
            chosen_cand_id=rr_dict.get("chosen_cand_id"),
            decision=rr_dict.get("decision", "ACCEPT"),
            decision_reason=rr_dict.get("decision_reason", ""),
            chosen_sentences=rr_dict.get("chosen_sentences", []),
            chosen_summary=rr_dict.get("chosen_summary", ""),
            scores=scores,
            why_not_first=rr_dict.get("why_not_first"),
        )

        return cls(
            run_id=data.get("run_id", str(uuid.uuid4())[:8]),
            timestamp=data.get("timestamp", datetime.now().isoformat()),
            domain=data.get("domain", "general"),
            text=data.get("text", ""),
            source_sentences=data.get("source_sentences", []),
            n_sentences=data.get("n_sentences", 0),
            n_truncated_sentences=data.get("n_truncated_sentences", 0),
            candidates=candidates,
            attentions=attentions,
            reports=reports,
            rerank=rerank,
            chosen_cand_id=data.get("chosen_cand_id"),
            chosen_summary=data.get("chosen_summary", ""),
            chosen_sentences=data.get("chosen_sentences", []),
            decision=data.get("decision", "ACCEPT"),
            decision_reason=data.get("decision_reason", ""),
            execution_time_seconds=data.get("execution_time_seconds", 0.0),
            stage_times=data.get("stage_times", {}),
        )


class RunStore:
    def __init__(self, runs_dir: Path | str | None = None):
        cfg = get_config()
        self.runs_dir = Path(runs_dir or cfg.runs_dir)
        assert_not_c_drive(str(self.runs_dir), "runs_dir")
        self.runs_dir.mkdir(parents=True, exist_ok=True)

    def save_run(self, run: RunResult) -> Path:
        out_path = self.runs_dir / f"{run.run_id}.json"
        assert_not_c_drive(str(out_path), "run_save_path")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(run.to_dict(), f, indent=2)
        logger.info(f"Saved run {run.run_id} to {out_path}")
        return out_path

    def load_run(self, run_id: str) -> Optional[RunResult]:
        file_path = self.runs_dir / f"{run_id}.json"
        if not file_path.exists():
            return None
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return RunResult.from_dict(data)

    def list_runs(self) -> list[dict[str, Any]]:
        runs = []
        for p in sorted(self.runs_dir.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    d = json.load(f)
                    runs.append({
                        "run_id": d.get("run_id", p.stem),
                        "timestamp": d.get("timestamp", ""),
                        "domain": d.get("domain", "general"),
                        "decision": d.get("decision", "UNKNOWN"),
                        "n_sentences": d.get("n_sentences", 0),
                        "summary_snippet": (d.get("chosen_summary", "")[:120] + "...") if len(d.get("chosen_summary", "")) > 120 else d.get("chosen_summary", ""),
                        "file_path": str(p),
                    })
            except Exception as e:
                logger.warning(f"Failed to read run metadata from {p}: {e}")
        return runs

    def delete_run(self, run_id: str) -> bool:
        p = self.runs_dir / f"{run_id}.json"
        if p.exists():
            p.unlink()
            return True
        return False

    def export_markdown(self, run: RunResult) -> str:
        md = []
        md.append(f"# EquiSumm Run Report - `{run.run_id}`\n")
        md.append(f"**Timestamp:** {run.timestamp} | **Domain:** {run.domain.capitalize()} | **Decision:** **{run.decision}**\n")
        md.append(f"**Decision Reason:** {run.decision_reason}\n")
        if run.rerank.why_not_first:
            md.append(f"**Why Not Beam #0:** {run.rerank.why_not_first}\n")

        md.append("\n## Verified Summary\n")
        for i, s in enumerate(run.chosen_sentences):
            md.append(f"{i + 1}. {s}")

        # Summary sentence verification details
        chosen_rep = None
        if run.chosen_cand_id is not None and run.chosen_cand_id < len(run.reports):
            chosen_rep = run.reports[run.chosen_cand_id]

        if chosen_rep:
            md.append("\n## Sentence-by-Sentence Verification\n")
            for r in chosen_rep.nli:
                s_idx = r.summary_sent_idx
                if s_idx < len(chosen_rep.facts.issues):
                    pass
                sent_text = run.chosen_sentences[s_idx] if s_idx < len(run.chosen_sentences) else ""
                md.append(f"### Sentence {s_idx + 1}")
                md.append(f"> {sent_text}\n")
                md.append(f"- **NLI Label:** {r.label.upper()} (Entailment: {r.entailment:.2f}, Neutral: {r.neutral:.2f}, Contradiction: {r.contradiction:.2f})")
                md.append(f"- **Evidence Premise Sentences:** {r.premise_sent_idxs}")

            if chosen_rep.facts.issues:
                md.append("\n## Fact Issues Detected\n")
                for iss in chosen_rep.facts.issues:
                    md.append(f"- **{iss.kind.replace('_', ' ').title()}** (Sent {iss.summary_sent_idx + 1}): {iss.detail}")

        md.append("\n## Beam Candidates Quality Breakdown\n")
        md.append("| Candidate | Logprob | Entailment | Num Prec | Ent Prec | Flagged | Feasible | Soft Score |")
        md.append("|---|---|---|---|---|---|---|---|")
        for sc in run.rerank.scores:
            md.append(
                f"| #{sc.cand_id} | {sc.seq_logprob:.3f} | {sc.entailment_mean:.2f} | "
                f"{sc.numeric_precision:.2f} | {sc.entity_precision:.2f} | {sc.n_flagged} | "
                f"{'Yes' if sc.is_feasible else 'No'} | {sc.soft_score:.3f} |"
            )

        return "\n".join(md)

    def export_csv(self, run: RunResult) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["candidate_id", "seq_logprob", "entailment_mean", "numeric_precision", "entity_precision", "n_flagged", "is_feasible", "soft_score", "text"])
        for sc, cand in zip(run.rerank.scores, run.candidates):
            writer.writerow([
                sc.cand_id,
                f"{sc.seq_logprob:.4f}",
                f"{sc.entailment_mean:.4f}",
                f"{sc.numeric_precision:.4f}",
                f"{sc.entity_precision:.4f}",
                sc.n_flagged,
                sc.is_feasible,
                f"{sc.soft_score:.4f}",
                cand.text,
            ])
        return output.getvalue()

