# Prism Orchestrator — Design Spec

**Date:** 2026-04-29
**Status:** Approved
**Sub-project:** 2 of 7 — Orchestrator (Gate-0 review UI + re-planning)
**Author:** Pratik (with Claude Code, Superpowers brainstorming flow)

---

## 1. Context

Foundation (sub-project 1) delivered a fully working pipeline: user submits a goal → orchestrator calls Claude → Plan produced → research chord auto-fires. The Plan was invisible to the user; the sprint started unconditionally.

This sub-project adds **Gate-0**: the orchestrator stops after producing a Plan and waits for the user to review, edit, refine, or approve before the research sprint begins. The workspace detail page becomes a **conversation thread** — the primary surface for all interaction with Prism.

---

## 2. Goals and requirements

### 2.1 Functional requirements

- **F1** After the orchestrator produces a Plan, the pipeline pauses (`awaiting_gate0`) and does not dispatch the research chord until the user explicitly approves.
- **F2** The workspace detail page renders a scrollable conversation thread: goal bubbles (user) and Plan cards (Prism), ordered chronologically.
- **F3** Plan fields (`competitors[]`, `timeline_weeks`, `intent`) are editable inline on the Plan card.
- **F4** A "Refine" expando on the Plan card accepts free-text feedback and re-runs the orchestrator with that context, producing a new Plan version in the thread.
- **F5** Previous Plan versions remain visible in the thread (scroll up to see history); each re-plan marks the prior plan `superseded`.
- **F6** "Approve" on the latest Plan card transitions to a ConfirmCard summarising the upcoming agents, then a "Start Research" button dispatches the chord.
- **F7** The job board appears inline in the thread below the ConfirmCard, driven by SSE, same lanes as Foundation.
- **F8** If the orchestrator job fails, the thread shows an error card with a Retry button.
- **F9** The goal input remains fixed at the bottom of the page; submitting a new goal starts a new exchange in the same thread.

### 2.2 Non-functional requirements

- **NF1** All existing chord-failure and SSE contracts from Foundation are preserved.
- **NF2** Inline edits are validated client-side (`timeline_weeks` 1–52, `competitors` max 10) and enforced at the API boundary.
- **NF3** Approve and Re-plan buttons are disabled while another orchestrator job is `pending` or `running` for the same workspace. The API returns 409 if this constraint is violated.
- **NF4** `GET /workspaces/{id}/thread` is a single read endpoint — no N+1 queries; it joins orchestrator jobs, plans, and child jobs in one query ordered by `created_at`.

### 2.3 Out of scope

- Real competitor / content-audit / LLM-visibility agents (Research Sprint sub-project)
- Gate-1 review UI (Research Sprint sub-project)
- OpenTelemetry distributed tracing (Research Sprint sub-project)

---

## 3. Architecture

### 3.1 Pipeline change

**Before (Foundation):**
```
orchestrator_task → Plan saved → chord dispatched immediately
```

**After (this sub-project):**
```
orchestrator_task → Plan saved → job.status = awaiting_gate0 (NOTIFY)
                                               ↓ user approves
                              POST /plans/{id}/approve → chord dispatched
```

The `awaiting_gate0` status is added to the allowed transition table in `app/core/jobs.py`.

### 3.2 Re-planning flow

```
POST /plans/{id}/refine { feedback }
  → current plan.plan_status = 'superseded'
  → new orchestrator job created (input includes original goal + feedback)
  → orchestrator_task runs → new Plan (version N+1) → awaiting_gate0
```

### 3.3 Conversation thread data model

`GET /workspaces/{id}/thread` returns an ordered list of `ThreadItem` objects:

```
ThreadItem =
  | { type: 'goal',    job_id, goal, submitted_at }
  | { type: 'plan',    plan_id, version, intent, domain, competitors,
                       timeline_weeks, sprint_order, feedback,
                       plan_status, job_status, created_at }
  | { type: 'jobs',    sprint_job_id, children: Job[] }
  | { type: 'error',   job_id, error, created_at }
```

Items are ordered by `created_at`. A single orchestrator job contributes one `goal` item and one `plan` or `error` item. An approved plan contributes a `jobs` item once the sprint exists.

---

## 4. Data model changes

### 4.1 New migration: `0003_orchestrator_gate0.py`

**`plans` table additions:**
```sql
ALTER TABLE plans ADD COLUMN version         INTEGER NOT NULL DEFAULT 1;
ALTER TABLE plans ADD COLUMN feedback        TEXT;
ALTER TABLE plans ADD COLUMN plan_status     VARCHAR NOT NULL DEFAULT 'draft';
ALTER TABLE plans ADD COLUMN parent_plan_id  UUID REFERENCES plans(id) ON DELETE SET NULL;
```

`plan_status` values: `draft` | `approved` | `superseded`

**`jobs` table:** no schema change — `awaiting_gate0` is a new allowed string value for the existing `status` column.

### 4.2 Updated SQLAlchemy model

```python
class Plan(Base, TimestampMixin):
    # existing fields unchanged
    version:        Mapped[int]           # 1, 2, 3… per workspace goal session
    feedback:       Mapped[str | None]    # refinement note that produced this version
    plan_status:    Mapped[str]           # 'draft' | 'approved' | 'superseded'
    parent_plan_id: Mapped[uuid.UUID | None]  # FK → plans.id
```

---

## 5. API endpoints

### Existing (unchanged)
- `POST /workspaces/{id}/jobs` — submit goal, creates orchestrator job

### New endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/workspaces/{id}/thread` | Full conversation thread, ordered by time |
| `PATCH` | `/plans/{plan_id}` | Inline edit (`competitors`, `timeline_weeks`, `intent`) |
| `POST` | `/plans/{plan_id}/approve` | Creates sprint job, dispatches chord |
| `POST` | `/plans/{plan_id}/refine` | Marks plan superseded, new orchestrator job with feedback |

