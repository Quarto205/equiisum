"""Strict numeric + entity verification (scale, currency, percent, rounding, direction)."""
from __future__ import annotations
import re
from dataclasses import dataclass
try:
    from equisumm_mvp.contracts import FactIssue, FactReport
except ImportError:
    from contracts import FactIssue, FactReport

_MULT = {"trillion": 1e12, "tn": 1e12, "t": 1e12, "billion": 1e9, "bn": 1e9, "b": 1e9,
         "million": 1e6, "mn": 1e6, "mm": 1e6, "m": 1e6, "thousand": 1e3, "k": 1e3}
_NUM = re.compile(
    r'(?<![\w.])(?P<cur>[$€£₹]|USD|EUR|GBP|INR)?\s?(?P<num>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)'
    r'(?:\s?(?P<scale>trillion|billion|million|thousand|bn|mn|mm|tn|[BMKT])\b)?'
    r'(?P<pct>\s?(?:%|percent|per cent))?')
_ENT = re.compile(r"\b[A-Z][A-Za-z0-9&\-]+(?:\s+(?:of\s+|and\s+|&\s+)?[A-Z][A-Za-z0-9&\-]+)*")
_STOP = {"The", "This", "That", "These", "It", "In", "On", "At", "For", "A", "An", "As", "By", "Under",
         "January", "February", "March", "April", "May", "June", "July", "August", "September",
         "October", "November", "December", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}
_UP = {"rose", "increased", "grew", "gained", "jumped", "climbed", "surged", "rise", "growth"}
_DOWN = {"fell", "decreased", "declined", "dropped", "plunged", "shrank", "decline", "loss", "dropped"}


@dataclass(frozen=True)
class Num:
    value: float
    tol: float
    cur: str
    pct: bool
    mant: float
    scale: float
    raw: str
    year: bool


@dataclass(frozen=True)
class Facts:
    numbers: list[Num]
    entities: list[str]


class FactExtractor:
    def extract(self, text: str) -> Facts:
        nums = []
        for m in _NUM.finditer(text):
            s = m.group("num"); clean = s.replace(",", "")
            mant = float(clean)
            sc = _MULT.get((m.group("scale") or "").lower(), 1.0) if m.group("scale") else 1.0
            dec = len(clean.split(".")[1]) if "." in clean else 0
            year = (not m.group("cur") and not m.group("scale") and not m.group("pct")
                    and "," not in s and "." not in s and len(s) == 4 and 1900 <= mant <= 2100)
            nums.append(Num(mant * sc, 0.5 * 10 ** -dec * sc, m.group("cur") or "",
                            bool(m.group("pct")), mant, sc, m.group(0).strip(), year))
        ents = []
        for m in _ENT.finditer(text):
            words = m.group(0).split()
            while words and words[0] in _STOP:
                words.pop(0)
            if words and not (len(words) == 1 and words[0] in _STOP):
                ents.append(" ".join(words))
        return Facts(nums, ents)


def _match(a: Num, b: Num) -> bool:
    return abs(a.value - b.value) <= max(a.tol, b.tol) + 1e-9


class FactVerifier:
    def __init__(self):
        self.ex = FactExtractor()

    def verify(self, summary_sentences: list[str], source_sentences: list[str]) -> FactReport:
        src_text = " ".join(source_sentences)
        src_low = src_text.lower()
        src_nums = [n for n in self.ex.extract(src_text).numbers if not n.year]
        src_facts_by_sent = [self.ex.extract(s) for s in source_sentences]
        issues: list[FactIssue] = []
        n_num = ok_num = n_ent = ok_ent = 0
        for si, sent in enumerate(summary_sentences):
            f = self.ex.extract(sent)
            matched_src_sents: set[int] = set()
            for n in (x for x in f.numbers if not x.year):
                n_num += 1
                hit = next((b for b in src_nums if _match(n, b)), None)
                if hit is None:
                    kind = "numeric_unsupported"
                    detail = f"'{n.raw}' not found in source"
                    if any(abs(b.mant - n.mant) < 1e-9 and b.scale != n.scale for b in src_nums):
                        kind, detail = "scale_mismatch", f"'{n.raw}' has same digits as a source figure but a different scale"
                    issues.append(FactIssue(kind, si, sent, detail)); continue
                if n.cur and hit.cur and n.cur != hit.cur:
                    issues.append(FactIssue("currency_mismatch", si, sent, f"'{n.raw}' vs source '{hit.raw}'")); continue
                if n.pct != hit.pct:
                    issues.append(FactIssue("percent_mismatch", si, sent, f"'{n.raw}' vs source '{hit.raw}'")); continue
                ok_num += 1
                for j, sf in enumerate(src_facts_by_sent):
                    if any(_match(n, b) for b in sf.numbers):
                        matched_src_sents.add(j)
            words = set(re.findall(r"[a-z]+", sent.lower()))
            s_up, s_down = bool(words & _UP), bool(words & _DOWN)
            if matched_src_sents and (s_up != s_down):
                sw = set(re.findall(r"[a-z]+", " ".join(source_sentences[j] for j in matched_src_sents).lower()))
                r_up, r_down = bool(sw & _UP), bool(sw & _DOWN)
                if (s_up and r_down and not r_up) or (s_down and r_up and not r_down):
                    issues.append(FactIssue("direction_conflict", si, sent,
                                            "summary direction contradicts the source sentence with the same figure"))
            for e in f.entities:
                n_ent += 1
                el = e.lower()
                if el in src_low or (" " in el and all(w in src_low for w in re.findall(r"\w+", el))):
                    ok_ent += 1
                else:
                    issues.append(FactIssue("entity_unsupported", si, sent, f"entity '{e}' not in source"))
        return FactReport(ok_ent / n_ent if n_ent else 1.0, ok_num / n_num if n_num else 1.0,
                          n_ent, n_num, issues)
