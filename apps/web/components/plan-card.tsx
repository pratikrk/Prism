'use client';

import { useState } from 'react';
import type { Plan } from '@prism/types';

interface PlanCardProps {
  plan: Plan;
  jobStatus: string;
  onEdit: (fields: { intent?: string; competitors?: string[]; timeline_weeks?: number }) => Promise<void>;
  onRefine: (feedback: string) => Promise<void>;
  onApprove: () => void;
}

export function PlanCard({ plan, jobStatus, onEdit, onRefine, onApprove }: PlanCardProps) {
  const [refineOpen, setRefineOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [refining, setRefining] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState(false);
  const [timelineVal, setTimelineVal] = useState(String(plan.timeline_weeks));

  const isSuperseded = plan.plan_status === 'superseded';
  const canApprove = jobStatus === 'awaiting_gate0';

  async function submitRefine(e: React.FormEvent) {
    e.preventDefault();
    if (!feedback.trim() || refining) return;
    setRefining(true);
    try {
      await onRefine(feedback.trim());
      setFeedback('');
      setRefineOpen(false);
    } finally {
      setRefining(false);
    }
  }

  async function saveTimeline() {
    const weeks = parseInt(timelineVal, 10);
    if (weeks >= 1 && weeks <= 52) {
      await onEdit({ timeline_weeks: weeks });
    }
    setEditingTimeline(false);
  }

  return (
    <div className={`max-w-[80%] border rounded-2xl rounded-tl-sm p-4 space-y-3 text-sm ${isSuperseded ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Prism Plan v{plan.version}</span>
        {isSuperseded && (
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">superseded</span>
        )}
      </div>

      <div className="space-y-1.5">
        <Row label="Intent">{plan.intent}</Row>
        <Row label="Domain">{plan.domain}</Row>
        <Row label="Competitors">{plan.competitors.join(', ') || '—'}</Row>
        <Row label="Timeline">
          {editingTimeline ? (
            <span className="flex items-center gap-1">
              <input
                type="number" min={1} max={52}
                className="w-16 border rounded px-1 py-0.5 text-xs bg-background"
                value={timelineVal}
                onChange={(e) => setTimelineVal(e.target.value)}
                onBlur={saveTimeline}
                autoFocus
              />
              <span>weeks</span>
            </span>
          ) : (
            <button
              className="underline decoration-dashed text-left"
              onClick={() => !isSuperseded && setEditingTimeline(true)}
            >
              {plan.timeline_weeks} weeks
            </button>
          )}
        </Row>
        <Row label="Sprint order">{plan.sprint_order.join(' → ')}</Row>
      </div>

      {!isSuperseded && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            className="text-xs border rounded px-3 py-1"
            onClick={() => setRefineOpen((o) => !o)}
          >
            Refine…
          </button>
          <button
            className="text-xs border rounded px-3 py-1 bg-primary text-primary-foreground disabled:opacity-40"
            disabled={!canApprove}
            onClick={onApprove}
          >
            Approve →
          </button>
        </div>
      )}

      {refineOpen && !isSuperseded && (
        <form onSubmit={submitRefine} className="space-y-2 pt-1">
          <textarea
            className="w-full border rounded p-2 text-xs bg-background min-h-16"
            placeholder="What should change? e.g. also target lever.co, focus long-tail"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={refining}
          />
          <button
            type="submit"
            disabled={refining || !feedback.trim()}
            className="text-xs border rounded px-3 py-1 disabled:opacity-40"
          >
            {refining ? 'Re-planning…' : 'Re-plan'}
          </button>
        </form>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span>{children}</span>
    </div>
  );
}
