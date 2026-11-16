from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import ClerkPrincipal, current_user
from app.core.db import get_session
from app.models import AuditResult, Job, Plan as PlanModel, StrategyBrief, User, Workspace

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
    # Fire audit in background — non-blocking
    from app.workers.tasks import quick_audit_task
    quick_audit_task.delay(str(w.id))
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
    traffic_target: int | None = None
    feasibility_note: str | None = None
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
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    model_config = pydantic.ConfigDict(from_attributes=True)


class ThreadPlanItem(pydantic.BaseModel):
    type: Literal["plan"] = "plan"
    plan: _PlanOut
    job_status: str


class ThreadResearchSectionItem(pydantic.BaseModel):
    type: Literal["section"] = "section"
    section_type: str    # keyword | competitor | content_audit | llm_visibility
    job_id: uuid.UUID
    job_status: str
    result: dict | None


class ThreadBriefItem(pydantic.BaseModel):
    type: Literal["brief"] = "brief"
    brief_id: uuid.UUID
    sprint_job_id: uuid.UUID
    job_status: str
    clusters: list
    executive_summary: list
    share_token: str | None
    brief_status: str


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


class ThreadAuditItem(pydantic.BaseModel):
    type: Literal["audit"] = "audit"
    result: dict
    created_at: str


_SECTION_TYPES = {"keyword", "competitor", "content_audit", "llm_visibility"}


@router.get("/{workspace_id}/thread", response_model=list[Any])
async def get_workspace_thread(
    workspace_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    w = await session.get(Workspace, workspace_id)
    if w is None or w.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "workspace not found")

    # Audit result (prepended before goal items — it's Prism's first message)
    audit_row = await session.execute(
        select(AuditResult).where(AuditResult.workspace_id == workspace_id)
    )
    audit = audit_row.scalar_one_or_none()

    # Load all orchestrator jobs for this workspace ordered by time
    result = await session.execute(
        select(Job)
        .where(Job.workspace_id == workspace_id, Job.type == "orchestrator")
        .order_by(Job.created_at)
    )
    orch_jobs = list(result.scalars())
    if not orch_jobs:
        # Return audit item even when no goal has been set yet
        if audit:
            return [ThreadAuditItem(
                type="audit",
                result=audit.result,
                created_at=audit.created_at.isoformat(),
            ).model_dump()]
        return []

    orch_ids = [j.id for j in orch_jobs]

    # Plans keyed by orchestrator job id
    result = await session.execute(
        select(PlanModel).where(PlanModel.job_id.in_(orch_ids))
    )
    plan_by_job: dict[uuid.UUID, PlanModel] = {p.job_id: p for p in result.scalars()}

    # Sprint jobs keyed by parent (orchestrator) id
    result = await session.execute(
        select(Job).where(Job.parent_job_id.in_(orch_ids), Job.type == "sprint")
    )
    sprint_by_parent: dict[uuid.UUID, Job] = {s.parent_job_id: s for s in result.scalars()}

    sprint_ids = [s.id for s in sprint_by_parent.values()]

    # Child agent jobs keyed by sprint id
    children_by_sprint: dict[uuid.UUID, list[Job]] = {}
    if sprint_ids:
        result = await session.execute(
            select(Job).where(Job.parent_job_id.in_(sprint_ids)).order_by(Job.created_at)
        )
        for child in result.scalars():
            children_by_sprint.setdefault(child.parent_job_id, []).append(child)

    # Strategy briefs keyed by sprint job id
    brief_by_sprint: dict[uuid.UUID, StrategyBrief] = {}
    if sprint_ids:
        result = await session.execute(
            select(StrategyBrief).where(StrategyBrief.sprint_job_id.in_(sprint_ids))
        )
        for brief in result.scalars():
            brief_by_sprint[brief.sprint_job_id] = brief

    items: list = []
    if audit:
        items.append(ThreadAuditItem(
            type="audit",
            result=audit.result,
            created_at=audit.created_at.isoformat(),
        ).model_dump())
    for orch in orch_jobs:
        # Goal bubble
        items.append(ThreadGoalItem(
            type="goal",
            job_id=orch.id,
            goal=orch.input.get("goal", ""),
            feedback=orch.input.get("feedback"),
            job_status=orch.status,
            created_at=orch.created_at.isoformat(),
        ).model_dump())

        # Plan card or error
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

        # Sprint block: live job board + brief card
        sprint = sprint_by_parent.get(orch.id)
        if sprint:
            children = children_by_sprint.get(sprint.id, [])
            items.append(ThreadJobsItem(
                type="jobs",
                sprint_job_id=sprint.id,
                sprint_status=sprint.status,
                children=[_JobOut.model_validate(c) for c in children],
            ).model_dump())

            # Brief card (after synthesis)
            brief = brief_by_sprint.get(sprint.id)
            if brief:
                # Only surface share_token after approval
                share_token = brief.share_token if brief.status == "approved" else None
                items.append(ThreadBriefItem(
                    type="brief",
                    brief_id=brief.id,
                    sprint_job_id=sprint.id,
                    job_status=sprint.status,
                    clusters=brief.clusters,
                    executive_summary=brief.executive_summary,
                    share_token=share_token,
                    brief_status=brief.status,
                ).model_dump())

    return items
