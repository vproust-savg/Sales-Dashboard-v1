// FILE: client/src/hooks/useReport.ts
// PURPOSE: Report state machine — manages filter modal, SSE connection, progress, and loaded payload
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useReport, ReportState, UseReportReturn

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  Dimension, Period, DashboardPayload, FetchAllFilters, SSEProgressEvent,
} from '@shared/types/dashboard';
import { buildReportUrl } from './build-report-url';
import { parseSSEProgressEvent, parseSSEErrorEvent } from './sse-event-parser';

export type ReportState = 'idle' | 'configuring' | 'fetching' | 'loaded' | 'error';

export interface UseReportReturn {
  state: ReportState;
  progress: SSEProgressEvent | null;
  payload: DashboardPayload | null;
  error: string | null;
  filters: FetchAllFilters;
  open: () => void;
  cancel: () => void;
  /** WHY: forceRefresh is optional for backward compatibility; defaults to false. */
  startReport: (filters: FetchAllFilters, forceRefresh?: boolean) => void;
  abort: () => void;
  reset: () => void;
  /** Cancel an in-flight fetch and return to idle. Distinct from cancel() which is wired for the filter modal. */
  cancelFetch: () => void;
  /** Re-run the last startReport call with its original arguments (preserves forceRefresh). */
  retry: () => void;
}

const EMPTY_FILTERS: FetchAllFilters = {};

export function useReport(dimension: Dimension, period: Period): UseReportReturn {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [state, setState] = useState<ReportState>('idle');
  const [progress, setProgress] = useState<SSEProgressEvent | null>(null);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FetchAllFilters>(EMPTY_FILTERS);

  // WHY: Capture the full last-request shape in a ref so retry() reproduces the exact failed request.
  // Refs (not state) avoid a re-render on every startReport — the value is consumed only inside retry.
  const lastRequestRef = useRef<{ filters: FetchAllFilters; forceRefresh: boolean } | null>(null);

  // WHY: Monotonically increasing request token. Every SSE listener captures the current value
  // and aborts if the ref has moved on — prevents stale EventSource events from mutating state
  // belonging to a newer request (the retry-race Codex Finding #2 flagged).
  const requestIdRef = useRef(0);

  const open = useCallback(() => {
    setState('configuring');
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  const abort = useCallback(() => {
    // WHY: Bump requestIdRef BEFORE closing the EventSource so any pending listener on the
    // outgoing source sees isStale() === true. Without this bump, the fence would hold only
    // via the secondary `eventSourceRef.current !== es` check — consistent with cancelFetch()
    // and startReport() which also bump first. Keeps every fence entry point watertight.
    requestIdRef.current++;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setProgress(null);
  }, []);

  const reset = useCallback(() => {
    abort();
    setState('idle');
    setPayload(null);
    setProgress(null);
    setError(null);
    setFilters(EMPTY_FILTERS);
  }, [abort]);

  const startReport = useCallback((newFilters: FetchAllFilters, forceRefresh = false) => {
    lastRequestRef.current = { filters: newFilters, forceRefresh };

    // WHY: Bump the request token BEFORE closing the old EventSource. Any listener that fires
    // between now and `es` being assigned below will see a higher requestIdRef and short-circuit.
    const currentRequestId = ++requestIdRef.current;

    // Close any prior EventSource (this also causes its pending listeners to fire 'error' —
    // those are fenced by isStale() below).
    eventSourceRef.current?.close();

    setFilters(newFilters);
    setPayload(null);
    setState('fetching');
    setError(null);
    setProgress(null);

    const es = new EventSource(buildReportUrl(dimension, period, newFilters, forceRefresh));
    eventSourceRef.current = es;

    // WHY: Both checks are required. requestIdRef guards against the entire request being
    // superseded (retry, cancel, etc.). eventSourceRef identity guards against the specific
    // case where the ref has been re-nulled (e.g., after a completed fetch) but an old
    // listener on a now-unreferenced `es` still fires.
    const isStale = () => currentRequestId !== requestIdRef.current || eventSourceRef.current !== es;

    es.addEventListener('progress', (e) => {
      if (isStale()) return;
      const parsed = parseSSEProgressEvent(e as MessageEvent);
      if (parsed) setProgress(parsed);
    });

    es.addEventListener('complete', (e) => {
      if (isStale()) return;
      const data = JSON.parse((e as MessageEvent).data) as DashboardPayload;
      setPayload(data);
      setProgress(null);
      setState('loaded');
      es.close();
      eventSourceRef.current = null;

      // WHY: Invalidate cache-status so Report button reflects new cache state
      queryClient.invalidateQueries({ queryKey: ['cache-status', period] });
      queryClient.invalidateQueries({ queryKey: ['entities', dimension, period] });
    });

    es.addEventListener('error', (e) => {
      if (isStale()) return;
      setError(parseSSEErrorEvent(e));
      setState('error');
      setProgress(null);
      es.close();
      eventSourceRef.current = null;
    });
  }, [dimension, period, queryClient]);

  const cancelFetch = useCallback(() => {
    // WHY: Bump the request token first so any pending listener on the outgoing EventSource
    // sees isStale() === true and short-circuits.
    requestIdRef.current++;
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setState('idle');
    setProgress(null);
    setError(null);
  }, []);

  const retry = useCallback(() => {
    const last = lastRequestRef.current;
    // WHY: No-op when there's no prior request to retry — defensive for UIs that call retry
    // outside the error-modal flow.
    if (!last) return;
    // startReport bumps requestIdRef and re-opens EventSource. Any error event still in the
    // task queue from the prior es fails isStale() inside its listener.
    startReport(last.filters, last.forceRefresh);
  }, [startReport]);

  return { state, progress, payload, error, filters, open, cancel, startReport, abort, reset, cancelFetch, retry };
}
