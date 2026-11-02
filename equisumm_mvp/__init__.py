"""EquiSumm MVP core modules package."""
from .contracts import (
    SourceTokenIndex,
    Candidate,
    CandidateAttention,
    NLIResult,
    FactIssue,
    FactReport,
    CandidateReport,
)
from .tokenization import split_sentences, build_source_index
from .hf_seq2seq import HFSeq2SeqSummarizer
from .extractor import CrossAttentionExtractor
from .nli_model import NLIVerifier
from .fact_verifier import FactExtractor, FactVerifier

__all__ = [
    "SourceTokenIndex",
    "Candidate",
    "CandidateAttention",
    "NLIResult",
    "FactIssue",
    "FactReport",
    "CandidateReport",
    "split_sentences",
    "build_source_index",
    "HFSeq2SeqSummarizer",
    "CrossAttentionExtractor",
    "NLIVerifier",
    "FactExtractor",
    "FactVerifier",
]

