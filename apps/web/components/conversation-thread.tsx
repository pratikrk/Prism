'use client';

import Link from 'next/link';
import type { ThreadBriefItem, ThreadItem, ThreadJobsItem } from '@prism/types';
import { GoalBubble } from './goal-bubble';
import { PlanCard } from './plan-card';
import { ConfirmCard } from './confirm-card';
import { JobBoard } from './job-board';
import { useJobEvents } from '@/lib/sse';
import { approvePlan, patchPlan, refinePlan } from '@/lib/api';

interface ConversationThreadProps {
  items: ThreadItem[];
  token: string;
  workspaceId: string;
  onRefetch: () => void;
}

/* ─── Strategy Brief Card ──────────────────────────────────────────────────── */
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
        border: '1px solid var(--accent)',
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

/* ─── Conversation thread ──────────────────────────────────────────────────── */
export function ConversationThread({ items, token, workspaceId, onRefetch }: ConversationThreadProps) {
  const activeJobsItem = items.find(
    (i): i is ThreadJobsItem =>
      i.type === 'jobs' &&
      i.sprint_status !== 'complete' &&
      i.sprint_status !== 'complete_with_errors',
  );
  const events = useJobEvents(activeJobsItem?.sprint_job_id ?? null, token);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Submit your first goal below to get started.
      </div>
    );
  }

  async function handleApprove(planId: string) {
    await approvePlan(token, planId);
    onRefetch();
  }

  async function handleRefine(planId: string, feedback: string) {
    await refinePlan(token, planId, feedback);
    onRefetch();
  }

  async function handleEdit(
    planId: string,
    fields: { intent?: string; competitors?: string[]; timeline_weeks?: number },
  ) {
    await patchPlan(token, planId, fields);
    onRefetch();
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4 py-4">
      {items.map((item) => {
        if (item.type === 'goal') {
          return (
            <GoalBubble
              key={`goal-${item.job_id}`}
              goal={item.goal}
              feedback={item.feedback}
              createdAt={item.created_at}
            />
          );
        }

        if (item.type === 'plan') {
          const { plan, job_status } = item;
          return (
            <div key={`plan-${plan.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <PlanCard
                plan={plan}
                jobStatus={job_status}
                onEdit={(fields) => handleEdit(plan.id, fields)}
                onRefine={(fb) => handleRefine(plan.id, fb)}
                onApprove={() => handleApprove(plan.id)}
              />
              {plan.plan_status === 'approved' && <ConfirmCard />}
            </div>
          );
        }

        if (item.type === 'jobs') {
          const briefItem = items.find(
            (i): i is ThreadBriefItem =>
              i.type === 'brief' && i.sprint_job_id === item.sprint_job_id,
          );
          const isActive = activeJobsItem?.sprint_job_id === item.sprint_job_id;
          const sprintStartedAt = item.children
            .map((c) => c.started_at)
            .filter((s): s is string => s !== null)
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
        }

        if (item.type === 'brief') {
          return (
            <StrategyBriefCard
              key={`brief-${item.brief_id}`}
              item={item}
              workspaceId={workspaceId}
            />
          );
        }

        if (item.type === 'error') {
          return (
            <div
              key={`error-${item.job_id}`}
              className="max-w-[80%] border border-red-300 rounded-xl p-3 text-sm text-red-600 dark:text-red-400"
            >
              <p className="font-medium">Orchestrator failed</p>
              <p className="text-xs mt-1">
                {(item.error as { message?: string }).message ?? 'Unknown error'}
              </p>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
