"""EquiSumm - Embeddings Projection Page."""
from __future__ import annotations
import sys
from pathlib import Path
import streamlit as st

# Setup paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
_EQUISUMM_DIR = PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

from app.ui_utils import render_page_header, get_current_run, render_export_buttons
from app.services.viz import compute_tsne_embeddings

st.set_page_config(page_title="EquiSumm | Embeddings", page_icon="⚖️", layout="wide")

render_page_header(
    title="Sentence Embeddings 2D Projection",
    purpose="Visualize geometric distribution of source and summary sentence embeddings in 2D space via t-SNE, color-coded by factual support status.",
)

run = get_current_run()

if not run:
    st.info("No document has been analyzed yet. Go to Verify (Home) to summarize a document or load a sample.")
else:
    active_cand_id = run.chosen_cand_id if run.chosen_cand_id is not None else 0
    active_report = run.reports[active_cand_id] if active_cand_id < len(run.reports) else None

    # Flagged sentence indices
    flagged_indices = []
    if active_report:
        from app.config import get_config
        cfg = get_config()
        flagged_indices = active_report.flagged_sentences(cfg.entailment_threshold)

    st.subheader("t-SNE Semantic Space")
    st.caption(
        "Green circles indicate supported summary sentences clustered with source premises; "
        "Red cross marks designate flagged sentences exhibiting factual distortion; "
        "Grey circles represent underlying source document sentences (capped to 300 sentences)."
    )

    # Cache t-SNE in session state to prevent expensive re-computation per click
    cache_key = f"tsne_{run.run_id}_{active_cand_id}"
    if cache_key not in st.session_state:
        with st.spinner("Computing t-SNE 2D manifold projection..."):
            fig = compute_tsne_embeddings(
                source_sentences=run.source_sentences,
                summary_sentences=run.chosen_sentences,
                flagged_summary_indices=flagged_indices,
                max_points=300,
            )
            st.session_state[cache_key] = fig
    else:
        fig = st.session_state[cache_key]

    st.plotly_chart(fig, use_container_width=True)

    # Sentence Legend Breakdown
    st.subheader("Cluster Inspection")
    c_supp, c_flag = st.columns(2)
    with c_supp:
        st.markdown("**Supported Summary Sentences:**")
        for i, s in enumerate(run.chosen_sentences):
            if i not in flagged_indices:
                st.write(f"- **S{i+1}:** {s}")

    with c_flag:
        st.markdown("**Flagged / Deviant Sentences:**")
        if not flagged_indices:
            st.success("None (all summary sentences supported).")
        else:
            for i in flagged_indices:
                st.write(f"- **F{i+1}:** {run.chosen_sentences[i] if i < len(run.chosen_sentences) else ''}")

    st.divider()
    st.write("**Export Projection Data:**")
    render_export_buttons(run, key_suffix="embeddings")

