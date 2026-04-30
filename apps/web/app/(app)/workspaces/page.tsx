'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import { listWorkspaces } from '@/lib/api';
import type { Workspace } from '@prism/types';

const WS_COLORS = ['#ff8c42', '#3ecf8e', '#5b8dff', '#f5a524', '#7c5cff', '#ff6b9d'];

function WsCard({ ws, index }: { ws: Workspace; index: number }) {
  const color = WS_COLORS[index % WS_COLORS.length];
  return (
    <Link href={`/workspaces/${ws.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--bg-card)',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer', transition: 'border-color 0.12s, background 0.12s',
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)';
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card)';
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        }}
      >
        <span style={{
          width: 32, height: 32, borderRadius: 8, background: color,
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 600, color: '#fff',
        }}>
          {ws.name[0]?.toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
            {ws.name}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-mut)' }}>
            {ws.domain}
          </div>
        </div>
        <svg width={14} height={14} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--text-dim)' }}>
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </Link>
  );
}

export default function WorkspacesPage() {
  const { getToken } = useAuth();
  const { data, isLoading } = useSWR('workspaces', async () => {
    const token = await getToken();
    if (!token) return [];
    return listWorkspaces(token);
  });

  return (
    <div style={{ padding: '28px 24px', maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.4 }}>
            Workspaces
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-mut)' }}>
            Each workspace targets a domain with an SEO strategy sprint.
          </p>
        </div>
        <Link href="/workspaces/new" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 13px', borderRadius: 6,
          border: '1px solid var(--accent)', background: 'var(--accent)',
          color: '#fff', fontSize: 12, fontWeight: 500, textDecoration: 'none',
        }}>
          <svg width={11} height={11} viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          New workspace
        </Link>
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
      ) : data?.length === 0 ? (
        <div style={{
          border: '1px dashed var(--border-strong)', borderRadius: 8,
          padding: '40px 24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13,
        }}>
          No workspaces yet.{' '}
          <Link href="/workspaces/new" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Create your first one →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data?.map((ws, i) => (
            <WsCard key={ws.id} ws={ws} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
