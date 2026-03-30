// FILE: client/src/hooks/useDashboardData.ts
// PURPOSE: TanStack Query hook for fetching dashboard payload from backend
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useDashboardData

import { useQuery } from '@tanstack/react-query';
import type { DashboardPayload, Dimension, Period } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

interface UseDashboardDataOptions {
  groupBy: Dimension;
  period: Period;
}

async function fetchDashboard(
  groupBy: Dimension,
  period: Period,
): Promise<ApiResponse<DashboardPayload>> {
  const params = new URLSearchParams({ groupBy, period });
  const response = await fetch(`/api/sales/dashboard?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: { message: 'Network error' },
    }));
    throw new Error(
      (error as { error?: { message?: string } }).error?.message
        ?? `HTTP ${response.status}`,
    );
  }

  return response.json() as Promise<ApiResponse<DashboardPayload>>;
}

/**
 * Fetches dashboard data with TanStack Query.
 * staleTime: 5 minutes for YTD (changes throughout the day),
 * 24 hours for historical years (data is frozen) — spec Section 6.
 * Query key: ['dashboard', groupBy, period]
 */
export function useDashboardData({ groupBy, period }: UseDashboardDataOptions) {
  return useQuery({
    queryKey: ['dashboard', groupBy, period],
    queryFn: () => fetchDashboard(groupBy, period),
    // WHY: YTD data may update during the workday; historical years never change.
    staleTime: period === 'ytd' ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000,
  });
}
