from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.agents.content_audit import ContentAuditAgent, ContentAuditInput


@pytest.mark.asyncio
async def test_content_audit_identifies_ranking_pages():
    mock_ranked = [
        {
            "keyword_data": {"keyword": "ats software", "search_volume": 5000, "keyword_difficulty": 45},
            "ranked_serp_element": {
                "serp_item": {
                    "url": "https://whitecarrot.io/features",
                    "title": "Features",
                    "rank_group": 5,
                }
            },
        },
    ]

    fake_result = {
        "pages_found": 1,
        "ranking_pages": [
            {"url": "https://whitecarrot.io/features", "title": "Features", "top_keyword": "ats software", "position": 5}
        ],
        "missing_topics": ["TOFU blog content", "comparison pages"],
        "summary": "Site has 1 ranking page but no blog or comparison content targeting TOFU keywords.",
    }

    with (
        patch("app.agents.content_audit.DataForSEOClient") as MockDFS,
        patch.object(ContentAuditAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        dfs = MockDFS.return_value
        dfs.ranked_keywords = AsyncMock(return_value=mock_ranked)

        from app.agents.content_audit import ContentAuditResult
        mock_claude.return_value = ContentAuditResult(**fake_result)

        agent = ContentAuditAgent(dataforseo=dfs)
        result = await agent.run(ContentAuditInput(domain="whitecarrot.io", intent="drive signups"))

    assert result.pages_found == 1
    assert len(result.ranking_pages) == 1
    assert result.ranking_pages[0].url == "https://whitecarrot.io/features"
    assert len(result.missing_topics) == 2


@pytest.mark.asyncio
async def test_content_audit_no_rankings():
    with (
        patch("app.agents.content_audit.DataForSEOClient") as MockDFS,
        patch.object(ContentAuditAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        dfs = MockDFS.return_value
        dfs.ranked_keywords = AsyncMock(return_value=[])

        from app.agents.content_audit import ContentAuditResult
        mock_claude.return_value = ContentAuditResult(
            pages_found=0,
            ranking_pages=[],
            missing_topics=["all topics"],
            summary="No pages rank for any keywords yet.",
        )

        agent = ContentAuditAgent(dataforseo=dfs)
        result = await agent.run(ContentAuditInput(domain="brand-new.io", intent="grow"))

    assert result.pages_found == 0
    assert result.ranking_pages == []
