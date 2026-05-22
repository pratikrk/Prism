'use client';

import Link from 'next/link';
import type { ThreadAuditItem, ThreadBriefItem, ThreadItem, ThreadJobsItem } from '@prism/types';
import { GoalBubble } from './goal-bubble';
import { PlanCard } from './plan-card';
import { ConfirmCard } from './confirm-card';
import { JobBoard } from './job-board';
import { AuditCard } from './audit-card';
import { useJobEvents } from '@/lib/sse';
import { approvePlan, patchPlan, refinePlan } from '@/lib/api';

interface ConversationThreadProps {
  items: ThreadItem[];
  token: string;
  workspaceId: string;
  pendingGoal?: string | null;
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

/* ─── Thinking bubble ──────────────────────────────────────────────────────── */
function ThinkingBubble({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 2,
        background: 'var(--accent-dim, rgba(99,102,241,0.12))',
        color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9,
      }}>▲</div>
      <div style={{
        padding: '10px 14px',
        border: '1px solid var(--border)',
        borderRadius: '2px 10px 10px 10px',
        background: 'var(--bg-card)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-mut)' }}>{label}</span>
        <span style={{ display: 'inline-flex', gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--accent)',
                display: 'inline-block',
                animation: `thinking-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                opacity: 0.4,
              }}
            />
          ))}
        </span>
      </div>
      <style>{`
        @keyframes thinking-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ─── Conversation thread ──────────────────────────────────────────────────── */
export function ConversationThread({ items, token, workspaceId, pendingGoal, onRefetch }: ConversationThreadProps) {
  const activeJobsItem = items.find(
    (i): i is ThreadJobsItem =>
      i.type === 'jobs' &&
      i.sprint_status !== 'complete' &&
      i.sprint_status !== 'complete_with_errors',
  );
  const events = useJobEvents(activeJobsItem?.sprint_job_id ?? null, token);

  // Determine if we should show a thinking indicator
  const lastGoal = [...items].reverse().find((i) => i.type === 'goal');
  const orchestratorRunning = lastGoal?.type === 'goal' && lastGoal.job_status === 'running';
  const hasPlanForLastGoal = items.some((i) => i.type === 'plan');
  const showOrchThinking = orchestratorRunning && !hasPlanForLastGoal;

  if (items.length === 0 && !pendingGoal) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <svg width={48} height={48} viewBox="0 0 24 24" fill="none" style={{ color: 'var(--border-strong, var(--border))', opacity: 0.6 }}>
          <path d="M12 2L2 20h20L12 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          <path d="M12 2L8 20M12 2L16 20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4"/>
        </svg>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-mut)', fontWeight: 500 }}>
            Tell me about your site — I&apos;ll take it from there.
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
            Try: &quot;audit my site&quot;, &quot;why am I not getting traffic?&quot;, or &quot;what should I fix first?&quot;
          </p>
        </div>
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

        if (item.type === 'audit') {
          return (
            <AuditCard
              key={`audit-${item.created_at}`}
              result={(item as ThreadAuditItem).result}
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

      {/* Optimistic goal bubble while API call is in flight */}
      {pendingGoal && (
        <GoalBubble goal={pendingGoal} feedback={null} createdAt={new Date().toISOString()} />
      )}

      {/* Thinking indicators */}
      {(pendingGoal || showOrchThinking) && (
        <ThinkingBubble label="Analysing goal and building plan" />
      )}
    </div>
  );
}
