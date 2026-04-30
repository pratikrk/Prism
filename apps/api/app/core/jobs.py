from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import JobError
from app.models import Job

_ALLOWED: dict[str, set[str]] = {
    "pending": {"running"},
    "running": {"complete", "failed", "complete_with_errors", "awaiting_gate0"},
    "awaiting_gate0": {"complete"},
    "complete": set(),
    "failed": {"running"},
    "complete_with_errors": set(),
}


class IllegalTransition(RuntimeError):
    pass


async def transition(
    session: AsyncSession,
    job: Job,
    new_status: str,
    *,
    result: dict[str, Any] | None = None,
    error: JobError | None = None,
) -> Job:
    if new_status not in _ALLOWED.get(job.status, set()):
        raise IllegalTransition(
            f"{job.type} job {job.id}: illegal transition {job.status} -> {new_status}"
        )
    if new_status == "complete_with_errors" and job.type != "sprint":
        raise IllegalTransition(
            f"{job.type} job {job.id}: complete_with_errors is only valid for sprint jobs"
        )

    now = datetime.now(timezone.utc)
    if new_status == "running" and job.started_at is None:
        job.started_at = now
    if new_status in {"complete", "failed", "complete_with_errors"}:
        job.completed_at = now
    if result is not None:
        job.result = result
    if error is not None:
        job.error = error.to_json()
    job.status = new_status

    await session.flush()
    return job
