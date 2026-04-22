# apps/api/tests/unit/test_config.py
from app.core.config import Settings


def test_settings_loads_required_fields(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setenv("DATAFORSEO_LOGIN", "login")
    monkeypatch.setenv("DATAFORSEO_PASSWORD", "pw")
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@h/db")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
    monkeypatch.setenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")
    monkeypatch.setenv("CLERK_JWKS_URL", "https://x/.well-known/jwks.json")
    s = Settings()
    assert s.anthropic_api_key.get_secret_value() == "sk-test"
    assert s.dataforseo_concurrency == 5
    assert s.agent_concurrency_per_workspace == 3
    assert "asyncpg" in s.database_url
    assert s.database_url_sync_for_alembic.startswith("postgresql+asyncpg://")


def test_claude_seo_path_defaults_to_vendor():
    from app.core.config import Settings
    s = Settings(
        anthropic_api_key="x",
        dataforseo_login="x",
        dataforseo_password="x",
        database_url="postgresql+asyncpg://u:p@h/db",
        redis_url="redis://x",
        celery_broker_url="redis://x",
        celery_result_backend="redis://x",
        clerk_jwks_url="https://x",
    )
    assert str(s.claude_seo_path).endswith("vendor/claude-seo")
