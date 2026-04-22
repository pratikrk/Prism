"""Unit-test the child-task contract without a real Celery broker."""
from unittest.mock import AsyncMock, patch

import pytest
import sentry_sdk

from app.workers import tasks as t


@pytest.mark.asyncio
async def test_child_body_returns_ok_on_success(db_session, sample_workspace, sample_plan):
    sprint = await _sprint(db_session, sample_workspace, sample_plan)
    runner = AsyncMock(return_value={"keywords": []})
    body = t._child_body("keyword", runner)
    result = await body(str(sample_plan.id), str(sprint.id))
    assert result["ok"] is True
    assert result["type"] == "keyword"


@pytest.mark.asyncio
async def test_child_body_catches_exception_and_reports_to_sentry(
    db_session, sample_workspace, sample_plan, monkeypatch
):
    sprint = await _sprint(db_session, sample_workspace, sample_plan)
    captured: list[BaseException] = []
    monkeypatch.setattr(sentry_sdk, "capture_exception", lambda e: captured.append(e))

    runner = AsyncMock(side_effect=RuntimeError("boom"))
    body = t._child_body("keyword", runner)
    result = await body(str(sample_plan.id), str(sprint.id))

    assert result["ok"] is False
    assert result["error"]["kind"] == "bug"
    assert captured and isinstance(captured[0], RuntimeError)


@pytest.fixture
async def sample_plan(db_session, sample_workspace):
    from app.models import Plan as PlanModel
    p = PlanModel(
        job_id=None,
        workspace_id=sample_workspace.id,
        intent="x",
        domain="x.test",
        competitors=[],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )
    db_session.add(p)
    await db_session.flush()
    return p


async def _sprint(db_session, workspace, plan):
    from app.models import Job
    s = Job(
        workspace_id=workspace.id,
        type="sprint",
        status="running",
        input={"plan_id": str(plan.id)},
    )
    db_session.add(s)
    await db_session.flush()
    return s
