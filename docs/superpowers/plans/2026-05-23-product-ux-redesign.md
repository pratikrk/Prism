# Product UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the workspace from a single-page thread into a multi-view product — Chat | Dashboard | Sprint | Content | Calendar — with the tab bar as the primary navigation and chat as the universal entry point.

**Architecture:** A new `layout.tsx` at `apps/web/app/(app)/workspaces/[id]/` wraps all workspace pages with a `WorkspaceNav` tab bar. Dashboard and Sprint pages pull data from the existing thread endpoint (no new backend routes). Empty states and chat messaging are updated to match the non-expert positioning.

**Tech Stack:** Next.js 16 App Router, React, SWR, CSS custom properties, `@prism/types` — no new dependencies.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `apps/web/components/workspace-nav.tsx` | Horizontal tab bar for workspace views |
| Create | `apps/web/app/(app)/workspaces/[id]/layout.tsx` | Injects WorkspaceNav above all workspace pages |
| Create | `apps/web/app/(app)/workspaces/[id]/dashboard/page.tsx` | Dashboard view — audit health scores + action items |
| Create | `apps/web/app/(app)/workspaces/[id]/sprint/page.tsx` | Sprint view — active research + action queue |
| Create | `apps/web/app/(app)/workspaces/[id]/content/page.tsx` | Content stub |
| Create | `apps/web/app/(app)/workspaces/[id]/calendar/page.tsx` | Calendar stub |
| Modify | `apps/web/components/conversation-thread.tsx` | Update empty state copy |
| Modify | `apps/web/components/app-chrome.tsx` | Remove workspace-scoped nav items from sidebar |
| Modify | `apps/web/lib/api.ts` | Add `getWorkspace(token, id)` helper |
| Modify | `apps/web/tests/confirm-card.test.tsx` | Ensure existing tests still pass after changes |

---

## Task 1: WorkspaceNav Component

**Files:**
- Create: `apps/web/components/workspace-nav.tsx`
- Test: `apps/web/tests/workspace-nav.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/tests/workspace-nav.test.tsx
import { render, screen } from '@testing-library/react';
import { usePathname, useParams } from 'next/navigation';
import { WorkspaceNav } from '@/components/workspace-nav';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useParams: vi.fn(),
}));

describe('WorkspaceNav', () => {
  beforeEach(() => {
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'ws-1' });
  });

  it('renders all five tabs', () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/workspaces/ws-1');
    render(<WorkspaceNav />);
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Sprint')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
  });

  it('marks Chat as active on workspace root', () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/workspaces/ws-1');
    render(<WorkspaceNav />);
    const chatLink = screen.getByRole('link', { name: 'Chat' });
    expect(chatLink).toHaveAttribute('data-active', 'true');
  });

  it('marks Dashboard as active on dashboard route', () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/workspaces/ws-1/dashboard');
    render(<WorkspaceNav />);
    const dashLink = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashLink).toHaveAttribute('data-active', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm test tests/workspace-nav.test.tsx
```

Expected: FAIL — `WorkspaceNav` not found.

- [ ] **Step 3: Create the WorkspaceNav component**

```tsx
// apps/web/components/workspace-nav.tsx
'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

const TABS = [
  { label: 'Chat',      path: '' },
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Sprint',    path: '/sprint' },
  { label: 'Content',   path: '/content' },
  { label: 'Calendar',  path: '/calendar' },
] as const;

export function WorkspaceNav() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const base = `/workspaces/${id}`;

  return (
    <nav style={{
      display: 'flex',
      gap: '2px',
      padding: '0 24px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
      flexShrink: 0,
    }}>
      {TABS.map(({ label, path }) => {
        const href = `${base}${path}`;
        const active = path === ''
          ? pathname === base || pathname === `${base}/`
          : pathname.startsWith(`${base}${path}`);
        return (
          <Link
            key={label}
            href={href}
            data-active={active}
            style={{
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--text)' : 'var(--text-mut)',
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              textDecoration: 'none',
              transition: 'color 0.1s',
              marginBottom: '-1px',
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test tests/workspace-nav.test.tsx
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/workspace-nav.tsx apps/web/tests/workspace-nav.test.tsx
git commit -m "feat(ui): WorkspaceNav tab bar — Chat, Dashboard, Sprint, Content, Calendar"
```

---

## Task 2: Workspace Layout — Inject Tab Nav

**Files:**
- Create: `apps/web/app/(app)/workspaces/[id]/layout.tsx`

