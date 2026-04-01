// FILE: client/src/utils/aggregation.ts
// PURPOSE: Aggregate KPIs + data across multiple selected entities for consolidated view
// USED BY: client/src/hooks/useDashboardState.ts (when isConsolidated=true)
// EXPORTS: aggregateForConsolidated

import type { DashboardPayload } from '@shared/types/dashboard';

/**
 * Spec Section 10.5: Consolidated aggregation rules.
 * CRITICAL: avgOrder = totalRevenue / totalOrders (weighted average),
 * NOT a simple average of per-entity averages.
 */
export function aggregateForConsolidated(
  fullData: DashboardPayload,
  selectedIds: string[],
): Partial<DashboardPayload> {
  const selectedSet = new Set(selectedIds);
  const filteredEntities = fullData.entities.filter(e => selectedSet.has(e.id));

  if (filteredEntities.length === 0) {
    return { entities: [] };
  }

  const totalRevenue = filteredEntities.reduce((sum, e) => sum + (e.revenue ?? 0), 0);
  const totalOrders = filteredEntities.reduce((sum, e) => sum + (e.orderCount ?? 0), 0);

  return {
    entities: filteredEntities,
    kpis: {
      ...fullData.kpis,
      totalRevenue,
      orders: totalOrders,
      // WHY: Weighted average (total revenue / total orders) is correct here.
      // A simple average of per-entity averages would over-weight low-volume entities.
      avgOrder: totalOrders > 0 ? totalRevenue / totalOrders : null,
    },
  };
}
