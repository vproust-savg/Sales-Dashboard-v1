// FILE: client/src/hooks/derive-consolidated-contact-ids.ts
// PURPOSE: Decide which entity IDs (if any) feed useConsolidatedContacts.
//   Only the View Consolidated path should populate this list — regular Report runs
//   leave filters.entityIds undefined and must return [] so the contacts query stays
//   disabled. Without this gate, a regular Report over 1876 customers fans out to 1876
//   parallel Priority fetchContacts calls and returns a 500.
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: deriveConsolidatedContactIds

import type { DashboardPayload, FetchAllFilters } from '@shared/types/dashboard';
import type { ReportState } from './useReport';

export function deriveConsolidatedContactIds(report: {
  state: ReportState;
  payload: DashboardPayload | null;
  filters: FetchAllFilters;
}): string[] {
  if (report.state !== 'loaded' || !report.payload) return [];
  return report.filters.entityIds ?? [];
}
