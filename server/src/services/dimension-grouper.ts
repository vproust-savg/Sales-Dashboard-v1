// FILE: server/src/services/dimension-grouper.ts
// PURPOSE: Group orders into entity lists by dimension (customer, zone, vendor, brand, product_type, product)
// USED BY: server/src/routes/dashboard.ts, server/src/routes/fetch-all.ts
// EXPORTS: groupByDimension, PrevYearTotals

import type { EntityListItem, Dimension } from '@shared/types/dashboard';
import type { RawOrder, RawCustomer } from './priority-queries.js';
import { groupByVendor, groupByBrand, groupByProductType, groupByProduct } from './dimension-grouper-items.js';

// WHY: Exported so item-level groupers in dimension-grouper-items.ts can type their
// prevMap parameter against the same shape.
export interface PrevYearTotals { samePeriod: number; full: number; }

/** Sum prev-year revenue per entity, splitting by same-period (day-precise YTD cutoff) vs full year.
 *  Cutoff semantics MUST match kpi-aggregator.ts:23-31 exactly (UTC, inclusive date). */
function computePrevYearByEntity(
  prevOrders: RawOrder[],
  dimension: Dimension,
  period: string,
): Map<string, PrevYearTotals> {
  const map = new Map<string, PrevYearTotals>();
  const now = new Date();
  const isYtd = period === 'ytd';

  // WHY: Matches kpi-aggregator.ts:23-31 exactly — UTC month comparison, inclusive date.
  function isSamePeriod(orderDate: Date): boolean {
    if (!isYtd) return true;
    return orderDate.getUTCMonth() < now.getUTCMonth()
      || (orderDate.getUTCMonth() === now.getUTCMonth() && orderDate.getUTCDate() <= now.getUTCDate());
  }

  function add(id: string, amount: number, samePeriod: boolean): void {
    const existing = map.get(id) ?? { samePeriod: 0, full: 0 };
    existing.full += amount;
    if (samePeriod) existing.samePeriod += amount;
    map.set(id, existing);
  }

  prevOrders.forEach(o => {
    const orderDate = new Date(o.CURDATE);
    const sp = isSamePeriod(orderDate);
    if (dimension === 'customer' || dimension === 'zone') {
      // WHY: For zone, prevMap is keyed by CUSTNAME; groupByZone re-aggregates per zone.
      add(o.CUSTNAME, o.TOTPRICE, sp);
    } else {
      const items = o.ORDERITEMS_SUBFORM ?? [];
      items.forEach(item => {
        let key: string | undefined;
        switch (dimension) {
          case 'vendor':       key = item.Y_1159_5_ESH; break;
          case 'brand':        key = item.Y_9952_5_ESH; break;
          // WHY: Must match groupByProductType's entityId (code first, name as fallback) in
          // dimension-grouper-items.ts — otherwise prevMap.get(entityId) silently misses.
          // Edge case: if Priority populates Y_3020_5_ESH in prev rows but leaves it empty in
          // current rows (or vice versa), the same conceptual product_type entity keys
          // differently across years and YoY reads null. Unlikely in practice; acknowledged
          // limitation — Priority is READ-ONLY, we cannot enforce field population at source.
          case 'product_type': key = item.Y_3020_5_ESH || item.Y_3021_5_ESH; break;
          case 'product':      key = item.PARTNAME; break;
        }
        if (!key) return;
        add(key, item.QPRICE, sp);
      });
    }
  });

  return map;
}

export function groupByDimension(
  dimension: Dimension,
  orders: RawOrder[],
  customers: RawCustomer[],
  periodMonths: number,
  prevOrders?: RawOrder[],
  period?: string,
): EntityListItem[] {
  const prevMap = (prevOrders && period) ? computePrevYearByEntity(prevOrders, dimension, period) : undefined;

  const groupers: Record<Dimension, () => EntityListItem[]> = {
    customer: () => groupByCustomer(orders, customers, periodMonths, prevMap),
    zone: () => groupByZone(orders, customers, periodMonths, prevMap),
    vendor: () => groupByVendor(orders, periodMonths, prevMap),
    brand: () => groupByBrand(orders, periodMonths, prevMap),
    product_type: () => groupByProductType(orders, periodMonths, prevMap),
    product: () => groupByProduct(orders, periodMonths, prevMap),
  };

  return (groupers[dimension] ?? groupers.customer)()
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));
}

function groupByCustomer(
  orders: RawOrder[],
  customers: RawCustomer[],
  periodMonths: number,
  prevMap?: Map<string, PrevYearTotals>,
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

  return [...groups.entries()].map(([id, g]) => {
    const cust = custMap.get(id);
    const lastDate = g.dates.length > 0
      ? g.dates.reduce((a, b) => a > b ? a : b)
      : null;
    const prev = prevMap?.get(id);
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
      // WHY: prevMap present but entity not in it → 0 (entity had no prev-year orders).
      // prevMap absent → null (prev data not loaded at all).
      prevYearRevenue: prev?.samePeriod ?? (prevMap ? 0 : null),
      prevYearRevenueFull: prev?.full ?? (prevMap ? 0 : null),
    };
  });
}

function groupByZone(
  orders: RawOrder[],
  customers: RawCustomer[],
  periodMonths: number,
  prevMap?: Map<string, PrevYearTotals>,
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

  // WHY: prevMap is keyed by CUSTNAME. Re-aggregate per zone using custZone lookup.
  const prevByZone = new Map<string, PrevYearTotals>();
  if (prevMap) {
    const custZoneMap = new Map(customers.map(c => [c.CUSTNAME, c.ZONECODE]));
    prevMap.forEach((totals, custname) => {
      const zoneId = custZoneMap.get(custname) ?? 'UNKNOWN';
      const existing = prevByZone.get(zoneId) ?? { samePeriod: 0, full: 0 };
      existing.samePeriod += totals.samePeriod;
      existing.full += totals.full;
      prevByZone.set(zoneId, existing);
    });
  }

  return [...groups.entries()].map(([id, g]) => {
    const lastDate = g.dates.length > 0 ? g.dates.reduce((a, b) => a > b ? a : b) : null;
    const prev = prevByZone.get(id);
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
      prevYearRevenue: prev?.samePeriod ?? (prevMap ? 0 : null),
      prevYearRevenueFull: prev?.full ?? (prevMap ? 0 : null),
    };
  });
}
