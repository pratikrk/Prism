import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GoalInput } from '@/components/goal-input';

describe('GoalInput', () => {
  it('submits the typed goal', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GoalInput onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId('goal-textarea'), { target: { value: 'rank for X' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('rank for X'));
  });

  it('is disabled when disabled prop is set', () => {
    render(<GoalInput onSubmit={vi.fn()} disabled />);
    expect(screen.getByTestId('goal-textarea')).toBeDisabled();
    expect(screen.getByRole('button', { name: /job in flight/i })).toBeDisabled();
  });

  it('chip click fills textarea', () => {
    render(<GoalInput onSubmit={vi.fn()} />);
    const chip = screen.getAllByRole('button', { name: /…/ })[0];
    fireEvent.click(chip);
    expect((screen.getByTestId('goal-textarea') as HTMLTextAreaElement).value).not.toBe('');
  });
});
