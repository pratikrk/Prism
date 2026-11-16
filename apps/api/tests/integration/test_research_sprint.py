"""Integration tests for the full research sprint → Gate-1 flow.

Requires: docker compose --profile test up -d
"""
from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.auth.clerk import ClerkPrincipal, current_user
from app.core.config import settings
from app.core.db import get_session
from app.main import app
from app.models import Job, Plan as PlanModel, StrategyBrief, User, Workspace
from app.workers.tasks import (
    competitor_task,
    content_audit_task,
    finalize_task,
    keyword_task,
    llm_visibility_task,
    synthesis_task,
)


def _factory():
    """NullPool session factory that creates fresh connections (no cross-loop reuse)."""
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def _create_workspace(factory) -> tuple[uuid.UUID, str]:
    """Create a real committed workspace + user and return (ws_id, domain)."""
    uid = f"rspr_{uuid.uuid4().hex[:8]}"
    async with factory() as session:
        user = User(id=uid, email=f"{uid}@test.io", name="T")
        ws = Workspace(user_id=uid, name="sprint-ws", domain=f"{uid}.test")
        session.add(user)
        session.add(ws)
        await session.flush()
        ws_id, domain = ws.id, ws.domain
        await session.commit()
    return ws_id, domain


@pytest.mark.asyncio
async def test_full_sprint_to_gate1():
    """All 4 agents + synthesis → sprint at awaiting_gate1 + brief in DB."""
    factory = _factory()
    from sqlalchemy import select

    ws_id, domain = await _create_workspace(factory)

    # Create orchestrator + plan + sprint with real committed session
    async with factory() as session:
        orch_job = Job(
            workspace_id=ws_id,
            type="orchestrator",
            status="complete",
            input={"goal": "grow signups"},
        )
        session.add(orch_job)
        await session.flush()

        plan_row = PlanModel(
            job_id=orch_job.id,
            workspace_id=ws_id,
            intent="drive signups",
            domain=domain,
            competitors=["greenhouse.io"],
            timeline_weeks=24,
            sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
            plan_status="approved",
        )
        session.add(plan_row)
        await session.flush()

        sprint = Job(
            workspace_id=ws_id,
            parent_job_id=orch_job.id,
            type="sprint",
            status="running",
            input={"plan_id": str(plan_row.id)},
        )
        session.add(sprint)
        await session.flush()
        sprint_id = str(sprint.id)
        plan_id = str(plan_row.id)
        await session.commit()

    from app.agents.keyword import KeywordResult
    from app.agents.competitor import CompetitorResult
    from app.agents.content_audit import ContentAuditResult
    from app.agents.llm_visibility import LLMVisibilityResult
    from app.agents.synthesis import SynthesisResult

    fake_kw = KeywordResult(keywords=[])
    fake_competitor = CompetitorResult(competitors=[], gap_keywords=[], quick_wins=[])
    fake_audit = ContentAuditResult(pages_found=0, ranking_pages=[], missing_topics=[], summary="")
    fake_llm = LLMVisibilityResult(
        queries_tested=[], brand_mentioned=False, mention_count=0,
        competitor_mentions={}, sample_response="", note=""
    )
    fake_synthesis = SynthesisResult(clusters=[], executive_summary=[])

    with (
        patch("app.workers.tasks.KeywordAgent") as MockKW,
        patch("app.workers.tasks.CompetitorAgent") as MockComp,
        patch("app.workers.tasks.ContentAuditAgent") as MockAudit,
        patch("app.workers.tasks.LLMVisibilityAgent") as MockLLM,
        patch("app.workers.tasks.SynthesisAgent") as MockSynth,
        patch.object(synthesis_task, "apply_async"),  # prevent background dispatch (finalize uses apply_async)
    ):
        MockKW.return_value.run = AsyncMock(return_value=fake_kw)
        MockComp.return_value.run = AsyncMock(return_value=fake_competitor)
        MockAudit.return_value.run = AsyncMock(return_value=fake_audit)
        MockLLM.return_value.run = AsyncMock(return_value=fake_llm)
        MockSynth.return_value.run = AsyncMock(return_value=fake_synthesis)

        r1 = await asyncio.to_thread(keyword_task, plan_id, sprint_id)
        r2 = await asyncio.to_thread(competitor_task, plan_id, sprint_id)
        r3 = await asyncio.to_thread(content_audit_task, plan_id, sprint_id)
        r4 = await asyncio.to_thread(llm_visibility_task, plan_id, sprint_id)

        assert all(r["ok"] for r in [r1, r2, r3, r4])

        fin = await asyncio.to_thread(finalize_task, [r1, r2, r3, r4], sprint_id)
        assert fin["ok"] is True
        assert fin["status"] == "synthesis_dispatched"

        # finalize dispatched synthesis via .delay() — call it directly instead
        syn = await asyncio.to_thread(synthesis_task, sprint_id)
        assert syn["ok"] is True
        assert "brief_id" in syn

    async with factory() as session:
        refreshed_sprint = await session.get(Job, uuid.UUID(sprint_id))
        assert refreshed_sprint is not None
        assert refreshed_sprint.status == "awaiting_gate1"

        r = await session.execute(
            select(StrategyBrief).where(StrategyBrief.sprint_job_id == uuid.UUID(sprint_id))
        )
        brief = r.scalar_one()
        assert brief.status == "draft"
        assert brief.share_token is not None


