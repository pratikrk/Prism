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
