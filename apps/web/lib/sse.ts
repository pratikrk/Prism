'use client';

import type { AgentStatusEvent } from '@prism/types';
import { useEffect, useRef, useState } from 'react';

export function useJobEvents(jobId: string | null, token: string | null) {
  const [events, setEvents] = useState<AgentStatusEvent[]>([]);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId || !token) return;
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
    const url = `${base}/jobs/${jobId}/events?t=${encodeURIComponent(token)}`;
    const src = new EventSource(url);
    sourceRef.current = src;
    src.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as AgentStatusEvent;
        setEvents((prev) => [...prev, event]);
      } catch {
        // ignore malformed frames
      }
    };
    src.onerror = () => {
      // EventSource auto-reconnects; no-op.
    };
    return () => { src.close(); sourceRef.current = null; };
  }, [jobId, token]);

  return events;
}
