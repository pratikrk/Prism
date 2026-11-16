'use client';

import { useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { getThread } from '@/lib/api';
import type { ThreadAuditItem, AuditSeverity } from '@prism/types';

const SEVERITY_COLOR: Record<AuditSeverity, string> = {
  critical: 'var(--error, #ef4444)',
  high: 'var(--warn)',
  medium: 'var(--accent)',
  quick_win: 'var(--ok)',
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? 'var(--ok)' : value >= 50 ? 'var(--warn)' : 'var(--error, #ef4444)';
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-mut)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const { data: items = [] } = useSWR(
    `thread:${id}`,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getThread(token, id);
    },
    { refreshInterval: 10_000 },
  );

  const auditItem = items.find((i): i is ThreadAuditItem => i.type === 'audit');
  const audit = auditItem?.result;

  if (!audit) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-mut)' }}>
        <p style={{ fontSize: 15, marginBottom: 8 }}>No audit yet.</p>
        <p style={{ fontSize: 13 }}>
          Go to <strong>Chat</strong> and say &quot;audit your site&quot; to get started.
        </p>
      </div>
    );
  }

  const overallColor = audit.score.overall >= 75 ? 'var(--ok)' : audit.score.overall >= 50 ? 'var(--warn)' : 'var(--error, #ef4444)';
  const topItems = audit.action_items.slice(0, 5);

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Overall score */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ textAlign: 'center', minWidth: 64 }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: overallColor, lineHeight: 1 }}>{audit.score.overall}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>overall</div>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <ScoreBar label="Technical" value={audit.score.technical} />
            <ScoreBar label="Content" value={audit.score.content} />
            <ScoreBar label="AI Visibility" value={audit.score.ai_visibility} />
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Domain Rating', value: audit.domain_rating ?? '—' },
            { label: 'Monthly Traffic', value: audit.estimated_monthly_traffic?.toLocaleString() ?? '—' },
            { label: 'Top Keywords', value: audit.top_keywords.length },
          ].map(({ label, value }) => (
            <div key={label} style={{ flex: 1, minWidth: 140, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-mut)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Action items */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
            Top Issues
          </div>
          {topItems.map((item, i) => (
            <div key={i} style={{ padding: '12px 20px', borderBottom: i < topItems.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: SEVERITY_COLOR[item.severity], background: `${SEVERITY_COLOR[item.severity]}18`, padding: '2px 7px', borderRadius: 4, marginTop: 1, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {item.severity.replace('_', ' ')}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-mut)', marginTop: 2 }}>{item.rationale}</div>
              </div>
              {item.effort_minutes && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>{item.effort_minutes}m</span>
              )}
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
          Scanned {new Date(auditItem.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
