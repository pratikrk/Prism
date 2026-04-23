import type { Job, Workspace } from '@prism/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function fetchWithAuth(path: string, init: RequestInit, token: string): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  });
  if (res.status >= 500) {
    const retry = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
    });
    if (!retry.ok) throw new ApiError(retry.status, await retry.text());
    return retry;
  }
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res;
}

export async function createWorkspace(
  token: string, body: { name: string; domain: string },
): Promise<Workspace> {
  const res = await fetchWithAuth('/workspaces', { method: 'POST', body: JSON.stringify(body) }, token);
  return res.json();
}

export async function listWorkspaces(token: string): Promise<Workspace[]> {
  return (await fetchWithAuth('/workspaces', { method: 'GET' }, token)).json();
}

export async function submitJob(
  token: string, workspaceId: string, body: { goal: string },
): Promise<Job> {
  const res = await fetchWithAuth(
    `/workspaces/${workspaceId}/jobs`,
    { method: 'POST', body: JSON.stringify(body) },
    token,
  );
  return res.json();
}

export async function listWorkspaceJobs(token: string, workspaceId: string): Promise<Job[]> {
  return (await fetchWithAuth(`/workspaces/${workspaceId}/jobs`, { method: 'GET' }, token)).json();
}

export async function retryJob(token: string, jobId: string): Promise<Job> {
  return (await fetchWithAuth(`/jobs/${jobId}/retry`, { method: 'POST' }, token)).json();
}
