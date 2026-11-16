"""The single most important integration test.

Proves: if a child TASK (not just the agent body) raises past the chord
boundary — the chord still completes via the `on_error` callback.
"""
from unittest.mock import AsyncMock, patch

import pytest
import sentry_sdk

from app.agents.content_audit import ContentAuditResult
from app.agents.llm_visibility import LLMVisibilityResult
from app.models import Job
from app.workers.tasks import orchestrator_task
from tests.integration.test_pipeline_happy import (
    _approve_plan_and_dispatch,
    _fake_plan,
    _find_sprint,
    _insert_orchestrator_job,
    _wait_for_sprint_terminal,
)


@pytest.mark.integration
def test_child_raises_raw_exception_chord_still_completes(
    db_session_sync, sample_workspace_sync, celery_worker, monkeypatch
):
    captured: list[BaseException] = []
    monkeypatch.setattr(sentry_sdk, "capture_exception", lambda e: captured.append(e))

    job_id = _insert_orchestrator_job(db_session_sync, sample_workspace_sync.id, "g")

    from app.workers import tasks as tmod

    original = tmod._child_body

    def leaky_child_body(agent_type, runner):
        if agent_type == "competitor":
            async def _leaky(_plan_id, _sprint_id):
                raise RuntimeError("no try/except here on purpose")
            return _leaky
        return original(agent_type, runner)

    monkeypatch.setattr(tmod, "_child_body", leaky_child_body)

    fake_audit = ContentAuditResult(pages_found=0, ranking_pages=[], missing_topics=[], summary="")
    fake_llm = LLMVisibilityResult(
        queries_tested=[], brand_mentioned=False, mention_count=0,
        competitor_mentions={}, sample_response="", note=""
    )

    with patch("app.agents.orchestrator.OrchestratorAgent._call_claude",
               AsyncMock(return_value=_fake_plan())), \
         patch("app.agents.keyword.KeywordAgent.run",
               AsyncMock(return_value=_fake_kw())), \
         patch("app.workers.tasks.ContentAuditAgent") as MockAudit, \
         patch("app.workers.tasks.LLMVisibilityAgent") as MockLLM:
        MockAudit.return_value.run = AsyncMock(return_value=fake_audit)
        MockLLM.return_value.run = AsyncMock(return_value=fake_llm)
        result = orchestrator_task.delay(job_id).get(timeout=30)
        plan_id = result["plan_id"]
        _approve_plan_and_dispatch(db_session_sync, job_id, plan_id, sample_workspace_sync.id)
        _wait_for_sprint_terminal(db_session_sync, job_id, timeout=30)

    sprint = _find_sprint(db_session_sync, job_id)
    assert sprint.status in {"complete_with_errors", "failed"}


def _fake_kw():
    from app.agents.keyword import KeywordResult
    return KeywordResult(keywords=[])
