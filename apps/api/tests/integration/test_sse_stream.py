"""Verify NOTIFY payloads reach SSE subscribers."""
import asyncio
import json
import uuid

import httpx
import pytest
from sqlalchemy import text

from app.models import Job


@pytest.mark.integration
@pytest.mark.asyncio
async def test_notify_reaches_sse_subscriber(db_session, sample_workspace):
    job = Job(workspace_id=sample_workspace.id, type="orchestrator", status="pending", input={})
    db_session.add(job)
    await db_session.flush()
    await db_session.commit()

    from app.core.events import listen_job_events
    events: list[dict] = []

    async def consume():
        async for e in listen_job_events():
            events.append(e)
            if len(events) >= 1:
                return

    consumer_task = asyncio.create_task(consume())
    await asyncio.sleep(0.5)

    await db_session.execute(
        text("UPDATE jobs SET status='running' WHERE id = :id").bindparams(id=job.id)
    )
    await db_session.commit()

    await asyncio.wait_for(consumer_task, timeout=5)
    assert events[0]["status"] == "running"
    assert uuid.UUID(events[0]["job_id"]) == job.id
