import pytest

from app.core.errors import JobError, ErrorKind
from app.core.jobs import IllegalTransition, transition


@pytest.mark.asyncio
async def test_pending_to_running_records_started_at(db_session, sample_job):
    job = await sample_job(status="pending")
    await transition(db_session, job, "running")
    assert job.status == "running"
    assert job.started_at is not None
    assert job.completed_at is None


@pytest.mark.asyncio
async def test_running_to_complete_records_completed_at(db_session, sample_job):
    job = await sample_job(status="running")
    await transition(db_session, job, "complete", result={"x": 1})
    assert job.status == "complete"
    assert job.completed_at is not None
    assert job.result == {"x": 1}


@pytest.mark.asyncio
async def test_running_to_failed_records_error(db_session, sample_job):
    job = await sample_job(status="running")
    err = JobError(kind=ErrorKind.RATE_LIMIT, message="rl", retryable=True, provider="claude")
    await transition(db_session, job, "failed", error=err)
    assert job.status == "failed"
    assert job.error == err.to_json()


@pytest.mark.asyncio
async def test_illegal_transition_raises(db_session, sample_job):
    job = await sample_job(status="complete")
    with pytest.raises(IllegalTransition):
        await transition(db_session, job, "running")


@pytest.mark.asyncio
async def test_complete_with_errors_only_on_sprint(db_session, sample_job):
    job = await sample_job(status="running", type="keyword")
    with pytest.raises(IllegalTransition):
        await transition(db_session, job, "complete_with_errors")

    sprint = await sample_job(status="running", type="sprint")
    await transition(db_session, sprint, "complete_with_errors")
    assert sprint.status == "complete_with_errors"
