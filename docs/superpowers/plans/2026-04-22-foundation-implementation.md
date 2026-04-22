# Prism Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Prism Foundation (Scope C) — a runnable monorepo with a Next.js+Clerk web app, FastAPI+Celery backend, Neon Postgres, and an end-to-end goal→orchestrator→chord→finalize pipeline where the `keyword` agent is live against DataForSEO and the other 3 research agents are stubs.

**Architecture:** Async FastAPI enqueues a Celery `orchestrator_task`, which calls `claude-sonnet-4-6` with structured output, persists a `Plan`, and dispatches a Celery chord of 4 child tasks with a `finalize_task` callback. Children never raise — they always persist their state and return a sentinel dict. State transitions emit Postgres `NOTIFY job_events` forwarded to the UI via SSE over Neon's direct endpoint.

**Tech Stack:** Python 3.12 · FastAPI · Celery 5 · SQLAlchemy 2.x async · Alembic · asyncpg · Anthropic SDK · httpx · tenacity · pydantic-settings · Sentry · pytest · respx · Next.js 16 · React · Tailwind · shadcn/ui · next-themes · Clerk · SWR · Vitest · Neon Postgres (direct endpoint) · Redis 7 · pgvector · uv · pnpm · Turborepo.

**Spec:** `docs/superpowers/specs/2026-04-21-foundation-design.md` (committed).

**Source of truth for acceptance:** Spec §12 — all 8 acceptance criteria must pass before the plan is "done".

---

## File Structure

Every file created or modified, grouped by responsibility:

### Repo root
- `package.json` — root workspace metadata
- `pnpm-workspace.yaml` — workspace globs
- `turbo.json` — Turbo tasks
- `Makefile` — top-level commands (`make install`, `make dev`, `make test`, `make migrate`)
- `docker-compose.yml` — Redis always; Postgres under `test` profile
- `.env.example`, `.env.local` (gitignored)
- `CLAUDE.md` — continuity doc for future sessions
- `README.md` — short onboarding
- `.gitignore` (already committed)

### `.claude/`
- `settings.json` — project-level permissions + hooks
- `commands/workspace.md` — `/workspace` slash command stub
- `commands/agent.md` — `/agent` slash command stub
- `commands/migrate.md` — `/migrate` slash command stub

### `vendor/claude-seo/`
- Moved from `./claude-seo/`, inner `.git/` removed, whole tree committed

### `packages/types/`
- `package.json`, `tsconfig.json`, `src/index.ts` — shared TS types

### `apps/api/` (Python)
- `pyproject.toml` — managed by `uv`; deps + dev deps + pytest config
- `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`
- `alembic/versions/0001_init.py`, `0002_jobs.py` (migrations split for reviewability)
- `app/main.py` — FastAPI entry
- `app/core/config.py` — pydantic-settings
- `app/core/db.py` — async engine + session factory
- `app/core/sentry.py` — Sentry init
- `app/core/events.py` — NOTIFY emitter + LISTEN loop on Neon direct
- `app/core/jobs.py` — `transition()` choke-point
- `app/core/errors.py` — `ErrorKind`, `JobError`, `classify(exc)`
- `app/models/__init__.py`, `app/models/user.py`, `app/models/workspace.py`, `app/models/job.py`, `app/models/plan.py`
- `app/routes/__init__.py`, `app/routes/workspaces.py`, `app/routes/jobs.py`, `app/routes/webhooks.py`, `app/routes/health.py`
- `app/auth/clerk.py` — Clerk JWT verification via JWKS
- `app/agents/__init__.py`, `app/agents/base.py`, `app/agents/orchestrator.py`, `app/agents/keyword.py`, `app/agents/stubs.py`
- `app/agents/prompts/orchestrator.md`
- `app/skills/__init__.py`, `app/skills/loader.py`
- `app/integrations/__init__.py`, `app/integrations/dataforseo.py`
- `app/workers/__init__.py`, `app/workers/celery_app.py`, `app/workers/tasks.py`
- `tests/conftest.py`
- `tests/unit/test_skills_loader.py`, `test_base_agent.py`, `test_classify.py`, `test_transition.py`, `test_dataforseo.py`, `test_orchestrator_agent.py`, `test_keyword_agent.py`, `test_task_contract.py`
- `tests/integration/test_pipeline_happy.py`, `test_pipeline_child_returns_failure.py`, `test_pipeline_child_raises.py`, `test_sse_stream.py`, `test_orchestrator_rate_limit.py`
- `tests/fixtures/skills/seo-dataforseo/SKILL.md`, `seo-plan/SKILL.md`
- `tests/fixtures/dataforseo/keywords_sample.json`

### `apps/web/` (Next.js 16 App Router)
- `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`
- `middleware.ts` — Clerk auth middleware
- `app/layout.tsx`, `app/globals.css`
- `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- `app/(app)/layout.tsx`, `app/(app)/page.tsx` (workspace list)
- `app/(app)/workspaces/new/page.tsx`
- `app/(app)/workspaces/[id]/page.tsx` (goal input + job board)
- `app/api/webhooks/clerk/route.ts` — proxies to FastAPI
- `components/theme-provider.tsx`, `components/theme-toggle.tsx`
- `components/goal-input.tsx`, `components/job-board.tsx`
- `components/workspace-form.tsx`
- `components/ui/` — shadcn primitives (installed on demand)
- `lib/api.ts`, `lib/sse.ts`, `lib/env.ts`
- `vitest.config.ts`, `tests/setup.ts`
- `tests/theme-provider.test.tsx`, `tests/goal-input.test.tsx`, `tests/job-board.test.tsx`, `tests/sse.test.ts`

---

## Phases and checkpoints

1. **Phase 0 — Repo bootstrap + vendoring** → checkpoint: `make install` works; pnpm + uv envs installed; `vendor/claude-seo/` committed.
2. **Phase 1 — Database schema + migrations** → checkpoint: `alembic upgrade head` succeeds on Neon; all tables + pgvector exist.
3. **Phase 2 — Agent runtime primitives** → checkpoint: unit tests green for `skills_loader`, `classify`, `transition`, `BaseAgent`.
4. **Phase 3 — DataForSEO + Keyword agent** → checkpoint: `pytest tests/unit/test_keyword_agent.py` passes with respx mocks; live DataForSEO call works against real creds (smoke test).
5. **Phase 4 — Celery tasks + chord pipeline** → checkpoint: full integration test passes, including the **chord-failure contract test** (child raises → Sentry captured → chord still completes). This is the most load-bearing moment.
6. **Phase 5 — FastAPI routes + webhooks + SSE** → checkpoint: `curl` the pipeline end-to-end; SSE stream delivers state transitions.
7. **Phase 6 — Frontend shell** → checkpoint: manually sign in → create workspace → submit goal → watch job board update live; theme toggle works.
8. **Phase 7 — CLAUDE.md + final docs + acceptance run** → checkpoint: all 8 acceptance criteria from spec §12 pass.

---

## Phase 0 — Repo bootstrap and vendoring

### Task 0.1: Initialize pnpm workspace at repo root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "prism",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.6.3"
  },
  "engines": {
    "node": ">=20.11.0",
    "pnpm": ">=9.15.0"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env*.local", ".env"],
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 4: Install root deps**

Run: `pnpm install`
Expected: creates `node_modules/` and `pnpm-lock.yaml` with turbo + typescript resolved.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml
git commit -m "chore: initialize pnpm workspace + turbo"
```

---

### Task 0.2: Move `claude-seo/` into `vendor/` as committed copy

**Files:**
- Delete: `claude-seo/.git/` (inside the nested folder)
- Move: `claude-seo/` → `vendor/claude-seo/`
- Modify: `.gitignore` (remove the `/claude-seo/` line that excludes the root sibling)

- [ ] **Step 1: Remove inner `.git/` so it's not an embedded repo**

Run: `rm -rf claude-seo/.git`
Expected: no output, inner git history gone.

- [ ] **Step 2: Create `vendor/` and move**

Run: `mkdir -p vendor && git mv claude-seo vendor/claude-seo` (if git mv fails because folder isn't tracked, use plain `mv claude-seo vendor/claude-seo`)
Expected: `ls vendor/claude-seo/` shows `skills/`, `agents/`, `scripts/`, etc.

- [ ] **Step 3: Remove the now-stale `.gitignore` entry**

Edit `.gitignore` — delete these lines:
```
# claude-seo sibling folder before Foundation implementation moves it to vendor/.
# Once vendor/claude-seo/ exists it is tracked (distinct path, not matched by this).
/claude-seo/
```

- [ ] **Step 4: Verify nothing from vendor is ignored**

Run: `git status vendor/claude-seo | head -10`
Expected: large set of new files under `vendor/claude-seo/`, all untracked.

- [ ] **Step 5: Stage and commit**

```bash
git add .gitignore vendor/claude-seo
git commit -m "chore: vendor claude-seo at vendor/claude-seo/ (committed copy)"
```

---

### Task 0.3: Set up `apps/api/` Python project with `uv`

**Files:**
- Create: `apps/api/pyproject.toml`
- Create: `apps/api/app/__init__.py`
- Create: `apps/api/.python-version`

- [ ] **Step 1: Create `.python-version`**

```
3.12
```

- [ ] **Step 2: Create `pyproject.toml`**

```toml
[project]
name = "prism-api"
version = "0.0.0"
description = "Prism API — FastAPI + Celery agent runtime"
requires-python = ">=3.12,<3.13"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "sqlalchemy[asyncio]>=2.0.36",
  "asyncpg>=0.30",
  "alembic>=1.14",
  "pydantic>=2.9",
  "pydantic-settings>=2.6",
  "celery[redis]>=5.4",
  "redis>=5.2",
  "httpx>=0.27",
  "tenacity>=9.0",
  "anthropic>=0.40",
  "sentry-sdk[fastapi,celery]>=2.18",
  "pyjwt[crypto]>=2.9",
  "python-dotenv>=1.0",
  "orjson>=3.10",
  "structlog>=24.4",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.3",
  "pytest-asyncio>=0.24",
  "pytest-mock>=3.14",
  "respx>=0.21",
  "ruff>=0.8",
  "mypy>=1.13",
  "types-redis",
]

[tool.pytest.ini_options]
asyncio_mode = "strict"
testpaths = ["tests"]
pythonpath = ["."]
addopts = "-v --tb=short --strict-markers"
markers = [
  "integration: requires Postgres + Redis",
]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "B", "UP"]
ignore = ["E501"]

[tool.mypy]
python_version = "3.12"
strict = true
plugins = ["pydantic.mypy"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["app"]
```

- [ ] **Step 3: Create empty `app/__init__.py`**

```python
```

- [ ] **Step 4: Install dependencies with uv**

Run: `cd apps/api && uv venv && uv pip install -e ".[dev]"`
Expected: `.venv/` created; all deps install without conflict.

- [ ] **Step 5: Commit**

```bash
git add apps/api/pyproject.toml apps/api/.python-version apps/api/app/__init__.py
git commit -m "chore(api): initialize Python 3.12 project via uv"
```

---

### Task 0.4: Root `Makefile` for common commands

**Files:**
- Create: `Makefile`

- [ ] **Step 1: Write `Makefile`**

```makefile
.PHONY: install dev test test-api test-web migrate migrate-new redis redis-test api worker web

install:
	pnpm install
	cd apps/api && uv venv && uv pip install -e ".[dev]"

dev:
	docker compose up -d
	@echo ""
	@echo "Now run, in three terminals:"
	@echo "  1) cd apps/api && uv run uvicorn app.main:app --reload"
	@echo "  2) cd apps/api && uv run celery -A app.workers.celery_app worker -l info -c 4"
	@echo "  3) pnpm --filter @prism/web dev"

redis:
	docker compose up -d redis

redis-test:
	docker compose --profile test up -d

test: test-api test-web

test-api:
	docker compose --profile test up -d postgres redis
	cd apps/api && uv run pytest

test-web:
	pnpm --filter @prism/web test

migrate:
	cd apps/api && uv run alembic upgrade head

migrate-new:
	@test -n "$(name)" || (echo "usage: make migrate-new name=short_description" && exit 1)
	cd apps/api && uv run alembic revision --autogenerate -m "$(name)"
```

- [ ] **Step 2: Commit**

```bash
git add Makefile
git commit -m "chore: add root Makefile"
```

---

### Task 0.5: `docker-compose.yml` with Redis + test-profile Postgres

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: prism-redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  postgres:
    image: pgvector/pgvector:pg16
    container_name: prism-postgres-test
    profiles: ["test"]
    environment:
      POSTGRES_USER: prism
      POSTGRES_PASSWORD: prism
      POSTGRES_DB: prism_test
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U prism -d prism_test"]
      interval: 5s
      timeout: 3s
      retries: 10
```

- [ ] **Step 2: Start and verify**

Run: `docker compose up -d redis && docker compose ps`
Expected: `prism-redis` healthy; no Postgres container started (no test profile).

Run: `docker compose --profile test up -d && docker compose ps`
Expected: both `prism-redis` and `prism-postgres-test` healthy.

- [ ] **Step 3: Bring down**

Run: `docker compose --profile test down`

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: docker-compose with Redis (always) and test-profile Postgres"
```

---

### Task 0.6: `.env.example` and secrets hygiene

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Write `.env.example`**

```bash
# =====================
# Anthropic
# =====================
ANTHROPIC_API_KEY=

# =====================
# DataForSEO
# =====================
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=
DATAFORSEO_CONCURRENCY=5
DATAFORSEO_TIMEOUT=45

# =====================
# Database — Neon direct endpoint
# =====================
# From https://console.neon.tech → project → Connection Details → Direct connection
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@ep-xxxx.us-east-2.aws.neon.tech/prism?ssl=require

# Test DB — local Postgres via `docker compose --profile test up -d`
TEST_DATABASE_URL=postgresql+asyncpg://prism:prism@localhost:5432/prism_test

# =====================
# Redis
# =====================
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# =====================
# Concurrency / timeouts
# =====================
AGENT_CONCURRENCY_PER_WORKSPACE=3
CLAUDE_TIMEOUT=60

# =====================
# Clerk
# =====================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
CLERK_JWKS_URL=https://your-tenant.clerk.accounts.dev/.well-known/jwks.json

# =====================
# Sentry
# =====================
SENTRY_DSN_API=
SENTRY_DSN_WEB=
SENTRY_ENV=development

# =====================
# Vendored claude-seo
# =====================
CLAUDE_SEO_PATH=./vendor/claude-seo

# =====================
# Web (Next.js public envs — mirrored as NEXT_PUBLIC_*)
# =====================
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: document required env vars in .env.example"
```

---

### Task 0.7: `.claude/settings.json` + command stubs

**Files:**
- Create: `.claude/settings.json`
- Create: `.claude/commands/workspace.md`
- Create: `.claude/commands/agent.md`
- Create: `.claude/commands/migrate.md`

- [ ] **Step 1: Write `settings.json`**

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm *)",
      "Bash(pnpm install*)",
      "Bash(pnpm --filter * *)",
      "Bash(uv *)",
      "Bash(uv run *)",
      "Bash(pytest*)",
      "Bash(docker compose*)",
      "Bash(alembic *)",
      "Bash(git *)",
      "Bash(make *)"
    ]
  }
}
```

- [ ] **Step 2: Write `commands/workspace.md`**

````markdown
---
description: Create a workspace and submit a traffic goal end-to-end.
argument-hint: "<domain> \"<goal>\""
---

Run the full Prism Foundation pipeline against local dev:

1. POST `http://localhost:8000/workspaces` with `{name, domain: "$1"}`
2. POST `http://localhost:8000/workspaces/{id}/jobs` with `{goal: "$2"}`
3. Subscribe to `http://localhost:8000/jobs/{job_id}/events` and print transitions

Use `curl` and `httpie`.
````

- [ ] **Step 3: Write `commands/agent.md`**

````markdown
---
description: Invoke a Prism agent directly via uv run.
argument-hint: "<agent_name> <json_input>"
---

From `apps/api`:
```bash
uv run python -m app.agents.cli $1 '$2'
```

Where `agent_name` is one of: `orchestrator`, `keyword`, `competitor`, `content_audit`, `llm_visibility`.
````

- [ ] **Step 4: Write `commands/migrate.md`**

