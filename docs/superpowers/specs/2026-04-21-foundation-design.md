# Prism Foundation — Design Spec

**Date:** 2026-04-21
**Status:** Draft — awaiting user approval
**Sub-project:** Foundation (first of 7 in Prism decomposition)
**Author:** Pratik (with Claude Code, Superpowers brainstorming flow)

---

## 1. Context

### 1.1 What Prism is

Prism is an AI-powered SEO strategy platform. A user describes a traffic goal in natural language (e.g. "50k organic signups/month for whitecarrot.io in 6 months vs Greenhouse and Ashby"). An orchestrator agent parses the goal. A sprint of specialist research agents runs in parallel. Later sub-projects add semantic clustering, content generation with GEO (Generative Engine Optimization) for LLM citation, and unified monitoring across Google rankings, AI Overviews, and LLM recommendations.

### 1.2 Scope of this spec

This spec covers **Sub-project #1: Foundation** — the first of seven decomposed pieces. Foundation delivers:

- A monorepo with working infrastructure (Docker, Postgres+pgvector, Redis, PgBouncer)
- Next.js web app with Clerk auth, light/dark/system theming, workspace creation, goal input, and a live job-status board
- FastAPI + Celery backend with the agent runtime contract (`BaseAgent`, `skills_loader`)
- One fully working end-to-end pipeline: user submits goal → orchestrator agent parses it (live Claude call) → fan-out via Celery chord to 4 research agents → 1 of those agents (`keyword`) is **live** against DataForSEO, other 3 are **stubs** that sleep + return fake data → finalize task rolls up status → UI streams state transitions via SSE
- Vendored `claude-seo` skill bundle at `vendor/claude-seo/` consumed by Prism agents via a `skills_loader`
- `.claude/` directory and `CLAUDE.md` for cross-session continuity

### 1.3 What this spec is NOT

Deferred to later sub-projects (each gets its own spec → plan → implementation cycle):

| Sub-project | Owns |
|---|---|
| 2. Orchestrator | Advanced orchestrator features (Gate-0 review UI, plan editing, re-planning) |
| 3. Research sprint | Real `competitor`, `content_audit`, `llm_visibility` agents; DataForSEO integration hardening; Gate-1 review UI; OpenTelemetry |
| 4. Semantic clustering | Embeddings pipeline, HDBSCAN, pgvector usage, Gate-2 cluster tree |
| 5. Content generation + GEO | Content writer, GEO scoring, schema markup, Gate-3 |
| 6. Monitoring | Rank tracker, AI Overview presence, LLMR; Celery beat cron |
| 7. Billing + launch polish | Stripe, landing page, Product Hunt |

### 1.4 Relationship to prior Prism work

A previous attempt at Prism exists at `~/Ideas/Prism-old/`. Per user decision on 2026-04-21, it is **discarded** and not referenced. This spec starts fresh.

---

## 2. Goals and requirements

### 2.1 Functional requirements

- **F1** User can sign in via Clerk (email/password), create a workspace (name + target domain), and enter a traffic goal.
- **F2** Submitting a goal creates an `orchestrator` job row and returns immediately (202 + job_id).
- **F3** The orchestrator agent makes a live Claude API call (`claude-sonnet-4-6`) with structured output, producing a `Plan { intent, domain, competitors[], timeline_weeks, sprint_order[] }`.
- **F4** On orchestrator completion, a `sprint` job is created and a Celery chord dispatches 4 child tasks: `keyword` (live via DataForSEO), `competitor`, `content_audit`, `llm_visibility` (stubs).
- **F5** Each child task persists its result and transitions the job row's status.
- **F6** A `finalize` task rolls up child results into the sprint job's terminal status (`complete` or `complete_with_errors`).
- **F7** The web UI shows a live job-status board with 5 lanes (orchestrator + 4 research) transitioning through states, updated via SSE.
- **F8** Failed retryable jobs surface a Retry button; the child task can be re-enqueued individually.
- **F9** Light/dark/system theme toggle persists per user and follows OS preference when set to system.

### 2.2 Non-functional requirements

