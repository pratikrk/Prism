'use client';

interface ConfirmCardProps {
  domain: string;
  agentNames: string[];
  onConfirm: () => Promise<void> | void;
  busy: boolean;
}

export function ConfirmCard({ domain, agentNames, onConfirm, busy }: ConfirmCardProps) {
  return (
    <div className="max-w-[80%] border rounded-2xl rounded-tl-sm p-4 space-y-3 text-sm bg-muted/40">
      <p className="font-medium">
        Starting {agentNames.length} research agents for{' '}
        <span className="font-semibold">{domain}</span>
      </p>
      <ul className="text-xs text-muted-foreground space-y-0.5">
        {agentNames.map((name) => (
          <li key={name}>· {name.replace(/_/g, ' ')}</li>
        ))}
      </ul>
      <button
        className="text-xs border rounded px-3 py-1.5 bg-primary text-primary-foreground disabled:opacity-40"
        onClick={onConfirm}
        disabled={busy}
      >
        {busy ? 'Starting…' : 'Start Research'}
      </button>
    </div>
  );
}
