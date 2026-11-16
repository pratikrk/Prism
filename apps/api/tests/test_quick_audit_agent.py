from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.quick_audit import (
    ActionItem,
    AuditScore,
    QuickAuditAgent,
    QuickAuditInput,
    QuickAuditResult,
)


def _mock_claude_response(result: QuickAuditResult) -> MagicMock:
    block = MagicMock()
    block.text = result.model_dump_json()
    msg = MagicMock()
    msg.content = [block]
    return msg


@pytest.mark.asyncio
async def test_quick_audit_returns_result():
    fake_result = QuickAuditResult(
        domain="example.com",
        domain_rating=None,
        estimated_monthly_traffic=5000,
        top_keywords=["crm software", "best crm"],
        score=AuditScore(technical=61, content=54, ai_visibility=72, overall=62),
        action_items=[
            ActionItem(
                severity="critical",
                title="Add meta descriptions to all pages",
                rationale="Missing on 14 pages, direct CTR impact",
                effort_minutes=30,
            )
        ],
    )

    with (
        patch(
            "app.agents.quick_audit.QuickAuditAgent._fetch_homepage",
            new=AsyncMock(return_value="<html><head><title>Example</title></head></html>"),
        ),
        patch(
            "app.agents.quick_audit.DataForSEOClient.domain_rank_overview",
            new=AsyncMock(return_value={"metrics": {"organic": {"etv": 5000}}}),
        ),
        patch(
            "app.agents.quick_audit.DataForSEOClient.ranked_keywords",
            new=AsyncMock(return_value=[
                {"keyword_data": {"keyword": "crm software"}},
                {"keyword_data": {"keyword": "best crm"}},
            ]),
        ),
        patch(
            "app.agents.quick_audit.QuickAuditAgent._call_claude",
            new=AsyncMock(return_value=fake_result),
        ),
    ):
        result = await QuickAuditAgent().run(QuickAuditInput(domain="example.com"))

    assert result.domain == "example.com"
    assert result.score.overall == 62
    assert len(result.action_items) == 1
    assert result.action_items[0].severity == "critical"
    assert result.estimated_monthly_traffic == 5000
    assert result.top_keywords == ["crm software", "best crm"]


@pytest.mark.asyncio
async def test_quick_audit_survives_dataforseo_failure():
    """DataForSEO errors must not crash the audit — fall back gracefully."""
    fake_result = QuickAuditResult(
        domain="example.com",
        score=AuditScore(technical=50, content=50, ai_visibility=50, overall=50),
        action_items=[],
    )

    with (
        patch(
            "app.agents.quick_audit.QuickAuditAgent._fetch_homepage",
            new=AsyncMock(return_value="<html></html>"),
        ),
        patch(
            "app.agents.quick_audit.DataForSEOClient.domain_rank_overview",
            new=AsyncMock(side_effect=Exception("API down")),
        ),
        patch(
            "app.agents.quick_audit.DataForSEOClient.ranked_keywords",
            new=AsyncMock(side_effect=Exception("API down")),
        ),
        patch(
            "app.agents.quick_audit.QuickAuditAgent._call_claude",
            new=AsyncMock(return_value=fake_result),
        ),
    ):
        result = await QuickAuditAgent().run(QuickAuditInput(domain="example.com"))

    assert result.domain == "example.com"
    assert result.estimated_monthly_traffic is None
    assert result.top_keywords == []


@pytest.mark.asyncio
async def test_quick_audit_fetch_homepage_falls_back_to_http():
    """If https fails, retry with http."""
    agent = QuickAuditAgent()

    call_count = 0

    async def mock_get(url, **kwargs):
        nonlocal call_count
        call_count += 1
        if url.startswith("https"):
            raise Exception("SSL error")
        resp = MagicMock()
        resp.text = "<html>ok</html>"
        return resp

    with patch("app.agents.quick_audit.httpx.AsyncClient") as MockClient:
        instance = AsyncMock()
        instance.__aenter__ = AsyncMock(return_value=instance)
        instance.__aexit__ = AsyncMock(return_value=None)
        instance.get = mock_get
        MockClient.return_value = instance

        html = await agent._fetch_homepage("example.com")

    assert html == "<html>ok</html>"
    assert call_count == 2  # https tried, then http
