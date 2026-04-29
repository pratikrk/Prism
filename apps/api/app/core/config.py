# apps/api/app/core/config.py
"""Centralized runtime configuration."""
from __future__ import annotations

from pathlib import Path

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_REPO_ROOT / ".env", _REPO_ROOT / ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    anthropic_api_key: SecretStr
    claude_timeout: int = 60

    dataforseo_login: SecretStr
    dataforseo_password: SecretStr
    dataforseo_concurrency: int = 5
    dataforseo_timeout: int = 45

    database_url: str
    test_database_url: str | None = None

    redis_url: str
    celery_broker_url: str
    celery_result_backend: str

    agent_concurrency_per_workspace: int = 3

    clerk_jwks_url: str
    clerk_secret_key: SecretStr | None = None
    clerk_webhook_secret: SecretStr | None = None

    sentry_dsn_api: str | None = None
    sentry_env: str = "development"

    claude_seo_path: Path = Field(default=_REPO_ROOT / "vendor" / "claude-seo")

    @model_validator(mode="after")
    def _resolve_claude_seo_path(self) -> "Settings":
        if not self.claude_seo_path.is_absolute():
            self.claude_seo_path = (_REPO_ROOT / self.claude_seo_path).resolve()
        return self

    @property
    def database_url_sync_for_alembic(self) -> str:
        """Alembic-compatible URL. asyncpg driver works for our async env.py."""
        return self.database_url


try:
    settings = Settings()
except Exception:
    settings = None  # type: ignore[assignment]
