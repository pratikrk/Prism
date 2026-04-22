from pathlib import Path

import pytest

from app.skills.loader import SkillNotFoundError, load_skill_prompt, _FRONTMATTER_CACHE


@pytest.fixture(autouse=True)
def _point_at_fixture_skills(monkeypatch, request):
    root = Path(__file__).resolve().parents[1] / "fixtures"
    monkeypatch.setenv("CLAUDE_SEO_PATH", str(root))
    from app.core import config as cfg
    monkeypatch.setattr(cfg.settings, "claude_seo_path", root)
    _FRONTMATTER_CACHE.clear()


def test_loads_body_and_strips_frontmatter():
    body = load_skill_prompt("seo-demo")
    assert body.startswith("# Demo Skill")
    assert "description:" not in body.splitlines()[0]


def test_caches_subsequent_calls():
    load_skill_prompt("seo-demo")
    assert "seo-demo" in _FRONTMATTER_CACHE
    import app.skills.loader as mod
    count = {"opens": 0}
    real_open = mod.Path.open

    def counting_open(self, *a, **kw):
        count["opens"] += 1
        return real_open(self, *a, **kw)

    mod.Path.open = counting_open  # type: ignore[method-assign]
    try:
        load_skill_prompt("seo-demo")
        assert count["opens"] == 0
    finally:
        mod.Path.open = real_open  # type: ignore[method-assign]


def test_unknown_skill_raises():
    with pytest.raises(SkillNotFoundError):
        load_skill_prompt("does-not-exist")
