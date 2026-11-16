"""Redis-based distributed semaphore for Claude API concurrency control.

Limits concurrent Claude API calls across all Celery workers so we don't
trigger Anthropic rate limits when running multiple research agents in parallel.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import redis.asyncio as aioredis

_KEY = "prism:claude:active_slots"
_SLOT_TTL = 300  # safety expiry so stale slots don't block forever
_POLL_INTERVAL = 4  # seconds between retry-acquire attempts

# Atomic: increment counter only if it is below the limit.
# Returns 1 (acquired) or 0 (at capacity).
_LUA_ACQUIRE = """
local key = KEYS[1]
local max = tonumber(ARGV[1])
local cur = tonumber(redis.call('GET', key) or '0')
if cur < max then
    redis.call('INCR', key)
    redis.call('EXPIRE', key, tonumber(ARGV[2]))
    return 1
end
return 0
"""


@asynccontextmanager
async def claude_slot(
    redis_url: str,
    max_concurrent: int = 2,
) -> AsyncGenerator[None, None]:
    """Acquire a Claude concurrency slot, run the body, then release it."""
    r: aioredis.Redis = aioredis.from_url(redis_url, decode_responses=True)
    try:
        while True:
            acquired = await r.eval(  # type: ignore[misc]
                _LUA_ACQUIRE, 1, _KEY, max_concurrent, _SLOT_TTL
            )
            if acquired:
                break
            await asyncio.sleep(_POLL_INTERVAL)
        try:
            yield
        finally:
            # Decrement but never below 0
            await r.eval(  # type: ignore[misc]
                "local v = redis.call('DECR', KEYS[1]); if v < 0 then redis.call('SET', KEYS[1], 0) end; return v",
                1,
                _KEY,
            )
    finally:
        await r.aclose()
