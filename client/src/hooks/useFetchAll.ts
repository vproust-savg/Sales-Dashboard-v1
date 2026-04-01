// FILE: client/src/hooks/useFetchAll.ts
// PURPOSE: Manages EventSource lifecycle, per-dimension load state, and progress tracking
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useFetchAll

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  Dimension, Period, DashboardPayload, FetchAllFilters,
  EntityListLoadState, SSEProgressEvent,
} from '@shared/types/dashboard';

interface FetchAllReturn {
  loadState: EntityListLoadState;
  progress: SSEProgressEvent | null;
  allDashboard: DashboardPayload | null;
  error: string | null;
  startFetchAll: (filters: FetchAllFilters, forceRefresh?: boolean) => void;
  abortFetch: () => void;
}

export function useFetchAll(dimension: Dimension, period: Period): FetchAllReturn {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  // WHY: Map keyed by `${dimension}:${period}` preserves state across dimension switches
  const [loadStateMap, setLoadStateMap] = useState<Map<string, EntityListLoadState>>(new Map());
  const [allDashboardMap, setAllDashboardMap] = useState<Map<string, DashboardPayload>>(new Map());
  const [progress, setProgress] = useState<SSEProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stateKey = `${dimension}:${period}`;
  const loadState = loadStateMap.get(stateKey) ?? 'not-loaded';
  const allDashboard = allDashboardMap.get(stateKey) ?? null;

  const abortFetch = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setProgress(null);
  }, []);

  const startFetchAll = useCallback((filters: FetchAllFilters, forceRefresh = false) => {
    abortFetch();
    setError(null);

    setLoadStateMap(prev => new Map(prev).set(stateKey, 'loading'));

    const params = new URLSearchParams({ groupBy: dimension, period });
    if (filters.agentName) params.set('agentName', filters.agentName);
    if (filters.zone) params.set('zone', filters.zone);
    if (filters.customerType) params.set('customerType', filters.customerType);
    if (forceRefresh) params.set('refresh', 'true');

    const es = new EventSource(`/api/sales/fetch-all?${params}`);
    eventSourceRef.current = es;

    es.addEventListener('progress', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as SSEProgressEvent;
      setProgress(data);
    });

    es.addEventListener('complete', (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as DashboardPayload;
      setLoadStateMap(prev => new Map(prev).set(stateKey, 'loaded'));
      setAllDashboardMap(prev => new Map(prev).set(stateKey, payload));
      setProgress(null);
      es.close();
      eventSourceRef.current = null;

      // WHY: Invalidate entity list query so it refetches — now returns enriched data from cache
      queryClient.invalidateQueries({ queryKey: ['entities', dimension, period] });
    });

    es.addEventListener('error', (e) => {
      const data = e instanceof MessageEvent ? JSON.parse(e.data) : null;
      setError(data?.message ?? 'Connection lost');
      setLoadStateMap(prev => new Map(prev).set(stateKey, 'error'));
      setProgress(null);
      es.close();
      eventSourceRef.current = null;
    });
  }, [dimension, period, stateKey, abortFetch, queryClient]);

  return { loadState, progress, allDashboard, error, startFetchAll, abortFetch };
}
