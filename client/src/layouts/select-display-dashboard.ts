// FILE: client/src/layouts/select-display-dashboard.ts
// PURPOSE: Pure function — decides which dashboard payload the right panel renders
// USED BY: DashboardLayout.tsx
// EXPORTS: selectDisplayDashboard

import type { DashboardPayload } from '@shared/types/dashboard';

interface SelectDisplayDashboardArgs {
  isConsolidated: boolean;
  activeEntityId: string | null;
  allDashboard: DashboardPayload | null;
  dashboard: DashboardPayload | null;
}

/**
 * WHY: Two independent display-selection systems must be reconciled:
 *   1. isConsolidated=true  → show finalDashboard (the consolidated selection)
 *   2. activeEntityId=__ALL__ → show allDashboard (the full load-all data)
 * Consolidated mode must win — otherwise View Consolidated appears to do nothing.
 */
export function selectDisplayDashboard({
  isConsolidated,
  activeEntityId,
  allDashboard,
  dashboard,
}: SelectDisplayDashboardArgs): DashboardPayload | null {
  if (!isConsolidated && activeEntityId === '__ALL__' && allDashboard) {
    return allDashboard;
  }
  return dashboard;
}
