"""Visualization Service for EquiSumm.

Provides Plotly figures for:
1. Attention Heatmap (summary sentences x source sentences cross-attention support).
2. Source Coverage Bar Chart (highlighting which parts of the source were attended vs ignored).
3. Token Entropy Line Chart (sharpness vs dispersion of attention over generation).
4. Sentence Embeddings t-SNE 2D scatter plot (colored by supported/flagged/source).
"""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np
import plotly.graph_objects as go
from sklearn.manifold import TSNE

# Ensure project root and equisumm_mvp are on sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))
_EQUISUMM_DIR = _PROJECT_ROOT / "equisumm_mvp"
if str(_EQUISUMM_DIR) not in sys.path:
    sys.path.insert(0, str(_EQUISUMM_DIR))

try:
    from equisumm_mvp.contracts import CandidateAttention
except ImportError:
    from contracts import CandidateAttention


def create_attention_heatmap(
    att: CandidateAttention,
    source_sentences: list[str],
    max_label_chars: int = 50,
) -> go.Figure:
    """Creates a heatmap of summary sentences (rows) x source sentences (columns)."""
    support_matrix = np.array(att.support)  # [n_sum, n_src]
    n_sum, n_src = support_matrix.shape

    # Truncate sentence labels for display readability
    y_labels = [
        f"Sum #{i+1}: {(s[:max_label_chars] + '...') if len(s) > max_label_chars else s}"
        for i, s in enumerate(att.summary_sentences)
    ]
    x_labels = [
        f"Src #{j+1}: {(s[:max_label_chars] + '...') if len(s) > max_label_chars else s}"
        for j, s in enumerate(source_sentences[:n_src])
    ]

    fig = go.Figure(
        data=go.Heatmap(
            z=support_matrix,
            x=x_labels,
            y=y_labels,
            colorscale="Viridis",
            colorbar=dict(title="Attention Weight"),
            hoverongaps=False,
            hovertemplate="<b>%{y}</b><br>Attends to: <b>%{x}</b><br>Support: %{z:.3f}<extra></extra>",
        )
    )

    fig.update_layout(
        title="Cross-Attention Alignment Heatmap (Summary vs Source)",
        xaxis=dict(title="Source Sentences", tickangle=-45),
        yaxis=dict(title="Summary Sentences", autorange="reversed"),
        margin=dict(l=150, r=40, t=60, b=120),
        height=max(360, 80 + n_sum * 50),
        template="plotly_white",
    )
    return fig


def create_coverage_barchart(
    att: CandidateAttention,
    source_sentences: list[str],
    max_label_chars: int = 60,
) -> go.Figure:
    """Creates a horizontal bar chart showing source sentence coverage."""
    cov = att.source_coverage
    n_src = min(len(cov), len(source_sentences))
    cov_vals = cov[:n_src]

    # Threshold for what is considered ignored (e.g., < 0.05 / n_src)
    mean_val = 1.0 / max(1, n_src)
    colors = ["#22c55e" if val >= mean_val else "#f59e0b" if val >= mean_val * 0.4 else "#ef4444" for val in cov_vals]

    labels = [
        f"Src #{j+1}: {(s[:max_label_chars] + '...') if len(s) > max_label_chars else s}"
        for j, s in enumerate(source_sentences[:n_src])
    ]

    fig = go.Figure(
        data=go.Bar(
            x=cov_vals,
            y=labels,
            orientation="h",
            marker=dict(color=colors),
            hovertemplate="<b>%{y}</b><br>Coverage Share: %{x:.3%}<extra></extra>",
        )
    )

    fig.add_vline(x=mean_val, line_dash="dash", line_color="#64748b", annotation_text=f"Uniform Mean ({mean_val:.2%})")

    fig.update_layout(
        title="Source Document Coverage (Green=High, Amber=Moderate, Red=Ignored)",
        xaxis=dict(title="Attention Coverage Share", tickformat=".1%"),
        yaxis=dict(title="Source Sentences", autorange="reversed"),
        margin=dict(l=180, r=40, t=50, b=50),
        height=max(320, 60 + n_src * 28),
        template="plotly_white",
    )
    return fig


