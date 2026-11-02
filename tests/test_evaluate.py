"""Unit tests for Evaluator."""
import sys
from pathlib import Path

# Ensure project root is on sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))
_EQUISUMM_DIR = _PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

from app.config import get_config
from app.services.evaluate import Evaluator


def test_evaluator_pair_and_benchmark():
    cfg = get_config()
    test_eval_dir = cfg.cache_root / "test_eval"
    evaluator = Evaluator(eval_dir=test_eval_dir)
    sample_file = Path("samples/05_researcher_benchmark_sample.jsonl")
    assert sample_file.exists()

    report = evaluator.run_benchmark(sample_file, max_samples=3, run_name="test_bench")
    assert report.n_samples == 3
    assert 0.0 <= report.mean_rouge1 <= 1.0
    assert 0.0 <= report.mean_rougeL <= 1.0
    assert len(report.all_results) == 3

    # Clean up test output
    p = test_eval_dir / "test_bench.jsonl"
    if p.exists():
        p.unlink()
