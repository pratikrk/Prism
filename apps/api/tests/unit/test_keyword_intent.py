"""Unit tests for KeywordAgent intent alignment, KD thresholds, and traffic portfolio."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.agents.keyword import KeywordAgent, KeywordInput, KeywordResult, RankedKeyword
from app.agents.orchestrator import Plan


def _plan(intent: str, timeline_weeks: int = 12, traffic_target: int | None = None) -> Plan:
    return Plan(
        intent=intent,
        domain="example.com",
        competitors=["comp.com"],
        timeline_weeks=timeline_weeks,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        traffic_target=traffic_target,
    )


def _result(keywords: list[dict]) -> KeywordResult:
    return KeywordResult(keywords=[RankedKeyword(**k) for k in keywords])


def _base_kw(**overrides) -> dict:
    return {
        "term": "seo tips",
        "volume": 5000,
        "priority_score": 0.8,
        "intent": "informational",
        "funnel_stage": "TOF",
        "estimated_monthly_traffic": 250,
        **overrides,
    }


@pytest.mark.asyncio
async def test_short_timeline_emits_kd30_threshold():
    """≤8 week timeline → 'max KD 30' must appear in the Claude user prompt."""
    agent = KeywordAgent()
    with (
        patch.object(agent, "_dfs") as mock_dfs,
        patch.object(KeywordAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        mock_dfs.keywords_for_keywords = AsyncMock(return_value=[])
        mock_dfs.bulk_keyword_difficulty = AsyncMock(return_value={})
        mock_claude.return_value = _result([_base_kw()])

        await agent.run(KeywordInput(plan=_plan("grow fast", timeline_weeks=6)))

        _, user_arg = mock_claude.call_args[0]
        assert "max KD 30" in user_arg


@pytest.mark.asyncio
async def test_medium_timeline_emits_kd50_threshold():
    """9–20 week timeline → 'max KD 50' must appear in the Claude user prompt."""
    agent = KeywordAgent()
    with (
        patch.object(agent, "_dfs") as mock_dfs,
        patch.object(KeywordAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        mock_dfs.keywords_for_keywords = AsyncMock(return_value=[])
        mock_dfs.bulk_keyword_difficulty = AsyncMock(return_value={})
        mock_claude.return_value = _result([_base_kw()])

        await agent.run(KeywordInput(plan=_plan("build authority", timeline_weeks=12)))

        _, user_arg = mock_claude.call_args[0]
        assert "max KD 50" in user_arg


@pytest.mark.asyncio
async def test_long_timeline_emits_kd70_threshold():
    """>20 week timeline → 'max KD 70' must appear in the Claude user prompt."""
    agent = KeywordAgent()
    with (
        patch.object(agent, "_dfs") as mock_dfs,
        patch.object(KeywordAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        mock_dfs.keywords_for_keywords = AsyncMock(return_value=[])
        mock_dfs.bulk_keyword_difficulty = AsyncMock(return_value={})
        mock_claude.return_value = _result([_base_kw()])

        await agent.run(KeywordInput(plan=_plan("become the authority", timeline_weeks=26)))

        _, user_arg = mock_claude.call_args[0]
        assert "max KD 70" in user_arg


@pytest.mark.asyncio
async def test_traffic_target_appears_in_user_prompt():
    """traffic_target value must be passed in the Claude user prompt."""
    agent = KeywordAgent()
    with (
        patch.object(agent, "_dfs") as mock_dfs,
        patch.object(KeywordAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        mock_dfs.keywords_for_keywords = AsyncMock(return_value=[])
        mock_dfs.bulk_keyword_difficulty = AsyncMock(return_value={})
        mock_claude.return_value = _result([_base_kw()])

        await agent.run(KeywordInput(plan=_plan("get 50k visits", traffic_target=50000)))

        _, user_arg = mock_claude.call_args[0]
        assert "50000" in user_arg


@pytest.mark.asyncio
async def test_boundary_week8_uses_kd30():
    """timeline_weeks=8 is the last value that gets KD 30 (not KD 50)."""
    agent = KeywordAgent()
    with (
        patch.object(agent, "_dfs") as mock_dfs,
        patch.object(KeywordAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        mock_dfs.keywords_for_keywords = AsyncMock(return_value=[])
        mock_dfs.bulk_keyword_difficulty = AsyncMock(return_value={})
        mock_claude.return_value = _result([_base_kw()])

        await agent.run(KeywordInput(plan=_plan("grow fast", timeline_weeks=8)))

        _, user_arg = mock_claude.call_args[0]
        assert "max KD 30" in user_arg
        assert "max KD 50" not in user_arg


@pytest.mark.asyncio
async def test_boundary_week9_uses_kd50():
    """timeline_weeks=9 is the first value that gets KD 50 (not KD 30)."""
    agent = KeywordAgent()
    with (
        patch.object(agent, "_dfs") as mock_dfs,
        patch.object(KeywordAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        mock_dfs.keywords_for_keywords = AsyncMock(return_value=[])
        mock_dfs.bulk_keyword_difficulty = AsyncMock(return_value={})
        mock_claude.return_value = _result([_base_kw()])

        await agent.run(KeywordInput(plan=_plan("build authority", timeline_weeks=9)))

        _, user_arg = mock_claude.call_args[0]
        assert "max KD 50" in user_arg
        assert "max KD 30" not in user_arg


def test_ranked_keyword_accepts_ictn_and_funnel_stage():
    """RankedKeyword must accept all four ICTN values and TOF/MOF/BOF/NAV funnel stages."""
    for ictn, funnel in [
        ("informational", "TOF"),
        ("commercial", "MOF"),
        ("transactional", "BOF"),
        ("navigational", "NAV"),
    ]:
        kw = RankedKeyword(
            term="test keyword",
            volume=1000,
            priority_score=0.5,
            intent=ictn,
            funnel_stage=funnel,
            estimated_monthly_traffic=50,
        )
        assert kw.intent == ictn
        assert kw.funnel_stage == funnel
        assert kw.estimated_monthly_traffic == 50
