'use client';

import { useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { getThread } from '@/lib/api';
import type { ThreadAuditItem, ThreadJobsItem, AuditSeverity } from '@prism/types';

const SEVERITY_COLOR: Record<AuditSeverity, string> = {
  critical: 'var(--error, #ef4444)',
  high: 'var(--warn)',
  medium: 'var(--accent)',
  quick_win: 'var(--ok)',
};

const SEVERITY_ORDER: AuditSeverity[] = ['critical', 'high', 'medium', 'quick_win'];

export default function SprintPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const { data: items = [] } = useSWR(
    `thread:${id}`,
    () => getToken().then(tok => tok ? getThread(tok, id) : []),
    { refreshInterval: 5_000 },
  );

  const auditItem = items.find((i): i is ThreadAuditItem => i.type === 'audit');
  const activeResearch = items.filter((i): i is ThreadJobsItem =>
    i.type === 'jobs' &&
    i.sprint_status !== 'complete' &&
    i.sprint_status !== 'complete_with_errors' &&
    i.sprint_status !== 'failed',
  );

  const actionItems = auditItem?.result.action_items
    .slice()
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)) ?? [];

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {activeResearch.length > 0 && (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-mut)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Active
            </h2>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px', fontSize: 13, color: 'var(--text-mut)' }}>
              {activeResearch.length} research sprint{activeResearch.length > 1 ? 's' : ''} running — check Chat for live updates.
            </div>
          </section>
        )}

        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-mut)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Action Queue
          </h2>

          {actionItems.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '32px 24px', textAlign: 'center', color: 'var(--text-mut)' }}>
              <p style={{ fontSize: 14 }}>Queue is empty.</p>
              <p style={{ fontSize: 12, marginTop: 6 }}>Go to Chat and say &quot;audit my site&quot; — Prism will identify what to fix.</p>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {actionItems.map((item, i) => (
                <div key={i} style={{
                  padding: '14px 20px',
                  borderBottom: i < actionItems.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: SEVERITY_COLOR[item.severity],
                    background: `${SEVERITY_COLOR[item.severity]}18`,
                    padding: '3px 7px', borderRadius: 4,
                    flexShrink: 0, marginTop: 2,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {item.severity.replace('_', ' ')}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-mut)', marginTop: 3 }}>{item.rationale}</div>
                  </div>
                  {item.effort_minutes && (
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0, marginTop: 2 }}>
                      ~{item.effort_minutes}m
                    </span>
                  )}
                  <button
                    disabled
                    title="Fix generation coming in Technical Pillar sub-project"
                    style={{
                      fontSize: 12, padding: '4px 12px',
                      border: '1px solid var(--border)', borderRadius: 6,
                      background: 'none', color: 'var(--text-dim)',
                      cursor: 'not-allowed', flexShrink: 0,
                    }}
                  >
                    Fix →
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Fix generation and 1-click apply will be available in the next update.
        </p>
      </div>
    </div>
  );
}
