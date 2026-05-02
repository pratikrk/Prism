"""Integration tests for Gate-0 pipeline flow.

Requires: docker compose --profile test up -d  (postgres + redis)
"""
from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models import Job, Plan as PlanModel, User, Workspace


def _factory():
    """NullPool engine — fresh connection per use, no cross-loop reuse."""
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def _create_workspace(factory) -> Workspace:
    """Create a real committed workspace (and user) for FK constraints."""
    user_id = f"gate0_{uuid.uuid4().hex[:8]}"
    async with factory() as session:
        user = User(id=user_id, email=f"{user_id}@test.io", name="T")
        ws = Workspace(user_id=user_id, name="gate0-ws", domain=f"{user_id}.test")
        session.add(user)
        session.add(ws)
        await session.flush()
        ws_id = ws.id
        user_id_val = ws.user_id
        domain = ws.domain
        await session.commit()
    return ws_id, domain


@pytest.mark.asyncio
async def test_gate0_orchestrator_stops_without_dispatching_chord():
    """Full orchestrator run must stop at awaiting_gate0, not fire chord."""
    factory = _factory()
    ws_id, domain = await _create_workspace(factory)

    async with factory() as session:
        job = Job(
            workspace_id=ws_id,
            type="orchestrator",
            status="pending",
            input={"goal": "grow signups for test.io in 12 weeks"},
        )
        session.add(job)
        await session.flush()
        job_id = str(job.id)
        await session.commit()

    fake_plan = MagicMock(
        intent="grow signups",
        domain=domain,
        competitors=["rival.io"],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        traffic_target=None,
        feasibility_note=None,
    )

    from app.workers.tasks import orchestrator_task

    with (
        patch("app.workers.tasks.OrchestratorAgent") as MockAgent,
        patch("app.workers.tasks._dispatch_chord") as mock_dispatch,
    ):
        MockAgent.return_value.run = AsyncMock(return_value=fake_plan)
        result = await asyncio.to_thread(orchestrator_task, job_id)

    assert result["ok"] is True
    mock_dispatch.assert_not_called()

    async with factory() as session:
        refreshed_job = await session.get(Job, job.id)
        assert refreshed_job is not None
        assert refreshed_job.status == "awaiting_gate0"

        plan_id = result["plan_id"]
        r = await session.execute(select(PlanModel).where(PlanModel.id == plan_id))
        plan = r.scalar_one()
        assert plan.plan_status == "draft"
        assert plan.version == 1


@pytest.mark.asyncio
async def test_gate0_refine_increments_version():
    """Refine creates new orchestrator job with version=2."""
    factory = _factory()
    ws_id, domain = await _create_workspace(factory)

    from app.workers.tasks import orchestrator_task

    async with factory() as session:
        job_v1 = Job(
            workspace_id=ws_id,
            type="orchestrator",
            status="pending",
            input={"goal": "grow signups"},
        )
        session.add(job_v1)
        await session.flush()
        job_v1_id = str(job_v1.id)
        await session.commit()

    fake_plan = MagicMock(
        intent="grow",
        domain=domain,
        competitors=[],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        traffic_target=None,
        feasibility_note=None,
    )

    with (
        patch("app.workers.tasks.OrchestratorAgent") as MockAgent,
        patch("app.workers.tasks._dispatch_chord"),
    ):
        MockAgent.return_value.run = AsyncMock(return_value=fake_plan)
        result_v1 = await asyncio.to_thread(orchestrator_task, job_v1_id)

    plan_v1_id = result_v1["plan_id"]

    async with factory() as session:
        job_v2 = Job(
            workspace_id=ws_id,
            type="orchestrator",
            status="pending",
            input={
                "goal": "grow signups",
                "feedback": "focus on enterprise",
                "parent_plan_id": plan_v1_id,
            },
        )
        session.add(job_v2)
        await session.flush()
        job_v2_id = str(job_v2.id)
        await session.commit()

    with (
        patch("app.workers.tasks.OrchestratorAgent") as MockAgent,
        patch("app.workers.tasks._dispatch_chord"),
    ):
        MockAgent.return_value.run = AsyncMock(return_value=fake_plan)
        result_v2 = await asyncio.to_thread(orchestrator_task, job_v2_id)

    async with factory() as session:
        r = await session.execute(
            select(PlanModel).where(PlanModel.id == result_v2["plan_id"])
        )
        plan_v2 = r.scalar_one()
        assert plan_v2.version == 2
        assert plan_v2.feedback == "focus on enterprise"
        assert str(plan_v2.parent_plan_id) == plan_v1_id
