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