- **NF1** Orchestrator Claude call never runs in an HTTP request worker (always in Celery).
- **NF2** DataForSEO responses are cached in Redis with 24h TTL, keyed on normalized request body.
- **NF3** Concurrent DataForSEO calls per worker process are capped at `DATAFORSEO_CONCURRENCY=5`.
- **NF4** Concurrent Celery agent tasks per workspace are capped at `AGENT_CONCURRENCY_PER_WORKSPACE=3`.
- **NF5** No Celery task ever raises unhandled at the task boundary; all errors are caught, classified, persisted to `jobs.error`, and returned as sentinels so chord callbacks fire.
- **NF6** Every `jobs.status` transition emits a Postgres `NOTIFY job_events` with JSON payload for SSE forwarding.
- **NF7** Full local dev setup runs on a single machine from `docker compose up -d` + 3 pnpm/uvicorn/celery commands.
- **NF8** Unhandled exceptions in FastAPI, Celery, and Next.js are reported to Sentry with taxonomy tags.

### 2.3 Explicitly out of scope for Foundation

- Deployment configs (Vercel, Railway, Docker production images)
- OpenTelemetry / distributed tracing
- FastAPI-level request rate limiting (`slowapi` or similar)
- GitHub Actions CI (repo stays local)
- Playwright / E2E tests
- OpenAI API client (no embeddings needed yet)
- Stripe / billing
- Celery beat / scheduled jobs

---

## 3. Architecture

### 3.1 Monorepo layout

```
prism/
├── apps/
│   ├── api/                       Python 3.12 · FastAPI · Celery
│   │   ├── app/
│   │   │   ├── main.py            FastAPI entrypoint (async)
│   │   │   ├── core/
│   │   │   │   ├── config.py      pydantic-settings, reads .env
│   │   │   │   ├── db.py          SQLAlchemy async engine + session
│   │   │   │   ├── sentry.py      Sentry init (FastAPI + Celery hooks)
│   │   │   │   ├── events.py      Postgres LISTEN/NOTIFY for SSE stream
│   │   │   │   └── jobs.py        transition() — single choke-point for status changes
│   │   │   ├── models/            SQLAlchemy models
│   │   │   ├── routes/            workspaces.py, jobs.py, webhooks.py
│   │   │   ├── agents/
│   │   │   │   ├── base.py        BaseAgent abstract
│   │   │   │   ├── orchestrator.py
│   │   │   │   ├── keyword.py     live (uses skills_loader + DataForSEO)
│   │   │   │   ├── stubs.py       competitor/content_audit/llm_visibility stubs
│   │   │   │   └── prompts/
│   │   │   │       └── orchestrator.md
│   │   │   ├── skills/
│   │   │   │   └── loader.py      reads vendor/claude-seo/skills/*/SKILL.md
│   │   │   ├── integrations/
│   │   │   │   └── dataforseo.py  HTTPX client + Redis cache + semaphore
│   │   │   └── workers/
│   │   │       ├── celery_app.py  Celery factory
│   │   │       └── tasks.py       task definitions
│   │   ├── alembic/               migrations
│   │   ├── tests/                 pytest
│   │   └── pyproject.toml
│   └── web/                       Next.js 16 · App Router · React · Tailwind · shadcn/ui
│       ├── app/
│       │   ├── (auth)/            sign-in, sign-up
│       │   ├── (app)/
│       │   │   ├── workspaces/new         create workspace
│       │   │   └── workspaces/[id]/       goal input + job board
│       │   └── api/webhooks/clerk/        Clerk → FastAPI webhook proxy
│       ├── components/
│       │   ├── ui/                        shadcn primitives
│       │   ├── theme-provider.tsx         next-themes wrapper
│       │   ├── theme-toggle.tsx           sun/moon/laptop dropdown
│       │   ├── goal-input.tsx
│       │   └── job-board.tsx
│       ├── lib/
│       │   ├── api.ts                     typed fetch client
│       │   └── sse.ts                     EventSource hook
│       └── package.json
├── packages/
│   └── types/                     shared TS: Job, Workspace, Plan, AgentStatusEvent, ErrorKind
├── vendor/
│   └── claude-seo/                committed copy (prompts + scripts + skills)
├── .claude/
│   ├── settings.json
│   └── commands/                  /workspace, /goal, /agent
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-04-21-foundation-design.md   (this file)
├── docker-compose.yml             postgres(pgvector) · redis · pgbouncer
├── .env.example
├── .gitignore
├── pnpm-workspace.yaml
├── turbo.json
├── CLAUDE.md                      vision + architecture + how-to-run + what's next
└── README.md
```

### 3.2 Request → response flow (chord pipeline)

