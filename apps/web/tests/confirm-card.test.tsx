import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmCard } from '@/components/confirm-card';

describe('ConfirmCard', () => {
  it('shows domain and agent count', () => {
    render(
      <ConfirmCard
        domain="whitecarrot.io"
        agentNames={['keyword', 'competitor', 'content_audit', 'llm_visibility']}
        onConfirm={vi.fn()}
        busy={false}
      />,
    );
    expect(screen.getByText(/whitecarrot\.io/)).toBeTruthy();
    expect(screen.getByText(/4 research agents/i)).toBeTruthy();
  });

  it('calls onConfirm when Start Research clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmCard
        domain="whitecarrot.io"
        agentNames={['keyword']}
        onConfirm={onConfirm}
        busy={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /start research/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('disables button when busy', () => {
    render(
      <ConfirmCard
        domain="whitecarrot.io"
        agentNames={['keyword']}
        onConfirm={vi.fn()}
        busy={true}
      />,
    );
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
