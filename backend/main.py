from __future__ import annotations

import asyncio
import csv
import io
import json
import os
from pathlib import Path
from typing import Any, Optional

import torch
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.config import PROJECT_ROOT, get_config
from app.services.pipeline import get_pipeline
from app.services.store import RunStore
from backend.services.adapters import (
    fact_audit,
    parse_upload,
    projection,
    run_evaluation,
    run_pipeline,
    save_settings,
    self_test,
    settings,
    system_info,
    to_report_contract,
)
from backend.services.jobs import jobs


app = FastAPI(title="EquiSumm API", version="2.0.0")

# Local-only CORS
origins = [
    item.strip()
    for item in os.getenv(
        "EQUISUMM_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if item.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalysisSubmission(BaseModel):
    text: Optional[str] = None
    domain: str = "general"
    n_candidates: int = Field(default=4, ge=1, le=8)
    device: Optional[str] = None


class SettingsUpdate(BaseModel):
    cache_root: str
    n_candidates: int = Field(ge=1, le=8)
    entailment_threshold: float = Field(ge=0.0, le=1.0)
    top_k_premise: int = Field(ge=1, le=10)
    device: str
    fp16: bool
    reranker_weights: Optional[dict[str, float]] = None


class EvaluationSubmission(BaseModel):
    max_samples: int = Field(default=5, ge=1, le=100)
    run_name: str = "interactive_eval"


def get_run_or_404(run_id: str):
    run = RunStore().load_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Report '{run_id}' was not found.")
    return run


def get_job_or_404(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' was not found.")
    return job


# --------------------------------------------------------------------------
# 1. Health & Telemetry
# --------------------------------------------------------------------------

@app.get("/api/health")
def health():
    """Server status, active device (cuda/cpu), models loaded status."""
    pipe = get_pipeline()
    models_loaded = pipe.summarizer is not None or pipe.nli is not None
    cfg = get_config()
    cuda = torch.cuda.is_available()
    device = "cuda" if (cuda and cfg.device != "cpu") else "cpu"
    return {
        "status": "online",
        "device": device,
        "models_loaded": models_loaded,
        "jobs": jobs.counts(),
    }


# --------------------------------------------------------------------------
# 2. Bundled Document Samples
# --------------------------------------------------------------------------

_SAMPLES = {
    "earnings": ("01_earnings_report.txt", "financial", "Earnings Release (Financial)", "Acme Corp Q3: Revenue, operating profit, net income ($1.2B vs $1.2M scale test)."),
    "agreement": ("02_contract_services_agreement.txt", "legal", "Services Agreement (Legal)", "Master Services Agreement: 60-day notice, $5M liability cap, Delaware law."),
    "bill": ("03_legislative_bill_billsum.txt", "general", "Legislative Bill (General)", "Clean Energy Investment Act: Renewable infrastructure grants and mandates."),
    "memo": ("04_fiduciary_investment_memo.txt", "financial", "Investment Memo (Financial)", "Fiduciary Investment Memo: Portfolio asset allocation, risk parameters, hurdle rates."),
    "benchmark": ("05_researcher_benchmark_sample.jsonl", "benchmark", "Benchmark Dataset Sample", "Multi-document JSONL evaluation benchmark for lexical vs factual divergence testing."),
    "review": ("06_reviewer_explanation.txt", "general", "Reviewer Explanation Case", "Expert review case study demonstrating why beam candidate #0 was rejected."),
}


@app.get("/api/samples")
def list_samples():
    return [
        {"id": key, "domain": domain, "name": name, "description": desc}
        for key, (_, domain, name, desc) in _SAMPLES.items()
    ]


@app.get("/api/samples/{sample_id}")
def get_sample(sample_id: str):
    entry = _SAMPLES.get(sample_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Sample '{sample_id}' was not found.")
    filename, domain, name, desc = entry
    path = PROJECT_ROOT / "samples" / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Sample file '{filename}' was not found.")
    return {
        "id": sample_id,
        "name": name,
        "domain": domain,
        "description": desc,
        "filename": filename,
        "text": path.read_text(encoding="utf-8"),
    }


# --------------------------------------------------------------------------
# 3. Create & Queue Analysis Jobs
# --------------------------------------------------------------------------

@app.post("/api/analyses", status_code=202)
async def create_analysis(
    request: Request,
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    domain: str = Form("general"),
    n_candidates: int = Form(4),
):
    # Support either JSON body or multipart form data
    raw_text = text
    if not file and not raw_text:
        try:
            body = await request.json()
            raw_text = body.get("text")
            domain = body.get("domain", domain)
            n_candidates = int(body.get("n_candidates", n_candidates))
        except Exception:
            pass

    content_text = ""
    filename = None
    if file:
        filename = file.filename or "uploaded_document.txt"
        file_bytes = await file.read()
        try:
            content_text = parse_upload(filename, file_bytes, {".txt", ".pdf"})
        except ValueError as exc:
            err_msg = str(exc)
            code = "UNSUPPORTED_FILE" if "UNSUPPORTED_FILE" in err_msg else ("FILE_TOO_LARGE" if "FILE_TOO_LARGE" in err_msg else "EMPTY_TEXT")
            raise HTTPException(status_code=422, detail={"code": code, "message": err_msg}) from exc
    elif raw_text:
        content_text = raw_text.strip()
        filename = None
    else:
        raise HTTPException(status_code=422, detail={"code": "EMPTY_TEXT", "message": "Please provide document text or upload a .txt/.pdf file."})

    if not content_text.strip():
        raise HTTPException(status_code=422, detail={"code": "EMPTY_TEXT", "message": "No extractable text was provided."})

    if len(content_text) > 100_000:
        raise HTTPException(status_code=422, detail={"code": "FILE_TOO_LARGE", "message": "Document exceeds maximum supported character limit (100,000 characters)."})

    job = jobs.submit("analysis", lambda progress: run_pipeline(content_text, domain, n_candidates, progress))
    return {"id": job.job_id, "status": "queued"}


# Alias for backwards compatibility
@app.post("/api/jobs", status_code=202)
async def create_job_alias(request: Request):
    try:
        body = await request.json()
        job = jobs.submit("analysis", lambda progress: run_pipeline(body.get("text", ""), body.get("domain", "general"), body.get("n_candidates", 4), progress))
        return job.public()
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/jobs/upload", status_code=202)
async def create_job_upload_alias(file: UploadFile = File(...), domain: str = Form("general"), n_candidates: int = Form(4)):
    return await create_analysis(Request, file=file, domain=domain, n_candidates=n_candidates)


# --------------------------------------------------------------------------
# 4. Job Status & Progress Tracking
# --------------------------------------------------------------------------

@app.get("/api/analyses/{analysis_id}")
def get_analysis_status(analysis_id: str):
    job = get_job_or_404(analysis_id)
    public_data = job.public()
    report_id = None
    if job.result and isinstance(job.result, dict):
        report_id = job.result.get("run_id")

    return {
        "id": job.job_id,
        "status": job.status,
        "stage": job.stage,
        "stage_name": job.stage_name,
        "progress": public_data.get("progress_pct", 0.0),
        "message": job.message,
        "elapsed_seconds": job.elapsed_seconds,
        "error": job.error,
        "error_code": job.error_code,
        "report_id": report_id,
    }


@app.get("/api/jobs/{job_id}")
def get_job_alias(job_id: str):
    return get_job_or_404(job_id).public()


@app.post("/api/analyses/{analysis_id}/cancel")
def cancel_analysis(analysis_id: str):
    success = jobs.cancel(analysis_id)
    if not success:
        raise HTTPException(status_code=400, detail="Job cannot be cancelled or was not found.")
    return {"id": analysis_id, "status": "cancelled"}


@app.get("/api/analyses/{analysis_id}/events")
async def analysis_events(analysis_id: str):
    """Server-Sent Events endpoint streaming live stage progress updates."""
    job = jobs.get(analysis_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job was not found.")

    async def event_generator():
        while True:
            current_job = jobs.get(analysis_id)
            if not current_job:
                break
            report_id = None
            if current_job.result and isinstance(current_job.result, dict):
                report_id = current_job.result.get("run_id")

            payload = {
                "id": current_job.job_id,
                "status": current_job.status,
                "stage": current_job.stage,
                "stage_name": current_job.stage_name,
                "progress": current_job.public().get("progress_pct", 0.0),
                "message": current_job.message,
                "elapsed_seconds": current_job.elapsed_seconds,
                "error": current_job.error,
                "error_code": current_job.error_code,
                "report_id": report_id,
            }
            yield f"data: {json.dumps(payload)}\n\n"

            if current_job.status in {"completed", "failed"}:
                break
            await asyncio.sleep(1.0)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# --------------------------------------------------------------------------
# 5. Full Report JSON (Schema Contract)
# --------------------------------------------------------------------------

@app.get("/api/analyses/{analysis_id}/report")
def get_analysis_report(analysis_id: str):
    job = jobs.get(analysis_id)
    if job and job.result and "report" in job.result:
        return job.result["report"]

    # Try loading from persisted RunStore
    run = RunStore().load_run(analysis_id)
    if run:
        return to_report_contract(run)

    # Check if job completed and has a run_id
    if job and job.result and "run_id" in job.result:
        run = RunStore().load_run(job.result["run_id"])
        if run:
            return to_report_contract(run)

    raise HTTPException(status_code=404, detail=f"No completed report found for '{analysis_id}'.")


# --------------------------------------------------------------------------
# 6. Saved Reports List (Search, Sort, Filter)
# --------------------------------------------------------------------------

@app.get("/api/analyses")
def list_analyses(
    q: Optional[str] = Query(None, description="Search term for title or text"),
    sort: str = Query("date_desc", description="date_desc | date_asc | title"),
    verdict: Optional[str] = Query(None, description="ACCEPT | ACCEPT_PRUNED | EXTRACTIVE_FALLBACK | ESCALATE"),
):
    store = RunStore()
    all_runs = store.list_runs()
    results = []

    for item in all_runs:
        run_id = item["run_id"]
        run = store.load_run(run_id)
        if not run:
            continue
        report = to_report_contract(run)

        # Filters
        if verdict and report["outcome"] != verdict:
            continue
        if q:
            query = q.lower()
            text_match = query in report["title"].lower() or query in run.text.lower() or query in report["outcome"].lower()
            if not text_match:
                continue

        flagged_count = sum(1 for s in report["summary"] if s["status"] == "FLAGGED")
        supported_count = sum(1 for s in report["summary"] if s["status"] == "SUPPORTED")

        results.append({
            "id": report["id"],
            "title": report["title"],
            "createdAt": report["createdAt"],
            "durationMs": report["durationMs"],
            "outcome": report["outcome"],
            "domain": run.domain,
            "sentenceCount": len(report["summary"]),
            "supportedCount": supported_count,
            "flaggedCount": flagged_count,
            "wordCount": report["source"]["wordCount"],
        })

    # Sort
    if sort == "date_asc":
        results.sort(key=lambda x: x["createdAt"])
    elif sort == "title":
        results.sort(key=lambda x: x["title"].lower())
    else:  # date_desc
        results.sort(key=lambda x: x["createdAt"], reverse=True)

    return {"reports": results, "total": len(results)}


@app.delete("/api/analyses/{analysis_id}", status_code=204)
def delete_analysis(analysis_id: str):
    if not RunStore().delete_run(analysis_id):
        raise HTTPException(status_code=404, detail=f"Report '{analysis_id}' was not found.")


@app.get("/api/analyses/{analysis_id}/export")
def export_analysis(analysis_id: str, format: str = Query("markdown", pattern="^(json|md|markdown|csv)$")):
    run = get_run_or_404(analysis_id)
    store = RunStore()
    fmt = "markdown" if format in ("md", "markdown") else format
    if fmt == "json":
        return JSONResponse(to_report_contract(run), headers={"Content-Disposition": f'attachment; filename="equisumm_report_{analysis_id}.json"'})
    if fmt == "markdown":
        return PlainTextResponse(store.export_markdown(run), media_type="text/markdown", headers={"Content-Disposition": f'attachment; filename="equisumm_report_{analysis_id}.md"'})
    if fmt == "csv":
        return PlainTextResponse(store.export_csv(run), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="equisumm_report_{analysis_id}.csv"'})
    raise HTTPException(status_code=400, detail="Invalid export format.")


# --------------------------------------------------------------------------
# 7. Backward Compatibility /api/runs Endpoints
# --------------------------------------------------------------------------

@app.get("/api/runs")
def list_runs():
    return RunStore().list_runs()


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    return get_run_or_404(run_id).to_dict()


@app.delete("/api/runs/{run_id}", status_code=204)
def delete_run(run_id: str):
    return delete_analysis(run_id)


@app.get("/api/runs/{run_id}/fact-audit")
def run_fact_audit(run_id: str):
    return {"rows": fact_audit(get_run_or_404(run_id))}


@app.get("/api/runs/{run_id}/embeddings")
def run_embeddings(run_id: str):
    return projection(get_run_or_404(run_id))


@app.get("/api/runs/{run_id}/exports/{format}")
def export_run_alias(run_id: str, format: str):
    return export_analysis(run_id, format=format)


# --------------------------------------------------------------------------
# 8. Evaluation & Benchmarking
# --------------------------------------------------------------------------

@app.post("/api/evaluate", status_code=202)
def create_evaluation(payload: EvaluationSubmission):
    dataset = PROJECT_ROOT / "samples" / "05_researcher_benchmark_sample.jsonl"
    job = jobs.submit("evaluation", lambda progress: run_evaluation(dataset, payload.max_samples, payload.run_name, progress))
    return {"id": job.job_id, "status": "queued"}


@app.get("/api/evaluate/{evaluation_id}")
def get_evaluation(evaluation_id: str):
    job = get_job_or_404(evaluation_id)
    return {
        "id": job.job_id,
        "status": job.status,
        "progress": job.public().get("progress_pct", 0.0),
        "message": job.message,
        "result": job.result,
        "error": job.error,
    }


# --------------------------------------------------------------------------
# 9. System & Settings Endpoints
# --------------------------------------------------------------------------

@app.get("/api/system")
def get_system():
    return system_info()


@app.post("/api/system/flush-cache")
def flush_cache():
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    return {"message": "CUDA memory cache flushed." if torch.cuda.is_available() else "CPU mode active; no CUDA cache to flush."}


@app.post("/api/system/self-test")
def run_self_test():
    try:
        return self_test()
    except AssertionError as exc:
        raise HTTPException(status_code=500, detail="Offline fact-verification self-test failed.") from exc


@app.get("/api/settings")
def get_settings():
    return settings()


@app.put("/api/settings")
def update_settings(payload: SettingsUpdate):
    try:
        return save_settings(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