```
Browser
  │  1. POST /workspaces/{id}/jobs  { goal: "..." }
  ▼
FastAPI (apps/api)
  │  2. INSERT jobs (type=orchestrator, status=pending)
  │  3. orchestrator_task.delay(job_id)
  │  4. 202 Accepted { job_id }
  ▼
Celery worker
  │  5. orchestrator_task:
  │       - load vendor/claude-seo/skills/seo-plan/SKILL.md (optional context)
  │       - call claude-sonnet-4-6 with structured output
  │       - INSERT plans
  │       - transition orchestrator job → complete  (NOTIFY)
  │       - INSERT sprint job (type=sprint, status=pending, parent=orchestrator)
  │       - dispatch:
  │            chord(
  │              [keyword_task, competitor_stub, content_audit_stub, llm_visibility_stub],
  │              body=finalize_task.s(sprint_job_id)
  │            ).on_error(finalize_error.s(sprint_job_id))
  │
  │  6. keyword_task (live):
  │       - load SKILL.md "seo-dataforseo" as system-prompt fragment
  │       - DataForSEO keywords endpoint (Redis-cached, semaphore-limited)
  │       - Claude re-rank by priority score
  │       - persist result, transition → complete (NOTIFY)
  │       - return {ok: True, child_job_id}
  │
  │  7. competitor/content_audit/llm_visibility_stub:
  │       - sleep 2–5s, persist fake result, transition → complete (NOTIFY)
  │       - return {ok: True, child_job_id}
  │
  │  8. finalize_task(results, sprint_job_id):
  │       - if all ok → sprint.status = complete (NOTIFY)
  │       - else → sprint.status = complete_with_errors (NOTIFY)
  ▼
FastAPI SSE endpoint  GET /jobs/{id}/events
  │  9. asyncpg LISTEN job_events emits JSON deltas
  ▼
Browser (job-board.tsx)
     10. each delta flips lane state: pending → running → complete/failed
```

### 3.3 Cross-cutting

**Auth.** Clerk `<ClerkProvider>` wraps `app/layout.tsx`; `middleware.ts` protects `/(app)/*`. Clerk webhook hits Next.js `/api/webhooks/clerk`, which proxies to FastAPI `/webhooks/clerk` for DB sync.

