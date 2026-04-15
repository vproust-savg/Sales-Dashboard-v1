// FILE: client/src/hooks/useCacheStatus.ts
// PURPOSE: Query /api/sales/cache-status to detect server-cached data on mount (iframe reload resilience)
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useCacheStatus

import { useQuery } from '@tanstack/react-query';
import type { Period, CacheStatus } from '@shared/types/dashboard';

async function fetchCacheStatus(period: Period): Promise<CacheStatus> {
  const params = new URLSearchParams({ period });
  const response = await fetch(`/api/sales/cache-status?${params}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<CacheStatus>;
}

/** WHY: On Airtable iframe reload, React state is lost but Redis cache persists. This hook
 * tells Report if it should show "Data ready" state instead of "Not loaded" on mount. */
export function useCacheStatus(period: Period) {
  return useQuery({
    queryKey: ['cache-status', period],
    queryFn: () => fetchCacheStatus(period),
    // WHY: 60s staleTime — checking more frequently would waste network; less often would miss fresh data
    staleTime: 60_000,
    // WHY: retry once — endpoint is Redis-only so failure usually means backend is down
    retry: 1,
  });
}
