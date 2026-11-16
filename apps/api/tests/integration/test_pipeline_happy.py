"""Runs the full pipeline end-to-end against local Postgres + Redis.

Patches the Claude and DataForSEO clients so we don't hit real networks.
"""
from __future__ import annotations

import time
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.agents.competitor import CompetitorResult
from app.agents.content_audit import ContentAuditResult
from app.agents.llm_visibility import LLMVisibilityResult
from app.agents.synthesis import SynthesisResult
from app.integrations.dataforseo import KeywordRow
from app.models import Job, Plan as PlanModel, Workspace
from app.workers.tasks import orchestrator_task


@pytest.mark.integration
def test_full_pipeline_happy_path(db_session_sync, sample_workspace_sync, celery_worker):
    job_id = _insert_orchestrator_job(db_session_sync, sample_workspace_sync.id, "goal here")

    fake_synthesis = SynthesisResult(clusters=[], executive_summary=[])
    fake_competitor = CompetitorResult(competitors=[], gap_keywords=[], quick_wins=[])
    fake_audit = ContentAuditResult(pages_found=0, ranking_pages=[], missing_topics=[], summary="")
    fake_llm = LLMVisibilityResult(
        queries_tested=[], brand_mentioned=False, mention_count=0,
        competitor_mentions={}, sample_response="", note=""
    )

    with patch("app.agents.orchestrator.OrchestratorAgent._call_claude",
               AsyncMock(return_value=_fake_plan())), \
         patch("app.agents.keyword.KeywordAgent._call_claude",
               AsyncMock(return_value=_fake_keyword_result())), \
         patch("app.integrations.dataforseo.DataForSEOClient.keywords_for_keywords",
               AsyncMock(return_value=[KeywordRow(keyword="k", search_volume=100)])), \
         patch("app.workers.tasks.CompetitorAgent") as MockComp, \
         patch("app.workers.tasks.ContentAuditAgent") as MockAudit, \
         patch("app.workers.tasks.LLMVisibilityAgent") as MockLLM, \
         patch("app.workers.tasks.SynthesisAgent") as MockSynth:

        MockComp.return_value.run = AsyncMock(return_value=fake_competitor)
        MockAudit.return_value.run = AsyncMock(return_value=fake_audit)
        MockLLM.return_value.run = AsyncMock(return_value=fake_llm)
        MockSynth.return_value.run = AsyncMock(return_value=fake_synthesis)

        result = orchestrator_task.delay(job_id).get(timeout=30)
        plan_id = result["plan_id"]
        _approve_plan_and_dispatch(db_session_sync, job_id, plan_id, sample_workspace_sync.id)
        _wait_for_sprint_terminal(db_session_sync, job_id, timeout=30)

    orch = db_session_sync.get(Job, uuid.UUID(job_id))
    assert orch.status == "complete"
    sprint = _find_sprint(db_session_sync, orch.id)
    assert sprint.status == "awaiting_gate1"
    children = _find_children(db_session_sync, sprint.id)
    assert len(children) == 4
    assert all(c.status == "complete" for c in children)


def _fake_plan():
    from app.agents.orchestrator import Plan
    return Plan(
        intent="signups", domain="x.test", competitors=["y.test"],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )


def _fake_keyword_result():
    from app.agents.keyword import KeywordResult
    return KeywordResult(keywords=[])


def _insert_orchestrator_job(session, workspace_id, goal: str) -> str:
    job = Job(workspace_id=workspace_id, type="orchestrator", status="pending", input={"goal": goal})
    session.add(job)
    session.commit()
    return str(job.id)


def _approve_plan_and_dispatch(session, orch_job_id: str, plan_id: str, workspace_id) -> str:
    """Simulate POST /plans/{id}/approve: mark orch complete, create sprint, dispatch chord."""
    from app.workers.tasks import _dispatch_chord

    orch = session.get(Job, uuid.UUID(orch_job_id))
    orch.status = "complete"

    plan = session.get(PlanModel, uuid.UUID(plan_id))
    plan.plan_status = "approved"

    sprint = Job(
        workspace_id=workspace_id,
        parent_job_id=uuid.UUID(orch_job_id),
        type="sprint",
        status="running",
        input={"plan_id": plan_id},
    )
    session.add(sprint)
    session.flush()
    sprint_id = str(sprint.id)
    session.commit()

    _dispatch_chord(plan_id, sprint_id)
    return sprint_id


def _find_sprint(session, orchestrator_id):
    return session.execute(
        select(Job).where(Job.parent_job_id == orchestrator_id, Job.type == "sprint")
    ).scalar_one()


def _find_children(session, sprint_id):
    return session.execute(
        select(Job).where(Job.parent_job_id == sprint_id, Job.type != "sprint")
    ).scalars().all()


def _wait_for_sprint_terminal(session, orchestrator_id, timeout: float):
    deadline = time.time() + timeout
    while time.time() < deadline:
        session.expire_all()
        orch = session.get(Job, uuid.UUID(orchestrator_id))
        if orch and orch.status == "complete":
            sprint = session.execute(
                select(Job).where(Job.parent_job_id == orch.id, Job.type == "sprint")
            ).scalar_one_or_none()
            if sprint and sprint.status in ("complete", "complete_with_errors", "failed", "awaiting_gate1"):
                return
        time.sleep(0.5)
    raise AssertionError("sprint did not reach terminal state within timeout")
