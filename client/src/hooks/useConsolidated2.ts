// FILE: client/src/hooks/useConsolidated2.ts
// PURPOSE: View Consolidated 2 state machine — manages confirmation modal and fetch lifecycle
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useConsolidated2, Consolidated2State, UseConsolidated2Return

import { useCallback, useRef, useState } from 'react';
import type { Dimension, Period, DashboardPayload } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

export type Consolidated2State = 'idle' | 'configuring' | 'fetching' | 'loaded' | 'needs-report-2' | 'error';

export interface UseConsolidated2Return {
  state: Consolidated2State;
  entityIds: string[];
  payload: DashboardPayload | null;
  error: string | null;
  open: (entityIds: string[]) => void;
  cancel: () => void;
  start: () => void;
  abort: () => void;
  reset: () => void;
}

export function useConsolidated2(dimension: Dimension, period: Period): UseConsolidated2Return {
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<Consolidated2State>('idle');
  const [entityIds, setEntityIds] = useState<string[]>([]);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((ids: string[]) => {
    setEntityIds(ids);
    setState('configuring');
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    abort();
    setState('idle');
    setEntityIds([]);
    setPayload(null);
    setError(null);
  }, [abort]);

  const start = useCallback(async () => {
    abort();
    setState('fetching');
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const idsParam = entityIds.slice().sort().join(',');
    const params = new URLSearchParams({ entityIds: idsParam, groupBy: dimension, period });

    try {
      const response = await fetch(`/api/sales/dashboard?${params}`, { signal: controller.signal });
      if (response.status === 422) {
        setState('needs-report-2');
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
        setError((body as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`);
        setState('error');
        return;
      }
      const result = await response.json() as ApiResponse<DashboardPayload>;
      setPayload(result.data);
      setState('loaded');
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Network error');
      setState('error');
    } finally {
      abortRef.current = null;
    }
  }, [entityIds, dimension, period, abort]);

  return { state, entityIds, payload, error, open, cancel, start, abort, reset };
}
