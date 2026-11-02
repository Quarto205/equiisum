"""EquiSumm - Fact Check Page."""
from __future__ import annotations
import sys
from pathlib import Path
import streamlit as st
import pandas as pd

# Setup paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.ui_utils import (
    render_page_header,
    get_current_run,
    render_export_buttons,
    COLOR_SUPPORTED,
    COLOR_FLAGGED,
)
try:
    from equisumm_mvp.fact_verifier import FactExtractor, _match
except ImportError:
    from fact_verifier import FactExtractor, _match

st.set_page_config(page_title="EquiSumm | Fact Check", page_icon="⚖️", layout="wide")

render_page_header(
    title="Fact Check Audit Table",
    purpose="Examine side-by-side verification of all numeric values, scales, currencies, percentages, and entities against source records.",
)

run = get_current_run()

if not run:
    st.info("No document has been analyzed yet. Go to Verify (Home) to summarize a document or load a sample.")
else:
    active_cand_id = run.chosen_cand_id if run.chosen_cand_id is not None else 0
    active_report = run.reports[active_cand_id] if active_cand_id < len(run.reports) else None

    # Overview Metrics
    if active_report:
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Numeric Precision", f"{active_report.facts.numeric_precision:.1%}")
        c2.metric("Entity Precision", f"{active_report.facts.entity_precision:.1%}")
        c3.metric("Numbers Checked", active_report.facts.n_numbers)
        c4.metric("Entities Checked", active_report.facts.n_entities)

    st.subheader("Numeric & Entity Audit Table")

    # Extract all summary facts and match against source
    extractor = FactExtractor()
    src_text = " ".join(run.source_sentences)
    src_facts = extractor.extract(src_text)
    src_nums = [n for n in src_facts.numbers if not n.year]

    rows = []
    # Process each summary sentence
    for s_idx, sent in enumerate(run.chosen_sentences):
        f = extractor.extract(sent)
        # Numbers
        for n in (x for x in f.numbers if not x.year):
            hit = next((b for b in src_nums if _match(n, b)), None)
            issue = None
            if active_report:
                for iss in active_report.facts.issues:
                    if iss.summary_sent_idx == s_idx and n.raw in iss.detail:
                        issue = iss.kind
                        break

            status = "Verified"
            if hit is None:
                status = "Scale Mismatch" if issue == "scale_mismatch" else "Numeric Unsupported"
            elif n.cur and hit.cur and n.cur != hit.cur:
                status = "Currency Mismatch"
            elif n.pct != hit.pct:
                status = "Percent Mismatch"
            elif issue == "direction_conflict":
                status = "Direction Conflict"

            rows.append({
                "Sentence": s_idx + 1,
                "Type": "Number",
                "Summary Token": n.raw,
                "Value": f"{n.value:,.2f}",
                "Scale": f"{n.scale:,.0f}" if n.scale != 1.0 else "1x",
                "Currency": n.cur or "-",
                "Percent": "Yes" if n.pct else "No",
                "Source Match": hit.raw if hit else "None",
                "Status": status,
            })

        # Entities
        for e in f.entities:
            el = e.lower()
            matched = (el in src_text.lower())
            issue = None
            if active_report:
                for iss in active_report.facts.issues:
                    if iss.summary_sent_idx == s_idx and e in iss.detail:
                        issue = iss.kind
                        break

            status = "Verified" if matched and not issue else "Entity Unsupported"
            rows.append({
                "Sentence": s_idx + 1,
                "Type": "Entity",
                "Summary Token": e,
                "Value": "-",
                "Scale": "-",
                "Currency": "-",
                "Percent": "-",
                "Source Match": e if matched else "None",
                "Status": status,
            })

    if not rows:
        st.info("No numbers or named entities were detected in the summary.")
    else:
        df = pd.DataFrame(rows)

        # Filter by Issue Kind / Status
        statuses = ["All"] + sorted(list(df["Status"].unique()))
        selected_filter = st.selectbox("Filter by Verification Status / Issue Kind", options=statuses)

        if selected_filter != "All":
            filtered_df = df[df["Status"] == selected_filter]
        else:
            filtered_df = df

        # Style dataframe for visual clarity
        def highlight_status(val):
            if val == "Verified":
                return f"color: {COLOR_SUPPORTED}; font-weight: 600;"
            else:
                return f"color: {COLOR_FLAGGED}; font-weight: 600;"

        styled_df = filtered_df.style.map(highlight_status, subset=["Status"])
        st.dataframe(styled_df, use_container_width=True, hide_index=True)

    # Detailed issues list
    if active_report and active_report.facts.issues:
        st.subheader("Flagged Issues Breakdown")
        for iss in active_report.facts.issues:
            st.error(
                f"**[Sent {iss.summary_sent_idx + 1} - {iss.kind.replace('_', ' ').title()}]:** "
                f"{iss.detail}\n\n*Text:* \"{iss.summary_text}\""
            )

    st.divider()
    st.write("**Export Fact Check Sign-Off:**")
    render_export_buttons(run, key_suffix="fact_check")

