// FILE: server/src/services/kpi-prev-year.ts
// PURPOSE: KPI breakdown and period-block helpers — quarter, monthly, and prev-year sub-items
// USED BY: server/src/services/kpi-aggregator.ts
// EXPORTS: buildBreakdown, buildAvgOrderBreakdown, buildMarginPctBreakdown, buildFrequencyBreakdown, computeQuarterBlock, computeMonthBlocks

import type { KPIMetricBreakdown } from '@shared/types/dashboard';
import type { RawOrder } from './priority-queries.js';

// WHY: MONTH_NAMES lives here (the breakdown/period helper module) and is re-exported
// from kpi-aggregator.ts to keep the public API stable for existing consumers.
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* --- Breakdown helpers for KPI cards --- */

/** WHY: Generic breakdown builder for simple sum/count metrics.
 * thisQuarterValue is pre-computed by computeKPIs — avoids re-selecting source array here. */
export function buildBreakdown(
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
export function buildAvgOrderBreakdown(
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
export function buildMarginPctBreakdown(
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
export function buildFrequencyBreakdown(
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

// Quarter calculations — WHY: fall back to the most recently *completed* quarter.
// If today is the first month of a quarter (month % 3 === 0), the current quarter has
// only days of data, which is misleading. Use the previous completed quarter instead.
// Edge case: January (currentQNum=0) → Q4 of the previous year, which lives in prevOrders.
export function computeQuarterBlock(orders: RawOrder[], prevOrders: RawOrder[], now: Date) {
  const currentQNum = Math.floor(now.getUTCMonth() / 3);
  const monthInQuarter = now.getUTCMonth() % 3;
  let effectiveQuarterNum: number; let effectiveYear: number;
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
  return { quarterLabel, qRevenue, qOrderCount, qItemRev, qProfit, thisQuarterRevenue, lastQuarterRevenue };
}

// Monthly buckets — WHY: derive breakdown sub-items per metric.
// Edge case: current month is January → last month is December from prev year.
export function computeMonthBlocks(orders: RawOrder[], prevOrders: RawOrder[], now: Date) {
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
  const bestMonthIdx = monthRevenues.indexOf(Math.max(...monthRevenues));
  const prevMonthIdx = now.getUTCMonth() - 1;
  let lastMonthRevenue: number; let lastMonthName: string;
  if (prevMonthIdx >= 0) {
    lastMonthRevenue = monthRevenues[prevMonthIdx];
    lastMonthName = MONTH_NAMES[prevMonthIdx];
  } else {
    lastMonthRevenue = prevOrders
      .filter(o => new Date(o.CURDATE).getUTCMonth() === 11)
      .reduce((sum, o) => sum + o.TOTPRICE, 0);
    lastMonthName = 'Dec';
  }
  return { monthRevenues, monthOrderCounts, monthProfit, monthItemRevenue, bestMonthIdx, prevMonthIdx, lastMonthRevenue, lastMonthName };
}
