import { render, screen } from '@testing-library/react';
import { usePathname, useParams } from 'next/navigation';
import { WorkspaceNav } from '@/components/workspace-nav';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useParams: vi.fn(),
}));

describe('WorkspaceNav', () => {
  beforeEach(() => {
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'ws-1' });
  });

  it('renders all five tabs', () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/workspaces/ws-1');
    render(<WorkspaceNav />);
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Sprint')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
  });

  it('marks Chat as active on workspace root', () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/workspaces/ws-1');
    render(<WorkspaceNav />);
    const chatLink = screen.getByRole('link', { name: 'Chat' });
    expect(chatLink).toHaveAttribute('data-active', 'true');
  });

  it('marks Dashboard as active on dashboard route', () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/workspaces/ws-1/dashboard');
    render(<WorkspaceNav />);
    const dashLink = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashLink).toHaveAttribute('data-active', 'true');
  });
});