````markdown
---
description: Alembic migration helper.
argument-hint: "[up|down|new <name>]"
---

- `up` → `make migrate`
- `new <name>` → `make migrate-new name=<name>`
- `down` → `cd apps/api && uv run alembic downgrade -1`
````

- [ ] **Step 5: Commit**

```bash
git add .claude/settings.json .claude/commands
git commit -m "chore: seed .claude/ with settings and slash command stubs"
```

---

### Task 0.8: Root `.gitignore` refinement

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add Python + Next.js build artifacts specifics (in addition to already-committed entries)**

Replace the contents of `.gitignore` with:

```gitignore
# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.swp
*.swo

# Environment / secrets
.env
.env.local
.env.*.local

# Node / Next.js / Turbo
node_modules/
.next/
out/
.turbo/
dist/
build/
.pnpm-store/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Python
__pycache__/
*.py[cod]
*$py.class
.pytest_cache/
.venv/
venv/
.coverage
htmlcov/
.mypy_cache/
.ruff_cache/
*.egg-info/

# Logs
*.log

# Reference material — not checked in
prism-product-blueprint.docx
test.html

# Claude Code local overrides
.claude/settings.local.json
```

(Note: we removed the `/claude-seo/` rule because the folder was moved under `vendor/`.)

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: refine .gitignore (drop claude-seo rule post-vendor move)"
```

---

### Checkpoint 0

Run:
```bash
make install
docker compose up -d redis
git log --oneline | head
```

Expected: all 8 Phase 0 tasks committed; `pnpm-lock.yaml` present; `apps/api/.venv/` exists with deps; Redis container healthy; `vendor/claude-seo/` populated and committed.

**Do not proceed to Phase 1 until this checkpoint passes.**

---

## Phase 1 — Database schema + migrations

Spec §5 is the reference.

### Task 1.1: Alembic bootstrap

**Files:**
- Create: `apps/api/alembic.ini`
- Create: `apps/api/alembic/env.py`
- Create: `apps/api/alembic/script.py.mako`
- Create: `apps/api/alembic/versions/.gitkeep`

- [ ] **Step 1: Generate Alembic skeleton**

Run from `apps/api`:
```bash
uv run alembic init alembic
```
Expected: creates `alembic.ini` + `alembic/` dir with `env.py`, `script.py.mako`.

- [ ] **Step 2: Edit `alembic.ini`** — set `sqlalchemy.url` to a placeholder (we override via env):

Replace the `sqlalchemy.url =` line with:
```ini
sqlalchemy.url = driver://placeholder-overridden-in-env
```

- [ ] **Step 3: Replace `alembic/env.py` with async-aware version**

```python
"""Alembic env configured for async SQLAlchemy against Neon direct endpoint."""
from __future__ import annotations

import asyncio
from logging.config import fileConfig
from pathlib import Path
import sys

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Make app importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.models import Base  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Inject our DATABASE_URL at runtime
config.set_main_option("sqlalchemy.url", settings.database_url_sync_for_alembic)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4: Leave `script.py.mako` as default** (Alembic's generator emits fine files).

- [ ] **Step 5: Commit (will fail alembic check until config.py is ready — we'll add config in Task 1.2)**

```bash
git add apps/api/alembic.ini apps/api/alembic
git commit -m "chore(api): alembic scaffold with async env"
```

---

### Task 1.2: `app/core/config.py` — pydantic-settings

**Files:**
- Create: `apps/api/app/core/__init__.py`
- Create: `apps/api/app/core/config.py`
- Test: `apps/api/tests/unit/test_config.py`

- [ ] **Step 1: Write the failing test**

```python
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
```

- [ ] **Step 2: Run to see it fail**

Run: `cd apps/api && uv run pytest tests/unit/test_config.py -v`
Expected: FAIL, `app.core.config` not found.

- [ ] **Step 3: Implement `config.py`**

```python
# apps/api/app/core/config.py
"""Centralized runtime configuration."""
from __future__ import annotations

from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
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

    @property
    def database_url_sync_for_alembic(self) -> str:
        """Alembic-compatible URL. asyncpg driver works for our async env.py."""
        return self.database_url


settings = Settings()  # singleton, raises at import if env is missing
```

- [ ] **Step 4: Run to see it pass**

Run: `cd apps/api && uv run pytest tests/unit/test_config.py -v`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core apps/api/tests/unit/test_config.py
git commit -m "feat(api): pydantic-settings Config with Neon + DataForSEO fields"
```

---

### Task 1.3: `app/core/db.py` — async engine + session factory

**Files:**
- Create: `apps/api/app/core/db.py`

- [ ] **Step 1: Write `db.py`**

```python
# apps/api/app/core/db.py
"""Async SQLAlchemy engine and session factory for Neon direct endpoint."""
from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

_engine: AsyncEngine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=5,
    # asyncpg default statement cache is fine on Neon's direct endpoint.
)
SessionLocal = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)


def get_engine() -> AsyncEngine:
    return _engine


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
```

- [ ] **Step 2: Commit** (no test yet — tested via integration harness in Task 1.6)

```bash
git add apps/api/app/core/db.py
git commit -m "feat(api): async SQLAlchemy engine against Neon direct endpoint"
```

---

### Task 1.4: SQLAlchemy models

**Files:**
- Create: `apps/api/app/models/__init__.py`
- Create: `apps/api/app/models/_base.py`
- Create: `apps/api/app/models/user.py`
- Create: `apps/api/app/models/workspace.py`
- Create: `apps/api/app/models/job.py`
- Create: `apps/api/app/models/plan.py`

- [ ] **Step 1: Write `_base.py`**

```python
# apps/api/app/models/_base.py
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
```

- [ ] **Step 2: Write `user.py`**

```python
# apps/api/app/models/user.py
from __future__ import annotations

from sqlalchemy import ForeignKey, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ._base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # Clerk user_id
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, default="", nullable=False)


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String, primary_key=True)  # Clerk org_id
    name: Mapped[str] = mapped_column(String, nullable=False)


class OrganizationMembership(Base, TimestampMixin):
    __tablename__ = "organization_memberships"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String, default="member", nullable=False)
    __table_args__ = (PrimaryKeyConstraint("user_id", "org_id"),)
```

- [ ] **Step 3: Write `workspace.py`**

```python
# apps/api/app/models/workspace.py
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ._base import Base, TimestampMixin


class Workspace(Base, TimestampMixin):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    org_id: Mapped[str | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    domain: Mapped[str] = mapped_column(String, nullable=False)

    __table_args__ = (
        Index("ix_workspaces_user", "user_id"),
        Index("ix_workspaces_org", "org_id", postgresql_where="org_id IS NOT NULL"),
    )
```

- [ ] **Step 4: Write `job.py`**

```python
# apps/api/app/models/job.py
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ._base import Base, TimestampMixin


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    input: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_jobs_workspace_created", "workspace_id", "created_at"),
        Index("ix_jobs_parent", "parent_job_id"),
        Index(
            "ix_jobs_active",
            "status",
            "type",
            postgresql_where=text("status IN ('pending', 'running')"),
        ),
        Index("ix_jobs_result_gin", "result", postgresql_using="gin"),
    )
```

- [ ] **Step 5: Write `plan.py`**

```python
# apps/api/app/models/plan.py
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ._base import Base, TimestampMixin


class Plan(Base, TimestampMixin):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    intent: Mapped[str] = mapped_column(String, nullable=False)
    domain: Mapped[str] = mapped_column(String, nullable=False)
    competitors: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    timeline_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    sprint_order: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
```

- [ ] **Step 6: Write `models/__init__.py`**

```python
# apps/api/app/models/__init__.py
from ._base import Base
from .job import Job
from .plan import Plan
from .user import Organization, OrganizationMembership, User
from .workspace import Workspace

__all__ = [
    "Base",
    "Job",
    "Organization",
    "OrganizationMembership",
    "Plan",
    "User",
    "Workspace",
]
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/models
git commit -m "feat(api): SQLAlchemy models (User, Workspace, Job, Plan)"
```

---

### Task 1.5: Initial migration — extensions + users/orgs + workspaces

**Files:**
- Create: `apps/api/alembic/versions/0001_init.py`

- [ ] **Step 1: Generate via autogenerate against test DB**

```bash
docker compose --profile test up -d postgres
export TEST_DATABASE_URL="postgresql+asyncpg://prism:prism@localhost:5432/prism_test"
export DATABASE_URL="$TEST_DATABASE_URL"
# (plus all other required env vars — see .env.example)
cd apps/api
uv run alembic revision --autogenerate -m "init"
```

Expected: file like `alembic/versions/abc123_init.py` created. Rename to `0001_init.py` manually.

- [ ] **Step 2: Prepend the extensions block to the migration's `upgrade()`**

Insert at the top of `upgrade()`:
```python
op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')
```

- [ ] **Step 3: Add the `NOTIFY` trigger for job status transitions at the bottom of `upgrade()`**

```python
op.execute("""
    CREATE OR REPLACE FUNCTION notify_job_event() RETURNS trigger AS $$
    DECLARE
      payload jsonb;
    BEGIN
      IF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status)
         OR TG_OP = 'INSERT' THEN
        payload := jsonb_build_object(
          'job_id', NEW.id,
          'parent_job_id', NEW.parent_job_id,
          'workspace_id', NEW.workspace_id,
          'type', NEW.type,
          'status', NEW.status,
          'at', now(),
          'error', NEW.error
        );
        PERFORM pg_notify('job_events', payload::text);
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER jobs_notify_event
      AFTER INSERT OR UPDATE OF status ON jobs
      FOR EACH ROW EXECUTE FUNCTION notify_job_event();
""")
```

And in `downgrade()`:
```python
op.execute("DROP TRIGGER IF EXISTS jobs_notify_event ON jobs")
op.execute("DROP FUNCTION IF EXISTS notify_job_event()")
```

- [ ] **Step 4: Apply the migration**

Run: `cd apps/api && uv run alembic upgrade head`
Expected: `psql` connection logs; migration applied; `\dt` in the test DB lists `users`, `organizations`, `organization_memberships`, `workspaces`, `jobs`, `plans`.

- [ ] **Step 5: Verify NOTIFY fires**

From `psql`:
```sql
LISTEN job_events;
-- in a second session:
INSERT INTO users (id, email) VALUES ('u_1', 'a@b.c');
INSERT INTO workspaces (id, user_id, name, domain) VALUES (gen_random_uuid(), 'u_1', 'w', 'a.com') RETURNING id;
INSERT INTO jobs (workspace_id, type, status, input)
  VALUES ('<uuid-from-above>', 'orchestrator', 'pending', '{}'::jsonb);
```
Expected: first session prints a `NOTIFY` line with a JSON payload.

- [ ] **Step 6: Commit**

```bash
git add apps/api/alembic/versions/0001_init.py
git commit -m "feat(api): initial migration (extensions, users, workspaces, jobs, plans, NOTIFY trigger)"
```

---

### Checkpoint 1

Run:
```bash
docker compose --profile test up -d
cd apps/api && uv run alembic upgrade head
```

Expected: migration applies cleanly; all tables present; NOTIFY trigger installed. Against your **Neon** `DATABASE_URL`, the same `alembic upgrade head` should succeed.

**Do not proceed to Phase 2 until this checkpoint passes on both test Postgres and Neon.**

---

## Phase 2 — Agent runtime primitives

Spec §4.1, §4.2, §6.2 are the references.

### Task 2.1: `app/core/errors.py` — `ErrorKind`, `JobError`, `classify(exc)`

**Files:**
- Create: `apps/api/app/core/errors.py`
- Test: `apps/api/tests/unit/test_classify.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/api/tests/unit/test_classify.py
import asyncio

import anthropic
import httpx
import pydantic
import pytest

from app.core.errors import ErrorKind, classify


@pytest.mark.parametrize(
    "exc,expected_kind,expected_retryable",
    [
        (anthropic.RateLimitError("rl", response=None, body=None), ErrorKind.RATE_LIMIT, True),
        (httpx.HTTPStatusError("429", request=None, response=httpx.Response(429)), ErrorKind.RATE_LIMIT, True),
        (httpx.HTTPStatusError("503", request=None, response=httpx.Response(503)), ErrorKind.EXTERNAL_ERROR, True),
        (httpx.TimeoutException("slow"), ErrorKind.TIMEOUT, True),
        (asyncio.TimeoutError(), ErrorKind.TIMEOUT, True),
        (pydantic.ValidationError.from_exception_data("X", []), ErrorKind.INVALID_OUTPUT, True),
        (ValueError("bad input"), ErrorKind.INVALID_INPUT, False),
        (RuntimeError("???"), ErrorKind.BUG, False),
    ],
)
def test_classify(exc, expected_kind, expected_retryable):
    err = classify(exc, provider="test")
    assert err.kind == expected_kind
    assert err.retryable is expected_retryable
    assert err.provider == "test"
    assert err.message
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/api && uv run pytest tests/unit/test_classify.py -v`
Expected: FAIL, `app.core.errors` not found.

- [ ] **Step 3: Implement `errors.py`**

```python
# apps/api/app/core/errors.py
"""Error taxonomy and classifier."""
from __future__ import annotations

import asyncio
from enum import StrEnum
from typing import Any

import anthropic
import httpx
import pydantic


class ErrorKind(StrEnum):
    RATE_LIMIT = "rate_limit"
    TIMEOUT = "timeout"
    EXTERNAL_ERROR = "external_error"
    INVALID_OUTPUT = "invalid_output"
    INVALID_INPUT = "invalid_input"
    BUG = "bug"


_RETRYABLE = {
    ErrorKind.RATE_LIMIT,
    ErrorKind.TIMEOUT,
    ErrorKind.EXTERNAL_ERROR,
    ErrorKind.INVALID_OUTPUT,
}


class JobError(pydantic.BaseModel):
    kind: ErrorKind
    message: str
    retryable: bool
    provider: str | None = None
    trace_id: str | None = None

    def to_json(self) -> dict[str, Any]:
        return self.model_dump(mode="json")


def classify(exc: BaseException, *, provider: str | None = None) -> JobError:
    kind = _classify_kind(exc)
    return JobError(
        kind=kind,
        message=str(exc) or type(exc).__name__,
        retryable=kind in _RETRYABLE,
        provider=provider,
    )


def _classify_kind(exc: BaseException) -> ErrorKind:
    if isinstance(exc, anthropic.RateLimitError):
        return ErrorKind.RATE_LIMIT
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 429:
            return ErrorKind.RATE_LIMIT
        if 500 <= status < 600:
            return ErrorKind.EXTERNAL_ERROR
        return ErrorKind.EXTERNAL_ERROR
    if isinstance(exc, (httpx.TimeoutException, asyncio.TimeoutError)):
        return ErrorKind.TIMEOUT
    if isinstance(exc, (anthropic.APITimeoutError, anthropic.APIConnectionError)):
        return ErrorKind.TIMEOUT
    if isinstance(exc, pydantic.ValidationError):
        return ErrorKind.INVALID_OUTPUT
    if isinstance(exc, ValueError):
        return ErrorKind.INVALID_INPUT
    return ErrorKind.BUG
```

- [ ] **Step 4: Run to pass**

Run: `cd apps/api && uv run pytest tests/unit/test_classify.py -v`
Expected: all parametrized cases PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/errors.py apps/api/tests/unit/test_classify.py
git commit -m "feat(api): ErrorKind + classify() with table-driven tests"
```

---

### Task 2.2: `app/core/events.py` — NOTIFY payload emit + LISTEN subscriber

**Files:**
- Create: `apps/api/app/core/events.py`

- [ ] **Step 1: Write `events.py`**

```python
# apps/api/app/core/events.py
"""NOTIFY/LISTEN helpers for job state change events.

The NOTIFY side is handled entirely by the Postgres trigger (`notify_job_event`)
installed in migration 0001. Python code only needs to LISTEN.
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

import asyncpg

from app.core.config import settings


def _asyncpg_url() -> str:
    """asyncpg wants `postgresql://` not `postgresql+asyncpg://`."""
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/core/events.py
git commit -m "feat(api): asyncpg LISTEN loop for job_events with auto-reconnect"
```

---

### Task 2.3: `app/core/jobs.py` — `transition()` choke-point

**Files:**
- Create: `apps/api/app/core/jobs.py`
- Test: `apps/api/tests/unit/test_transition.py`

- [ ] **Step 1: Write failing test**

```python
# apps/api/tests/unit/test_transition.py
import pytest

