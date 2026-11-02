# EquiSumm: Verified Document Summarization MVP

EquiSumm is an AI-assisted document summarization and verification tool designed for complex legal, financial, and legislative texts. It summarizes documents using a fine-tuned BART-base + LoRA adapter, verifies each generated sentence against the source using attention-guided Natural Language Inference (NLI) and strict numeric/entity extraction, and transparently explains why each sentence is trusted or flagged.

> **Architecture Documentation:** For detailed design specifications, data contracts, and memory management diagrams, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Key Features

1. **Sentence-by-Sentence Evidence Alignment**:
   - Uses teacher-forced cross-attention weights to map each summary sentence to its primary source premises.
   - Evaluates premise-to-hypothesis entailment via `roberta-large-mnli`.
2. **Strict Numeric & Entity Verification**:
   - Detects numeric scale mismatches (`$1.2 million` vs `$1.2 billion`), direction conflicts (`fell 8%` vs `rose 8%`), currency changes, percent misalignments, and unsupported entities.
3. **Hard-Constraint Reranker & Fallback Cascade**:
   - **ACCEPT**: Feasible candidate with zero fact errors and all sentences above the entailment threshold.
   - **ACCEPT_PRUNED**: Automatically removes flagged sentences if >= 1 supported sentence remains.
   - **EXTRACTIVE_FALLBACK**: Extracts top-k salient source sentences using cross-attention coverage.
   - **ESCALATE**: Escalates to human expert review if the document cannot be safely summarized.
4. **Transparent "Why Not #1?" Explanations**:
   - Compares all beam candidates and explicitly explains why beam candidate #0 was accepted or rejected.
5. **ROUGE vs Factuality Evaluation**:
   - Benchmarks lexical overlap metrics against factual integrity, identifying cases where ROUGE is high despite factual errors.

---

## Directory Architecture

```
equisumm_mvp/             # Core working modules
  contracts.py            # Dataclasses (Candidate, Attention, NLIResult, FactReport)
  tokenization.py         # Sentence splitting & boundary truncation index
  hf_seq2seq.py           # HFSeq2SeqSummarizer (BART-base + LoRA)
  extractor.py            # CrossAttentionExtractor
  nli_model.py            # NLIVerifier (RoBERTa-large-MNLI)
  fact_verifier.py        # Strict numeric, scale, currency, direction, entity checks
  smoke_test.py           # Offline assertion tests and full pipeline check
app/
  config.py               # Path guard (non-C: drive) and environment bootstrap
  ui_utils.py             # Streamlit theme, verdict styles, file readers, export tools
  Home.py                 # Multi-page Streamlit Home (Verify page)
  services/
    pipeline.py           # 6-stage end-to-end pipeline with session model caching
    reranker.py           # Hard constraints, composite soft scoring, and fallbacks
    evaluate.py           # ROUGE-1/2/L vs NLI & factual precision benchmark
    viz.py                # Plotly attention heatmap, coverage bar chart, t-SNE projection
    store.py              # Run persistence & export (JSON, Markdown, CSV) under CACHE_ROOT/runs
  pages/
    1_Fact_Check.py       # Side-by-side numeric/entity audit table with status filtering
    2_Attention_Explorer.py # Attention matrix, coverage distribution & attribution explorer
    3_Compare_Candidates.py # Beam candidates comparison table & "Why not #1?" explanation
    4_Evaluate.py         # Benchmark runner and high-ROUGE factuality divergence report
    5_Embeddings.py       # 2D t-SNE sentence embedding scatter plot
    6_Runs_and_Settings.py # Saved runs history, GPU memory monitor, settings, and self-test
samples/                  # 6 sample inputs for legal, financial, and benchmark use cases
tests/                    # Pytest test suite (15 unit tests)
config.yaml               # System settings and reranker weights
.env.example              # Environment variables template
requirements.txt          # Python dependencies
CHANGES.md                # Minimal modifications log
```

---

## Installation & Setup

### Prerequisites
- Python 3.10+
- Non-`C:` drive for all caches and checkpoints (e.g. `D:/equisumm_cache`)
- NVIDIA GPU with 6GB VRAM (or CPU mode)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment
Copy `.env.example` to `.env` or edit `config.yaml`:
```bash
cp .env.example .env
```
Default configuration:
```env
EQUISUMM_CACHE_ROOT=D:/equisumm_cache
EQUISUMM_DEVICE=cuda
EQUISUMM_FP16=true
EQUISUMM_ADAPTER_DIR=D:/equisumm_cache/checkpoints/equisumm_bart_lora
EQUISUMM_NLI_MODEL=roberta-large-mnli
```

> **Path Guard Notice:** The application enforces a strict path guard. If `EQUISUMM_CACHE_ROOT` or any checkpoint/run path resolves to `C:`, it will fail immediately to protect your primary system drive.

---

## Running the Application

Launch the Streamlit app:
```bash
streamlit run app/Home.py
```
Or from the root directory:
```bash
streamlit run Home.py
```

### Navigating the Pages
1. **Verify (Home)**:
   - Click one of the 4 sample buttons (Earnings Report, Services Agreement, Legislative Bill, Investment Memo) or paste custom text / upload a `.txt` or `.pdf`.
   - Click **Summarize & Verify** to run the pipeline.
   - Click individual sentences to highlight their source premise and view NLI probabilities.
2. **Fact Check**:
   - Review every number, scale, currency, percentage, and named entity. Filter by status (`Scale Mismatch`, `Direction Conflict`, `Verified`, etc.).
3. **Attention Explorer**:
   - Inspect the cross-attention matrix heatmap, view which parts of the document were ignored in the coverage bar, and check token entropy.
4. **Compare Candidates**:
   - View all beam search candidates side-by-side with logprobs, entailment means, and the composite soft score. Read the "Why not #1?" explanation.
5. **Evaluate**:
   - Run benchmark evaluation on the built-in dataset or upload custom `.jsonl` data. Inspect the high-ROUGE vs factuality divergence cases.
6. **Embeddings**:
   - View the 2D t-SNE projection of source and summary sentences color-coded by factual support status.
7. **Runs & Settings**:
   - Browse saved run history, reopen or delete previous runs, check GPU VRAM allocation, and trigger the offline self-test.

---

## Running Tests

### 1. Offline Fact Checks
```bash
python equisumm_mvp/smoke_test.py
```
Expected output:
```
offline fact checks: OK
```

### 2. Full Pytest Suite (15 Unit Tests)
```bash
pytest
```
Covers:
- `tests/test_fact_verifier.py`: Scale mismatches, direction conflicts, currency errors, unsupported entities.
- `tests/test_reranker.py`: Feasible-first selection, prune fallback, extractive fallback, escalate fallback, and "why not #1?" generation.
- `tests/test_tokenization.py`: Sentence boundary splitting and source index truncation.
- `tests/test_store.py`: Persistence and Markdown/CSV/JSON export.
- `tests/test_evaluate.py`: ROUGE and factuality metric benchmark computation.

