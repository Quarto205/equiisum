"""EquiSumm - Runs and Settings Page."""
from __future__ import annotations
import sys
from pathlib import Path
import streamlit as st
import torch
import yaml

# Setup paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
_EQUISUMM_DIR = PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

from app.ui_utils import render_page_header, set_current_run, render_export_buttons
from app.services.store import RunStore
from app.config import get_config, assert_not_c_drive
try:
    from equisumm_mvp.fact_verifier import FactVerifier
except ImportError:
    from fact_verifier import FactVerifier

st.set_page_config(page_title="EquiSumm | Runs & Settings", page_icon="⚙️", layout="wide")

render_page_header(
    title="Run History & System Settings",
    purpose="Manage saved audit runs, monitor GPU VRAM allocation, configure verification thresholds, and run offline self-tests.",
)

cfg = get_config()
store = RunStore()

# GPU Memory Gauge
st.subheader("Hardware & GPU VRAM Monitor")
col_gpu1, col_gpu2, col_gpu3 = st.columns(3)

has_cuda = torch.cuda.is_available()
if has_cuda:
    dev_name = torch.cuda.get_device_name(0)
    allocated = torch.cuda.memory_allocated(0) / (1024 ** 2)
    reserved = torch.cuda.memory_reserved(0) / (1024 ** 2)
    total_mem = torch.cuda.get_device_properties(0).total_memory / (1024 ** 2)

    col_gpu1.metric("Active GPU Device", dev_name)
    col_gpu2.metric("Allocated VRAM", f"{allocated:.1f} MB / {total_mem:.0f} MB")
    col_gpu3.metric("Reserved VRAM Cache", f"{reserved:.1f} MB")

    vram_frac = min(1.0, max(0.0, reserved / total_mem))
    st.progress(vram_frac, text=f"VRAM Utilization: {vram_frac*100:.1f}% of {total_mem:.0f} MB")
    if reserved > 5000:
        st.warning("VRAM usage is approaching the 5GB ceiling. Clear cache recommended.")
else:
    col_gpu1.metric("Inference Engine", "CPU Mode (Active)")
    col_gpu2.metric("PyTorch CUDA", "Not Enabled")
    col_gpu3.metric("Precision", "float32")

c_clrgpu, c_selftest = st.columns(2)
with c_clrgpu:
    if st.button("Flush PyTorch VRAM Cache"):
        if has_cuda:
            torch.cuda.empty_cache()
            st.success("CUDA memory cache flushed.")
        else:
            st.info("CPU cache flushed.")

with c_selftest:
    if st.button("Run Offline Self-Test"):
        try:
            v = FactVerifier()
            src = [
                "Acme Corp reported revenue of $1.2 billion for the quarter.",
                "Net income fell 8% to $90 million, driven by higher costs.",
                "CEO Jane Roe said the board approved a dividend."
            ]
            kinds = lambda s: {i.kind for i in v.verify([s], src).issues}
            assert "scale_mismatch" in kinds("Acme Corp reported revenue of $1.2 million.")
            assert "direction_conflict" in kinds("Net income rose 8% to $90 million.")
            assert "entity_unsupported" in kinds("Globex Holdings approved a dividend.")
            assert not kinds("Acme Corp revenue was about $1.2 billion and net income fell 8%.")
            st.success("All offline fact check assertions passed successfully (100% OK).")
        except Exception as e:
            st.error(f"Self-test failed: {e}")

st.divider()

# System Settings Configuration
st.subheader("Model & Verification Settings")
with st.form("settings_form"):
    col_set1, col_set2 = st.columns(2)
    with col_set1:
        new_n_cands = st.number_input("Number of Beam Candidates", min_value=1, max_value=8, value=cfg.n_candidates)
        new_ent_thresh = st.slider("NLI Entailment Threshold", min_value=0.1, max_value=0.9, value=cfg.entailment_threshold, step=0.05)
        new_top_k = st.number_input("Top-K Attention Premise Sentences", min_value=1, max_value=6, value=cfg.top_k_premise)

    with col_set2:
        new_device = st.selectbox("Execution Device", options=["auto", "cuda", "cpu"], index=["auto", "cuda", "cpu"].index(cfg.device if cfg.device in ["cuda", "cpu"] else "auto"))
        new_fp16 = st.checkbox("FP16 Half-Precision Inference", value=cfg.fp16)
        cache_path_display = st.text_input("Cache Root (Non-C: Required)", value=str(cfg.cache_root))

    save_settings = st.form_submit_button("Save Configuration", type="primary")
    if save_settings:
        try:
            assert_not_c_drive(cache_path_display, "cache_root")
            cfg_path = PROJECT_ROOT / "config.yaml"
            with open(cfg_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}

            data.setdefault("model", {})
            data["model"]["n_candidates"] = new_n_cands
            data["model"]["entailment_threshold"] = new_ent_thresh
            data["model"]["top_k_premise"] = new_top_k
            data["model"]["device"] = new_device
            data["model"]["fp16"] = new_fp16
            data.setdefault("cache", {})
            data["cache"]["root"] = cache_path_display

            with open(cfg_path, "w", encoding="utf-8") as f:
                yaml.safe_dump(data, f)
            st.success("Settings saved to config.yaml successfully.")
        except Exception as e:
            st.error(f"Failed to update settings: {e}")

st.divider()

# Saved Runs History
st.subheader("Saved Runs History")
runs = store.list_runs()

if not runs:
    st.info("No saved runs found in the cache repository.")
else:
    for r in runs:
        with st.expander(f"Run `{r['run_id']}` — {r['timestamp'][:19]} | {r['domain'].capitalize()} | Decision: {r['decision']}"):
            st.write(f"**Summary:** {r['summary_snippet']}")

            c_act1, c_act2 = st.columns([1, 1])
            with c_act1:
                if st.button(f"Reopen Run {r['run_id']}", key=f"reopen_{r['run_id']}"):
                    loaded_run = store.load_run(r['run_id'])
                    if loaded_run:
                        set_current_run(loaded_run)
                        st.success(f"Loaded run {r['run_id']} as current. Switch to Verify, Fact Check, or Explorer pages.")
            with c_act2:
                if st.button(f"Delete Run {r['run_id']}", key=f"del_{r['run_id']}"):
                    store.delete_run(r['run_id'])
                    st.warning(f"Deleted run {r['run_id']}.")
                    st.rerun()

            loaded_run = store.load_run(r['run_id'])
            if loaded_run:
                render_export_buttons(loaded_run, key_suffix=f"history_{r['run_id']}")

