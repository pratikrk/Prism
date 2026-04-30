'use client';

import type { AgentStatusEvent, Job, JobStatus, JobType } from '@prism/types';
import { useMemo } from 'react';

const LANES: JobType[] = ['orchestrator', 'keyword', 'competitor', 'content_audit', 'llm_visibility'];

const LABELS: Record<JobType, string> = {
  orchestrator: 'Orchestrator',
  sprint: 'Sprint (aggregate)',
  keyword: 'Keyword',
  competitor: 'Competitor',
  content_audit: 'Content Audit',
  llm_visibility: 'LLM Visibility',
};

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-yellow-500/20 text-yellow-900 dark:text-yellow-200',
  awaiting_gate0: 'bg-blue-500/20 text-blue-900 dark:text-blue-200',
  complete: 'bg-green-500/20 text-green-900 dark:text-green-200',
  complete_with_errors: 'bg-amber-500/20 text-amber-900 dark:text-amber-200',
  failed: 'bg-red-500/20 text-red-900 dark:text-red-200',
};

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
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      {LANES.map((type) => {
        const job = latestByType.get(type);
        const status = job?.status ?? 'pending';
        return (
          <div key={type} className="border rounded p-3 space-y-2">
            <div className="font-medium">{LABELS[type]}</div>
            <span className={`inline-block text-xs px-2 py-1 rounded ${STATUS_COLORS[status]}`}>
              {status}
            </span>
            {job?.error && (
              <div className="text-xs text-red-600 dark:text-red-400 break-words">
                {job.error.kind}: {job.error.message}
              </div>
            )}
            {job?.status === 'failed' && job.error?.retryable && (
              <button
                className="text-xs underline"
                onClick={() => onRetry(job.id)}
              >
                Retry
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
