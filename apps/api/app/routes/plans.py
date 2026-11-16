from __future__ import annotations

import uuid
from typing import Annotated

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import ClerkPrincipal, current_user
from app.core.db import get_session
from app.core.jobs import transition
from app.models import Job, Plan as PlanModel, Workspace
from app.workers.tasks import _dispatch_chord, orchestrator_task

router = APIRouter(prefix="/plans", tags=["plans"])


class PlanOut(pydantic.BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    workspace_id: uuid.UUID
    intent: str
    domain: str
    competitors: list[str]
    timeline_weeks: int
    sprint_order: list[str]
    version: int
    feedback: str | None
    plan_status: str
    parent_plan_id: uuid.UUID | None

    model_config = pydantic.ConfigDict(from_attributes=True)


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


class PlanPatchIn(pydantic.BaseModel):
    intent: str | None = None
    competitors: Annotated[list[str] | None, pydantic.Field(None, max_length=10)] = None
    timeline_weeks: Annotated[int | None, pydantic.Field(None, ge=1, le=52)] = None


class PlanRefineIn(pydantic.BaseModel):
    feedback: str = pydantic.Field(min_length=1, max_length=2000)


async def _load_plan(
    session: AsyncSession, principal: ClerkPrincipal, plan_id: uuid.UUID
) -> PlanModel:
    plan = await session.get(PlanModel, plan_id)
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "plan not found")
    ws = await session.get(Workspace, plan.workspace_id)
    if ws is None or ws.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "plan not found")
    return plan


async def _assert_no_active_orchestrator(
    session: AsyncSession, workspace_id: uuid.UUID
) -> None:
    active = await session.execute(
        select(Job).where(
            Job.workspace_id == workspace_id,
            Job.type == "orchestrator",
            Job.status.in_(("pending", "running")),
        )
    )
    if active.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "another orchestrator is in-flight")


@router.patch("/{plan_id}", response_model=PlanOut)
async def patch_plan(
    plan_id: uuid.UUID,
    body: PlanPatchIn,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> PlanModel:
    plan = await _load_plan(session, principal, plan_id)
    if plan.plan_status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "only draft plans can be edited")
    if body.intent is not None:
        plan.intent = body.intent
    if body.competitors is not None:
        plan.competitors = body.competitors
    if body.timeline_weeks is not None:
        plan.timeline_weeks = body.timeline_weeks
    await session.commit()
    await session.refresh(plan)
    return plan


@router.post("/{plan_id}/approve", response_model=JobOut)
async def approve_plan(
    plan_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Job:
    plan = await _load_plan(session, principal, plan_id)
    if plan.plan_status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "plan is not in draft state")

    orch_job = await session.get(Job, plan.job_id)
    if orch_job is None or orch_job.status != "awaiting_gate0":
        raise HTTPException(status.HTTP_409_CONFLICT, "orchestrator is not awaiting gate-0")

    await _assert_no_active_orchestrator(session, plan.workspace_id)

    await transition(session, orch_job, "complete")
    plan.plan_status = "approved"

    sprint = Job(
        workspace_id=plan.workspace_id,
        parent_job_id=orch_job.id,
        type="sprint",
        status="running",
        input={"plan_id": str(plan.id)},
    )
    session.add(sprint)
    await session.flush()
    await session.commit()

    _dispatch_chord(str(plan.id), str(sprint.id))
    return sprint


@router.post("/{plan_id}/refine", response_model=JobOut)
async def refine_plan(
    plan_id: uuid.UUID,
    body: PlanRefineIn,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Job:
    plan = await _load_plan(session, principal, plan_id)
    if plan.plan_status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "plan is not in draft state")

    await _assert_no_active_orchestrator(session, plan.workspace_id)

    orch_job = await session.get(Job, plan.job_id)
    original_goal = orch_job.input.get("goal", "") if orch_job else ""

    plan.plan_status = "superseded"
    if orch_job and orch_job.status == "awaiting_gate0":
        await transition(session, orch_job, "complete")

    new_job = Job(
        workspace_id=plan.workspace_id,
        type="orchestrator",
        status="pending",
        input={
            "goal": original_goal,
            "feedback": body.feedback,
            "parent_plan_id": str(plan.id),
        },
    )
    session.add(new_job)
    await session.commit()
    await session.refresh(new_job)

    orchestrator_task.delay(str(new_job.id))
    return new_job
