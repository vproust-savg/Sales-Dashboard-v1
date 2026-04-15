// FILE: client/src/hooks/build-report-url.ts
// PURPOSE: Build the SSE URL for /api/sales/fetch-all — pure function, testable without React
// USED BY: client/src/hooks/useReport.ts
// EXPORTS: buildReportUrl

import type { Dimension, Period, FetchAllFilters } from '@shared/types/dashboard';

/**
 * Build the EventSource URL for a Report run.
 * WHY: Extracted from useReport so the URL contract (query param names, forceRefresh
 * passthrough) can be unit-tested without a React Testing Library render harness.
 */
export function buildReportUrl(
  dimension: Dimension,
  period: Period,
  filters: FetchAllFilters,
  forceRefresh = false,
): string {
  const params = new URLSearchParams({ groupBy: dimension, period });
  if (filters.agentName?.length) params.set('agentName', filters.agentName.join(','));
  if (filters.zone?.length) params.set('zone', filters.zone.join(','));
  if (filters.customerType?.length) params.set('customerType', filters.customerType.join(','));
  if (forceRefresh) params.set('refresh', 'true');
  return `/api/sales/fetch-all?${params}`;
}
