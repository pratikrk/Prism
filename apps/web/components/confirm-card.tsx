'use client';

export function ConfirmCard() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {/* Green check avatar */}
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 2,
        background: 'var(--ok-dim)',
        color: 'var(--ok)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
          <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Green notification bubble */}
      <div style={{
        background: 'var(--ok-dim)',
        border: '1px solid var(--ok)',
        borderRadius: '2px 10px 10px 10px',
        padding: '10px 14px',
        fontSize: 13,
        color: 'var(--ok)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        Plan approved · dispatching research agents…
        <span className="mono" style={{ fontSize: 10, opacity: 0.7 }}>Celery chord</span>
      </div>
    </div>
  );
}