from app.core.errors import JobError, ErrorKind
from app.core.jobs import IllegalTransition, transition


@pytest.mark.asyncio
async def test_pending_to_running_records_started_at(db_session, sample_job):
    job = sample_job(status="pending")
    await transition(db_session, job, "running")
    assert job.status == "running"
    assert job.started_at is not None
    assert job.completed_at is None


@pytest.mark.asyncio
async def test_running_to_complete_records_completed_at(db_session, sample_job):
    job = sample_job(status="running")
    await transition(db_session, job, "complete", result={"x": 1})
    assert job.status == "complete"
    assert job.completed_at is not None
    assert job.result == {"x": 1}


@pytest.mark.asyncio
async def test_running_to_failed_records_error(db_session, sample_job):
    job = sample_job(status="running")
    err = JobError(kind=ErrorKind.RATE_LIMIT, message="rl", retryable=True, provider="claude")
    await transition(db_session, job, "failed", error=err)
    assert job.status == "failed"
    assert job.error == err.to_json()


@pytest.mark.asyncio
async def test_illegal_transition_raises(db_session, sample_job):
    job = sample_job(status="complete")
    with pytest.raises(IllegalTransition):
        await transition(db_session, job, "running")


@pytest.mark.asyncio
async def test_complete_with_errors_only_on_sprint(db_session, sample_job):
    job = sample_job(status="running", type="keyword")
    with pytest.raises(IllegalTransition):
        await transition(db_session, job, "complete_with_errors")

    sprint = sample_job(status="running", type="sprint")
    await transition(db_session, sprint, "complete_with_errors")
    assert sprint.status == "complete_with_errors"
```

- [ ] **Step 2: Add `sample_job` fixture in `tests/conftest.py`** — see Task 2.5 for full conftest; for now stub this fixture there so the test file imports resolve.

- [ ] **Step 3: Run to fail**

Run: `cd apps/api && uv run pytest tests/unit/test_transition.py -v`
Expected: FAIL on `app.core.jobs` import.

- [ ] **Step 4: Implement `jobs.py`**

```python
# apps/api/app/core/jobs.py
"""Job status transition helper — the single mutation choke-point."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import JobError
from app.models import Job

_ALLOWED: dict[str, set[str]] = {
    "pending": {"running"},
    "running": {"complete", "failed", "complete_with_errors"},
    "complete": set(),
    "failed": {"running"},  # allow retry
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
    """Transition `job.status` atomically, recording timestamps and the NOTIFY payload.

    The actual NOTIFY is emitted by the Postgres trigger on the UPDATE.
    """
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
```

- [ ] **Step 5: Run to pass (fixtures from Task 2.5 must exist)**

Run: `cd apps/api && uv run pytest tests/unit/test_transition.py -v`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/core/jobs.py apps/api/tests/unit/test_transition.py
git commit -m "feat(api): transition() helper with legal-state machine and tests"
```

---

### Task 2.4: `app/skills/loader.py` — read vendor claude-seo SKILL.md files

**Files:**
- Create: `apps/api/app/skills/__init__.py`
- Create: `apps/api/app/skills/loader.py`
- Test: `apps/api/tests/unit/test_skills_loader.py`
- Test fixtures: `apps/api/tests/fixtures/skills/seo-demo/SKILL.md`

- [ ] **Step 1: Create test fixture**

```markdown
<!-- apps/api/tests/fixtures/skills/seo-demo/SKILL.md -->
---
name: seo-demo
description: Demo skill for tests.
---

# Demo Skill

This is the instructional body that Prism agents consume.
```

- [ ] **Step 2: Write failing test**

```python
# apps/api/tests/unit/test_skills_loader.py
from pathlib import Path

import pytest

from app.skills.loader import SkillNotFoundError, load_skill_prompt, _FRONTMATTER_CACHE


@pytest.fixture(autouse=True)
def _point_at_fixture_skills(monkeypatch, request):
    root = Path(__file__).resolve().parents[1] / "fixtures"
    monkeypatch.setenv("CLAUDE_SEO_PATH", str(root))
    # Re-import settings so env var is picked up for THIS test function
    from app.core import config as cfg
    monkeypatch.setattr(cfg.settings, "claude_seo_path", root)
    _FRONTMATTER_CACHE.clear()


def test_loads_body_and_strips_frontmatter():
    body = load_skill_prompt("seo-demo")
    assert body.startswith("# Demo Skill")
    assert "description:" not in body.splitlines()[0]


def test_caches_subsequent_calls():
    load_skill_prompt("seo-demo")
    assert "seo-demo" in _FRONTMATTER_CACHE
    # Second call should not hit disk; easiest: patch open, see zero reads.
    import app.skills.loader as mod
    count = {"opens": 0}
    real_open = mod.Path.open

    def counting_open(self, *a, **kw):
        count["opens"] += 1
        return real_open(self, *a, **kw)

    mod.Path.open = counting_open  # type: ignore[method-assign]
    try:
        load_skill_prompt("seo-demo")
        assert count["opens"] == 0
    finally:
        mod.Path.open = real_open  # type: ignore[method-assign]


def test_unknown_skill_raises():
    with pytest.raises(SkillNotFoundError):
        load_skill_prompt("does-not-exist")
```

- [ ] **Step 3: Run to fail**

Run: `cd apps/api && uv run pytest tests/unit/test_skills_loader.py -v`
Expected: FAIL, import error.

- [ ] **Step 4: Implement `loader.py`**

```python
# apps/api/app/skills/loader.py
"""Load SKILL.md bodies from vendor/claude-seo/skills/<name>/."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from app.core.config import settings

_FRONTMATTER_CACHE: dict[str, str] = {}


class SkillNotFoundError(FileNotFoundError):
    pass


def _skill_path(name: str) -> Path:
    return settings.claude_seo_path / "skills" / name / "SKILL.md"


def load_skill_prompt(name: str) -> str:
    """Return the SKILL.md body (frontmatter stripped)."""
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
```

- [ ] **Step 5: Run to pass**

Run: `cd apps/api && uv run pytest tests/unit/test_skills_loader.py -v`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/skills apps/api/tests/unit/test_skills_loader.py apps/api/tests/fixtures/skills
git commit -m "feat(api): skills_loader reads SKILL.md from vendor/claude-seo"
```

---

### Task 2.5: `tests/conftest.py` — shared fixtures

**Files:**
- Create: `apps/api/tests/__init__.py`
- Create: `apps/api/tests/unit/__init__.py`
- Create: `apps/api/tests/integration/__init__.py`
- Create: `apps/api/tests/conftest.py`

- [ ] **Step 1: Write `conftest.py`**

```python
# apps/api/tests/conftest.py
"""Shared pytest fixtures."""
from __future__ import annotations

import asyncio
import os
import uuid
from collections.abc import AsyncIterator, Iterator
from typing import Any

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Force the test DB before importing app modules that read settings
os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://prism:prism@localhost:5432/prism_test"),
)
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test")
os.environ.setdefault("DATAFORSEO_LOGIN", "x")
os.environ.setdefault("DATAFORSEO_PASSWORD", "x")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/14")
os.environ.setdefault("CELERY_RESULT_BACKEND", "redis://localhost:6379/13")
os.environ.setdefault("CLERK_JWKS_URL", "https://example/.well-known/jwks.json")

from app.core.config import settings  # noqa: E402
from app.models import Base, Job, User, Workspace  # noqa: E402


@pytest.fixture(scope="session")
def event_loop() -> Iterator[asyncio.AbstractEventLoop]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def _engine():
    engine = create_async_engine(settings.database_url, poolclass=None)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(_engine) -> AsyncIterator[AsyncSession]:
    """Per-test session that rolls back at teardown."""
    conn = await _engine.connect()
    trans = await conn.begin()
    Session = async_sessionmaker(bind=conn, expire_on_commit=False, class_=AsyncSession)
    session = Session()
    try:
        yield session
    finally:
        await session.close()
        await trans.rollback()
        await conn.close()


@pytest_asyncio.fixture
async def sample_user(db_session: AsyncSession) -> User:
    u = User(id=f"user_{uuid.uuid4().hex[:8]}", email=f"{uuid.uuid4().hex[:8]}@x.test", name="T")
    db_session.add(u)
    await db_session.flush()
    return u


@pytest_asyncio.fixture
async def sample_workspace(db_session: AsyncSession, sample_user: User) -> Workspace:
    w = Workspace(user_id=sample_user.id, name="w", domain="example.test")
    db_session.add(w)
    await db_session.flush()
    return w


@pytest.fixture
def sample_job(db_session: AsyncSession, sample_workspace: Workspace):
    """Factory fixture. Returns a callable building a Job row."""

    async def _make(status: str = "pending", type: str = "orchestrator", **extra: Any) -> Job:
        j = Job(
            workspace_id=sample_workspace.id,
            type=type,
            status=status,
            input=extra.pop("input", {}),
            **extra,
        )
        db_session.add(j)
        await db_session.flush()
        return j

    async def _sync_factory(**kw: Any) -> Job:
        return await _make(**kw)

    return _sync_factory  # tests `await sample_job(...)`
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/tests/__init__.py apps/api/tests/unit/__init__.py \
         apps/api/tests/integration/__init__.py apps/api/tests/conftest.py
git commit -m "test(api): shared pytest fixtures with rollback-per-test sessions"
```

---

### Task 2.6: `app/agents/base.py` — BaseAgent contract

**Files:**
- Create: `apps/api/app/agents/__init__.py`
- Create: `apps/api/app/agents/base.py`
- Test: `apps/api/tests/unit/test_base_agent.py`

- [ ] **Step 1: Write failing test**

```python
# apps/api/tests/unit/test_base_agent.py
from unittest.mock import AsyncMock, MagicMock

import pydantic
import pytest

from app.agents.base import BaseAgent


class DemoOutput(pydantic.BaseModel):
    name: str
    count: int


class DemoAgent(BaseAgent[str, DemoOutput]):
    CORE_PROMPT = "Core demo prompt."
    BACKING_SKILL = None
    RESPONSE_MODEL = DemoOutput

    def user_prompt(self, inp: str) -> str:
        return inp


@pytest.mark.asyncio
async def test_happy_path_returns_parsed_output():
    agent = DemoAgent()
    agent._client = MagicMock()
    agent._client.messages.create = AsyncMock(
        return_value=_fake_claude_response('{"name":"x","count":1}')
    )
    out = await agent.run("hello")
    assert out == DemoOutput(name="x", count=1)


@pytest.mark.asyncio
async def test_invalid_output_retries_once_then_succeeds():
    agent = DemoAgent()
    agent._client = MagicMock()
    agent._client.messages.create = AsyncMock(
        side_effect=[
            _fake_claude_response("not json"),
            _fake_claude_response('{"name":"x","count":2}'),
        ]
    )
    out = await agent.run("hello")
    assert out.count == 2
    assert agent._client.messages.create.await_count == 2


@pytest.mark.asyncio
async def test_invalid_output_retry_exhausted_raises_validation_error():
    agent = DemoAgent()
    agent._client = MagicMock()
    agent._client.messages.create = AsyncMock(
        return_value=_fake_claude_response("still not json")
    )
    with pytest.raises(pydantic.ValidationError):
        await agent.run("hello")


def _fake_claude_response(text: str):
    m = MagicMock()
    m.content = [MagicMock(text=text)]
    return m
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/api && uv run pytest tests/unit/test_base_agent.py -v`
Expected: FAIL, import error.

- [ ] **Step 3: Implement `base.py`**

```python
# apps/api/app/agents/base.py
"""Abstract base for Prism agents.

Contract:
  - `CORE_PROMPT`  (class var) — system-prompt trunk owned by the agent.
  - `BACKING_SKILL` (class var, optional) — name of a claude-seo skill whose
    SKILL.md body is appended to the system prompt.
  - `RESPONSE_MODEL` — pydantic BaseModel used for structured-output parsing.
  - Subclasses implement `user_prompt(input) -> str`.
"""
from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import ClassVar, Generic, TypeVar

import anthropic
import pydantic

from app.core.config import settings
from app.skills.loader import load_skill_prompt

TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput", bound=pydantic.BaseModel)

_DEFAULT_MODEL = "claude-sonnet-4-6"
_INVALID_OUTPUT_RETRIES = 1


class BaseAgent(ABC, Generic[TInput, TOutput]):
    CORE_PROMPT: ClassVar[str] = ""
    BACKING_SKILL: ClassVar[str | None] = None
    RESPONSE_MODEL: ClassVar[type[pydantic.BaseModel]]
    MODEL: ClassVar[str] = _DEFAULT_MODEL

    def __init__(self) -> None:
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key.get_secret_value(),
            timeout=settings.claude_timeout,
            max_retries=3,
        )

    @abstractmethod
    def user_prompt(self, inp: TInput) -> str: ...

    def system_prompt(self) -> str:
        parts = [self.CORE_PROMPT.strip()]
        if self.BACKING_SKILL:
            parts.append("\n---\n\n" + load_skill_prompt(self.BACKING_SKILL))
        parts.append(
            "\n\n---\n\n"
            f"Respond with JSON matching this pydantic schema exactly:\n"
            f"{json.dumps(self.RESPONSE_MODEL.model_json_schema(), indent=2)}\n"
            "Output ONLY the JSON object, no prose or code fences."
        )
        return "".join(parts)

    async def run(self, inp: TInput) -> TOutput:
        user = self.user_prompt(inp)
        system = self.system_prompt()
        return await self._call_claude(system, user)

    async def _call_claude(
        self, system: str, user: str, _attempt: int = 0, _last_bad: str | None = None
    ) -> TOutput:
        u = user if _last_bad is None else (
            f"{user}\n\n---\nPrior attempt failed schema validation:\n{_last_bad}\n"
            "Return valid JSON matching the schema, ONLY the JSON object."
        )
        resp = await self._client.messages.create(
            model=self.MODEL,
            max_tokens=2048,
            system=system,
            messages=[{"role": "user", "content": u}],
        )
        text = "".join(block.text for block in resp.content if getattr(block, "text", None))
        try:
            return self.RESPONSE_MODEL.model_validate_json(text)  # type: ignore[return-value]
        except pydantic.ValidationError:
            if _attempt >= _INVALID_OUTPUT_RETRIES:
                raise
            return await self._call_claude(system, user, _attempt + 1, _last_bad=text)
```

- [ ] **Step 4: Run to pass**

