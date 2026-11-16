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
          // @ts-expect-error Next.js Link accepts string in href
          <Link href={viewHref!} style={{
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
          // @ts-expect-error Next.js Link accepts string in href
          <Link href={viewHref!} style={{
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
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
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
      const existing = map.get(j.type);
      if (!existing || Date.parse(j.created_at) >= Date.parse(existing.created_at)) {
        map.set(j.type, j);
      }
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
      {sprintStatus && <div style={{ height: 1, background: 'var(--border)', margin: '0 14px' }} />}

      {/* Synthesis row */}
      {sprintStatus && (
        <SynthesisRow
          sprintStatus={sprintStatus}
          briefId={briefId}
          workspaceId={workspaceId}
        />
      )}

      {/* Log stream */}
      <LogStream events={events} isRunning={isRunning} />
    </div>
  );
}
