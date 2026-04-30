'use client';

import { useAuth, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import useSWR from 'swr';
import { listWorkspaces } from '@/lib/api';
import type { Workspace } from '@prism/types';
import { ThemeToggle } from './theme-toggle';

/* ─── Icons ─────────────────────────────────────────────────────────────────── */
const PrismLogo = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L2 20h20L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M12 2L7 20" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.5"/>
    <path d="M12 2L17 20" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.5"/>
  </svg>
);

type IconName = 'bolt' | 'grid' | 'layers' | 'branch' | 'clock' | 'plus' | 'chev' | 'settings' | 'search';
const ICONS: Record<IconName, React.ReactNode> = {
  bolt:     <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>,
  grid:     <><rect x="2" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none"/><rect x="9" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none"/><rect x="2" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none"/><rect x="9" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none"/></>,
  layers:   <><path d="M8 2l6 3-6 3-6-3 6-3z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/><path d="M2 8l6 3 6-3M2 11l6 3 6-3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" strokeOpacity="0.5"/></>,
  branch:   <><circle cx="4" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="4" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="12" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M4 4.5v7M4 8c0-2 2-3 4-3h3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></>,
  clock:    <><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></>,
  plus:     <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>,
  chev:     <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  settings: <><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
  search:   <path d="M7 1a6 6 0 014.47 10L15 14.5l-.5.5L11 11.47A6 6 0 117 1zm0 1a5 5 0 100 10A5 5 0 007 2z" fill="currentColor"/>,
};

function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ flexShrink: 0, display: 'block' }}>
      {ICONS[name]}
    </svg>
  );
}

/* ─── Sidebar nav item ──────────────────────────────────────────────────────── */
function NavItem({ icon, label, shortcut, href, active }: {
  icon: IconName; label: string; shortcut?: string; href: string; active?: boolean;
}) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Link href={href as any} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 5,
      color: active ? 'var(--text)' : 'var(--text-mut)',
      background: active ? 'var(--bg-hover)' : 'transparent',
      fontSize: 12, fontWeight: active ? 500 : 400, textDecoration: 'none',
    }}>
      <Icon name={icon} size={13} />
      <span>{label}</span>
      <span style={{ flex: 1 }} />
      {shortcut && <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>{shortcut}</span>}
    </Link>
  );
}

/* ─── Workspace sidebar item ────────────────────────────────────────────────── */
const WS_COLORS = ['#ff8c42', '#3ecf8e', '#5b8dff', '#f5a524', '#7c5cff', '#ff6b9d'];

function WsItem({ ws, index, active }: { ws: Workspace; index: number; active: boolean }) {
  const color = WS_COLORS[index % WS_COLORS.length];
  return (
    <Link href={`/workspaces/${ws.id}`} style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 5,
      background: active ? 'var(--bg-hover)' : 'transparent',
      color: active ? 'var(--text)' : 'var(--text-mut)',
      fontSize: 12, textDecoration: 'none',
    }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ws.name}
      </span>
    </Link>
  );
}

/* ─── Main Chrome shell ─────────────────────────────────────────────────────── */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const activeWorkspaceId = params?.id ?? null;

  const { data: workspaces = [] } = useSWR('workspaces:list', async () => {
    const tok = await getToken();
    if (!tok) return [];
    return listWorkspaces(tok);
  }, { revalidateOnFocus: false });

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const isNewRun = pathname === '/workspaces/new';
  const isWorkspaceList = pathname === '/workspaces';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--bg)', color: 'var(--text)',
      fontFamily: 'inherit', fontSize: 13,
    }}>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{
        height: 42, flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
        background: 'var(--bg-elev)',
      }}>
        {/* Logo */}
        <Link href="/workspaces" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', textDecoration: 'none' }}>
          <PrismLogo />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>Prism</span>
        </Link>

        {/* Breadcrumb */}
        {activeWs && (
          <>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>/</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-mut)' }}>
              <span style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                background: WS_COLORS[workspaces.indexOf(activeWs) % WS_COLORS.length],
                display: 'inline-block',
              }} />
              <span>{activeWs.name}</span>
            </div>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>/</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-mut)' }}>
              {activeWs.domain}
            </span>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Search hint */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, color: 'var(--text-dim)', padding: '4px 8px',
          border: '1px solid var(--border)', borderRadius: 5,
        }}>
          <span className="mono" style={{ fontSize: 10 }}>⌘K</span>
          <span>Search</span>
        </div>

        <ThemeToggle />
        <UserButton afterSignOutUrl="/sign-in" />
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{
          width: 180, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          padding: '12px 8px',
          background: 'var(--bg)',
          display: 'flex', flexDirection: 'column', gap: 2,
          overflowY: 'auto',
        }}>
          <NavItem icon="bolt"   label="New run"     shortcut="N" href="/workspaces/new"  active={isNewRun} />
          <NavItem icon="grid"   label="Workspaces"  shortcut="W" href="/workspaces"      active={isWorkspaceList} />
          <NavItem icon="layers" label="Keywords"    href="/workspaces" />
          <NavItem icon="branch" label="Competitors" href="/workspaces" />
          <NavItem icon="clock"  label="History"     href="/workspaces" />

          {/* Workspace list */}
          {workspaces.length > 0 && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '10px 4px' }} />
              <div style={{
                fontSize: 10, color: 'var(--text-dim)',
                textTransform: 'uppercase', letterSpacing: 0.8,
                padding: '6px 8px 4px',
              }}>
                Workspaces
              </div>
              {workspaces.map((ws, i) => (
                <WsItem key={ws.id} ws={ws} index={i} active={ws.id === activeWorkspaceId} />
              ))}
            </>
          )}

          <Link href="/workspaces/new" style={{
            color: 'var(--text-dim)', fontSize: 12, padding: '6px 8px',
            display: 'flex', alignItems: 'center', gap: 6,
            textDecoration: 'none', marginTop: 4,
          }}>
            <Icon name="plus" size={12} />
            <span>New workspace</span>
          </Link>

          <div style={{ flex: 1 }} />

          {/* Status footer */}
          <div style={{
            fontSize: 10, color: 'var(--text-dim)', padding: '6px 8px',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--ok)', flexShrink: 0 }} />
            <span className="mono">4 workers · us-east</span>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
