from __future__ import annotations

import asyncio
import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.synthesis import SynthesisAgent, SynthesisInput


@pytest.mark.asyncio
async def test_synthesis_agent_returns_clusters_and_summary():
    fake_result = {
        "clusters": [
            {
                "name": "ATS Basics",
                "hub_page": "What is an ATS?",
                "spoke_pages": ["ATS for startups", "How to choose an ATS"],
                "target_keywords": ["ats software", "applicant tracking"],
                "priority": 1,
            }
        ],
        "executive_summary": [
            {
                "title": "Build 3 TOFU hub pages",
                "rationale": "Zero blog content targeting high-volume TOFU keywords",
                "estimated_impact": "800 organic/mo in 90 days",
                "priority": 1,
            }
        ],
    }

    with patch.object(SynthesisAgent, "_call_claude", new_callable=AsyncMock) as mock_claude:
        from app.agents.synthesis import SynthesisResult
        mock_claude.return_value = SynthesisResult(**fake_result)

        agent = SynthesisAgent()
        result = await agent.run(
            SynthesisInput(
                plan_id="plan-1",
                domain="whitecarrot.io",
                intent="drive signups",
                keyword_result={"keywords": []},
                competitor_result={"competitors": [], "gap_keywords": [], "quick_wins": []},
                content_audit_result={"pages_found": 0, "ranking_pages": [], "missing_topics": [], "summary": ""},
                llm_visibility_result={"queries_tested": [], "brand_mentioned": False, "mention_count": 0, "competitor_mentions": {}, "sample_response": "", "note": ""},
            )
        )

    assert len(result.clusters) == 1
    assert result.clusters[0].name == "ATS Basics"
    assert len(result.executive_summary) == 1
    assert result.executive_summary[0].priority == 1


@pytest.mark.asyncio
async def test_synthesis_task_writes_brief_and_transitions_sprint():
    """synthesis_task must write a strategy_briefs row and transition sprint to awaiting_gate1.

    Runs synthesis_task in a thread (it uses asyncio.run internally).
    """
    from app.workers.tasks import synthesis_task

    sprint_id = str(uuid.uuid4())
    plan_id_val = str(uuid.uuid4())

    fake_synthesis = MagicMock()
    fake_synthesis.clusters = []
    fake_synthesis.executive_summary = []

    mock_sprint = MagicMock()
    mock_sprint.id = uuid.UUID(sprint_id)
    mock_sprint.workspace_id = uuid.uuid4()
    mock_sprint.input = {"plan_id": plan_id_val}

    mock_plan = MagicMock()
    mock_plan.domain = "test.io"
    mock_plan.intent = "test"

    call_count = [0]

    async def fake_get(model, pk):
        call_count[0] += 1
        if call_count[0] == 1:
            return mock_sprint
        return mock_plan

    mock_session = AsyncMock()
    mock_session.get = fake_get
    mock_session.add = MagicMock()
    mock_session.flush = AsyncMock()
    mock_session.commit = AsyncMock()

    @asynccontextmanager
    async def fake_session_local():
        yield mock_session

    mock_brief = MagicMock()
    mock_brief.id = uuid.uuid4()

    with (
        patch("app.workers.tasks.SynthesisAgent") as MockAgent,
        patch("app.workers.tasks._get_child_results", new_callable=AsyncMock) as mock_results,
        patch("app.workers.tasks.SessionLocal", fake_session_local),
        patch("app.workers.tasks.transition", new_callable=AsyncMock),
        patch("app.workers.tasks.StrategyBrief") as MockBrief,
    ):
        MockAgent.return_value.run = AsyncMock(return_value=fake_synthesis)
        mock_results.return_value = {
            "keyword": {}, "competitor": {}, "content_audit": {}, "llm_visibility": {}
        }
        MockBrief.return_value = mock_brief

        result = await asyncio.to_thread(synthesis_task, sprint_id)

    assert result["ok"] is True
    assert "brief_id" in result


@pytest.mark.asyncio
async def test_synthesis_task_contract_never_raises():
    """synthesis_task must return {ok: False} on exception, never raise."""
    from app.workers.tasks import synthesis_task

    sprint_id = str(uuid.uuid4())

    with patch("app.workers.tasks.SynthesisAgent") as MockAgent:
        MockAgent.return_value.run = AsyncMock(side_effect=RuntimeError("synthesis boom"))
        result = await asyncio.to_thread(synthesis_task, sprint_id)

    assert result["ok"] is False
    assert "error" in result or "reason" in result


@pytest.mark.asyncio
async def test_synthesis_input_accepts_traffic_target():
    """SynthesisInput must accept traffic_target and include it in the user prompt."""
    with patch.object(SynthesisAgent, "_call_claude", new_callable=AsyncMock) as mock_claude:
        from app.agents.synthesis import SynthesisResult, ContentCluster, Recommendation
        mock_claude.return_value = SynthesisResult(
            clusters=[ContentCluster(name="c", hub_page="h", spoke_pages=[], target_keywords=[], priority=1)],
            executive_summary=[Recommendation(title="t", rationale="r", estimated_impact="500/mo", priority=1)],
        )

        agent = SynthesisAgent()
        await agent.run(
            SynthesisInput(
                plan_id="plan-1",
                domain="example.com",
                intent="get 50k organic visitors",
                traffic_target=50000,
                keyword_result={"keywords": []},
                competitor_result={"competitors": [], "gap_keywords": [], "quick_wins": []},
                content_audit_result={"pages_found": 0, "ranking_pages": [], "missing_topics": [], "summary": ""},
                llm_visibility_result={"queries_tested": [], "brand_mentioned": False, "mention_count": 0, "competitor_mentions": {}},
            )
        )

        _, user_arg = mock_claude.call_args[0]
        assert "50000" in user_arg
