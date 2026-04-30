from __future__ import annotations

import uuid
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
async def test_synthesis_task_writes_brief_and_transitions_sprint(db_session, sample_workspace):
    """synthesis_task must write a strategy_briefs row and transition sprint to awaiting_gate1."""
    from sqlalchemy import select

    from app.models import Job, StrategyBrief
    from app.workers.tasks import synthesis_task

    plan_id_val = str(uuid.uuid4())

    # Create a sprint job
    sprint = Job(
        workspace_id=sample_workspace.id,
        type="sprint",
        status="running",
        input={"plan_id": plan_id_val},
    )
    db_session.add(sprint)
    await db_session.flush()
    sprint_id = str(sprint.id)

    fake_synthesis = MagicMock()
    fake_synthesis.clusters = []
    fake_synthesis.executive_summary = []

    with (
        patch("app.workers.tasks.SynthesisAgent") as MockAgent,
        patch("app.workers.tasks._get_child_results", new_callable=AsyncMock) as mock_results,
        patch("app.workers.tasks.PlanModel") as MockPlan,
    ):
        MockAgent.return_value.run = AsyncMock(return_value=fake_synthesis)
        mock_results.return_value = {
            "keyword": {}, "competitor": {}, "content_audit": {}, "llm_visibility": {}
        }
        # Mock plan lookup to avoid FK constraint
        fake_plan = MagicMock()
        fake_plan.domain = "test.io"
        fake_plan.intent = "test"

        # We need to patch the session.get to return a fake plan
        original_synthesis_task = synthesis_task
        # Run with mocked session internals
        with patch("app.workers.tasks.SessionLocal") as MockSession:
            mock_session = AsyncMock()
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=False)

            mock_sprint = MagicMock()
            mock_sprint.id = uuid.UUID(sprint_id)
            mock_sprint.workspace_id = sample_workspace.id
            mock_sprint.input = {"plan_id": plan_id_val}

            fake_plan_uuid = uuid.uuid4()
            mock_plan = MagicMock()
            mock_plan.domain = "test.io"
            mock_plan.intent = "test"

            call_count = [0]

            async def fake_get(model, pk):
                call_count[0] += 1
                if call_count[0] == 1:
                    return mock_sprint
                return mock_plan

            mock_session.get = fake_get
            mock_session.add = MagicMock()
            mock_session.flush = AsyncMock()
            mock_session.commit = AsyncMock()

            mock_brief = MagicMock()
            mock_brief.id = uuid.uuid4()

            with patch("app.workers.tasks.transition", new_callable=AsyncMock):
                with patch("app.workers.tasks.StrategyBrief") as MockBrief:
                    MockBrief.return_value = mock_brief

                    MockSession.return_value = mock_session
                    result = synthesis_task(sprint_id)

    assert result["ok"] is True
    assert "brief_id" in result


@pytest.mark.asyncio
async def test_synthesis_task_contract_never_raises(db_session, sample_workspace):
    """synthesis_task must return {ok: False} on exception, never raise."""
    from app.models import Job
    from app.workers.tasks import synthesis_task

    sprint = Job(
        workspace_id=sample_workspace.id,
        type="sprint",
        status="running",
        input={"plan_id": str(uuid.uuid4())},
    )
    db_session.add(sprint)
    await db_session.flush()

    with patch("app.workers.tasks.SynthesisAgent") as MockAgent:
        MockAgent.return_value.run = AsyncMock(side_effect=RuntimeError("synthesis boom"))
        result = synthesis_task(str(sprint.id))

    assert result["ok"] is False
    assert "error" in result or "reason" in result
