"""Unit tests for tokenization and source index building."""
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
    from equisumm_mvp.tokenization import split_sentences, build_source_index
except ImportError:
    from tokenization import split_sentences, build_source_index

from transformers import AutoTokenizer


def test_split_sentences():
    text = "Acme Corp reported $1.2 billion in revenue. Net income fell 8%! Did CEO Jane Roe approve it? Yes."
    sents = split_sentences(text)
    assert len(sents) >= 2
    assert "Acme Corp reported $1.2 billion in revenue." in sents[0]


def test_split_sentences_abbreviations():
    text = "Dr. Smith met with Acme Corp. at 2 p.m. in the U.S. office."
    sents = split_sentences(text)
    # Shouldn't split at Dr. or Corp. or U.S.
    assert len(sents) == 1


def test_build_source_index_truncation():
    # Load tokenizer from local checkpoint
    from app.config import get_config
    cfg = get_config()
    tokenizer = AutoTokenizer.from_pretrained(str(cfg.adapter_dir))

    sentences = [
        "First sentence discussing financial earnings for the quarter.",
        "Second sentence covering revenue growth of 15 percent year over year.",
        "Third sentence outlining liabilities, risks, and regulatory inquiries.",
        "Fourth sentence giving guidance for the upcoming fiscal year."
    ]

    # Test with generous budget
    idx_full = build_source_index(sentences, tokenizer, max_source_tokens=256)
    assert idx_full.n_sentences == 4
    assert idx_full.n_truncated_sentences == 0
    assert len(idx_full.input_ids) == len(idx_full.token_sentence)

    # Test with tight budget that forces sentence truncation
    idx_tight = build_source_index(sentences, tokenizer, max_source_tokens=30)
    assert idx_tight.n_sentences < 4
    assert idx_tight.n_truncated_sentences > 0
    assert len(idx_tight.input_ids) <= 30
    assert len(idx_tight.input_ids) == len(idx_tight.token_sentence)