**`POST /plans/{plan_id}/approve` — 409 guard:**
Returns 409 if any orchestrator job for the workspace is `pending` or `running`.

**`POST /plans/{plan_id}/refine` body:**
```json
{ "feedback": "also include lever.co as competitor" }
```
The new orchestrator job receives `input = { goal: <original>, feedback: <string> }`.

---

## 6. Frontend components

All components live in `apps/web/components/` and `apps/web/app/(app)/workspaces/[id]/page.tsx`.

### `ConversationThread`
Scrollable container. Fetches `/workspaces/{id}/thread` via SWR. SSE events from the active orchestrator or sprint job trigger SWR revalidation. Renders `ThreadItem[]` top-to-bottom.

### `GoalBubble`
Right-aligned chip. Props: `goal: string`, `submittedAt: Date`.

### `PlanCard`
Left-aligned AI response card. Props: `plan: Plan`, `jobStatus: string`, `onEdit`, `onRefine`, `onApprove`.
- Fields editable inline on click (`competitors` as tag input, `timeline_weeks` as number input, `intent` as text input)
- "Refine" expando: text input + "Re-plan" button
- "Approve" button — disabled when `jobStatus !== 'awaiting_gate0'` or another orchestrator is active
- Shows `plan_status` badge: `draft` (default) | `superseded` (greyed out)

### `ConfirmCard`
Appears after Approve is clicked. Shows: "Starting {N} research agents for {domain}…" with agent names listed. "Start Research" button posts to `/plans/{id}/approve` and dismisses itself.

### `JobBoardInThread`
Thin wrapper around existing `JobBoard`. Appears below ConfirmCard once sprint job id is known. Driven by SSE on the sprint job id.

### `ErrorCard`
Shows classified error message + Retry button (posts to existing `/jobs/{id}/retry`).

### `GoalInput` (existing)
Unchanged. Fixed at bottom of page.

---

## 7. Orchestrator agent change

The `orchestrator_task` in `app/workers/tasks.py` is modified:

1. After saving the Plan, transition orchestrator job → `awaiting_gate0` (NOTIFY fires, UI updates)
2. Remove the `_dispatch_chord` call from `orchestrator_task`
3. `_dispatch_chord` is now called from the `POST /plans/{plan_id}/approve` route handler (via a new Celery task `approve_task` or directly via `.apply_async()`)

The re-plan input format passed to `OrchestratorAgent`:
```python
OrchestratorInput(goal=f"{original_goal}\n\nFeedback: {feedback}")
```

---

## 8. State transition table (updated)

| From | To | Trigger |
|------|----|---------|
| `pending` | `running` | Celery task starts |
| `running` | `awaiting_gate0` | Orchestrator saves Plan (new) |
| `awaiting_gate0` | `complete` | User approves (new) |
| `running` | `complete` | Child/sprint task completes |
| `running` | `failed` | Unhandled error |
| `running` | `complete_with_errors` | Sprint with partial failures |

---

## 9. Shared types (`packages/types/`)

New TypeScript types added to `@prism/types`:

```typescript
export type PlanStatus = 'draft' | 'approved' | 'superseded'

export type Plan = {
  id: string
  jobId: string
  workspaceId: string
  version: number
  intent: string
  domain: string
  competitors: string[]
  timelineWeeks: number
  sprintOrder: string[]
  feedback: string | null
  planStatus: PlanStatus
  parentPlanId: string | null
  createdAt: string
}

export type ThreadItem =
  | { type: 'goal';  jobId: string; goal: string; submittedAt: string }
  | { type: 'plan';  plan: Plan; jobStatus: string }
  | { type: 'jobs';  sprintJobId: string; children: Job[] }
  | { type: 'error'; jobId: string; error: JobError; createdAt: string }
```

---

## 10. Testing

### API unit tests
- `test_plan_approve_dispatches_chord` — mocked chord, verifies sprint job created + chord called
- `test_plan_approve_409_when_orchestrator_running` — concurrent orchestrator returns 409
- `test_plan_refine_supersedes_previous` — refine marks old plan superseded, new job created
- `test_plan_patch_validates_timeline` — timeline_weeks outside 1–52 → 422
- `test_thread_endpoint_order` — thread items returned in created_at order

### Integration tests
- `test_gate0_full_flow` — goal → awaiting_gate0 → approve → chord → finalize
- `test_gate0_refine_then_approve` — goal → plan v1 → refine → plan v2 → approve → chord

### Frontend (Vitest)
- `ConversationThread` renders goal bubbles and plan cards from thread fixture
- `PlanCard` inline edit calls `onEdit` with updated fields
- `PlanCard` approve disabled when `jobStatus !== 'awaiting_gate0'`
- `ConfirmCard` calls `onConfirm` and posts to correct endpoint

---

## 11. Acceptance criteria

1. Submitting a goal produces an orchestrator job that stops at `awaiting_gate0` — no chord fires automatically.
2. The workspace thread shows the goal bubble and Plan card with correct fields.
3. Inline editing competitors and timeline persists via PATCH and reflects immediately.
4. Re-planning with feedback produces a new Plan card (v2) in the thread; v1 shows `superseded` badge.
5. Approve → ConfirmCard → Start Research dispatches the chord; job board appears in thread.
6. Concurrent approve/refine while an orchestrator is running returns 409; UI shows toast.
7. Orchestrator failure renders ErrorCard with Retry button; retry re-enqueues the task.
8. All 7 new API unit tests and 2 integration tests pass.
9. All 4 new Vitest component tests pass.
10. TypeScript strict-mode passes with no errors.
