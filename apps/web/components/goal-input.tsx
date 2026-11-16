'use client';

import { useState } from 'react';

export function ChatInput({ onSubmit, disabled, domain }: {
  onSubmit: (message: string) => Promise<void>;
  disabled?: boolean;
  domain?: string;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function doSubmit() {
    if (!message.trim() || busy || disabled) return;
    setBusy(true);
    try {
      await onSubmit(message);
      setMessage('');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doSubmit();
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      await doSubmit();
    }
  }

  const isDisabled = disabled || busy;
  const canSubmit = !isDisabled && message.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 680 }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-strong, var(--border))',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          data-testid="goal-textarea"
          placeholder="Ask anything — audit my site, keyword gaps, I want 10k visitors/month…"
          rows={3}
          style={{
            width: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: 15,
            lineHeight: 1.6,
            letterSpacing: -0.1,
            padding: '16px 18px 12px',
            opacity: isDisabled ? 0.55 : 1,
          }}
        />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px 12px',
          borderTop: '1px solid var(--border)',
        }}>
          {domain && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 6,
              background: 'var(--bg-hover, rgba(255,255,255,0.05))',
              border: '1px solid var(--border)',
              color: 'var(--text-mut)',
              fontSize: 11,
              fontFamily: 'var(--font-mono, monospace)',
              flexShrink: 0,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
              {domain}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10, color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono, monospace)', marginRight: 4,
          }}>
            <span>⌘</span><span>↵</span>
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: canSubmit ? 'var(--accent)' : 'var(--bg-hover, rgba(255,255,255,0.06))',
              color: canSubmit ? '#fff' : 'var(--text-dim)',
              fontSize: 13, fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s',
              letterSpacing: -0.1,
            }}
          >
            {busy ? 'Sending…' : disabled ? 'In progress' : 'Send'}
            {!busy && (
              <svg width={13} height={13} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: 'var(--text-dim)', letterSpacing: 0.1 }}>
        Powered by Claude · DataForSEO · seo-technical · seo-content · seo-geo
      </div>
    </form>
  );
}

// Keep GoalInput as a re-export for backward compat with any imports
export { ChatInput as GoalInput };
