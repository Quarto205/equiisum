"""EquiSumm - Evaluate Benchmark Page."""
from __future__ import annotations
import sys
import json
from pathlib import Path
import streamlit as st
import pandas as pd
import plotly.graph_objects as go

# Setup paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
_EQUISUMM_DIR = PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

from app.ui_utils import render_page_header
from app.services.evaluate import Evaluator, EvalSummaryReport
from app.config import get_config

st.set_page_config(page_title="EquiSumm | Evaluate", page_icon="⚖️", layout="wide")

render_page_header(
    title="Benchmark Evaluation & Factuality Audit",
    purpose="Evaluate summarization quality across test datasets, comparing lexical ROUGE metrics against NLI entailment and factual precision to detect metric divergence.",
)

cfg = get_config()
evaluator = Evaluator()

# Session storage for evaluation results
if "eval_report" not in st.session_state:
    st.session_state["eval_report"] = None

c1, c2 = st.columns([2, 1])
with c1:
    dataset_option = st.radio(
        "Choose Evaluation Dataset",
        options=["Built-in Research Benchmark (JSONL)", "Upload Custom JSONL"],
        horizontal=True,
    )
    if dataset_option == "Upload Custom JSONL":
        uploaded_jsonl = st.file_uploader("Upload dataset (.jsonl with 'id', 'text', 'summary')", type=["jsonl"])
    else:
        uploaded_jsonl = None

with c2:
    max_samples = st.slider("Max Samples", min_value=1, max_value=100, value=5)
    run_benchmark_btn = st.button("Run Benchmark Evaluation", type="primary", use_container_width=True)

if run_benchmark_btn:
    dataset_file = None
    if dataset_option == "Upload Custom JSONL" and uploaded_jsonl:
        temp_p = cfg.eval_dir / "user_uploaded_benchmark.jsonl"
        with open(temp_p, "wb") as f:
            f.write(uploaded_jsonl.read())
        dataset_file = temp_p
    else:
        dataset_file = PROJECT_ROOT / "samples" / "05_researcher_benchmark_sample.jsonl"

    if not dataset_file.exists():
        st.error(f"Dataset file {dataset_file} not found.")
    else:
        progress_bar = st.progress(0.0)
        status_text = st.empty()

        def on_progress(done: int, total: int, msg: str):
            frac = done / max(1, total)
            progress_bar.progress(frac)
            status_text.text(f"Progress ({done}/{total}): {msg}")

        try:
            report: EvalSummaryReport = evaluator.run_benchmark(
                dataset_path=dataset_file,
                max_samples=max_samples,
                run_name="interactive_eval",
                progress_cb=on_progress,
            )
            st.session_state["eval_report"] = report
            progress_bar.progress(1.0)
            status_text.text("Benchmark complete!")
            st.rerun()
        except Exception as e:
            st.error(f"Evaluation error: {e}")

report: EvalSummaryReport | None = st.session_state["eval_report"]

if report:
    st.divider()

    # Overview Cards
    st.subheader(f"Evaluation Summary ({report.n_samples} Samples)")
    m1, m2, m3, m4, m5, m6 = st.columns(6)
    m1.metric("ROUGE-1", f"{report.mean_rouge1:.3f}")
    m2.metric("ROUGE-2", f"{report.mean_rouge2:.3f}")
    m3.metric("ROUGE-L", f"{report.mean_rougeL:.3f}")
    m4.metric("NLI Entailment", f"{report.mean_nli_entailment:.1%}")
    m5.metric("Numeric Precision", f"{report.mean_numeric_precision:.1%}")
    m6.metric("Entity Precision", f"{report.mean_entity_precision:.1%}")

    # Comparative Bar Chart
    st.subheader("Lexical vs Factuality Metric Comparison")
    metrics_names = ["ROUGE-1", "ROUGE-2", "ROUGE-L", "NLI Entailment", "Numeric Prec", "Entity Prec"]
    metrics_vals = [
        report.mean_rouge1,
        report.mean_rouge2,
        report.mean_rougeL,
        report.mean_nli_entailment,
        report.mean_numeric_precision,
        report.mean_entity_precision,
    ]
    colors = ["#94a3b8", "#94a3b8", "#64748b", "#2563eb", "#16a34a", "#0d9488"]

    fig = go.Figure(
        data=go.Bar(
            x=metrics_names,
            y=metrics_vals,
            marker=dict(color=colors),
            text=[f"{v:.2f}" for v in metrics_vals],
            textposition="auto",
        )
    )
    fig.update_layout(
        yaxis=dict(title="Score (0..1)", range=[0, 1.05]),
        margin=dict(l=40, r=40, t=30, b=30),
        height=320,
        template="plotly_white",
    )
    st.plotly_chart(fig, use_container_width=True)

    # Core Finding: High ROUGE, Low Factuality Divergence
    st.subheader("Core Research Finding: High ROUGE vs Fact Hallucinations")
    st.markdown(
        """
        > **Key Insight:** Standard n-gram overlap metrics (ROUGE) often award high scores to summaries
        > that contain subtle but catastrophic factual errors (e.g. inverted growth direction, altered scale, or wrong numeric values).
        """
    )

    if report.high_rouge_low_fact_cases:
        st.error(f"Detected {len(report.high_rouge_low_fact_cases)} high-ROUGE / low-factuality case(s):")
        for case in report.high_rouge_low_fact_cases:
            with st.expander(f"Case `{case.doc_id}` — ROUGE-L: {case.rougeL:.2f} | Numeric Prec: {case.numeric_precision:.1%}"):
                c_gen, c_ref = st.columns(2)
                with c_gen:
                    st.markdown("**Evaluated Summary:**")
                    st.write(case.generated_summary)
                with c_ref:
                    st.markdown("**Reference Summary:**")
                    st.write(case.reference_summary)
                st.markdown("**Fact Violations Detected:**")
                for iss in case.fact_issues:
                    st.write(f"- `{iss.get('kind', '')}`: {iss.get('detail', '')}")
    else:
        st.success("No high-ROUGE / low-factuality divergence observed in this evaluation sample batch.")

    # All Results Table
    st.subheader("All Evaluated Samples")
    rows = []
    for r in report.all_results:
        rows.append({
            "Doc ID": r.doc_id,
            "ROUGE-1": f"{r.rouge1:.3f}",
            "ROUGE-2": f"{r.rouge2:.3f}",
            "ROUGE-L": f"{r.rougeL:.3f}",
            "NLI Entailment": f"{r.nli_entailment_mean:.1%}",
            "Num Prec": f"{r.numeric_precision:.1%}",
            "Ent Prec": f"{r.entity_precision:.1%}",
            "Fact Issues": r.fact_issues_count,
            "Divergent": "YES" if r.is_high_rouge_low_fact else "NO",
        })
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    # Export
    st.divider()
    st.write("**Export Evaluation Report:**")
    c_e1, c_e2 = st.columns(2)
    with c_e1:
        st.download_button(
            "Download Benchmark CSV",
            data=pd.DataFrame(rows).to_csv(index=False),
            file_name="equisumm_benchmark_results.csv",
            mime="text/csv",
            use_container_width=True,
        )
    with c_e2:
        st.download_button(
            "Download Full Results JSON",
            data=json.dumps([asdict(r) for r in report.all_results], indent=2),
            file_name="equisumm_benchmark_results.json",
            mime="application/json",
            use_container_width=True,
        )

