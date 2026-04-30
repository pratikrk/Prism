'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createWorkspace } from '@/lib/api';

export default function NewWorkspacePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;
      const w = await createWorkspace(token, { name, domain });
      router.push(`/workspaces/${w.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
    }} className="prism-grid">
      {/* Breadcrumb */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 24px', borderBottom: '1px solid var(--border)',
        fontSize: 12, color: 'var(--text-mut)',
        background: 'var(--bg)',
      }}>
        <span style={{ color: 'var(--text)' }}>New workspace</span>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', maxWidth: 480, marginBottom: 32 }}>
        <div className="mono" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 1.5, marginBottom: 14, textTransform: 'uppercase' }}>
          ▲ Prism · Foundation
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.7, margin: 0, lineHeight: 1.15, color: 'var(--text)' }}>
          Create a workspace.
          <br />
          <span style={{ color: 'var(--text-mut)' }}>Target a domain.</span>
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-mut)', marginTop: 12, lineHeight: 1.55 }}>
          Each workspace focuses on one domain. You'll run sprint goals from within it.
        </p>
      </div>

      {/* Form card */}
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 420 }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-strong)',
          borderRadius: 10,
          padding: '20px',
          boxShadow: '0 0 0 3px var(--accent-dim), 0 20px 40px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Workspace name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="White Carrot"
              style={{
                border: '1px solid var(--border-strong)', borderRadius: 6,
                background: 'transparent', outline: 'none',
                color: 'var(--text)', fontFamily: 'inherit', fontSize: 14,
                padding: '9px 12px',
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Target domain
            </span>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
              placeholder="whitecarrot.io"
              style={{
                border: '1px solid var(--border-strong)', borderRadius: 6,
                background: 'transparent', outline: 'none',
                color: 'var(--text)', fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 14, padding: '9px 12px',
              }}
            />
          </label>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !domain.trim()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 6,
                border: '1px solid var(--accent)',
                background: submitting || !name.trim() || !domain.trim() ? 'transparent' : 'var(--accent)',
                color: submitting || !name.trim() || !domain.trim() ? 'var(--accent)' : '#fff',
                fontSize: 13, fontWeight: 500,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {submitting ? 'Creating…' : 'Create workspace'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
