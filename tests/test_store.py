"""Unit tests for RunStore."""
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
    )
except ImportError:
    from contracts import (
        Candidate,
        CandidateAttention,
        CandidateReport,
        NLIResult,
        FactReport,
    )

from app.services.reranker import SoftScoreBreakdown, RerankResult
from app.services.store import RunResult, RunStore


def test_run_store_save_load(tmp_path):
    # Ensure tmp_path is on D: or non-C: drive
    from app.config import get_config
    cfg = get_config()
    test_runs_dir = cfg.cache_root / "test_runs"
    store = RunStore(runs_dir=test_runs_dir)

    run = RunResult(
        run_id="test_001",
        timestamp="2026-11-02T12:00:00",
        domain="financial",
        text="Acme reported $1.2 billion in revenue. Net income fell 8%.",
        source_sentences=["Acme reported $1.2 billion in revenue.", "Net income fell 8%."],
        n_sentences=2,
        n_truncated_sentences=0,
        candidates=[Candidate(0, "Acme reported $1.2 billion in revenue.", [1, 2, 3], -0.2)],
        attentions=[CandidateAttention(0, ["Acme reported $1.2 billion in revenue."], [[1.0, 0.0]], [0.1], [0.8, 0.2])],
        reports=[CandidateReport(0, [NLIResult(0, [0], 0.95, 0.03, 0.02, "entailment")], FactReport(1.0, 1.0, 1, 1, []))],
        rerank=RerankResult(0, "ACCEPT", "Passed all checks", ["Acme reported $1.2 billion in revenue."], "Acme reported $1.2 billion in revenue.", [
            SoftScoreBreakdown(0, -0.2, 1.0, 0.95, 1.0, 1.0, 0.9, 0.97, True, 0, 0, [])
        ]),
        chosen_cand_id=0,
        chosen_summary="Acme reported $1.2 billion in revenue.",
        chosen_sentences=["Acme reported $1.2 billion in revenue."],
        decision="ACCEPT",
        decision_reason="Passed all checks",
        execution_time_seconds=1.5,
        stage_times={"index": 0.1, "summarize": 0.5},
    )

    saved_path = store.save_run(run)
    assert saved_path.exists()

    loaded = store.load_run("test_001")
    assert loaded is not None
    assert loaded.run_id == "test_001"
    assert loaded.decision == "ACCEPT"
    assert len(loaded.chosen_sentences) == 1

    md = store.export_markdown(loaded)
    assert "# EquiSumm Run Report" in md
    assert "Verified Summary" in md

    csv_data = store.export_csv(loaded)
    assert "candidate_id" in csv_data

    runs = store.list_runs()
    assert any(r["run_id"] == "test_001" for r in runs)

    assert store.delete_run("test_001") is True
    assert store.load_run("test_001") is None