@pytest.mark.asyncio
async def test_gate1_approve_saves_status(db_session, sample_workspace):
    """Approve brief sets status=approved and sprint=complete."""
    from httpx import ASGITransport, AsyncClient

    sprint = Job(
        workspace_id=sample_workspace.id,
        type="sprint",
        status="awaiting_gate1",
        input={"plan_id": str(uuid.uuid4())},
    )
    db_session.add(sprint)
    await db_session.flush()

    orch = Job(
        workspace_id=sample_workspace.id,
        type="orchestrator",
        status="complete",
        input={"goal": "test"},
    )
    db_session.add(orch)
    await db_session.flush()

    plan = PlanModel(
        job_id=orch.id,
        workspace_id=sample_workspace.id,
        intent="test",
        domain=sample_workspace.domain,
        competitors=[],
        timeline_weeks=12,
        sprint_order=[],
        plan_status="approved",
    )
    db_session.add(plan)
    await db_session.flush()

    brief = StrategyBrief(
        workspace_id=sample_workspace.id,
        plan_id=plan.id,
        sprint_job_id=sprint.id,
        clusters=[],
        executive_summary=[],
        share_token=str(uuid.uuid4()),
        status="draft",
    )
    db_session.add(brief)
    await db_session.flush()

    async def override_session():
        yield db_session

    app.dependency_overrides[current_user] = lambda: ClerkPrincipal(user_id=sample_workspace.user_id)
    app.dependency_overrides[get_session] = override_session

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                f"/briefs/{brief.id}/approve",
                headers={"Authorization": "Bearer fake"},
            )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "approved"
        assert data["share_token"] == brief.share_token

        await db_session.refresh(sprint)
        assert sprint.status == "complete"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_share_endpoint_returns_brief_without_auth(db_session, sample_workspace):
    """GET /share/{token} returns brief without Authorization header."""
    from httpx import ASGITransport, AsyncClient

    orch = Job(
        workspace_id=sample_workspace.id,
        type="orchestrator",
        status="complete",
        input={"goal": "test"},
    )
    db_session.add(orch)
    await db_session.flush()

    plan = PlanModel(
        job_id=orch.id,
        workspace_id=sample_workspace.id,
        intent="test",
        domain=sample_workspace.domain,
        competitors=[],
        timeline_weeks=12,
        sprint_order=[],
        plan_status="approved",
    )
    db_session.add(plan)
    sprint = Job(
        workspace_id=sample_workspace.id,
        type="sprint",
        status="complete",
        input={"plan_id": str(plan.id)},
    )
    db_session.add(sprint)
    await db_session.flush()

    token = f"pub-test-token-{uuid.uuid4().hex[:8]}"
    brief = StrategyBrief(
        workspace_id=sample_workspace.id,
        plan_id=plan.id,
        sprint_job_id=sprint.id,
        clusters=[],
        executive_summary=[],
        share_token=token,
        status="approved",
    )
    db_session.add(brief)
    await db_session.flush()

    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get(f"/share/{token}")

        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "approved"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_share_invalid_token_returns_404():
    from httpx import ASGITransport, AsyncClient

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/share/nonexistent-token-xyz")

    assert res.status_code == 404
