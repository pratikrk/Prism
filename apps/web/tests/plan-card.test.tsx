import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Plan } from '@prism/types';
import { PlanCard } from '@/components/plan-card';

const basePlan: Plan = {
  id: 'plan-1',
  job_id: 'job-1',
  workspace_id: 'ws-1',
  intent: 'drive organic signups',
  domain: 'whitecarrot.io',
  competitors: ['greenhouse.io', 'ashby.com'],
  timeline_weeks: 12,
  sprint_order: ['keyword', 'competitor', 'content_audit', 'llm_visibility'],
  version: 1,
  feedback: null,
  plan_status: 'draft',
  parent_plan_id: null,
};

describe('PlanCard', () => {
  it('renders plan fields', () => {
    render(
      <PlanCard plan={basePlan} jobStatus="awaiting_gate0"
        onEdit={vi.fn()} onRefine={vi.fn()} onApprove={vi.fn()} />,
    );
    expect(screen.getByText('drive organic signups')).toBeTruthy();
    expect(screen.getByText('whitecarrot.io')).toBeTruthy();
    expect(screen.getByText('12 weeks')).toBeTruthy();
  });

  it('approve button is enabled when jobStatus is awaiting_gate0', () => {
    render(
      <PlanCard plan={basePlan} jobStatus="awaiting_gate0"
        onEdit={vi.fn()} onRefine={vi.fn()} onApprove={vi.fn()} />,
    );
    const btn = screen.getByRole('button', { name: /approve/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('approve button is disabled when jobStatus is not awaiting_gate0', () => {
    render(
      <PlanCard plan={basePlan} jobStatus="running"
        onEdit={vi.fn()} onRefine={vi.fn()} onApprove={vi.fn()} />,
    );
    const btn = screen.getByRole('button', { name: /approve/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows superseded badge when plan_status is superseded', () => {
    render(
      <PlanCard plan={{ ...basePlan, plan_status: 'superseded' }} jobStatus="complete"
        onEdit={vi.fn()} onRefine={vi.fn()} onApprove={vi.fn()} />,
    );
    expect(screen.getByText(/superseded/i)).toBeTruthy();
  });

  it('calls onApprove when approve clicked', () => {
    const onApprove = vi.fn();
    render(
      <PlanCard plan={basePlan} jobStatus="awaiting_gate0"
        onEdit={vi.fn()} onRefine={vi.fn()} onApprove={onApprove} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledOnce();
  });
});
