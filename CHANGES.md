## Cyberpunk Developer UI Frontend (Recreation & Build)

1. **Dark Cyberpunk Developer-Tool Visual System**:
   - Rebuilt frontend with deep near-black background (`#050505`), neon lime/green accents (`#4ade80`, `#22c55e`), monospace typography, subtle grid/glitch background treatment, pixel-style icons, and terminal-inspired cards.
   - Built with Next.js 16 (App Router), Tailwind CSS v4, Lucide icons, and Radix UI primitives.
   - Verified at desktop 1216x637 and mobile viewport (375x812) in dark mode.

2. **Modular Component Architecture**:
   - `components/intro-animation.tsx`: Cyberpunk boot-up sequence with glowing letter reveal and smooth curtain transition.
   - `components/mobile-nav.tsx`: Translucent dark glass header with animated burger menu and neon status pills.
   - `components/agent-interface.tsx`: Interactive preview dashboard simulating PR reviews, live NLI traces, commit heatmaps, and CI status.
   - `components/pixel-icon.tsx`: 60fps RAF canvas-based retro pixel icons glowing in neon lime.
   - `components/stacking-agent-cards.tsx`: 3D perspective stacking agent cards on scroll (Researcher, Coder, Analyst, Executor).
   - `components/devex-section.tsx`: Developer Experience section with 4 interactive step tabs and dark syntax-highlighted code editor.
   - `components/live-agent-feed.tsx`: Telemetry activity feed with live simulated agent execution logs and global counter.

3. **Build & Test Verification**:
   - `next build` static export: clean compilation in 2.6s.
   - `npx tsc --noEmit`: 0 TypeScript errors.
   - `pytest`: all 15 tests passed.
   - `smoke_test.py`: offline fact tests passed.

---

## Recent Fixes & Import Resilience (IDE & Runtime)

1. **Dual Import Fallbacks (`try / except ImportError`)**:
   - Added robust dual-resolution imports (`from equisumm_mvp.<module> ... except ImportError: from <module> ...`) across `app/services/store.py`, `reranker.py`, `pipeline.py`, `viz.py`, `evaluate.py`, and test files.
   - Allows seamless module resolution regardless of whether modules are run from package root, tests, or Streamlit subprocesses.

2. **Workspace Path Resolution in VS Code / Antigravity IDE**:
   - Injected `PROJECT_ROOT` and `equisumm_mvp` directory paths into `sys.path` across all service modules and Streamlit pages.
   - Added `.vscode/settings.json` specifying `python.analysis.extraPaths` for IDE static analysis (Pylance/Pyright), removing unresolved import warnings.

3. **Cleaned Unused Imports & Deprecation Warnings**:
   - Removed unused `time` and `pandas` imports from `app/services/evaluate.py`.
   - Fixed NLI probability dictionary indexing in `app/services/evaluate.py` (`by = {id2label[i]: p[i]}`).
   - Removed deprecated `TRANSFORMERS_CACHE` environment variable in favor of `HF_HOME`.
   - Cleaned unused test imports (`pytest`, `FactIssue`, `RerankResult`).

## Existing File Adjustments (Minimal Fixes, Public Signatures Preserved)

1. **`equisumm_mvp/hf_seq2seq.py` & `hf_seq2seq.py`**:
   - Added `HF_HOME` and non-`C:` drive path guard verification at the module header before importing `transformers`.
   - Ensures Hugging Face model weights (`facebook/bart-base`) strictly download into `D:/equisumm_cache/hf` and never default to the `C:` drive.
   - Preserved all public class and method signatures (`HFSeq2SeqSummarizer`, `.prepare()`, `.generate()`).

2. **`equisumm_mvp/nli_model.py` & `nli_model.py`**:
   - Added `HF_HOME` path guard check before importing `transformers`.
   - Guarantees NLI model checkpoints (`roberta-large-mnli`) download into `D:/equisumm_cache/hf`.
   - Preserved all public class and method signatures (`NLIVerifier`, `.select_premise()`, `.verify()`).

---

## New Modules and Architecture Created

