"""EquiSumm Reranker Service.

Implements hard constraints first (no fact issues, entailment >= threshold),
then soft score ranking (seq_logprob, entailment_mean, entity_precision, numeric_precision, coverage entropy).

Fallbacks:
1. ACCEPT: Feasible candidate with highest soft score.
2. ACCEPT_PRUNED: Prune flagged sentences from top candidate if >= 1 clean sentence remains.
3. EXTRACTIVE_FALLBACK: Extract top-k source sentences using attention coverage.
4. ESCALATE: Escalate to human reviewer if text cannot be safely summarized.
"""
from __future__ import annotations
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

# Ensure project root and equisumm_mvp are on sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))
_EQUISUMM_DIR = _PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

try:
    from equisumm_mvp.contracts import Candidate, CandidateAttention, CandidateReport
except ImportError:
    from contracts import Candidate, CandidateAttention, CandidateReport


@dataclass
class SoftScoreBreakdown:
    cand_id: int
    seq_logprob: float
    norm_logprob: float
    entailment_mean: float
    entity_precision: float
    numeric_precision: float
    coverage_entropy: float
    soft_score: float
    is_feasible: bool
    n_flagged: int
    n_fact_issues: int
    rejection_reasons: list[str] = field(default_factory=list)


@dataclass
class RerankResult:
    chosen_cand_id: Optional[int]
    decision: str  # "ACCEPT" | "ACCEPT_PRUNED" | "EXTRACTIVE_FALLBACK" | "ESCALATE"
    decision_reason: str
    chosen_sentences: list[str]
    chosen_summary: str
    scores: list[SoftScoreBreakdown]
    why_not_first: Optional[str] = None


