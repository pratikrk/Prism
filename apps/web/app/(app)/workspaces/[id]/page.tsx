'use client';

import { useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { listWorkspaceJobs, retryJob, submitJob } from '@/lib/api';
import { useJobEvents } from '@/lib/sse';
import { GoalInput } from '@/components/goal-input';
import { JobBoard } from '@/components/job-board';

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

  const swrKey = `jobs:${id}`;
  const { data: jobs = [] } = useSWR(swrKey, async () => {
    const tok = await getToken();
    if (!tok) return [];
    return listWorkspaceJobs(tok, id);
  }, { refreshInterval: 4000 });

  const rootJob = useMemo(
    () => jobs.find((j) => j.type === 'orchestrator' &&
      (j.status === 'pending' || j.status === 'running')) ??
      jobs.find((j) => j.type === 'orchestrator'),
    [jobs],
  );

  const events = useJobEvents(rootJob?.id ?? null, token);

  async function handleSubmit(goal: string) {
    const tok = await getToken();
    if (!tok) return;
    await submitJob(tok, id, { goal });
    mutate(swrKey);
  }

  async function handleRetry(jobId: string) {
    const tok = await getToken();
    if (!tok) return;
    await retryJob(tok, jobId);
    mutate(swrKey);
  }

  const inFlight = !!rootJob && (rootJob.status === 'pending' || rootJob.status === 'running');
  return (
    <div className="space-y-6">
      <GoalInput onSubmit={handleSubmit} disabled={inFlight} />
      <JobBoard initialJobs={jobs} events={events} onRetry={handleRetry} />
    </div>
  );
}
