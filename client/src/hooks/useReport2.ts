// FILE: client/src/hooks/useReport2.ts
// PURPOSE: Report 2 state machine — manages filter modal, SSE connection, progress, and loaded payload
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useReport2, Report2State, UseReport2Return

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  Dimension, Period, DashboardPayload, FetchAllFilters, SSEProgressEvent,
} from '@shared/types/dashboard';

export type Report2State = 'idle' | 'configuring' | 'fetching' | 'loaded' | 'error';

export interface UseReport2Return {
  state: Report2State;
  progress: SSEProgressEvent | null;
  payload: DashboardPayload | null;
  error: string | null;
  filters: FetchAllFilters;
  open: () => void;
  cancel: () => void;
  startReport: (filters: FetchAllFilters) => void;
  abort: () => void;
  reset: () => void;
}

const EMPTY_FILTERS: FetchAllFilters = {};

export function useReport2(dimension: Dimension, period: Period): UseReport2Return {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [state, setState] = useState<Report2State>('idle');
  const [progress, setProgress] = useState<SSEProgressEvent | null>(null);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FetchAllFilters>(EMPTY_FILTERS);

  const open = useCallback(() => {
    setState('configuring');
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  const abort = useCallback(() => {
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

  const startReport = useCallback((newFilters: FetchAllFilters) => {
    abort();
    setFilters(newFilters);
    // WHY: Without clearing payload, if the second fetch hits the same cache (e.g., user
    // re-ran the same filter by accident), the UI renders identical data and looks "stuck"
    // on the first report. Clearing first forces the placeholder / progress modal to show.
    setPayload(null);
    setState('fetching');
    setError(null);
    setProgress(null);

    const params = new URLSearchParams({ groupBy: dimension, period });
    if (newFilters.agentName?.length) params.set('agentName', newFilters.agentName.join(','));
    if (newFilters.zone?.length) params.set('zone', newFilters.zone.join(','));
    if (newFilters.customerType?.length) params.set('customerType', newFilters.customerType.join(','));

    const es = new EventSource(`/api/sales/fetch-all?${params}`);
    eventSourceRef.current = es;

    es.addEventListener('progress', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as SSEProgressEvent;
      setProgress(data);
    });

    es.addEventListener('complete', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as DashboardPayload;
      setPayload(data);
      setProgress(null);
      setState('loaded');
      es.close();
      eventSourceRef.current = null;

      // WHY: Invalidate cache-status so Report 2 button reflects new cache state
      queryClient.invalidateQueries({ queryKey: ['cache-status', period] });
      queryClient.invalidateQueries({ queryKey: ['entities', dimension, period] });
    });

    es.addEventListener('error', (e) => {
      const data = e instanceof MessageEvent && e.data ? JSON.parse(e.data) : null;
      setError((data as { message?: string } | null)?.message ?? 'Connection lost');
      setState('error');
      setProgress(null);
      es.close();
      eventSourceRef.current = null;
    });
  }, [dimension, period, abort, queryClient]);

  return { state, progress, payload, error, filters, open, cancel, startReport, abort, reset };
}