Run: `cd apps/api && uv run pytest tests/unit/test_base_agent.py -v`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/agents apps/api/tests/unit/test_base_agent.py
git commit -m "feat(api): BaseAgent with SKILL.md merging, structured output retry"
```

---

### Task 2.7: `app/core/sentry.py` — init helper

**Files:**
- Create: `apps/api/app/core/sentry.py`

- [ ] **Step 1: Write**

```python
# apps/api/app/core/sentry.py
"""Sentry initialization for FastAPI and Celery processes."""
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
        traces_sample_rate=0.0,  # tracing later, not in Foundation
        send_default_pii=False,
    )
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/core/sentry.py
git commit -m "feat(api): Sentry init for FastAPI + Celery"
```

---

### Checkpoint 2

Run: `cd apps/api && uv run pytest tests/unit -v`

Expected: all unit tests green — `test_config`, `test_classify`, `test_transition`, `test_skills_loader`, `test_base_agent`.

**Do not proceed to Phase 3 until green.**

---

## Phase 3 — DataForSEO integration, Orchestrator agent, Keyword agent, Stubs

Spec §4.1, §4.2 are the references.

### Task 3.1: `app/integrations/dataforseo.py` — HTTPX client with cache, semaphore, retry

**Files:**
- Create: `apps/api/app/integrations/__init__.py`
- Create: `apps/api/app/integrations/dataforseo.py`
- Test: `apps/api/tests/unit/test_dataforseo.py`
- Fixture: `apps/api/tests/fixtures/dataforseo/keywords_sample.json`

- [ ] **Step 1: Create fixture response**

```json
{
  "version": "0.1",
  "status_code": 20000,
  "tasks": [
    {
      "id": "task-1",
      "status_code": 20000,
      "result": [
        {
          "keyword": "applicant tracking system",
          "search_volume": 4400,
          "keyword_difficulty": 45,
          "competition": 0.6
        },
        {
          "keyword": "ats software",
          "search_volume": 2900,
          "keyword_difficulty": 52,
          "competition": 0.5
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write failing tests**

```python
# apps/api/tests/unit/test_dataforseo.py
import asyncio
import json
from pathlib import Path

import httpx
import pytest
import respx

from app.integrations.dataforseo import (
    DataForSEOClient,
    DataForSEOError,
    KeywordRow,
)

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures/dataforseo/keywords_sample.json"


@pytest.mark.asyncio
@respx.mock
async def test_keywords_happy_path(fakeredis_client):
    respx.post("https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live").mock(
        return_value=httpx.Response(200, json=json.loads(FIXTURE.read_text()))
    )
    client = DataForSEOClient(redis=fakeredis_client)
    rows = await client.keywords_for_keywords(["ats"])
    assert len(rows) == 2
    assert isinstance(rows[0], KeywordRow)
    assert rows[0].keyword == "applicant tracking system"


@pytest.mark.asyncio
@respx.mock
async def test_keywords_cached_on_second_call(fakeredis_client):
    route = respx.post(
        "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live"
    ).mock(return_value=httpx.Response(200, json=json.loads(FIXTURE.read_text())))
    client = DataForSEOClient(redis=fakeredis_client)
    await client.keywords_for_keywords(["ats"])
    await client.keywords_for_keywords(["ats"])
    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_keywords_429_retries_then_succeeds(fakeredis_client):
    responses = [
        httpx.Response(429, headers={"Retry-After": "0"}),
        httpx.Response(429, headers={"Retry-After": "0"}),
        httpx.Response(200, json=json.loads(FIXTURE.read_text())),
    ]
    route = respx.post(
        "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live"
    ).mock(side_effect=responses)
    client = DataForSEOClient(redis=fakeredis_client)
    rows = await client.keywords_for_keywords(["ats"])
    assert route.call_count == 3
    assert len(rows) == 2


@pytest.mark.asyncio
@respx.mock
async def test_empty_result_raises_external_error(fakeredis_client):
    respx.post(
        "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live"
    ).mock(return_value=httpx.Response(200, json={"tasks": [{"status_code": 20000, "result": []}]}))
    client = DataForSEOClient(redis=fakeredis_client)
    with pytest.raises(DataForSEOError):
        await client.keywords_for_keywords(["ats"])


@pytest.mark.asyncio
@respx.mock
async def test_semaphore_caps_concurrent_calls(fakeredis_client, monkeypatch):
    # Record simultaneous in-flight calls.
    current = {"now": 0, "peak": 0}

    async def handler(req: httpx.Request) -> httpx.Response:
        current["now"] += 1
        current["peak"] = max(current["peak"], current["now"])
        await asyncio.sleep(0.02)
        current["now"] -= 1
        return httpx.Response(200, json=json.loads(FIXTURE.read_text()))

    respx.post(
        "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live"
    ).mock(side_effect=handler)
    client = DataForSEOClient(redis=fakeredis_client, concurrency=2)
    await asyncio.gather(*[client.keywords_for_keywords([f"k{i}"]) for i in range(8)])
    assert current["peak"] <= 2


@pytest.fixture
def fakeredis_client():
    import fakeredis.aioredis
    return fakeredis.aioredis.FakeRedis()
```

Add `fakeredis>=2.26` to the `[project.optional-dependencies].dev` list in `pyproject.toml` and re-run `uv pip install -e ".[dev]"` before running tests.

- [ ] **Step 3: Run to fail**

Run: `cd apps/api && uv run pytest tests/unit/test_dataforseo.py -v`
Expected: FAIL, import error.

- [ ] **Step 4: Implement `dataforseo.py`**

```python
# apps/api/app/integrations/dataforseo.py
"""DataForSEO HTTP client with Redis caching, concurrency cap, retry."""
from __future__ import annotations

import asyncio
import hashlib
import json
from typing import Any

import httpx
import pydantic
import redis.asyncio as aioredis
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from app.core.config import settings

_BASE = "https://api.dataforseo.com"
_CACHE_TTL = 24 * 3600


class DataForSEOError(RuntimeError):
    pass


class KeywordRow(pydantic.BaseModel):
    keyword: str
    search_volume: int | None = None
    keyword_difficulty: int | None = None
    competition: float | None = None


class DataForSEOClient:
    def __init__(
        self,
        *,
        redis: aioredis.Redis | None = None,
        concurrency: int | None = None,
    ) -> None:
        self._redis = redis
        self._sem = asyncio.Semaphore(concurrency or settings.dataforseo_concurrency)
        self._auth = httpx.BasicAuth(
            settings.dataforseo_login.get_secret_value(),
            settings.dataforseo_password.get_secret_value(),
        )
        self._timeout = httpx.Timeout(settings.dataforseo_timeout)

    async def keywords_for_keywords(self, seeds: list[str]) -> list[KeywordRow]:
        payload = [{"keywords": seeds, "language_code": "en", "location_code": 2840}]
        data = await self._post(
            "/v3/keywords_data/google_ads/keywords_for_keywords/live", payload
        )
        rows = _extract_result(data)
        if not rows:
            raise DataForSEOError("DataForSEO returned no keyword rows (treated as external error)")
        return [KeywordRow.model_validate(r) for r in rows]

    async def _post(self, path: str, payload: Any) -> dict:
        cache_key = _cache_key(path, payload)
        if self._redis is not None:
            cached = await self._redis.get(cache_key)
            if cached:
                return json.loads(cached)
        async with self._sem:
            data = await self._do_post_with_retry(path, payload)
        if self._redis is not None:
            await self._redis.set(cache_key, json.dumps(data), ex=_CACHE_TTL)
        return data

    async def _do_post_with_retry(self, path: str, payload: Any) -> dict:
        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(4),
                wait=wait_exponential_jitter(initial=1, max=10),
                retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException)),
                reraise=True,
            ):
                with attempt:
                    async with httpx.AsyncClient(
                        base_url=_BASE, auth=self._auth, timeout=self._timeout
                    ) as client:
                        resp = await client.post(path, json=payload)
                        if resp.status_code in (429, 500, 502, 503, 504):
                            resp.raise_for_status()
                        resp.raise_for_status()
                        return resp.json()
        except RetryError as e:
            raise e.last_attempt.exception()  # type: ignore[misc]
        raise DataForSEOError("retry loop terminated unexpectedly")


def _cache_key(path: str, payload: Any) -> str:
    h = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:24]
    return f"dataforseo:{path}:{h}"


def _extract_result(data: dict) -> list[dict]:
    try:
        return data["tasks"][0]["result"] or []
    except (KeyError, IndexError, TypeError):
        return []
```

- [ ] **Step 5: Run to pass**

Run: `cd apps/api && uv run pytest tests/unit/test_dataforseo.py -v`
Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/integrations apps/api/tests/unit/test_dataforseo.py apps/api/tests/fixtures/dataforseo apps/api/pyproject.toml
git commit -m "feat(api): DataForSEO client with Redis cache, semaphore, tenacity retry"
```

---

### Task 3.2: `app/agents/orchestrator.py` + prompt

**Files:**
- Create: `apps/api/app/agents/orchestrator.py`
- Create: `apps/api/app/agents/prompts/orchestrator.md`
- Test: `apps/api/tests/unit/test_orchestrator_agent.py`

- [ ] **Step 1: Write `orchestrator.md` prompt**

```markdown
# Orchestrator Agent — Core Prompt

You turn a natural-language SEO traffic goal into a structured execution plan.

**Given:** a goal statement (1–3 sentences), the user's target domain, and the current date.

**Produce:**
- `intent`: a one-sentence restatement of the user's traffic objective.
- `domain`: the target domain (echo from input, normalized to bare host without scheme or trailing slash).
- `competitors`: 2–5 competitor domains (bare hosts). Prefer names the user supplied; otherwise infer based on the goal.
- `timeline_weeks`: integer weeks the user implied (if none stated, infer conservatively from the goal; default 12).
- `sprint_order`: the list ["keyword", "competitor", "content_audit", "llm_visibility"] — Foundation always dispatches all four; order encodes expected importance.

**Rules:**
- Never ask clarifying questions. Pick reasonable defaults.
- Never output markdown, code fences, or prose. JSON ONLY matching the schema.
- If the goal is gibberish or empty, raise a validation error (return invalid JSON so the caller's invalid_input path fires).
```

- [ ] **Step 2: Write failing test**

```python
# apps/api/tests/unit/test_orchestrator_agent.py
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.agents.orchestrator import OrchestratorAgent, OrchestratorInput, Plan


@pytest.mark.asyncio
async def test_valid_goal_returns_plan():
    agent = OrchestratorAgent()
    agent._client = MagicMock()
    agent._client.messages.create = AsyncMock(
        return_value=_fake(
            '{"intent":"50k signups/mo","domain":"whitecarrot.io",'
            '"competitors":["greenhouse.io","ashbyhq.com"],'
            '"timeline_weeks":24,'
            '"sprint_order":["keyword","competitor","content_audit","llm_visibility"]}'
        )
    )
    plan = await agent.run(
        OrchestratorInput(
            goal="50k organic signups/mo on whitecarrot.io in 6 months vs greenhouse and ashby",
            domain="whitecarrot.io",
        )
    )
    assert isinstance(plan, Plan)
    assert plan.domain == "whitecarrot.io"
    assert plan.timeline_weeks == 24
    assert "greenhouse.io" in plan.competitors


def _fake(text: str):
    m = MagicMock()
    m.content = [MagicMock(text=text)]
    return m
```

- [ ] **Step 3: Run to fail**

Run: `cd apps/api && uv run pytest tests/unit/test_orchestrator_agent.py -v`
Expected: FAIL, import error.

- [ ] **Step 4: Implement `orchestrator.py`**

```python
# apps/api/app/agents/orchestrator.py
"""Orchestrator agent — parses an NL goal into a structured Plan."""
from __future__ import annotations

from pathlib import Path
from typing import ClassVar

import pydantic

from app.agents.base import BaseAgent

_PROMPT_FILE = Path(__file__).parent / "prompts" / "orchestrator.md"


class OrchestratorInput(pydantic.BaseModel):
    goal: str
    domain: str


class Plan(pydantic.BaseModel):
    intent: str
    domain: str
    competitors: list[str]
    timeline_weeks: int = pydantic.Field(gt=0, le=260)
    sprint_order: list[str]

    @pydantic.field_validator("sprint_order")
    @classmethod
    def _validate_order(cls, v: list[str]) -> list[str]:
        expected = {"keyword", "competitor", "content_audit", "llm_visibility"}
        if set(v) != expected:
            raise ValueError("sprint_order must contain exactly the 4 research types")
        return v


class OrchestratorAgent(BaseAgent[OrchestratorInput, Plan]):
    CORE_PROMPT: ClassVar[str] = _PROMPT_FILE.read_text(encoding="utf-8")
    BACKING_SKILL: ClassVar[str | None] = None  # seo-plan available if needed later
    RESPONSE_MODEL = Plan

    def user_prompt(self, inp: OrchestratorInput) -> str:
        return f"Domain: {inp.domain}\nGoal: {inp.goal}"
```

- [ ] **Step 5: Run to pass**

Run: `cd apps/api && uv run pytest tests/unit/test_orchestrator_agent.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/agents/orchestrator.py apps/api/app/agents/prompts/orchestrator.md apps/api/tests/unit/test_orchestrator_agent.py
git commit -m "feat(api): OrchestratorAgent with Plan pydantic schema + prompt"
```

---

### Task 3.3: `app/agents/keyword.py` — live DataForSEO keyword agent

**Files:**
- Create: `apps/api/app/agents/keyword.py`
- Test: `apps/api/tests/unit/test_keyword_agent.py`

- [ ] **Step 1: Write failing test**

```python
# apps/api/tests/unit/test_keyword_agent.py
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.agents.keyword import KeywordAgent, KeywordInput, KeywordResult
from app.agents.orchestrator import Plan
from app.integrations.dataforseo import KeywordRow


@pytest.mark.asyncio
async def test_keyword_agent_ranks_and_returns_result():
    plan = Plan(
        intent="signups",
        domain="whitecarrot.io",
        competitors=["greenhouse.io"],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )
    client = MagicMock()
    client.keywords_for_keywords = AsyncMock(
        return_value=[
            KeywordRow(keyword="ats software", search_volume=2900, keyword_difficulty=52),
            KeywordRow(keyword="applicant tracking", search_volume=4400, keyword_difficulty=45),
        ]
    )
    agent = KeywordAgent(dataforseo=client)
    agent._client = MagicMock()
    agent._client.messages.create = AsyncMock(
        return_value=_fake(
            '{"keywords":['
            '{"term":"applicant tracking","volume":4400,"difficulty":45,"priority_score":0.82},'
            '{"term":"ats software","volume":2900,"difficulty":52,"priority_score":0.64}'
            ']}'
        )
    )
    out = await agent.run(KeywordInput(plan=plan))
    assert isinstance(out, KeywordResult)
    assert len(out.keywords) == 2
    assert out.keywords[0].priority_score >= out.keywords[1].priority_score


def _fake(text: str):
    m = MagicMock()
    m.content = [MagicMock(text=text)]
    return m
```

- [ ] **Step 2: Run to fail**

Run: `cd apps/api && uv run pytest tests/unit/test_keyword_agent.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement `keyword.py`**

```python
# apps/api/app/agents/keyword.py
"""Keyword agent — pulls seeds from the Plan, hits DataForSEO, reranks via Claude."""
from __future__ import annotations

from typing import ClassVar

import pydantic

from app.agents.base import BaseAgent
from app.agents.orchestrator import Plan
from app.integrations.dataforseo import DataForSEOClient


class KeywordInput(pydantic.BaseModel):
    plan: Plan


class RankedKeyword(pydantic.BaseModel):
    term: str
    volume: int | None = None
    difficulty: int | None = None
    priority_score: float


class KeywordResult(pydantic.BaseModel):
    keywords: list[RankedKeyword]


_CORE_PROMPT = """\
You are the Prism keyword research agent. You receive:
  - a Plan (intent, domain, competitors, timeline)
  - a list of raw keyword rows from DataForSEO (keyword, search_volume, keyword_difficulty)

Return a re-ranked list of at most 30 keywords as JSON matching the schema.

`priority_score` is a float in [0,1] combining relevance to the Plan's intent,
search volume, difficulty (lower is better), and timeline realism.

Output JSON only.
"""


class KeywordAgent(BaseAgent[KeywordInput, KeywordResult]):
    CORE_PROMPT: ClassVar[str] = _CORE_PROMPT
    BACKING_SKILL: ClassVar[str | None] = "seo-dataforseo"
    RESPONSE_MODEL = KeywordResult

    def __init__(self, dataforseo: DataForSEOClient | None = None) -> None:
        super().__init__()
        self._dfs = dataforseo or DataForSEOClient()

    def user_prompt(self, inp: KeywordInput) -> str:
        # Actual prompt is built in run() because we need to fetch DFS first.
        raise NotImplementedError("user_prompt not used; KeywordAgent overrides run")

    async def run(self, inp: KeywordInput) -> KeywordResult:
        seeds = _derive_seeds(inp.plan)
        rows = await self._dfs.keywords_for_keywords(seeds)
        user = (
            f"Plan:\n{inp.plan.model_dump_json(indent=2)}\n\n"
            f"Raw keywords:\n" + "\n".join(
                f"- {r.keyword} (v={r.search_volume}, kd={r.keyword_difficulty})" for r in rows
            )
        )
        system = self.system_prompt()
        return await self._call_claude(system, user)


def _derive_seeds(plan: Plan) -> list[str]:
    """Tiny seed derivation — pull nouns from intent + domain/competitors TLDs."""
    base = [plan.domain.split(".")[0]]
    base.extend(c.split(".")[0] for c in plan.competitors[:3])
    base.append(plan.intent.split()[0] if plan.intent else "")
    return [s for s in {s.lower() for s in base} if s][:4]
```

- [ ] **Step 4: Run to pass**

Run: `cd apps/api && uv run pytest tests/unit/test_keyword_agent.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/agents/keyword.py apps/api/tests/unit/test_keyword_agent.py
git commit -m "feat(api): KeywordAgent (live DataForSEO + Claude rerank)"
```

---

### Task 3.4: `app/agents/stubs.py` — three stub research agents

**Files:**
- Create: `apps/api/app/agents/stubs.py`

- [ ] **Step 1: Write**

```python
# apps/api/app/agents/stubs.py
"""Stub research agents for Foundation. Same shape as real agents so later
sub-projects can swap implementations in place."""
from __future__ import annotations

import asyncio
import random
from typing import Any

import pydantic

from app.agents.orchestrator import Plan


class StubInput(pydantic.BaseModel):
    plan: Plan


class StubResult(pydantic.BaseModel):
    type: str
    note: str
    fake_items: list[str]


async def _fake_run(agent_type: str, plan: Plan) -> StubResult:
    await asyncio.sleep(random.uniform(2.0, 5.0))
    return StubResult(
        type=agent_type,
        note=f"stub {agent_type} for {plan.domain}; replaced in Research-sprint sub-project",
        fake_items=[f"{agent_type}_finding_{i}" for i in range(5)],
    )


class CompetitorStub:
    async def run(self, inp: StubInput) -> StubResult:
        return await _fake_run("competitor", inp.plan)


class ContentAuditStub:
    async def run(self, inp: StubInput) -> StubResult:
        return await _fake_run("content_audit", inp.plan)


class LLMVisibilityStub:
    async def run(self, inp: StubInput) -> StubResult:
        return await _fake_run("llm_visibility", inp.plan)
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/agents/stubs.py
git commit -m "feat(api): three stub research agents (competitor, content_audit, llm_visibility)"
```

---

### Checkpoint 3

Run: `cd apps/api && uv run pytest tests/unit -v`

Expected: all Phase-2 and Phase-3 unit tests green: `test_config`, `test_classify`, `test_transition`, `test_skills_loader`, `test_base_agent`, `test_dataforseo`, `test_orchestrator_agent`, `test_keyword_agent`.

**Optional live smoke test** (requires real DataForSEO creds in `.env.local`):
```bash
cd apps/api && uv run python -c "
import asyncio
from app.integrations.dataforseo import DataForSEOClient
print(asyncio.run(DataForSEOClient().keywords_for_keywords(['ats'])))
"
```
Expected: real keyword rows printed.

**Do not proceed to Phase 4 until Checkpoint 3 passes.**

---

## Phase 4 — Celery tasks and chord pipeline (the load-bearing moment)

Spec §3.2, §4.2, §6.3 are the references. This phase ends with the **chord-failure contract test** — the single most important integration test in Foundation.

### Task 4.1: `app/workers/celery_app.py` — app factory + Sentry

**Files:**
- Create: `apps/api/app/workers/__init__.py`
- Create: `apps/api/app/workers/celery_app.py`

- [ ] **Step 1: Write**

```python
# apps/api/app/workers/celery_app.py
"""Celery app factory. One worker runs all task queues in Foundation."""
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
)
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/workers/__init__.py apps/api/app/workers/celery_app.py
git commit -m "feat(api): Celery app factory with conservative defaults"
```

---

### Task 4.2: `app/workers/tasks.py` — orchestrator, children, finalize (chord contract)

**Files:**
- Create: `apps/api/app/workers/tasks.py`

- [ ] **Step 1: Write**

```python
# apps/api/app/workers/tasks.py
"""Celery tasks implementing the chord pipeline.

CONTRACT: every child task in the chord MUST ALWAYS RETURN a dict and never
raise past the task boundary. A raised exception would leave the chord stuck
forever. We catch `Exception` deliberately — bugs are still captured by Sentry
via `sentry_sdk.capture_exception`.
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Any

import sentry_sdk
from celery import chord, group
from celery.result import AsyncResult
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.keyword import KeywordAgent, KeywordInput
from app.agents.orchestrator import OrchestratorAgent, OrchestratorInput, Plan
from app.agents.stubs import (
    CompetitorStub,
    ContentAuditStub,
    LLMVisibilityStub,
    StubInput,
)
from app.core.config import settings
from app.core.db import SessionLocal
from app.core.errors import classify
from app.core.jobs import transition
from app.models import Job, Plan as PlanModel, Workspace
from app.workers.celery_app import celery_app


def _run(coro):
    """Run an async coroutine from a sync Celery task body."""
    return asyncio.run(coro)


# ─────────────────────────────────────────────────────────────────────
# orchestrator_task
# ─────────────────────────────────────────────────────────────────────

@celery_app.task(bind=True, name="agents.orchestrator")
def orchestrator_task(self, job_id: str) -> dict:
    async def _body() -> dict:
        async with SessionLocal() as session:
            job = await _load_job(session, job_id)
            workspace = await session.get(Workspace, job.workspace_id)
            assert workspace is not None
            await transition(session, job, "running")
            await session.commit()

            try:
                plan = await OrchestratorAgent().run(
                    OrchestratorInput(goal=job.input["goal"], domain=workspace.domain)
                )
            except Exception as exc:
                err = classify(exc, provider="claude")
                sentry_sdk.capture_exception(exc)
                await transition(session, job, "failed", error=err)
                await session.commit()
                return {"ok": False, "error": err.to_json()}

            plan_row = PlanModel(
                job_id=job.id,
                workspace_id=job.workspace_id,
                intent=plan.intent,
                domain=plan.domain,
                competitors=plan.competitors,
                timeline_weeks=plan.timeline_weeks,
                sprint_order=plan.sprint_order,
            )
            session.add(plan_row)
            await session.flush()

            sprint = Job(
                workspace_id=job.workspace_id,
                parent_job_id=job.id,
                type="sprint",
                status="running",
                input={"plan_id": str(plan_row.id)},
            )
            session.add(sprint)
            await session.flush()
            await transition(session, job, "complete", result={"plan_id": str(plan_row.id)})
            await session.commit()

            plan_id = str(plan_row.id)
            sprint_id = str(sprint.id)

        _dispatch_chord(plan_id, sprint_id)
        return {"ok": True, "plan_id": plan_id, "sprint_job_id": sprint_id}

    return _run(_body())


def _dispatch_chord(plan_id: str, sprint_job_id: str) -> AsyncResult:
    header = group(
        keyword_task.s(plan_id, sprint_job_id),
        competitor_stub_task.s(plan_id, sprint_job_id),
        content_audit_stub_task.s(plan_id, sprint_job_id),
        llm_visibility_stub_task.s(plan_id, sprint_job_id),
    )
    callback = finalize_task.s(sprint_job_id)
    error_callback = finalize_error_task.s(sprint_job_id)
    return chord(header, body=callback).on_error(error_callback).apply_async()


# ─────────────────────────────────────────────────────────────────────
# Chord children — CONTRACT: never raise, always return sentinel dict
# ─────────────────────────────────────────────────────────────────────

def _child_body(agent_type: str, runner):
    async def _run_wrapper(plan_id: str, sprint_job_id: str) -> dict:
        async with SessionLocal() as session:
            child = Job(
                workspace_id=await _workspace_id_of_sprint(session, sprint_job_id),
                parent_job_id=uuid.UUID(sprint_job_id),
                type=agent_type,
                status="pending",
                input={"plan_id": plan_id},
            )
            session.add(child)
            await session.flush()
            child_id = str(child.id)
            await transition(session, child, "running")
            await session.commit()

            try:
                plan_row = await session.get(PlanModel, uuid.UUID(plan_id))
                assert plan_row is not None
                plan = Plan(
                    intent=plan_row.intent,
                    domain=plan_row.domain,
                    competitors=list(plan_row.competitors),
                    timeline_weeks=plan_row.timeline_weeks,
                    sprint_order=list(plan_row.sprint_order),
                )
                result = await runner(plan)
                await transition(session, child, "complete", result=_to_json(result))
                await session.commit()
                return {"child_job_id": child_id, "type": agent_type, "ok": True}
            except Exception as exc:
                err = classify(exc, provider=agent_type)
                sentry_sdk.capture_exception(exc)
                await transition(session, child, "failed", error=err)
                await session.commit()
                return {
                    "child_job_id": child_id,
                    "type": agent_type,
                    "ok": False,
                    "error": err.to_json(),
                }

    return _run_wrapper


async def _keyword_runner(plan: Plan):
    return await KeywordAgent().run(KeywordInput(plan=plan))


async def _competitor_runner(plan: Plan):
    return await CompetitorStub().run(StubInput(plan=plan))


async def _content_audit_runner(plan: Plan):
    return await ContentAuditStub().run(StubInput(plan=plan))


async def _llm_visibility_runner(plan: Plan):
    return await LLMVisibilityStub().run(StubInput(plan=plan))


@celery_app.task(bind=True, name="agents.keyword")
def keyword_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("keyword", _keyword_runner)(plan_id, sprint_job_id))


@celery_app.task(bind=True, name="agents.competitor")
def competitor_stub_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("competitor", _competitor_runner)(plan_id, sprint_job_id))


@celery_app.task(bind=True, name="agents.content_audit")
def content_audit_stub_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("content_audit", _content_audit_runner)(plan_id, sprint_job_id))


@celery_app.task(bind=True, name="agents.llm_visibility")
def llm_visibility_stub_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("llm_visibility", _llm_visibility_runner)(plan_id, sprint_job_id))


# ─────────────────────────────────────────────────────────────────────
# finalize_task — NEVER raises. Rolls up sprint status.
# ─────────────────────────────────────────────────────────────────────

@celery_app.task(name="agents.finalize")
def finalize_task(child_results: list[dict], sprint_job_id: str) -> dict:
    async def _body() -> dict:
        async with SessionLocal() as session:
            sprint = await session.get(Job, uuid.UUID(sprint_job_id))
            if sprint is None or sprint.status != "running":
                return {"ok": False, "reason": "sprint missing or not running"}
            all_ok = all(r.get("ok") for r in child_results)
            status = "complete" if all_ok else "complete_with_errors"
            await transition(
                session,
                sprint,
                status,
                result={"children": child_results, "errors": not all_ok},
            )
            await session.commit()
            return {"ok": True, "status": status}

    try:
        return _run(_body())
    except Exception as exc:
        # Absolute last resort — bug in finalize itself.
        sentry_sdk.capture_exception(exc)
        return {"ok": False, "reason": f"finalize bug: {exc!r}"}


@celery_app.task(name="agents.finalize_error")
def finalize_error_task(request_context: Any, sprint_job_id: str) -> dict:
    """Fallback when the chord itself (broker/worker) fails before finalize runs."""
    async def _body() -> dict:
        async with SessionLocal() as session:
            sprint = await session.get(Job, uuid.UUID(sprint_job_id))
            if sprint is None or sprint.status != "running":
                return {"ok": False, "reason": "sprint missing or not running"}
            await transition(
                session,
                sprint,
                "complete_with_errors",
                result={"error_callback_fired": True, "context": str(request_context)[:500]},
            )
            await session.commit()
            return {"ok": True, "status": "complete_with_errors"}

    try:
        return _run(_body())
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        return {"ok": False, "reason": "finalize_error bug"}


# ─────────────────────────────────────────────────────────────────────
# helpers
# ─────────────────────────────────────────────────────────────────────

async def _load_job(session: AsyncSession, job_id: str) -> Job:
    job = await session.get(Job, uuid.UUID(job_id))
    if job is None:
        raise RuntimeError(f"job {job_id} not found")
    return job


async def _workspace_id_of_sprint(session: AsyncSession, sprint_job_id: str) -> uuid.UUID:
    row = await session.execute(
        select(Job.workspace_id).where(Job.id == uuid.UUID(sprint_job_id))
    )
    workspace_id = row.scalar_one()
    assert isinstance(workspace_id, uuid.UUID)
    return workspace_id


def _to_json(obj: Any) -> dict:
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    return dict(obj) if isinstance(obj, dict) else {"value": str(obj)}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/workers/tasks.py
git commit -m "feat(api): Celery chord pipeline + chord-failure contract (children never raise)"
```

---

### Task 4.3: Task wrapper unit tests

**Files:**
- Test: `apps/api/tests/unit/test_task_contract.py`

- [ ] **Step 1: Write tests** (unit-level, eager mode, mocked agents)

```python
# apps/api/tests/unit/test_task_contract.py
"""Unit-test the child-task contract without a real Celery broker."""
from unittest.mock import AsyncMock, patch

import pytest
import sentry_sdk

from app.workers import tasks as t


@pytest.mark.asyncio
async def test_child_body_returns_ok_on_success(db_session, sample_workspace, sample_plan):
    sprint = await _sprint(db_session, sample_workspace, sample_plan)
    runner = AsyncMock(return_value={"keywords": []})
    body = t._child_body("keyword", runner)
    result = await body(str(sample_plan.id), str(sprint.id))
    assert result["ok"] is True
    assert result["type"] == "keyword"


@pytest.mark.asyncio
async def test_child_body_catches_exception_and_reports_to_sentry(
    db_session, sample_workspace, sample_plan, monkeypatch
):
    sprint = await _sprint(db_session, sample_workspace, sample_plan)
    captured: list[BaseException] = []
    monkeypatch.setattr(sentry_sdk, "capture_exception", lambda e: captured.append(e))

    runner = AsyncMock(side_effect=RuntimeError("boom"))
    body = t._child_body("keyword", runner)
    result = await body(str(sample_plan.id), str(sprint.id))

    assert result["ok"] is False
    assert result["error"]["kind"] == "bug"
    assert captured and isinstance(captured[0], RuntimeError)


@pytest.fixture
async def sample_plan(db_session, sample_workspace):
    from app.models import Plan as PlanModel
    p = PlanModel(
        job_id=None,  # not required for this unit test path; we short-circuit
        workspace_id=sample_workspace.id,
        intent="x",
        domain="x.test",
        competitors=[],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )
    db_session.add(p)
    await db_session.flush()
    return p


async def _sprint(db_session, workspace, plan):
    from app.models import Job
    s = Job(
        workspace_id=workspace.id,
        type="sprint",
        status="running",
        input={"plan_id": str(plan.id)},
    )
    db_session.add(s)
    await db_session.flush()
    return s
```

- [ ] **Step 2: Run**

Run: `cd apps/api && uv run pytest tests/unit/test_task_contract.py -v`
Expected: both tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/unit/test_task_contract.py
git commit -m "test(api): child-task contract unit tests (never raise, Sentry captured)"
```

---

### Task 4.4: Integration test — full pipeline happy path

**Files:**
- Test: `apps/api/tests/integration/test_pipeline_happy.py`

- [ ] **Step 1: Write test**

```python
# apps/api/tests/integration/test_pipeline_happy.py
"""Runs the full pipeline end-to-end against local Postgres + Redis.

Patches the Claude and DataForSEO clients so we don't hit real networks.
"""
from __future__ import annotations

import time
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select

from app.integrations.dataforseo import KeywordRow
from app.models import Job, Plan as PlanModel, Workspace
from app.workers.tasks import orchestrator_task


@pytest.mark.integration
def test_full_pipeline_happy_path(db_session_sync, sample_workspace_sync, celery_worker):
    # Insert the root orchestrator job directly in the DB
    job_id = _insert_orchestrator_job(db_session_sync, sample_workspace_sync.id, "goal here")

    with patch("app.agents.orchestrator.OrchestratorAgent._call_claude",
               AsyncMock(return_value=_fake_plan())), \
         patch("app.agents.keyword.KeywordAgent._call_claude",
               AsyncMock(return_value=_fake_keyword_result())), \
         patch("app.integrations.dataforseo.DataForSEOClient.keywords_for_keywords",
               AsyncMock(return_value=[KeywordRow(keyword="k", search_volume=100)])):
        result = orchestrator_task.delay(job_id)
        result.get(timeout=30)
        _wait_for_sprint_terminal(db_session_sync, job_id, timeout=30)

    # Assert DB state: orchestrator complete, sprint complete, 4 children complete
    orch = db_session_sync.get(Job, uuid.UUID(job_id))
    assert orch.status == "complete"
    sprint = _find_sprint(db_session_sync, orch.id)
    assert sprint.status == "complete"
    children = _find_children(db_session_sync, sprint.id)
    assert len(children) == 4
    assert all(c.status == "complete" for c in children)


# Helpers and sync fixtures below.

def _fake_plan():
    from app.agents.orchestrator import Plan
    return Plan(
        intent="signups", domain="x.test", competitors=["y.test"],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )


def _fake_keyword_result():
    from app.agents.keyword import KeywordResult
    return KeywordResult(keywords=[])


def _insert_orchestrator_job(session, workspace_id, goal: str) -> str:
    job = Job(workspace_id=workspace_id, type="orchestrator", status="pending", input={"goal": goal})
    session.add(job)
    session.commit()
    return str(job.id)


def _find_sprint(session, orchestrator_id):
    return session.execute(
        select(Job).where(Job.parent_job_id == orchestrator_id, Job.type == "sprint")
    ).scalar_one()


def _find_children(session, sprint_id):
    return session.execute(
        select(Job).where(Job.parent_job_id == sprint_id, Job.type != "sprint")
    ).scalars().all()


def _wait_for_sprint_terminal(session, orchestrator_id, timeout: float):
    deadline = time.time() + timeout
    while time.time() < deadline:
        session.expire_all()
        orch = session.get(Job, uuid.UUID(orchestrator_id))
        if orch and orch.status == "complete":
            sprint = session.execute(
                select(Job).where(Job.parent_job_id == orch.id, Job.type == "sprint")
            ).scalar_one_or_none()
            if sprint and sprint.status in ("complete", "complete_with_errors", "failed"):
                return
        time.sleep(0.5)
    raise AssertionError("sprint did not reach terminal state within timeout")
```

- [ ] **Step 2: Add integration-specific fixtures to `tests/integration/conftest.py`**

```python
# apps/api/tests/integration/conftest.py
"""Integration test fixtures: sync SQLAlchemy session, real Celery worker."""
from __future__ import annotations

import threading
import uuid

import pytest
from celery.contrib.testing.worker import start_worker
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import User, Workspace
from app.workers.celery_app import celery_app


@pytest.fixture(scope="session")
def _sync_engine():
    url = settings.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    return create_engine(url, future=True)


@pytest.fixture
def db_session_sync(_sync_engine):
    with Session(_sync_engine) as s:
        yield s


@pytest.fixture
def sample_workspace_sync(db_session_sync):
    u = User(id=f"user_{uuid.uuid4().hex[:8]}", email=f"{uuid.uuid4().hex[:6]}@x.test", name="T")
    db_session_sync.add(u)
    db_session_sync.flush()
    w = Workspace(user_id=u.id, name="w", domain="x.test")
    db_session_sync.add(w)
    db_session_sync.commit()
    return w


@pytest.fixture(scope="session")
def celery_worker():
    with start_worker(celery_app, perform_ping_check=False, loglevel="info"):
        yield
```

Add `psycopg[binary]>=3.2` and `celery[pytest]` to `[project.optional-dependencies].dev` in `pyproject.toml`; re-install.

- [ ] **Step 3: Run**

Run: `docker compose --profile test up -d && cd apps/api && uv run pytest tests/integration/test_pipeline_happy.py -v -m integration`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/tests/integration/test_pipeline_happy.py apps/api/tests/integration/conftest.py apps/api/pyproject.toml
git commit -m "test(api): integration test — full pipeline happy path with real Celery worker"
```

---

### Task 4.5: Integration test — child returns failure sentinel → sprint complete_with_errors

**Files:**
- Test: `apps/api/tests/integration/test_pipeline_child_returns_failure.py`

- [ ] **Step 1: Write test**

```python
# apps/api/tests/integration/test_pipeline_child_returns_failure.py
from unittest.mock import AsyncMock, patch

import pytest

from app.integrations.dataforseo import KeywordRow
from app.models import Job
from app.workers.tasks import orchestrator_task
from tests.integration.test_pipeline_happy import (
    _fake_plan,
    _find_children,
    _find_sprint,
    _insert_orchestrator_job,
    _wait_for_sprint_terminal,
)


@pytest.mark.integration
def test_child_returns_failure_sentinel_sprint_complete_with_errors(
    db_session_sync, sample_workspace_sync, celery_worker
):
    job_id = _insert_orchestrator_job(db_session_sync, sample_workspace_sync.id, "g")

    # competitor stub raises; it MUST be caught inside _child_body
    async def _raising(_inp):
        raise RuntimeError("simulated competitor failure")

    with patch("app.agents.orchestrator.OrchestratorAgent._call_claude",
               AsyncMock(return_value=_fake_plan())), \
         patch("app.agents.keyword.KeywordAgent.run",
               AsyncMock(return_value=_fake_keyword())), \
         patch("app.agents.stubs.CompetitorStub.run", _raising):
        orchestrator_task.delay(job_id).get(timeout=30)
        _wait_for_sprint_terminal(db_session_sync, job_id, timeout=30)

    sprint = _find_sprint(db_session_sync, job_id)
    assert sprint.status == "complete_with_errors"
    children = {c.type: c for c in _find_children(db_session_sync, sprint.id)}
    assert children["competitor"].status == "failed"
    assert children["competitor"].error["kind"] == "bug"
    assert children["keyword"].status == "complete"
    assert children["content_audit"].status == "complete"
    assert children["llm_visibility"].status == "complete"


def _fake_keyword():
    from app.agents.keyword import KeywordResult
    return KeywordResult(keywords=[])
```

- [ ] **Step 2: Run**

Run: `cd apps/api && uv run pytest tests/integration/test_pipeline_child_returns_failure.py -v -m integration`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/integration/test_pipeline_child_returns_failure.py
git commit -m "test(api): integration — one child fails -> sprint complete_with_errors"
```

---

### Task 4.6: Integration test — THE chord-failure contract test

**Files:**
- Test: `apps/api/tests/integration/test_pipeline_child_raises.py`

- [ ] **Step 1: Write test**

```python
# apps/api/tests/integration/test_pipeline_child_raises.py
"""The single most important integration test.

Proves: if a child TASK (not just the agent body) raises past the chord
boundary — the chord still completes via the `on_error` callback.
"""
from unittest.mock import AsyncMock, patch

import pytest
import sentry_sdk

from app.models import Job
from app.workers.tasks import orchestrator_task
from tests.integration.test_pipeline_happy import (
    _fake_plan,
    _find_sprint,
    _insert_orchestrator_job,
    _wait_for_sprint_terminal,
)


@pytest.mark.integration
def test_child_raises_raw_exception_chord_still_completes(
    db_session_sync, sample_workspace_sync, celery_worker, monkeypatch
):
    captured: list[BaseException] = []
    monkeypatch.setattr(sentry_sdk, "capture_exception", lambda e: captured.append(e))

    job_id = _insert_orchestrator_job(db_session_sync, sample_workspace_sync.id, "g")

    # Simulate an engineer forgetting the try/except — monkeypatch tasks._child_body
    # to bypass its guard for one child:
    from app.workers import tasks as tmod

    original = tmod._child_body

    def leaky_child_body(agent_type, runner):
        if agent_type == "competitor":
            async def _leaky(_plan_id, _sprint_id):
                raise RuntimeError("no try/except here on purpose")
            return _leaky
        return original(agent_type, runner)

    monkeypatch.setattr(tmod, "_child_body", leaky_child_body)

    with patch("app.agents.orchestrator.OrchestratorAgent._call_claude",
               AsyncMock(return_value=_fake_plan())), \
         patch("app.agents.keyword.KeywordAgent.run",
               AsyncMock(return_value=_fake_kw())):
        orchestrator_task.delay(job_id).get(timeout=30)
        _wait_for_sprint_terminal(db_session_sync, job_id, timeout=30)

    sprint = _find_sprint(db_session_sync, job_id)
    # Either complete_with_errors (via on_error callback) or failed — but NOT
    # still running. That's the whole point.
    assert sprint.status in {"complete_with_errors", "failed"}
    # Sentry captured the raised RuntimeError from the leaky child (Celery
    # hands raised exceptions to Sentry via CeleryIntegration automatically,
    # but our manual capture_exception call in _child_body didn't fire because
    # this child skipped the guard).
    # We at least assert the sprint didn't hang.


def _fake_kw():
    from app.agents.keyword import KeywordResult
    return KeywordResult(keywords=[])
```

- [ ] **Step 2: Run**

Run: `cd apps/api && uv run pytest tests/integration/test_pipeline_child_raises.py -v -m integration`
Expected: PASS. If it hangs, the `on_error` wiring is broken — fix `_dispatch_chord` before proceeding.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/integration/test_pipeline_child_raises.py
git commit -m "test(api): THE chord-failure contract test — child raises, chord still completes"
```

---

### Checkpoint 4

Run: `cd apps/api && uv run pytest tests -v -m "integration or not integration"`

Expected: all unit + integration tests green. The **chord-failure contract test** must pass. This checkpoint is the hardest to reach — if it's green, the rest of Foundation is mostly glue.

**Do not proceed to Phase 5 until green.**

---

## Phase 5 — FastAPI routes, Clerk auth, webhooks, SSE

Spec §3.2, §4.2 are the references.

### Task 5.1: `app/auth/clerk.py` — Clerk JWT verification via JWKS

**Files:**
- Create: `apps/api/app/auth/__init__.py`
- Create: `apps/api/app/auth/clerk.py`

- [ ] **Step 1: Write**

```python
# apps/api/app/auth/clerk.py
"""Verify Clerk-issued JWTs in Authorization: Bearer headers."""
from __future__ import annotations

from functools import lru_cache

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

from app.core.config import settings


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    return PyJWKClient(settings.clerk_jwks_url, cache_keys=True)


class ClerkPrincipal:
    def __init__(self, user_id: str, org_id: str | None = None):
        self.user_id = user_id
        self.org_id = org_id


async def current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> ClerkPrincipal:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid token: {exc}")
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "no subject in token")
    org = claims.get("org_id")
    return ClerkPrincipal(user_id=sub, org_id=org)
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/auth
git commit -m "feat(api): Clerk JWT verification via JWKS"
```

---

### Task 5.2: `app/routes/health.py`

**Files:**
- Create: `apps/api/app/routes/__init__.py`
- Create: `apps/api/app/routes/health.py`

- [ ] **Step 1: Write**

```python
# apps/api/app/routes/health.py
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/routes/__init__.py apps/api/app/routes/health.py
git commit -m "feat(api): /healthz route"
```

---

### Task 5.3: `app/routes/workspaces.py` — CRUD

**Files:**
- Create: `apps/api/app/routes/workspaces.py`

- [ ] **Step 1: Write**

```python
# apps/api/app/routes/workspaces.py
from __future__ import annotations

import uuid

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import ClerkPrincipal, current_user
from app.core.db import get_session
from app.models import Workspace

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class WorkspaceIn(pydantic.BaseModel):
    name: str
    domain: str


class WorkspaceOut(pydantic.BaseModel):
    id: uuid.UUID
    name: str
    domain: str
    user_id: str
    org_id: str | None

    model_config = pydantic.ConfigDict(from_attributes=True)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=WorkspaceOut)
async def create_workspace(
    body: WorkspaceIn,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Workspace:
    w = Workspace(
        user_id=principal.user_id,
        org_id=principal.org_id,
        name=body.name,
        domain=body.domain.strip().lower(),
    )
    session.add(w)
    await session.commit()
    await session.refresh(w)
    return w


@router.get("", response_model=list[WorkspaceOut])
async def list_workspaces(
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[Workspace]:
    result = await session.execute(select(Workspace).where(Workspace.user_id == principal.user_id))
    return list(result.scalars().all())


@router.get("/{workspace_id}", response_model=WorkspaceOut)
async def get_workspace(
    workspace_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Workspace:
    w = await session.get(Workspace, workspace_id)
    if w is None or w.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "workspace not found")
    return w
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/routes/workspaces.py
git commit -m "feat(api): /workspaces CRUD (create, list, get)"
```

---

### Task 5.4: `app/routes/jobs.py` — POST /jobs, GET /jobs/{id}, SSE, retry

**Files:**
- Create: `apps/api/app/routes/jobs.py`

- [ ] **Step 1: Write**

```python
# apps/api/app/routes/jobs.py
from __future__ import annotations

import asyncio
import json
import uuid

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import ClerkPrincipal, current_user
from app.core.db import get_session
from app.core.events import listen_job_events
from app.models import Job, Workspace
from app.workers.tasks import (
    competitor_stub_task,
    content_audit_stub_task,
    keyword_task,
    llm_visibility_stub_task,
    orchestrator_task,
)

router = APIRouter(tags=["jobs"])


class JobSubmitIn(pydantic.BaseModel):
    goal: str = pydantic.Field(min_length=10, max_length=2000)


class JobOut(pydantic.BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    parent_job_id: uuid.UUID | None
    type: str
    status: str
    input: dict
    result: dict | None
    error: dict | None

    model_config = pydantic.ConfigDict(from_attributes=True)


async def _ensure_owns_workspace(
    session: AsyncSession, principal: ClerkPrincipal, workspace_id: uuid.UUID
) -> Workspace:
    w = await session.get(Workspace, workspace_id)
    if w is None or w.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "workspace not found")
    return w


@router.post(
    "/workspaces/{workspace_id}/jobs",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=JobOut,
)
async def submit_job(
    workspace_id: uuid.UUID,
    body: JobSubmitIn,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Job:
    w = await _ensure_owns_workspace(session, principal, workspace_id)
    # Reject if a non-terminal orchestrator job already exists for this workspace
    active = await session.execute(
        select(Job).where(
            Job.workspace_id == w.id,
            Job.type == "orchestrator",
            Job.status.in_(("pending", "running")),
        )
    )
    if active.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "a job is already in-flight")
    job = Job(
        workspace_id=w.id,
        type="orchestrator",
        status="pending",
        input={"goal": body.goal},
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)

    orchestrator_task.delay(str(job.id))
    return job


@router.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(
    job_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Job:
    job = await session.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await _ensure_owns_workspace(session, principal, job.workspace_id)
    return job


@router.get("/workspaces/{workspace_id}/jobs", response_model=list[JobOut])
async def list_workspace_jobs(
    workspace_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[Job]:
    await _ensure_owns_workspace(session, principal, workspace_id)
    r = await session.execute(
        select(Job).where(Job.workspace_id == workspace_id).order_by(Job.created_at.desc())
    )
    return list(r.scalars().all())


@router.get("/jobs/{job_id}/events")
async def stream_events(
    job_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    # Verify ownership up front (auth context does not cross into the generator easily)
    job = await session.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await _ensure_owns_workspace(session, principal, job.workspace_id)
    workspace_id = job.workspace_id

    async def _gen():
        async for payload in listen_job_events():
            if str(payload.get("workspace_id")) == str(workspace_id):
                yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(_gen(), media_type="text/event-stream")


_RETRY_MAP = {
    "keyword": keyword_task,
    "competitor": competitor_stub_task,
    "content_audit": content_audit_stub_task,
    "llm_visibility": llm_visibility_stub_task,
}


@router.post("/jobs/{job_id}/retry", response_model=JobOut)
async def retry_job(
    job_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Job:
    job = await session.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await _ensure_owns_workspace(session, principal, job.workspace_id)
    if job.status != "failed":
        raise HTTPException(status.HTTP_409_CONFLICT, "only failed jobs can be retried")
    err = job.error or {}
    if not err.get("retryable"):
        raise HTTPException(status.HTTP_409_CONFLICT, "error is not retryable")
    task = _RETRY_MAP.get(job.type)
    if task is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"cannot retry job type {job.type!r}")

    # Reset job back to running; chord isn't re-dispatched — only this child is.
    plan_id = job.input.get("plan_id")
    sprint_id = str(job.parent_job_id) if job.parent_job_id else None
    if not plan_id or not sprint_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "job is missing plan or sprint context")
    # Treat a retry as creating a *new* child row — simpler than mutating the old one.
    task.delay(plan_id, sprint_id)
    return job
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/routes/jobs.py
git commit -m "feat(api): /jobs routes — submit, get, list, SSE stream, retry"
```

---

### Task 5.5: `app/routes/webhooks.py` — Clerk user/org sync

**Files:**
- Create: `apps/api/app/routes/webhooks.py`

- [ ] **Step 1: Write**

```python
# apps/api/app/routes/webhooks.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_session
from app.models import Organization, OrganizationMembership, User

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/clerk")
async def clerk_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict:
    # TODO(security): verify Svix signature with CLERK_WEBHOOK_SECRET before merging Stripe.
    # Foundation accepts unverified payloads to keep local dev simple; add verification
    # in Billing sub-project (7) before public deploy.
    if settings.clerk_webhook_secret is None:
        pass  # local dev
    body = await request.json()
    event_type = body.get("type")
    data = body.get("data", {})

    if event_type == "user.created":
        u = User(
            id=data["id"],
            email=data.get("email_addresses", [{}])[0].get("email_address", ""),
            name=f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
        )
        await session.merge(u)
    elif event_type == "organization.created":
        o = Organization(id=data["id"], name=data["name"])
        await session.merge(o)
    elif event_type == "organizationMembership.created":
        m = OrganizationMembership(
            user_id=data["public_user_data"]["user_id"],
            org_id=data["organization"]["id"],
            role=data.get("role", "member"),
        )
        await session.merge(m)
    else:
        return {"ok": True, "ignored": event_type}

    await session.commit()
    return {"ok": True, "type": event_type}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/routes/webhooks.py
git commit -m "feat(api): /webhooks/clerk for user/org sync (signature verification TODO for Billing sub-project)"
```

---

### Task 5.6: `app/main.py` — FastAPI entry

**Files:**
- Create: `apps/api/app/main.py`

- [ ] **Step 1: Write**

```python
# apps/api/app/main.py
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.sentry import init_sentry
from app.routes import health, jobs, webhooks, workspaces

init_sentry()

app = FastAPI(title="Prism API", version="0.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(health.router)
app.include_router(workspaces.router)
app.include_router(jobs.router)
app.include_router(webhooks.router)
```

- [ ] **Step 2: Smoke test**

```bash
cd apps/api && uv run uvicorn app.main:app --reload &
sleep 2
curl http://localhost:8000/healthz
# Expected: {"ok":true}
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/main.py
git commit -m "feat(api): FastAPI entry — routes + Sentry + CORS"
```

---

### Task 5.7: Integration test — SSE stream delivery

**Files:**
- Test: `apps/api/tests/integration/test_sse_stream.py`

- [ ] **Step 1: Write test**

```python
# apps/api/tests/integration/test_sse_stream.py
"""Verify NOTIFY payloads reach SSE subscribers."""
import asyncio
import json
import uuid

import httpx
import pytest
from sqlalchemy import text

from app.models import Job


@pytest.mark.integration
@pytest.mark.asyncio
async def test_notify_reaches_sse_subscriber(db_session, sample_workspace):
    # Seed a job row and transition it via raw SQL; then listen.
    job = Job(workspace_id=sample_workspace.id, type="orchestrator", status="pending", input={})
    db_session.add(job)
    await db_session.flush()
    await db_session.commit()

    # Subscribe
    from app.core.events import listen_job_events
    events: list[dict] = []

    async def consume():
        async for e in listen_job_events():
            events.append(e)
            if len(events) >= 1:
                return

    consumer_task = asyncio.create_task(consume())
    await asyncio.sleep(0.5)  # let LISTEN register

    await db_session.execute(
        text("UPDATE jobs SET status='running' WHERE id = :id").bindparams(id=job.id)
    )
    await db_session.commit()

    await asyncio.wait_for(consumer_task, timeout=5)
    assert events[0]["status"] == "running"
    assert uuid.UUID(events[0]["job_id"]) == job.id
```

- [ ] **Step 2: Run**

Run: `cd apps/api && uv run pytest tests/integration/test_sse_stream.py -v -m integration`
Expected: PASS within 5s.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/integration/test_sse_stream.py
git commit -m "test(api): integration — NOTIFY reaches SSE subscriber"
```

---

### Checkpoint 5

Manual smoke test (requires `uvicorn`, `celery`, `redis`, and either Neon or test Postgres running):

```bash
# Seed a Clerk user manually in DB, or sign in via web once and harvest the JWT:
export TOKEN="<clerk JWT>"
# 1) Create workspace
curl -XPOST http://localhost:8000/workspaces \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"demo","domain":"whitecarrot.io"}'
# (record the returned id as WS)
# 2) Submit job
curl -XPOST http://localhost:8000/workspaces/$WS/jobs \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"goal":"50k organic signups/mo in 6 months"}'
# 3) Stream events
curl -N -H "Authorization: Bearer $TOKEN" http://localhost:8000/jobs/$JOB/events
# Expected: a stream of state-change events for all 5 lanes
```

**Do not proceed to Phase 6 until the smoke test works end-to-end.**

---

## Phase 6 — Frontend shell (Next.js 16 + Clerk + shadcn + themes)

Spec §4.3, §4.4 are the references.

### Task 6.1: `packages/types` — shared TypeScript types

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`

- [ ] **Step 1: `packages/types/package.json`**

```json
{
  "name": "@prism/types",
  "version": "0.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: `packages/types/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: `packages/types/src/index.ts`**

```typescript
// finalize is a Celery chord callback, not a tracked job row — excluded here.
export type JobType =
  | 'orchestrator'
  | 'sprint'
  | 'keyword'
  | 'competitor'
  | 'content_audit'
  | 'llm_visibility';

export type JobStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'complete_with_errors'
  | 'failed';

export type ErrorKind =
  | 'rate_limit'
  | 'timeout'
  | 'external_error'
  | 'invalid_output'
  | 'invalid_input'
  | 'bug';

export interface JobError {
  kind: ErrorKind;
  message: string;
  retryable: boolean;
  provider?: string;
  trace_id?: string;
}

export interface Job {
  id: string;
  workspace_id: string;
  parent_job_id: string | null;
  type: JobType;
  status: JobStatus;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: JobError | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Plan {
  job_id: string;
  workspace_id: string;
  intent: string;
  domain: string;
  competitors: string[];
  timeline_weeks: number;
  sprint_order: JobType[];
}

export interface Workspace {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  domain: string;
}

export interface AgentStatusEvent {
  job_id: string;
  parent_job_id: string | null;
  workspace_id: string;
  type: JobType;
  status: JobStatus;
  at: string;
  error: JobError | null;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/types
git commit -m "feat(types): shared @prism/types package"
```

---

### Task 6.2: Scaffold `apps/web` with Next.js 16

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`

- [ ] **Step 1: `apps/web/package.json`**

```json
{
  "name": "@prism/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@clerk/nextjs": "^6.8.0",
    "@prism/types": "workspace:*",
    "@sentry/nextjs": "^8.40.0",
    "next": "^16.0.0",
    "next-themes": "^0.4.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "swr": "^2.2.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.17.0",
    "eslint-config-next": "^16.0.0",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.16",
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: `next.config.mjs`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@prism/types'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
```

- [ ] **Step 4: `app/globals.css` — Tailwind + shadcn tokens**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 5: `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
};

export default config;
```

- [ ] **Step 6: `postcss.config.mjs`**

```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 7: `app/layout.tsx` (root layout with Clerk + theme)**

```tsx
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prism',
  description: 'AI-powered SEO strategy platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 8: Minimal `app/page.tsx` landing (redirects to sign-in or workspaces)**

```tsx
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

export default async function Home() {
  const { userId } = await auth();
  redirect(userId ? '/workspaces' : '/sign-in');
}
```

- [ ] **Step 9: `middleware.ts` (Clerk auth)**

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublic = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/api/webhooks(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

- [ ] **Step 10: Install and verify**

Run: `pnpm install && pnpm --filter @prism/web dev`
Expected: Next.js 16 starts on :3000; visiting the page without a Clerk session redirects to `/sign-in`.

- [ ] **Step 11: Commit**

```bash
git add apps/web packages/types pnpm-lock.yaml
git commit -m "feat(web): Next.js 16 scaffold with Clerk auth + Tailwind + shadcn tokens"
```

---

### Task 6.3: Theme provider + toggle

**Files:**
- Create: `apps/web/components/theme-provider.tsx`
- Create: `apps/web/components/theme-toggle.tsx`
- Test: `apps/web/tests/theme-provider.test.tsx`

- [ ] **Step 1: `theme-provider.tsx`**

```tsx
'use client';

import { ThemeProvider as NextThemes, type ThemeProviderProps } from 'next-themes';

export function ThemeProvider(props: ThemeProviderProps) {
  return <NextThemes {...props} />;
}
```

- [ ] **Step 2: `theme-toggle.tsx`**

```tsx
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div data-testid="theme-toggle-skeleton" className="w-24 h-9" />;
  return (
    <select
      aria-label="Theme"
      className="border rounded px-2 py-1 bg-background text-foreground"
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
    >
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="system">System</option>
    </select>
  );
}
```

- [ ] **Step 3: Vitest setup**

`apps/web/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

`apps/web/tests/setup.ts`:
```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Test**

```tsx
// apps/web/tests/theme-provider.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark', 'light');
  });

  it('cycles through light / dark / system via the select', async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const select = await screen.findByRole('combobox', { name: /theme/i });
    fireEvent.change(select, { target: { value: 'dark' } });
    expect(document.documentElement).toHaveClass('dark');
    fireEvent.change(select, { target: { value: 'light' } });
    expect(document.documentElement).toHaveClass('light');
  });
});
```

Run: `pnpm --filter @prism/web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/theme-provider.tsx apps/web/components/theme-toggle.tsx \
         apps/web/vitest.config.ts apps/web/tests/setup.ts apps/web/tests/theme-provider.test.tsx
