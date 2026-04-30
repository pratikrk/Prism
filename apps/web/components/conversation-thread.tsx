'use client';

import { useState } from 'react';
import type { ThreadItem, ThreadJobsItem } from '@prism/types';
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

export function ConversationThread({ items, token, workspaceId, onRefetch }: ConversationThreadProps) {
  const [pendingApprove, setPendingApprove] = useState<string | null>(null);
  const [approvingPlanId, setApprovingPlanId] = useState<string | null>(null);

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
    setPendingApprove(planId);
  }

  async function handleConfirm(planId: string) {
    setApprovingPlanId(planId);
    try {
      await approvePlan(token, planId);
      onRefetch();
    } finally {
      setApprovingPlanId(null);
      setPendingApprove(null);
    }
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
          const isAwaitingApprove = pendingApprove === plan.id;
          return (
            <div key={`plan-${plan.id}`} className="space-y-3">
              <PlanCard
                plan={plan}
                jobStatus={job_status}
                onEdit={(fields) => handleEdit(plan.id, fields)}
                onRefine={(fb) => handleRefine(plan.id, fb)}
                onApprove={() => handleApprove(plan.id)}
              />
              {isAwaitingApprove && plan.plan_status === 'draft' && (
                <ConfirmCard
                  domain={plan.domain}
                  agentNames={plan.sprint_order}
                  onConfirm={() => handleConfirm(plan.id)}
                  busy={approvingPlanId === plan.id}
                />
              )}
            </div>
          );
        }

        if (item.type === 'jobs') {
          return (
            <div key={`jobs-${item.sprint_job_id}`} className="border rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-3">Research agents running…</p>
              <JobBoard
                initialJobs={item.children}
                events={activeJobsItem?.sprint_job_id === item.sprint_job_id ? events : []}
                onRetry={() => onRefetch()}
              />
            </div>
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
