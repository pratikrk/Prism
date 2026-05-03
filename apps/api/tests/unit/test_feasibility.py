"""Unit tests for orchestrator goal feasibility detection."""
from __future__ import annotations

from app.agents.orchestrator import Plan


def test_plan_accepts_feasibility_note():
    p = Plan(
        intent="get 30k visits in 1 week",
        domain="example.com",
        competitors=[],
        timeline_weeks=1,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        traffic_target=30000,
        feasibility_note="Organic SEO takes at least 3 months to show results. "
                         "We'll plan a foundation sprint now so you can reach 30,000 monthly visits by week 16–20.",
    )
    assert p.feasibility_note is not None
    assert "12 weeks" in p.feasibility_note or "3 months" in p.feasibility_note


def test_plan_feasibility_note_defaults_to_none():
    p = Plan(
        intent="grow organic traffic over 6 months",
        domain="example.com",
        competitors=[],
        timeline_weeks=24,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )
    assert p.feasibility_note is None
