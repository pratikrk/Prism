// apps/web/tests/sprint-page.test.tsx
import { render, screen } from '@testing-library/react';
import { useParams } from 'next/navigation';
import SprintPage from '@/app/(app)/workspaces/[id]/sprint/page';

vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
}));

const mockAuditThread = [{
  type: 'audit',
  result: {
    domain: 'example.com',
    domain_rating: 42,
    estimated_monthly_traffic: 1200,
    top_keywords: ['seo'],
    score: { technical: 72, content: 58, ai_visibility: 45, overall: 60 },
    action_items: [
      { severity: 'critical', title: 'Missing robots.txt', rationale: 'Blocks crawlers', effort_minutes: 10 },
      { severity: 'high', title: 'No schema markup', rationale: 'Misses rich results', effort_minutes: 30 },
      { severity: 'quick_win', title: 'Add meta descriptions', rationale: 'Improves CTR', effort_minutes: 15 },
    ],
    scanned_at: '2026-05-23T10:00:00Z',
  },
  created_at: '2026-05-23T10:00:00Z',
}];

vi.mock('swr', () => ({
  default: vi.fn(() => ({ data: mockAuditThread })),
}));

describe('SprintPage', () => {
  beforeEach(() => {
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'ws-1' });
  });

  it('renders action queue section', () => {
    render(<SprintPage />);
    expect(screen.getByText('Action Queue')).toBeInTheDocument();
  });

  it('renders all audit action items in the queue', () => {
    render(<SprintPage />);
    expect(screen.getByText('Missing robots.txt')).toBeInTheDocument();
    expect(screen.getByText('No schema markup')).toBeInTheDocument();
    expect(screen.getByText('Add meta descriptions')).toBeInTheDocument();
  });

  it('shows empty queue state when no audit', async () => {
    const swr = await import('swr');
    (swr.default as ReturnType<typeof vi.fn>).mockReturnValue({ data: [] });
    render(<SprintPage />);
    expect(screen.getByText(/queue is empty/i)).toBeInTheDocument();
  });
});
