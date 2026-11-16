import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfirmCard } from '@/components/confirm-card';

describe('ConfirmCard', () => {
  it('shows approval success notification', () => {
    render(<ConfirmCard />);
    expect(screen.getByText(/Plan approved/i)).toBeTruthy();
    expect(screen.getByText(/dispatching research agents/i)).toBeTruthy();
  });

  it('shows Celery chord label', () => {
    render(<ConfirmCard />);
    expect(screen.getByText(/Celery chord/i)).toBeTruthy();
  });
});
