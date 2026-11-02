"""UI Utilities and styling for EquiSumm Streamlit pages."""
from __future__ import annotations
import io
from pathlib import Path
from typing import Optional
import streamlit as st
from pypdf import PdfReader

from app.services.store import RunResult, RunStore
from app.config import get_config

# Styling constants
COLOR_SUPPORTED = "#16a34a"     # Green
COLOR_WEAK = "#d97706"          # Amber
COLOR_FLAGGED = "#dc2626"       # Red
COLOR_ACCENT = "#2563eb"        # Royal blue
COLOR_BG_CARD = "#f8fafc"


def apply_theme():
    """Inject clean, minimal custom CSS enforcing light theme, whitespace and no emoji clutter."""
    st.markdown(
        """
        <style>
        /* Base typography and spacing */
        html, body, [class*="css"] {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
        }
        .main .block-container {
            padding-top: 1.5rem;
            padding-bottom: 3rem;
            max-width: 1140px;
        }
        /* Top Purpose Banner */
        .page-purpose {
            font-size: 0.95rem;
            color: #475569;
            border-left: 3px solid #2563eb;
            padding: 0.4rem 0.8rem;
            margin-bottom: 1.2rem;
            background-color: #f8fafc;
            border-radius: 0 4px 4px 0;
        }
        /* Verdict pill tags */
        .verdict-tag {
            display: inline-block;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .verdict-supported {
            background-color: #dcfce7;
            color: #15803d;
            border: 1px solid #bbf7d0;
        }
        .verdict-weak {
            background-color: #fef3c7;
            color: #b45309;
            border: 1px solid #fde68a;
        }
        .verdict-flagged {
            background-color: #fee2e2;
            color: #b91c1c;
            border: 1px solid #fecaca;
        }
        /* Summary Sentence Card */
        .sentence-card {
            padding: 0.6rem 0.8rem;
            margin-bottom: 0.4rem;
            border-radius: 4px;
            border-left: 4px solid #cbd5e1;
            background-color: #ffffff;
            transition: all 0.15s ease-in-out;
        }
        .sentence-card-supported {
            border-left-color: #16a34a;
            background-color: #f0fdf4;
        }
        .sentence-card-weak {
            border-left-color: #d97706;
            background-color: #fffbeb;
        }
        .sentence-card-flagged {
            border-left-color: #dc2626;
            background-color: #fef2f2;
        }
        /* Hide deploy button and streamline header */
        .stDeployButton { display: none; }
        footer { visibility: hidden; }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_page_header(title: str, purpose: str):
    apply_theme()
    st.title(title)
    st.markdown(f'<div class="page-purpose">{purpose}</div>', unsafe_allow_html=True)


def get_current_run() -> Optional[RunResult]:
    if "current_run" in st.session_state and st.session_state["current_run"] is not None:
        return st.session_state["current_run"]
    # Fallback: try loading the most recent run from store
    store = RunStore()
    runs = store.list_runs()
    if runs:
        recent = store.load_run(runs[0]["run_id"])
        st.session_state["current_run"] = recent
        return recent
    return None


def set_current_run(run: RunResult):
    st.session_state["current_run"] = run


def read_uploaded_file(uploaded_file) -> str:
    """Reads uploaded txt or pdf file."""
    if uploaded_file is None:
        return ""
    fname = uploaded_file.name.lower()
    if fname.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(uploaded_file.read()))
        texts = [p.extract_text() or "" for p in reader.pages]
        return "\n".join(texts).strip()
    else:
        return uploaded_file.read().decode("utf-8", errors="replace").strip()


def render_export_buttons(run: RunResult, key_suffix: str = ""):
    """Renders export buttons for JSON, Markdown, and CSV."""
    if not run:
        return
    store = RunStore()
    c1, c2, c3 = st.columns(3)
    with c1:
        st.download_button(
            label="Export Markdown",
            data=store.export_markdown(run),
            file_name=f"equisumm_run_{run.run_id}.md",
            mime="text/markdown",
            key=f"exp_md_{key_suffix}",
            use_container_width=True,
        )
    with c2:
        import json
        st.download_button(
            label="Export JSON",
            data=json.dumps(run.to_dict(), indent=2),
            file_name=f"equisumm_run_{run.run_id}.json",
            mime="application/json",
            key=f"exp_json_{key_suffix}",
            use_container_width=True,
        )
    with c3:
        st.download_button(
            label="Export CSV",
            data=store.export_csv(run),
            file_name=f"equisumm_run_{run.run_id}.csv",
            mime="text/csv",
            key=f"exp_csv_{key_suffix}",
            use_container_width=True,
        )

