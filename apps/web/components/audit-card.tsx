'use client';

import type { AuditActionItem, AuditSeverity, QuickAuditResult } from '@prism/types';

function severityStyle(s: AuditSeverity): { bg: string; color: string; label: string } {
  switch (s) {
    case 'critical': return { bg: '#7f1d1d', color: '#fca5a5', label: 'critical' };
    case 'high':     return { bg: '#78350f', color: '#fde68a', label: 'high' };
    case 'medium':   return { bg: '#1e3a5f', color: '#93c5fd', label: 'medium' };
    case 'quick_win':return { bg: '#14532d', color: '#86efac', label: 'quick win' };
  }
}

function scoreColor(v: number): string {
  if (v >= 75) return '#34d399';
  if (v >= 50) return '#fbbf24';
  return '#f87171';
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--text-mut)', marginBottom: 4 }}>{label}</div>
      <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, marginBottom: 3 }}>
        <div style={{ width: `${value}%`, height: 4, background: scoreColor(value), borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: scoreColor(value) }}>{value}</div>
    </div>
  );
}

function ActionRow({ item }: { item: AuditActionItem }) {
  const style = severityStyle(item.severity);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{
        background: style.bg, color: style.color,
        borderRadius: 3, padding: '1px 6px', fontSize: 9, fontWeight: 600,
        whiteSpace: 'nowrap', marginTop: 2, flexShrink: 0,
      }}>
        {style.label}
      </span>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>{item.title}</div>
        <div style={{ fontSize: 10, color: 'var(--text-mut)', marginTop: 1 }}>{item.rationale}</div>
      </div>
    </div>
  );
}

function overallBadgeStyle(overall: number): { bg: string; color: string; label: string } {
  if (overall >= 75) return { bg: '#14532d', color: '#86efac', label: 'Good' };
  if (overall >= 50) return { bg: '#78350f', color: '#fde68a', label: 'Needs work' };
  return { bg: '#7f1d1d', color: '#fca5a5', label: 'Critical' };
}

export function AuditCard({ result }: { result: QuickAuditResult }) {
  const { score, action_items, domain, estimated_monthly_traffic } = result;
  const badge = overallBadgeStyle(score.overall);
  const trafficStr = estimated_monthly_traffic
    ? estimated_monthly_traffic.toLocaleString()
    : '—';

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {/* Avatar */}
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 2,
        background: 'var(--accent-dim, rgba(99,102,241,0.12))',
        color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={10} height={10} viewBox="0 0 16 16" fill="none">
          <path d="M8 2L14 14H2L8 2Z" fill="currentColor" opacity="0.8"/>
        </svg>
      </div>

      {/* Card */}
      <div style={{
        flex: 1, border: '1px solid var(--accent)',
        borderRadius: '2px 10px 10px 10px',
        background: 'var(--bg-card)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              Site audit complete — {domain}
            </span>
            <span style={{
              background: badge.bg, color: badge.color,
              borderRadius: 3, padding: '1px 7px', fontSize: 9, fontWeight: 700,
            }}>
              {score.overall} / 100 · {badge.label}
            </span>
          </div>
          {estimated_monthly_traffic !== null && (
            <div style={{ fontSize: 10, color: 'var(--text-mut)' }}>
              ~{trafficStr} monthly organic visits · {result.top_keywords.slice(0, 3).join(', ')}
            </div>
          )}
        </div>

        {/* Score bars */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10, padding: '10px 14px',
          background: 'var(--bg-elev)', borderBottom: '1px solid var(--border)',
        }}>
          <ScoreBar label="Technical" value={score.technical} />
          <ScoreBar label="Content" value={score.content} />
          <ScoreBar label="AI Visibility" value={score.ai_visibility} />
        </div>

        {/* Action items */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', letterSpacing: '.05em', marginBottom: 8 }}>
            ACTION ITEMS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {action_items.slice(0, 6).map((item, i) => (
              <ActionRow key={i} item={item} />
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-mut)' }}>
          What&apos;s your traffic goal? I&apos;ll build a sprint plan around these findings.
        </div>
      </div>
    </div>
  );
}
