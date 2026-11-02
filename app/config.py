"""Configuration and path-guard bootstrap for EquiSumm.

Enforces hard constraints:
1. No caches/checkpoints/outputs on C: drive (fails loudly if path resolves to C:).
2. Sets HF_HOME, TRANSFORMERS_CACHE, TORCH_HOME immediately at module import time
   BEFORE transformers or huggingface_hub is loaded.
"""
from __future__ import annotations
import os
import sys
from pathlib import Path
from dataclasses import dataclass, field
import logging
import yaml
from dotenv import load_dotenv

logger = logging.getLogger("equisumm.config")

# Project root directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
_EQUISUMM_DIR = PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

# Load .env if present
load_dotenv(PROJECT_ROOT / ".env")


def assert_not_c_drive(path_str: str, name: str = "path") -> Path:
    """Validate that the given path does not resolve to the C: drive."""
    p = Path(path_str).resolve()
    drive = p.drive.upper()
    if drive == "C:" or str(p).upper().startswith("C:"):
        raise ValueError(
            f"Hard constraint violation: {name} '{path_str}' resolves to C: drive ({p}). "
            "All caches, checkpoints, and outputs must be on D: or non-C: drive."
        )
    return p


# --- IMMEDIATE BOOTSTRAP AT IMPORT TIME ---
_cfg_file = PROJECT_ROOT / "config.yaml"
_raw_cache_root = os.getenv("EQUISUMM_CACHE_ROOT")
if not _raw_cache_root and _cfg_file.exists():
    try:
        with open(_cfg_file, "r", encoding="utf-8") as _f:
            _raw_cfg = yaml.safe_load(_f) or {}
            _raw_cache_root = _raw_cfg.get("cache", {}).get("root")
    except Exception:
        pass
if not _raw_cache_root:
    _raw_cache_root = "D:/equisumm_cache"

_BOOTSTRAP_CACHE_ROOT = assert_not_c_drive(_raw_cache_root, "EQUISUMM_CACHE_ROOT")
_HF_DIR = _BOOTSTRAP_CACHE_ROOT / "hf"
_TORCH_DIR = _BOOTSTRAP_CACHE_ROOT / "torch"

# Set environment variables for Hugging Face and PyTorch BEFORE any imports
os.environ["HF_HOME"] = str(_HF_DIR)
os.environ["HF_HUB_CACHE"] = str(_HF_DIR / "hub")
os.environ["TORCH_HOME"] = str(_TORCH_DIR)

# Pre-create cache directories
for _d in [_BOOTSTRAP_CACHE_ROOT, _HF_DIR, _TORCH_DIR]:
    _d.mkdir(parents=True, exist_ok=True)
# ------------------------------------------


@dataclass
class EquiSummConfig:
    cache_root: Path
    checkpoints_dir: Path
    runs_dir: Path
    eval_dir: Path
    adapter_dir: Path
    nli_model: str
    device: str
    fp16: bool
    n_candidates: int
    entailment_threshold: float
    top_k_premise: int
    premise_window: int
    max_nli_length: int
    reranker_weights: dict[str, float] = field(default_factory=dict)
    extractive_top_k: int = 3


def load_config(config_path: str | Path | None = None) -> EquiSummConfig:
    """Load config from yaml and environment variables, applying path guard."""
    if config_path is None:
        config_path = PROJECT_ROOT / "config.yaml"

    cfg_dict: dict = {}
    if Path(config_path).exists():
        with open(config_path, "r", encoding="utf-8") as f:
            cfg_dict = yaml.safe_load(f) or {}

    cache_root = _BOOTSTRAP_CACHE_ROOT

    checkpoints_dir = assert_not_c_drive(
        cfg_dict.get("cache", {}).get("checkpoints_dir", str(cache_root / "checkpoints")),
        "checkpoints_dir"
    )
    runs_dir = assert_not_c_drive(
        cfg_dict.get("cache", {}).get("runs_dir", str(cache_root / "runs")),
        "runs_dir"
    )
    eval_dir = assert_not_c_drive(
        cfg_dict.get("cache", {}).get("eval_dir", str(cache_root / "eval")),
        "eval_dir"
    )

    # Ensure cache directories exist
    for d in [cache_root, checkpoints_dir, runs_dir, eval_dir, _HF_DIR, _TORCH_DIR]:
        d.mkdir(parents=True, exist_ok=True)

    # Model and adapter settings
    adapter_raw = os.getenv(
        "EQUISUMM_ADAPTER_DIR",
        cfg_dict.get("model", {}).get("adapter_dir", str(checkpoints_dir / "equisumm_bart_lora"))
    )
    adapter_dir = assert_not_c_drive(adapter_raw, "adapter_dir")

    # If adapter doesn't exist in checkpoints yet, check project root fallback
    if not adapter_dir.exists() and (PROJECT_ROOT / "equisumm_bart_lora").exists():
        import shutil
        logger.info(f"Copying adapter from project to {adapter_dir}")
        shutil.copytree(PROJECT_ROOT / "equisumm_bart_lora", adapter_dir, dirs_exist_ok=True)

    nli_model = os.getenv("EQUISUMM_NLI_MODEL", cfg_dict.get("model", {}).get("nli_model", "roberta-large-mnli"))
    device_setting = os.getenv("EQUISUMM_DEVICE", cfg_dict.get("model", {}).get("device", "auto"))
    if device_setting == "auto":
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
    else:
        device = device_setting

    fp16_val = os.getenv("EQUISUMM_FP16", str(cfg_dict.get("model", {}).get("fp16", True))).lower() in ("true", "1", "yes")

    reranker_weights = cfg_dict.get("reranker", {}).get("weights", {
        "seq_logprob": 0.25,
        "entailment_mean": 0.35,
        "entity_precision": 0.15,
        "numeric_precision": 0.15,
        "coverage_entropy": 0.10,
    })

    return EquiSummConfig(
        cache_root=cache_root,
        checkpoints_dir=checkpoints_dir,
        runs_dir=runs_dir,
        eval_dir=eval_dir,
        adapter_dir=adapter_dir,
        nli_model=nli_model,
        device=device,
        fp16=fp16_val,
        n_candidates=int(cfg_dict.get("model", {}).get("n_candidates", 4)),
        entailment_threshold=float(cfg_dict.get("model", {}).get("entailment_threshold", 0.5)),
        top_k_premise=int(cfg_dict.get("model", {}).get("top_k_premise", 3)),
        premise_window=int(cfg_dict.get("model", {}).get("premise_window", 0)),
        max_nli_length=int(cfg_dict.get("model", {}).get("max_nli_length", 512)),
        reranker_weights=reranker_weights,
        extractive_top_k=int(cfg_dict.get("reranker", {}).get("extractive_top_k", 3)),
    )


# Singleton instance
_CONFIG: EquiSummConfig | None = None


def get_config() -> EquiSummConfig:
    global _CONFIG
    if _CONFIG is None:
        _CONFIG = load_config()
    return _CONFIG
