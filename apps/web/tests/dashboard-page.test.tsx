import { render, screen } from '@testing-library/react';
import { useParams } from 'next/navigation';
import DashboardPage from '@/app/(app)/workspaces/[id]/dashboard/page';

vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
}));

vi.mock('swr', () => ({
  default: vi.fn((key: string | null) => {
    if (key?.startsWith('thread:')) {
      return {
        data: [{
          type: 'audit',
          result: {
            domain: 'example.com',
            domain_rating: 42,
            estimated_monthly_traffic: 1200,
            top_keywords: ['seo tool', 'keyword research'],
            score: { technical: 72, content: 58, ai_visibility: 45, overall: 60 },
            action_items: [
              { severity: 'critical', title: 'Missing robots.txt', rationale: 'Blocks crawlers', effort_minutes: 10 },
              { severity: 'high', title: 'No schema markup', rationale: 'Misses rich results', effort_minutes: 30 },
            ],
            scanned_at: '2026-05-23T10:00:00Z',
          },
          created_at: '2026-05-23T10:00:00Z',
        }],
      };
    }
    return { data: [] };
  }),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'ws-1' });
  });

  it('renders overall health score', () => {
    render(<DashboardPage />);
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('renders three pillar scores', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Technical')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('AI Visibility')).toBeInTheDocument();
  });

  it('renders top action items', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Missing robots.txt')).toBeInTheDocument();
    expect(screen.getByText('No schema markup')).toBeInTheDocument();
  });

  it('shows no-audit state when thread has no audit item', async () => {
    const swr = await import('swr');
    (swr.default as ReturnType<typeof vi.fn>).mockReturnValue({ data: [] });
    render(<DashboardPage />);
    expect(screen.getByText(/audit your site/i)).toBeInTheDocument();
  });
});
