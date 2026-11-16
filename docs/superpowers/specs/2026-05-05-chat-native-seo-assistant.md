# Chat-Native SEO Assistant

**Date:** 2026-05-05  
**Status:** Approved for implementation planning  
**Branch:** foundation-impl (built on top of existing Foundation scope)

---

## Problem

The current Prism interface accepts only one type of input: a traffic goal. Users cannot ask follow-up questions, run ad-hoc analyses, or get value until they know exactly what goal to state. The 23 skills in `vendor/claude-seo/` are available but mostly unused — only `seo-dataforseo` is wired into the keyword agent.

---

## Solution

Add a thin intent-routing layer on top of the existing pipeline. The chat input box becomes a full conversational interface. A lightweight Claude call (IntentRouterAgent) classifies every user message and dispatches it to the correct handler. The existing orchestrator → plan → sprint → brief pipeline is untouched.

Additionally: when a workspace is created, a quick site audit fires automatically in the background. Prism's first message in the thread is always the audit result — giving users instant value before they've typed anything.

---

## What We're Building

### 1. QuickAuditAgent

A new agent (`app/agents/quick_audit.py`) that analyses a domain's homepage and returns a structured audit result.

**Inputs:** `domain: str`

**What it does:**
1. Fetches the homepage HTML via `httpx` (already a dep, used in tests)
2. Calls two existing `DataForSEOClient` methods in parallel:
   - `domain_rank_overview(domain)` → DR, estimated organic traffic (etv), pos_1/pos_2_3/etc counts
   - `ranked_keywords(domain, limit=5)` → top 5 keywords the domain already ranks for
3. Sends fetched HTML + DataForSEO data to Claude with a system prompt built from three vendor skill prompts concatenated:
   - `vendor/claude-seo/skills/seo-technical/SKILL.md` — robots, canonical, CWV signals, security headers, AI crawler rules
   - `vendor/claude-seo/skills/seo-content/SKILL.md` — E-E-A-T, thin content, readability
   - `vendor/claude-seo/skills/seo-geo/SKILL.md` — llms.txt, AI citability, Perplexity/ChatGPT visibility

**Output model:**
```python
class AuditScore(BaseModel):
    technical: int          # 0-100
    content: int            # 0-100
    ai_visibility: int      # 0-100
    overall: int            # weighted: technical 35%, content 35%, ai_visibility 30%

class ActionItem(BaseModel):
    severity: Literal["critical", "high", "medium", "quick_win"]
    title: str
    rationale: str
    effort_minutes: int | None   # null = unknown

class QuickAuditResult(BaseModel):
    domain: str
    domain_rating: int | None
    estimated_monthly_traffic: int | None
    top_keywords: list[str]
    score: AuditScore
    action_items: list[ActionItem]   # ordered: critical first, max 8
    scanned_at: str                  # ISO datetime
```

**BACKING_SKILL:** `None`. `QuickAuditAgent` overrides `system_prompt()` to concatenate three skill files (instead of the single-skill `BACKING_SKILL` pattern in `BaseAgent`). The `load_skill_prompt()` helper from `app.skills.loader` is used for each.

---

### 2. IntentRouterAgent

A lightweight Claude call (`app/agents/intent_router.py`) that classifies user input and returns a structured routing decision. Uses `claude-haiku-4-5` (fast, cheap) — not the full Sonnet model.

**Input:** `message: str`, `workspace_context: dict` (domain, has_audit, has_plan)

**Output:**
```python
class RouterDecision(BaseModel):
    intent: Literal["goal_setting", "audit", "keyword", "competitor", "question", "unknown"]
    confidence: float          # 0.0–1.0
    extracted_params: dict     # e.g. {"competitor": "hubspot.com"} for competitor intent
    fallback_message: str | None  # shown if intent == "unknown"
```

**Routing table:**

| Intent | Example messages | Handler |
|---|---|---|
| `goal_setting` | "I want 10k visitors/month", "grow my blog" | existing `orchestrator_task` pipeline |
| `audit` | "audit my site", "run a full check", "what's wrong with my site" | `quick_audit_task` |
| `keyword` | "what keywords am I missing?", "show me keyword gaps" | `keyword_task` directly |
| `competitor` | "what's HubSpot ranking for?", "compare me to Salesforce" | `competitor_task` directly |
| `question` | "what's my biggest issue?", "explain my AI score" | `answer_task` (answers from stored audit/plan data) |
| `unknown` | anything else | returns `fallback_message` to display in thread |

**Low confidence (< 0.7):** router returns `unknown` with a clarifying fallback message rather than guessing.

---

### 3. Celery Tasks

**`quick_audit_task(workspace_id)`** — new task in `app/workers/tasks.py`

- Follows the existing `_child_body` pattern (try/except, never raises past task boundary)
- Calls `QuickAuditAgent().run(QuickAuditInput(domain=workspace.domain))`
- Stores result in `audit_results` table
- Sends `NOTIFY job_events` so SSE pushes the card to the browser immediately

**`chat_dispatch_task(workspace_id, message, user_id)`** — new task

- Called by `POST /workspaces/{id}/chat`
- Runs `IntentRouterAgent` to classify `message`
- Based on `intent`, dispatches to the appropriate existing or new task
- Stores the user message + Prism's response in the thread (new `messages` table or reuse existing jobs mechanism)

---

### 4. Database

