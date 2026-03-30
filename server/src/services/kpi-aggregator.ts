// FILE: server/src/services/kpi-aggregator.ts
// PURPOSE: Compute KPIs, monthly revenue, and sparklines from raw Priority orders
// USED BY: server/src/services/data-aggregator.ts
// EXPORTS: computeKPIs, computeMonthlyRevenue, computeSparklines, MONTH_NAMES

import type { KPIs, MonthlyRevenue, SparklineData } from '@shared/types/dashboard';
import type { RawOrder, RawOrderItem } from './priority-queries.js';

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Spec Section 10.1 — KPI formulas */
export function computeKPIs(
  orders: RawOrder[],
  prevOrders: RawOrder[],
  items: RawOrderItem[],
  prevItems: RawOrderItem[],
  period: string,
): KPIs {
  const totalRevenue = orders.reduce((sum, o) => sum + o.TOTPRICE, 0);
  const prevRevenue = prevOrders.reduce((sum, o) => sum + o.TOTPRICE, 0);
  const orderCount = orders.length;

  const totalItemRevenue = items.reduce((sum, i) => sum + i.QPRICE, 0);
  const totalProfit = items.reduce((sum, i) => sum + i.QPROFIT, 0);

  const now = new Date();
  const monthsInPeriod = period === 'ytd'
    ? Math.max(1, now.getUTCMonth() + 1)
    : 12;

  // Quarter calculations — WHY: UTC consistency with monthly revenue (lines 93-94)
  const currentQuarter = Math.floor(now.getUTCMonth() / 3);
  const qStart = new Date(Date.UTC(now.getUTCFullYear(), currentQuarter * 3, 1));
  const prevQStart = new Date(Date.UTC(now.getUTCFullYear(), (currentQuarter - 1) * 3, 1));
  const thisQuarterRevenue = orders
    .filter(o => new Date(o.CURDATE) >= qStart)
    .reduce((sum, o) => sum + o.TOTPRICE, 0);
  const lastQuarterRevenue = orders
    .filter(o => { const d = new Date(o.CURDATE); return d >= prevQStart && d < qStart; })
    .reduce((sum, o) => sum + o.TOTPRICE, 0);

  // Best month
  const monthRevenues = new Array(12).fill(0) as number[];
  orders.forEach(o => { monthRevenues[new Date(o.CURDATE).getUTCMonth()] += o.TOTPRICE; });
  const bestMonthIdx = monthRevenues.indexOf(Math.max(...monthRevenues));

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

  return {
    totalRevenue,
    prevYearRevenue: prevRevenue,
    revenueChangePercent,
    revenueChangeAmount: totalRevenue - prevRevenue,
    thisQuarterRevenue,
    lastQuarterRevenue,
    bestMonth: { name: MONTH_NAMES[bestMonthIdx] ?? 'N/A', amount: monthRevenues[bestMonthIdx] ?? 0 },
    orders: orderCount,
    ordersChange: orderCount - prevOrders.length,
    avgOrder: orderCount > 0 ? totalRevenue / orderCount : null,
    marginPercent: currentMarginPct,
    marginAmount: totalProfit,
    marginChangepp: currentMarginPct !== null && prevMarginPct !== null
      ? currentMarginPct - prevMarginPct : null,
    frequency: orderCount > 0 ? orderCount / monthsInPeriod : null,
    frequencyChange: null, // Computed on client from avg across all entities
    lastOrderDays,
    fillRate: null, // Requires delivered qty data not yet mapped
    fillRateChangepp: null,
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
