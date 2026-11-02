"""Sentence splitting + source token index (sentence-boundary truncation)."""
from __future__ import annotations
import bisect
import re
try:
    from equisumm_mvp.contracts import SourceTokenIndex
except ImportError:
    from contracts import SourceTokenIndex

_SPLIT = re.compile(r'(?<=[.!?])\s+(?=[A-Z$€£"“(\d])')
_ABBR = ("Inc.", "Corp.", "Ltd.", "Co.", "No.", "U.S.", "Mr.", "Mrs.", "Dr.", "St.", "Sec.", "vs.")


def split_sentences(text: str, min_chars: int = 20) -> list[str]:
    parts = [p.strip() for p in _SPLIT.split(text.replace("\n", " ")) if p.strip()]
    out: list[str] = []
    for p in parts:
        if out and (out[-1].endswith(_ABBR) or len(out[-1]) < min_chars):
            out[-1] += " " + p
        else:
            out.append(p)
    return out


def build_source_index(sentences: list[str], tokenizer, *, max_source_tokens: int,
                       task_prefix: str = "") -> SourceTokenIndex:
    prefix = (task_prefix + " ") if task_prefix else ""
    joined, starts, pos = prefix, [], len(prefix)
    for i, s in enumerate(sentences):
        starts.append(pos)
        joined += (" " if i else "") + s
        pos = len(joined)
    enc = tokenizer(joined, add_special_tokens=False, return_offsets_mapping=True)
    ids, offs = enc["input_ids"], enc["offset_mapping"]
    tok_sent = []
    for a, b in offs:
        j = bisect.bisect_right(starts, a) - 1 if a >= starts[0] else -1
        tok_sent.append(j)
    sentinel = 10**7
    built = tokenizer.build_inputs_with_special_tokens([sentinel])
    lead = built.index(sentinel)
    trail = len(built) - lead - 1
    budget = max_source_tokens - lead - trail
    last: dict[int, int] = {}
    for t, j in enumerate(tok_sent):
        if j >= 0:
            last[j] = t
    kept = [j for j in range(len(sentences)) if j in last and last[j] < budget]
    cut = (last[kept[-1]] + 1) if kept else min(budget, len(ids))
    n_kept = len(kept)
    ids, tok_sent = ids[:cut], tok_sent[:cut]
    input_ids = tokenizer.build_inputs_with_special_tokens(ids)
    token_sentence = [-1] * lead + tok_sent + [-1] * trail
    assert len(input_ids) == len(token_sentence) <= max_source_tokens
    return SourceTokenIndex(input_ids, token_sentence, n_kept, len(sentences) - n_kept)
