"""Integration tests for Gate-0 pipeline flow.

Requires: docker compose --profile test up -d  (postgres + redis)
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import Job, Plan as PlanModel
from app.workers.tasks import orchestrator_task


@pytest.mark.asyncio
async def test_gate0_orchestrator_stops_without_dispatching_chord(
    db_session, sample_workspace
):
    """Full orchestrator run must stop at awaiting_gate0, not fire chord."""
    job = Job(
        workspace_id=sample_workspace.id,
        type="orchestrator",
        status="pending",
        input={"goal": "grow signups for test.io in 12 weeks"},
    )
    db_session.add(job)
    await db_session.flush()
    job_id = str(job.id)

    fake_plan = MagicMock(
        intent="grow signups",
        domain=sample_workspace.domain,
        competitors=["rival.io"],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )

    with (
        patch("app.workers.tasks.OrchestratorAgent") as MockAgent,
        patch("app.workers.tasks._dispatch_chord") as mock_dispatch,
    ):
        MockAgent.return_value.run = AsyncMock(return_value=fake_plan)
        result = orchestrator_task(job_id)

    assert result["ok"] is True
    mock_dispatch.assert_not_called()

    await db_session.refresh(job)
    assert job.status == "awaiting_gate0"

    plan_id = result["plan_id"]
    from sqlalchemy import select
    r = await db_session.execute(
        select(PlanModel).where(PlanModel.id == plan_id)
    )
    plan = r.scalar_one()
    assert plan.plan_status == "draft"
    assert plan.version == 1


@pytest.mark.asyncio
async def test_gate0_refine_increments_version(db_session, sample_workspace):
    """Refine creates new orchestrator job with version=2, marks v1 superseded."""
    job_v1 = Job(
        workspace_id=sample_workspace.id,
        type="orchestrator",
        status="pending",
        input={"goal": "grow signups"},
    )
    db_session.add(job_v1)
    await db_session.flush()

    fake_plan = MagicMock(
        intent="grow",
        domain=sample_workspace.domain,
        competitors=[],
        timeline_weeks=12,
        sprint_order=["keyword"],
    )

    with (
        patch("app.workers.tasks.OrchestratorAgent") as MockAgent,
        patch("app.workers.tasks._dispatch_chord"),
    ):
        MockAgent.return_value.run = AsyncMock(return_value=fake_plan)
        result_v1 = orchestrator_task(str(job_v1.id))

    plan_v1_id = result_v1["plan_id"]

    # Simulate refine endpoint creating new job with parent_plan_id
    job_v2 = Job(
        workspace_id=sample_workspace.id,
        type="orchestrator",
        status="pending",
        input={
            "goal": "grow signups",
            "feedback": "focus on enterprise",
            "parent_plan_id": plan_v1_id,
        },
    )
    db_session.add(job_v2)
    await db_session.flush()

    with (
        patch("app.workers.tasks.OrchestratorAgent") as MockAgent,
        patch("app.workers.tasks._dispatch_chord"),
    ):
        MockAgent.return_value.run = AsyncMock(return_value=fake_plan)
        result_v2 = orchestrator_task(str(job_v2.id))

    from sqlalchemy import select
    r = await db_session.execute(
        select(PlanModel).where(PlanModel.id == result_v2["plan_id"])
    )
    plan_v2 = r.scalar_one()
    assert plan_v2.version == 2
    assert plan_v2.feedback == "focus on enterprise"
    assert str(plan_v2.parent_plan_id) == plan_v1_id
