"""EquiSumm - Verified Document Summarization (Home / Verify Page)."""
from __future__ import annotations
import sys
from pathlib import Path
import streamlit as st

# Setup paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
_EQUISUMM_DIR = PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

from app.config import get_config
from app.services.pipeline import get_pipeline
from app.services.store import RunResult
from app.ui_utils import (
    render_page_header,
    get_current_run,
    set_current_run,
    read_uploaded_file,
    render_export_buttons,
    COLOR_SUPPORTED,
    COLOR_WEAK,
    COLOR_FLAGGED,
)

st.set_page_config(
    page_title="EquiSumm | Verify",
    page_icon="⚖️",
    layout="wide",
    initial_sidebar_state="expanded",
)

render_page_header(
    title="EquiSumm — Document Verification",
    purpose="Summarize complex legal and financial documents, verify each sentence against source premises, and audit factual integrity.",
)

# Initialize sample texts in session
if "input_text" not in st.session_state:
    sample_p = PROJECT_ROOT / "samples" / "01_earnings_report.txt"
    st.session_state["input_text"] = sample_p.read_text(encoding="utf-8") if sample_p.exists() else ""
if "selected_domain" not in st.session_state:
    st.session_state["selected_domain"] = "financial"
if "selected_sent_idx" not in st.session_state:
    st.session_state["selected_sent_idx"] = 0

# Sample buttons
st.write("**Sample Inputs:**")
col_s1, col_s2, col_s3, col_s4 = st.columns(4)
with col_s1:
    if st.button("Earnings Report (Financial)", use_container_width=True):
        p = PROJECT_ROOT / "samples" / "01_earnings_report.txt"
        if p.exists():
            st.session_state["input_text"] = p.read_text(encoding="utf-8")
            st.session_state["selected_domain"] = "financial"
            st.rerun()
with col_s2:
    if st.button("Services Agreement (Legal)", use_container_width=True):
        p = PROJECT_ROOT / "samples" / "02_contract_services_agreement.txt"
        if p.exists():
            st.session_state["input_text"] = p.read_text(encoding="utf-8")
            st.session_state["selected_domain"] = "legal"
            st.rerun()
with col_s3:
    if st.button("Legislative Bill (BillSum)", use_container_width=True):
        p = PROJECT_ROOT / "samples" / "03_legislative_bill_billsum.txt"
        if p.exists():
            st.session_state["input_text"] = p.read_text(encoding="utf-8")
            st.session_state["selected_domain"] = "general"
            st.rerun()
with col_s4:
    if st.button("Investment Memo (Audit)", use_container_width=True):
        p = PROJECT_ROOT / "samples" / "04_fiduciary_investment_memo.txt"
        if p.exists():
            st.session_state["input_text"] = p.read_text(encoding="utf-8")
            st.session_state["selected_domain"] = "financial"
            st.rerun()

# Input area
with st.container():
    c_left, c_right = st.columns([3, 1])
    with c_left:
        input_text = st.text_area(
            "Source Document Text",
            value=st.session_state["input_text"],
            height=200,
            help="Paste text here or upload a file below.",
        )
        st.session_state["input_text"] = input_text
    with c_right:
        domain = st.selectbox(
            "Document Domain",
            options=["financial", "legal", "general"],
            index=["financial", "legal", "general"].index(st.session_state["selected_domain"]),
        )
        st.session_state["selected_domain"] = domain

        uploaded_file = st.file_uploader("Upload .txt or .pdf", type=["txt", "pdf"])
        if uploaded_file is not None:
            extracted = read_uploaded_file(uploaded_file)
            if extracted:
                st.session_state["input_text"] = extracted
                st.success(f"Loaded {len(extracted)} characters from {uploaded_file.name}")
                st.rerun()

cfg = get_config()
c_btn, c_info = st.columns([1, 3])
with c_btn:
    run_clicked = st.button("Summarize & Verify", type="primary", use_container_width=True)

if run_clicked:
    if not input_text.strip():
        st.warning("Please provide source text or load a sample document.")
    else:
        progress_bar = st.progress(0.0)
        status_text = st.empty()

        def update_progress(msg: str, frac: float):
            progress_bar.progress(frac)
            status_text.text(f"Status: {msg}")

        try:
            pipeline = get_pipeline()
            result = pipeline.run(
                text=input_text,
                domain=domain,
                n_candidates=cfg.n_candidates,
                progress_cb=update_progress,
            )
            set_current_run(result)
            progress_bar.progress(1.0)
            status_text.text("Status: Verification complete.")
            st.rerun()
        except Exception as e:
            st.error(f"Pipeline error during verification: {e}")

# Display verification results
current_run: RunResult | None = get_current_run()

