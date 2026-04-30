'use client';

import { useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { getThread, submitJob } from '@/lib/api';
import { ConversationThread } from '@/components/conversation-thread';
import { GoalInput } from '@/components/goal-input';

function useToken() {
  const { getToken } = useAuth();
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    getToken().then(setT);
    const id = setInterval(() => getToken().then(setT), 60_000);
    return () => clearInterval(id);
  }, [getToken]);
  return t;
}

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const token = useToken();

  const swrKey = token ? `thread:${id}` : null;
  const { data: items = [], mutate } = useSWR(
    swrKey,
    () => getThread(token!, id),
    { refreshInterval: 5000 },
  );

  async function handleSubmit(goal: string) {
    const tok = await getToken();
    if (!tok) return;
    await submitJob(tok, id, { goal });
    mutate();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <ConversationThread
        items={items}
        token={token ?? ''}
        workspaceId={id}
        onRefetch={() => mutate()}
      />
      <div className="border-t pt-4 mt-4">
        <GoalInput onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
