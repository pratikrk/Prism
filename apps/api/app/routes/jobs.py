from __future__ import annotations

import asyncio
import json
import uuid

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import ClerkPrincipal, current_user
from app.core.db import get_session
from app.core.events import listen_job_events
from app.models import Job, Workspace
from app.workers.tasks import (
    competitor_task,
    content_audit_task,
    keyword_task,
    llm_visibility_task,
    orchestrator_task,
)

router = APIRouter(tags=["jobs"])


class JobSubmitIn(pydantic.BaseModel):
    goal: str = pydantic.Field(min_length=10, max_length=2000)


class JobOut(pydantic.BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    parent_job_id: uuid.UUID | None
    type: str
    status: str
    input: dict
    result: dict | None
    error: dict | None

    model_config = pydantic.ConfigDict(from_attributes=True)


async def _ensure_owns_workspace(
    session: AsyncSession, principal: ClerkPrincipal, workspace_id: uuid.UUID
) -> Workspace:
    w = await session.get(Workspace, workspace_id)
    if w is None or w.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "workspace not found")
    return w


@router.post(
    "/workspaces/{workspace_id}/jobs",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=JobOut,
)
async def submit_job(
    workspace_id: uuid.UUID,
    body: JobSubmitIn,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Job:
    w = await _ensure_owns_workspace(session, principal, workspace_id)
    active = await session.execute(
        select(Job).where(
            Job.workspace_id == w.id,
            Job.type == "orchestrator",
            Job.status.in_(("pending", "running")),
        )
    )
    if active.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "a job is already in-flight")
    job = Job(
        workspace_id=w.id,
        type="orchestrator",
        status="pending",
        input={"goal": body.goal},
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)

    orchestrator_task.delay(str(job.id))
    return job


@router.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(
    job_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Job:
    job = await session.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await _ensure_owns_workspace(session, principal, job.workspace_id)
    return job


@router.get("/workspaces/{workspace_id}/jobs", response_model=list[JobOut])
async def list_workspace_jobs(
    workspace_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[Job]:
    await _ensure_owns_workspace(session, principal, workspace_id)
    r = await session.execute(
        select(Job).where(Job.workspace_id == workspace_id).order_by(Job.created_at.desc())
    )
    return list(r.scalars().all())


@router.get("/jobs/{job_id}/events")
async def stream_events(
    job_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    job = await session.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await _ensure_owns_workspace(session, principal, job.workspace_id)
    workspace_id = job.workspace_id

    async def _gen():
        async for payload in listen_job_events():
            if str(payload.get("workspace_id")) == str(workspace_id):
                yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(_gen(), media_type="text/event-stream")


_RETRY_MAP = {
    "keyword": keyword_task,
    "competitor": competitor_task,
    "content_audit": content_audit_task,
    "llm_visibility": llm_visibility_task,
}


@router.post("/jobs/{job_id}/retry", response_model=JobOut)
async def retry_job(
    job_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Job:
    job = await session.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await _ensure_owns_workspace(session, principal, job.workspace_id)
    if job.status != "failed":
        raise HTTPException(status.HTTP_409_CONFLICT, "only failed jobs can be retried")
    err = job.error or {}
    if not err.get("retryable"):
        raise HTTPException(status.HTTP_409_CONFLICT, "error is not retryable")
    task = _RETRY_MAP.get(job.type)
    if task is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"cannot retry job type {job.type!r}")

    plan_id = job.input.get("plan_id")
    sprint_id = str(job.parent_job_id) if job.parent_job_id else None
    if not plan_id or not sprint_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "job is missing plan or sprint context")
    task.delay(plan_id, sprint_id)
    return job
