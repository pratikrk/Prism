from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

import asyncpg

from app.core.config import settings


def _asyncpg_url() -> str:
    return settings.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def listen_job_events() -> AsyncIterator[dict[str, Any]]:
    """Yield parsed job_events payloads as they arrive. Reconnects on disconnect."""
    while True:
        try:
            conn: asyncpg.Connection = await asyncpg.connect(_asyncpg_url())
            queue: asyncio.Queue[str] = asyncio.Queue()

            def _forward(_conn, _pid, _channel, payload):  # type: ignore[no-untyped-def]
                queue.put_nowait(payload)

            await conn.add_listener("job_events", _forward)
            try:
                while True:
                    payload = await queue.get()
                    try:
                        yield json.loads(payload)
                    except json.JSONDecodeError:
                        continue
            finally:
                await conn.remove_listener("job_events", _forward)
                await conn.close()
        except (asyncpg.PostgresError, OSError):
            await asyncio.sleep(1.0)
            continue
