// FILE: server/src/services/dimension-grouper.ts
// PURPOSE: Group orders into entity lists by dimension (customer, zone, vendor, brand, product_type, product)
// USED BY: server/src/routes/dashboard.ts
// EXPORTS: groupByDimension

import type { EntityListItem, Dimension } from '@shared/types/dashboard';
import type { RawOrder, RawCustomer } from './priority-queries.js';
import { groupByVendor, groupByBrand, groupByProductType, groupByProduct } from './dimension-grouper-items.js';

export function groupByDimension(
  dimension: Dimension,
  orders: RawOrder[],
  customers: RawCustomer[],
  periodMonths: number,
): EntityListItem[] {
  const groupers: Record<Dimension, () => EntityListItem[]> = {
    customer: () => groupByCustomer(orders, customers, periodMonths),
    zone: () => groupByZone(orders, customers, periodMonths),
    vendor: () => groupByVendor(orders, periodMonths),
    brand: () => groupByBrand(orders, periodMonths),
    product_type: () => groupByProductType(orders, periodMonths),
    product: () => groupByProduct(orders, periodMonths),
  };

  return (groupers[dimension] ?? groupers.customer)()
    .sort((a, b) => b.revenue - a.revenue);
}

function groupByCustomer(orders: RawOrder[], customers: RawCustomer[], periodMonths: number): EntityListItem[] {
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
    };
  });
}

function groupByZone(orders: RawOrder[], customers: RawCustomer[], periodMonths: number): EntityListItem[] {
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

  return [...groups.entries()].map(([id, g]) => {
    const lastDate = g.dates.length > 0 ? g.dates.reduce((a, b) => a > b ? a : b) : null;
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
    };
  });
}
