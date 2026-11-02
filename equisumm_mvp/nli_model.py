"""Attention-guided premise selection + roberta-large-mnli entailment."""
from __future__ import annotations
import os

# Enforce HF_HOME path guard before importing transformers
_hf_home = os.environ.get("HF_HOME", "")
if not _hf_home or _hf_home.upper().startswith("C:"):
    try:
        import app.config as _cfg  # noqa: F401
    except ImportError:
        pass
    _hf_home = os.environ.get("HF_HOME", "")
    if not _hf_home or _hf_home.upper().startswith("C:"):
        raise ValueError(f"Hard constraint violation: HF_HOME must be set to non-C drive, got '{_hf_home}'")

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

try:
    from equisumm_mvp.contracts import CandidateAttention, NLIResult
except ImportError:
    from contracts import CandidateAttention, NLIResult


class NLIVerifier:
    def __init__(self, model_id: str = "roberta-large-mnli", device: str | None = None,
                 fp16: bool = True, top_k: int = 3, window: int = 0, max_len: int = 512):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        dt = torch.float16 if (fp16 and self.device == "cuda") else torch.float32
        self.tok = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_id, torch_dtype=dt).to(self.device).eval()
        self.id2label = {int(i): l.lower() for i, l in self.model.config.id2label.items()}
        self.top_k, self.window, self.max_len = top_k, window, max_len

    def select_premise(self, support_row: list[float], n_src: int) -> list[int]:
        top = sorted(range(len(support_row)), key=lambda j: -support_row[j])[: self.top_k]
        idx = {min(max(j + d, 0), n_src - 1) for j in top for d in range(-self.window, self.window + 1)}
        return sorted(idx)

    @torch.inference_mode()
    def verify(self, source_sentences: list[str], att: CandidateAttention) -> list[NLIResult]:
        res = []
        for s, hyp in enumerate(att.summary_sentences):
            idxs = self.select_premise(att.support[s], len(source_sentences))
            prem = " ".join(source_sentences[j] for j in idxs)
            enc = self.tok(prem, hyp, truncation="only_first", max_length=self.max_len,
                           return_tensors="pt").to(self.device)
            p = self.model(**enc).logits.float().softmax(-1)[0].cpu().tolist()
            by = {self.id2label[i]: p[i] for i in range(len(p))}
            label = max(by, key=by.get)
            res.append(NLIResult(s, idxs, by["entailment"], by["neutral"], by["contradiction"], label, []))
        return res
