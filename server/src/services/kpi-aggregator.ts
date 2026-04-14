// FILE: server/src/services/kpi-aggregator.ts
// PURPOSE: Compute KPIs, monthly revenue, and sparklines from raw Priority orders
// USED BY: server/src/services/data-aggregator.ts
// EXPORTS: computeKPIs, computeMonthlyRevenue, computeSparklines, MONTH_NAMES

import type { KPIs, KPIMetricBreakdown, MonthlyRevenue, SparklineData } from '@shared/types/dashboard';
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

  // Quarter calculations — WHY: fall back to the most recently *completed* quarter.
  // If today is the first month of a quarter (month % 3 === 0), the current quarter has
  // only days of data, which is misleading. Use the previous completed quarter instead.
  // Edge case: January (currentQNum=0) → Q4 of the previous year, which lives in prevOrders.
  const currentQNum = Math.floor(now.getUTCMonth() / 3);
  const monthInQuarter = now.getUTCMonth() % 3;
  let effectiveQuarterNum: number;
  let effectiveYear: number;
  if (monthInQuarter === 0) {
    if (currentQNum === 0) { effectiveQuarterNum = 3; effectiveYear = now.getUTCFullYear() - 1; }
    else                   { effectiveQuarterNum = currentQNum - 1; effectiveYear = now.getUTCFullYear(); }
  } else {
    effectiveQuarterNum = currentQNum; effectiveYear = now.getUTCFullYear();
  }
  const quarterLabel = `Q${effectiveQuarterNum + 1}`;
  const qStart = new Date(Date.UTC(effectiveYear, effectiveQuarterNum * 3, 1));
  const qEnd   = new Date(Date.UTC(effectiveYear, effectiveQuarterNum * 3 + 3, 1));
  const qSource = effectiveYear < now.getUTCFullYear() ? prevOrders : orders;
  const qFilteredOrders = qSource.filter(o => { const d = new Date(o.CURDATE); return d >= qStart && d < qEnd; });
  const qRevenue    = qFilteredOrders.reduce((s, o) => s + o.TOTPRICE, 0);
  const qOrderCount = qFilteredOrders.length;
  const qItemRev    = qFilteredOrders.reduce((s, o) => s + (o.ORDERITEMS_SUBFORM ?? []).reduce((ps, i) => ps + i.QPRICE, 0), 0);
  const qProfit     = qFilteredOrders.reduce((s, o) => s + (o.ORDERITEMS_SUBFORM ?? []).reduce((ps, i) => ps + i.QPROFIT, 0), 0);
  const thisQuarterRevenue = qRevenue;
  // WHY: lastQuarterRevenue kept as simple rolling previous-quarter for reference (not displayed)
  const prevQStart = new Date(Date.UTC(now.getUTCFullYear(), currentQNum * 3 - 3, 1));
  const prevQEnd   = new Date(Date.UTC(now.getUTCFullYear(), currentQNum * 3, 1));
  const lastQuarterRevenue = orders
    .filter(o => { const d = new Date(o.CURDATE); return d >= prevQStart && d < prevQEnd; })
    .reduce((sum, o) => sum + o.TOTPRICE, 0);

  // Monthly buckets for all metrics — WHY: derive breakdown sub-items per metric
  const monthRevenues = new Array(12).fill(0) as number[];
  const monthOrderCounts = new Array(12).fill(0) as number[];
  const monthProfit = new Array(12).fill(0) as number[];
  const monthItemRevenue = new Array(12).fill(0) as number[];
  orders.forEach(o => {
    const m = new Date(o.CURDATE).getUTCMonth();
    monthRevenues[m] += o.TOTPRICE;
    monthOrderCounts[m] += 1;
    // WHY: profit/margin per month derived from order's nested items, not flat items array
    (o.ORDERITEMS_SUBFORM ?? []).forEach(i => {
      monthProfit[m] += i.QPROFIT;
      monthItemRevenue[m] += i.QPRICE;
    });
  });

  // Best month (revenue)
  const bestMonthIdx = monthRevenues.indexOf(Math.max(...monthRevenues));

  // Last month — WHY: if current month is January, last month is December from prev year
  const prevMonthIdx = now.getUTCMonth() - 1;
  let lastMonthRevenue: number;
  let lastMonthName: string;
  if (prevMonthIdx >= 0) {
    lastMonthRevenue = monthRevenues[prevMonthIdx];
    lastMonthName = MONTH_NAMES[prevMonthIdx];
  } else {
    lastMonthRevenue = prevOrders
      .filter(o => new Date(o.CURDATE).getUTCMonth() === 11)
      .reduce((sum, o) => sum + o.TOTPRICE, 0);
    lastMonthName = 'Dec';
  }

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

/* --- Breakdown helpers for KPI cards --- */

/** WHY: Generic breakdown builder for simple sum/count metrics.
 * thisQuarterValue is pre-computed by computeKPIs — avoids re-selecting source array here. */
