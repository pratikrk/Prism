"""Integration tests for the full research sprint → Gate-1 flow.

Requires: docker compose --profile test up -d
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import Job, Plan as PlanModel, StrategyBrief
from app.workers.tasks import (
    competitor_task,
    content_audit_task,
    finalize_task,
    keyword_task,
    llm_visibility_task,
    synthesis_task,
)


def _fake_plan_obj():
    return MagicMock(
        intent="drive signups",
        domain="whitecarrot.io",
        competitors=["greenhouse.io"],
        timeline_weeks=24,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )


@pytest.mark.asyncio
async def test_full_sprint_to_gate1(db_session, sample_workspace):
    """All 4 agents + synthesis → sprint at awaiting_gate1 + brief in DB."""
    # Create orchestrator job + sprint job + plan
    orch_job = Job(
        workspace_id=sample_workspace.id,
        type="orchestrator",
        status="complete",
        input={"goal": "grow signups"},
    )
    db_session.add(orch_job)
    await db_session.flush()

    plan_row = PlanModel(
        job_id=orch_job.id,
        workspace_id=sample_workspace.id,
        intent="drive signups",
        domain=sample_workspace.domain,
        competitors=["greenhouse.io"],
        timeline_weeks=24,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        plan_status="approved",
    )
    db_session.add(plan_row)
    await db_session.flush()

    sprint = Job(
        workspace_id=sample_workspace.id,
        parent_job_id=orch_job.id,
        type="sprint",
        status="running",
        input={"plan_id": str(plan_row.id)},
    )
    db_session.add(sprint)
    await db_session.flush()
    await db_session.commit()

    sprint_id = str(sprint.id)
    plan_id = str(plan_row.id)

    fake_kw = MagicMock()
    fake_kw.keywords = []
    fake_competitor = MagicMock()
    fake_competitor.competitors = []
    fake_competitor.gap_keywords = []
    fake_competitor.quick_wins = []
    fake_audit = MagicMock()
    fake_audit.pages_found = 0
    fake_audit.ranking_pages = []
    fake_audit.missing_topics = []
    fake_audit.summary = ""
    fake_llm = MagicMock()
    fake_llm.queries_tested = []
    fake_llm.brand_mentioned = False
    fake_llm.mention_count = 0
    fake_llm.competitor_mentions = {}
    fake_llm.sample_response = ""
    fake_llm.note = ""
    fake_synthesis = MagicMock()
    fake_synthesis.clusters = []
    fake_synthesis.executive_summary = []

    with (
        patch("app.workers.tasks.KeywordAgent") as MockKW,
        patch("app.workers.tasks.CompetitorAgent") as MockComp,
        patch("app.workers.tasks.ContentAuditAgent") as MockAudit,
        patch("app.workers.tasks.LLMVisibilityAgent") as MockLLM,
        patch("app.workers.tasks.SynthesisAgent") as MockSynth,
    ):
        MockKW.return_value.run = AsyncMock(return_value=fake_kw)
        MockComp.return_value.run = AsyncMock(return_value=fake_competitor)
        MockAudit.return_value.run = AsyncMock(return_value=fake_audit)
        MockLLM.return_value.run = AsyncMock(return_value=fake_llm)
        MockSynth.return_value.run = AsyncMock(return_value=fake_synthesis)

        r1 = keyword_task(plan_id, sprint_id)
        r2 = competitor_task(plan_id, sprint_id)
        r3 = content_audit_task(plan_id, sprint_id)
        r4 = llm_visibility_task(plan_id, sprint_id)

        assert all(r["ok"] for r in [r1, r2, r3, r4])

        fin = finalize_task([r1, r2, r3, r4], sprint_id)
        assert fin["ok"] is True
        assert fin["status"] == "synthesis_dispatched"

        # finalize fired synthesis — call it directly
        syn = synthesis_task(sprint_id)
        assert syn["ok"] is True
        assert "brief_id" in syn

    await db_session.refresh(sprint)
    assert sprint.status == "awaiting_gate1"

    from sqlalchemy import select
    r = await db_session.execute(
        select(StrategyBrief).where(StrategyBrief.sprint_job_id == sprint.id)
    )
    brief = r.scalar_one()
    assert brief.status == "draft"
    assert brief.share_token is not None


@pytest.mark.asyncio
async def test_gate1_approve_saves_status(db_session, sample_workspace):
    """Approve brief sets status=approved and sprint=complete."""
    import uuid as _uuid
    from httpx import ASGITransport, AsyncClient
    from app.main import app

    # Setup sprint at awaiting_gate1 + brief
    sprint = Job(
        workspace_id=sample_workspace.id,
        type="sprint",
        status="awaiting_gate1",
        input={"plan_id": str(_uuid.uuid4())},
    )
    db_session.add(sprint)
    await db_session.flush()

    # Need a plan for the brief FK
    orch = Job(workspace_id=sample_workspace.id, type="orchestrator", status="complete", input={"goal": "test"})
    db_session.add(orch)
    await db_session.flush()
    plan = PlanModel(
        job_id=orch.id, workspace_id=sample_workspace.id,
        intent="test", domain=sample_workspace.domain,
        competitors=[], timeline_weeks=12, sprint_order=[], plan_status="approved",
    )
    db_session.add(plan)
    await db_session.flush()

    brief = StrategyBrief(
        workspace_id=sample_workspace.id,
        plan_id=plan.id,
        sprint_job_id=sprint.id,
        clusters=[],
        executive_summary=[],
        share_token=str(_uuid.uuid4()),
        status="draft",
    )
    db_session.add(brief)
    await db_session.commit()

    from app.auth.clerk import ClerkPrincipal, current_user
    app.dependency_overrides[current_user] = lambda: ClerkPrincipal(user_id=sample_workspace.user_id)

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
    import uuid as _uuid
    from httpx import ASGITransport, AsyncClient
    from app.main import app

    orch = Job(workspace_id=sample_workspace.id, type="orchestrator", status="complete", input={"goal": "test"})
    db_session.add(orch)
    await db_session.flush()
    plan = PlanModel(
        job_id=orch.id, workspace_id=sample_workspace.id,
        intent="test", domain=sample_workspace.domain,
        competitors=[], timeline_weeks=12, sprint_order=[], plan_status="approved",
    )
    db_session.add(plan)
    sprint = Job(workspace_id=sample_workspace.id, type="sprint", status="complete", input={"plan_id": str(plan.id)})
    db_session.add(sprint)
    await db_session.flush()

    token = "pub-test-token-abc123"
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
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/share/{token}")   # no auth header

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "approved"


@pytest.mark.asyncio
async def test_share_invalid_token_returns_404(db_session):
    from httpx import ASGITransport, AsyncClient
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/share/nonexistent-token-xyz")

    assert res.status_code == 404
