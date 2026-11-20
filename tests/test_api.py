"""API endpoint integration tests."""
from __future__ import annotations

import time
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from app.services.store import RunStore

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_test_runs():
    yield
    time.sleep(0.5)
    store = RunStore()
    for run in store.list_runs():
        store.delete_run(run["run_id"])



def test_api_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "device" in data
    assert "jobs" in data


def test_api_samples():
    response = client.get("/api/samples")
    assert response.status_code == 200
    samples = response.json()
    assert len(samples) >= 4
    sample_ids = [s["id"] for s in samples]
    assert "earnings" in sample_ids
    assert "agreement" in sample_ids

    # Fetch specific sample
    res_sample = client.get("/api/samples/earnings")
    assert res_sample.status_code == 200
    assert "text" in res_sample.json()
    assert len(res_sample.json()["text"]) > 100


def test_api_validation_errors():
    # Empty text
    res = client.post("/api/analyses", data={"text": "   "})
    assert res.status_code == 422
    assert "EMPTY_TEXT" in str(res.json())

    # Unsupported file
    res = client.post(
        "/api/analyses",
        files={"file": ("malicious.exe", b"binary content", "application/octet-stream")},
    )
    assert res.status_code == 422
    assert "UNSUPPORTED_FILE" in str(res.json())


def test_api_job_lifecycle_and_cancel(monkeypatch):
    import time

    def mock_run(text, domain, n_candidates, progress):
        progress("Reading document", 0.1)
        time.sleep(0.05)
        progress("Writing summary", 0.3)
        return {"run_id": "test_mock_123", "report": {"id": "test_mock_123"}}

    monkeypatch.setattr("backend.main.run_pipeline", mock_run)

    # Submit job
    res = client.post("/api/analyses", data={"text": "Quick test text.", "domain": "financial"})
    assert res.status_code == 202
    job_info = res.json()
    assert "id" in job_info
    job_id = job_info["id"]

    # Poll status
    res_status = client.get(f"/api/analyses/{job_id}")
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["id"] == job_id
    assert status_data["status"] in ("queued", "running", "completed", "failed")

    # Cancel job
    res_cancel = client.post(f"/api/analyses/{job_id}/cancel")
    assert res_cancel.status_code in (200, 400)





def test_api_system_and_self_test():
    res_sys = client.get("/api/system")
    assert res_sys.status_code == 200
    assert "device" in res_sys.json()

    res_test = client.post("/api/system/self-test")
    assert res_test.status_code == 200
    assert "passed" in res_test.json()["message"].lower()


def test_api_settings():
    res = client.get("/api/settings")
    assert res.status_code == 200
    cfg = res.json()
    assert "n_candidates" in cfg
    assert "entailment_threshold" in cfg
