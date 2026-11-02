"""Offline fact tests always run. Full pipeline: python smoke_test.py --adapter <dir> [--nli roberta-large-mnli]"""
import argparse

try:
    from equisumm_mvp.fact_verifier import FactVerifier
except ImportError:
    from fact_verifier import FactVerifier

SRC = ["Acme Corp reported revenue of $1.2 billion for the quarter.",
       "Net income fell 8% to $90 million, driven by higher costs.",
       "CEO Jane Roe said the board approved a dividend."]


def offline():
    v = FactVerifier()
    kinds = lambda s: {i.kind for i in v.verify([s], SRC).issues}
    assert "scale_mismatch" in kinds("Acme Corp reported revenue of $1.2 million."), "scale"
    assert "direction_conflict" in kinds("Net income rose 8% to $90 million."), "direction"
    assert "entity_unsupported" in kinds("Globex Holdings approved a dividend."), "entity"
    assert not kinds("Acme Corp revenue was about $1.2 billion and net income fell 8%."), "clean"
    print("offline fact checks: OK")


def full(adapter, nli_id):
    try:
        from equisumm_mvp.hf_seq2seq import HFSeq2SeqSummarizer
        from equisumm_mvp.extractor import CrossAttentionExtractor
        from equisumm_mvp.nli_model import NLIVerifier
        from equisumm_mvp.contracts import CandidateReport
    except ImportError:
        from hf_seq2seq import HFSeq2SeqSummarizer
        from extractor import CrossAttentionExtractor
        from nli_model import NLIVerifier
        from contracts import CandidateReport
    s = HFSeq2SeqSummarizer(adapter)
    sents, idx = s.prepare(" ".join(SRC) * 1)
    cands = s.generate(idx, 4)
    ex, nli, fv = CrossAttentionExtractor(s), NLIVerifier(nli_id), FactVerifier()
    for c in cands:
        att = ex.extract(idx, c)
        rep = CandidateReport(c.cand_id, nli.verify(sents, att), fv.verify(att.summary_sentences, sents))
        print(f"[{c.cand_id}] logp={c.seq_logprob:.3f} ent={rep.nli_entailment_mean:.2f} "
              f"numP={rep.facts.numeric_precision:.2f} entP={rep.facts.entity_precision:.2f} "
              f"flag={rep.flagged_sentences()}\n    {c.text}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--adapter"); ap.add_argument("--nli", default="roberta-large-mnli")
    a = ap.parse_args(); offline()
    if a.adapter: full(a.adapter, a.nli)
