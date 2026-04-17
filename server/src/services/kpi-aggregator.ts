// FILE: server/src/services/kpi-aggregator.ts
// PURPOSE: Compute KPIs, monthly revenue, and sparklines from raw Priority orders
// USED BY: server/src/services/data-aggregator.ts
// EXPORTS: computeKPIs, computeMonthlyRevenue, computeSparklines, MONTH_NAMES

import type { KPIs, MonthlyRevenue, SparklineData } from '@shared/types/dashboard';
import type { RawOrder, RawOrderItem } from './priority-queries.js';
import {
  MONTH_NAMES,
  buildBreakdown,
  buildAvgOrderBreakdown,
  buildMarginPctBreakdown,
  buildFrequencyBreakdown,
  computeQuarterBlock,
  computeMonthBlocks,
} from './kpi-prev-year.js';

// WHY: Re-export MONTH_NAMES so existing consumers (data-aggregator.ts, tests) that import
// it from this module do not need to change their import paths.
export { MONTH_NAMES };

/** Spec Section 10.1 — KPI formulas */
export function computeKPIs(
  orders: RawOrder[],
  prevOrders: RawOrder[],
  items: RawOrderItem[],
  prevItems: RawOrderItem[],
  period: string,
): KPIs {
  const now = new Date();
  const totalRevenue = orders.reduce((sum, o) => sum + o.TOTPRICE, 0);
  // WHY: For YTD, compare only against the same months last year (apples-to-apples).
  // prevOrders covers the full previous year; filter to same cutoff date for fair comparison.
  const prevRevenue = period === 'ytd'
    ? prevOrders
        .filter(o => {
          const d = new Date(o.CURDATE);
          return d.getUTCMonth() < now.getUTCMonth()
            || (d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() <= now.getUTCDate());
        })
        .reduce((sum, o) => sum + o.TOTPRICE, 0)
    : prevOrders.reduce((sum, o) => sum + o.TOTPRICE, 0);
  const orderCount = orders.length;

  const totalItemRevenue = items.reduce((sum, i) => sum + i.QPRICE, 0);
  const totalProfit = items.reduce((sum, i) => sum + i.QPROFIT, 0);
  const monthsInPeriod = period === 'ytd'
    ? Math.max(1, now.getUTCMonth() + 1)
    : 12;

  const { quarterLabel, qRevenue, qOrderCount, qItemRev, qProfit, thisQuarterRevenue, lastQuarterRevenue } = computeQuarterBlock(orders, prevOrders, now);
  const { monthRevenues, monthOrderCounts, monthProfit, monthItemRevenue, bestMonthIdx, prevMonthIdx, lastMonthRevenue, lastMonthName } = computeMonthBlocks(orders, prevOrders, now);

  // Last order
  const dates = orders.map(o => new Date(o.CURDATE).getTime());
  const lastOrderDate = dates.length > 0 ? Math.max(...dates) : null;
  const lastOrderDays = lastOrderDate !== null
    ? Math.floor((now.getTime() - lastOrderDate) / (1000 * 60 * 60 * 24))
    : null;

  // YoY change — spec Section 10.2
  const revenueChangePercent = prevRevenue > 0
    ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
    : null;

  // Prev margin for pp change
  const prevItemRevenue = prevItems.reduce((sum, i) => sum + i.QPRICE, 0);
  const prevProfit = prevItems.reduce((sum, i) => sum + i.QPROFIT, 0);
  const prevMarginPct = prevItemRevenue > 0 ? (prevProfit / prevItemRevenue) * 100 : null;
  const currentMarginPct = totalItemRevenue > 0 ? (totalProfit / totalItemRevenue) * 100 : null;

  // --- Per-metric breakdowns (mirrors hero card sub-items) ---
  // WHY: same prevOrders filtering for same-period comparison as the revenue prevRevenue above
  const prevSamePeriod = period === 'ytd'
    ? prevOrders.filter(o => {
        const d = new Date(o.CURDATE);
        return d.getUTCMonth() < now.getUTCMonth()
          || (d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() <= now.getUTCDate());
      })
    : prevOrders;
  const prevOrderCount = prevSamePeriod.length;
  const prevSamePeriodRevenue = prevSamePeriod.reduce((s, o) => s + o.TOTPRICE, 0);
  const prevSamePeriodProfit = prevSamePeriod.reduce((s, o) =>
    s + (o.ORDERITEMS_SUBFORM ?? []).reduce((ps, i) => ps + i.QPROFIT, 0), 0);
  const prevSamePeriodItemRev = prevSamePeriod.reduce((s, o) =>
    s + (o.ORDERITEMS_SUBFORM ?? []).reduce((ps, i) => ps + i.QPRICE, 0), 0);

  // WHY: Full previous year totals (all 12 months) — shown alongside same-period for context
  const prevFullRevenue = prevOrders.reduce((s, o) => s + o.TOTPRICE, 0);
  const prevFullOrderCount = prevOrders.length;
  const prevFullProfit = prevOrders.reduce((s, o) =>
    s + (o.ORDERITEMS_SUBFORM ?? []).reduce((ps, i) => ps + i.QPROFIT, 0), 0);
  const prevFullItemRev = prevOrders.reduce((s, o) =>
    s + (o.ORDERITEMS_SUBFORM ?? []).reduce((ps, i) => ps + i.QPRICE, 0), 0);

  const ordersBreakdown        = buildBreakdown(monthOrderCounts, prevOrderCount, prevFullOrderCount, qOrderCount, quarterLabel, prevMonthIdx);
  const avgOrderBreakdown      = buildAvgOrderBreakdown(monthRevenues, monthOrderCounts, prevSamePeriodRevenue, prevOrderCount, prevFullRevenue, prevFullOrderCount, qRevenue, qOrderCount, quarterLabel, prevMonthIdx);
  const marginPercentBreakdown = buildMarginPctBreakdown(monthProfit, monthItemRevenue, prevSamePeriodProfit, prevSamePeriodItemRev, prevFullProfit, prevFullItemRev, qProfit, qItemRev, quarterLabel, prevMonthIdx);
  const marginAmountBreakdown  = buildBreakdown(monthProfit, prevSamePeriodProfit, prevFullProfit, qProfit, quarterLabel, prevMonthIdx);
  const frequencyBreakdown     = buildFrequencyBreakdown(monthOrderCounts, prevOrderCount, prevFullOrderCount, monthsInPeriod, qOrderCount, quarterLabel, prevMonthIdx);

  return {
    totalRevenue,
    prevYearRevenue: prevRevenue,
    prevYearRevenueFull: prevFullRevenue,
    revenueChangePercent,
    revenueChangeAmount: totalRevenue - prevRevenue,
    thisQuarterRevenue,
    lastQuarterRevenue,
    lastMonthRevenue,
    lastMonthName,
    quarterLabel,
    bestMonth: { name: MONTH_NAMES[bestMonthIdx] ?? 'N/A', amount: monthRevenues[bestMonthIdx] ?? 0 },
    orders: orderCount,
    ordersChange: orderCount - prevOrders.length,
    avgOrder: orderCount > 0 ? totalRevenue / orderCount : null,
    marginPercent: currentMarginPct,
    marginAmount: totalProfit,
    marginChangepp: currentMarginPct !== null && prevMarginPct !== null
      ? currentMarginPct - prevMarginPct : null,
    frequency: orderCount > 0 ? orderCount / monthsInPeriod : null,
    frequencyChange: null,
    lastOrderDays,
    fillRate: null,
    fillRateChangepp: null,
    ordersBreakdown,
    avgOrderBreakdown,
    marginPercentBreakdown,
    marginAmountBreakdown,
    frequencyBreakdown,
  };
}

