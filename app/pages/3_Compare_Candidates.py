"""EquiSumm - Compare Candidates Page."""
from __future__ import annotations
import sys
from pathlib import Path
import streamlit as st
import pandas as pd

# Setup paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
_EQUISUMM_DIR = PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

from app.ui_utils import (
    render_page_header,
    get_current_run,
    render_export_buttons,
    COLOR_SUPPORTED,
    COLOR_FLAGGED,
)

st.set_page_config(page_title="EquiSumm | Compare Candidates", page_icon="⚖️", layout="wide")

render_page_header(
    title="Beam Candidates Comparison",
    purpose="Audit ROUGE-free quality signals, constraint feasibility, and composite soft scores across all beam search candidates to explain reranker decisions.",
)

run = get_current_run()

if not run:
    st.info("No document has been analyzed yet. Go to Verify (Home) to summarize a document or load a sample.")
else:
    # "Why not #1?" Explanation Banner
    st.subheader("Reranker Decision Explanation")
    chosen_id = run.chosen_cand_id
    why_not = run.rerank.why_not_first

    if chosen_id == 0:
        st.success(
            f"**Candidate #0 Selected:** Beam candidate #0 satisfied all hard constraints "
            f"and achieved the highest composite soft score ({run.rerank.scores[0].soft_score:.3f})."
        )
    elif chosen_id is not None:
        st.info(
            f"**Selected Candidate #{chosen_id} instead of Candidate #0:**\n\n"
            f"{why_not or run.decision_reason}"
        )
    else:
        st.warning(f"**Fallback Activated:** {run.decision_reason}")

    st.divider()

    # ROUGE-Free Quality Signals Table
    st.subheader("Candidate Quality Signals Breakdown")
    table_rows = []
    for sc, cand in zip(run.rerank.scores, run.candidates):
        is_chosen = (cand.cand_id == run.chosen_cand_id)
        table_rows.append({
            "Candidate": f"#{cand.cand_id} {'(Selected)' if is_chosen else ''}",
            "Seq Logprob": f"{cand.seq_logprob:.3f}",
            "Entailment Mean": f"{sc.entailment_mean:.1%}",
            "Numeric Precision": f"{sc.numeric_precision:.1%}",
            "Entity Precision": f"{sc.entity_precision:.1%}",
            "Flagged Sents": sc.n_flagged,
            "Fact Issues": sc.n_fact_issues,
            "Feasible": "PASS" if sc.is_feasible else "FAIL",
            "Soft Score": f"{sc.soft_score:.3f}",
        })

    df = pd.DataFrame(table_rows)

    def color_feasible(val):
        if val == "PASS":
            return f"color: {COLOR_SUPPORTED}; font-weight: bold;"
        elif val == "FAIL":
            return f"color: {COLOR_FLAGGED}; font-weight: bold;"
        return ""

    styled_df = df.style.map(color_feasible, subset=["Feasible"])
    st.dataframe(styled_df, use_container_width=True, hide_index=True)

    # Detailed candidate inspections
    st.subheader("Inspect Candidate Texts")
    cand_tabs = st.tabs([f"Candidate #{c.cand_id}" for c in run.candidates])
    for tab, cand, sc, rep in zip(cand_tabs, run.candidates, run.rerank.scores, run.reports):
        with tab:
            col_t, col_s = st.columns([2, 1])
            with col_t:
                st.markdown(f"**Full Text:**")
                st.write(cand.text)
                if sc.rejection_reasons:
                    st.markdown("**Constraint Violations:**")
                    for r in sc.rejection_reasons:
                        st.error(r)
            with col_s:
                st.markdown("**Score Components:**")
                st.write(f"- Length-norm Logprob: `{cand.seq_logprob:.4f}`")
                st.write(f"- NLI Entailment: `{sc.entailment_mean:.2%}`")
                st.write(f"- Numeric Precision: `{sc.numeric_precision:.2%}`")
                st.write(f"- Entity Precision: `{sc.entity_precision:.2%}`")
                st.write(f"- Normalized Attention Focus: `{sc.coverage_entropy:.2%}`")
                st.write(f"- **Composite Soft Score:** `{sc.soft_score:.4f}`")

    st.divider()
    st.write("**Export Comparison:**")
    render_export_buttons(run, key_suffix="compare")

