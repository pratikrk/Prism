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


@pytest.mark.asyncio
async def test_running_to_awaiting_gate0(db_session, sample_job):
    job = await sample_job(status="running", type="orchestrator")
    result = await transition(db_session, job, "awaiting_gate0")
    assert result.status == "awaiting_gate0"


@pytest.mark.asyncio
async def test_awaiting_gate0_to_complete(db_session, sample_job):
    job = await sample_job(status="awaiting_gate0", type="orchestrator")
    result = await transition(db_session, job, "complete")
    assert result.status == "complete"


@pytest.mark.asyncio
async def test_awaiting_gate0_illegal_to_running(db_session, sample_job):
    job = await sample_job(status="awaiting_gate0", type="orchestrator")
    with pytest.raises(IllegalTransition):
        await transition(db_session, job, "running")


@pytest.mark.asyncio
async def test_running_to_awaiting_gate1(db_session, sample_job):
    job = await sample_job(status="running", type="sprint")
    result = await transition(db_session, job, "awaiting_gate1")
    assert result.status == "awaiting_gate1"


@pytest.mark.asyncio
async def test_awaiting_gate1_to_complete(db_session, sample_job):
    job = await sample_job(status="awaiting_gate1", type="sprint")
    result = await transition(db_session, job, "complete")
    assert result.status == "complete"


@pytest.mark.asyncio
async def test_awaiting_gate1_illegal_on_non_sprint(db_session, sample_job):
    job = await sample_job(status="running", type="keyword")
    with pytest.raises(IllegalTransition):
        await transition(db_session, job, "awaiting_gate1")
