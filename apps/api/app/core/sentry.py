from __future__ import annotations

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration

from app.core.config import settings


def init_sentry() -> None:
    if not settings.sentry_dsn_api:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn_api,
        environment=settings.sentry_env,
        integrations=[FastApiIntegration(), CeleryIntegration()],
        traces_sample_rate=0.0,
        send_default_pii=False,
    )
