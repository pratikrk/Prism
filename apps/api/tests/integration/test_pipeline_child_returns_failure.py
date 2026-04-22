from unittest.mock import AsyncMock, patch

import pytest

from app.integrations.dataforseo import KeywordRow
from app.models import Job
from app.workers.tasks import orchestrator_task
from tests.integration.test_pipeline_happy import (
    _fake_plan,
    _find_children,
    _find_sprint,
    _insert_orchestrator_job,
    _wait_for_sprint_terminal,
)


@pytest.mark.integration
def test_child_returns_failure_sentinel_sprint_complete_with_errors(
    db_session_sync, sample_workspace_sync, celery_worker
):
    job_id = _insert_orchestrator_job(db_session_sync, sample_workspace_sync.id, "g")

    async def _raising(_inp):
        raise RuntimeError("simulated competitor failure")

    with patch("app.agents.orchestrator.OrchestratorAgent._call_claude",
               AsyncMock(return_value=_fake_plan())), \
         patch("app.agents.keyword.KeywordAgent.run",
               AsyncMock(return_value=_fake_keyword())), \
         patch("app.agents.stubs.CompetitorStub.run", _raising):
        orchestrator_task.delay(job_id).get(timeout=30)
        _wait_for_sprint_terminal(db_session_sync, job_id, timeout=30)

    sprint = _find_sprint(db_session_sync, job_id)
    assert sprint.status == "complete_with_errors"
    children = {c.type: c for c in _find_children(db_session_sync, sprint.id)}
    assert children["competitor"].status == "failed"
    assert children["competitor"].error["kind"] == "bug"
    assert children["keyword"].status == "complete"
    assert children["content_audit"].status == "complete"
    assert children["llm_visibility"].status == "complete"


def _fake_keyword():
    from app.agents.keyword import KeywordResult
    return KeywordResult(keywords=[])