if current_run:
    st.divider()

    # Truncation warning if applicable
    if current_run.n_truncated_sentences > 0:
        st.warning(
            f"Source Truncation Notice: Document contained {current_run.n_sentences + current_run.n_truncated_sentences} "
            f"sentences. The model indexed the first {current_run.n_sentences} sentences to fit the max token budget; "
            f"{current_run.n_truncated_sentences} trailing sentences were ignored."
        )

    # Decision Banner
    dec_color = "#15803d" if current_run.decision == "ACCEPT" else "#b45309" if "PRUNED" in current_run.decision else "#b91c1c"
    st.markdown(
        f"""
        <div style="background-color: #f8fafc; border-left: 5px solid {dec_color}; padding: 0.8rem 1.2rem; margin-bottom: 1.2rem; border-radius: 4px;">
            <div style="font-size: 0.85rem; font-weight: 600; text-transform: uppercase; color: {dec_color};">Decision: {current_run.decision}</div>
            <div style="font-size: 1.05rem; font-weight: 500; margin-top: 0.2rem; color: #1e293b;">{current_run.decision_reason}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Two-panel layout: Left = Summary with sentence verdict colors; Right = Evidence panel & Source
    col_summary, col_evidence = st.columns([1, 1], gap="medium")

    # Determine report to inspect
    active_cand_id = current_run.chosen_cand_id if current_run.chosen_cand_id is not None else 0
    active_report = current_run.reports[active_cand_id] if active_cand_id < len(current_run.reports) else None

    with col_summary:
        st.subheader("Verified Summary")
        st.caption("Click a sentence to inspect its premise alignment, NLI probabilities, and fact checks.")

        chosen_sents = current_run.chosen_sentences
        if not chosen_sents:
            st.info("No sentences available in this summary.")
        else:
            for s_idx, sent_text in enumerate(chosen_sents):
                # Determine verdict for this sentence
                verdict = "supported"
                has_fact_issue = False
                nli_item = None

                if active_report:
                    fact_issues = [i for i in active_report.facts.issues if i.summary_sent_idx == s_idx]
                    nli_matches = [n for n in active_report.nli if n.summary_sent_idx == s_idx]
                    nli_item = nli_matches[0] if nli_matches else None

                    if fact_issues or (nli_item and nli_item.label == "contradiction"):
                        verdict = "flagged"
                        has_fact_issue = bool(fact_issues)
                    elif nli_item and nli_item.entailment < cfg.entailment_threshold:
                        verdict = "weak"

                v_color = COLOR_FLAGGED if verdict == "flagged" else COLOR_WEAK if verdict == "weak" else COLOR_SUPPORTED
                v_label = "Contradicted / Issue" if verdict == "flagged" else "Weak Support" if verdict == "weak" else "Supported"

                # Sentence button/card
                is_selected = (st.session_state.get("selected_sent_idx", 0) == s_idx)
                border_style = "2px solid #2563eb" if is_selected else f"1px solid {v_color}40"

                card_html = f"""
                <div style="border-left: 4px solid {v_color}; border: {border_style}; border-left-width: 4px; padding: 0.6rem 0.8rem; border-radius: 4px; margin-bottom: 0.4rem; background-color: {'#f1f5f9' if is_selected else '#ffffff'};">
                    <span style="font-size: 0.75rem; font-weight: 600; color: {v_color}; text-transform: uppercase;">[{v_label}] Sent {s_idx + 1}</span><br>
                    <span style="font-size: 0.95rem; color: #1e293b;">{sent_text}</span>
                </div>
                """
                st.markdown(card_html, unsafe_allow_html=True)

                if st.button(f"Inspect Sentence {s_idx + 1}", key=f"sel_{s_idx}"):
                    st.session_state["selected_sent_idx"] = s_idx
                    st.rerun()

    # Evidence Panel
    with col_evidence:
        st.subheader("Evidence & Audit Panel")
        selected_idx = min(st.session_state.get("selected_sent_idx", 0), max(0, len(chosen_sents) - 1))

        if chosen_sents and selected_idx < len(chosen_sents):
            curr_sent = chosen_sents[selected_idx]
            st.markdown(f"**Inspecting Sentence {selected_idx + 1}:**")
            st.markdown(f"> *\"{curr_sent}\"*")

            # NLI Evidence
            premise_indices = []
            if active_report and selected_idx < len(active_report.nli):
                nli_res = active_report.nli[selected_idx]
                premise_indices = nli_res.premise_sent_idxs

                m1, m2, m3 = st.columns(3)
                m1.metric("Entailment", f"{nli_res.entailment:.1%}")
                m2.metric("Neutral", f"{nli_res.neutral:.1%}")
                m3.metric("Contradiction", f"{nli_res.contradiction:.1%}")

                st.write(f"**Attention-Guided Premise Sentences:** `Indices: {premise_indices}`")

            # Fact Check issues for this sentence
            if active_report:
                s_issues = [i for i in active_report.facts.issues if i.summary_sent_idx == selected_idx]
                if s_issues:
                    st.markdown("**Fact Integrity Issues Detected:**")
                    for iss in s_issues:
                        st.error(f"**{iss.kind.replace('_', ' ').title()}:** {iss.detail}")
                else:
                    st.success("No numeric, currency, scale, or entity issues detected in this sentence.")

            # Source panel with highlighted premise
            st.write("**Source Document Context:**")
            highlighted_source = []
            for j, s_text in enumerate(current_run.source_sentences):
                if j in premise_indices:
                    highlighted_source.append(
                        f"<div style='background-color: #fef08a; padding: 0.3rem 0.5rem; margin-bottom: 0.3rem; border-radius: 3px; font-weight: 500;'><b>[Src #{j+1}]</b> {s_text}</div>"
                    )
                else:
                    highlighted_source.append(
                        f"<div style='color: #64748b; padding: 0.2rem 0.5rem; margin-bottom: 0.2rem;'><b>[Src #{j+1}]</b> {s_text}</div>"
                    )

            st.markdown(
                f"<div style='max-height: 280px; overflow-y: auto; border: 1px solid #e2e8f0; padding: 0.5rem; border-radius: 4px; background-color: #f8fafc;'>"
                f"{''.join(highlighted_source)}</div>",
                unsafe_allow_html=True,
            )

    # Export footer
    st.divider()
    st.write("**Export Results:**")
    render_export_buttons(current_run, key_suffix="home")

