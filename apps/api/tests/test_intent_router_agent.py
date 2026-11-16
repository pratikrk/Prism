from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.intent_router import IntentRouterAgent, RouterDecision, RouterInput


def _mock_router_response(decision: RouterDecision) -> MagicMock:
    block = MagicMock()
    block.text = decision.model_dump_json()
    msg = MagicMock()
    msg.content = [block]
    return msg


@pytest.mark.asyncio
async def test_routes_goal_setting():
    decision = RouterDecision(
        intent="goal_setting",
        confidence=0.95,
        extracted_params={},
        fallback_message=None,
    )
    with patch(
        "app.agents.intent_router.IntentRouterAgent._call_claude",
        new=AsyncMock(return_value=decision),
    ):
        result = await IntentRouterAgent().run(
            RouterInput(
                message="I want 10k visitors a month from organic",
                workspace_context={"domain": "example.com", "has_audit": True, "has_plan": False},
            )
        )
    assert result.intent == "goal_setting"
    assert result.confidence >= 0.7


@pytest.mark.asyncio
async def test_routes_audit():
    decision = RouterDecision(
        intent="audit",
        confidence=0.98,
        extracted_params={},
        fallback_message=None,
    )
    with patch(
        "app.agents.intent_router.IntentRouterAgent._call_claude",
        new=AsyncMock(return_value=decision),
    ):
        result = await IntentRouterAgent().run(
            RouterInput(
                message="audit my site",
                workspace_context={"domain": "example.com", "has_audit": False, "has_plan": False},
            )
        )
    assert result.intent == "audit"


@pytest.mark.asyncio
async def test_low_confidence_becomes_unknown():
    decision = RouterDecision(
        intent="unknown",
        confidence=0.3,
        extracted_params={},
        fallback_message="I'm not sure what you mean. Try: 'audit my site' or 'I want 10k visitors/month'.",
    )
    with patch(
        "app.agents.intent_router.IntentRouterAgent._call_claude",
        new=AsyncMock(return_value=decision),
    ):
        result = await IntentRouterAgent().run(
            RouterInput(
                message="blah blah blah",
                workspace_context={"domain": "example.com", "has_audit": False, "has_plan": False},
            )
        )
    assert result.intent == "unknown"
    assert result.fallback_message is not None
