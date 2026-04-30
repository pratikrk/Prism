import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ThreadItem } from '@prism/types';
import { ConversationThread } from '@/components/conversation-thread';

vi.mock('@/lib/sse', () => ({
  useJobEvents: () => [],
}));

const goalItem: ThreadItem = {
  type: 'goal',
  job_id: 'job-1',
  goal: '50k organic signups',
  feedback: null,
  job_status: 'awaiting_gate0',
  created_at: '2026-04-30T10:00:00Z',
};

const planItem: ThreadItem = {
  type: 'plan',
  plan: {
    id: 'plan-1',
    job_id: 'job-1',
    workspace_id: 'ws-1',
    intent: 'drive signups',
    domain: 'whitecarrot.io',
    competitors: ['greenhouse.io'],
    timeline_weeks: 12,
    sprint_order: ['keyword', 'competitor', 'content_audit', 'llm_visibility'],
    version: 1,
    feedback: null,
    plan_status: 'draft',
    parent_plan_id: null,
  },
  job_status: 'awaiting_gate0',
};

describe('ConversationThread', () => {
  it('renders goal bubble', () => {
    render(
      <ConversationThread
        items={[goalItem]}
        token="tok"
        workspaceId="ws-1"
        onRefetch={vi.fn()}
      />,
    );
    expect(screen.getByText('50k organic signups')).toBeTruthy();
  });

  it('renders plan card after goal', () => {
    render(
      <ConversationThread
        items={[goalItem, planItem]}
        token="tok"
        workspaceId="ws-1"
        onRefetch={vi.fn()}
      />,
    );
    expect(screen.getByText('drive signups')).toBeTruthy();
    expect(screen.getByRole('button', { name: /approve/i })).toBeTruthy();
  });

  it('renders empty state when no items', () => {
    render(
      <ConversationThread
        items={[]}
        token="tok"
        workspaceId="ws-1"
        onRefetch={vi.fn()}
      />,
    );
    expect(screen.getByText(/submit your first goal/i)).toBeTruthy();
  });
});
