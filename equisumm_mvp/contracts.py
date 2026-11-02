"""Minimal self-contained data contracts for the EquiSumm MVP (reconstructed)."""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass(frozen=True)
class SourceTokenIndex:
    input_ids: list[int]              # exact model input (incl. special tokens)
    token_sentence: list[int]         # per input token: source sentence idx, -1 for special/prefix
    n_sentences: int                  # sentences kept after truncation
    n_truncated_sentences: int


@dataclass(frozen=True)
class Candidate:
    cand_id: int
    text: str
    token_ids: list[int]              # decoder sequence as generated (starts with decoder_start)
    seq_logprob: float                # length-normalised beam score


@dataclass(frozen=True)
class CandidateAttention:
    cand_id: int
    summary_sentences: list[str]
    support: list[list[float]]        # [n_summary_sent][n_source_sent], rows sum to ~1
    token_entropy: list[float]        # normalised 0..1, per content token
    source_coverage: list[float]      # [n_source_sent], sums to ~1


@dataclass(frozen=True)
class NLIResult:
    summary_sent_idx: int
    premise_sent_idxs: list[int]
    entailment: float
    neutral: float
    contradiction: float
    label: str
    token_scores: list[float] = field(default_factory=list)


@dataclass(frozen=True)
class FactIssue:
    kind: str                         # scale_mismatch | numeric_unsupported | currency_mismatch |
                                      # percent_mismatch | direction_conflict | entity_unsupported
    summary_sent_idx: int
    summary_text: str
    detail: str


@dataclass(frozen=True)
class FactReport:
    entity_precision: float
    numeric_precision: float
    n_entities: int
    n_numbers: int
    issues: list[FactIssue]


@dataclass(frozen=True)
class CandidateReport:
    cand_id: int
    nli: list[NLIResult]
    facts: FactReport

    @property
    def nli_entailment_mean(self) -> float:
        return sum(r.entailment for r in self.nli) / max(1, len(self.nli))

    def flagged_sentences(self, ent_threshold: float = 0.5) -> list[int]:
        bad = {r.summary_sent_idx for r in self.nli if r.entailment < ent_threshold}
        bad |= {i.summary_sent_idx for i in self.facts.issues}
        return sorted(bad)
