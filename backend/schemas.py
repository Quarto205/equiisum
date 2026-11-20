from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class RunSubmission(BaseModel):
    text: str = Field(min_length=1, max_length=2_000_000)
    domain: Literal["financial", "legal", "general"] = "general"
    n_candidates: int | None = Field(default=None, ge=1, le=8)


class EvaluationSubmission(BaseModel):
    dataset: Literal["builtin"] = "builtin"
    max_samples: int = Field(default=5, ge=1, le=100)
    run_name: str = Field(default="interactive_eval", min_length=1, max_length=80)


class SettingsUpdate(BaseModel):
    n_candidates: int = Field(ge=1, le=8)
    entailment_threshold: float = Field(ge=0.1, le=0.9)
    top_k_premise: int = Field(ge=1, le=6)
    device: Literal["auto", "cuda", "cpu"]
    fp16: bool
    cache_root: str = Field(min_length=3)
