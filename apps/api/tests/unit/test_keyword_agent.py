from unittest.mock import AsyncMock, MagicMock

import pytest

from app.agents.keyword import KeywordAgent, KeywordInput, KeywordResult
from app.agents.orchestrator import Plan
from app.integrations.dataforseo import KeywordRow


@pytest.mark.asyncio
async def test_keyword_agent_ranks_and_returns_result():
    plan = Plan(
        intent="signups",
        domain="whitecarrot.io",
        competitors=["greenhouse.io"],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )
    client = MagicMock()
    client.keywords_for_keywords = AsyncMock(
        return_value=[
            KeywordRow(keyword="ats software", search_volume=2900, keyword_difficulty=52),
            KeywordRow(keyword="applicant tracking", search_volume=4400, keyword_difficulty=45),
        ]
    )
    agent = KeywordAgent(dataforseo=client)
    agent._client = MagicMock()
    agent._client.messages.create = AsyncMock(
        return_value=_fake(
            '{"keywords":['
            '{"term":"applicant tracking","volume":4400,"difficulty":45,"priority_score":0.82},'
            '{"term":"ats software","volume":2900,"difficulty":52,"priority_score":0.64}'
            ']}'
        )
    )
    out = await agent.run(KeywordInput(plan=plan))
    assert isinstance(out, KeywordResult)
    assert len(out.keywords) == 2
    assert out.keywords[0].priority_score >= out.keywords[1].priority_score


def _fake(text: str):
    m = MagicMock()
    m.content = [MagicMock(text=text)]
    return m
