from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.agents.llm_visibility import LLMVisibilityAgent, LLMVisibilityInput


@pytest.mark.asyncio
async def test_brand_not_mentioned_sets_flag_false():
    fake_result = {
        "queries_tested": ["best ats for startups", "recruiting software for small teams"],
        "brand_mentioned": False,
        "mention_count": 0,
        "competitor_mentions": {"greenhouse.io": 2, "ashby.com": 1},
        "sample_response": "For startups I recommend Greenhouse or Ashby...",
        "note": "Based on Claude training data. Results reflect model knowledge, not live web search.",
    }

    with patch.object(LLMVisibilityAgent, "_call_claude", new_callable=AsyncMock) as mock_claude:
        from app.agents.llm_visibility import LLMVisibilityResult
        mock_claude.return_value = LLMVisibilityResult(**fake_result)

        agent = LLMVisibilityAgent()
        result = await agent.run(
            LLMVisibilityInput(
                domain="whitecarrot.io",
                intent="drive signups for ATS",
                competitors=["greenhouse.io", "ashby.com"],
            )
        )

    assert result.brand_mentioned is False
    assert result.mention_count == 0
    assert result.competitor_mentions["greenhouse.io"] == 2


@pytest.mark.asyncio
async def test_brand_mentioned_sets_flag_true():
    fake_result = {
        "queries_tested": ["best ats for startups"],
        "brand_mentioned": True,
        "mention_count": 1,
        "competitor_mentions": {"greenhouse.io": 1},
        "sample_response": "Whitecarrot is a great option...",
        "note": "Based on Claude training data.",
    }

    with patch.object(LLMVisibilityAgent, "_call_claude", new_callable=AsyncMock) as mock_claude:
        from app.agents.llm_visibility import LLMVisibilityResult
        mock_claude.return_value = LLMVisibilityResult(**fake_result)

        agent = LLMVisibilityAgent()
        result = await agent.run(
            LLMVisibilityInput(domain="whitecarrot.io", intent="ats", competitors=[])
        )

    assert result.brand_mentioned is True
