// FILE: server/src/services/dimension-grouper.ts
// PURPOSE: Group orders into entity lists by dimension (customer, zone, vendor, brand, product_type, product)
// USED BY: server/src/routes/dashboard.ts, server/src/routes/fetch-all.ts
// EXPORTS: groupByDimension, PrevYearInput

import type { EntityListItem, Dimension } from '@shared/types/dashboard';
import type { RawOrder, RawCustomer, RawOrderItem } from './priority-queries.js';
import { computeMetrics, type MetricsSnapshot, type MetricItem } from './prev-year-metrics.js';
import { groupByVendor, groupByBrand, groupByProductType, groupByProduct, type ItemPrevYearMaps } from './dimension-grouper-items.js';

// WHY: Callers pass pre-split order slices (same-period vs full year) so each
// dimension can reuse the same cached slices without re-slicing internally.
export interface PrevYearInput {
  today: Date;
  prevSame: RawOrder[];   // orders from prev-year same-period window
  prevFull: RawOrder[];   // orders from the full prev calendar year
}

/** Internal per-entity metrics maps — keyed by entity id. */
interface PrevYearMetricsMaps {
  samePeriod: Map<string, MetricsSnapshot>;
  full: Map<string, MetricsSnapshot>;
}

/** Build MetricItems from a single order's line items. */
function orderToMetricItems(o: RawOrder): MetricItem[] {
  return (o.ORDERITEMS_SUBFORM ?? []).map(it => ({
    orderId: o.ORDNAME,
    amount: it.QPRICE,
    // WHY QPRICE - QPROFIT: cost per line = revenue - profit. Avoids adding QUANTCOST
    // to RawOrderItem since QPRICE and QPROFIT are already present for all orders.
    cost: it.QPRICE - it.QPROFIT,
  }));
}

/** Shared: convert a MetricItem bucket to a MetricsSnapshot map with the given window. */
function toMetricsMap(bucket: Map<string, MetricItem[]>, windowDays: number): Map<string, MetricsSnapshot> {
  const out = new Map<string, MetricsSnapshot>();
  for (const [k, items] of bucket) out.set(k, computeMetrics(items, windowDays));
  return out;
}

/**
 * Build per-entity MetricsSnapshot maps from prev-year order slices.
 * keyFn maps each order to the entity id it belongs to (CUSTNAME, ZONECODE, etc.).
 */
function buildPrevYearMetrics(
  input: PrevYearInput,
  keyFn: (o: RawOrder) => string,
  samePeriodDays: number,
): PrevYearMetricsMaps {
  const groupItems = (orders: RawOrder[]): Map<string, MetricItem[]> => {
    const bucket = new Map<string, MetricItem[]>();
    for (const o of orders) {
      const key = keyFn(o);
      const arr = bucket.get(key) ?? [];
      arr.push(...orderToMetricItems(o));
      bucket.set(key, arr);
    }
    return bucket;
  };
  return {
    samePeriod: toMetricsMap(groupItems(input.prevSame), samePeriodDays),
    full: toMetricsMap(groupItems(input.prevFull), 365),
  };
}

/**
 * WHY: Per-item dims bucket by item field not order field — must walk ORDERITEMS_SUBFORM.
 * keyFn maps each order item to the entity id for its dimension.
 */
function buildPrevYearMetricsByItem(
  input: PrevYearInput,
  keyFn: (item: RawOrderItem) => string,
  samePeriodDays: number,
): ItemPrevYearMaps {
  const groupItems = (orders: RawOrder[]): Map<string, MetricItem[]> => {
    const bucket = new Map<string, MetricItem[]>();
    for (const o of orders) {
      for (const item of o.ORDERITEMS_SUBFORM ?? []) {
        const key = keyFn(item);
        const arr = bucket.get(key) ?? [];
        arr.push({ orderId: o.ORDNAME, amount: item.QPRICE, cost: item.QPRICE - item.QPROFIT });
        bucket.set(key, arr);
      }
    }
    return bucket;
  };
  return {
    samePeriod: toMetricsMap(groupItems(input.prevSame), samePeriodDays),
    full: toMetricsMap(groupItems(input.prevFull), 365),
  };
}

/** Extract null prev-year fields when no PrevYearInput is provided or entity has no prev activity. */
function nullPrevYearFields(): Pick<
  EntityListItem,
  | 'prevYearRevenue' | 'prevYearOrderCount' | 'prevYearAvgOrder'
  | 'prevYearMarginPercent' | 'prevYearMarginAmount' | 'prevYearFrequency'
  | 'prevYearRevenueFull' | 'prevYearOrderCountFull' | 'prevYearAvgOrderFull'
  | 'prevYearMarginPercentFull' | 'prevYearMarginAmountFull' | 'prevYearFrequencyFull'
