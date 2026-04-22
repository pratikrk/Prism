from __future__ import annotations

import asyncio
import random

import pydantic

from app.agents.orchestrator import Plan


class StubInput(pydantic.BaseModel):
    plan: Plan


class StubResult(pydantic.BaseModel):
    type: str
    note: str
    fake_items: list[str]


async def _fake_run(agent_type: str, plan: Plan) -> StubResult:
    await asyncio.sleep(random.uniform(2.0, 5.0))
    return StubResult(
        type=agent_type,
        note=f"stub {agent_type} for {plan.domain}; replaced in Research-sprint sub-project",
        fake_items=[f"{agent_type}_finding_{i}" for i in range(5)],
    )


class CompetitorStub:
    async def run(self, inp: StubInput) -> StubResult:
        return await _fake_run("competitor", inp.plan)


class ContentAuditStub:
    async def run(self, inp: StubInput) -> StubResult:
        return await _fake_run("content_audit", inp.plan)


class LLMVisibilityStub:
    async def run(self, inp: StubInput) -> StubResult:
        return await _fake_run("llm_visibility", inp.plan)
