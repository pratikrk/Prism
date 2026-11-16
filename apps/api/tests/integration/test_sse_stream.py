"""Verify NOTIFY payloads reach SSE subscribers."""
import asyncio
import json
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models import Job, User, Workspace


def _factory():
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_notify_reaches_sse_subscriber():
    factory = _factory()

    uid = f"sse_{uuid.uuid4().hex[:8]}"
    async with factory() as session:
        user = User(id=uid, email=f"{uid}@test.io", name="T")
        ws = Workspace(user_id=uid, name="sse-ws", domain=f"{uid}.test")
        session.add(user)
        session.add(ws)
        await session.flush()
        ws_id = ws.id
        await session.commit()

    async with factory() as session:
        job = Job(workspace_id=ws_id, type="orchestrator", status="pending", input={})
        session.add(job)
        await session.flush()
        job_id = job.id
        await session.commit()

    from app.core.events import listen_job_events
    events: list[dict] = []

    async def consume():
        async for e in listen_job_events():
            if str(e.get("job_id")) == str(job_id):
                events.append(e)
                return

    consumer_task = asyncio.create_task(consume())
    await asyncio.sleep(0.5)

    async with factory() as session:
        await session.execute(
            text("UPDATE jobs SET status='running' WHERE id = :id").bindparams(id=job_id)
        )
        # create_all skips the notify trigger; fire pg_notify directly
        await session.execute(
            text("SELECT pg_notify('job_events', :payload)").bindparams(
                payload=json.dumps({"job_id": str(job_id), "status": "running"})
            )
        )
        await session.commit()

    await asyncio.wait_for(consumer_task, timeout=5)
    assert events[0]["status"] == "running"
    assert uuid.UUID(events[0]["job_id"]) == job_id
