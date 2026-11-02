"""BART/T5 + LoRA adapter summarizer. Adapter merged into the base so attention is plain eager."""
from __future__ import annotations
import os
import json
from pathlib import Path

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
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from peft import PeftModel

try:
    from equisumm_mvp.contracts import Candidate, SourceTokenIndex
    from equisumm_mvp.tokenization import build_source_index, split_sentences
except ImportError:
    from contracts import Candidate, SourceTokenIndex
    from tokenization import build_source_index, split_sentences


class HFSeq2SeqSummarizer:
    def __init__(self, adapter_dir: str, device: str | None = None, fp16: bool = True):
        d = Path(adapter_dir)
        self.meta = json.loads((d / "equisumm_meta.json").read_text())
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        dtype = torch.float16 if (fp16 and self.device == "cuda") else torch.float32
        self.tokenizer = AutoTokenizer.from_pretrained(str(d))
        base = AutoModelForSeq2SeqLM.from_pretrained(
            self.meta["base_model_id"], attn_implementation="eager", torch_dtype=dtype)
        self.model = PeftModel.from_pretrained(base, str(d)).merge_and_unload().to(self.device).eval()
        self.max_source = self.meta["max_source_tokens"]
        self.prefix = self.meta.get("task_prefix", "")

    def prepare(self, text: str) -> tuple[list[str], SourceTokenIndex]:
        sents = split_sentences(text)
        return sents, build_source_index(sents, self.tokenizer,
                                         max_source_tokens=self.max_source, task_prefix=self.prefix)

    @torch.inference_mode()
    def generate(self, index: SourceTokenIndex, n_candidates: int = 4) -> list[Candidate]:
        g = self.meta["generation"]
        ids = torch.tensor([index.input_ids], device=self.device)
        out = self.model.generate(
            input_ids=ids, attention_mask=torch.ones_like(ids),
            num_beams=max(g["num_beams"], n_candidates), num_return_sequences=n_candidates,
            max_new_tokens=g["max_new_tokens"], min_new_tokens=g["min_new_tokens"],
            no_repeat_ngram_size=g["no_repeat_ngram_size"], length_penalty=g["length_penalty"],
            early_stopping=g["early_stopping"], return_dict_in_generate=True, output_scores=True)
        pad = self.tokenizer.pad_token_id
        cands = []
        for i in range(out.sequences.shape[0]):
            seq = [t for t in out.sequences[i].tolist()]
            while seq and seq[-1] == pad:
                seq.pop()
            text = self.tokenizer.decode(seq, skip_special_tokens=True).strip()
            cands.append(Candidate(i, text, seq, float(out.sequences_scores[i])))
        return cands
