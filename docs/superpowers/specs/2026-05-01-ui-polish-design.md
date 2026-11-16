# UI Polish — Design Spec
**Date:** 2026-05-01  
**Branch:** foundation-impl (current working branch)  
**Delivery:** single PR touching `job-board.tsx`, `conversation-thread.tsx`, `confirm-card.tsx`, `plan-card.tsx`, the brief page, and `@prism/types`

---

## What this covers

Three visual areas to bring the live app in line with the prototype:

1. **Job board** — sprint header, orchestrator row, agent note text, synthesis row, terminal log stream
2. **StrategyBriefCard** — border, title, 6-stat grid, action buttons
3. **Brief page** — stat strip, tab icons, and a full rebuild of each tab (Summary, Keywords, Clusters, LLM Visibility, Action Plan)

Goal-screen UX (option A): keep the current chat-thread UX; polish the empty state. No routing changes.  
Delivery strategy (option B): one PR, all three areas, deployed as a single cohesive update.

---

## 1. Job Board (`apps/web/components/job-board.tsx`)

### Sprint header  *(new)*
Rendered at the top of the job-board card when a sprint exists. Contains:
- Badge showing `sprint_status` (`running` → blue pulsing dot; `complete` → green check; `complete_with_errors` → amber)
- Label "Research sprint"
- Live elapsed timer: client-side `setInterval(1000)` from `sprint.started_at`. Resets per sprint. Shows "✓ Sprint complete" when `sprint_status` is terminal.

### Orchestrator row  *(new)*
Always shown above a thin `<hr>` divider that separates it from the research agents. Fields:
- Status: always `complete` (static)
- Note: "plan parsed · awaiting_gate0 → approved"
- Provider: "claude-sonnet-4-6"
- Elapsed: "3.1s" (static for now — actual elapsed added when orchestrator job exposes it)
- No View button

### AgentRow layout  *(changed)*
Drop the old 4-column grid + progress bar. New flex layout:

```
icon(20px) | label(min-w:140px) | Badge | note(flex:1 mono truncated) | elapsed(45px) | View button (when complete)
```

Note text is derived from status:
- `complete`: descriptive result string (e.g., "412 keywords · re-ranked by priority")
- `running`: current tool call (e.g., "dataforseo.keywords_for_keywords()")
- `pending/queued`: "queued"

Use a `NOTES` map keyed by `(agentType, status)`, same pattern as existing `LABELS`.

### Synthesis row  *(new)*
Shown below a second divider. Rendered once `sprint_status` is `complete` or `complete_with_errors`. States:
- `running` (synthesis in progress): note = "cross-referencing 4 agent outputs…"
- `complete` (brief available): note = "clusters + exec summary + action plan generated", shows View button linking to brief page

### Log stream  *(new)*
Terminal-style block below all rows. Only shown when at least one SSE event exists.

- 4-column grid: `elapsed(28px) | level(44px) | agent(90px) | message(1fr)`
- Monospace font throughout
- Populated by mapping the `events` prop already passed to `JobBoard` — no new API needed
- Max-height ~140px, `overflow-y: auto`, scrolled to bottom on new entries
- Blinking-caret animation on last line while sprint is running
- Log level colors: `ok` → green, `info` → blue, `warn` → amber, `error` → red

---

## 2. StrategyBriefCard (`apps/web/components/confirm-card.tsx`)

### Border  *(changed)*
`border: 1px solid var(--accent)` (was `var(--border)`). `border-radius: 2px 10px 10px 10px` (chat-bubble style, matching PlanCard).

### Header  *(changed)*
- Title: "Strategy Brief ready" (font-weight: 700, slightly larger)
- Inline accent badge: "Gate-1 · awaiting review"
- One-sentence synthesis summary below the title, derived from `brief.executive_summary[0].rationale` (falls back to a static string if null)

### Stats grid  *(changed)*
Replace existing 2-stat grid with a 3×2 grid using accent-colored values:

| Stat | Source |
|---|---|
| clusters | `brief.clusters.length` |
| content pieces | `brief.executive_summary.length` |
| keyword gaps | `brief.keyword_result?.keywords.length ?? 0` |
| LLM citation | `brief.llm_visibility_result?.mention_count ?? null` (shown as raw count, label "LLM mentions"; omitted if null) |
| est. traffic/mo | derived from `competitor_result?.competitors[0]?.estimated_traffic ?? null`; omitted if null |
| timeline | from the Plan fetched alongside the brief (already in the brief page); `plan.timeline_weeks` + "w" |

Show "—" for any null stat. Background: `var(--bg-elevated)`.

### Action buttons
- Primary: "✦ Review Strategy Brief →" (full accent background, links to brief page)
- Secondary: "Share link" (ghost border, copies share URL to clipboard)

### Approved state
When `brief_status === 'approved'`: border stays accent, badge changes to "approved" (green), button label changes to "View Strategy Brief →". No layout change.

---

## 3. Brief page (`apps/web/app/(app)/workspaces/[id]/briefs/[briefId]/page.tsx`)

### Header changes

**Stat strip** *(new)* — 6-column grid below the title row (before tabs):
- Each cell: mono label (9px, uppercase) + large accent value + mono sub-label
- Same 6 stats as the card (keywords, clusters, competitor gap, content pieces, LLM citation, est. traffic)

**Gate badge** *(new)* — accent "Gate-1" badge inline next to "Strategy Brief"

