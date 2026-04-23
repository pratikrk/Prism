# Prism — Agent Context

## What Prism is

An AI-powered SEO strategy platform. A user states a traffic goal in natural language; an orchestrator agent parses it into a Plan; a sprint of specialist research agents runs in parallel; later sub-projects add semantic clustering, content generation with GEO for LLM citation, and unified monitoring across Google rankings, AI Overviews, and LLM recommendations.

## Where we are

**Foundation sub-project** (first of 7). Scope C:
- Monorepo scaffolded, Docker infra (Redis; Postgres under `test` profile).
- Neon Postgres for dev + prod (direct endpoint so LISTEN/NOTIFY works for SSE).
- FastAPI + Celery agent runtime live.
- Orchestrator agent runs real Claude calls; `keyword` agent is live against DataForSEO; other 3 research agents are stubs.
- Next.js 16 web app with Clerk auth, shadcn/ui, light/dark/system theme, live SSE-driven job board.
- Chord-failure contract proven by integration tests.
- `vendor/claude-seo/` hosts the claude-seo skill bundle, consumed by `app.skills.loader`.

**Up next** (separate sub-projects, not Foundation): Orchestrator refinements, Research-sprint (real agents + Gate 1), Clustering (Gate 2), Content+GEO (Gate 3), Monitoring, Billing+launch.

## Monorepo layout

```
prism/
├── apps/
│   ├── api/       # Python 3.12 · FastAPI · Celery · SQLAlchemy async
│   └── web/       # Next.js 16 · React · Tailwind · shadcn/ui · Clerk
├── packages/
│   └── types/     # shared TS types
├── vendor/
│   └── claude-seo/# committed copy of the claude-seo plugin
├── docs/
│   └── superpowers/
│       ├── specs/2026-04-21-foundation-design.md
│       └── plans/2026-04-22-foundation-implementation.md
├── docker-compose.yml
├── Makefile
└── CLAUDE.md
```

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React, Tailwind, shadcn/ui, next-themes, SWR |
| Backend | Python 3.12, FastAPI, Celery 5, SQLAlchemy 2.x async |
| AI | Anthropic SDK, `claude-sonnet-4-6` |
| Database | Neon Postgres (direct endpoint) + pgvector; local Postgres under compose `test` profile for pytest |
| Queue / cache | Redis 7 (broker, result backend, DataForSEO cache) |
| Auth | Clerk |
| Observability | Sentry (FastAPI + Celery + Next.js); OpenTelemetry **deferred** to Research-sprint |

## Agent pipeline

```
POST /workspaces/{id}/jobs {goal}
  → orchestrator job INSERTED (pending)
  → orchestrator_task.delay(job_id)

orchestrator_task:
  1. transition orchestrator → running
  2. OrchestratorAgent.run() → Plan
  3. INSERT plans row
  4. INSERT sprint job (parent=orchestrator)
  5. transition orchestrator → complete (NOTIFY)
  6. dispatch chord([keyword, competitor_stub, content_audit_stub, llm_visibility_stub],
                    body=finalize_task, on_error=finalize_error_task)

each child task:
  - transition child → running
  - run agent (keyword: live DataForSEO + Claude rerank; stubs: sleep)
  - on success: transition → complete, return {ok: True, child_job_id}
  - on exception: CATCH, transition → failed with classified error, return {ok: False, error}
  CONTRACT: children never raise past the task boundary.

finalize_task(results, sprint_job_id):
  - sprint → complete if all ok else complete_with_errors  (NOTIFY)

GET /jobs/{id}/events (SSE):
  - asyncpg LISTEN job_events on the direct endpoint
  - forward filtered JSON frames as text/event-stream
```

## Key scalability decisions already baked in

- Per-workspace Celery concurrency cap (`AGENT_CONCURRENCY_PER_WORKSPACE=3`) via Redis semaphore
- DataForSEO Redis cache (24h TTL) keyed on normalized request body
- DataForSEO concurrency cap (`DATAFORSEO_CONCURRENCY=5`) via `asyncio.Semaphore` per worker
- Anthropic SDK retries (max 3, respects `retry-after`)
- Celery `worker_prefetch_multiplier=1`, `task_acks_late=True`, `soft_time_limit=120`, `time_limit=180`
- Neon direct endpoint for everything (no pooled endpoint → preserves LISTEN/NOTIFY, avoids asyncpg prepared-statement issues)
- pgvector extension enabled in initial migration so Clustering doesn't need a second migration

## Environment

Copy `.env.example` → `.env` and fill:
- `ANTHROPIC_API_KEY`
- `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`
- `DATABASE_URL` — Neon direct endpoint
- `TEST_DATABASE_URL` — local Postgres (under compose test profile)
- `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `CLERK_JWKS_URL`
- `SENTRY_DSN_API`, `SENTRY_DSN_WEB` (optional in dev)

## Local dev startup

```bash
make install       # pnpm install + uv venv + install deps
docker compose up -d redis
cd apps/api && uv run alembic upgrade head     # against Neon
# three terminals:
cd apps/api && uv run uvicorn app.main:app --reload      # :8000
cd apps/api && uv run celery -A app.workers.celery_app worker -l info -c 4
pnpm --filter @prism/web dev                              # :3000
```

## Tests

```bash
docker compose --profile test up -d              # test Postgres + Redis
cd apps/api && uv run pytest                     # unit + integration
pnpm --filter @prism/web test                    # vitest
```

Critical tests:
- `tests/integration/test_pipeline_child_raises.py` — the chord-failure contract.
- `tests/integration/test_pipeline_happy.py` — full happy path.

## Coding conventions

- Python: `async/await` throughout FastAPI routes; sync Celery task bodies wrap `asyncio.run(coro)`.
- All external API calls (Claude, DataForSEO) happen inside Celery tasks — never in the FastAPI request cycle.
- State transitions go through `app.core.jobs.transition()` — nowhere else.
- New agents subclass `BaseAgent`, declare `CORE_PROMPT`, optional `BACKING_SKILL`, and `RESPONSE_MODEL`.
- Shared types live in `@prism/types`; add new shapes there first.
- TypeScript strict mode, no `any` outside contact points.

## Adding a new agent (checklist)

1. Write the pydantic `Input`/`Output` models in `app/agents/<name>.py`.
2. Subclass `BaseAgent[InputModel, OutputModel]`, set `CORE_PROMPT` (and `BACKING_SKILL` if it maps to a claude-seo skill), override `user_prompt` or `run`.
3. If backed by an external API, add a client in `app/integrations/` with Redis cache + concurrency cap + tenacity retry.
4. Add a Celery task wrapper in `app/workers/tasks.py` using the `_child_body` pattern — DO NOT skip the try/except.
5. Add unit tests (mocked client) and at least one integration test for the Celery wrapper contract.
6. Register on the orchestrator's sprint if it's part of the Gate-1 sprint.

## Custom slash commands

See `.claude/commands/`:
- `/workspace <domain> "<goal>"` — submit a goal end-to-end via local API
- `/agent <name> <json>` — invoke a Prism agent directly (dev harness)
- `/migrate [up|down|new <name>]` — alembic wrapper
