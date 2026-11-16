import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GoalBubble } from '@/components/goal-bubble';

describe('GoalBubble', () => {
  it('renders goal text', () => {
    render(<GoalBubble goal="50k signups in 6 months" feedback={null} createdAt="2026-04-30T10:00:00Z" />);
    expect(screen.getByText('50k signups in 6 months')).toBeTruthy();
  });

  it('renders refinement feedback label when feedback present', () => {
    render(<GoalBubble goal="50k signups" feedback="add lever.co as competitor" createdAt="2026-04-30T10:00:00Z" />);
    expect(screen.getByText(/Refinement/i)).toBeTruthy();
    expect(screen.getByText('add lever.co as competitor')).toBeTruthy();
  });

  it('does not show refinement label when feedback is null', () => {
    render(<GoalBubble goal="grow traffic" feedback={null} createdAt="2026-04-30T10:00:00Z" />);
    expect(screen.queryByText(/Refinement/i)).toBeNull();
  });
});
