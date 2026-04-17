/**
 * FILE: server/src/services/prev-year-metrics.ts
 * PURPOSE: Pure metric-computation helper shared by current-window and prev-year
 *          aggregations in dimension-grouper.ts. One pass per window → 6 metrics.
 * USED BY: dimension-grouper.ts, dimension-grouper-items.ts
 * EXPORTS: computeMetrics, MetricsSnapshot
 */

export interface MetricItem {
  orderId: string;
  amount: number;
  cost: number;
}

export interface MetricsSnapshot {
  revenue: number | null;
  orderCount: number | null;
  avgOrder: number | null;
  marginAmount: number | null;
  marginPercent: number | null;
  frequency: number | null;
}

/** WHY null-valued fields for empty windows: distinguishes "no activity" from "zero". */
export function computeMetrics(items: MetricItem[], windowDays: number): MetricsSnapshot {
  if (items.length === 0) {
    return {
      revenue: null, orderCount: null, avgOrder: null,
      marginAmount: null, marginPercent: null, frequency: null,
    };
  }
  const revenue = items.reduce((sum, it) => sum + it.amount, 0);
  const totalCost = items.reduce((sum, it) => sum + it.cost, 0);
  const orderIds = new Set(items.map((it) => it.orderId));
  const orderCount = orderIds.size;
  const avgOrder = orderCount > 0 ? revenue / orderCount : null;
  const marginAmount = revenue - totalCost;
  const marginPercent = revenue > 0 ? (marginAmount / revenue) * 100 : null;
  const frequency = windowDays > 0 ? orderCount / windowDays : null;
  return { revenue, orderCount, avgOrder, marginAmount, marginPercent, frequency };
}
