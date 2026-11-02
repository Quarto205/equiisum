"""Unit tests for FactVerifier."""
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
    from equisumm_mvp.fact_verifier import FactVerifier, FactExtractor
except ImportError:
    from fact_verifier import FactVerifier, FactExtractor

SRC = [
    "Acme Corp reported revenue of $1.2 billion for the quarter.",
    "Net income fell 8% to $90 million, driven by higher costs.",
    "CEO Jane Roe said the board approved a dividend of $0.50 per share."
]


def test_fact_extractor_numbers_and_entities():
    ex = FactExtractor()
    facts = ex.extract("Acme Corp reported $1.2 billion and net income fell 8%.")
    assert len(facts.numbers) == 2
    assert facts.numbers[0].value == 1.2e9
    assert facts.numbers[1].value == 8.0
    assert facts.numbers[1].pct is True
    assert "Acme Corp" in facts.entities


def test_scale_mismatch():
    v = FactVerifier()
    report = v.verify(["Acme Corp reported revenue of $1.2 million."], SRC)
    kinds = [i.kind for i in report.issues]
    assert "scale_mismatch" in kinds
    assert report.numeric_precision < 1.0


def test_direction_conflict():
    v = FactVerifier()
    report = v.verify(["Net income rose 8% to $90 million."], SRC)
    kinds = [i.kind for i in report.issues]
    assert "direction_conflict" in kinds


def test_entity_unsupported():
    v = FactVerifier()
    report = v.verify(["Wayne Enterprises approved a dividend."], SRC)
    kinds = [i.kind for i in report.issues]
    assert "entity_unsupported" in kinds
    assert report.entity_precision < 1.0


def test_clean_summary():
    v = FactVerifier()
    report = v.verify(["Acme Corp reported revenue of $1.2 billion and net income fell 8%."], SRC)
    assert len(report.issues) == 0
    assert report.numeric_precision == 1.0
    assert report.entity_precision == 1.0


def test_currency_and_percent_mismatch():
    v = FactVerifier()
    # Currency mismatch
    rep_cur = v.verify(["Acme Corp reported revenue of €1.2 billion."], SRC)
    assert any(i.kind == "currency_mismatch" for i in rep_cur.issues)

    # Percent mismatch
    rep_pct = v.verify(["Net income fell 8 dollars to $90 million."], SRC)
    assert any(i.kind == "percent_mismatch" for i in rep_pct.issues)

