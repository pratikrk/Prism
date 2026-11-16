# UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the live app's job board, StrategyBriefCard, and brief page visually in line with the prototype — sprint header, orchestrator row, log stream, 6-stat card, and rich keyword/cluster/LLM/action-plan tabs.

**Architecture:** Single PR across `@prism/types`, `job-board.tsx`, `conversation-thread.tsx`, and `briefs/[briefId]/page.tsx`. No backend changes — all new type fields are optional and data is derived from existing API responses. TDD throughout: write the failing test, watch it fail, implement, watch it pass, commit.

**Tech Stack:** Next.js 16, React, TypeScript strict, Vitest + Testing Library, `@prism/types` shared types package.

---

## File Map

| File | Change |
|---|---|
| `packages/types/src/index.ts` | Add optional fields to `KeywordRow`, `Recommendation`, `LLMVisibilityResult` |
| `apps/web/components/job-board.tsx` | Full rebuild — sprint header, orchestrator row, new AgentRow layout, synthesis row, log stream |
| `apps/web/components/conversation-thread.tsx` | Update `StrategyBriefCard` — accent border, 6-stat grid, new header |
| `apps/web/app/(app)/workspaces/[id]/briefs/[briefId]/page.tsx` | Stat strip, tab icons, Summary/Keywords/Clusters/LLM/Action Plan tab rebuilds |
| `apps/web/tests/job-board.test.tsx` | Update for new props + new rows |

---

## Task 1: Add optional type fields

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Add fields**

Replace the three interfaces in `packages/types/src/index.ts`:

```ts
// KeywordRow — was: { term, volume, difficulty, priority_score }
export interface KeywordRow {
  term: string;
  volume: number | null;
  difficulty: number | null;
  priority_score: number;
  cpc?: number;
  intent?: 'TOF' | 'MOF' | 'BOF';
  trend?: number[];          // 7-point volume history
  top_competitor?: string;
}

// Recommendation — was: { title, rationale, estimated_impact, priority }
export interface Recommendation {
  title: string;
  rationale: string;
  estimated_impact: string;
  priority: number;
  phase?: 'bofu' | 'mofu' | 'tofu';
  action_type?: 'Create' | 'Fix' | 'Publish' | 'Monitor';
}

// LLMVisibilityResult — add two optional fields at the bottom
export interface LLMVisibilityResult {
  queries_tested: string[];
  brand_mentioned: boolean;
  mention_count: number;
  competitor_mentions: Record<string, number>;
  sample_response: string;
  note: string;
  llm_breakdown?: Array<{
    name: string;
    citation_rate: number;   // 0–1 fraction
    cited: number;
    total: number;
  }>;
  geo_recommendations?: Array<{
    action: string;
    impact_pct: number;
    effort: 'Low' | 'Med' | 'High';
  }>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/types && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add optional fields to KeywordRow, Recommendation, LLMVisibilityResult"
```

---

## Task 2: Job Board — sprint header, orchestrator row, new AgentRow layout

**Files:**
- Modify: `apps/web/components/job-board.tsx`
- Modify: `apps/web/tests/job-board.test.tsx`

The `JobBoard` needs two new props: `sprintStatus` (to drive the sprint header badge and synthesis row logic) and `sprintStartedAt` (for the elapsed timer). Both are optional — the board renders fine without them.

- [ ] **Step 1: Write failing tests**

Replace the full content of `apps/web/tests/job-board.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JobBoard } from '@/components/job-board';
import type { Job } from '@prism/types';

const base: Omit<Job, 'type' | 'status' | 'id'> = {
  workspace_id: 'w1', parent_job_id: null, input: {}, result: null, error: null,
  started_at: null, completed_at: null, created_at: '2026-04-22T00:00:00Z',
};

describe('JobBoard', () => {
  it('renders 4 research agent lanes', () => {
    render(
      <JobBoard
        initialJobs={[]}
        events={[]}
        workspaceId="w1"
        briefId={null}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('Keyword Research')).toBeInTheDocument();
    expect(screen.getByText('Competitor Analysis')).toBeInTheDocument();
    expect(screen.getByText('Content Audit')).toBeInTheDocument();
    expect(screen.getByText('LLM Visibility')).toBeInTheDocument();
  });

  it('shows orchestrator row always', () => {
    render(
      <JobBoard
        initialJobs={[]}
        events={[]}
        workspaceId="w1"
        briefId={null}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('Orchestrator')).toBeInTheDocument();
  });

  it('shows sprint header when sprintStatus provided', () => {
    render(
      <JobBoard
        initialJobs={[]}
        events={[]}
        workspaceId="w1"
        briefId={null}
        sprintStatus="running"
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/research sprint/i)).toBeInTheDocument();
  });

  it('shows synthesis row as complete when sprint is awaiting_gate1', () => {
    render(
      <JobBoard
        initialJobs={[]}
        events={[]}
        workspaceId="w1"
        briefId="b1"
        sprintStatus="awaiting_gate1"
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('Synthesis')).toBeInTheDocument();
  });

  it('applies status from SSE events', () => {
    render(
      <JobBoard
        initialJobs={[]}
        events={[
          {
            job_id: 'k1', parent_job_id: 's1', workspace_id: 'w1',
            type: 'keyword', status: 'running', at: '2026-04-22T00:01:00Z', error: null,
          },
        ]}
        workspaceId="w1"
        briefId={null}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('Keyword Research')).toBeInTheDocument();
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
        workspaceId="w1"
        briefId={null}
        onRetry={onRetry}
      />,
    );
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    retryBtn.click();
    expect(onRetry).toHaveBeenCalledWith('k1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm test -- --run tests/job-board.test.tsx
```

Expected: failures on "shows orchestrator row always", "shows sprint header", "shows synthesis row".

- [ ] **Step 3: Replace job-board.tsx with the new implementation**

