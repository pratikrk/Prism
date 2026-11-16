from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.agents.competitor import CompetitorAgent, CompetitorInput


@pytest.mark.asyncio
async def test_competitor_agent_returns_gap_keywords():
    """Agent extracts gap keywords from mocked DataForSEO + Claude."""
    mock_competitors = [
        {
            "target": "greenhouse.io",
            "metrics": {"organic": {"etv": 50000, "keywords_count": 300}},
            "intersections": 20,
        }
    ]
    mock_ranked = [
        {
            "keyword_data": {"keyword": "ats for startups", "search_volume": 1200, "keyword_difficulty": 28},
            "ranked_serp_element": {"serp_item": {"url": "https://greenhouse.io/blog/ats", "title": "ATS Guide", "rank_group": 2}},
        }
    ]
    mock_my_ranked: list = []

    fake_result = {
        "competitors": [
            {"domain": "greenhouse.io", "estimated_traffic": 50000, "ranking_keywords": 300, "overlap_keywords": 20}
        ],
        "gap_keywords": [
            {"term": "ats for startups", "volume": 1200, "kd": 28, "competitor": "greenhouse.io", "competitor_position": 2}
        ],
        "quick_wins": [
            {"term": "ats for startups", "volume": 1200, "kd": 28, "competitor": "greenhouse.io", "competitor_position": 2}
        ],
    }

    with (
        patch("app.agents.competitor.DataForSEOClient") as MockDFS,
        patch.object(CompetitorAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        dfs = MockDFS.return_value
        dfs.domain_competitors = AsyncMock(return_value=mock_competitors)
        dfs.ranked_keywords = AsyncMock(side_effect=[mock_ranked, mock_my_ranked])
        dfs.domain_rank_overview = AsyncMock(return_value={})

        from app.agents.competitor import CompetitorResult
        mock_claude.return_value = CompetitorResult(**fake_result)

        agent = CompetitorAgent(dataforseo=dfs)
        inp = CompetitorInput(
            domain="whitecarrot.io",
            competitors=["greenhouse.io"],
            intent="drive organic signups",
        )
        result = await agent.run(inp)

    assert len(result.gap_keywords) == 1
    assert result.gap_keywords[0].term == "ats for startups"
    assert len(result.quick_wins) == 1


@pytest.mark.asyncio
async def test_competitor_agent_empty_competitors():
    """Empty DataForSEO competitor response still returns valid result."""
    with (
        patch("app.agents.competitor.DataForSEOClient") as MockDFS,
        patch.object(CompetitorAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        dfs = MockDFS.return_value
        dfs.domain_competitors = AsyncMock(return_value=[])
        dfs.ranked_keywords = AsyncMock(return_value=[])
        dfs.domain_rank_overview = AsyncMock(return_value={})

        from app.agents.competitor import CompetitorResult
        mock_claude.return_value = CompetitorResult(competitors=[], gap_keywords=[], quick_wins=[])

        agent = CompetitorAgent(dataforseo=dfs)
        inp = CompetitorInput(domain="new-site.io", competitors=[], intent="grow traffic")
        result = await agent.run(inp)

    assert result.competitors == []
    assert result.gap_keywords == []