**`audit_results` table** (new migration):
```sql
id          uuid primary key
workspace_id uuid references workspaces(id)
result      jsonb not null          -- QuickAuditResult as JSON
created_at  timestamptz default now()
```

One row per workspace (upsert on re-audit). No separate audit job row needed — audit is surfaced directly via the result record, not via the jobs/sprint machinery.

**`chat_messages` table** (new migration):
```sql
id           uuid primary key
workspace_id uuid references workspaces(id)
role         text check (role in ('user', 'assistant'))
content      text not null
intent       text                    -- null for assistant messages
metadata     jsonb                   -- linked job_id, plan_id, etc.
created_at   timestamptz default now()
```

---

### 5. API Routes

**`POST /workspaces/{id}/chat`** — new route in `app/routes/briefs.py` or new `chat.py`

```
Body: { "message": string }
Returns: { "message_id": uuid, "status": "dispatched" }
```

Immediately queues `chat_dispatch_task`, returns 202. Response arrives via SSE (existing job_events channel).

**`GET /workspaces/{id}/thread`** — existing route, extended

Currently returns `ThreadItem[]`. Extended to also return `audit` type items:
```typescript
type ThreadAuditItem = {
  type: 'audit'
  result: QuickAuditResult
  created_at: string
}
```

**`POST /workspaces` (workspace creation)** — extended

After inserting workspace row, immediately queues `quick_audit_task.delay(workspace_id)`. One-liner addition.

---

### 6. Frontend

**`ChatInput` component** — upgrade of `GoalInput`

- Same visual design (text box pinned at bottom)
- Placeholder changes: `"Ask anything — audit my site, keyword gaps, competitor analysis…"`
- `onSubmit(message)` posts to `POST /workspaces/{id}/chat` instead of `POST /workspaces/{id}/jobs`
- Keeps the existing `onSubmit(goal)` path for backward compat during transition

**`AuditCard` component** — new, renders `ThreadAuditItem`

Structure (top to bottom):
1. Header: "Site audit complete — {domain}" + overall score badge (color: red <50, amber 50-74, green ≥75)
2. Score bars: Technical · Content · AI Visibility · Domain Rating (4 columns)
3. Action items list: severity badge + title + rationale, ordered critical → high → quick_win, max 8
4. Footer: "What's your traffic goal? I'll build a sprint plan around these findings." + "View full report →" button (links to `/workspaces/{id}/audit`)

**`ConversationThread`** — add `audit` case to the existing `items.map()` switch

**`/workspaces/{id}/audit`** — new page, full audit detail view (all action items, DataForSEO data, score breakdown). Out of scope for this sprint — the "View full report →" button is a stub for now.

---

## Data Flow (end to end)

```
User creates workspace
  → POST /workspaces inserts row
  → quick_audit_task.delay(workspace_id)          # background
      → fetch homepage HTML (httpx)
      → DataForSEO domain_overview()
      → QuickAuditAgent.run() → QuickAuditResult
      → INSERT audit_results
      → NOTIFY job_events
  → SSE pushes AuditCard to browser thread

User types in chat input
  → POST /workspaces/{id}/chat {message}
  → chat_dispatch_task.delay(workspace_id, message)
      → IntentRouterAgent.run() → RouterDecision
      → if goal_setting  → orchestrator_task.delay()   # existing
      → if audit         → quick_audit_task.delay()
      → if keyword       → keyword_task.delay()         # existing
      → if question      → answer inline from stored data
      → INSERT chat_messages (user + assistant)
      → NOTIFY job_events
  → SSE pushes response card to thread
```

---

## What is NOT in scope

- `/workspaces/{id}/audit` full detail page (stub link only)
- `answer_task` for `question` intent — returns a static "Here's what I know so far" message for now
- `competitor` and `keyword` intents wired to live agents — router classifies them but falls back to a "start a sprint for this" suggestion until Research-sprint sub-project
- Backlink analysis (Moz/Bing API not available)
- Screenshots / Playwright (seo-visual skill)
- Google Search Console / GA4 integration (seo-google skill)
- Multi-page crawl (homepage only for quick audit)

---

## Build Order

1. `QuickAuditAgent` + unit tests (mocked DataForSEO + mocked httpx)
2. `quick_audit_task` Celery wrapper + integration test
3. DB migration: `audit_results` + `chat_messages`
4. Wire workspace creation → `quick_audit_task.delay()`
5. Thread endpoint: add `audit` type to response
6. `AuditCard` frontend component
7. `ConversationThread`: add `audit` case
8. `IntentRouterAgent` + unit tests
9. `chat_dispatch_task` + `POST /workspaces/{id}/chat` route
10. `ChatInput` upgrade (wraps existing GoalInput path)

---

## Vendor Skills Used

| Skill file | Used in | How |
|---|---|---|
| `seo-technical/SKILL.md` | `QuickAuditAgent.system_prompt()` | Concatenated into system prompt |
| `seo-content/SKILL.md` | `QuickAuditAgent.system_prompt()` | Concatenated into system prompt |
| `seo-geo/SKILL.md` | `QuickAuditAgent.system_prompt()` | Concatenated into system prompt |
| `seo-dataforseo/SKILL.md` | `KeywordAgent` (existing) | Already wired via BACKING_SKILL |

All other vendor skills (`seo-schema`, `seo-sitemap`, `seo-cluster`, etc.) are available for future intents as the conversational assistant expands.
