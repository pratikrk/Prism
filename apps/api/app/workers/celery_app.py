from __future__ import annotations

from celery import Celery

from app.core.config import settings
from app.core.sentry import init_sentry

init_sentry()

celery_app = Celery(
    "prism",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=120,
    task_time_limit=180,
    broker_connection_retry_on_startup=True,
    result_extended=True,
    # Fire on_error callback when a chord header task raises (not just the body).
    task_allow_error_cb_on_chord_header=True,
)
