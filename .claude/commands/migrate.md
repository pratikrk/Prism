---
description: Alembic migration helper.
argument-hint: "[up|down|new <name>]"
---

- `up` → `make migrate`
- `new <name>` → `make migrate-new name=<name>`
- `down` → `cd apps/api && uv run alembic downgrade -1`