/** Spec Section 20.1 — 12 months, current vs previous year */
export function computeMonthlyRevenue(current: RawOrder[], prev: RawOrder[]): MonthlyRevenue[] {
  const currentByMonth = new Array(12).fill(0) as number[];
  const prevByMonth = new Array(12).fill(0) as number[];

  current.forEach(o => { currentByMonth[new Date(o.CURDATE).getUTCMonth()] += o.TOTPRICE; });
  prev.forEach(o => { prevByMonth[new Date(o.CURDATE).getUTCMonth()] += o.TOTPRICE; });

  return MONTH_NAMES.map((name, i) => ({
    month: name,
    monthIndex: i,
    currentYear: currentByMonth[i],
    previousYear: prevByMonth[i],
  }));
}

/** Spec Section 20.3 — last 6 months of revenue for sparklines */
export function computeSparklines(orders: RawOrder[]): Record<string, SparklineData> {
  const now = new Date();
  const months: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.getUTCFullYear() * 12 + d.getUTCMonth());
  }

  const revenueByMonth = new Map<number, number>();
  const ordersByMonth = new Map<number, number>();
  orders.forEach(o => {
    const d = new Date(o.CURDATE);
    const key = d.getUTCFullYear() * 12 + d.getUTCMonth();
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + o.TOTPRICE);
    ordersByMonth.set(key, (ordersByMonth.get(key) ?? 0) + 1);
  });

  return {
    revenue: { values: months.map(m => revenueByMonth.get(m) ?? 0) },
    orders: { values: months.map(m => ordersByMonth.get(m) ?? 0) },
  };
}

