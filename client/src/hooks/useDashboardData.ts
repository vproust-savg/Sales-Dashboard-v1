// FILE: client/src/hooks/useDashboardData.ts
// PURPOSE: TanStack Query hooks for two-stage dashboard loading
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useEntities, useDashboardDetail, useConsolidatedDashboard

import { useQuery } from '@tanstack/react-query';
import type { DashboardPayload, EntityListItem, Dimension, Period } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

// --- Stage 1: Lightweight entity list for left panel ---

interface EntitiesPayload {
  entities: EntityListItem[];
  yearsAvailable: string[];
}

async function fetchEntities(
  groupBy: Dimension,
  period: Period,
): Promise<ApiResponse<EntitiesPayload>> {
  const params = new URLSearchParams({ groupBy, period });
  const response = await fetch(`/api/sales/entities?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Network error' } }));
    throw new Error(
      (error as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`,
    );
  }

  return response.json() as Promise<ApiResponse<EntitiesPayload>>;
}

export function useEntities({ groupBy, period }: { groupBy: Dimension; period: Period }) {
  return useQuery({
    queryKey: ['entities', groupBy, period],
    queryFn: () => fetchEntities(groupBy, period),
    staleTime: 5 * 60 * 1000, // 5 minutes — matches server cache TTL
  });
}

// --- Stage 2: Full detail for a selected entity ---

async function fetchDashboard(
  entityId: string,
  groupBy: Dimension,
  period: Period,
): Promise<ApiResponse<DashboardPayload>> {
  const params = new URLSearchParams({ groupBy, period, entityId });
  const response = await fetch(`/api/sales/dashboard?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Network error' } }));
    throw new Error(
      (error as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`,
    );
  }

  return response.json() as Promise<ApiResponse<DashboardPayload>>;
}

/**
 * Fetches detail dashboard data for a single entity.
 * Only fires when entityId is provided (enabled flag).
 * staleTime: 5 min YTD, 24 hr historical — spec Section 6.
 */
export function useDashboardDetail({
  entityId,
  groupBy,
  period,
}: {
  entityId: string | null;
  groupBy: Dimension;
  period: Period;
}) {
  return useQuery({
    queryKey: ['dashboard', entityId, groupBy, period],
    queryFn: () => fetchDashboard(entityId!, groupBy, period),
    // WHY: Only fetch when an entity is selected
    enabled: entityId !== null && entityId !== '__ALL__',
    staleTime: period === 'ytd' ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000,
  });
}

// --- Stage 3: Consolidated data for multi-select ---

async function fetchConsolidatedDashboard(
  entityIds: string[],
  groupBy: Dimension,
  period: Period,
): Promise<ApiResponse<DashboardPayload>> {
  // WHY: Sort IDs so the URL is stable regardless of selection order.
  const idsParam = entityIds.slice().sort().join(',');
  const params = new URLSearchParams({ entityIds: idsParam, groupBy, period });
  const response = await fetch(`/api/sales/dashboard?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Network error' } }));
    throw new Error(
      (error as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`,
    );
  }

  return response.json() as Promise<ApiResponse<DashboardPayload>>;
}

/** Stage 3: Consolidated data for multi-select — fetches /dashboard with entityIds param.
 * WHY: "View Consolidated" needs a real multi-entity payload, not single-entity data
 * with client-side aggregation. The server already supports entityIds. */
export function useConsolidatedDashboard(params: {
  entityIds: string[];
  groupBy: Dimension;
  period: Period;
  enabled: boolean;
}) {
  // WHY: Sort IDs so the query key is stable regardless of selection order.
  const idsParam = params.entityIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['dashboard', 'consolidated', idsParam, params.groupBy, params.period],
    queryFn: () => fetchConsolidatedDashboard(params.entityIds, params.groupBy, params.period),
    enabled: params.enabled && params.entityIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
