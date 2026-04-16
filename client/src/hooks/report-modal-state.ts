// FILE: client/src/hooks/report-modal-state.ts
// PURPOSE: Pure mapping from useReport state to ReportProgressModal props.
//   Single source of truth for when the modal is visible and what mode it shows in.
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: computeReportModalState, ReportModalState

import type { UseReportReturn } from './useReport';

export interface ReportModalState {
  isOpen: boolean;
  mode: 'fetching' | 'error' | null;
  errorMessage: string | null;
}

export function computeReportModalState(report: UseReportReturn): ReportModalState {
  if (report.state === 'fetching') return { isOpen: true, mode: 'fetching', errorMessage: null };
  if (report.state === 'error')    return { isOpen: true, mode: 'error', errorMessage: report.error };
  return { isOpen: false, mode: null, errorMessage: null };
}
