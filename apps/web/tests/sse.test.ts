import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useJobEvents } from '@/lib/sse';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeEventSource.instances.push(this); }
  close() {}
  emit(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent); }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  (global as any).EventSource = FakeEventSource;
});

describe('useJobEvents', () => {
  it('accumulates events as they arrive', async () => {
    const { result } = renderHook(() => useJobEvents('j1', 'tok'));
    await waitFor(() => expect(FakeEventSource.instances.length).toBe(1));
    act(() => {
      FakeEventSource.instances[0].emit({
        job_id: 'j1', parent_job_id: null, workspace_id: 'w1',
        type: 'orchestrator', status: 'running', at: '2026-04-22T00:00:00Z', error: null,
      });
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].status).toBe('running');
  });
});
