'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@clerk/nextjs';
import { listWorkspaces } from '@/lib/api';

export default function WorkspacesPage() {
  const { getToken } = useAuth();
  const { data, isLoading } = useSWR('workspaces', async () => {
    const token = await getToken();
    if (!token) return [];
    return listWorkspaces(token);
  });
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Workspaces</h1>
        <Link href="/workspaces/new" className="px-3 py-1 border rounded">New workspace</Link>
      </div>
      {isLoading ? <p>Loading…</p> : (
        <ul className="space-y-2">
          {data?.map((w) => (
            <li key={w.id}>
              <Link href={`/workspaces/${w.id}`} className="underline">{w.name}</Link>
              <span className="text-muted-foreground text-sm ml-2">{w.domain}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
