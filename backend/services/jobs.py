from __future__ import annotations

import json
import threading
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

from app.config import get_config


STAGE_MAP = [
    (0.20, 1, "Reading document"),
    (0.40, 2, "Writing summary"),
    (0.60, 3, "Finding evidence"),
    (0.75, 4, "Checking claims"),
    (0.90, 5, "Checking numbers and names"),
    (0.99, 6, "Choosing the safest summary"),
    (1.00, 6, "Complete"),
]


def resolve_stage(progress: float) -> tuple[int, str]:
    for threshold, stage_num, stage_label in STAGE_MAP:
        if progress <= threshold:
            return stage_num, stage_label
    return 6, "Choosing the safest summary"


@dataclass
class Job:
    job_id: str
    kind: str
    status: str = "queued"
    progress: float = 0.0  # 0.0 to 1.0 internally, surfaced as 0-100 in API
    stage: int = 1
    stage_name: str = "Reading document"
    message: str = "Queued"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    start_time: float | None = None
    elapsed_seconds: float = 0.0
    result: dict[str, Any] | None = None
    error: str | None = None
    error_code: str | None = None
    cancelled: bool = False

    def public(self) -> dict[str, Any]:
        data = asdict(self)
        data.pop("start_time", None)
        data["progress_pct"] = round(self.progress * 100, 1)
        return data


class JobManager:
    """Single-worker queue keeps model loading and GPU execution process-wide and serial."""

    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="equisumm-ml")
        self._jobs_dir = get_config().cache_root / "jobs"
        self._jobs_dir.mkdir(parents=True, exist_ok=True)
        self._restore_interrupted_jobs()

    def _path(self, job_id: str):
        return self._jobs_dir / f"{job_id}.json"

    def _save(self, job: Job) -> None:
        """Persist a small status record so a process restart is explainable to clients."""
        try:
            self._path(job.job_id).write_text(json.dumps(job.public()), encoding="utf-8")
        except Exception:
            pass

    def _restore_interrupted_jobs() -> None:
        pass

    def _restore_interrupted_jobs(self) -> None:
        """Jobs cannot resume inference after a process exit; mark them terminal instead of orphaning them."""
        for path in self._jobs_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                data.pop("progress_pct", None)
                data.pop("start_time", None)
                job = Job(**data)
            except (OSError, TypeError, ValueError, json.JSONDecodeError):
                continue
            if job.status in {"queued", "running"}:
                job.status = "failed"
                job.message = "Interrupted by API restart"
                job.error = "The API restarted before this job completed. Submit the document again."
                job.error_code = "JOB_CANCELLED"
                job.updated_at = datetime.now(timezone.utc).isoformat()
                self._save(job)
            self._jobs[job.job_id] = job

    def submit(self, kind: str, work: Callable[[Callable[[str, float], None]], dict[str, Any]]) -> Job:
        job = Job(job_id=uuid.uuid4().hex[:12], kind=kind)
        with self._lock:
            self._jobs[job.job_id] = job
            self._save(job)

        def update(message: str, progress: float) -> None:
            with self._lock:
                if job.cancelled:
                    return
                job.message = message
                job.progress = max(0.0, min(1.0, progress))
                stage_num, stage_label = resolve_stage(job.progress)
                job.stage = stage_num
                job.stage_name = stage_label
                if job.start_time:
                    job.elapsed_seconds = round(time.time() - job.start_time, 1)
                job.updated_at = datetime.now(timezone.utc).isoformat()
                self._save(job)

        def runner() -> None:
            with self._lock:
                if job.cancelled:
                    return
                job.status = "running"
                job.start_time = time.time()
                job.message = "Starting"
                job.stage = 1
                job.stage_name = "Reading document"
                job.updated_at = datetime.now(timezone.utc).isoformat()
                self._save(job)
            try:
                result = work(update)
                with self._lock:
                    if job.cancelled:
                        return
                    job.result = result
                    job.status = "completed"
                    job.progress = 1.0
                    job.stage = 6
                    job.stage_name = "Complete"
                    job.message = "Complete"
                    if job.start_time:
                        job.elapsed_seconds = round(time.time() - job.start_time, 1)
                    job.updated_at = datetime.now(timezone.utc).isoformat()
                    self._save(job)
            except Exception as exc:
                err_text = str(exc)
                err_code = "INTERNAL_ERROR"
                if "CUDA out of memory" in err_text or "out of memory" in err_text.lower():
                    err_code = "GPU_OOM"
                elif "Hard constraint violation" in err_text:
                    err_code = "PATH_GUARD"
                elif "model" in err_text.lower() and ("failed" in err_text.lower() or "not found" in err_text.lower()):
                    err_code = "MODEL_LOAD_FAILED"

                with self._lock:
                    job.status = "failed"
                    job.error = err_text
                    job.error_code = err_code
                    job.message = f"Failed: {err_text}"
                    if job.start_time:
                        job.elapsed_seconds = round(time.time() - job.start_time, 1)
                    job.updated_at = datetime.now(timezone.utc).isoformat()
                    self._save(job)
                traceback.print_exc()

        self._executor.submit(runner)
        return job

    def cancel(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return False
            if job.status in {"queued", "running"}:
                job.cancelled = True
                job.status = "failed"
                job.error = "Analysis cancelled by user."
                job.error_code = "JOB_CANCELLED"
                job.message = "Cancelled"
                if job.start_time:
                    job.elapsed_seconds = round(time.time() - job.start_time, 1)
                job.updated_at = datetime.now(timezone.utc).isoformat()
                self._save(job)
                return True
            return False

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                return job
            try:
                data = json.loads(self._path(job_id).read_text(encoding="utf-8"))
                data.pop("progress_pct", None)
                data.pop("start_time", None)
                job = Job(**data)
            except (OSError, TypeError, ValueError, json.JSONDecodeError):
                return None
            self._jobs[job_id] = job
            return job

    def counts(self) -> dict[str, int]:
        with self._lock:
            return {
                "queued": sum(j.status == "queued" for j in self._jobs.values()),
                "running": sum(j.status == "running" for j in self._jobs.values()),
            }


jobs = JobManager()