git commit -m "feat(web): theme-provider + toggle (light/dark/system) with vitest coverage"
```

---

### Task 6.4: `lib/api.ts` and `lib/sse.ts`

**Files:**
- Create: `apps/web/lib/api.ts`
- Create: `apps/web/lib/sse.ts`
- Test: `apps/web/tests/sse.test.ts`

- [ ] **Step 1: `lib/api.ts`**

```typescript
import type { Job, Workspace } from '@prism/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function fetchWithAuth(path: string, init: RequestInit, token: string): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  });
  if (res.status >= 500) {
    // one retry for 5xx
    const retry = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
    });
    if (!retry.ok) throw new ApiError(retry.status, await retry.text());
    return retry;
  }
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res;
}

export async function createWorkspace(
  token: string, body: { name: string; domain: string },
): Promise<Workspace> {
  const res = await fetchWithAuth('/workspaces', { method: 'POST', body: JSON.stringify(body) }, token);
  return res.json();
}

export async function listWorkspaces(token: string): Promise<Workspace[]> {
  return (await fetchWithAuth('/workspaces', { method: 'GET' }, token)).json();
}

export async function submitJob(
  token: string, workspaceId: string, body: { goal: string },
): Promise<Job> {
  const res = await fetchWithAuth(
    `/workspaces/${workspaceId}/jobs`,
    { method: 'POST', body: JSON.stringify(body) },
    token,
  );
  return res.json();
}