**Theming.** `next-themes` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`. shadcn CSS tokens switch on `.dark`/`.light`.

**Local dev processes:**

| Process | Command |
|---|---|
| Infra | `docker compose up -d` |
| API | `uvicorn app.main:app --reload` (:8000) |
| Celery worker | `celery -A app.workers.celery_app worker -l info -c 4` |
| Web | `pnpm --filter @prism/web dev` (:3000) |

---

## 4. Components

Each component specified as **purpose → interface → dependencies**.

### 4.1 Agent runtime

**`BaseAgent`** (`apps/api/app/agents/base.py`)
- **Purpose:** Abstract contract for all Prism agents. Owns Claude API call, prompt assembly (core + optional skill), retry/timeout policy. Not Celery-aware.
- **Interface:** `async run(self, input: AgentInput) -> AgentOutput`. Subclasses set `CORE_PROMPT: str` and optionally `BACKING_SKILL: str | None`. Internal `_call_claude(system, user, response_model)` uses pydantic for structured output.
- **Depends on:** Anthropic SDK, `skills_loader`, `core.config`.

**`skills_loader`** (`apps/api/app/skills/loader.py`)
- **Purpose:** Read `vendor/claude-seo/skills/<name>/SKILL.md`, strip frontmatter, return body as prompt fragment. LRU-cache in-process.
- **Interface:** `load_skill_prompt(name: str) -> str`. Raises `SkillNotFoundError`.
- **Depends on:** `$CLAUDE_SEO_PATH` env (default `./vendor/claude-seo`).

**`OrchestratorAgent`** (`apps/api/app/agents/orchestrator.py`)
- **Purpose:** Parse NL goal → structured `Plan`.
- **Interface:** `async run(goal: str, workspace: Workspace) -> Plan`. No DB side effects.
- **Depends on:** `BaseAgent`, `agents/prompts/orchestrator.md`, `skills_loader` (optional `seo-plan`).

**`KeywordAgent`** (`apps/api/app/agents/keyword.py`)
- **Purpose:** DataForSEO keyword pull + Claude re-rank → `KeywordResult { keywords: [{term, volume, difficulty, priority_score}] }`. Declares `BACKING_SKILL = "seo-dataforseo"`.
- **Interface:** `async run(plan: Plan) -> KeywordResult`.
- **Depends on:** `BaseAgent`, `integrations.dataforseo`, `skills_loader`.

**`stubs.py`** (`apps/api/app/agents/stubs.py`)
- **Purpose:** `CompetitorStub`, `ContentAuditStub`, `LLMVisibilityStub`. Sleep 2–5s, return fixed fake result. Same `async run(plan) -> dict` shape as real agents.
- **Depends on:** Nothing.

### 4.2 Infrastructure glue

**`integrations/dataforseo.py`**
- **Purpose:** Async HTTPX client for DataForSEO. Redis 24h cache, asyncio semaphore, `tenacity` retry.
- **Interface:** `async client.keywords_for_keywords(seeds) -> list[KeywordRow]`, `async client.serp_organic(q) -> SerpResponse`.
- **Depends on:** `httpx`, `redis.asyncio`, `tenacity`, creds from `core.config`.

**`workers/celery_app.py` + `workers/tasks.py`**
- **Purpose:** Celery 5 app factory + task definitions. Thin wrappers around async agents (`asyncio.run(agent.run(...))`).
- **Tasks:**
  - `orchestrator_task(job_id)` — parses, persists plan, dispatches chord.
  - `keyword_task(plan_id, sprint_job_id)` — live.
  - `competitor_stub_task`, `content_audit_stub_task`, `llm_visibility_stub_task` — stubs.
  - `finalize_task(child_results, sprint_job_id)` — rollup, never raises.
  - `finalize_error_task(context, sprint_job_id)` — chord error fallback.
- **Contract:** Every task catches `Exception`, classifies, persists, returns a sentinel dict — never raises past the boundary.
- **Depends on:** Redis broker, Postgres result backend, Sentry Celery integration.

**`core/events.py` + SSE endpoint** (`routes/jobs.py::stream_events`)
- **Purpose:** asyncpg `LISTEN job_events` on a dedicated connection; forward NOTIFY payloads as SSE frames. Filter server-side by `workspace_id` / `job_id`.
- **Interface:** `GET /jobs/{id}/events` → `text/event-stream`.
- **Depends on:** asyncpg, FastAPI `StreamingResponse`.

**`core/jobs.py::transition`**
- **Purpose:** Single choke-point for `jobs.status` mutations. Records `started_at`/`completed_at`, issues `NOTIFY`, rejects illegal transitions.
- **Interface:** `async transition(session, job, new_status, *, result=None, error=None) -> Job`.
- **Depends on:** SQLAlchemy session, `core.events`.

### 4.3 Frontend shell

**`theme-provider.tsx`** — `next-themes` wrapper, `defaultTheme="system"`, `attribute="class"`.

**`ThemeToggle`** — shadcn dropdown, sun/moon/laptop icons, three options.

**`goal-input.tsx`** — controlled Textarea + 3 example chips. Submit → `POST /workspaces/{id}/jobs`. Disabled while workspace has an in-flight orchestrator job.

**`job-board.tsx`** — SWR initial fetch → EventSource for deltas. 5-lane pipeline (Orchestrator → [Keyword · Competitor · Content Audit · LLM Visibility]). Per-lane: state badge, elapsed time, result popover, retry button for retryable failures.

**`lib/api.ts`** — typed fetch wrapper, Clerk auth, 4xx→`ApiError`, 5xx→retry-once.

**`lib/sse.ts`** — EventSource hook with auto-reconnect, parses `data:` frames as `AgentStatusEvent`.

### 4.4 Shared types (`packages/types`)

```ts
export type JobType =
  | 'orchestrator' | 'sprint' | 'keyword' | 'competitor'
  | 'content_audit' | 'llm_visibility' | 'finalize';

export type JobStatus =
  | 'pending' | 'running' | 'complete' | 'complete_with_errors' | 'failed';

export type ErrorKind =
  | 'rate_limit' | 'timeout' | 'external_error'
  | 'invalid_output' | 'invalid_input' | 'bug';

export interface JobError {
  kind: ErrorKind;
  message: string;
  retryable: boolean;
  provider?: string;
  traceId?: string;
}

