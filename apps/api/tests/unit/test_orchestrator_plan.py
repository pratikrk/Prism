from app.agents.orchestrator import Plan


def test_plan_accepts_traffic_target():
    p = Plan(
        intent="reach 50k monthly visitors",
        domain="example.com",
        competitors=["comp.com"],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        traffic_target=50000,
    )
    assert p.traffic_target == 50000


def test_plan_traffic_target_defaults_to_none():
    p = Plan(
        intent="grow organic traffic",
        domain="example.com",
        competitors=[],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )
    assert p.traffic_target is None
