from __future__ import annotations

import uuid
from typing import Any, Literal

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import ClerkPrincipal, current_user
from app.core.db import get_session
from app.models import Job, Plan as PlanModel, User, Workspace

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class WorkspaceIn(pydantic.BaseModel):
    name: str
    domain: str


class WorkspaceOut(pydantic.BaseModel):
    id: uuid.UUID
    name: str
    domain: str
    user_id: str
    org_id: str | None

    model_config = pydantic.ConfigDict(from_attributes=True)


async def _ensure_user(session: AsyncSession, principal: ClerkPrincipal) -> None:
    """Upsert user row from JWT claims. Webhook keeps it up-to-date in prod;
    this covers local dev where Clerk can't POST to localhost."""
    stmt = (
        pg_insert(User)
        .values(id=principal.user_id, email=f"{principal.user_id}@clerk.local", name="")
        .on_conflict_do_nothing(index_elements=["id"])
    )
    await session.execute(stmt)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=WorkspaceOut)
async def create_workspace(
    body: WorkspaceIn,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Workspace:
    await _ensure_user(session, principal)
    w = Workspace(
        user_id=principal.user_id,
        org_id=principal.org_id,
        name=body.name,
        domain=body.domain.strip().lower(),
    )
    session.add(w)
    await session.commit()
    await session.refresh(w)
    return w


@router.get("", response_model=list[WorkspaceOut])
async def list_workspaces(
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[Workspace]:
    result = await session.execute(select(Workspace).where(Workspace.user_id == principal.user_id))
    return list(result.scalars().all())


@router.get("/{workspace_id}", response_model=WorkspaceOut)
async def get_workspace(
    workspace_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Workspace:
    w = await session.get(Workspace, workspace_id)
    if w is None or w.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "workspace not found")
    return w


# ── Thread endpoint ────────────────────────────────────────────────────────────

class ThreadGoalItem(pydantic.BaseModel):
    type: Literal["goal"] = "goal"
    job_id: uuid.UUID
    goal: str
    feedback: str | None
    job_status: str
    created_at: str


class _PlanOut(pydantic.BaseModel):
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


class _JobOut(pydantic.BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    parent_job_id: uuid.UUID | None
    type: str
    status: str
    input: dict
    result: dict | None
    error: dict | None
    model_config = pydantic.ConfigDict(from_attributes=True)


class ThreadPlanItem(pydantic.BaseModel):
    type: Literal["plan"] = "plan"
    plan: _PlanOut
    job_status: str


class ThreadJobsItem(pydantic.BaseModel):
    type: Literal["jobs"] = "jobs"
    sprint_job_id: uuid.UUID
    sprint_status: str
    children: list[_JobOut]


class ThreadErrorItem(pydantic.BaseModel):
    type: Literal["error"] = "error"
    job_id: uuid.UUID
    error: dict
    created_at: str


@router.get("/{workspace_id}/thread", response_model=list[Any])
async def get_workspace_thread(
    workspace_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    w = await session.get(Workspace, workspace_id)
    if w is None or w.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "workspace not found")

    result = await session.execute(
        select(Job)
        .where(Job.workspace_id == workspace_id, Job.type == "orchestrator")
        .order_by(Job.created_at)
    )
    orch_jobs = list(result.scalars())
    if not orch_jobs:
        return []

    orch_ids = [j.id for j in orch_jobs]

    result = await session.execute(
        select(PlanModel).where(PlanModel.job_id.in_(orch_ids))
    )
    plan_by_job: dict[uuid.UUID, PlanModel] = {p.job_id: p for p in result.scalars()}

    result = await session.execute(
        select(Job).where(Job.parent_job_id.in_(orch_ids), Job.type == "sprint")
    )
    sprint_by_parent: dict[uuid.UUID, Job] = {s.parent_job_id: s for s in result.scalars()}

    children_by_sprint: dict[uuid.UUID, list[Job]] = {}
    sprint_ids = [s.id for s in sprint_by_parent.values()]
    if sprint_ids:
        result = await session.execute(
            select(Job).where(Job.parent_job_id.in_(sprint_ids))
        )
        for child in result.scalars():
            children_by_sprint.setdefault(child.parent_job_id, []).append(child)

    items: list = []
    for orch in orch_jobs:
        items.append(ThreadGoalItem(
            type="goal",
            job_id=orch.id,
            goal=orch.input.get("goal", ""),
            feedback=orch.input.get("feedback"),
            job_status=orch.status,
            created_at=orch.created_at.isoformat(),
        ).model_dump())

        plan = plan_by_job.get(orch.id)
        if plan:
            items.append(ThreadPlanItem(
                type="plan",
                plan=_PlanOut.model_validate(plan),
                job_status=orch.status,
            ).model_dump())
        elif orch.status == "failed":
            items.append(ThreadErrorItem(
                type="error",
                job_id=orch.id,
                error=orch.error or {},
                created_at=orch.created_at.isoformat(),
            ).model_dump())

        sprint = sprint_by_parent.get(orch.id)
        if sprint:
            children = children_by_sprint.get(sprint.id, [])
            items.append(ThreadJobsItem(
                type="jobs",
                sprint_job_id=sprint.id,
                sprint_status=sprint.status,
                children=[_JobOut.model_validate(c) for c in children],
            ).model_dump())

    return items
