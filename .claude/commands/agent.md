---
description: Invoke a Prism agent directly via uv run.
argument-hint: "<agent_name> <json_input>"
---

From `apps/api`:
```bash
uv run python -m app.agents.cli $1 '$2'
```

Where `agent_name` is one of: `orchestrator`, `keyword`, `competitor`, `content_audit`, `llm_visibility`.
