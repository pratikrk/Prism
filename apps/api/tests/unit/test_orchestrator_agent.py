from unittest.mock import AsyncMock, MagicMock

import pytest

from app.agents.orchestrator import OrchestratorAgent, OrchestratorInput, Plan


@pytest.mark.asyncio
async def test_valid_goal_returns_plan():
    agent = OrchestratorAgent()
    agent._client = MagicMock()
    agent._client.messages.create = AsyncMock(
        return_value=_fake(
            '{"intent":"50k signups/mo","domain":"whitecarrot.io",'
            '"competitors":["greenhouse.io","ashbyhq.com"],'
            '"timeline_weeks":24,'
            '"sprint_order":["keyword","competitor","content_audit","llm_visibility"]}'
        )
    )
    plan = await agent.run(
        OrchestratorInput(
            goal="50k organic signups/mo on whitecarrot.io in 6 months vs greenhouse and ashby",
            domain="whitecarrot.io",
        )
    )
    assert isinstance(plan, Plan)
    assert plan.domain == "whitecarrot.io"
    assert plan.timeline_weeks == 24
    assert "greenhouse.io" in plan.competitors


def _fake(text: str):
    m = MagicMock()
    m.content = [MagicMock(text=text)]
    return m
