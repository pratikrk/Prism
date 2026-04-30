import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobBoard } from '@/components/job-board';
import type { Job } from '@prism/types';

const base: Omit<Job, 'type' | 'status' | 'id'> = {
  workspace_id: 'w1', parent_job_id: null, input: {}, result: null, error: null,
  started_at: null, completed_at: null, created_at: '2026-04-22T00:00:00Z',
};

describe('JobBoard', () => {
  it('renders 4 agent lanes and applies status from events', () => {
    const onRetry = vi.fn();
    render(
      <JobBoard
        initialJobs={[]}
        events={[
          {
            job_id: 'k1', parent_job_id: 's1', workspace_id: 'w1',
            type: 'keyword', status: 'running', at: '2026-04-22T00:01:00Z', error: null,
          },
        ]}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('Keyword')).toBeInTheDocument();
    expect(screen.getByText('Competitor')).toBeInTheDocument();
    expect(screen.getByText('Content audit')).toBeInTheDocument();
    expect(screen.getByText('LLM visibility')).toBeInTheDocument();
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
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledWith('k1');
  });
});