- [ ] **Step 1: Create the workspace layout**

```tsx
// apps/web/app/(app)/workspaces/[id]/layout.tsx
import { WorkspaceNav } from '@/components/workspace-nav';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <WorkspaceNav />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify layout renders correctly**

Start dev server and open any workspace. The tab bar should appear above the chat thread. The chat input should remain pinned at the bottom.

```bash
cd apps/api && uv run uvicorn app.main:app --reload &
pnpm --filter @prism/web dev
```

Open `http://localhost:3000` → sign in → open a workspace → confirm tab bar renders.

- [ ] **Step 3: Verify chat still works end-to-end**

Type a message in the chat input, confirm it dispatches and the thread updates. The tab bar must not shift layout during SSE updates.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/workspaces/\[id\]/layout.tsx
git commit -m "feat(ui): workspace layout.tsx — injects WorkspaceNav above all workspace pages"
```

---

## Task 3: Dashboard Page

**Files:**
- Create: `apps/web/app/(app)/workspaces/[id]/dashboard/page.tsx`
- Test: `apps/web/tests/dashboard-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/tests/dashboard-page.test.tsx
import { render, screen } from '@testing-library/react';
import { useParams } from 'next/navigation';
import DashboardPage from '@/app/(app)/workspaces/[id]/dashboard/page';

vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
}));

