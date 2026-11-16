'use client';

import { useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { getThread, sendChatMessage, listWorkspaces } from '@/lib/api';
import { ConversationThread } from '@/components/conversation-thread';
import { ChatInput } from '@/components/goal-input';
import type { ThreadItem } from '@prism/types';

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

function hasActiveJob(items: ThreadItem[]) {
  return items.some(
    (i) =>
      (i.type === 'goal' && i.job_status === 'running') ||
      (i.type === 'jobs' &&
        i.sprint_status !== 'complete' &&
        i.sprint_status !== 'complete_with_errors' &&
        i.sprint_status !== 'failed'),
  );
}

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const token = useToken();
  const [pendingGoal, setPendingGoal] = useState<string | null>(null);

  const { data: workspaces = [] } = useSWR(
    token ? 'workspaces' : null,
    () => listWorkspaces(token!),
  );
  const domain = workspaces.find((w) => w.id === id)?.domain;

  const swrKey = token ? `thread:${id}` : null;
  const { data: items = [], mutate } = useSWR(
    swrKey,
    () => getThread(token!, id),
    {
      // Poll fast while a job is in flight, slow otherwise
      refreshInterval: (data) =>
        !data || hasActiveJob(data) || pendingGoal || data.length === 0 ? 1500 : 8000,
    },
  );

  // Clear pending goal once the real goal item appears in the thread
  useEffect(() => {
    if (pendingGoal && items.some((i) => i.type === 'goal')) {
      setPendingGoal(null);
    }
  }, [items, pendingGoal]);

  async function handleSubmit(message: string) {
    const tok = await getToken();
    if (!tok) return;
    setPendingGoal(message);
    const resp = await sendChatMessage(tok, id, message);
    // Only keep pendingGoal (which shows the thinking bubble) for goal_setting —
    // that's the only intent that creates a job and produces a 'goal' thread item.
    // For audit / question / unknown, clear immediately so the UI doesn't hang.
    if (resp.intent !== 'goal_setting') {
      setPendingGoal(null);
    }
    mutate();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 0', display: 'flex', flexDirection: 'column' }}>
        <ConversationThread
          items={items}
          token={token ?? ''}
          workspaceId={id}
          pendingGoal={pendingGoal}
          onRefetch={() => mutate()}
        />
      </div>

      {/* Goal input pinned at bottom */}
      <div style={{
        padding: '16px 24px 20px',
        background: 'var(--bg)',
        display: 'flex', justifyContent: 'center',
      }}>
        <ChatInput onSubmit={handleSubmit} domain={domain} />
      </div>
    </div>
  );
}
