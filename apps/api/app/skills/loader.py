from __future__ import annotations

from pathlib import Path

from app.core.config import settings

_FRONTMATTER_CACHE: dict[str, str] = {}


class SkillNotFoundError(FileNotFoundError):
    pass


def _skill_path(name: str) -> Path:
    return settings.claude_seo_path / "skills" / name / "SKILL.md"


def load_skill_prompt(name: str) -> str:
    if name in _FRONTMATTER_CACHE:
        return _FRONTMATTER_CACHE[name]
    path = _skill_path(name)
    if not path.exists():
        raise SkillNotFoundError(f"skill {name!r} not found at {path}")
    with path.open("r", encoding="utf-8") as f:
        raw = f.read()
    body = _strip_frontmatter(raw)
    _FRONTMATTER_CACHE[name] = body
    return body


def _strip_frontmatter(text: str) -> str:
    if not text.startswith("---"):
        return text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return text
    return parts[2].lstrip("\n")