vi.mock('swr', () => ({
  default: vi.fn((key: string | null) => {
    if (key?.startsWith('thread:')) {
      return {
        data: [{
          type: 'audit',
          result: {
            domain: 'example.com',
            domain_rating: 42,
            estimated_monthly_traffic: 1200,
            top_keywords: ['seo tool', 'keyword research'],
            score: { technical: 72, content: 58, ai_visibility: 45, overall: 60 },
            action_items: [
              { severity: 'critical', title: 'Missing robots.txt', rationale: 'Blocks crawlers', effort_minutes: 10 },
              { severity: 'high', title: 'No schema markup', rationale: 'Misses rich results', effort_minutes: 30 },
            ],
            scanned_at: '2026-05-23T10:00:00Z',
          },
          created_at: '2026-05-23T10:00:00Z',
        }],
      };
    }
    return { data: [] };
  }),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'ws-1' });
  });

  it('renders overall health score', () => {
    render(<DashboardPage />);
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('renders three pillar scores', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Technical')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('AI Visibility')).toBeInTheDocument();
  });

  it('renders top action items', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Missing robots.txt')).toBeInTheDocument();
    expect(screen.getByText('No schema markup')).toBeInTheDocument();
  });

  it('shows no-audit state when thread has no audit item', async () => {
    const swr = await import('swr');
    (swr.default as ReturnType<typeof vi.fn>).mockReturnValue({ data: [] });
    render(<DashboardPage />);
    expect(screen.getByText(/audit your site/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm test tests/dashboard-page.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the Dashboard page**

```tsx
// apps/web/app/(app)/workspaces/[id]/dashboard/page.tsx
'use client';

import { useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { getThread } from '@/lib/api';
import type { ThreadAuditItem, AuditSeverity } from '@prism/types';

function useToken() {
  const { getToken } = useAuth();
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    getToken().then(setT);
    const id = setInterval(() => getToken().then(setT), 60_000);
    return () => clearInterval(id);
  }, [getToken]);
  return t;
}

const SEVERITY_COLOR: Record<AuditSeverity, string> = {
  critical: 'var(--error, #ef4444)',
  high: 'var(--warn)',
  medium: 'var(--accent)',
  quick_win: 'var(--ok)',
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? 'var(--ok)' : value >= 50 ? 'var(--warn)' : 'var(--error, #ef4444)';
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-mut)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const token = useToken();

  const { data: items = [] } = useSWR(
    token ? `thread:${id}` : null,
    () => getThread(token!, id),
    { refreshInterval: 10_000 },
  );

  const auditItem = items.find((i): i is ThreadAuditItem => i.type === 'audit');
  const audit = auditItem?.result;

  if (!audit) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-mut)' }}>
        <p style={{ fontSize: 15, marginBottom: 8 }}>No audit yet.</p>
        <p style={{ fontSize: 13 }}>
          Go to <strong>Chat</strong> and say "audit my site" to get started.
        </p>
      </div>
    );
  }

  const overallColor = audit.score.overall >= 75 ? 'var(--ok)' : audit.score.overall >= 50 ? 'var(--warn)' : 'var(--error, #ef4444)';
  const topItems = audit.action_items.slice(0, 5);

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Overall score */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ textAlign: 'center', minWidth: 64 }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: overallColor, lineHeight: 1 }}>{audit.score.overall}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>overall</div>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <ScoreBar label="Technical" value={audit.score.technical} />
            <ScoreBar label="Content" value={audit.score.content} />
            <ScoreBar label="AI Visibility" value={audit.score.ai_visibility} />
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Domain Rating', value: audit.domain_rating ?? '—' },
            { label: 'Monthly Traffic', value: audit.estimated_monthly_traffic?.toLocaleString() ?? '—' },
            { label: 'Top Keywords', value: audit.top_keywords.length },
          ].map(({ label, value }) => (
            <div key={label} style={{ flex: 1, minWidth: 140, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-mut)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Action items */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
            Top Issues
          </div>
          {topItems.map((item, i) => (
            <div key={i} style={{ padding: '12px 20px', borderBottom: i < topItems.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: SEVERITY_COLOR[item.severity], background: `${SEVERITY_COLOR[item.severity]}18`, padding: '2px 7px', borderRadius: 4, marginTop: 1, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {item.severity.replace('_', ' ')}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-mut)', marginTop: 2 }}>{item.rationale}</div>
              </div>
              {item.effort_minutes && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>{item.effort_minutes}m</span>
              )}
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
          Scanned {new Date(auditItem.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm test tests/dashboard-page.test.tsx
```

Expected: 4 passed.

- [ ] **Step 5: Verify in browser**

Navigate to a workspace → click Dashboard tab. If an audit exists, confirm scores and action items render. If not, confirm the "audit my site" empty state renders.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(app\)/workspaces/\[id\]/dashboard/page.tsx apps/web/tests/dashboard-page.test.tsx
git commit -m "feat(ui): Dashboard page — audit health scores, stats, top action items"
```

---

## Task 4: Sprint Page

**Files:**
- Create: `apps/web/app/(app)/workspaces/[id]/sprint/page.tsx`
- Test: `apps/web/tests/sprint-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/tests/sprint-page.test.tsx
import { render, screen } from '@testing-library/react';
import { useParams } from 'next/navigation';
import SprintPage from '@/app/(app)/workspaces/[id]/sprint/page';

vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
}));

const mockAuditThread = [{
  type: 'audit',
  result: {
    domain: 'example.com',
    domain_rating: 42,
    estimated_monthly_traffic: 1200,
    top_keywords: ['seo'],
    score: { technical: 72, content: 58, ai_visibility: 45, overall: 60 },
    action_items: [
      { severity: 'critical', title: 'Missing robots.txt', rationale: 'Blocks crawlers', effort_minutes: 10 },
      { severity: 'high', title: 'No schema markup', rationale: 'Misses rich results', effort_minutes: 30 },
      { severity: 'quick_win', title: 'Add meta descriptions', rationale: 'Improves CTR', effort_minutes: 15 },
    ],
    scanned_at: '2026-05-23T10:00:00Z',
  },
  created_at: '2026-05-23T10:00:00Z',
}];

vi.mock('swr', () => ({
  default: vi.fn(() => ({ data: mockAuditThread })),
}));

describe('SprintPage', () => {
  beforeEach(() => {
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'ws-1' });
  });

  it('renders action queue section', () => {
    render(<SprintPage />);
    expect(screen.getByText('Action Queue')).toBeInTheDocument();
  });

  it('renders all audit action items in the queue', () => {
    render(<SprintPage />);
    expect(screen.getByText('Missing robots.txt')).toBeInTheDocument();
    expect(screen.getByText('No schema markup')).toBeInTheDocument();
    expect(screen.getByText('Add meta descriptions')).toBeInTheDocument();
  });

  it('shows empty queue state when no audit', async () => {
    const swr = await import('swr');
    (swr.default as ReturnType<typeof vi.fn>).mockReturnValue({ data: [] });
    render(<SprintPage />);
    expect(screen.getByText(/queue is empty/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm test tests/sprint-page.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the Sprint page**

```tsx
// apps/web/app/(app)/workspaces/[id]/sprint/page.tsx
'use client';

import { useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { getThread } from '@/lib/api';
import type { ThreadAuditItem, ThreadJobsItem, AuditSeverity } from '@prism/types';

function useToken() {
  const { getToken } = useAuth();
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    getToken().then(setT);
    const id = setInterval(() => getToken().then(setT), 60_000);
    return () => clearInterval(id);
  }, [getToken]);
  return t;
}

const SEVERITY_COLOR: Record<AuditSeverity, string> = {
  critical: 'var(--error, #ef4444)',
  high: 'var(--warn)',
  medium: 'var(--accent)',
  quick_win: 'var(--ok)',
};

const SEVERITY_ORDER: AuditSeverity[] = ['critical', 'high', 'medium', 'quick_win'];

export default function SprintPage() {
  const { id } = useParams<{ id: string }>();
  const token = useToken();

  const { data: items = [] } = useSWR(
    token ? `thread:${id}` : null,
    () => getThread(token!, id),
    { refreshInterval: 5_000 },
  );

  const auditItem = items.find((i): i is ThreadAuditItem => i.type === 'audit');
  const activeResearch = items.filter((i): i is ThreadJobsItem =>
    i.type === 'jobs' &&
    i.sprint_status !== 'complete' &&
    i.sprint_status !== 'complete_with_errors' &&
    i.sprint_status !== 'failed',
  );

  const actionItems = auditItem?.result.action_items
    .slice()
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)) ?? [];

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Active research sprints */}
        {activeResearch.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-mut)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Active
            </h2>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px', fontSize: 13, color: 'var(--text-mut)' }}>
              {activeResearch.length} research sprint{activeResearch.length > 1 ? 's' : ''} running — check Chat for live updates.
            </div>
          </section>
        )}

        {/* Action queue */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-mut)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Action Queue
          </h2>

          {actionItems.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '32px 24px', textAlign: 'center', color: 'var(--text-mut)' }}>
              <p style={{ fontSize: 14 }}>Queue is empty.</p>
              <p style={{ fontSize: 12, marginTop: 6 }}>Go to Chat and say "audit my site" — Prism will identify what to fix.</p>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {actionItems.map((item, i) => (
                <div key={i} style={{
                  padding: '14px 20px',
                  borderBottom: i < actionItems.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: SEVERITY_COLOR[item.severity],
                    background: `${SEVERITY_COLOR[item.severity]}18`,
                    padding: '3px 7px',
                    borderRadius: 4,
                    flexShrink: 0,
                    marginTop: 2,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {item.severity.replace('_', ' ')}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-mut)', marginTop: 3 }}>{item.rationale}</div>
                  </div>
                  {item.effort_minutes && (
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0, marginTop: 2 }}>
                      ~{item.effort_minutes}m
                    </span>
                  )}
                  <button
                    disabled
                    title="Fix generation coming in Technical Pillar sub-project"
                    style={{
                      fontSize: 12,
                      padding: '4px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      background: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'not-allowed',
                      flexShrink: 0,
                    }}
                  >
                    Fix →
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Fix generation and 1-click apply will be available in the next update.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm test tests/sprint-page.test.tsx
```

Expected: 3 passed.

- [ ] **Step 5: Verify in browser**

Navigate to Sprint tab. Confirm action items appear sorted by severity (critical first). Confirm "Fix →" button is present but disabled with a tooltip. Confirm active research section only appears when a sprint is running.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(app\)/workspaces/\[id\]/sprint/page.tsx apps/web/tests/sprint-page.test.tsx
git commit -m "feat(ui): Sprint page — action queue from audit + active research sprint status"
```

---

## Task 5: Content and Calendar Stub Pages

**Files:**
- Create: `apps/web/app/(app)/workspaces/[id]/content/page.tsx`
- Create: `apps/web/app/(app)/workspaces/[id]/calendar/page.tsx`

- [ ] **Step 1: Create both stub pages**

```tsx
// apps/web/app/(app)/workspaces/[id]/content/page.tsx
export default function ContentPage() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text-mut)', padding: 24 }}>
      <p style={{ fontSize: 15 }}>Content library</p>
      <p style={{ fontSize: 13 }}>Drafts, published pages, and in-progress pieces will appear here.</p>
      <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Coming in the Content sub-project.</p>
    </div>
  );
}
```

```tsx
// apps/web/app/(app)/workspaces/[id]/calendar/page.tsx
export default function CalendarPage() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text-mut)', padding: 24 }}>
      <p style={{ fontSize: 15 }}>Content calendar</p>
      <p style={{ fontSize: 13 }}>Scheduled posts and publishing dates will appear here.</p>
      <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Coming in the Content sub-project.</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Click Content tab and Calendar tab — confirm stub messages render without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/workspaces/\[id\]/content/page.tsx apps/web/app/\(app\)/workspaces/\[id\]/calendar/page.tsx
git commit -m "feat(ui): Content and Calendar stub pages"
```

---

## Task 6: Update Chat Empty State

**Files:**
- Modify: `apps/web/components/conversation-thread.tsx`

The current empty state says "Describe a traffic goal below. Prism will plan the sprint." This is wrong for non-experts and for the new multi-intent chat.

- [ ] **Step 1: Locate the empty state in conversation-thread.tsx**

Search for the string "Describe a traffic goal":

```bash
grep -n "Describe a traffic goal\|Prism will plan" apps/web/components/conversation-thread.tsx
```

Note the line numbers.

- [ ] **Step 2: Replace the empty state copy**

Find the empty state block (renders when `items.length === 0 && !pendingGoal`) and replace the text content with:

```tsx
{/* Empty state — update the two <p> tags inside this block */}
<p style={{ /* keep existing style */ }}>
  Tell me about your site — I&apos;ll take it from there.
</p>
<p style={{ /* keep existing style */ }}>
  Try: &quot;audit my site&quot;, &quot;why am I not getting traffic?&quot;, or &quot;what should I fix first?&quot;
</p>
```

Keep all existing styling, only replace the text. Do not change any surrounding JSX structure.

- [ ] **Step 3: Verify in browser**

Open a workspace with an empty thread. Confirm new copy renders. Confirm existing thread functionality is unchanged for non-empty threads.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/conversation-thread.tsx
git commit -m "feat(ui): update chat empty state for non-expert positioning"
```

---

## Task 7: Simplify App Chrome Sidebar

**Files:**
- Modify: `apps/web/components/app-chrome.tsx`

The sidebar currently shows workspace-scoped nav items (Runs, Strategy Brief, Keywords, Competitors, etc.). These are now superseded by the tab bar. The sidebar should only show: workspace name/switcher, "New workspace" link, and workers status.

- [ ] **Step 1: Locate workspace-scoped nav items in app-chrome.tsx**

```bash
grep -n "New run\|Runs\|Strategy Brief\|Keywords\|Competitors\|Content audit\|LLM visibility\|History" apps/web/components/app-chrome.tsx
```

Note the line range of the workspace-scoped section.

- [ ] **Step 2: Remove workspace-scoped nav items**

Delete the nav items for: "New run", "Runs", "Strategy Brief", "Keywords", "Competitors", "Content audit", "LLM visibility", "History". Keep:
- Workspace name + color indicator (identifies which workspace you're in)
- "New workspace" link
- Workers status footer

The sidebar should now be a clean workspace switcher, not a nav tree.

- [ ] **Step 3: Verify in browser**

Open app → confirm sidebar shows workspace name and "New workspace" only. Confirm top bar and tab bar are unaffected. Click between workspaces → confirm correct workspace loads.

- [ ] **Step 4: Run all frontend tests**

```bash
cd apps/web && pnpm test
```

Expected: All tests pass. Fix any broken tests caused by removed nav items.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/app-chrome.tsx
git commit -m "refactor(ui): simplify sidebar to workspace switcher — nav now in tab bar"
```

---

## Task 8: End-to-End Smoke Test

- [ ] **Step 1: Start full stack**

```bash
docker compose up -d redis
cd apps/api && uv run uvicorn app.main:app --reload &
cd apps/api && uv run celery -A app.workers.celery_app worker -l info -c 4 &
pnpm --filter @prism/web dev
```

- [ ] **Step 2: Run through the golden path**

1. Sign in → confirm sidebar shows workspace switcher only
2. Open a workspace → confirm tab bar renders (Chat | Dashboard | Sprint | Content | Calendar)
3. Chat tab: confirm new empty state copy
4. Type "audit my site" → confirm audit card appears in thread
5. Click Dashboard tab → confirm health scores render from audit data
6. Click Sprint tab → confirm action items appear sorted by severity
7. Click Content tab → confirm stub message renders
8. Click Calendar tab → confirm stub message renders
9. Return to Chat → type a goal → confirm orchestrator pipeline still works end-to-end
10. Confirm SSE updates still work (job board updates in real time)

- [ ] **Step 3: Run full test suite**

```bash
# Backend
cd apps/api && uv run pytest -v

# Frontend
cd apps/web && pnpm test
```

Expected: All tests pass.

- [ ] **Step 4: Final commit if any cleanup**

```bash
git add -A
git commit -m "chore: product UX redesign smoke test cleanup"
```