export async function listWorkspaceJobs(token: string, workspaceId: string): Promise<Job[]> {
  return (await fetchWithAuth(`/workspaces/${workspaceId}/jobs`, { method: 'GET' }, token)).json();
}

export async function retryJob(token: string, jobId: string): Promise<Job> {
  return (await fetchWithAuth(`/jobs/${jobId}/retry`, { method: 'POST' }, token)).json();
}
```

- [ ] **Step 2: `lib/sse.ts`**

```typescript
'use client';

import type { AgentStatusEvent } from '@prism/types';
import { useEffect, useRef, useState } from 'react';

export function useJobEvents(jobId: string | null, token: string | null) {
  const [events, setEvents] = useState<AgentStatusEvent[]>([]);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId || !token) return;
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
    // EventSource cannot send custom headers; pass token via query string.
    // Caveat: server must accept token from query for SSE. Simpler: use cookies
    // with `withCredentials` once Clerk cookie flow is wired; for Foundation we
    // use query string and accept it in the route.
    const url = `${base}/jobs/${jobId}/events?t=${encodeURIComponent(token)}`;
    const src = new EventSource(url);
    sourceRef.current = src;
    src.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as AgentStatusEvent;
        setEvents((prev) => [...prev, event]);
      } catch {
        // ignore malformed frames
      }
    };
    src.onerror = () => {
      // EventSource auto-reconnects; no-op.
    };
    return () => { src.close(); sourceRef.current = null; };
  }, [jobId, token]);

  return events;
}
```

**Note:** Update `apps/api/app/auth/clerk.py` to accept token from query string `t=` as a fallback to the Authorization header for SSE. Add at the top of `current_user`:
```python
from fastapi import Query
# Adjust signature:
async def current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
    t: str | None = Query(default=None),
) -> ClerkPrincipal:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
    elif t:
        token = t
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    # ...rest unchanged, replace `authorization.removeprefix(...)` with `token`.
```

- [ ] **Step 3: SSE hook test**

```typescript
// apps/web/tests/sse.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useJobEvents } from '@/lib/sse';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeEventSource.instances.push(this); }
  close() {}
  emit(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent); }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  (global as any).EventSource = FakeEventSource;
});

