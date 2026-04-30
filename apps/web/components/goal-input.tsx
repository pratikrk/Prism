'use client';

import { useState } from 'react';

const EXAMPLES = [
  { title: 'Rank #1 for "ATS for startups"',    meta: '6 months · US/UK' },
  { title: '10k org signups from LLM citations', meta: 'ChatGPT · Perplexity' },
  { title: 'Outrank Greenhouse on long-tail',    meta: '200 KWs · 12 wks' },
];

const SparkleIcon = () => (
  <svg width={12} height={12} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M8 1l1.5 5.5L15 8l-5.5 1.5L8 15 6.5 9.5 1 8l5.5-1.5L8 1z"
      stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>
  </svg>
);

const ArrowIcon = () => (
  <svg width={12} height={12} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function GoalInput({ onSubmit, disabled, domain }: {
  onSubmit: (goal: string) => Promise<void>;
  disabled?: boolean;
  domain?: string;
}) {
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim() || busy) return;
    setBusy(true);
    try { await onSubmit(goal); } finally { setBusy(false); }
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!goal.trim() || busy) return;
      setBusy(true);
      try { await onSubmit(goal); } finally { setBusy(false); }
    }
  }

  const isSubmitting = busy;
  const isDisabled = disabled || busy;

  return (
    <form onSubmit={submit} style={{ width: '100%', maxWidth: 620 }}>
      {/* Prompt box */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-strong)',
        borderRadius: 10,
        padding: '14px 14px 10px',
        boxShadow: '0 0 0 3px var(--accent-dim), 0 20px 50px rgba(0,0,0,0.25)',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 11, color: 'var(--text-dim)' }}>
          <SparkleIcon />
          <span className="mono" style={{ color: 'var(--text-mut)' }}>goal.describe()</span>
          <div style={{ flex: 1 }} />
          <span className="mono" style={{ fontSize: 10 }}>{goal.length} ch</span>
        </div>

        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          data-testid="goal-textarea"
          placeholder="e.g. 50k signups in 6 months vs Greenhouse…"
          style={{
            width: '100%', minHeight: 92, resize: 'none',
            border: 'none', outline: 'none', background: 'transparent',
            color: 'var(--text)', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.55,
            letterSpacing: -0.1,
            opacity: isDisabled ? 0.6 : 1,
          }}
        />

        {/* Footer row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 4,
        }}>
          {domain && (
            <span className="mono" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 4,
              background: 'var(--bg-hover)', color: 'var(--text-mut)', fontSize: 11,
            }}>@{domain}</span>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-dim)', fontSize: 10 }} className="mono">
            <span>⌘</span><span>↵</span>
          </div>
          <button
            type="submit"
            disabled={isDisabled || !goal.trim()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '7px 13px', borderRadius: 6,
              border: '1px solid var(--accent)',
              background: isDisabled || !goal.trim() ? 'transparent' : 'var(--accent)',
              color: isDisabled || !goal.trim() ? 'var(--accent)' : '#fff',
              fontSize: 12, fontWeight: 500, cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s',
            }}
          >
            {isSubmitting ? 'Planning…' : disabled ? 'Job in flight' : 'Plan sprint'}
            {!isSubmitting && <ArrowIcon />}
          </button>
        </div>
      </div>

      {/* Suggestion chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16, justifyContent: 'center' }}>
        <div style={{
          fontSize: 10, color: 'var(--text-dim)', letterSpacing: 0.8,
          textTransform: 'uppercase', marginRight: 4, alignSelf: 'center',
        }}>Try:</div>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.title}
            type="button"
            onClick={() => setGoal(ex.title + ' · ' + ex.meta)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6,
              background: 'var(--bg-card)', cursor: 'pointer', fontSize: 11,
              color: 'var(--text-mut)', fontFamily: 'inherit',
            }}
          >
            <span style={{ color: 'var(--text)' }}>{ex.title}</span>
            <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 10 }}>{ex.meta}</span>
          </button>
        ))}
      </div>
    </form>
  );
}