class EquiSummReranker:
    def __init__(
        self,
        entailment_threshold: float = 0.5,
        weights: dict[str, float] | None = None,
        extractive_top_k: int = 3,
    ):
        self.entailment_threshold = entailment_threshold
        self.weights = weights or {
            "seq_logprob": 0.25,
            "entailment_mean": 0.35,
            "entity_precision": 0.15,
            "numeric_precision": 0.15,
            "coverage_entropy": 0.10,
        }
        self.extractive_top_k = extractive_top_k

    def _normalize_logprobs(self, logprobs: list[float]) -> list[float]:
        if not logprobs:
            return []
        min_lp, max_lp = min(logprobs), max(logprobs)
        if abs(max_lp - min_lp) < 1e-9:
            return [1.0] * len(logprobs)
        return [(lp - min_lp) / (max_lp - min_lp) for lp in logprobs]

    def score_candidate(
        self,
        cand: Candidate,
        att: CandidateAttention,
        rep: CandidateReport,
        norm_logprob: float,
    ) -> SoftScoreBreakdown:
        flagged = rep.flagged_sentences(self.entailment_threshold)
        fact_issues = rep.facts.issues
        rejection_reasons: list[str] = []

        if fact_issues:
            issues_summary = ", ".join(f"{i.kind}: {i.detail}" for i in fact_issues[:2])
            if len(fact_issues) > 2:
                issues_summary += f" (+{len(fact_issues) - 2} more)"
            rejection_reasons.append(f"Fact issues ({len(fact_issues)}): {issues_summary}")

        low_ent_sents = [r for r in rep.nli if r.entailment < self.entailment_threshold]
        if low_ent_sents:
            rejection_reasons.append(
                f"{len(low_ent_sents)} sentence(s) below entailment threshold ({self.entailment_threshold:.2f})"
            )

        is_feasible = (len(flagged) == 0 and len(fact_issues) == 0)

        # Token entropy: mean token entropy over content tokens (lower is sharper attention)
        # We invert so higher is better for coverage/focus consistency
        mean_entropy = sum(att.token_entropy) / max(1, len(att.token_entropy))
        norm_entropy_score = max(0.0, min(1.0, 1.0 - mean_entropy))

        w = self.weights
        soft = (
            w.get("seq_logprob", 0.25) * norm_logprob
            + w.get("entailment_mean", 0.35) * rep.nli_entailment_mean
            + w.get("entity_precision", 0.15) * rep.facts.entity_precision
            + w.get("numeric_precision", 0.15) * rep.facts.numeric_precision
            + w.get("coverage_entropy", 0.10) * norm_entropy_score
        )

        return SoftScoreBreakdown(
            cand_id=cand.cand_id,
            seq_logprob=cand.seq_logprob,
            norm_logprob=norm_logprob,
            entailment_mean=rep.nli_entailment_mean,
            entity_precision=rep.facts.entity_precision,
            numeric_precision=rep.facts.numeric_precision,
            coverage_entropy=norm_entropy_score,
            soft_score=soft,
            is_feasible=is_feasible,
            n_flagged=len(flagged),
            n_fact_issues=len(fact_issues),
            rejection_reasons=rejection_reasons,
        )

    def rerank(
        self,
        candidates: list[Candidate],
        attentions: list[CandidateAttention],
        reports: list[CandidateReport],
        source_sentences: list[str],
    ) -> RerankResult:
        if not candidates or not attentions or not reports:
            # Fallback when no candidates exist
            extractive_sents = source_sentences[: self.extractive_top_k]
            if extractive_sents:
                return RerankResult(
                    chosen_cand_id=None,
                    decision="EXTRACTIVE_FALLBACK",
                    decision_reason="No generation candidates available. Reverted to extractive fallback.",
                    chosen_sentences=extractive_sents,
                    chosen_summary=" ".join(extractive_sents),
                    scores=[],
                )
            return RerankResult(
                chosen_cand_id=None,
                decision="ESCALATE",
                decision_reason="No candidates generated and source document is empty.",
                chosen_sentences=[],
                chosen_summary="",
                scores=[],
            )

        norm_lps = self._normalize_logprobs([c.seq_logprob for c in candidates])
        scores: list[SoftScoreBreakdown] = [
            self.score_candidate(c, a, r, nlp)
            for c, a, r, nlp in zip(candidates, attentions, reports, norm_lps)
        ]

        # Feasible candidates (passed all hard constraints)
        feasible = [s for s in scores if s.is_feasible]

        # Check why candidate #0 was or wasn't chosen
        why_not_first: Optional[str] = None
        cand0_score = scores[0] if scores else None

        if feasible:
            # Sort feasible candidates by soft score descending
            feasible.sort(key=lambda s: s.soft_score, reverse=True)
            winner = feasible[0]
            chosen_att = attentions[winner.cand_id]
            chosen_summary = " ".join(chosen_att.summary_sentences)

            if cand0_score and winner.cand_id != 0:
                if not cand0_score.is_feasible:
                    why_not_first = (
                        f"Beam Candidate #0 failed hard constraints: "
                        + "; ".join(cand0_score.rejection_reasons)
                    )
                else:
                    why_not_first = (
                        f"Beam Candidate #0 was feasible but had a lower composite soft score "
                        f"({cand0_score.soft_score:.3f} vs #{winner.cand_id}'s {winner.soft_score:.3f})."
                    )

            return RerankResult(
                chosen_cand_id=winner.cand_id,
                decision="ACCEPT",
                decision_reason=(
                    f"Candidate #{winner.cand_id} passed all hard constraints "
                    f"and achieved the highest composite soft score ({winner.soft_score:.3f})."
                ),
                chosen_sentences=chosen_att.summary_sentences,
                chosen_summary=chosen_summary,
                scores=scores,
                why_not_first=why_not_first,
            )

        # No candidate passed hard constraints. Try PRUNE fallback on top candidate.
        # Order all candidates by fewest flagged sentences, then soft score
        sorted_all = sorted(scores, key=lambda s: (s.n_flagged, -s.soft_score))
        best_candidate_score = sorted_all[0]
        best_cand_id = best_candidate_score.cand_id
        best_att = attentions[best_cand_id]
        best_rep = reports[best_cand_id]
        flagged_indices = set(best_rep.flagged_sentences(self.entailment_threshold))

        clean_sentences = [
            sent for idx, sent in enumerate(best_att.summary_sentences)
            if idx not in flagged_indices
        ]

        if cand0_score:
            why_not_first = (
                f"Candidate #0 failed hard constraints: "
                + "; ".join(cand0_score.rejection_reasons)
            )

        # If pruning leaves at least 1 verified sentence
        if clean_sentences:
            return RerankResult(
                chosen_cand_id=best_cand_id,
                decision="ACCEPT_PRUNED",
                decision_reason=(
                    f"All candidates had verification issues. Candidate #{best_cand_id} "
                    f"was pruned by removing {len(flagged_indices)} flagged sentence(s), "
                    f"retaining {len(clean_sentences)} fully supported sentence(s)."
                ),
                chosen_sentences=clean_sentences,
                chosen_summary=" ".join(clean_sentences),
                scores=scores,
                why_not_first=why_not_first,
            )

        # Fallback 2: Extractive fallback from source sentences using coverage
        if source_sentences:
            # Use top candidate's source coverage if available, else first k sentences
            cov = best_att.source_coverage
            if len(cov) == len(source_sentences):
                ranked_indices = sorted(range(len(source_sentences)), key=lambda j: -cov[j])
                top_indices = sorted(ranked_indices[: self.extractive_top_k])
                extractive_sents = [source_sentences[j] for j in top_indices]
            else:
                extractive_sents = source_sentences[: self.extractive_top_k]

            return RerankResult(
                chosen_cand_id=None,
                decision="EXTRACTIVE_FALLBACK",
                decision_reason=(
                    "All generated candidates were heavily hallucinated/flagged and pruning left no sentences. "
                    "Selected top salient source sentences via cross-attention coverage."
                ),
                chosen_sentences=extractive_sents,
                chosen_summary=" ".join(extractive_sents),
                scores=scores,
                why_not_first=why_not_first,
            )

        # Fallback 3: Escalate to human
        return RerankResult(
            chosen_cand_id=None,
            decision="ESCALATE",
            decision_reason=(
                "All abstractive candidates failed verification, no valid sentences could be pruned, "
                "and source document contains no extractable content. Escalated to human reviewer."
            ),
            chosen_sentences=[],
            chosen_summary="",
            scores=scores,
            why_not_first=why_not_first,
        )