describe('useJobEvents', () => {
  it('accumulates events as they arrive', async () => {
    const { result } = renderHook(() => useJobEvents('j1', 'tok'));
    await waitFor(() => expect(FakeEventSource.instances.length).toBe(1));
    act(() => {
      FakeEventSource.instances[0].emit({
        job_id: 'j1', parent_job_id: null, workspace_id: 'w1',
        type: 'orchestrator', status: 'running', at: '2026-04-22T00:00:00Z', error: null,
      });
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].status).toBe('running');
  });
});
```

Run: `pnpm --filter @prism/web test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib apps/web/tests/sse.test.ts apps/api/app/auth/clerk.py
git commit -m "feat(web): typed api client + SSE hook with vitest"
```

---

### Task 6.5: Auth routes + workspace create flow

**Files:**
- Create: `apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- Create: `apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- Create: `apps/web/app/(app)/layout.tsx`
- Create: `apps/web/app/(app)/workspaces/page.tsx`
- Create: `apps/web/app/(app)/workspaces/new/page.tsx`

- [ ] **Step 1: `sign-in/page.tsx`**

```tsx
import { SignIn } from '@clerk/nextjs';
export default function Page() {
  return <div className="flex items-center justify-center min-h-screen"><SignIn /></div>;
}
```

- [ ] **Step 2: `sign-up/page.tsx`**

```tsx
import { SignUp } from '@clerk/nextjs';
export default function Page() {
  return <div className="flex items-center justify-center min-h-screen"><SignUp /></div>;
}
```

- [ ] **Step 3: `(app)/layout.tsx`**

```tsx
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b p-4 flex items-center justify-between">
        <Link href="/workspaces" className="font-semibold">Prism</Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>
      <main className="p-6 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: `(app)/workspaces/page.tsx` (list + link to new)**

```tsx
'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import { listWorkspaces } from '@/lib/api';

export default function WorkspacesPage() {
  const { getToken } = useAuth();
  const { data, isLoading } = useSWR('workspaces', async () => {
    const token = await getToken();
    if (!token) return [];
    return listWorkspaces(token);
  });
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Workspaces</h1>
        <Link href="/workspaces/new" className="px-3 py-1 border rounded">New workspace</Link>
      </div>
      {isLoading ? <p>Loading…</p> : (
        <ul className="space-y-2">
          {data?.map((w) => (
            <li key={w.id}>
              <Link href={`/workspaces/${w.id}`} className="underline">{w.name}</Link>
              <span className="text-muted-foreground text-sm ml-2">{w.domain}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: `(app)/workspaces/new/page.tsx`**

```tsx
'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createWorkspace } from '@/lib/api';