> {
  return {
    prevYearRevenue: null,
    prevYearOrderCount: null,
    prevYearAvgOrder: null,
    prevYearMarginPercent: null,
    prevYearMarginAmount: null,
    prevYearFrequency: null,
    prevYearRevenueFull: null,
    prevYearOrderCountFull: null,
    prevYearAvgOrderFull: null,
    prevYearMarginPercentFull: null,
    prevYearMarginAmountFull: null,
    prevYearFrequencyFull: null,
  };
}

/** Map a MetricsSnapshot to the prev-year EntityListItem fields for a single window. */
function snapshotToFields(
  same: MetricsSnapshot | null,
  full: MetricsSnapshot | null,
): Pick<
  EntityListItem,
  | 'prevYearRevenue' | 'prevYearOrderCount' | 'prevYearAvgOrder'
  | 'prevYearMarginPercent' | 'prevYearMarginAmount' | 'prevYearFrequency'
  | 'prevYearRevenueFull' | 'prevYearOrderCountFull' | 'prevYearAvgOrderFull'
  | 'prevYearMarginPercentFull' | 'prevYearMarginAmountFull' | 'prevYearFrequencyFull'
> {
  return {
    prevYearRevenue: same?.revenue ?? null,
    prevYearOrderCount: same?.orderCount ?? null,
    prevYearAvgOrder: same?.avgOrder ?? null,
    prevYearMarginPercent: same?.marginPercent ?? null,
    prevYearMarginAmount: same?.marginAmount ?? null,
    prevYearFrequency: same?.frequency ?? null,
    prevYearRevenueFull: full?.revenue ?? null,
    prevYearOrderCountFull: full?.orderCount ?? null,
    prevYearAvgOrderFull: full?.avgOrder ?? null,
    prevYearMarginPercentFull: full?.marginPercent ?? null,
    prevYearMarginAmountFull: full?.marginAmount ?? null,
    prevYearFrequencyFull: full?.frequency ?? null,
  };
}