function buildBreakdown(
  monthlyValues: number[], prevYearTotal: number, prevYearFullTotal: number,
  thisQuarterValue: number, quarterLabel: string, prevMonthIdx: number,
): KPIMetricBreakdown {
  const lastMonth = prevMonthIdx >= 0 ? monthlyValues[prevMonthIdx] : 0;
  const lastMonthName = prevMonthIdx >= 0 ? MONTH_NAMES[prevMonthIdx] : 'Dec';
  const bestVal = Math.max(...monthlyValues);
  const bestIdx = monthlyValues.indexOf(bestVal);
  return {
    prevYear: prevYearTotal,
    prevYearFull: prevYearFullTotal,
    thisQuarter: thisQuarterValue,
    quarterLabel,
    lastMonth,
    lastMonthName,
    bestMonth: { name: MONTH_NAMES[bestIdx] ?? 'N/A', value: bestVal },
  };
}

/** Avg order = revenue / orders per period bucket */
function buildAvgOrderBreakdown(
  monthRevenues: number[], monthOrders: number[], prevRevenue: number, prevOrders: number,
  prevFullRevenue: number, prevFullOrders: number,
  qRevenue: number, qOrderCount: number, quarterLabel: string, prevMonthIdx: number,
): KPIMetricBreakdown {
  const lmRev = prevMonthIdx >= 0 ? monthRevenues[prevMonthIdx] : 0;
  const lmOrd = prevMonthIdx >= 0 ? monthOrders[prevMonthIdx] : 0;
  let bestAvg = 0; let bestIdx = 0;
  for (let i = 0; i < 12; i++) {
    const avg = monthOrders[i] > 0 ? monthRevenues[i] / monthOrders[i] : 0;
    if (avg > bestAvg) { bestAvg = avg; bestIdx = i; }
  }
  return {
    prevYear: prevOrders > 0 ? prevRevenue / prevOrders : 0,
    prevYearFull: prevFullOrders > 0 ? prevFullRevenue / prevFullOrders : 0,
    thisQuarter: qOrderCount > 0 ? qRevenue / qOrderCount : 0,
    quarterLabel,
    lastMonth: lmOrd > 0 ? lmRev / lmOrd : 0,
    lastMonthName: prevMonthIdx >= 0 ? MONTH_NAMES[prevMonthIdx] : 'Dec',
    bestMonth: { name: MONTH_NAMES[bestIdx] ?? 'N/A', value: bestAvg },
  };
}

/** Margin % = profit / item revenue per period bucket */
function buildMarginPctBreakdown(
  monthProfit: number[], monthItemRev: number[], prevProfit: number, prevItemRev: number,
  prevFullProfit: number, prevFullItemRev: number,
  qProfit: number, qItemRev: number, quarterLabel: string, prevMonthIdx: number,
): KPIMetricBreakdown {
  const lmProfit = prevMonthIdx >= 0 ? monthProfit[prevMonthIdx] : 0;
  const lmItemRev = prevMonthIdx >= 0 ? monthItemRev[prevMonthIdx] : 0;
  let bestPct = 0; let bestIdx = 0;
  for (let i = 0; i < 12; i++) {
    const pct = monthItemRev[i] > 0 ? (monthProfit[i] / monthItemRev[i]) * 100 : 0;
    if (pct > bestPct) { bestPct = pct; bestIdx = i; }
  }
  return {
    prevYear: prevItemRev > 0 ? (prevProfit / prevItemRev) * 100 : 0,
    prevYearFull: prevFullItemRev > 0 ? (prevFullProfit / prevFullItemRev) * 100 : 0,
    thisQuarter: qItemRev > 0 ? (qProfit / qItemRev) * 100 : 0,
    quarterLabel,
    lastMonth: lmItemRev > 0 ? (lmProfit / lmItemRev) * 100 : 0,
    lastMonthName: prevMonthIdx >= 0 ? MONTH_NAMES[prevMonthIdx] : 'Dec',
    bestMonth: { name: MONTH_NAMES[bestIdx] ?? 'N/A', value: bestPct },
  };
}

/** Frequency = orders per month */
function buildFrequencyBreakdown(
  monthOrders: number[], prevOrderCount: number, prevFullOrderCount: number, monthsInPeriod: number,
  qOrderCount: number, quarterLabel: string, prevMonthIdx: number,
): KPIMetricBreakdown {
  const lm = prevMonthIdx >= 0 ? monthOrders[prevMonthIdx] : 0;
  let bestVal = 0; let bestIdx = 0;
  for (let i = 0; i < 12; i++) {
    if (monthOrders[i] > bestVal) { bestVal = monthOrders[i]; bestIdx = i; }
  }
  return {
    prevYear: monthsInPeriod > 0 ? prevOrderCount / monthsInPeriod : 0,
    prevYearFull: prevFullOrderCount / 12,
    thisQuarter: qOrderCount / 3,
    quarterLabel,
    lastMonth: lm,
    lastMonthName: prevMonthIdx >= 0 ? MONTH_NAMES[prevMonthIdx] : 'Dec',
    bestMonth: { name: MONTH_NAMES[bestIdx] ?? 'N/A', value: bestVal },
  };
}