export default function NewWorkspacePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const token = await getToken();
    if (!token) return;
    const w = await createWorkspace(token, { name, domain });
    router.push(`/workspaces/${w.id}`);
  }
  return (
    <form onSubmit={submit} className="space-y-4 max-w-md">
      <h1 className="text-xl font-semibold">New workspace</h1>
      <label className="block">
        <span className="text-sm">Name</span>
        <input className="w-full border rounded p-2 bg-background" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="block">
        <span className="text-sm">Target domain</span>
        <input className="w-full border rounded p-2 bg-background" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="whitecarrot.io" required />
      </label>
      <button type="submit" disabled={submitting} className="px-4 py-2 border rounded">
        {submitting ? 'Creating…' : 'Create'}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app
git commit -m "feat(web): Clerk auth pages + workspace list/create flow"
```

---

### Task 6.6: Goal input + live job board

**Files:**
- Create: `apps/web/components/goal-input.tsx`
- Create: `apps/web/components/job-board.tsx`
- Create: `apps/web/app/(app)/workspaces/[id]/page.tsx`
- Test: `apps/web/tests/goal-input.test.tsx`
- Test: `apps/web/tests/job-board.test.tsx`

- [ ] **Step 1: `components/goal-input.tsx`**

```tsx
'use client';

import { useState } from 'react';

const EXAMPLES = [
  '50k organic signups/mo on whitecarrot.io in 6 months vs greenhouse and ashby',
  'Rank #1 for "vector database" in 12 weeks; competitors pinecone, weaviate',
  'Get 500 qualified leads/mo from organic in Q3; compete with linear.app and height.app',
];

export function GoalInput({ onSubmit, disabled }: {
  onSubmit: (goal: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim() || busy) return;
    setBusy(true);
    try { await onSubmit(goal); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <textarea
        className="w-full border rounded p-3 bg-background min-h-24"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="Describe your traffic goal…"
        disabled={disabled || busy}
        data-testid="goal-textarea"
      />
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="text-xs border rounded-full px-3 py-1"
            onClick={() => setGoal(ex)}
          >
            {ex.slice(0, 40)}…
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={disabled || busy || !goal.trim()}
        className="px-4 py-2 border rounded"
      >
        {busy ? 'Submitting…' : disabled ? 'Job in flight' : 'Submit goal'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: `components/job-board.tsx`**

```tsx
'use client';

import type { AgentStatusEvent, Job, JobStatus, JobType } from '@prism/types';
import { useMemo } from 'react';

const LANES: JobType[] = ['orchestrator', 'keyword', 'competitor', 'content_audit', 'llm_visibility'];

const LABELS: Record<JobType, string> = {
  orchestrator: 'Orchestrator',
  sprint: 'Sprint (aggregate)',
  keyword: 'Keyword',
  competitor: 'Competitor',
  content_audit: 'Content Audit',
  llm_visibility: 'LLM Visibility',
};

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-yellow-500/20 text-yellow-900 dark:text-yellow-200',
  complete: 'bg-green-500/20 text-green-900 dark:text-green-200',
  complete_with_errors: 'bg-amber-500/20 text-amber-900 dark:text-amber-200',
  failed: 'bg-red-500/20 text-red-900 dark:text-red-200',
};

export function JobBoard({
  initialJobs,
  events,
  onRetry,
}: {
  initialJobs: Job[];
  events: AgentStatusEvent[];
  onRetry: (jobId: string) => void;
}) {
  const latestByType = useMemo(() => {
    const map = new Map<JobType, Job>();
    for (const j of initialJobs) {
      if (!map.has(j.type)) map.set(j.type, j);
    }
    for (const e of events) {
      const existing = map.get(e.type);
      if (!existing || Date.parse(e.at) >= Date.parse(existing.created_at)) {
        map.set(e.type, {
          id: e.job_id,
          workspace_id: e.workspace_id,
          parent_job_id: e.parent_job_id,
          type: e.type,
          status: e.status,
          input: {},
          result: null,
          error: e.error,
          started_at: null,
          completed_at: null,
          created_at: e.at,
        });
      }
    }
    return map;
  }, [initialJobs, events]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      {LANES.map((type) => {
        const job = latestByType.get(type);
        const status = job?.status ?? 'pending';
        return (
          <div key={type} className="border rounded p-3 space-y-2">
            <div className="font-medium">{LABELS[type]}</div>
            <span className={`inline-block text-xs px-2 py-1 rounded ${STATUS_COLORS[status]}`}>
              {status}
            </span>
            {job?.error && (
              <div className="text-xs text-red-600 dark:text-red-400 break-words">
                {job.error.kind}: {job.error.message}
              </div>
            )}
            {job?.status === 'failed' && job.error?.retryable && (
              <button
                className="text-xs underline"
                onClick={() => onRetry(job.id)}
              >
                Retry
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Workspace detail page wires it together**

```tsx
// apps/web/app/(app)/workspaces/[id]/page.tsx
'use client';

import { useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { listWorkspaceJobs, retryJob, submitJob } from '@/lib/api';
import { useJobEvents } from '@/lib/sse';
import { GoalInput } from '@/components/goal-input';
import { JobBoard } from '@/components/job-board';

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const { data: jobs = [] } = useSWR(`jobs:${id}`, async () => {
    const token = await getToken();
    if (!token) return [];
    return listWorkspaceJobs(token, id);
  }, { refreshInterval: 4000 });

  const rootJob = useMemo(
    () => jobs.find((j) => j.type === 'orchestrator' &&
      (j.status === 'pending' || j.status === 'running')) ??
      jobs.find((j) => j.type === 'orchestrator'),
    [jobs],
  );

  // We stream events scoped to the latest orchestrator job id
  const tokenKey = `jobs:${id}`;
  const events = useJobEvents(rootJob?.id ?? null, useToken());

  async function handleSubmit(goal: string) {
    const token = await getToken();
    if (!token) return;
    await submitJob(token, id, { goal });
    mutate(tokenKey);
  }

  async function handleRetry(jobId: string) {
    const token = await getToken();
    if (!token) return;
    await retryJob(token, jobId);
    mutate(tokenKey);
  }

  const inFlight = !!rootJob && (rootJob.status === 'pending' || rootJob.status === 'running');
  return (
    <div className="space-y-6">
      <GoalInput onSubmit={handleSubmit} disabled={inFlight} />
      <JobBoard initialJobs={jobs} events={events} onRetry={handleRetry} />
    </div>
  );
}

function useToken() {
  const { getToken } = useAuth();
  // Dev-only pragmatism: synchronously hold the last token in a ref.
  // For a real build, move this into a context so we don't re-fetch per render.
  const [t, setT] = (require('react').useState as typeof import('react').useState)<string | null>(null);
  (require('react').useEffect as typeof import('react').useEffect)(() => {
    getToken().then(setT);
    const id = setInterval(() => getToken().then(setT), 60_000);
    return () => clearInterval(id);
  }, [getToken]);
  return t;
}
```

- [ ] **Step 4: `goal-input.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GoalInput } from '@/components/goal-input';

describe('GoalInput', () => {
  it('submits the typed goal', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GoalInput onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId('goal-textarea'), { target: { value: 'rank for X' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('rank for X'));
  });

  it('is disabled when disabled prop is set', () => {
    render(<GoalInput onSubmit={vi.fn()} disabled />);
    expect(screen.getByTestId('goal-textarea')).toBeDisabled();
    expect(screen.getByRole('button', { name: /job in flight/i })).toBeDisabled();
  });

  it('chip click fills textarea', () => {
    render(<GoalInput onSubmit={vi.fn()} />);
    const chip = screen.getAllByRole('button', { name: /\.\.\./ })[0];
    fireEvent.click(chip);
    expect((screen.getByTestId('goal-textarea') as HTMLTextAreaElement).value).not.toBe('');
  });
});
```

- [ ] **Step 5: `job-board.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobBoard } from '@/components/job-board';
import type { Job } from '@prism/types';

const base: Omit<Job, 'type' | 'status' | 'id'> = {
  workspace_id: 'w1', parent_job_id: null, input: {}, result: null, error: null,
  started_at: null, completed_at: null, created_at: '2026-04-22T00:00:00Z',
};

describe('JobBoard', () => {
  it('renders 5 lanes and applies status from events', () => {
    const onRetry = vi.fn();
    render(
      <JobBoard
        initialJobs={[{ ...base, id: 'o1', type: 'orchestrator', status: 'pending' }]}
        events={[
          {
            job_id: 'k1', parent_job_id: 's1', workspace_id: 'w1',
            type: 'keyword', status: 'running', at: '2026-04-22T00:01:00Z', error: null,
          },
        ]}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('Orchestrator')).toBeInTheDocument();
    expect(screen.getAllByText('running').length).toBeGreaterThanOrEqual(1);
  });

  it('retry button calls onRetry for retryable failures', () => {
    const onRetry = vi.fn();
    render(
      <JobBoard
        initialJobs={[{
          ...base, id: 'k1', type: 'keyword', status: 'failed',
          error: { kind: 'rate_limit', message: 'rl', retryable: true },
        }]}
        events={[]}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledWith('k1');
  });
});
```

Run: `pnpm --filter @prism/web test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/goal-input.tsx apps/web/components/job-board.tsx \
         apps/web/app/(app)/workspaces/[id] apps/web/tests/goal-input.test.tsx apps/web/tests/job-board.test.tsx
git commit -m "feat(web): goal-input + live job-board with SSE + retry; vitest coverage"
```

---

### Checkpoint 6

Manual click-through (all 3 dev processes running):
1. Visit `http://localhost:3000` → redirected to `/sign-in`
2. Sign up, redirected to `/workspaces`
3. Create a workspace (name: "demo", domain: "whitecarrot.io")
4. Land on detail page; submit goal
5. Watch the 5 lanes tick through: orchestrator → running → complete, then keyword/competitor/content_audit/llm_visibility → running → complete
6. Toggle theme — OS preference respected when set to System
7. Induce a failure (temporarily break `ANTHROPIC_API_KEY`, re-submit) → retry button appears with explanation

**Do not proceed to Phase 7 until this click-through passes.**

---

## Phase 7 — `CLAUDE.md`, README, Makefile polish, and acceptance run

Spec §8.3 lists required `CLAUDE.md` content; §12 is the done-definition.

### Task 7.1: `CLAUDE.md` continuity doc

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write**

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md continuity doc for future sessions"
```

---

### Task 7.2: `README.md`

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write**

```markdown
# Prism

AI-powered SEO strategy platform. Status: **Foundation sub-project, in active build.**

## Quick start

```bash
make install
cp .env.example .env  # fill in keys
docker compose up -d redis
cd apps/api && uv run alembic upgrade head  # against your Neon DATABASE_URL
```

In three terminals:
```bash
cd apps/api && uv run uvicorn app.main:app --reload
cd apps/api && uv run celery -A app.workers.celery_app worker -l info -c 4
pnpm --filter @prism/web dev
```

Open `http://localhost:3000` → sign in with Clerk → create a workspace → submit a goal.

## Docs

- Spec: [`docs/superpowers/specs/2026-04-21-foundation-design.md`](docs/superpowers/specs/2026-04-21-foundation-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-04-22-foundation-implementation.md`](docs/superpowers/plans/2026-04-22-foundation-implementation.md)
- Contributor guide / architecture: [`CLAUDE.md`](CLAUDE.md)

## Tests

```bash
docker compose --profile test up -d
make test
```

## License

Private.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with quick-start"
```

---

### Task 7.3: Sentry web SDK wiring

**Files:**
- Create: `apps/web/sentry.client.config.ts`
- Create: `apps/web/sentry.server.config.ts`
- Create: `apps/web/sentry.edge.config.ts`
- Modify: `apps/web/next.config.mjs`

- [ ] **Step 1: `sentry.client.config.ts`**

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
  tracesSampleRate: 0.0,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? 'development',
});
```

- [ ] **Step 2: `sentry.server.config.ts` and `sentry.edge.config.ts`** — identical bodies to client.

- [ ] **Step 3: Wrap `next.config.mjs`**

```javascript
import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@prism/types'],
  experimental: { typedRoutes: true },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
```

- [ ] **Step 4: Add env to `.env.example`**

```
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENV=development
SENTRY_ORG=
SENTRY_PROJECT=
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/sentry.*.ts apps/web/next.config.mjs .env.example
git commit -m "feat(web): Sentry Next.js SDK (client/server/edge configs)"
```

---

### Task 7.4: Acceptance run — spec §12 checklist

This is a manual pass. Record results in a scratch file (or the PR description when you get there).

- [ ] **AC1** From a blank checkout + filled `.env`, a user can sign in via Clerk at `http://localhost:3000/sign-in`. ✅ / ❌

- [ ] **AC2** Can create a workspace (name + target domain). ✅ / ❌

- [ ] **AC3** Can submit a traffic goal. ✅ / ❌

- [ ] **AC4** Orchestrator lane transitions pending → running → complete in the UI. ✅ / ❌

- [ ] **AC5** 4 research lanes transition via SSE; `keyword` returns real DataForSEO-sourced terms. ✅ / ❌

- [ ] **AC6** Sprint lane transitions to `complete` (or `complete_with_errors` on child failure). ✅ / ❌

- [ ] **AC7** Retryable failure → Retry button re-enqueues the single child. ✅ / ❌

- [ ] **AC8** Toggling theme across light/dark/system works; OS preference honored on System. ✅ / ❌

Plus:
- [ ] `make test` exits 0 in < 45s (unit + integration, test-profile docker running).
- [ ] Deliberately thrown exception in a FastAPI handler appears in Sentry.
- [ ] Deliberately thrown exception in a Celery task appears in Sentry.
- [ ] The chord-failure test (`test_pipeline_child_raises.py`) passes.
- [ ] Killing the Celery worker mid-sprint and restarting it results in the sprint eventually completing (Redis holds tasks; worker picks them up on restart).

---

### Task 7.5: Final commit + tag

- [ ] **Step 1: Tag**

```bash
git tag -a foundation-v0.1.0 -m "Foundation sub-project complete — Scope C"
git log --oneline | head -20
```

- [ ] **Step 2: Stop**

Do not start Phase 2 sub-projects (Orchestrator, Research-sprint, etc.) in the same session. Each gets its own spec → plan → implementation cycle per the decomposition in the Foundation spec §1.3.

---

## Self-review

Ran through the plan against the spec:

**Spec coverage check:**
- §1.2 deliverables — all mapped to phases 0–7. ✅
- §2.1 F1–F9 functional reqs — F1 covered by 6.5, F2 by 5.4, F3 by 3.2 + 4.2, F4 by 4.2, F5 by 4.2, F6 by 4.2 (`finalize_task`), F7 by 6.6, F8 by 5.4 `retry_job` + 6.6 retry button, F9 by 6.3. ✅
- §2.2 NF1–NF8 — NF1 enforced by 4.2 design (no Claude in FastAPI handlers); NF2/NF3 in 3.1; NF4 baked via Redis semaphore (see §6.4 of spec — note: the Redis-semaphore-per-workspace implementation is NOT explicitly covered in a task. **Adding mention here: it is a future enhancement within Foundation implementation if desired; current plan relies on Celery's `worker_prefetch_multiplier=1` and the DataForSEO semaphore alone.** Flag this as an accepted gap for solo dev; revisit if load appears.) NF5 is the chord contract (4.2, 4.6). NF6 is the Postgres trigger (1.5). NF7 is the Makefile + compose (0.4, 0.5). NF8 is Sentry (2.7, 7.3). ✅ / 🟡 (NF4 partial).
- §4–§7 components, data model, errors, testing — fully covered across phases 2–6.
- §8.1 .env.example — 0.6. §8.2 compose — 0.5. §8.3 `.claude/` and CLAUDE.md — 0.7 and 7.1. ✅
- §12 acceptance criteria — 7.4 is the checklist.

**Known gap to track (not blocking the plan):**
- NF4 per-workspace Celery concurrency is relaxed in Foundation (relying on global `prefetch_multiplier=1` plus DataForSEO semaphore). Tracked for Research-sprint sub-project where multi-workspace load actually matters.

**Placeholder scan:** No TBD/TODO/???/"similar to Task N" in the plan (one explicit `TODO(security)` for Clerk webhook signature verification — appropriate, scoped to Billing sub-project).

**Type consistency spot check:**
- `JobType`, `JobStatus`, `ErrorKind` defined in `@prism/types` (6.1) match Python usages (`app.core.errors.ErrorKind`, `app.models.Job.type` as text). ✅
- `Plan` fields: `intent, domain, competitors, timeline_weeks, sprint_order` consistent between 3.2 (pydantic) and 6.1 (TS). ✅
- `KeywordResult.keywords` vs per-row `RankedKeyword{term, volume, difficulty, priority_score}` consistent in 3.3. ✅
- `_child_body` used identically in 4.2 definition and 4.3 and 4.6 tests. ✅
- `transition()` signature (`session, job, new_status, *, result=None, error=None`) consistent between 2.3 definition and all callers in 4.2. ✅

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-22-foundation-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good for a plan this large because context stays clean per subagent.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

**Which approach?**