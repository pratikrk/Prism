'use client';

import { useState } from 'react';

const EXAMPLES = [
  '50k organic signups/mo on whitecarrot.io in 6 months vs greenhouse and ashby',
  'Rank #1 for "vector database" in 12 weeks; competitors pinecone, weaviate',
  'Get 500 qualified leads/mo from organic in Q3; compete with linear.app and height.app',
];

export function GoalInput({ onSubmit, disabled }: {
  onSubmit: (goal: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim() || busy) return;
    setBusy(true);
    try { await onSubmit(goal); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <textarea
        className="w-full border rounded p-3 bg-background min-h-24"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="Describe your traffic goal…"
        disabled={disabled || busy}
        data-testid="goal-textarea"
      />
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="text-xs border rounded-full px-3 py-1"
            onClick={() => setGoal(ex)}
          >
            {ex.slice(0, 40)}…
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={disabled || busy || !goal.trim()}
        className="px-4 py-2 border rounded"
      >
        {busy ? 'Submitting…' : disabled ? 'Job in flight' : 'Submit goal'}
      </button>
    </form>
  );
}