Replace the full content of `apps/web/components/job-board.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { AgentStatusEvent, Job, JobStatus, JobType } from '@prism/types';
import { useEffect, useMemo, useRef, useState } from 'react';

const LANES: JobType[] = ['keyword', 'competitor', 'content_audit', 'llm_visibility'];

const LABELS: Record<JobType, string> = {
  orchestrator:   'Orchestrator',
  sprint:         'Sprint',
  keyword:        'Keyword Research',
  competitor:     'Competitor Analysis',
  content_audit:  'Content Audit',
  llm_visibility: 'LLM Visibility',
  synthesis:      'Synthesis',
};

const BRIEF_TAB: Partial<Record<JobType, string>> = {
  keyword:        'keywords',
  competitor:     'competitor',
  content_audit:  'clusters',
  llm_visibility: 'llm',
};

// Note text shown in the mono note column per (agentType, status)
const NOTES: Partial<Record<JobType, Partial<Record<JobStatus | 'queued', string>>>> = {
  keyword:        { complete: 'keywords ranked by priority', running: 'dataforseo.keywords_for_keywords()', queued: 'queued' },
  competitor:     { complete: 'gap keywords + quick wins extracted', running: 'serp.organic() · crawling', queued: 'queued' },
  content_audit:  { complete: 'pages audited · missing topics identified', running: 'crawling site pages', queued: 'queued' },
  llm_visibility: { complete: 'mention rate recorded', running: 'querying LLM endpoints', queued: 'queued' },
  synthesis:      { complete: 'clusters + exec summary + action plan generated', running: 'cross-referencing agent outputs…', queued: 'awaits all agents · chord callback' },
};

/* ─── Status icon ──────────────────────────────────────────────────────────── */
function StatusIcon({ status }: { status: JobStatus | 'queued' }) {
  if (status === 'complete') {
    return (
      <svg width={10} height={10} viewBox="0 0 16 16" fill="none">
        <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  if (status === 'failed') {
    return (
      <svg width={10} height={10} viewBox="0 0 16 16" fill="none">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    );
  }
  if (status === 'running') {
    return (
      <span className="prism-pulse" style={{
        display: 'block', width: 6, height: 6, borderRadius: 3, background: 'currentColor',
      }} />
    );
  }
  return (
    <svg width={10} height={10} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" fill="currentColor" opacity="0.4"/>
    </svg>
  );
}

function iconColors(status: JobStatus | 'queued'): { bg: string; color: string } {
  if (status === 'complete') return { bg: 'var(--ok-dim)', color: 'var(--ok)' };
  if (status === 'failed')   return { bg: 'var(--err-dim)', color: 'var(--err)' };
  if (status === 'running')  return { bg: 'var(--running-dim)', color: 'var(--running)' };
  return { bg: 'var(--bg-hover)', color: 'var(--text-dim)' };
}

/* ─── Sprint header ────────────────────────────────────────────────────────── */
function SprintHeader({ sprintStatus, startedAt }: { sprintStatus: JobStatus; startedAt: string | null }) {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (!startedAt || sprintStatus !== 'running') return;
    const origin = new Date(startedAt).getTime();
    setElapsed(Math.floor((Date.now() - origin) / 1000));
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - origin) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt, sprintStatus]);

  const isTerminal = sprintStatus === 'complete' || sprintStatus === 'complete_with_errors' || sprintStatus === 'awaiting_gate1';
  const badge = isTerminal
    ? { label: '✓ Sprint complete', bg: 'var(--ok-dim)', color: 'var(--ok)' }
    : sprintStatus === 'running'
    ? { label: 'running', bg: 'var(--running-dim)', color: 'var(--running)' }
    : { label: sprintStatus, bg: 'var(--bg-hover)', color: 'var(--text-dim)' };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 14px', borderBottom: '1px solid var(--border)',
      background: 'var(--bg-elev)',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 3,
        fontSize: 10, fontWeight: 500,
        background: badge.bg, color: badge.color,
        fontFamily: 'var(--font-mono, monospace)',
      }}>
        {sprintStatus === 'running' && (
          <span className="prism-pulse" style={{ display: 'block', width: 5, height: 5, borderRadius: 3, background: 'currentColor' }} />
        )}
        {badge.label}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text)' }}>Research sprint</span>
      {sprintStatus === 'running' && startedAt && (
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 2 }}>
          {elapsed}s elapsed
        </span>
      )}
    </div>
  );
}

/* ─── Orchestrator row ─────────────────────────────────────────────────────── */
function OrchestratorRow() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px', fontSize: 12,
      background: 'rgba(62,207,142,0.03)',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
        background: 'var(--ok-dim)', color: 'var(--ok)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <StatusIcon status="complete" />
      </span>
      <span style={{ fontWeight: 500, color: 'var(--text)', minWidth: 140, fontSize: 12 }}>Orchestrator</span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 500,
        background: 'var(--ok-dim)', color: 'var(--ok)',
        fontFamily: 'var(--font-mono, monospace)',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 3, background: 'currentColor', display: 'inline-block' }} />
        done
      </span>
      <span className="mono" style={{ flex: 1, fontSize: 11, color: 'var(--text-mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        plan parsed · awaiting_gate0 → approved
      </span>
      <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 45, textAlign: 'right' }}>3.1s</span>
    </div>
  );
}

/* ─── Agent row (new flex layout) ─────────────────────────────────────────── */
function AgentRow({ type, job, onRetry, workspaceId, briefId }: {
  type: JobType;
  job: Job | undefined;
  onRetry: (jobId: string) => void;
  workspaceId: string;
  briefId: string | null;
}) {
  const status = job?.status ?? 'pending';
  const displayStatus: JobStatus | 'queued' = status === 'pending' ? 'queued' : status;
  const { bg, color } = iconColors(displayStatus);

  const elapsed = useMemo(() => {
    if (!job?.started_at) return '—';
    const end = job.completed_at ? new Date(job.completed_at) : new Date();
    const ms = end.getTime() - new Date(job.started_at).getTime();
    return `${(ms / 1000).toFixed(1)}s`;
  }, [job]);

  const noteKey = status === 'complete' ? 'complete' : status === 'running' ? 'running' : 'queued';
  const note = job?.error
    ? `${job.error.kind}: ${job.error.message}`
    : (NOTES[type]?.[noteKey as JobStatus | 'queued'] ?? '—');

  const tabSlug = BRIEF_TAB[type];
  const viewHref = briefId && tabSlug && status === 'complete'
    ? `/workspaces/${workspaceId}/briefs/${briefId}?tab=${tabSlug}`
    : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px', fontSize: 12,
      borderTop: '1px solid var(--border)',
      opacity: status === 'pending' ? 0.55 : 1,
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
        background: bg, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <StatusIcon status={displayStatus} />
      </span>
      <span style={{ fontWeight: 500, color: 'var(--text)', minWidth: 140 }}>{LABELS[type]}</span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 500,
        background: bg, color,
        fontFamily: 'var(--font-mono, monospace)',
        flexShrink: 0,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 3, background: 'currentColor', display: 'inline-block' }} />
        {displayStatus === 'queued' ? 'queued' : status}
      </span>
      <span className="mono" style={{
        flex: 1, fontSize: 11,
        color: job?.error ? 'var(--err)' : 'var(--text-mut)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {note}
      </span>
      <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 45, textAlign: 'right' }}>
        {elapsed}
      </span>
      <div style={{ width: 50, display: 'flex', justifyContent: 'flex-end' }}>
        {viewHref ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Link href={viewHref as any} style={{
            fontSize: 11, padding: '3px 9px', borderRadius: 4,
            border: '1px solid var(--accent)', background: 'var(--accent-dim, rgba(99,102,241,0.14))',
            color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            View →
          </Link>
        ) : (
          status === 'failed' && job?.error?.retryable && (
            <button
              style={{
                fontSize: 11, color: 'var(--accent)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
              }}
              onClick={() => onRetry(job!.id)}
            >
              Retry
            </button>
          )
        )}
      </div>
    </div>
  );
}

/* ─── Synthesis row ────────────────────────────────────────────────────────── */
function SynthesisRow({ sprintStatus, briefId, workspaceId }: {
  sprintStatus: JobStatus;
  briefId: string | null;
  workspaceId: string;
}) {
  const isDone = sprintStatus === 'awaiting_gate1' || sprintStatus === 'complete';
  const isRunning = !isDone && sprintStatus === 'running';
  const synthesisStatus: JobStatus | 'queued' = isDone ? 'complete' : isRunning ? 'running' : 'queued';

  const { bg, color } = iconColors(synthesisStatus);
  const note = NOTES.synthesis?.[synthesisStatus] ?? '—';
  const viewHref = isDone && briefId ? `/workspaces/${workspaceId}/briefs/${briefId}` : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px', fontSize: 12,
      borderTop: '1px solid var(--border)',
      opacity: synthesisStatus === 'queued' ? 0.4 : 1,
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
        background: bg, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <StatusIcon status={synthesisStatus} />
      </span>
      <span style={{ fontWeight: 500, color: 'var(--text)', minWidth: 140 }}>Synthesis</span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 500,
        background: bg, color,
        fontFamily: 'var(--font-mono, monospace)',
        flexShrink: 0,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 3, background: 'currentColor', display: 'inline-block' }} />
        {synthesisStatus}
      </span>
      <span className="mono" style={{
        flex: 1, fontSize: 11, color: 'var(--text-mut)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {note}
      </span>
      <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', minWidth: 45, textAlign: 'right' }}>—</span>
      <div style={{ width: 50, display: 'flex', justifyContent: 'flex-end' }}>
        {viewHref && (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Link href={viewHref as any} style={{
            fontSize: 11, padding: '3px 9px', borderRadius: 4,
            border: '1px solid var(--accent)', background: 'var(--accent-dim, rgba(99,102,241,0.14))',
            color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            View →
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─── Log stream ───────────────────────────────────────────────────────────── */
function levelColor(status: string): string {
  if (status === 'complete' || status === 'ok') return 'var(--ok)';
  if (status === 'running' || status === 'info') return 'var(--running)';
  if (status === 'failed' || status === 'error') return 'var(--err)';
  return 'var(--text-dim)';
}

function LogStream({ events, isRunning }: { events: AgentStatusEvent[]; isRunning: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  if (!events.length) return null;

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--bg)',
      padding: '6px 0',
      maxHeight: 140,
      overflowY: 'auto',
    }}>
      {events.map((e, i) => {
        const isLast = i === events.length - 1;
        const elapsed = e.at ? `${Math.floor((new Date(e.at).getTime() - new Date(events[0].at).getTime()) / 1000)}s` : '?s';
        const level = e.status === 'complete' ? 'ok' : e.status === 'running' ? 'info' : e.status === 'failed' ? 'error' : e.status;
        return (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '28px 44px 90px 1fr',
            gap: 8,
            padding: '3px 14px',
            fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
            borderTop: i > 0 ? '1px solid var(--bg-hover)' : undefined,
          }}>
            <span style={{ color: 'var(--text-dim)' }}>{elapsed}</span>
            <span style={{ color: levelColor(level) }}>{level}</span>
            <span style={{ color: 'var(--text-dim)' }}>{e.type}</span>
            <span style={{ color: isLast && isRunning ? 'var(--text)' : 'var(--text-mut)' }}>
              {e.type} → {e.status}
              {isLast && isRunning && (
                <span style={{
                  display: 'inline-block', width: 6, height: '0.9em',
                  background: 'var(--accent)', marginLeft: 2, verticalAlign: 'text-bottom',
                }} className="prism-pulse" />
              )}
            </span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

/* ─── Job board ────────────────────────────────────────────────────────────── */
export function JobBoard({
  initialJobs,
  events,
  workspaceId,
  briefId,
  sprintStatus,
  sprintStartedAt,
  onRetry,
}: {
  initialJobs: Job[];
  events: AgentStatusEvent[];
  workspaceId: string;
  briefId: string | null;
  sprintStatus?: JobStatus;
  sprintStartedAt?: string | null;
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

  const isRunning = sprintStatus === 'running';

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 8,
      background: 'var(--bg-card)', overflow: 'hidden',
    }}>
      {sprintStatus && (
        <SprintHeader sprintStatus={sprintStatus} startedAt={sprintStartedAt ?? null} />
      )}

      {/* Orchestrator row */}
      <OrchestratorRow />

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '0 14px' }} />

      {/* Research agent rows */}
      {LANES.map((type) => (
        <AgentRow
          key={type}
          type={type}
          job={latestByType.get(type)}
          onRetry={onRetry}
          workspaceId={workspaceId}
          briefId={briefId}
        />
      ))}

      {/* Divider before synthesis */}
      <div style={{ height: 1, background: 'var(--border)', margin: '0 14px' }} />

      {/* Synthesis row */}
      <SynthesisRow
        sprintStatus={sprintStatus ?? 'pending'}
        briefId={briefId}
        workspaceId={workspaceId}
      />

      {/* Log stream */}
      <LogStream events={events} isRunning={isRunning} />
    </div>
  );
}
```