/** WHY: Compute per-item prev maps once before dispatch. Returns undefined maps when prevInput absent. */
function buildItemPrevMaps(prevInput: PrevYearInput | undefined): Record<'vendor' | 'brand' | 'product_type' | 'product', ItemPrevYearMaps | undefined> {
  if (!prevInput) return { vendor: undefined, brand: undefined, product_type: undefined, product: undefined };
  const start = new Date(Date.UTC(prevInput.today.getUTCFullYear(), 0, 1));
  const days = Math.max(1, Math.round((prevInput.today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  return {
    vendor: buildPrevYearMetricsByItem(prevInput, (it) => it.Y_1159_5_ESH || 'UNKNOWN', days),
    brand: buildPrevYearMetricsByItem(prevInput, (it) => it.Y_9952_5_ESH || 'Other', days),
    product_type: buildPrevYearMetricsByItem(prevInput, (it) => it.Y_3020_5_ESH || it.Y_3021_5_ESH || 'Other', days),
    product: buildPrevYearMetricsByItem(prevInput, (it) => it.PARTNAME, days),
  };
}

export function groupByDimension(
  dimension: Dimension,
  orders: RawOrder[],
  customers: RawCustomer[],
  periodMonths: number = 12,
  prevInput?: PrevYearInput,
): EntityListItem[] {
  // WHY: Build item-level prev maps only if prevInput is provided; undefined = no prev data.
  const itemPrevMaps = buildItemPrevMaps(prevInput);

  const groupers: Record<Dimension, () => EntityListItem[]> = {
    customer: () => groupByCustomer(orders, customers, periodMonths, prevInput),
    zone: () => groupByZone(orders, customers, periodMonths, prevInput),
    vendor: () => groupByVendor(orders, periodMonths, itemPrevMaps.vendor),
    brand: () => groupByBrand(orders, periodMonths, itemPrevMaps.brand),
    product_type: () => groupByProductType(orders, periodMonths, itemPrevMaps.product_type),
    product: () => groupByProduct(orders, periodMonths, itemPrevMaps.product),
  };

  return (groupers[dimension] ?? groupers.customer)()
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));
}

function groupByCustomer(
  orders: RawOrder[],
  customers: RawCustomer[],
  periodMonths: number,
  prevInput?: PrevYearInput,
): EntityListItem[] {
  const custMap = new Map(customers.map(c => [c.CUSTNAME, c]));
  const groups = new Map<string, { revenue: number; orderCount: number; profit: number; dates: string[] }>();

  orders.forEach(o => {
    const g = groups.get(o.CUSTNAME) ?? { revenue: 0, orderCount: 0, profit: 0, dates: [] };
    g.revenue += o.TOTPRICE;
    g.orderCount += 1;
    g.dates.push(o.CURDATE);
    const itemProfit = (o.ORDERITEMS_SUBFORM ?? []).reduce((s, i) => s + i.QPROFIT, 0);
    g.profit += itemProfit;
    groups.set(o.CUSTNAME, g);
  });

  // WHY: Compute samePeriodDays from today's YTD window (Jan 1 → today), matching the
  // window over which prevSame orders were filtered. Used as windowDays for frequency.
  let prevMaps: PrevYearMetricsMaps | null = null;
  if (prevInput) {
    const startOfYear = new Date(Date.UTC(prevInput.today.getUTCFullYear(), 0, 1));
    const samePeriodDays = Math.max(1,
      Math.round((prevInput.today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)),
    );
    prevMaps = buildPrevYearMetrics(prevInput, o => o.CUSTNAME, samePeriodDays);
  }

  return [...groups.entries()].map(([id, g]) => {
    const cust = custMap.get(id);
    const lastDate = g.dates.length > 0
      ? g.dates.reduce((a, b) => a > b ? a : b)
      : null;

    const prevFields = prevMaps
      ? snapshotToFields(prevMaps.samePeriod.get(id) ?? null, prevMaps.full.get(id) ?? null)
      : nullPrevYearFields();

    return {
      id,
      name: cust?.CUSTDES ?? id,
      meta1: [cust?.ZONEDES, cust?.AGENTNAME].filter(Boolean).join(' \u00B7 '),
      meta2: `${g.orderCount} orders`,
      revenue: g.revenue,
      orderCount: g.orderCount,
      avgOrder: g.orderCount > 0 ? g.revenue / g.orderCount : 0,
      marginPercent: g.revenue > 0 ? (g.profit / g.revenue) * 100 : 0,
      marginAmount: g.profit,
      frequency: periodMonths >= 1 ? g.orderCount / periodMonths : null,
      lastOrderDate: lastDate,
      rep: cust?.AGENTNAME ?? null,
      zone: cust?.ZONEDES ?? null,
      customerType: cust?.CTYPENAME ?? null,
      ...prevFields,
    };
  });
}

function groupByZone(
  orders: RawOrder[],
  customers: RawCustomer[],
  periodMonths: number,
  prevInput?: PrevYearInput,
): EntityListItem[] {
  const custZone = new Map(customers.map(c => [c.CUSTNAME, { zone: c.ZONECODE, zoneName: c.ZONEDES }]));
  const groups = new Map<string, { name: string; revenue: number; orderCount: number; profit: number; customerIds: Set<string>; dates: string[] }>();

  orders.forEach(o => {
    const z = custZone.get(o.CUSTNAME);
    const zoneId = z?.zone ?? 'UNKNOWN';
    const g = groups.get(zoneId) ?? { name: z?.zoneName ?? zoneId, revenue: 0, orderCount: 0, profit: 0, customerIds: new Set(), dates: [] };
    g.revenue += o.TOTPRICE;
    g.orderCount += 1;
    g.dates.push(o.CURDATE);
    const itemProfit = (o.ORDERITEMS_SUBFORM ?? []).reduce((s, i) => s + i.QPROFIT, 0);
    g.profit += itemProfit;
    g.customerIds.add(o.CUSTNAME);
    groups.set(zoneId, g);
  });

  // WHY: prevInput orders are keyed by CUSTNAME; re-aggregate to zone via custZone lookup.
  let prevMaps: PrevYearMetricsMaps | null = null;
  if (prevInput) {
    const startOfYear = new Date(Date.UTC(prevInput.today.getUTCFullYear(), 0, 1));
    const samePeriodDays = Math.max(1,
      Math.round((prevInput.today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)),
    );
    // WHY: keyFn maps order → ZONECODE via custZone lookup; falls back to 'UNKNOWN'.
    const keyFn = (o: RawOrder): string => custZone.get(o.CUSTNAME)?.zone ?? 'UNKNOWN';
    prevMaps = buildPrevYearMetrics(prevInput, keyFn, samePeriodDays);
  }

  return [...groups.entries()].map(([id, g]) => {
    const lastDate = g.dates.length > 0 ? g.dates.reduce((a, b) => a > b ? a : b) : null;

    const prevFields = prevMaps
      ? snapshotToFields(prevMaps.samePeriod.get(id) ?? null, prevMaps.full.get(id) ?? null)
      : nullPrevYearFields();

    return {
      id, name: g.name,
      meta1: `${g.customerIds.size} customers`,
      meta2: `${g.orderCount} orders`,
      revenue: g.revenue, orderCount: g.orderCount,
      avgOrder: g.orderCount > 0 ? g.revenue / g.orderCount : 0,
      marginPercent: g.revenue > 0 ? (g.profit / g.revenue) * 100 : 0,
      marginAmount: g.profit,
      frequency: periodMonths >= 1 ? g.orderCount / periodMonths : null,
      lastOrderDate: lastDate,
      rep: null, zone: null, customerType: null,
      ...prevFields,
    };
  });
}
