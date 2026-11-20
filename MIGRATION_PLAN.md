# EquiSumm Streamlit → React + FastAPI migration plan

## Audited feature inventory

The original Streamlit application remains in `app/` and is not changed by this migration.

| Streamlit surface | Existing implementation to preserve | Replacement surface |
| --- | --- | --- |
| Home / Verify | Text and `.txt`/`.pdf` input; four samples; BART-base + LoRA generation; attention extraction; MNLI, fact checks, reranking, exports | Summarize & Verify and Verification Results |
| Fact Check | Sentence-level numeric/entity audit, filters, issue list | Verification Results fact audit |
| Attention Explorer | Sentence attribution, support matrix, coverage, token entropy | Attention page |
| Compare Candidates | Hard-constraint and composite-score candidate comparison | Comparison page |
| Evaluate | Built-in/custom JSONL benchmark, ROUGE/factuality divergence, exports | Evaluation page |
| Embeddings | TF-IDF/character n-gram t-SNE projection, support categories | Attention page embedding projection |
| Runs & Settings | Persistent run history, reopen/delete/export, hardware data, cache flush, fact self-test, config edits | History & Settings page |

The preserved ML path is `EquiSummPipeline.run`: sentence-boundary indexing → BART-base/LoRA beam generation → teacher-forced cross-attention → attention-selected RoBERTa-large-MNLI → numeric/entity validation → current reranker/fallback behavior. `Evaluator` remains the source of all evaluation calculations.

## Proposed architecture

- `backend/`: FastAPI application organized into API routes, Pydantic schemas, services, and an in-process job manager.
- `backend/services/ml.py`: one process-wide `EquiSummPipeline` instance, serialized background execution to avoid duplicate model loads and unsafe concurrent GPU access.
- Existing `app/services/*` and root ML modules remain authoritative. The API calls them directly.
- Jobs are in memory while runs retain their existing JSON persistence through `RunStore`; the UI polls status endpoints.
- `frontend/`: Vite React (JavaScript), React Router, Tailwind CSS, Lucide icons, and a single centralized REST client. Current run selection is held in React context and refreshed from persisted history on reload.

## API surface

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | API/model-job status |
| `POST /api/jobs` | Queue summarization/verification from JSON text |
| `POST /api/jobs/upload` | Extract `.txt`/`.pdf`, then queue verification |
| `GET /api/jobs/{job_id}` | Poll a queued/running/completed/failed job |
| `GET /api/runs`, `GET /api/runs/{id}`, `DELETE /api/runs/{id}` | Saved run history and details |
| `GET /api/runs/{id}/exports/{format}` | JSON, Markdown, CSV export |
| `GET /api/runs/{id}/fact-audit` | Same fact-audit table derivation used by Streamlit |
| `GET /api/runs/{id}/embeddings` | Actual t-SNE coordinates computed using existing projection rules |
| `POST /api/evaluations`, `POST /api/evaluations/upload` | Queue built-in/custom JSONL evaluations |
| `GET /api/system`, `GET/PUT /api/settings`, `POST /api/system/flush-cache`, `POST /api/system/self-test` | Existing settings and maintenance features |

## Migration risks and controls

- **Large model latency/VRAM:** background jobs, polling, a singleton pipeline, and serialized ML execution prevent duplicate model load and request blocking.
- **Behavior drift:** endpoints invoke existing pipeline/evaluator functions without changing model metadata, generation, attention, verification, or reranking logic. Contract tests cover API output and existing unit tests remain run.
- **State differences:** Streamlit session state becomes explicit run IDs in the browser; persisted `RunStore` remains the canonical history.
- **Upload safety:** only `.txt`, `.pdf`, `.jsonl` allowed, with size/type validation and in-memory PDF parsing.
- **t-SNE presentation:** the same TF-IDF/character fallback and deterministic t-SNE parameters are retained; the browser renders returned coordinates without adding a charting dependency.
- **Existing worktree state:** `config.yaml` and `cache/` were already modified/untracked and will not be overwritten or committed.
