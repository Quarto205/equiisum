"""Unit tests for EquiSumm reranker."""
import sys
from pathlib import Path

# Ensure project root is on sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))
_EQUISUMM_DIR = _PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

try:
    from equisumm_mvp.contracts import (
        Candidate,
        CandidateAttention,
        CandidateReport,
        NLIResult,
        FactReport,
        FactIssue,
    )
except ImportError:
    from contracts import (
        Candidate,
        CandidateAttention,
        CandidateReport,
        NLIResult,
        FactReport,
        FactIssue,
    )

from app.services.reranker import EquiSummReranker


def make_dummy_cand(cand_id: int, text: str, logp: float) -> Candidate:
    return Candidate(cand_id=cand_id, text=text, token_ids=[0, 1, 2], seq_logprob=logp)


def make_dummy_att(cand_id: int, sents: list[str], n_src: int = 3) -> CandidateAttention:
    n_sum = len(sents)
    support = [[1.0 / n_src] * n_src for _ in range(n_sum)]
    entropy = [0.2] * 5
    coverage = [1.0 / n_src] * n_src
    return CandidateAttention(cand_id, sents, support, entropy, coverage)


def test_reranker_feasible_first():
    reranker = EquiSummReranker(entailment_threshold=0.5)

    cands = [
        make_dummy_cand(0, "Candidate 0 text. High logprob.", -0.1),
        make_dummy_cand(1, "Candidate 1 text. Lower logprob.", -0.5),
    ]
    atts = [
        make_dummy_att(0, ["Candidate 0 text.", "High logprob."]),
        make_dummy_att(1, ["Candidate 1 text.", "Lower logprob."]),
    ]
    # Cand 0 has a fact issue
    rep0 = CandidateReport(
        cand_id=0,
        nli=[
            NLIResult(0, [0], 0.9, 0.05, 0.05, "entailment"),
            NLIResult(1, [1], 0.9, 0.05, 0.05, "entailment"),
        ],
        facts=FactReport(
            entity_precision=1.0,
            numeric_precision=0.0,
            n_entities=1,
            n_numbers=1,
            issues=[FactIssue("scale_mismatch", 1, "High logprob.", "scale mismatch")],
        ),
    )
    # Cand 1 has no issues and passes entailment
    rep1 = CandidateReport(
        cand_id=1,
        nli=[
            NLIResult(0, [0], 0.85, 0.1, 0.05, "entailment"),
            NLIResult(1, [1], 0.80, 0.15, 0.05, "entailment"),
        ],
        facts=FactReport(
            entity_precision=1.0,
            numeric_precision=1.0,
            n_entities=1,
            n_numbers=1,
            issues=[],
        ),
    )

    result = reranker.rerank(cands, atts, [rep0, rep1], ["Source sent 1.", "Source sent 2."])
    assert result.decision == "ACCEPT"
    assert result.chosen_cand_id == 1
    assert "Candidate #1" in result.decision_reason
    assert result.why_not_first is not None
    assert "Candidate #0 failed hard constraints" in result.why_not_first


def test_reranker_prune_fallback():
    reranker = EquiSummReranker(entailment_threshold=0.5)

    cands = [
        make_dummy_cand(0, "Supported sentence. Flagged sentence.", -0.2),
    ]
    atts = [
        make_dummy_att(0, ["Supported sentence.", "Flagged sentence."]),
    ]
    rep0 = CandidateReport(
        cand_id=0,
        nli=[
            NLIResult(0, [0], 0.85, 0.1, 0.05, "entailment"),
            NLIResult(1, [1], 0.20, 0.3, 0.50, "contradiction"),
        ],
        facts=FactReport(
            entity_precision=1.0,
            numeric_precision=1.0,
            n_entities=1,
            n_numbers=0,
            issues=[],
        ),
    )

    result = reranker.rerank(cands, atts, [rep0], ["Source sent 1.", "Source sent 2."])
    assert result.decision == "ACCEPT_PRUNED"
    assert result.chosen_cand_id == 0
    assert result.chosen_sentences == ["Supported sentence."]
    assert result.chosen_summary == "Supported sentence."


def test_reranker_extractive_fallback():
    reranker = EquiSummReranker(entailment_threshold=0.5, extractive_top_k=2)

    cands = [
        make_dummy_cand(0, "All sentences are contradicted.", -0.2),
    ]
    atts = [
        make_dummy_att(0, ["All sentences are contradicted."]),
    ]
    rep0 = CandidateReport(
        cand_id=0,
        nli=[
            NLIResult(0, [0], 0.10, 0.2, 0.70, "contradiction"),
        ],
        facts=FactReport(
            entity_precision=0.0,
            numeric_precision=0.0,
            n_entities=1,
            n_numbers=0,
            issues=[FactIssue("entity_unsupported", 0, "All sentences are contradicted.", "not found")],
        ),
    )

    src = ["Source sent 1 about revenue.", "Source sent 2 about net income.", "Source sent 3 about dividend."]
    result = reranker.rerank(cands, atts, [rep0], src)
    assert result.decision == "EXTRACTIVE_FALLBACK"
    assert result.chosen_cand_id is None
    assert len(result.chosen_sentences) <= 2
    assert result.chosen_summary != ""


def test_reranker_escalate():
    reranker = EquiSummReranker(entailment_threshold=0.5)
    result = reranker.rerank([], [], [], [])
    assert result.decision == "ESCALATE"
    assert result.chosen_summary == ""

