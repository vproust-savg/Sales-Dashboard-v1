// FILE: server/src/services/dimension-grouper.ts
// PURPOSE: Group orders into entity lists by dimension (customer, zone, vendor, brand, product_type, product)
// USED BY: server/src/routes/dashboard.ts
// EXPORTS: groupByDimension

import type { EntityListItem, Dimension } from '@shared/types/dashboard';
import type { RawOrder, RawCustomer } from './priority-queries.js';

export function groupByDimension(
  dimension: Dimension,
  orders: RawOrder[],
  customers: RawCustomer[],
): EntityListItem[] {
  const groupers: Record<Dimension, () => EntityListItem[]> = {
    customer: () => groupByCustomer(orders, customers),
    zone: () => groupByZone(orders, customers),
    vendor: () => groupByVendor(orders),
    brand: () => groupByBrand(orders),
    product_type: () => groupByProductType(orders),
    product: () => groupByProduct(orders),
  };

  return (groupers[dimension] ?? groupers.customer)()
    .sort((a, b) => b.revenue - a.revenue);
}

function groupByCustomer(orders: RawOrder[], customers: RawCustomer[]): EntityListItem[] {
  const custMap = new Map(customers.map(c => [c.CUSTNAME, c]));
  const groups = new Map<string, { revenue: number; orderCount: number }>();

  orders.forEach(o => {
    const g = groups.get(o.CUSTNAME) ?? { revenue: 0, orderCount: 0 };
    g.revenue += o.TOTPRICE;
    g.orderCount += 1;
    groups.set(o.CUSTNAME, g);
  });

  return [...groups.entries()].map(([id, g]) => {
    const cust = custMap.get(id);
    return {
      id,
      name: cust?.CUSTDES ?? id,
      meta1: [cust?.ZONEDES, cust?.AGENTDES].filter(Boolean).join(' \u00B7 '),
      meta2: `${g.orderCount} orders`,
      revenue: g.revenue,
      orderCount: g.orderCount,
    };
  });
}

function groupByZone(orders: RawOrder[], customers: RawCustomer[]): EntityListItem[] {
  const custZone = new Map(customers.map(c => [c.CUSTNAME, { zone: c.ZONECODE, zoneName: c.ZONEDES }]));
  const groups = new Map<string, { name: string; revenue: number; orderCount: number; customerIds: Set<string> }>();

  orders.forEach(o => {
    const z = custZone.get(o.CUSTNAME);
    const zoneId = z?.zone ?? 'UNKNOWN';
    const g = groups.get(zoneId) ?? { name: z?.zoneName ?? zoneId, revenue: 0, orderCount: 0, customerIds: new Set() };
    g.revenue += o.TOTPRICE;
    g.orderCount += 1;
    g.customerIds.add(o.CUSTNAME);
    groups.set(zoneId, g);
  });

  return [...groups.entries()].map(([id, g]) => ({
    id, name: g.name,
    meta1: `${g.customerIds.size} customers`,
    meta2: `${g.orderCount} orders`,
    revenue: g.revenue, orderCount: g.orderCount,
  }));
}

function groupByVendor(orders: RawOrder[]): EntityListItem[] {
  const groups = new Map<string, { name: string; revenue: number; orderCount: number; productIds: Set<string> }>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const id = item.Y_1159_5_ESH || 'UNKNOWN';
    const g = groups.get(id) ?? { name: item.Y_1530_5_ESH || id, revenue: 0, orderCount: 0, productIds: new Set() };
    g.revenue += item.QPRICE;
    g.productIds.add(item.PARTNAME);
    groups.set(id, g);
  }));

  // Count orders per vendor (distinct ORDNAME)
  const ordersByVendor = new Map<string, Set<string>>();
  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const id = item.Y_1159_5_ESH || 'UNKNOWN';
    if (!ordersByVendor.has(id)) ordersByVendor.set(id, new Set());
    ordersByVendor.get(id)!.add(o.ORDNAME);
  }));

  return [...groups.entries()].map(([id, g]) => ({
    id, name: g.name,
    meta1: `${g.productIds.size} products`,
    meta2: `${ordersByVendor.get(id)?.size ?? 0} orders`,
    revenue: g.revenue, orderCount: ordersByVendor.get(id)?.size ?? 0,
  }));
}

function groupByBrand(orders: RawOrder[]): EntityListItem[] {
  const groups = new Map<string, { revenue: number; productIds: Set<string>; orderIds: Set<string> }>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const brand = item.Y_9952_5_ESH || 'Other';
    const g = groups.get(brand) ?? { revenue: 0, productIds: new Set(), orderIds: new Set() };
    g.revenue += item.QPRICE;
    g.productIds.add(item.PARTNAME);
    g.orderIds.add(o.ORDNAME);
    groups.set(brand, g);
  }));

  return [...groups.entries()].map(([name, g]) => ({
    id: name, name,
    meta1: `${g.productIds.size} products`,
    meta2: `${g.orderIds.size} orders`,
    revenue: g.revenue, orderCount: g.orderIds.size,
  }));
}

function groupByProductType(orders: RawOrder[]): EntityListItem[] {
  const groups = new Map<string, { code: string; revenue: number; productIds: Set<string>; orderIds: Set<string> }>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const name = item.Y_3021_5_ESH || 'Other';
    const g = groups.get(name) ?? { code: item.Y_3020_5_ESH, revenue: 0, productIds: new Set(), orderIds: new Set() };
    g.revenue += item.QPRICE;
    g.productIds.add(item.PARTNAME);
    g.orderIds.add(o.ORDNAME);
    groups.set(name, g);
  }));

  return [...groups.entries()].map(([name, g]) => ({
    id: g.code || name, name,
    meta1: `${g.productIds.size} products`,
    meta2: `${g.orderIds.size} orders`,
    revenue: g.revenue, orderCount: g.orderIds.size,
  }));
}

function groupByProduct(orders: RawOrder[]): EntityListItem[] {
  const groups = new Map<string, { name: string; brand: string; revenue: number; orderIds: Set<string> }>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const g = groups.get(item.PARTNAME) ?? { name: item.PARTDES, brand: item.Y_9952_5_ESH, revenue: 0, orderIds: new Set() };
    g.revenue += item.QPRICE;
    g.orderIds.add(o.ORDNAME);
    groups.set(item.PARTNAME, g);
  }));

  return [...groups.entries()].map(([sku, g]) => ({
    id: sku, name: g.name,
    meta1: [sku, g.brand].filter(Boolean).join(' \u00B7 '),
    meta2: `${g.orderIds.size} orders`,
    revenue: g.revenue, orderCount: g.orderIds.size,
  }));
}