export interface Job {
  id: string;
  workspaceId: string;
  parentJobId: string | null;
  type: JobType;
  status: JobStatus;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: JobError | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Plan {
  jobId: string;
  workspaceId: string;
  intent: string;
  domain: string;
  competitors: string[];
  timelineWeeks: number;
  sprintOrder: JobType[];
}

export interface Workspace {
  id: string;
  userId: string;
  orgId: string | null;
  name: string;
  domain: string;
}

export interface AgentStatusEvent {
  jobId: string;
  parentJobId: string | null;
  workspaceId: string;
  type: JobType;
  status: JobStatus;
  at: string;
  error: JobError | null;
}
```

---

## 5. Data model

### 5.1 Tables

**`users`** (Clerk-mirrored): `id: text PK` (Clerk user id), `email: text unique`, `name: text`, timestamps.

**`organizations`** (Clerk-mirrored): `id: text PK` (Clerk org id), `name: text`, timestamps.

**`organization_memberships`**: `user_id`, `org_id`, `role: text`, PK `(user_id, org_id)`.

**`workspaces`**: `id: uuid PK`, `user_id: text FK → users NOT NULL`, `org_id: text FK → organizations` (nullable), `name: text NOT NULL`, `domain: text NOT NULL`, timestamps.
- Indexes: `(user_id)`, `(org_id) WHERE org_id IS NOT NULL`.

**`jobs`**: `id: uuid PK`, `workspace_id: uuid FK → workspaces`, `parent_job_id: uuid FK → jobs` (self-ref, nullable), `type: text NOT NULL`, `status: text NOT NULL`, `input: jsonb NOT NULL`, `result: jsonb`, `error: jsonb`, `celery_task_id: text`, `started_at: timestamptz`, `completed_at: timestamptz`, timestamps.
- Indexes:
  - `(workspace_id, created_at DESC)` — workspace job feed
  - `(parent_job_id)` — children lookup
  - `(status, type) WHERE status IN ('pending', 'running')` — active-work partial index
  - GIN on `result` — future payload queries

**`plans`**: `id: uuid PK`, `job_id: uuid FK → jobs UNIQUE`, `workspace_id: uuid FK → workspaces`, `intent: text`, `domain: text`, `competitors: jsonb`, `timeline_weeks: int`, `sprint_order: jsonb`, `created_at: timestamptz`.

### 5.2 Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- enabled early; unused in Foundation
```

### 5.3 Job lifecycle

```
                ┌── failed
                │
pending ──→ running ──→ complete
                │
                └── complete_with_errors  (sprint jobs only)
```

- Only `sprint` jobs use `complete_with_errors`.
- Every `status` mutation goes through `core/jobs.py::transition` which also issues `NOTIFY`.
- Illegal transitions (e.g. `complete → running`) raise.

### 5.4 Job tree per user submission

```
orchestrator  (root, parent_job_id=NULL)
└─ sprint     (parent_job_id=orchestrator.id)
   ├─ keyword          (parent_job_id=sprint.id)
   ├─ competitor       (parent_job_id=sprint.id)
   ├─ content_audit    (parent_job_id=sprint.id)
   ├─ llm_visibility   (parent_job_id=sprint.id)
   └─ finalize         (parent_job_id=sprint.id)
```

### 5.5 NOTIFY payload

```json
{
  "job_id": "...",
  "parent_job_id": "...",
  "workspace_id": "...",
  "type": "keyword",
  "status": "complete",
  "at": "2026-04-21T18:42:03Z",
  "error": null
}
```

---

## 6. Error handling + rate limiting

### 6.1 Principle

Fail loud at the code level, fail structured at the job level. No dead Celery tasks; every failure becomes a row with a typed `JobError` that `finalize` can reason about.

### 6.2 Error taxonomy (`ErrorKind`)

| Kind | Meaning | Retryable? | Example |
|---|---|---|---|
| `rate_limit` | 429 / quota exceeded | ✅ | Claude, DataForSEO |
| `timeout` | external call exceeded deadline | ✅ | HTTPX, Anthropic SDK |
| `external_error` | 5xx or transport failure | ✅ | DataForSEO 503 |
| `invalid_output` | Claude structured output failed pydantic validation | ✅ (once) | orchestrator |
| `invalid_input` | user goal unparseable | ❌ | orchestrator |
| `bug` | unexpected exception | ❌ | anything with a stack trace |

### 6.3 Chord-failure contract (load-bearing)

Every child task in the chord follows this pattern:

```python
@celery_app.task(bind=True, name="agents.keyword")
def keyword_task(self, plan_id: str, sprint_job_id: str) -> dict:
    child_job = create_child_job(type="keyword", parent_job_id=sprint_job_id, input={"plan_id": plan_id})
    transition(child_job, "running")
    try:
        result = asyncio.run(KeywordAgent().run(load_plan(plan_id)))
        transition(child_job, "complete", result=result)
        return {"child_job_id": child_job.id, "ok": True}
    except Exception as exc:
        err = classify(exc)
        transition(child_job, "failed", error=err)
        sentry_sdk.capture_exception(exc)
        return {"child_job_id": child_job.id, "ok": False, "error": err}
```

**Rule:** the `except Exception` is deliberately broad. A child must always return. Raising would leave the chord stuck forever.

`finalize_task` rolls up:

```python
@celery_app.task(name="agents.finalize")
def finalize_task(child_results: list[dict], sprint_job_id: str):
    if all(r["ok"] for r in child_results):
        transition_sprint(sprint_job_id, "complete")
    else:
        transition_sprint(sprint_job_id, "complete_with_errors")
```

Belt-and-suspenders: the chord is dispatched with `.on_error(finalize_error_task.s(sprint_job_id))` so broker-level failures still emit a terminal transition.

### 6.4 Rate limiting — layers and decisions

| Layer | Mechanism | Foundation? |
|---|---|---|
| Prism public API | `slowapi` — e.g. 10 `POST /jobs` per workspace per hour | ❌ Deferred |
| Per-workspace Celery concurrency | Redis-backed semaphore, cap `AGENT_CONCURRENCY_PER_WORKSPACE=3` | ✅ |
| Claude API | Anthropic SDK `max_retries=3`, respects `retry-after`, exp backoff | ✅ Config only |
| DataForSEO — demand reduction | Redis 24h cache keyed on normalized request body | ✅ |
| DataForSEO — concurrency | `asyncio.Semaphore(DATAFORSEO_CONCURRENCY=5)` per worker process | ✅ |
| DataForSEO — 429/5xx | `tenacity` retry 3× exp(1,2,4)+jitter, respect `Retry-After` | ✅ |
| Per-agent hard timeouts | `CLAUDE_TIMEOUT=60s`, `DATAFORSEO_TIMEOUT=45s`, Celery `soft_time_limit=120s` / `time_limit=180s` | ✅ |

### 6.5 Retry policy

Retries live inside the agent/integration layer where they have context. No Celery-level retry by default.

| Kind | Retries | Backoff | Where |
|---|---|---|---|
| `rate_limit` (Claude) | 3 | SDK default + `retry-after` | Anthropic SDK |
| `rate_limit` (DataForSEO) | 3 | exp(1,2,4) + `Retry-After` | HTTPX client |
| `timeout` | 2 | exp(2,5) | HTTPX client |
| `external_error` | 2 | exp(2,5) | HTTPX client |
| `invalid_output` | 1 | immediate, re-prompt with "prior output failed validation" | `BaseAgent._call_claude` |
| `invalid_input`, `bug` | 0 | — | — |

### 6.6 UI presentation

- `failed` + `retryable` → red badge + **Retry** button (`POST /jobs/{id}/retry` re-enqueues that single child)
- `failed` + not retryable → red badge + "View error" popover
- `complete_with_errors` on sprint → amber badge; user can proceed with partial data

### 6.7 Observability

- Sentry: every non-retryable error and every exhausted-retry error fires `capture_exception(..., tags={kind, provider, workspace_id, job_type})`
- Structured JSON logs: one line per state transition (`job.id`, `job.type`, `job.status`, `elapsed_ms`, `error.kind`)
- OpenTelemetry deferred to Research-sprint sub-project

### 6.8 Accepted risks

| Risk | Mitigation | Accepted? |
|---|---|---|
| Claude returns valid JSON but semantically wrong plan | pydantic validates shape only; add Gate-0 review UI in Orchestrator sub-project if it bites | 🟡 |
| DataForSEO quietly returns empty arrays | Treat empty as `external_error` | ✅ |
| Redis down | Semaphore fails open (run anyway); cache fails closed (force live call) | ✅ |
| Clerk webhook race | On 404 in job create, lazy-pull user from Clerk API | ✅ |

---

## 7. Testing strategy

### 7.1 Pyramid (Foundation)

- **E2E / Playwright:** deferred
- **Integration (~15 tests):** pytest against real Postgres + Redis from docker-compose; Vitest component tests
- **Unit (~40 tests):** pytest with mocked external I/O; Vitest for hooks + pure utilities

### 7.2 Python — pytest

**Framework:** `pytest`, `pytest-asyncio`, `pytest-mock`, `respx`, `celery[pytest]`. Unit-level Celery tests use `CELERY_TASK_ALWAYS_EAGER=True`; the chord contract test runs a real worker.

**Fixtures (`apps/api/tests/conftest.py`):** `db_session`, `redis`, `mock_claude`, `mock_dataforseo` (respx), `skills_dir` (tiny fixture SKILL.md files).

**Key unit tests:**

| Module | Cases |
|---|---|
| `skills_loader` | loads + strips frontmatter; caches; `SkillNotFoundError` |
| `BaseAgent._call_claude` | prompt assembly; pydantic fail → `invalid_output`; single retry w/ prior-output appended |
| `classify(exc)` | table-driven, every exception type → expected `kind` |
| `integrations.dataforseo` | 429 retry; 5xx retry; cache hit; semaphore caps concurrency |
| `core/jobs.py::transition` | `started_at`/`completed_at` correctness; NOTIFY shape; rejects illegal transitions |
| `OrchestratorAgent.run` | valid goal → Plan; gibberish → `invalid_input` |
| `KeywordAgent.run` | happy path; empty DataForSEO array → `external_error` |
| Celery task wrappers | child always returns; `{ok: False, error}` on exception; job row updated before return |

**Integration tests:**

| Scenario | Proves |
|---|---|
| Full pipeline happy path | POST → chord → all children → finalize → sprint `complete`; parent/child tree correct |
| One child fails | `competitor_stub` returns `{ok: False}` → sprint `complete_with_errors`; others still `complete` |
| **Child raises (contract violation)** | Patch a child to `raise` → Sentry capture called AND chord completes via `on_error` |
| NOTIFY stream | asyncpg LISTEN → drive job → N events in order |
| Orchestrator rate-limited | `mock_claude` 429 3× then succeed → job completes, no spurious `failed` |

**The child-raises test is the single most important test in Foundation.**

### 7.3 Frontend — Vitest + RTL

- `theme-provider` + `ThemeToggle` — system/light/dark cycling flips `html.class`, persists
- `GoalInput` — enable/disable, chip fills, submit posts
- `JobBoard` — given event stream → lanes transition; retry button calls retry endpoint
- `lib/sse.ts` — EventSource open/close, parses frames

Not tested: shadcn primitives, CSS, Clerk flows (mocked at module boundary).

### 7.4 TDD commitment

| Area | TDD? |
|---|---|
| `classify(exc)`, `skills_loader`, `core/jobs.py::transition`, chord-contract test | **Yes** |
| Agent classes | Test-first on structured-output shape; implementation-first on prompt content |
| UI components | Test-alongside, not test-first |
| Integration scenarios above | **Yes** (acceptance criteria) |

### 7.5 CI and performance budgets

- **CI:** not in Foundation (local repo). Makefile targets `make test` runs `pytest` + `pnpm test`.
- **Python test budget:** unit + integration (with docker-compose running) < 30s
- **Vitest budget:** < 15s

### 7.6 Deliberately not tested in Foundation

Playwright E2E; load; security (Clerk + env creds handle it); visual regression (theme toggle is all the design there is).

---

## 8. Configuration and environment

### 8.1 `.env.example`

```
# Claude
ANTHROPIC_API_KEY=

# DataForSEO
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=
DATAFORSEO_CONCURRENCY=5
DATAFORSEO_TIMEOUT=45

# Database
DATABASE_URL=postgresql+asyncpg://prism:prism@localhost:5433/prism  # PgBouncer port
POSTGRES_DIRECT_URL=postgresql+asyncpg://prism:prism@localhost:5432/prism  # for migrations

# Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# Concurrency
AGENT_CONCURRENCY_PER_WORKSPACE=3
CLAUDE_TIMEOUT=60

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Sentry
SENTRY_DSN_API=
SENTRY_DSN_WEB=

# Vendored claude-seo
CLAUDE_SEO_PATH=./vendor/claude-seo
```

### 8.2 `docker-compose.yml` services

- `postgres`: `pgvector/pgvector:pg16`, exposed 5432
- `pgbouncer`: exposed 5433, transaction pool, 200 max connections
- `redis`: `redis:7-alpine`, exposed 6379

### 8.3 `.claude/` and `CLAUDE.md`

`CLAUDE.md` lives at the monorepo root and is a deliverable of Foundation. It contains:
- Prism product vision (one paragraph)
- Monorepo layout and where to add new modules
- Tech stack table
- Agent pipeline diagram (this spec's §3.2)
- Agent ↔ skill mapping (for the 3 future sub-projects that will need it)
- Coding conventions (async/await in FastAPI routes, sync in Celery tasks, never block HTTP on external APIs)
- Local dev startup commands
- Scalability decisions already baked in (concurrency caps, cache, PgBouncer)
- Current sub-project status and what's next

`.claude/settings.json` seeds sensible permissions (pnpm, uv, python, celery, alembic, docker compose, pytest, vitest, git) so future sessions don't have to re-approve routine commands.

`.claude/commands/` stubs:
- `/workspace <domain> "<goal>"` — end-to-end run shortcut
- `/agent <name> [inputs]` — invoke a Prism agent directly
- `/migrate [up|down|new]` — alembic wrapper

---

## 9. Migration of claude-seo

Per decision: move `/Users/mohit/Ideas/Prism/claude-seo/` → `/Users/mohit/Ideas/prism/vendor/claude-seo/` as a committed-in copy. Delete the now-empty `/Users/mohit/Ideas/Prism/` (it contains only `test.html` which is empty).

The loader reads via `$CLAUDE_SEO_PATH` env var so a future switch to git submodule requires no code changes.

---

## 10. Decisions log

| # | Decision | Rationale |
|---|---|---|
| D1 | Discard Prism-old | User instruction 2026-04-21; fresh start |
| D2 | Brainstorm Foundation first (decomposition option a) | Lock `BaseAgent` contract and job state machine before any agent is written |
| D3 | Scope C (plumbing + live orchestrator + 1 live research agent) | Forces real `skills_loader` implementation; other agents copy-paste the proven pattern later |
| D4 | Next.js 16 | User override from suggested 15 |
| D5 | Pattern 1 for claude-seo reuse (vendored + prompt loader) | Single source of truth; Python scripts importable; upstream updates via manual `cp` for MVP |
| D6 | Committed copy under `vendor/claude-seo/` (not submodule) | Simpler MVP; loader is path-agnostic so we can switch later |
| D7 | Approach 3: Celery chord with finalize callback | User preference; "sprint complete" becomes a first-class moment for future Gate-1 hook |
| D8 | Chord-failure contract: children never raise, always return sentinel | Required for chord to complete on partial failure |
| D9 | Separate `sprint` job (not reusing orchestrator as parent of children) | Keeps orchestrator's own lifecycle honest; `complete_with_errors` lives only on sprints |
| D10 | Sentry in Foundation; OpenTelemetry deferred to Research-sprint | Sentry near-zero overhead, high value; OTel needs parallel real agents to earn its keep |
| D11 | `slowapi` deferred past Foundation | Single-user volume |
| D12 | pgvector extension enabled in initial migration | Avoids second migration when Clustering sub-project arrives |
| D13 | Claude model: `claude-sonnet-4-6` | Fast, cheap, reliable structured output |
| D14 | OpenAI client deferred | Not needed until Clustering sub-project |
| D15 | No GitHub push in Foundation | User preference — lightest-weight start |

---

## 11. Open questions and follow-ups

- **Plan shape evolution:** will `sprint_order` ever be reorderable by the user pre-dispatch? (Deferred to Orchestrator sub-project — Gate-0 review UI.)
- **Workspace domain verification:** is the user's target domain something we verify (DNS, analytics tag, Clerk metadata) or trust? Foundation trusts. Revisit when we integrate Google Search Console OAuth.
- **Per-user DataForSEO creds:** do users bring their own DataForSEO keys, or does Prism pay? Assumed global creds for Foundation; becomes a billing decision in sub-project 7.

---

## 12. Acceptance criteria for Foundation

Foundation is done when, with only `docker compose up -d` and three process commands, from a blank checkout a user can:

1. Sign in via Clerk at `http://localhost:3000/sign-in`
2. Create a workspace (name + target domain)
3. Submit a traffic goal
4. Watch the orchestrator lane transition pending → running → complete
5. Watch 4 research lanes transition via SSE; one of them (`keyword`) returns real DataForSEO-sourced keywords
6. See the sprint lane transition to `complete` (or `complete_with_errors` if a child failed)
7. If a retryable failure occurs, click Retry and see the child re-enqueue
8. Toggle light/dark/system theme; OS preference honored when on system

And:

- All unit + integration tests pass (`make test` exits 0 in < 45s)
- Sentry captures a deliberately-thrown exception in both FastAPI and Celery
- A child task that `raise`s unexpectedly still results in sprint terminating (proves chord contract)
- Killing the Celery worker mid-sprint and restarting it results in the sprint eventually completing (tasks still in Redis, workers pick them up)

---

## 13. Next steps

1. User reviews this spec.
2. On approval, invoke `superpowers:writing-plans` to produce the implementation plan (checkpointed, task-ordered).
3. On plan approval, execute per `superpowers:executing-plans` (likely parallelized with `subagent-driven-development` for independent slices — Docker setup, Alembic migrations, shadcn bootstrap, Clerk wiring).