- [ ] **Step 4: Update conversation-thread.tsx to pass new props**

In `apps/web/components/conversation-thread.tsx`, find the `<JobBoard>` call (around line 223) and update it:

```tsx
// Replace the JobBoard call inside the 'jobs' block:
const sprintStartedAt = item.children
  .map(c => c.started_at)
  .filter(Boolean)
  .sort()[0] ?? null;

return (
  <div key={`jobs-${item.sprint_job_id}`}>
    <JobBoard
      initialJobs={item.children}
      events={isActive ? events : []}
      workspaceId={workspaceId}
      briefId={briefItem?.brief_id ?? null}
      sprintStatus={item.sprint_status}
      sprintStartedAt={sprintStartedAt}
      onRetry={() => onRefetch()}
    />
  </div>
);
```

Also remove the wrapper `<div>` with the sprint label and running dot that was around `JobBoard` (lines ~203–231 of the original) since the sprint header is now inside `JobBoard` itself.

- [ ] **Step 5: Run tests**

```bash
cd apps/web && pnpm test -- --run tests/job-board.test.tsx
```

Expected: all 6 tests pass.

- [ ] **Step 6: TypeScript check**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/job-board.tsx apps/web/components/conversation-thread.tsx apps/web/tests/job-board.test.tsx
git commit -m "feat(web): job board — sprint header, orchestrator row, new agent row layout, synthesis row, log stream"
```

---

## Task 3: StrategyBriefCard — accent border + 6-stat grid

**Files:**
- Modify: `apps/web/components/conversation-thread.tsx`

The `StrategyBriefCard` is a local component inside `conversation-thread.tsx`. Update it in place.

- [ ] **Step 1: Replace StrategyBriefCard and StatPill in conversation-thread.tsx**

Find the `StrategyBriefCard` function (starts around line 20) and the `StatPill` function (around line 112). Replace both with:

```tsx
function StrategyBriefCard({
  item,
  workspaceId,
}: {
  item: ThreadBriefItem;
  workspaceId: string;
}) {
  const isDraft = item.brief_status === 'draft';
  const clusterCount = item.clusters.length;
  const recCount = item.executive_summary.length;
  const topRec = item.executive_summary[0];

  const stats: Array<{ label: string; value: number | string }> = [
    { label: 'clusters', value: clusterCount },
    { label: 'content pieces', value: recCount },
    { label: 'keyword gaps', value: '—' },
    { label: 'LLM mentions', value: '—' },
    { label: 'est. traffic/mo', value: '—' },
    { label: 'timeline', value: '—' },
  ];

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {/* Avatar */}
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 2,
        background: 'var(--accent-dim, rgba(99,102,241,0.12))',
        color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={10} height={10} viewBox="0 0 16 16" fill="none">
          <path d="M8 2L14 14H2L8 2Z" fill="currentColor" opacity="0.8"/>
        </svg>
      </div>

      {/* Card */}
      <div style={{
        flex: 1,
        border: `1px solid var(--accent)`,
        borderRadius: '2px 10px 10px 10px',
        background: 'var(--bg-card)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              Strategy Brief ready
            </span>
            <span style={{
              fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 3,
              background: isDraft ? 'var(--accent-dim, rgba(99,102,241,0.14))' : 'var(--ok-dim)',
              color: isDraft ? 'var(--accent)' : 'var(--ok)',
              fontFamily: 'var(--font-mono, monospace)',
            }}>
              {isDraft ? 'Gate-1 · awaiting review' : 'approved'}
            </span>
          </div>
          {topRec && (
            <div style={{ fontSize: 12, color: 'var(--text-mut)', lineHeight: 1.6 }}>
              {topRec.rationale}
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, padding: '12px 16px',
          background: 'var(--bg-elev)',
          borderBottom: '1px solid var(--border)',
        }}>
          {stats.map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.3px' }}>
                {value}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
          <Link
            href={`/workspaces/${workspaceId}/briefs/${item.brief_id}`}
            style={{
              flex: 1, padding: '8px 14px', borderRadius: 6, textAlign: 'center',
              background: 'var(--accent)', color: '#fff',
              fontSize: 12, fontWeight: 500, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            ✦ {isDraft ? 'Review Strategy Brief' : 'View Strategy Brief'} →
          </Link>
          {item.share_token && (
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_token}`)}
              style={{
                padding: '8px 12px', borderRadius: 6,
                background: 'transparent', color: 'var(--text-mut)',
                border: '1px solid var(--border)', cursor: 'pointer',
                fontSize: 12, fontWeight: 500,
              }}
            >
              Share link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

Remove the old `StatPill` function entirely (it's no longer used).

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/conversation-thread.tsx
git commit -m "feat(web): StrategyBriefCard — accent border, chat-bubble radius, 6-stat grid"
```

---

## Task 4: Brief page header — stat strip + Gate badge + tab icons

**Files:**
- Modify: `apps/web/app/(app)/workspaces/[id]/briefs/[briefId]/page.tsx`

- [ ] **Step 1: Add a `BriefStatStrip` component and update TABS with icons**

At the top of `page.tsx`, after the imports, replace the `TABS` constant with:

```tsx
const TABS = [
  { slug: 'summary',    label: 'Summary',       icon: '✦' },
  { slug: 'keywords',   label: 'Keywords',      icon: '⊞' },
  { slug: 'clusters',   label: 'Clusters',      icon: '⊟' },
  { slug: 'competitor', label: 'Competitor Gap', icon: '⑂' },
  { slug: 'llm',        label: 'LLM Visibility', icon: '◉' },
  { slug: 'action',     label: 'Action Plan',   icon: '⚡' },
] as const;
type TabSlug = typeof TABS[number]['slug'];
```

Add this component above `SummaryTab`:

```tsx
function BriefStatStrip({ brief }: { brief: FullBrief }) {
  const stats = [
    { label: 'KEYWORDS',   value: brief.keyword_result?.keywords.length ?? '—' },
    { label: 'CLUSTERS',   value: brief.clusters.length },
    { label: 'GAP TERMS',  value: brief.competitor_result?.gap_keywords.length ?? '—' },
    { label: 'CONTENT',    value: brief.executive_summary.length },
    { label: 'LLM MENTIONS', value: brief.llm_visibility_result?.mention_count ?? '—' },
    { label: 'TRAFFIC EST', value: brief.competitor_result?.competitors[0]?.estimated_traffic
        ? `${Math.round(brief.competitor_result.competitors[0].estimated_traffic / 1000)}k`
        : '—' },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
      gap: 0, borderBottom: '1px solid var(--border)',
      background: 'var(--bg-elev)',
    }}>
      {stats.map(({ label, value }, i) => (
        <div key={label} style={{
          padding: '10px 16px',
          borderLeft: i > 0 ? '1px solid var(--border)' : undefined,
        }}>
          <div className="mono" style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>
            {label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.3px' }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Insert stat strip and Gate badge into the page's JSX**

In the `BriefPage` return, add the stat strip after the header div and before the tabs. Also add the Gate badge next to the `<h1>`:

```tsx
{/* Replace the existing h1 inside the header div */}
<div style={{ flex: 1 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <h1 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
      Strategy Brief
    </h1>
    <span style={{
      fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 3,
      background: 'var(--accent-dim, rgba(99,102,241,0.14))',
      color: 'var(--accent)',
      fontFamily: 'var(--font-mono, monospace)',
    }}>
      Gate-1
    </span>
  </div>
  <p className="mono" style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-dim)' }}>
    {new Date(brief.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
  </p>
</div>
```

Add `<BriefStatStrip brief={brief} />` between the header `</div>` and the tabs `<div>`.

- [ ] **Step 3: Update tab rendering to include icons**

In the tabs `<div>`, update the button to include the icon:

```tsx
{TABS.map(({ slug, label, icon }) => (
  <button
    key={slug}
    onClick={() => handleTabClick(slug)}
    style={{
      padding: '10px 14px', fontSize: 12, fontWeight: 500,
      background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
      color: activeTab === slug ? 'var(--text)' : 'var(--text-dim)',
      borderBottom: activeTab === slug ? '2px solid var(--accent)' : '2px solid transparent',
      marginBottom: -1,
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}
  >
    <span style={{ fontSize: 10, opacity: 0.7 }}>{icon}</span>
    {label}
  </button>
))}
```

- [ ] **Step 4: TypeScript check**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/workspaces/\[id\]/briefs/\[briefId\]/page.tsx
git commit -m "feat(web): brief page header — stat strip, Gate-1 badge, tab icons"
```

---

## Task 5: Brief page — Summary tab rebuild

**Files:**
- Modify: `apps/web/app/(app)/workspaces/[id]/briefs/[briefId]/page.tsx`

- [ ] **Step 1: Replace `SummaryTab` with the new three-panel layout**

Find and replace the entire `SummaryTab` function:

```tsx
function SummaryTab({ brief }: { brief: FullBrief }) {
  if (!brief.executive_summary.length) return <Empty label="No recommendations yet." />;

  const topRec = brief.executive_summary[0];
  const insightCards = brief.executive_summary.slice(0, 4);
  const sorted = [...brief.executive_summary].sort((a, b) => a.priority - b.priority);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* AI synthesis box */}
      <div style={{
        border: '1px solid var(--accent)',
        borderRadius: 8, padding: '14px 16px',
        background: 'var(--bg-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            width: 20, height: 20, borderRadius: 4,
            background: 'var(--accent-dim, rgba(99,102,241,0.14))',
            color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9,
          }}>▲</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Claude synthesis
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
          {topRec.rationale}
        </p>
      </div>

      {/* 2×2 insight cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {insightCards.map((rec: Recommendation, i: number) => (
          <div key={i} style={{
            border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--bg-card)', padding: '14px 16px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              {rec.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-mut)', lineHeight: 1.5, marginBottom: 8 }}>
              {rec.rationale}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: 'var(--ok)', fontWeight: 500,
              padding: '2px 8px', borderRadius: 3, background: 'var(--ok-dim)',
            }}>
              {rec.estimated_impact}
            </div>
          </div>
        ))}
      </div>

      {/* Priority table */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, fontWeight: 500 }}>
          All recommendations
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['#', 'Title', 'Rationale', 'Impact'].map((h) => (
                  <th key={h} style={{
                    padding: '7px 10px', textAlign: h === '#' || h === 'Impact' ? 'center' : 'left',
                    fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase',
                    letterSpacing: 0.8, fontWeight: 500,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((rec: Recommendation, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', textAlign: 'center', width: 32 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 5, display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: 'var(--accent-dim, rgba(99,102,241,0.12))',
                      color: 'var(--accent)', fontSize: 11, fontWeight: 700,
                    }}>
                      {rec.priority}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--text)' }}>{rec.title}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-mut)', maxWidth: 320, lineHeight: 1.4 }}>{rec.rationale}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 20,
                      background: 'var(--ok-dim)', color: 'var(--ok)', fontWeight: 500,
                    }}>
                      {rec.estimated_impact}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/workspaces/\[id\]/briefs/\[briefId\]/page.tsx
git commit -m "feat(web): brief summary tab — AI synthesis box, insight cards grid, priority table"
```

---

## Task 6: Brief page — Keywords tab rebuild

**Files:**
- Modify: `apps/web/app/(app)/workspaces/[id]/briefs/[briefId]/page.tsx`

- [ ] **Step 1: Add `KeywordStatStrip` and `Sparkline` helper components, replace `KeywordsTab`**

Add these two helpers immediately before `KeywordsTab`:

```tsx
function Sparkline({ trend }: { trend?: number[] }) {
  if (!trend?.length) return <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>—</span>;
  const max = Math.max(...trend, 1);
  const W = 40, H = 14;
  const pts = trend.map((v, i) => {
    const x = (i / (trend.length - 1)) * W;
    const y = H - (v / max) * H;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke="var(--running)" strokeWidth="1.2" />
    </svg>
  );
}

function KdBar({ kd }: { kd: number | null }) {
  if (kd == null) return <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>—</span>;
  const color = kd < 30 ? 'var(--ok)' : kd < 55 ? '#d97706' : 'var(--err)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
        <div style={{ width: `${kd}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 500, fontFamily: 'var(--font-mono, monospace)' }}>{kd}</span>
    </div>
  );
}
```

Then replace the full `KeywordsTab` function:

```tsx
type SortField = 'priority_score' | 'volume' | 'difficulty';
type IntentFilter = 'All' | 'TOF' | 'MOF' | 'BOF';

function KeywordsTab({ brief }: { brief: FullBrief }) {
  const kw = brief.keyword_result;
  const [search, setSearch] = useState('');
  const [intent, setIntent] = useState<IntentFilter>('All');
  const [sort, setSort] = useState<{ field: SortField; dir: 'asc' | 'desc' }>({ field: 'priority_score', dir: 'desc' });
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!kw?.keywords?.length) return <Empty label="Keyword data not available." />;

  const allKws = kw.keywords;
  const avgKd = allKws.reduce((s, k) => s + (k.difficulty ?? 0), 0) / allKws.length;
  const totalVol = allKws.reduce((s, k) => s + (k.volume ?? 0), 0);
  const priorityPool = allKws.filter(k => k.priority_score >= 70).length;

  const filtered = allKws
    .filter(k => search === '' || k.term.toLowerCase().includes(search.toLowerCase()))
    .filter(k => intent === 'All' || k.intent === intent)
    .sort((a, b) => {
      const mul = sort.dir === 'desc' ? -1 : 1;
      const va = sort.field === 'volume' ? (a.volume ?? 0)
               : sort.field === 'difficulty' ? (a.difficulty ?? 0)
               : a.priority_score;
      const vb = sort.field === 'volume' ? (b.volume ?? 0)
               : sort.field === 'difficulty' ? (b.difficulty ?? 0)
               : b.priority_score;
      return (va - vb) * mul;
    });

  function toggleSort(field: SortField) {
    setSort(prev => prev.field === field
      ? { field, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { field, dir: 'desc' });
  }

  const intentColors: Record<string, { bg: string; color: string }> = {
    TOF: { bg: 'rgba(91,141,255,0.12)', color: '#5b8dff' },
    MOF: { bg: 'rgba(245,165,36,0.12)', color: '#d97706' },
    BOF: { bg: 'rgba(62,207,142,0.12)', color: 'var(--ok)' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'Total keywords', value: allKws.length.toLocaleString() },
          { label: 'Avg difficulty', value: avgKd.toFixed(0), bar: avgKd },
          { label: 'Total volume', value: `${Math.round(totalVol / 1000)}k` },
          { label: 'Priority pool', value: priorityPool.toString(), accent: true },
        ].map(({ label, value, bar, accent }) => (
          <div key={label} style={{
            border: '1px solid var(--border)', borderRadius: 7,
            background: 'var(--bg-card)', padding: '10px 12px',
          }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text)', marginBottom: 2 }}>
              {value}
            </div>
            {bar != null && (
              <div style={{ width: '100%', height: 3, borderRadius: 2, background: 'var(--bg-hover)', marginBottom: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(bar, 100)}%`, height: '100%', background: bar < 30 ? 'var(--ok)' : bar < 55 ? '#d97706' : 'var(--err)' }} />
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search keywords…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '7px 10px', borderRadius: 6, fontSize: 12,
            border: '1px solid var(--border)', background: 'var(--bg-card)',
            color: 'var(--text)', outline: 'none',
          }}
        />
        {(['All', 'TOF', 'MOF', 'BOF'] as IntentFilter[]).map(f => (
          <button key={f} onClick={() => setIntent(f)} style={{
            padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
            border: 'none', cursor: 'pointer',
            background: intent === f ? 'var(--accent)' : 'var(--bg-hover)',
            color: intent === f ? '#fff' : 'var(--text-dim)',
          }}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 500 }}>
                Keyword
              </th>
              {([['Volume', 'volume'], ['KD', 'difficulty'], ['CPC', null], ['Intent', null], ['Trend', null], ['Competitor', null], ['Score', 'priority_score']] as Array<[string, SortField | null]>).map(([h, sf]) => (
                <th key={h}
                  onClick={sf ? () => toggleSort(sf) : undefined}
                  style={{
                    padding: '7px 10px', textAlign: 'right',
                    fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase',
                    letterSpacing: 0.8, fontWeight: 500,
                    cursor: sf ? 'pointer' : undefined,
                    userSelect: 'none',
                  }}
                >
                  {h}{sf && sort.field === sf ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row: KeywordRow, i: number) => {
              const ic = row.intent ? intentColors[row.intent] : null;
              const isExp = expanded === row.term;
              return (
                <>
                  <tr
                    key={row.term}
                    onClick={() => setExpanded(isExp ? null : row.term)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isExp ? 'var(--bg-hover)' : i % 2 === 0 ? 'transparent' : 'var(--bg-hover)',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '8px 10px', color: 'var(--text)' }}>{row.term}</td>
                    <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-mut)' }}>
                      {row.volume?.toLocaleString() ?? '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <KdBar kd={row.difficulty} />
                    </td>
                    <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-mut)' }}>
                      {row.cpc != null ? `$${row.cpc.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {ic ? (
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 3, fontWeight: 500,
                          background: ic.bg, color: ic.color,
                          fontFamily: 'var(--font-mono, monospace)',
                        }}>
                          {row.intent}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <Sparkline trend={row.trend} />
                    </td>
                    <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-dim)', fontSize: 11 }}>
                      {row.top_competitor ?? '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${row.priority_score}%`, height: '100%',
                            background: row.priority_score >= 70 ? 'var(--ok)' : row.priority_score >= 50 ? '#d97706' : 'var(--text-dim)',
                            borderRadius: 2,
                          }} />
                        </div>
                        <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', minWidth: 28 }}>
                          {row.priority_score.toFixed(0)}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {isExp && (
                    <tr key={`${row.term}-exp`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={8} style={{ padding: '10px 14px', background: 'var(--bg-elev)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>URL slug</div>
                            <div className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>/{row.term.toLowerCase().replace(/\s+/g, '-')}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Intent</div>
                            <div style={{ fontSize: 11, color: 'var(--text)' }}>{row.intent ?? 'Unknown'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Content type</div>
                            <div style={{ fontSize: 11, color: 'var(--text)' }}>
                              {row.intent === 'BOF' ? 'Landing page' : row.intent === 'MOF' ? 'Comparison guide' : 'Informational article'}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/workspaces/\[id\]/briefs/\[briefId\]/page.tsx
git commit -m "feat(web): keywords tab — stat strip, filter bar, KD bars, intent pills, sparklines, expandable rows"
```

---

## Task 7: Brief page — Clusters tab polish

**Files:**
- Modify: `apps/web/app/(app)/workspaces/[id]/briefs/[briefId]/page.tsx`

- [ ] **Step 1: Replace `ClustersTab`**

```tsx
function ClustersTab({ brief }: { brief: FullBrief }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (!brief.clusters.length) return <Empty label="No content clusters generated yet." />;

  const priorityBorderColor = (p: number) =>
    p === 0 ? 'var(--ok)' : p === 1 ? '#d97706' : 'var(--running)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {brief.clusters.map((cluster: ContentCluster, i: number) => {
        const isExp = expanded === i;
        return (
          <div
            key={i}
            onClick={() => setExpanded(isExp ? null : i)}
            style={{
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--bg-card)',
              borderLeft: `3px solid ${priorityBorderColor(cluster.priority)}`,
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            {/* Collapsed row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px',
            }}>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
                background: 'var(--accent-dim, rgba(99,102,241,0.12))',
                color: 'var(--accent)', fontWeight: 600,
              }}>
                P{cluster.priority}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                {cluster.name}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {cluster.target_keywords.length} kws
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {cluster.spoke_pages.length + 1} pages
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', transform: isExp ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s', marginLeft: 4 }}>›</span>
            </div>

            {/* Expanded content */}
            {isExp && (
              <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                {/* Hub page */}
                <div style={{
                  borderLeft: '3px solid var(--accent)',
                  padding: '8px 12px', marginTop: 12, marginBottom: 8,
                  background: 'var(--accent-dim, rgba(99,102,241,0.06))',
                  borderRadius: '0 6px 6px 0',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>Hub page</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{cluster.hub_page}</div>
                </div>
                {/* Spoke pages */}
                {cluster.spoke_pages.length > 0 && (
                  <div style={{ paddingLeft: 16 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Spoke pages</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {cluster.spoke_pages.map((p, j) => (
                        <div key={j} className="mono" style={{
                          fontSize: 11, padding: '4px 8px', borderRadius: 4,
                          background: 'var(--bg-hover)', color: 'var(--text-mut)',
                        }}>
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Target keywords */}
                {cluster.target_keywords.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                      Target keywords
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {cluster.target_keywords.map((kw, j) => (
                        <span key={j} style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 4,
                          border: '1px solid var(--border)', color: 'var(--text-mut)',
                        }}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check and commit**

```bash
cd apps/web && pnpm tsc --noEmit
git add apps/web/app/\(app\)/workspaces/\[id\]/briefs/\[briefId\]/page.tsx
git commit -m "feat(web): clusters tab — expandable rows, priority-colored left border"
```

---

## Task 8: Brief page — LLM Visibility tab restructure

**Files:**
- Modify: `apps/web/app/(app)/workspaces/[id]/briefs/[briefId]/page.tsx`

- [ ] **Step 1: Replace `LLMTab`**

```tsx
function LLMTab({ brief }: { brief: FullBrief }) {
  const llm = brief.llm_visibility_result;
  if (!llm) return <Empty label="LLM visibility data not available." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Per-LLM breakdown cards (if available) */}
      {llm.llm_breakdown ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {llm.llm_breakdown.map((item) => (
            <div key={item.name} style={{
              border: '1px solid var(--border)', borderRadius: 7,
              background: 'var(--bg-card)', padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.name}</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.4px' }}>
                  {(item.citation_rate * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden', marginBottom: 6 }}>
                <div style={{
                  width: `${item.citation_rate * 100}%`, height: '100%',
                  background: item.citation_rate > 0.5 ? 'var(--ok)' : item.citation_rate > 0.2 ? '#d97706' : 'var(--running)',
                  borderRadius: 2,
                }} />
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {item.cited}/{item.total} queries cited
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Fallback: original 3-stat view */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <StatCard label="Brand mentioned" value={llm.brand_mentioned ? 'Yes' : 'No'} highlight={llm.brand_mentioned} />
          <StatCard label="Mention count" value={String(llm.mention_count)} />
          <StatCard label="Queries tested" value={String(llm.queries_tested.length)} />
        </div>
      )}

      {/* GEO recommendations table (if available) */}
      {llm.geo_recommendations && llm.geo_recommendations.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, fontWeight: 500 }}>
            GEO action items
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Action', 'Impact', 'Effort'].map(h => (
                  <th key={h} style={{
                    padding: '7px 10px', textAlign: h === 'Action' ? 'left' : 'center',
                    fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase',
                    letterSpacing: 0.8, fontWeight: 500,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {llm.geo_recommendations.map((rec, i) => {
                const effortColor = rec.effort === 'Low' ? 'var(--ok)' : rec.effort === 'Med' ? '#d97706' : 'var(--err)';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', color: 'var(--text)' }}>{rec.action}</td>
                    <td className="mono" style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--accent)', fontWeight: 600 }}>
                      +{rec.impact_pct}%
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 3, fontWeight: 500,
                        background: `${effortColor}22`, color: effortColor,
                      }}>
                        {rec.effort}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Competitor mentions (keep existing) */}
      {Object.keys(llm.competitor_mentions).length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, fontWeight: 500 }}>
            Competitor citation rates
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(llm.competitor_mentions).sort(([,a], [,b]) => (b as number) - (a as number)).map(([domain, count]) => (
              <div key={domain} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', borderRadius: 5, background: 'var(--bg-hover)',
              }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text)', flex: 1 }}>{domain}</span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-mut)' }}>{count as number}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queries tested */}
      {llm.queries_tested.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, fontWeight: 500 }}>
            Queries tested
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {llm.queries_tested.map((q, i) => (
              <div key={i} style={{
                fontSize: 12, color: 'var(--text-mut)', padding: '5px 8px',
                borderLeft: '2px solid var(--border)',
              }}>
                {q}
              </div>
            ))}
          </div>
        </div>
      )}

      {llm.note && (
        <div style={{
          fontSize: 12, color: 'var(--text-mut)', padding: '10px 12px',
          background: 'var(--bg-hover)', borderRadius: 6, lineHeight: 1.5,
        }}>
          {llm.note}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check and commit**

```bash
cd apps/web && pnpm tsc --noEmit
git add apps/web/app/\(app\)/workspaces/\[id\]/briefs/\[briefId\]/page.tsx
git commit -m "feat(web): LLM tab — per-LLM breakdown cards, GEO actions table, fallback to original view"
```

---

## Task 9: Brief page — Action Plan tab rebuild

**Files:**
- Modify: `apps/web/app/(app)/workspaces/[id]/briefs/[briefId]/page.tsx`

- [ ] **Step 1: Replace `ActionPlanTab`**

```tsx
function ActionPlanTab({ brief }: { brief: FullBrief }) {
  if (!brief.executive_summary.length) return <Empty label="No action items generated yet." />;

  const actionTypeColor = (t?: string) => {
    if (t === 'Create')  return { bg: 'var(--accent-dim, rgba(99,102,241,0.12))', color: 'var(--accent)' };
    if (t === 'Fix')     return { bg: 'rgba(245,165,36,0.12)', color: '#d97706' };
    if (t === 'Publish') return { bg: 'var(--ok-dim)', color: 'var(--ok)' };
    if (t === 'Monitor') return { bg: 'var(--running-dim)', color: 'var(--running)' };
    return null;
  };

  const phaseLabel: Record<string, string> = {
    bofu: 'Month 1–2 · BOFU quick wins',
    mofu: 'Month 3–4 · MOFU scale',
    tofu: 'Month 5–8 · TOFU authority',
  };

  // If any item has a phase, group by phase; otherwise flat sorted list
  const hasPhases = brief.executive_summary.some(r => r.phase);
  const phases: Array<[string, Recommendation[]]> = hasPhases
    ? (['bofu', 'mofu', 'tofu'] as const).map(p => [
        p,
        brief.executive_summary.filter(r => r.phase === p).sort((a, b) => a.priority - b.priority),
      ]).filter(([, items]) => (items as Recommendation[]).length > 0) as Array<[string, Recommendation[]]>
    : [['all', [...brief.executive_summary].sort((a, b) => a.priority - b.priority)]];

  function PhaseSection({ phaseKey, items }: { phaseKey: string; items: Recommendation[] }) {
    return (
      <div>
        {hasPhases && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            {phaseLabel[phaseKey] ?? phaseKey}
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Type', 'Title', 'Cluster', 'Vol/mo', 'KD'].map((h, i) => (
                <th key={h} style={{
                  padding: '7px 10px',
                  textAlign: i >= 3 ? 'right' : i === 0 ? 'center' : 'left',
                  fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase',
                  letterSpacing: 0.8, fontWeight: 500,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((rec: Recommendation, i: number) => {
              const tc = actionTypeColor(rec.action_type);
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', textAlign: 'center', width: 70 }}>
                    {tc ? (
                      <span style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 3, fontWeight: 500,
                        background: tc.bg, color: tc.color,
                        fontFamily: 'var(--font-mono, monospace)',
                      }}>
                        {rec.action_type}
                      </span>
                    ) : (
                      <span style={{
                        width: 22, height: 22, borderRadius: 5, display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: 'var(--accent-dim, rgba(99,102,241,0.12))',
                        color: 'var(--accent)', fontSize: 11, fontWeight: 700,
                      }}>
                        {rec.priority}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--text)' }}>{rec.title}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-mut)', fontSize: 11 }}>—</td>
                  <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-mut)' }}>—</td>
                  <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-mut)' }}>—</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {phases.map(([key, items]) => (
        <PhaseSection key={key} phaseKey={key} items={items as Recommendation[]} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 3: Run all web tests**

```bash
cd apps/web && pnpm test -- --run
```

Expected: all tests pass (job-board + confirm-card tests).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/workspaces/\[id\]/briefs/\[briefId\]/page.tsx
git commit -m "feat(web): action plan tab — phase grouping, type badges, table columns"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Types: `KeywordRow`, `Recommendation`, `LLMVisibilityResult` optional fields — Task 1
- ✅ Sprint header (status badge, elapsed timer) — Task 2 `SprintHeader`
- ✅ Orchestrator row (always done, static note) — Task 2 `OrchestratorRow`
- ✅ AgentRow new flex layout (icon + label + badge + note + elapsed + view) — Task 2 `AgentRow`
- ✅ Log stream (4-col grid, from events prop, max-height, caret) — Task 2 `LogStream`
- ✅ Synthesis row (queued/running/complete, view button when done) — Task 2 `SynthesisRow`
- ✅ StrategyBriefCard: accent border, chat-bubble radius, title, badge, 6-stat grid, "✦ Review" button — Task 3
- ✅ Brief page stat strip (6 cols) — Task 4
- ✅ Gate-1 badge — Task 4
- ✅ Tab icons — Task 4
- ✅ Summary: AI synthesis box, 2×2 insight cards, priority table — Task 5
- ✅ Keywords: stat strip, filter bar, KD bar, CPC, intent pill, sparkline, competitor, score bar, expandable rows — Task 6
- ✅ Clusters: expandable rows, priority-colored left border — Task 7
- ✅ LLM: per-LLM cards (with fallback), GEO actions table — Task 8
- ✅ Action Plan: phase grouping (with flat fallback), type badges, columns — Task 9

**Type consistency:** All component props match the types defined in Task 1. `KeywordRow.intent`, `KeywordRow.trend`, `KeywordRow.cpc`, `KeywordRow.top_competitor` used as optional in Tasks 6. `Recommendation.phase` and `action_type` used as optional in Task 9. `LLMVisibilityResult.llm_breakdown` and `geo_recommendations` used as optional in Task 8.

**Placeholder check:** No TBDs. Volume/KD/cluster columns in the Action Plan table show "—" (data not in `Recommendation` type — correct per spec). Sparkline handles `undefined trend` gracefully. Stats that require full `FullBrief` data show "—" in the thread card where only `ThreadBriefItem` is available.
