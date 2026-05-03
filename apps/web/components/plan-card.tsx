'use client';

import { useState } from 'react';
import type { Plan } from '@prism/types';

const PrismLogo = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L2 20h20L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M12 2L7 20" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.5"/>
    <path d="M12 2L17 20" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.5"/>
  </svg>
);

interface PlanCardProps {
  plan: Plan;
  jobStatus: string;
  onEdit: (fields: { intent?: string; competitors?: string[]; timeline_weeks?: number }) => Promise<void>;
  onRefine: (feedback: string) => Promise<void>;
  onApprove: () => Promise<void> | void;
}

export function PlanCard({ plan, jobStatus, onEdit, onRefine, onApprove }: PlanCardProps) {
  const [refineOpen, setRefineOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [refining, setRefining] = useState(false);
  const [approving, setApproving] = useState(false);

  // Local competitor editing (chip add/remove)
  const [localCompetitors, setLocalCompetitors] = useState<string[]>(plan.competitors);
  const [addingComp, setAddingComp] = useState(false);
  const [compInput, setCompInput] = useState('');

  const isSuperseded = plan.plan_status === 'superseded';
  const isApproved = plan.plan_status === 'approved';
  const canApprove = jobStatus === 'awaiting_gate0' && !approving;

  const borderColor = isSuperseded
    ? 'var(--border)'
    : isApproved
    ? 'var(--ok)'
    : 'var(--border-strong)';

  async function handleApprove() {
    if (!canApprove) return;
    // Sync competitor edits first
    if (localCompetitors.join(',') !== plan.competitors.join(',')) {
      await onEdit({ competitors: localCompetitors });
    }
    setApproving(true);
    try {
      await onApprove();
    } finally {
      setApproving(false);
    }
  }

  async function handleRefine(e: React.FormEvent) {
    e.preventDefault();
    if (!feedback.trim() || refining) return;
    setRefining(true);
    try {
      await onRefine(feedback.trim());
      setFeedback('');
      setRefineOpen(false);
    } finally {
      setRefining(false);
    }
  }

  function removeCompetitor(i: number) {
    const next = localCompetitors.filter((_, j) => j !== i);
    setLocalCompetitors(next);
    onEdit({ competitors: next });
  }

  function commitCompetitor() {
    const trimmed = compInput.trim();
    if (trimmed && !localCompetitors.includes(trimmed)) {
      const next = [...localCompetitors, trimmed];
      setLocalCompetitors(next);
      onEdit({ competitors: next });
    }
    setCompInput('');
    setAddingComp(false);
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', opacity: isSuperseded ? 0.5 : 1 }}>
      {/* Prism logo avatar */}
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 2,
        background: 'var(--accent-dim, rgba(99,102,241,0.12))',
        color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <PrismLogo size={13} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: 'var(--bg-card)',
          border: `1px solid ${borderColor}`,
          borderRadius: '2px 10px 10px 10px',
          padding: '14px 16px',
        }}>
          {/* Feasibility warning */}
          {plan.feasibility_note && (
            <div role="note" style={{
              background: 'var(--warn-dim, #fff8e6)',
              border: '1px solid var(--warn, #d97706)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 12,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}>
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1, color: 'var(--warn, #d97706)' }}>
                <path d="M8 1L1 14h14L8 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M8 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="8" cy="12" r="0.6" fill="currentColor"/>
              </svg>
              <span style={{ fontSize: 12, color: 'var(--warn, #d97706)', lineHeight: 1.5 }}>
                <strong>SEO timeline note: </strong>{plan.feasibility_note}
              </span>
            </div>
          )}

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Prism Plan</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>v{plan.version}</span>
            {isSuperseded && (
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--bg-hover)', color: 'var(--text-dim)' }}>
                superseded
              </span>
            )}
            {isApproved && (
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--ok-dim)', color: 'var(--ok)' }}>
                ✓ approved
              </span>
            )}
            {!isSuperseded && !isApproved && (
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--accent-dim, rgba(99,102,241,0.12))', color: 'var(--accent)' }}>
                draft
              </span>
            )}
          </div>

          {/* Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '5px 0', fontSize: 12, marginBottom: 14 }}>
            <KVLabel>intent</KVLabel>
            <KVValue>{plan.intent}</KVValue>

            <KVLabel>domain</KVLabel>
            <KVValue><span className="mono">{plan.domain}</span></KVValue>

            <KVLabel>timeline</KVLabel>
            <KVValue>{plan.timeline_weeks} weeks</KVValue>

            <KVLabel style={{ paddingTop: 4 }}>competitors</KVLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', paddingTop: 2 }}>
              {localCompetitors.map((c, ci) => (
                <span key={ci} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 7px', borderRadius: 4,
                  background: 'var(--bg-hover)', color: 'var(--text)', fontSize: 11,
                }}>
                  <span className="mono">{c}</span>
                  {!isSuperseded && !isApproved && (
                    <button
                      onClick={() => removeCompetitor(ci)}
                      style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0, fontSize: 12 }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {!isSuperseded && !isApproved && (
                addingComp ? (
                  <input
                    autoFocus
                    value={compInput}
                    onChange={(e) => setCompInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitCompetitor();
                      if (e.key === 'Escape') { setAddingComp(false); setCompInput(''); }
                    }}
                    onBlur={commitCompetitor}
                    placeholder="domain.com"
                    style={{
                      fontSize: 11, border: '1px solid var(--accent)', borderRadius: 4,
                      padding: '2px 7px', background: 'var(--bg-hover)', color: 'var(--text)',
                      outline: 'none', width: 110,
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setAddingComp(true)}
                    style={{
                      fontSize: 11, padding: '2px 7px', borderRadius: 4,
                      border: '1px dashed var(--border-strong)', background: 'none',
                      color: 'var(--text-dim)', cursor: 'pointer',
                    }}
                  >
                    + add
                  </button>
                )
              )}
            </div>

            <KVLabel>sprint order</KVLabel>
            <KVValue style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}>
              {plan.sprint_order.join(' → ')}
            </KVValue>
          </div>

          {/* Actions — only shown for draft */}
          {!isSuperseded && !isApproved && (
            <>
              <div style={{ height: 1, background: 'var(--border)', marginBottom: 12 }} />

              {/* Refine collapsible */}
              <div style={{ marginBottom: 10 }}>
                <button
                  onClick={() => setRefineOpen((o) => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 12, color: 'var(--text-mut)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: 0, fontFamily: 'inherit',
                  }}
                >
                  <svg width={11} height={11} viewBox="0 0 16 16" fill="none">
                    <path d="M13 2l1 4-4 1M2 10L1 6l4-1M2 14c1-3 4-5 7-4s4 4 3 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Refine
                  <svg width={10} height={10} viewBox="0 0 16 16" fill="none" style={{ transform: refineOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {refineOpen && (
                  <form onSubmit={handleRefine} style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={2}
                      placeholder="e.g. also include lever.co as a competitor"
                      disabled={refining}
                      style={{
                        fontSize: 12, border: '1px solid var(--border)', borderRadius: 5,
                        padding: '8px 10px', background: 'var(--bg)', color: 'var(--text)',
                        fontFamily: 'inherit', resize: 'none', outline: 'none', width: '100%',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={refining || !feedback.trim()}
                      style={{
                        alignSelf: 'flex-start', fontSize: 12,
                        padding: '5px 12px', borderRadius: 5,
                        border: '1px solid var(--border)', background: 'var(--bg-hover)',
                        color: 'var(--text)', cursor: 'pointer',
                        opacity: refining || !feedback.trim() ? 0.5 : 1,
                        fontFamily: 'inherit',
                      }}
                    >
                      {refining ? 'Re-planning…' : 'Re-plan'}
                    </button>
                  </form>
                )}
              </div>

              {/* Approve button */}
              <button
                onClick={handleApprove}
                disabled={!canApprove}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, fontWeight: 500,
                  padding: '7px 14px', borderRadius: 6,
                  background: canApprove ? 'var(--ok)' : 'var(--bg-hover)',
                  color: canApprove ? '#fff' : 'var(--text-dim)',
                  border: 'none', cursor: canApprove ? 'pointer' : 'default',
                  opacity: approving ? 0.7 : 1,
                  fontFamily: 'inherit', transition: 'opacity 0.15s',
                }}
              >
                <svg width={11} height={11} viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {approving ? 'Starting…' : 'Approve & start research'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KVLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ color: 'var(--text-dim)', fontSize: 11, alignSelf: 'start', paddingTop: 2, ...style }}>
      {children}
    </span>
  );
}

function KVValue({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ color: 'var(--text)', lineHeight: 1.5, ...style }}>
      {children}
    </span>
  );
}
