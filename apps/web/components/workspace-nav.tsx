'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

const TABS = [
  { label: 'Chat',      path: '' },
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Sprint',    path: '/sprint' },
  { label: 'Content',   path: '/content' },
  { label: 'Calendar',  path: '/calendar' },
] as const;

export function WorkspaceNav() {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const base = `/workspaces/${id}`;

  return (
    <nav style={{
      display: 'flex',
      gap: '2px',
      padding: '0 24px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
      flexShrink: 0,
    }}>
      {TABS.map(({ label, path }) => {
        const href = `${base}${path}`;
        const active = path === ''
          ? pathname === base || pathname === `${base}/`
          : pathname === `${base}${path}` || pathname.startsWith(`${base}${path}/`);
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? 'page' : undefined}
            style={{
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--text)' : 'var(--text-mut)',
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              textDecoration: 'none',
              transition: 'color 0.1s',
              marginBottom: '-1px',
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
