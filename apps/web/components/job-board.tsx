'use client';

import type { AgentStatusEvent, Job, JobStatus, JobType } from '@prism/types';
import { useMemo } from 'react';

const LANES: JobType[] = ['keyword', 'competitor', 'content_audit', 'llm_visibility'];

const LABELS: Record<JobType, string> = {
  orchestrator:   'Orchestrator',
  sprint:         'Sprint',
  keyword:        'Keyword',
  competitor:     'Competitor',
  content_audit:  'Content audit',
  llm_visibility: 'LLM visibility',
  synthesis:      'Synthesis',
};

const PROVIDERS: Partial<Record<JobType, string>> = {
  keyword:        'dataforseo',
  competitor:     'stub',
  content_audit:  'stub',
  llm_visibility: 'stub',
};

/* ─── Status icon ──────────────────────────────────────────────────────────── */
function StatusIcon({ status }: { status: JobStatus }) {
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
  if (status === 'running' || status === 'awaiting_gate0') {
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

function iconColors(status: JobStatus): { bg: string; color: string } {
  if (status === 'complete') return { bg: 'var(--ok-dim)', color: 'var(--ok)' };
  if (status === 'failed')   return { bg: 'var(--err-dim)', color: 'var(--err)' };
  if (status === 'running')  return { bg: 'var(--running-dim)', color: 'var(--running)' };
  if (status === 'awaiting_gate0') return { bg: 'var(--awaiting-dim)', color: 'var(--awaiting)' };
  return { bg: 'var(--bg-hover)', color: 'var(--text-dim)' };
}

/* ─── Progress bar ─────────────────────────────────────────────────────────── */
function ProgressBar({ status }: { status: JobStatus }) {
  if (status === 'complete') {
    return (
      <div style={{ height: 2, borderRadius: 1, background: 'var(--ok)' }} />
    );
  }
  if (status === 'failed') {
    return (
      <div style={{ height: 2, borderRadius: 1, background: 'var(--err)', opacity: 0.6 }} />
    );
  }
  if (status === 'running') {
    return (
      <div style={{ height: 2, borderRadius: 1, background: 'var(--running-dim)', overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '40%', height: '100%',
          background: 'var(--running)',
        }} className="prism-stream" />
      </div>
    );
  }
  return (
    <div style={{ height: 2, borderRadius: 1, background: 'var(--bg-hover)' }} />
  );
}

/* ─── Agent row ────────────────────────────────────────────────────────────── */
function AgentRow({ type, job, onRetry }: {
  type: JobType;
  job: Job | undefined;
  onRetry: (jobId: string) => void;
}) {
  const status = job?.status ?? 'pending';
  const { bg, color } = iconColors(status);

  const elapsed = useMemo(() => {
    if (!job?.started_at) return '—';
    const end = job.completed_at ? new Date(job.completed_at) : new Date();
    const ms = end.getTime() - new Date(job.started_at).getTime();
    return `${(ms / 1000).toFixed(1)}s`;
  }, [job]);

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 6,
      background: 'var(--bg-card)',
      padding: '10px 12px',
      display: 'grid',
      gridTemplateColumns: '140px 1fr 80px 68px',
      gap: 12,
      alignItems: 'center',
      opacity: status === 'pending' ? 0.55 : 1,
    }}>
      {/* Label + status icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          width: 18, height: 18, borderRadius: 4,
          background: bg, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <StatusIcon status={status} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{LABELS[type]}</span>
      </div>

      {/* Note + progress bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        {job?.error ? (
          <div className="mono" style={{ fontSize: 10, color: 'var(--err)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {job.error.kind}: {job.error.message}
          </div>
        ) : (
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-mut)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {status === 'pending' ? 'queued' : status === 'complete' ? 'done' : status === 'running' ? 'running…' : status}
          </div>
        )}
        <ProgressBar status={status} />
        {job?.status === 'failed' && job.error?.retryable && (
          <button
            style={{
              alignSelf: 'flex-start', fontSize: 10, color: 'var(--accent)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
            }}
            onClick={() => onRetry(job.id)}
          >
            Retry
          </button>
        )}
      </div>

      {/* Provider */}
      <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'right' }}>
        {PROVIDERS[type] ?? '—'}
      </div>

      {/* Elapsed */}
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-mut)', textAlign: 'right' }}>
        {elapsed}
      </div>
    </div>
  );
}

/* ─── Section title ────────────────────────────────────────────────────────── */
function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 500 }}>
        {children}
      </div>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      {right}
    </div>
  );
}

/* ─── Job board ────────────────────────────────────────────────────────────── */
export function JobBoard({
  initialJobs,
  events,
  onRetry,
}: {
  initialJobs: Job[];
  events: AgentStatusEvent[];
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <SectionTitle right={
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>SSE · live</span>
      }>
        Pipeline
      </SectionTitle>
      {LANES.map((type) => (
        <AgentRow
          key={type}
          type={type}
          job={latestByType.get(type)}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}
