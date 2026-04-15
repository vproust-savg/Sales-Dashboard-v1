// FILE: client/src/hooks/useConsolidated.ts
// PURPOSE: View Consolidated state machine — manages confirmation modal and fetch lifecycle
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useConsolidated, ConsolidatedState, UseConsolidatedReturn

import { useCallback, useRef, useState } from 'react';
import type { Dimension, Period, DashboardPayload, FetchAllFilters } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

export type ConsolidatedState = 'idle' | 'configuring' | 'fetching' | 'loaded' | 'needs-report' | 'error';

export interface UseConsolidatedReturn {
  state: ConsolidatedState;
  entityIds: string[];
  payload: DashboardPayload | null;
  error: string | null;
  open: (entityIds: string[]) => void;
  cancel: () => void;
  /** WHY: Optional filters are passed through so the server can compute the same filterHash
   * that fetch-all used when writing the raw cache. Without this, Consolidated probed
   * 'all' and returned 422 whenever any filter was applied. */
  start: (filters?: FetchAllFilters) => void;
  abort: () => void;
  reset: () => void;
}

export function useConsolidated(dimension: Dimension, period: Period): UseConsolidatedReturn {
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<ConsolidatedState>('idle');
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

  const start = useCallback(async (filters?: FetchAllFilters) => {
    abort();
    setPayload(null);
    setState('fetching');
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const idsParam = entityIds.slice().sort().join(',');
    const params = new URLSearchParams({ entityIds: idsParam, groupBy: dimension, period });
    if (filters?.agentName?.length) params.set('agentName', filters.agentName.join(','));
    if (filters?.zone?.length) params.set('zone', filters.zone.join(','));
    if (filters?.customerType?.length) params.set('customerType', filters.customerType.join(','));

    try {
      const response = await fetch(`/api/sales/dashboard?${params}`, { signal: controller.signal });
      if (response.status === 422) {
        setState('needs-report');
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
