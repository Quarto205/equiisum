"""Teacher-forced cross-attention extraction -> sentence-level support / entropy / coverage."""
from __future__ import annotations
import math
import re
import torch
try:
    from equisumm_mvp.contracts import Candidate, CandidateAttention, SourceTokenIndex
except ImportError:
    from contracts import Candidate, CandidateAttention, SourceTokenIndex

_SPLIT = re.compile(r'(?<=[.!?])\s+(?=[A-Z$€£"“(\d])')


def _spans(text: str) -> list[tuple[int, int]]:
    spans, start = [], 0
    for m in _SPLIT.finditer(text):
        spans.append((start, m.start())); start = m.end()
    spans.append((start, len(text)))
    return [(a, b) for a, b in spans if text[a:b].strip()]


class CrossAttentionExtractor:
    def __init__(self, summarizer, layers: list[int] | None = None):
        self.s, self.layers = summarizer, layers   # layers=None -> mean over all decoder layers

    @torch.inference_mode()
    def extract(self, index: SourceTokenIndex, cand: Candidate) -> CandidateAttention:
        m, tok, dev = self.s.model, self.s.tokenizer, self.s.device
        seq = cand.token_ids
        enc = torch.tensor([index.input_ids], device=dev)
        dec_in = torch.tensor([seq[:-1]], device=dev)
        out = m(input_ids=enc, attention_mask=torch.ones_like(enc),
                decoder_input_ids=dec_in, output_attentions=True, use_cache=False)
        ca = out.cross_attentions
        ca = [ca[i] for i in (self.layers or range(len(ca)))]
        attn = torch.stack([a[0].float().mean(0) for a in ca]).mean(0)       # (T, S)
        n_src = index.n_sentences
        M = torch.zeros(attn.shape[1], n_src, device=dev)
        for p, j in enumerate(index.token_sentence):
            if 0 <= j < n_src:
                M[p, j] = 1.0
        sa = attn @ M                                                        # (T, n_src)
        sa = sa / sa.sum(-1, keepdim=True).clamp_min(1e-9)
        targets = seq[1:]
        special = set(tok.all_special_ids)
        keep = [t for t, y in enumerate(targets) if y not in special]
        raw = tok.decode([targets[t] for t in keep], skip_special_tokens=True)
        spans = _spans(raw)
        ends = [len(tok.decode([targets[t] for t in keep[:i + 1]], skip_special_tokens=True))
                for i in range(len(keep))]
        sent_of = []
        for e in ends:
            k = next((i for i, (a, b) in enumerate(spans) if e - 1 < b + 1), len(spans) - 1)
            sent_of.append(k)
        rows = sa[keep].cpu()
        support = []
        for k in range(len(spans)):
            r = rows[[i for i, s in enumerate(sent_of) if s == k]]
            support.append((r.mean(0) if len(r) else torch.zeros(n_src)).tolist())
        ent = (-(rows * rows.clamp_min(1e-9).log()).sum(-1) / math.log(max(n_src, 2))).tolist()
        cov = rows.mean(0).tolist()
        return CandidateAttention(cand.cand_id, [raw[a:b].strip() for a, b in spans], support, ent, cov)
