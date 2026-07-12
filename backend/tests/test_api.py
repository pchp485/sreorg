"""API-level tests using FastAPI's TestClient."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.container import build_container
from app.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    settings = Settings(
        environment="local",
        speaker_provider="mock",
        llm_provider="mock",
        stt_provider="mock",
        wakeword_provider="keyword",
        device_provider_order=["mock"],
        voice_profile_dir=str(tmp_path / "vp"),
        redis_url="redis://127.0.0.1:0/0",
    )
    app = create_app()
    app.state.container = build_container(settings)
    with TestClient(app) as c:
        yield c


def test_health(client) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["providers"]["speaker"] == "mock"


def test_text_command_parent_authorized(client) -> None:
    resp = client.post(
        "/api/voice/command",
        json={
            "text": "Hey ParentAI turn off the downstairs lights",
            "speaker": "harish",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["authorized"] and body["executed"]
    assert body["role"] == "parent"


def test_text_command_unknown_rejected(client) -> None:
    resp = client.post(
        "/api/voice/command",
        json={"text": "Hey ParentAI unlock the door", "speaker": "stranger"},
    )
    body = resp.json()
    assert not body["executed"]
    assert body["spoken_response"] == "Sorry, I only respond to authorized parents."


def test_admin_endpoints_require_auth(client) -> None:
    assert client.get("/api/users").status_code == 401
    token = client.post("/api/users/admin/token").json()["access_token"]
    resp = client.get("/api/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert any(u["id"] == "harish" for u in resp.json())


def test_permission_matrix_endpoint(client) -> None:
    token = client.post("/api/users/harish/token").json()["access_token"]
    resp = client.get("/api/permissions", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    matrix = resp.json()
    assert "home_automation" in matrix["parent"]
    assert "home_automation" not in matrix["child"]