def create_token_entropy_chart(att: CandidateAttention) -> go.Figure:
    """Plots normalized cross-attention token entropy across generated content tokens."""
    entropy = att.token_entropy
    x = list(range(1, len(entropy) + 1))

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=x,
            y=entropy,
            mode="lines+markers",
            line=dict(color="#0284c7", width=2),
            marker=dict(size=4),
            name="Token Entropy",
            hovertemplate="Token #%{x}<br>Attention Entropy: %{y:.3f}<extra></extra>",
        )
    )

    # Reference baseline line at 0.5
    fig.add_hline(y=0.5, line_dash="dot", line_color="#94a3b8", annotation_text="Baseline")

    fig.update_layout(
        title="Cross-Attention Token Entropy (Lower = Focused, Higher = Dispersed)",
        xaxis=dict(title="Content Token Position"),
        yaxis=dict(title="Normalized Entropy (0..1)", range=[0, 1.05]),
        margin=dict(l=50, r=30, t=50, b=50),
        height=300,
        template="plotly_white",
    )
    return fig


def compute_tsne_embeddings(
    source_sentences: list[str],
    summary_sentences: list[str],
    flagged_summary_indices: list[int],
    embedder_fn=None,
    max_points: int = 300,
) -> go.Figure:
    """Computes 2D t-SNE scatter plot of source and summary sentences."""
    # Cap total points to max_points (hard constraint: cap to 300 points)
    all_sents = source_sentences[:max_points - len(summary_sentences)]
    src_len = len(all_sents)
    all_sents = all_sents + summary_sentences
    total = len(all_sents)

    if total < 4:
        # Not enough points for t-SNE
        fig = go.Figure()
        fig.add_annotation(text="Too few sentences for t-SNE projection (need >= 4).", showarrow=False)
        fig.update_layout(height=400, template="plotly_white")
        return fig

    # If embedder_fn provided, use it; otherwise use fast TF-IDF / character n-gram embedding
    if embedder_fn is not None:
        embeddings = embedder_fn(all_sents)
    else:
        from sklearn.feature_extraction.text import TfidfVectorizer
        vec = TfidfVectorizer(max_features=128, stop_words="english")
        try:
            embeddings = vec.fit_transform(all_sents).toarray()
        except ValueError:
            vec = TfidfVectorizer(max_features=64, analyzer="char", ngram_range=(2, 4))
            embeddings = vec.fit_transform(all_sents).toarray()

    # Perplexity must be less than n_samples
    perp = min(30, max(2, (total - 1) // 3))
    tsne = TSNE(n_components=2, perplexity=perp, random_state=42, init="pca", learning_rate="auto")
    coords_2d = tsne.fit_transform(embeddings)

    flagged_set = set(flagged_summary_indices)

    # Categories
    src_x, src_y, src_texts = [], [], []
    supp_x, supp_y, supp_texts = [], [], []
    flag_x, flag_y, flag_texts = [], [], []

    for i in range(src_len):
        src_x.append(coords_2d[i, 0])
        src_y.append(coords_2d[i, 1])
        src_texts.append(f"<b>[Source #{i+1}]</b> {all_sents[i][:90]}")

    for idx, s in enumerate(summary_sentences):
        pos = src_len + idx
        if idx in flagged_set:
            flag_x.append(coords_2d[pos, 0])
            flag_y.append(coords_2d[pos, 1])
            flag_texts.append(f"<b>[Summary #{idx+1} - Flagged]</b> {s[:90]}")
        else:
            supp_x.append(coords_2d[pos, 0])
            supp_y.append(coords_2d[pos, 1])
            supp_texts.append(f"<b>[Summary #{idx+1} - Supported]</b> {s[:90]}")

    fig = go.Figure()

    if src_x:
        fig.add_trace(
            go.Scatter(
                x=src_x, y=src_y,
                mode="markers",
                name="Source Sentences",
                marker=dict(color="#64748b", size=8, opacity=0.7),
                text=src_texts,
                hoverinfo="text",
            )
        )
    if supp_x:
        fig.add_trace(
            go.Scatter(
                x=supp_x, y=supp_y,
                mode="markers+text",
                name="Summary (Supported)",
                marker=dict(color="#22c55e", size=12, symbol="circle"),
                text=[f"S{i+1}" for i in range(len(supp_x))],
                textposition="top center",
                hovertext=supp_texts,
                hoverinfo="text",
            )
        )
    if flag_x:
        fig.add_trace(
            go.Scatter(
                x=flag_x, y=flag_y,
                mode="markers+text",
                name="Summary (Flagged)",
                marker=dict(color="#ef4444", size=14, symbol="x"),
                text=[f"F{i+1}" for i in range(len(flag_x))],
                textposition="top center",
                hovertext=flag_texts,
                hoverinfo="text",
            )
        )

    fig.update_layout(
        title=f"Sentence Embeddings 2D t-SNE Projection ({total} sentences)",
        xaxis=dict(showgrid=True, zeroline=False),
        yaxis=dict(showgrid=True, zeroline=False),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(l=40, r=40, t=70, b=40),
        height=520,
        template="plotly_white",
    )
    return fig

