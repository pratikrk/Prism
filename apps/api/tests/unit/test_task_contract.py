"""Unit-test the child-task contract without a real Celery broker or DB."""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import sentry_sdk

from app.workers import tasks as t


def _mock_session_ctx(plan_mock):
    """Return an async context manager that yields a session mock with canned plan lookup."""
    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.flush = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.get = AsyncMock(return_value=plan_mock)

    @asynccontextmanager
    async def _ctx():
        yield mock_session

    return _ctx, mock_session


@pytest.mark.asyncio
async def test_child_body_returns_ok_on_success():
    fake_plan = MagicMock(
        intent="x", domain="x.test", competitors=[], timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        traffic_target=None,
    )
    ctx, _ = _mock_session_ctx(fake_plan)

    runner = AsyncMock(return_value={"keywords": []})
    sprint_id = str(uuid.uuid4())
    plan_id = str(uuid.uuid4())

    with (
        patch("app.workers.tasks.SessionLocal", ctx),
        patch("app.workers.tasks._workspace_id_of_sprint", AsyncMock(return_value=uuid.uuid4())),
        patch("app.workers.tasks.transition", AsyncMock()),
    ):
        body = t._child_body("keyword", runner)
        result = await body(plan_id, sprint_id)

    assert result["ok"] is True
    assert result["type"] == "keyword"


@pytest.mark.asyncio
async def test_child_body_catches_exception_and_reports_to_sentry(monkeypatch):
    fake_plan = MagicMock(
        intent="x", domain="x.test", competitors=[], timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        traffic_target=None,
    )
    ctx, _ = _mock_session_ctx(fake_plan)

    captured: list[BaseException] = []
    monkeypatch.setattr(sentry_sdk, "capture_exception", lambda e: captured.append(e))

    runner = AsyncMock(side_effect=RuntimeError("boom"))
    sprint_id = str(uuid.uuid4())
    plan_id = str(uuid.uuid4())

    with (
        patch("app.workers.tasks.SessionLocal", ctx),
        patch("app.workers.tasks._workspace_id_of_sprint", AsyncMock(return_value=uuid.uuid4())),
        patch("app.workers.tasks.transition", AsyncMock()),
    ):
        body = t._child_body("keyword", runner)
        result = await body(plan_id, sprint_id)

    assert result["ok"] is False
    assert result["error"]["kind"] == "bug"
    assert captured and isinstance(captured[0], RuntimeError)


@pytest.mark.asyncio
async def test_child_body_passes_traffic_target_to_plan():
    """Plan reconstructed in _child_body must include traffic_target from the DB row."""
    fake_plan = MagicMock(
        intent="reach 50k visits",
        domain="example.com",
        competitors=[],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        traffic_target=50000,
    )
    ctx, _ = _mock_session_ctx(fake_plan)

    captured_plan = []

    async def capturing_runner(plan):
        captured_plan.append(plan)
        return {"keywords": []}

    sprint_id = str(uuid.uuid4())
    plan_id = str(uuid.uuid4())

    with (
        patch("app.workers.tasks.SessionLocal", ctx),
        patch("app.workers.tasks._workspace_id_of_sprint", AsyncMock(return_value=uuid.uuid4())),
        patch("app.workers.tasks.transition", AsyncMock()),
    ):
        body = t._child_body("keyword", capturing_runner)
        await body(plan_id, sprint_id)

    assert captured_plan[0].traffic_target == 50000
