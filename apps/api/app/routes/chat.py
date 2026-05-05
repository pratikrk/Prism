from __future__ import annotations

import uuid

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.intent_router import IntentRouterAgent, RouterInput
from app.auth.clerk import ClerkPrincipal, current_user
from app.core.db import get_session
from app.models import AuditResult, Job, Plan as PlanModel, Workspace

router = APIRouter(tags=["chat"])


class ChatIn(pydantic.BaseModel):
    message: str = pydantic.Field(min_length=1, max_length=2000)


class ChatOut(pydantic.BaseModel):
    intent: str
    dispatched: bool
    answer: str | None = None  # set for question/unknown intents


@router.post(
    "/workspaces/{workspace_id}/chat",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ChatOut,
)
async def chat(
    workspace_id: uuid.UUID,
    body: ChatIn,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    w = await session.get(Workspace, workspace_id)
    if w is None or w.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "workspace not found")

    # Build context for router
    has_audit = (
        await session.execute(
            select(AuditResult.id).where(AuditResult.workspace_id == workspace_id)
        )
    ).scalar_one_or_none() is not None

    has_plan = (
        await session.execute(
            select(PlanModel.id).where(PlanModel.workspace_id == workspace_id)
        )
    ).scalar_one_or_none() is not None

    decision = await IntentRouterAgent().run(
        RouterInput(
            message=body.message,
            workspace_context={
                "domain": w.domain,
                "has_audit": has_audit,
                "has_plan": has_plan,
            },
        )
    )

    # Dispatch based on intent
    if decision.intent == "goal_setting":
        # Check no job already in-flight (same guard as submit_job)
        active = await session.execute(
            select(Job).where(
                Job.workspace_id == workspace_id,
                Job.type == "orchestrator",
                Job.status.in_(("pending", "running")),
            )
        )
        if active.scalar_one_or_none() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "a job is already in-flight")

        from app.workers.tasks import orchestrator_task
        job = Job(
            workspace_id=workspace_id,
            type="orchestrator",
            status="pending",
            input={"goal": body.message},
        )
        session.add(job)
        await session.commit()
        await session.refresh(job)
        orchestrator_task.delay(str(job.id))
        return {"intent": "goal_setting", "dispatched": True}

    if decision.intent == "audit":
        from app.workers.tasks import quick_audit_task
        quick_audit_task.delay(str(workspace_id))
        return {"intent": "audit", "dispatched": True}

    if decision.intent == "question":
        # Answer from stored audit data
        answer = "I don't have enough data yet."
        if has_audit:
            audit_row = await session.execute(
                select(AuditResult).where(AuditResult.workspace_id == workspace_id)
            )
            audit = audit_row.scalar_one_or_none()
            if audit:
                items = audit.result.get("action_items", [])
                top = items[0] if items else None
                score = audit.result.get("score", {})
                answer = (
                    f"Your site health is {score.get('overall', '?')}/100. "
                    + (f"Biggest issue: {top['title']}." if top else "No critical issues found.")
                )
        return {"intent": "question", "dispatched": False, "answer": answer}

    # keyword, competitor, unknown — not yet wired to live agents
    fallback = (
        decision.fallback_message
        or "I can handle that in a sprint. Try: \"I want 10k visitors/month\" to start a full analysis."
    )
    return {"intent": decision.intent, "dispatched": False, "answer": fallback}
