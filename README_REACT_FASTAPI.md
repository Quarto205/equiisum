# EquiSumm React + FastAPI

The original Streamlit implementation remains in `app/`. The replacement consists of `backend/` and `frontend/`; both call the existing ML, verification, evaluation, and storage code.

## Run locally

Activate the project virtual environment, then start the API from the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
```

In another terminal, install the web dependencies and run Vite:

```powershell
Set-Location frontend
npm install
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). The development CORS allow-list accepts the Vite localhost origins. For another frontend origin, set `EQUISUMM_CORS_ORIGINS` to a comma-separated list before starting the API.

## Verification behavior

- Verification and evaluation are queued as serial background jobs. Polling is performed once per second by the client.
- The API keeps a process-wide `EquiSummPipeline`; model checkpoints are loaded on first use and are not duplicated per request.
- Run records, exports, evaluation calculations, model generation, cross-attention, NLI, fact checks, reranking, and fallback decisions use the pre-existing implementation unchanged.
- Settings save to `config.yaml` exactly as the Streamlit settings page did. Restart the API after saving for model configuration changes to take effect.

## API documentation

With the server running, interactive OpenAPI documentation is at `http://localhost:8000/docs`.
