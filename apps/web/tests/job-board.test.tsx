import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JobBoard } from '@/components/job-board';
import type { Job } from '@prism/types';

const base: Omit<Job, 'type' | 'status' | 'id'> = {
  workspace_id: 'w1', parent_job_id: null, input: {}, result: null, error: null,
  started_at: null, completed_at: null, created_at: '2026-04-22T00:00:00Z',
};

describe('JobBoard', () => {
  it('renders 4 research agent lanes', () => {
    render(
      <JobBoard
        initialJobs={[]}
        events={[]}
        workspaceId="w1"
        briefId={null}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('Keyword Research')).toBeInTheDocument();
    expect(screen.getByText('Competitor Analysis')).toBeInTheDocument();
    expect(screen.getByText('Content Audit')).toBeInTheDocument();
    expect(screen.getByText('LLM Visibility')).toBeInTheDocument();
  });

  it('shows orchestrator row always', () => {
    render(
      <JobBoard
        initialJobs={[]}
        events={[]}
        workspaceId="w1"
        briefId={null}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('Orchestrator')).toBeInTheDocument();
  });

  it('shows sprint header when sprintStatus provided', () => {
    render(
      <JobBoard
        initialJobs={[]}
        events={[]}
        workspaceId="w1"
        briefId={null}
        sprintStatus="running"
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/research sprint/i)).toBeInTheDocument();
  });

  it('shows synthesis row as complete when sprint is awaiting_gate1', () => {
    render(
      <JobBoard
        initialJobs={[]}
        events={[]}
        workspaceId="w1"
        briefId="b1"
        sprintStatus="awaiting_gate1"
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('Synthesis')).toBeInTheDocument();
  });

  it('applies status from SSE events', () => {
    render(
      <JobBoard
        initialJobs={[]}
        events={[
          {
            job_id: 'k1', parent_job_id: 's1', workspace_id: 'w1',
            type: 'keyword', status: 'running', at: '2026-04-22T00:01:00Z', error: null,
          },
        ]}
        workspaceId="w1"
        briefId={null}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('Keyword Research')).toBeInTheDocument();
  });

  it('retry button calls onRetry for retryable failures', () => {
    const onRetry = vi.fn();
    render(
      <JobBoard
        initialJobs={[{
          ...base, id: 'k1', type: 'keyword', status: 'failed',
          error: { kind: 'rate_limit', message: 'rl', retryable: true },
        }]}
        events={[]}
        workspaceId="w1"
        briefId={null}
        onRetry={onRetry}
      />,
    );
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    retryBtn.click();
    expect(onRetry).toHaveBeenCalledWith('k1');
  });
});
