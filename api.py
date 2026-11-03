"""EquiSumm Verification API Service (FastAPI).

Exposes:
- POST /api/verify: Runs full EquiSumm pipeline (BART+LoRA -> Attn -> NLI -> Fact -> Rerank)
- GET /api/samples: Provides all benchmark text samples
- GET /api/runs: Lists saved run history
- GET /api/health: Reports system VRAM, GPU, and cache state
"""
from __future__ import annotations
import sys
import os
from pathlib import Path
from typing import Optional
import logging
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch

# Ensure project root is on sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))
_EQUISUMM_DIR = _PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

from app.config import get_config
from app.services.pipeline import get_pipeline
from app.services.store import RunStore, RunResult

logger = logging.getLogger("equisumm.api")

app = FastAPI(title="EquiSumm Verification API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VerifyRequest(BaseModel):
    text: str
    domain: str = "financial"
    n_candidates: int = 4

@app.get("/api/health")
def health():
    cfg = get_config()
    vram_alloc = torch.cuda.memory_allocated() / (1024**3) if torch.cuda.is_available() else 0.0
    vram_reserved = torch.cuda.memory_reserved() / (1024**3) if torch.cuda.is_available() else 0.0
    return {
        "status": "online",
        "device": cfg.device,
        "fp16": cfg.fp16,
        "vram_allocated_gb": round(vram_alloc, 2),
        "vram_reserved_gb": round(vram_reserved, 2),
        "cache_root": str(cfg.cache_root),
        "adapter_dir": str(cfg.adapter_dir),
    }

@app.get("/api/samples")
def get_samples():
    samples_dir = _PROJECT_ROOT / "samples"
    samples = {}
    if samples_dir.exists():
        for p in sorted(samples_dir.glob("*.txt")):
            samples[p.stem] = {
                "name": p.stem.replace("_", " ").title(),
                "text": p.read_text(encoding="utf-8").strip(),
                "domain": "financial" if "earning" in p.stem or "memo" in p.stem else "legal" if "contract" in p.stem else "general",
            }
    return samples

@app.post("/api/verify")
def verify_document(req: VerifyRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Document text cannot be empty.")
    try:
        pipeline = get_pipeline()
        result: RunResult = pipeline.run(
            text=req.text.strip(),
            domain=req.domain,
            n_candidates=max(1, min(4, req.n_candidates)),
        )
        return result.to_dict()
    except Exception as e:
        logger.exception("Pipeline verification failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/runs")
def list_runs():
    store = RunStore()
    return store.list_runs()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
