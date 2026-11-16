'use client';

import { useAuth, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { listWorkspaces } from '@/lib/api';
import type { Workspace } from '@prism/types';
import { ThemeToggle } from './theme-toggle';

/* ─── Prism logo ─────────────────────────────────────────────────────────── */
const PrismLogo = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L2 20h20L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>
);

/* ─── Nav icon set ──────────────────────────────────────────────────────── */
type IconName = 'plus' | 'search';

function NavIcon({ name }: { name: IconName }) {
  const icons: Record<IconName, React.ReactNode> = {
    'plus':   <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>,
    'search': <><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
  };
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" style={{ flexShrink: 0, display: 'block' }}>
      {icons[name]}
    </svg>
  );
}

/* ─── Workspace color ───────────────────────────────────────────────────── */
export const WS_COLORS = ['#ff8c42', '#3ecf8e', '#5b8dff', '#f5a524', '#7c5cff', '#ff6b9d'];

function WsItem({ ws, index, active }: { ws: Workspace; index: number; active: boolean }) {
  const color = WS_COLORS[index % WS_COLORS.length];
  return (
    <Link href={`/workspaces/${ws.id}`} style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '5px 8px', borderRadius: 5,
      background: active ? 'var(--bg-hover)' : 'transparent',
      color: active ? 'var(--text)' : 'var(--text-mut)',
      fontSize: 12, textDecoration: 'none',
      transition: 'background 0.1s, color 0.1s',
    }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
    </Link>
  );
}

/* ─── Section label ─────────────────────────────────────────────────────── */
function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 10, color: 'var(--text-dim)',
      textTransform: 'uppercase', letterSpacing: 1,
      padding: '10px 8px 4px', fontWeight: 500,
    }}>
      {label}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />;
}

/* ─── Top bar ───────────────────────────────────────────────────────────── */
function TopBar({ workspace, wsIndex }: { workspace?: Workspace; wsIndex: number }) {
  return (
    <div style={{
      height: 42, flexShrink: 0,
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8,
      background: 'var(--bg-elev)',
    }}>
      <Link href="/workspaces" style={{
        display: 'flex', alignItems: 'center', gap: 7,
        color: 'var(--text)', textDecoration: 'none', flexShrink: 0,
      }}>
        <PrismLogo />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.3 }}>Prism</span>
      </Link>

      {workspace && (
        <>
          <span style={{ color: 'var(--border-strong, var(--border))', fontSize: 14, marginLeft: 2 }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-mut)' }}>
            <span style={{
              width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
              background: WS_COLORS[wsIndex % WS_COLORS.length],
              display: 'inline-block',
            }} />
            <span style={{ fontWeight: 500, color: 'var(--text)' }}>{workspace.name}</span>
          </div>
          <span style={{ color: 'var(--border-strong, var(--border))', fontSize: 14 }}>/</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-mut)' }}>
            workspaces/{workspace.domain.replace(/\./g, '-')}
          </span>
        </>
      )}

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 11, color: 'var(--text-dim)', padding: '4px 9px',
        border: '1px solid var(--border)', borderRadius: 6,
        cursor: 'default',
      }}>
        <NavIcon name="search" />
        <span>Search</span>
        <span className="mono" style={{ fontSize: 10, marginLeft: 2 }}>⌘K</span>
      </div>

      <ThemeToggle />
      <UserButton afterSignOutUrl="/sign-in" />
    </div>
  );
}

/* ─── App Chrome ────────────────────────────────────────────────────────── */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const params = useParams<{ id?: string }>();
  const activeWorkspaceId = params?.id ?? null;

  const { data: workspaces = [] } = useSWR('workspaces:list', async () => {
    const tok = await getToken();
    if (!tok) return [];
    return listWorkspaces(tok);
  }, { revalidateOnFocus: false });

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeWsIndex = workspaces.indexOf(activeWs!);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13,
    }}>
      <TopBar workspace={activeWs} wsIndex={activeWsIndex} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div style={{
          width: 188, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          padding: '8px 8px 12px',
          background: 'var(--bg)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* Workspaces */}
          <SectionLabel label="Workspaces" />
          {workspaces.map((ws, i) => (
            <WsItem key={ws.id} ws={ws} index={i} active={ws.id === activeWorkspaceId} />
          ))}

          <Link href="/workspaces/new" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 8px', color: 'var(--text-dim)', fontSize: 12,
            textDecoration: 'none', marginTop: 2,
          }}>
            <NavIcon name="plus" />
            <span>New workspace</span>
          </Link>

          <div style={{ flex: 1 }} />

          <Divider />

          {/* Workers status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 8px', fontSize: 10, color: 'var(--text-dim)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--ok)', flexShrink: 0,
            }} />
            <span className="mono">4 workers · us-east</span>
          </div>
        </div>

        {/* ── Main content ────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
