from __future__ import annotations

from unittest.mock import AsyncMock, patch

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
