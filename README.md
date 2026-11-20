# EquiSumm: Verified Document Summarization MVP

EquiSumm is an AI-assisted document summarization and verification platform designed for complex legal, financial, and legislative texts. It summarizes documents using a fine-tuned BART-base + LoRA adapter, verifies each generated sentence against the source using attention-guided Natural Language Inference (NLI) and strict numeric/entity extraction, and transparently explains why each sentence is trusted or flagged.

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
   - **ACCEPT_PRUNED**: Automatically removes flagged sentences if $\ge 1$ supported sentence remains.
   - **EXTRACTIVE_FALLBACK**: Extracts top-k salient source sentences using cross-attention coverage.
   - **ESCALATE**: Escalates to human expert review if the document cannot be safely summarized.
4. **Transparent "Why Not #1?" Explanations**:
   - Compares all beam candidates and explicitly explains why beam candidate #0 was accepted or rejected.
5. **ROUGE vs Factuality Evaluation**:
   - Benchmarks lexical overlap metrics against factual integrity, identifying cases where ROUGE is high despite factual errors.

---

## Directory Architecture

```
equiisum/
├── backend/                  # FastAPI REST API & async job queue
│   ├── main.py               # API endpoints (/api/health, /api/jobs, /api/runs, etc.)
│   ├── schemas.py            # Pydantic data schemas
│   └── services/             # Pipeline adapters & serialized JobManager
├── frontend/                 # React 18 SPA (Vite + Tailwind CSS + Lucide Icons)
│   ├── src/
│   │   ├── App.jsx           # Main React application view container
│   │   ├── api.js            # REST API client
│   │   └── index.css         # Styling
│   ├── index.html            # Vite HTML template
│   └── package.json          # Frontend dependencies
├── equisumm_mvp/             # Core Machine Learning & Verification Modules
│   ├── contracts.py          # Dataclasses (Candidate, Attention, NLIResult, FactReport)
│   ├── tokenization.py       # Sentence boundary splitting & truncation indexing
│   ├── hf_seq2seq.py         # HFSeq2SeqSummarizer (BART-base + LoRA)
│   ├── extractor.py          # CrossAttentionExtractor
│   ├── nli_model.py          # NLIVerifier (RoBERTa-large-MNLI)
│   ├── fact_verifier.py      # Strict numeric, scale, currency, direction, entity checks
│   └── smoke_test.py         # Offline assertion tests and pipeline verification
├── equisumm_bart_lora/       # Pre-trained BART-base LoRA adapter checkpoint & tokenizer
├── app/                      # Shared Services & Legacy Streamlit Interface
│   ├── config.py             # System configuration & path guard bootstrap
│   ├── ui_utils.py           # Visualization & export helpers
│   ├── Home.py               # Streamlit entry point
│   ├── services/             # Pipeline, Evaluator, Reranker, Store, Viz services
│   └── pages/                # Streamlit secondary pages
├── samples/                  # Pre-packaged financial, legal, and legislative test documents
├── tests/                    # Pytest unit test suite (15 tests)
├── config.yaml               # System parameters & reranker weights
├── requirements.txt          # Python dependencies
├── README.md                 # Project guide (this document)
└── ARCHITECTURE.md           # Full system architecture specification
```

---

## Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- NVIDIA GPU with 6GB+ VRAM (or CPU mode)

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

### 3. Drive & Path Guard Configuration

The application protects your system drive by ensuring model caches and outputs do not fill partition `C:`.

- **If your system has a secondary drive (e.g., `D:`):**
  Ensure directories in `config.yaml` point to `D:/...`.

- **If your machine only has drive `C:`:**
  You can either create a virtual mapped drive in PowerShell:
  ```powershell
  New-Item -ItemType Directory -Path "C:\equisumm_virtual_d" -Force
  subst D: "C:\equisumm_virtual_d"
  ```
  Or set `EQUISUMM_ALLOW_C_DRIVE=true` in your `.env` file or environment:
  ```powershell
  $env:EQUISUMM_ALLOW_C_DRIVE="true"
  ```

---

## Running the Application

### Modern React + FastAPI Stack (Primary)

The application runs as a decoupled React client and FastAPI backend:

#### 1. Start the FastAPI Backend
From the repository root:
```powershell
python -m uvicorn backend.main:app --reload --port 8000
```
- API Base URL: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`

#### 2. Start the React Frontend
In a separate terminal:
```powershell
cd frontend
npm run dev
```
- Open your browser at **`http://localhost:5173`**

---

### Alternative: Legacy Streamlit Interface

If you wish to view the legacy Streamlit prototype:
```powershell
streamlit run app/Home.py --server.port 8501
```
- Accessible at `http://localhost:8501`

---

## Running Tests

### 1. Offline Fact Verification Self-Test
Runs deterministic assertion checks on scale mismatches, direction conflicts, currency errors, and unsupported entities without loading heavy models:
```bash
python equisumm_mvp/smoke_test.py
```
*Expected output: `offline fact checks: OK`*

### 2. Full Pytest Backend Suite (21 Unit & Integration Tests)
```bash
pytest
```
Covers:
- `tests/test_api.py`: FastAPI health, sample catalog, validation errors, asynchronous job lifecycle, SSE event streaming, report export, and settings.
- `tests/test_fact_verifier.py`: Scale mismatches, direction conflicts, currency errors, unsupported entities.
- `tests/test_reranker.py`: Feasible-first selection, prune fallback, extractive fallback, escalate fallback, and "Why not #1?" generation.
- `tests/test_tokenization.py`: Sentence boundary splitting and source index truncation.
- `tests/test_store.py`: Persistence and Markdown/CSV/JSON export.
- `tests/test_evaluate.py`: ROUGE and factuality metric benchmark computation.

### 3. Frontend Vitest Suite (9 Component Tests)
```bash
cd frontend
npm test
```
Covers:
- `frontend/src/__tests__/VerdictBadge.test.jsx`: Multi-state status badges (`ACCEPT`, `ACCEPT_PRUNED`, `EXTRACTIVE_FALLBACK`, `ESCALATE`, etc.).
- `frontend/src/__tests__/AttentionViz.test.jsx`: Attention heatmaps, source coverage distribution, and 2D t-SNE sentence embedding scatter plot.

