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
    const token = await getToken();
    if (!token) return;
    const w = await createWorkspace(token, { name, domain });
    router.push(`/workspaces/${w.id}`);
  }
  return (
    <form onSubmit={submit} className="space-y-4 max-w-md">
      <h1 className="text-xl font-semibold">New workspace</h1>
      <label className="block">
        <span className="text-sm">Name</span>
        <input className="w-full border rounded p-2 bg-background" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="block">
        <span className="text-sm">Target domain</span>
        <input className="w-full border rounded p-2 bg-background" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="whitecarrot.io" required />
      </label>
      <button type="submit" disabled={submitting} className="px-4 py-2 border rounded">
        {submitting ? 'Creating…' : 'Create'}
      </button>
    </form>
  );
}
