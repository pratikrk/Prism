"""Celery tasks implementing the chord pipeline.

CONTRACT: every child task in the chord MUST ALWAYS RETURN a dict and never
raise past the task boundary. A raised exception would leave the chord stuck
forever. We catch `Exception` deliberately — bugs are still captured by Sentry
via `sentry_sdk.capture_exception`.
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Any

import sentry_sdk
from celery import chord, group
from celery.result import AsyncResult
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.competitor import CompetitorAgent, CompetitorInput
from app.agents.content_audit import ContentAuditAgent, ContentAuditInput
from app.agents.keyword import KeywordAgent, KeywordInput
from app.agents.llm_visibility import LLMVisibilityAgent, LLMVisibilityInput
from app.agents.orchestrator import OrchestratorAgent, OrchestratorInput, Plan
from app.agents.synthesis import SynthesisAgent, SynthesisInput
from app.core.config import settings
from app.core.db import SessionLocal
from app.core.errors import classify
from app.core.jobs import transition
from app.models import Job, Plan as PlanModel, StrategyBrief, Workspace
from app.workers.celery_app import celery_app


def _run(coro):
    return asyncio.run(coro)


@celery_app.task(bind=True, name="agents.orchestrator")
def orchestrator_task(self, job_id: str) -> dict:
    async def _body() -> dict:
        async with SessionLocal() as session:
            job = await _load_job(session, job_id)
            workspace = await session.get(Workspace, job.workspace_id)
            assert workspace is not None
            await transition(session, job, "running")
            await session.commit()

            try:
                goal = job.input.get("goal", "")
                feedback = job.input.get("feedback")
                full_goal = f"{goal}\n\nFeedback: {feedback}" if feedback else goal
                plan = await OrchestratorAgent().run(
                    OrchestratorInput(goal=full_goal, domain=workspace.domain)
                )
            except Exception as exc:
                err = classify(exc, provider="claude")
                sentry_sdk.capture_exception(exc)
                await transition(session, job, "failed", error=err)
                await session.commit()
                return {"ok": False, "error": err.to_json()}

            parent_plan_id_str = job.input.get("parent_plan_id")
            version = 1
            if parent_plan_id_str:
                parent = await session.get(PlanModel, uuid.UUID(parent_plan_id_str))
                if parent is not None:
                    version = parent.version + 1

            plan_row = PlanModel(
                job_id=job.id,
                workspace_id=job.workspace_id,
                intent=plan.intent,
                domain=plan.domain,
                competitors=plan.competitors,
                timeline_weeks=plan.timeline_weeks,
                sprint_order=plan.sprint_order,
                version=version,
                feedback=feedback,
                plan_status="draft",
                parent_plan_id=uuid.UUID(parent_plan_id_str) if parent_plan_id_str else None,
            )
            session.add(plan_row)
            await session.flush()
            await transition(
                session, job, "awaiting_gate0", result={"plan_id": str(plan_row.id)}
            )
            await session.commit()
            return {"ok": True, "plan_id": str(plan_row.id)}

    return _run(_body())


def _dispatch_chord(plan_id: str, sprint_job_id: str) -> AsyncResult:
    header = group(
        keyword_task.s(plan_id, sprint_job_id),
        competitor_task.s(plan_id, sprint_job_id),
        content_audit_task.s(plan_id, sprint_job_id),
        llm_visibility_task.s(plan_id, sprint_job_id),
    )
    callback = finalize_task.s(sprint_job_id)
    error_callback = finalize_error_task.s(sprint_job_id)
    return chord(header, body=callback).on_error(error_callback).apply_async()


def _child_body(agent_type: str, runner):
    async def _run_wrapper(plan_id: str, sprint_job_id: str) -> dict:
        async with SessionLocal() as session:
            child = Job(
                workspace_id=await _workspace_id_of_sprint(session, sprint_job_id),
                parent_job_id=uuid.UUID(sprint_job_id),
                type=agent_type,
                status="pending",
                input={"plan_id": plan_id},
            )
            session.add(child)
            await session.flush()
            child_id = str(child.id)
            await transition(session, child, "running")
            await session.commit()

            try:
                plan_row = await session.get(PlanModel, uuid.UUID(plan_id))
                assert plan_row is not None
                plan = Plan(
                    intent=plan_row.intent,
                    domain=plan_row.domain,
                    competitors=list(plan_row.competitors),
                    timeline_weeks=plan_row.timeline_weeks,
                    sprint_order=list(plan_row.sprint_order),
                )
                result = await runner(plan)
                await transition(session, child, "complete", result=_to_json(result))
                await session.commit()
                return {"child_job_id": child_id, "type": agent_type, "ok": True}
            except Exception as exc:
                err = classify(exc, provider=agent_type)
                sentry_sdk.capture_exception(exc)
                await transition(session, child, "failed", error=err)
                await session.commit()
                return {
                    "child_job_id": child_id,
                    "type": agent_type,
                    "ok": False,
                    "error": err.to_json(),
                }

    return _run_wrapper


async def _keyword_runner(plan: Plan):
    return await KeywordAgent().run(KeywordInput(plan=plan))


async def _competitor_runner(plan: Plan):
    return await CompetitorAgent().run(
        CompetitorInput(domain=plan.domain, competitors=plan.competitors, intent=plan.intent)
    )


async def _content_audit_runner(plan: Plan):
    return await ContentAuditAgent().run(
        ContentAuditInput(domain=plan.domain, intent=plan.intent)
    )


async def _llm_visibility_runner(plan: Plan):
    return await LLMVisibilityAgent().run(
        LLMVisibilityInput(
            domain=plan.domain, intent=plan.intent, competitors=plan.competitors
        )
    )


@celery_app.task(bind=True, name="agents.keyword")
def keyword_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("keyword", _keyword_runner)(plan_id, sprint_job_id))


@celery_app.task(bind=True, name="agents.competitor")
def competitor_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("competitor", _competitor_runner)(plan_id, sprint_job_id))


@celery_app.task(bind=True, name="agents.content_audit")
def content_audit_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("content_audit", _content_audit_runner)(plan_id, sprint_job_id))


@celery_app.task(bind=True, name="agents.llm_visibility")
def llm_visibility_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("llm_visibility", _llm_visibility_runner)(plan_id, sprint_job_id))


@celery_app.task(name="agents.finalize")
def finalize_task(child_results: list[dict], sprint_job_id: str) -> dict:
    async def _body() -> dict:
        async with SessionLocal() as session:
            sprint = await session.get(Job, uuid.UUID(sprint_job_id))
            if sprint is None or sprint.status != "running":
                return {"ok": False, "reason": "sprint missing or not running"}
            all_ok = all(r.get("ok") for r in child_results)
            if not all_ok:
                await transition(
                    session,
                    sprint,
                    "complete_with_errors",
                    result={"children": child_results, "errors": True},
                )
                await session.commit()
                return {"ok": False, "status": "complete_with_errors"}
            # All children ok — fire synthesis, leave sprint running
            await session.commit()
        synthesis_task.delay(sprint_job_id)
        return {"ok": True, "status": "synthesis_dispatched"}

    try:
        return _run(_body())
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        return {"ok": False, "reason": f"finalize bug: {exc!r}"}


@celery_app.task(name="agents.synthesis")
def synthesis_task(sprint_job_id: str) -> dict:
    async def _body() -> dict:
        async with SessionLocal() as session:
            sprint = await session.get(Job, uuid.UUID(sprint_job_id))
            if sprint is None:
                return {"ok": False, "reason": "sprint not found"}

            plan_id_str = sprint.input.get("plan_id")
            if not plan_id_str:
                return {"ok": False, "reason": "sprint has no plan_id in input"}

            plan_row = await session.get(PlanModel, uuid.UUID(plan_id_str))
            if plan_row is None:
                return {"ok": False, "reason": "plan not found"}

            try:
                child_results = await _get_child_results(session, sprint.id)
                result = await SynthesisAgent().run(
                    SynthesisInput(
                        plan_id=plan_id_str,
                        domain=plan_row.domain,
                        intent=plan_row.intent,
                        keyword_result=child_results.get("keyword", {}),
                        competitor_result=child_results.get("competitor", {}),
                        content_audit_result=child_results.get("content_audit", {}),
                        llm_visibility_result=child_results.get("llm_visibility", {}),
                    )
                )
            except Exception as exc:
                err = classify(exc, provider="claude")
                sentry_sdk.capture_exception(exc)
                return {"ok": False, "error": err.to_json()}

            brief = StrategyBrief(
                workspace_id=sprint.workspace_id,
                plan_id=uuid.UUID(plan_id_str),
                sprint_job_id=sprint.id,
                clusters=_to_json(result)["clusters"],
                executive_summary=_to_json(result)["executive_summary"],
                share_token=str(uuid.uuid4()),
                status="draft",
            )
            session.add(brief)
            await session.flush()
            brief_id = str(brief.id)

            await transition(
                session, sprint, "awaiting_gate1", result={"brief_id": brief_id}
            )
            await session.commit()
            return {"ok": True, "brief_id": brief_id}

    try:
        return _run(_body())
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        return {"ok": False, "reason": f"synthesis bug: {exc!r}"}


@celery_app.task(name="agents.finalize_error")
def finalize_error_task(request_context: Any, sprint_job_id: str) -> dict:
    async def _body() -> dict:
        async with SessionLocal() as session:
            sprint = await session.get(Job, uuid.UUID(sprint_job_id))
            if sprint is None or sprint.status != "running":
                return {"ok": False, "reason": "sprint missing or not running"}
            await transition(
                session,
                sprint,
                "complete_with_errors",
                result={"error_callback_fired": True, "context": str(request_context)[:500]},
            )
            await session.commit()
            return {"ok": True, "status": "complete_with_errors"}

    try:
        return _run(_body())
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        return {"ok": False, "reason": "finalize_error bug"}


async def _get_child_results(session: AsyncSession, sprint_id: uuid.UUID) -> dict[str, dict]:
    """Load each child job's result dict, keyed by job type."""
    result = await session.execute(
        select(Job).where(Job.parent_job_id == sprint_id)
    )
    children = result.scalars().all()
    return {
        child.type: child.result or {}
        for child in children
        if child.status == "complete"
    }


async def _load_job(session: AsyncSession, job_id: str) -> Job:
    job = await session.get(Job, uuid.UUID(job_id))
    if job is None:
        raise RuntimeError(f"job {job_id} not found")
    return job


async def _workspace_id_of_sprint(session: AsyncSession, sprint_job_id: str) -> uuid.UUID:
    row = await session.execute(
        select(Job.workspace_id).where(Job.id == uuid.UUID(sprint_job_id))
    )
    workspace_id = row.scalar_one()
    assert isinstance(workspace_id, uuid.UUID)
    return workspace_id


def _to_json(obj: Any) -> dict:
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    return dict(obj) if isinstance(obj, dict) else {"value": str(obj)}