1. **`app/config.py`**:
   - Central configuration and path guard module.
   - Loads from `config.yaml` and `.env` with strict `assert_not_c_drive()` validation.
   - Immediately routes `HF_HOME`, `HF_HUB_CACHE`, `TRANSFORMERS_CACHE`, and `TORCH_HOME` to `D:/equisumm_cache`.

2. **`app/services/pipeline.py`**:
   - Orchestrates the full 6-stage verification pipeline: Tokenize/Index -> Summarize (BART+LoRA) -> Cross-Attention Extraction -> NLI Premise Verification -> Fact Verification -> Constraint Reranking.
   - Implements singleton model caching so weights are loaded once per session and never reloaded per click.
   - Enforces `torch.cuda.empty_cache()` between stages to observe 6GB VRAM memory constraints.

3. **`app/services/reranker.py`**:
   - Implements hard-constraints-first evaluation (zero fact issues and sentence entailment >= threshold).
   - Computes length-normalized composite soft score: sequence logprob, NLI entailment mean, entity precision, numeric precision, and normalized coverage focus entropy.
   - Cascades through robust fallbacks:
     - `ACCEPT`: Best feasible candidate.
     - `ACCEPT_PRUNED`: Prunes flagged sentences if >= 1 clean sentence remains.
     - `EXTRACTIVE_FALLBACK`: Selects salient source sentences based on cross-attention coverage.
     - `ESCALATE`: Escalate to human expert review.
   - Generates explicit "why not #1?" explanations.

4. **`app/services/store.py`**:
   - Serializes and deserializes runs under `D:/equisumm_cache/runs/`.
   - Exports runs to Markdown, JSON, and CSV.

5. **`app/services/viz.py`**:
   - Plotly cross-attention heatmap (summary sentences x source sentences).
   - Source coverage distribution horizontal bar chart with uniform reference line.
   - Normalized cross-attention token entropy line chart.
   - 2D t-SNE sentence embedding projection capped at 300 points with session caching.

6. **`app/services/evaluate.py`**:
   - Computes ROUGE-1/2/L alongside NLI entailment, numeric precision, and entity precision.
   - Identifies high-ROUGE / low-factuality metric divergence cases.
   - Resumable benchmark execution saving partial checkpoints to `D:/equisumm_cache/eval/`.

7. **Multipage Streamlit UI (`app/Home.py` & `app/pages/`)**:
   - `Home.py` (Verify): Interactive side-by-side verification and premise highlighting.
   - `1_Fact_Check.py`: Side-by-side comparison table of all numbers and entities with issue filtering.
   - `2_Attention_Explorer.py`: Alignment heatmap, coverage bar chart, and sentence origin attribution inspector.
   - `3_Compare_Candidates.py`: Beam search candidate quality table and "Why not #1?" breakdown.
   - `4_Evaluate.py`: Benchmark dataset evaluator and high-ROUGE factuality divergence explorer.
   - `5_Embeddings.py`: 2D t-SNE scatter plot of source and summary sentences.
   - `6_Runs_and_Settings.py`: Saved run manager, GPU VRAM gauge, threshold settings, and offline self-test.

8. **`samples/` Directory**:
   - `01_earnings_report.txt` (Financial quarterly release with scales and directions)
   - `02_contract_services_agreement.txt` (Legal services agreement)
   - `03_legislative_bill_billsum.txt` (Long legislative bill testing sentence truncation)
   - `04_fiduciary_investment_memo.txt` (Investment memo for audit review)
   - `05_researcher_benchmark_sample.jsonl` (Benchmark dataset for evaluation)
   - `06_reviewer_explanation.txt` (Clinical trial report for reviewer attribution)

9. **`tests/` Suite**:
   - `tests/test_fact_verifier.py`: 6 tests for scale, direction, entity, and clean facts.
   - `tests/test_reranker.py`: 4 tests for feasible-first, prune, extractive, and escalate fallbacks.
   - `tests/test_tokenization.py`: 3 tests for sentence splitting and boundary truncation.
   - `tests/test_store.py`: Test for saving, loading, and exporting runs.
   - `tests/test_evaluate.py`: Test for benchmark evaluation and metric computation.