**Tab icons** *(new)* — each tab gets a 14px SVG icon:
- Summary → sparkle, Keywords → layers, Clusters → grid, Competitor Gap → branch, LLM Visibility → globe, Action Plan → zap

### Summary tab  *(rebuild)*

**AI synthesis box** — accent-bordered card at top:
- Prism triangle logo + "Claude synthesis" label
- Body: derived from `brief.executive_summary[0].rationale` (the top-priority insight's rationale as an executive paragraph); falls back gracefully if `executive_summary` is empty

**Insight cards** — 2×2 grid, derived from top 4 `executive_summary` items:
- Title → insight title
- Rationale → card body
- `estimated_impact` → callout badge

**Priority table** — replaces simple card list:
- Columns: `#` | title | rationale | impact badge (High / Med / Low)
- Sorted by `priority`
- Derived from `executive_summary` array (same data, different presentation)

### Keywords tab  *(rebuild)*

**Stat strip** — 4 `StatCard` components above the table:
- Total keywords, avg difficulty (with colored bar), total volume, priority pool (score ≥ 70, accent color)

**Filter bar** — client-side only, no API calls:
- Text search input (filters on keyword term)
- Intent pills: All / TOF / MOF / BOF
- Sortable column headers (click toggles asc/desc)
- State: local React state

**Table columns** *(changed)* — add to existing columns:
- **KD bar**: colored inline bar — `<30` green, `<55` amber, `≥55` red
- **CPC**: mono, from `KeywordRow.cpc`
- **Intent pill**: TOF / MOF / BOF from `KeywordRow.intent`
- **Sparkline**: 7-point mini chart from `KeywordRow.trend` (SVG polyline)
- **Competitor**: domain string from `KeywordRow.top_competitor`
- **Score bar**: colored bar + numeric value

**Expandable rows** *(new)* — click a row → expand panel showing:
- Suggested URL slug
- Rationale text
- Recommended content type
State: `expanded: string | null` in local React state.

### Clusters tab  *(polish)*

**Expandable rows** *(new)*:
- Collapsed: priority badge + cluster name + keyword count + traffic estimate + difficulty
- Expanded: hub-page card (accent left border) + spoke pages indented
- State: local

**Priority-colored left border** *(changed)*:
- P0 → `var(--ok)` (green), P1 → `var(--warn)` (amber), P2 → `var(--running)` (blue)

### LLM Visibility tab  *(restructure)*

**Per-LLM cards** *(changed)* — 4 cards (GPT-4o, Perplexity, Claude, Gemini):
- Large citation rate %, colored rate bar, "X/Y queries cited"
- Driven from `llm_visibility_result.llm_breakdown` (new optional field)
- Falls back to current "queries tested" view if field absent

**GEO actions table** *(new)*:
- Columns: action | impact % | effort badge (Low/Med/High)
- From `llm_visibility_result.geo_recommendations` (new optional array)
- Omitted if field absent

### Action Plan tab  *(rebuild)*

**Phase grouping** *(changed)* — 3 sections:
- Month 1–2: BOFU quick wins
- Month 3–4: MOFU scale
- Month 5–8: TOFU authority

Grouped by optional `phase` field on `Recommendation`. Falls back to flat sorted list if `phase` is absent.

**Type badges** *(new)* — per row: Create / Fix / Publish / Monitor. From optional `action_type` field on `Recommendation`. Omitted if absent.

**Columns**: type badge | title | cluster | volume/mo | KD. Mono right-aligned for volume + KD. "—" when null.

---

## Type changes (`packages/types/src/index.ts`)

All additions are optional fields — no breaking changes to existing consumers.

```ts
// KeywordRow — add optional fields
cpc?: number
intent?: 'TOF' | 'MOF' | 'BOF'
trend?: number[]          // 7-point volume trend
top_competitor?: string

// Recommendation — add optional fields
phase?: 'bofu' | 'mofu' | 'tofu'
action_type?: 'Create' | 'Fix' | 'Publish' | 'Monitor'

// LLMVisibilityResult — add optional fields
// (existing: queries_tested, brand_mentioned, mention_count, competitor_mentions, sample_response, note)
llm_breakdown?: Array<{
  name: string            // e.g. "GPT-4o"
  citation_rate: number   // 0–1 fraction
  cited: number           // queries where brand was cited
  total: number           // total queries tested for this LLM
}>
geo_recommendations?: Array<{
  action: string
  impact_pct: number
  effort: 'Low' | 'Med' | 'High'
}>
```

---

## Files touched

| File | Change type |
|---|---|
| `apps/web/components/job-board.tsx` | Major rebuild |
| `apps/web/components/conversation-thread.tsx` | Minor — renders synthesis row trigger |
| `apps/web/components/confirm-card.tsx` | Medium — border, header, stats |
| `apps/web/app/(app)/workspaces/[id]/briefs/[briefId]/page.tsx` | Major rebuild |
| `packages/types/src/index.ts` | Add optional fields |
| `apps/web/tests/job-board.test.tsx` | Update tests |
| `apps/web/tests/confirm-card.test.tsx` | Update tests |

---

## Out of scope

- Goal screen hero page (`/workspaces/new`) — keeping current chat-thread UX, no routing change
- Competitor Gap tab — not changing; data schema unchanged
- Backend / API changes — all new type fields are frontend-only (optional, derived from existing data or graceful fallback)
- Dark/light theme switching logic — uses existing CSS variables throughout
