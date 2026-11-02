"""EquiSumm - Attention Explorer Page."""
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
from app.services.viz import (
    create_attention_heatmap,
    create_coverage_barchart,
    create_token_entropy_chart,
)

st.set_page_config(page_title="EquiSumm | Attention Explorer", page_icon="⚖️", layout="wide")

render_page_header(
    title="Cross-Attention Explorer",
    purpose="Inspect teacher-forced cross-attention alignments to determine which source sections produced each summary sentence and identify ignored content.",
)

run = get_current_run()

if not run:
    st.info("No document has been analyzed yet. Go to Verify (Home) to summarize a document or load a sample.")
else:
    active_cand_id = run.chosen_cand_id if run.chosen_cand_id is not None else 0
    att = run.attentions[active_cand_id] if active_cand_id < len(run.attentions) else None

    if not att:
        st.warning("No attention extraction data available for this run.")
    else:
        # Interactive question: "Which part of the document produced this sentence?"
        st.subheader("Sentence Attribution Inspector")
        sent_options = [f"Summary Sent {i+1}: {s[:80]}..." for i, s in enumerate(att.summary_sentences)]
        selected_sent_idx = st.selectbox(
            "Select a summary sentence to trace its source origins:",
            options=list(range(len(sent_options))),
            format_func=lambda i: sent_options[i],
        )

        curr_summary_sent = att.summary_sentences[selected_sent_idx]
        support_row = att.support[selected_sent_idx]
        sorted_src_indices = sorted(range(len(support_row)), key=lambda j: -support_row[j])

        st.markdown(f"**Target Summary Sentence:** *\"{curr_summary_sent}\"*")
        st.markdown("**Top Source Premise Sentences by Cross-Attention Weight:**")

        col_top = st.columns(min(3, len(sorted_src_indices)))
        for rank, j in enumerate(sorted_src_indices[: len(col_top)]):
            with col_top[rank]:
                weight = support_row[j]
                src_text = run.source_sentences[j] if j < len(run.source_sentences) else ""
                st.metric(f"Rank #{rank + 1} — Src #{j + 1}", f"{weight:.1%}")
                st.caption(f"\"{src_text}\"")

        st.divider()

        # Visualizations
        col_heat, col_cov = st.columns([1, 1], gap="medium")

        with col_heat:
            st.subheader("Cross-Attention Support Matrix")
            fig_heat = create_attention_heatmap(att, run.source_sentences)
            st.plotly_chart(fig_heat, use_container_width=True)

        with col_cov:
            st.subheader("Source Coverage Distribution")
            fig_cov = create_coverage_barchart(att, run.source_sentences)
            st.plotly_chart(fig_cov, use_container_width=True)

        st.subheader("Attention Focus & Token Entropy")
        st.caption("Lower entropy indicates sharp, focused attention on specific source premises; higher entropy signals dispersed or diffuse attention.")
        fig_entropy = create_token_entropy_chart(att)
        st.plotly_chart(fig_entropy, use_container_width=True)

        st.divider()
        st.write("**Export Attention & Attribution Data:**")
        render_export_buttons(run, key_suffix="attention")

