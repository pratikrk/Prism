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
from celery.exceptions import SoftTimeLimitExceeded
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
    async def _wrapped():
        # Each asyncio.run() creates a new event loop, so pool connections from the
        # previous run are stale. Dispose without closing so new connections are made
        # fresh in this event loop.
        from app.core.db import _engine
        await _engine.dispose(close=False)
        return await coro
    return asyncio.run(_wrapped())


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
                traffic_target=plan.traffic_target,
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
    # Stagger by 8s each to avoid simultaneous Claude API calls hitting rate limits
    header = group(
        keyword_task.s(plan_id, sprint_job_id).set(countdown=0),
        competitor_task.s(plan_id, sprint_job_id).set(countdown=8),
        content_audit_task.s(plan_id, sprint_job_id).set(countdown=16),
        llm_visibility_task.s(plan_id, sprint_job_id).set(countdown=24),
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
                    traffic_target=plan_row.traffic_target,
                )
                result = await runner(plan)
                await transition(session, child, "complete", result=_to_json(result))
                await session.commit()
                return {"child_job_id": child_id, "type": agent_type, "ok": True}
            except SoftTimeLimitExceeded as exc:
                # Explicit handler so Celery's time limit propagates correctly
                # instead of being silently swallowed by the generic except.
                err = classify(exc, provider=agent_type)
                await transition(session, child, "failed", error=err)
                await session.commit()
                return {
                    "child_job_id": child_id,
                    "type": agent_type,
                    "ok": False,
                    "error": err.to_json(),
                }
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


@celery_app.task(bind=True, name="agents.keyword", soft_time_limit=150, time_limit=180)
def keyword_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("keyword", _keyword_runner)(plan_id, sprint_job_id))


@celery_app.task(bind=True, name="agents.competitor", soft_time_limit=150, time_limit=180)
def competitor_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("competitor", _competitor_runner)(plan_id, sprint_job_id))


@celery_app.task(bind=True, name="agents.content_audit", soft_time_limit=150, time_limit=180)
def content_audit_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("content_audit", _content_audit_runner)(plan_id, sprint_job_id))


@celery_app.task(bind=True, name="agents.llm_visibility", soft_time_limit=150, time_limit=180)
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
        # link_error ensures the sprint is marked complete_with_errors even on hard kill
        synthesis_task.apply_async(
            args=[sprint_job_id],
            link_error=[finalize_error_task.s(sprint_job_id)],
        )
        return {"ok": True, "status": "synthesis_dispatched"}

    try:
        return _run(_body())
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        return {"ok": False, "reason": f"finalize bug: {exc!r}"}


@celery_app.task(name="agents.synthesis", soft_time_limit=240, time_limit=300)
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
                        traffic_target=plan_row.traffic_target,
                        keyword_result=_trim_for_synthesis(child_results.get("keyword", {})),
                        competitor_result=child_results.get("competitor", {}),
                        content_audit_result=child_results.get("content_audit", {}),
                        llm_visibility_result=_trim_llm_for_synthesis(child_results.get("llm_visibility", {})),
                    )
                )
            except SoftTimeLimitExceeded:
                # Soft limit fired — we can still write to the DB before hard kill
                await transition(
                    session, sprint, "complete_with_errors",
                    result={"error": "synthesis_timeout"},
                )
                await session.commit()
                return {"ok": False, "reason": "synthesis_timeout"}
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
def finalize_error_task(*args: Any) -> dict:
    # Celery errback arg layouts differ by trigger:
    #   body failure:   (chord_task_id, sprint_job_id)
    #   header failure: (request, exc, traceback, sprint_job_id)  [task_allow_error_cb_on_chord_header=True]
    # sprint_job_id is always the last positional arg (from .s(sprint_job_id)).
    sprint_job_id = str(args[-1])
    request_context = args[0]

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


def _trim_for_synthesis(kw_result: dict) -> dict:
    """Keep top 10 keywords only — synthesis doesn't need the full ranked list."""
    kws = kw_result.get("keywords", [])
    return {"keywords": kws[:10]}


def _trim_llm_for_synthesis(llm_result: dict) -> dict:
    """Strip sample_response (can be 1000+ chars) — synthesis only needs the metrics."""
    return {k: v for k, v in llm_result.items() if k != "sample_response"}


def _to_json(obj: Any) -> dict:
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    return dict(obj) if isinstance(obj, dict) else {"value": str(obj)}
