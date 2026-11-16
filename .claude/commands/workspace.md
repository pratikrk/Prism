---
description: Create a workspace and submit a traffic goal end-to-end.
argument-hint: "<domain> \"<goal>\""
---

Run the full Prism Foundation pipeline against local dev:

1. POST `http://localhost:8000/workspaces` with `{name, domain: "$1"}`
2. POST `http://localhost:8000/workspaces/{id}/jobs` with `{goal: "$2"}`
3. Subscribe to `http://localhost:8000/jobs/{job_id}/events` and print transitions

Use `curl` and `httpie`.
