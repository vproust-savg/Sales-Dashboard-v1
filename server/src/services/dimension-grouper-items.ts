// FILE: server/src/services/dimension-grouper-items.ts
// PURPOSE: Item-based dimension groupers (vendor, brand, product_type, product)
// USED BY: server/src/services/dimension-grouper.ts
// EXPORTS: groupByVendor, groupByBrand, groupByProductType, groupByProduct

import type { EntityListItem } from '@shared/types/dashboard';
import type { RawOrder } from './priority-queries.js';

/** WHY: Item-based dimensions compute profit from QPROFIT, order counts from distinct ORDNAME */
interface ItemGroup {
  name: string;
  revenue: number;
  profit: number;
  productIds: Set<string>;
  orderIds: Set<string>;
  dates: string[];
}

function buildEnrichment(g: ItemGroup, periodMonths: number): Pick<
  EntityListItem, 'avgOrder' | 'marginPercent' | 'marginAmount' | 'frequency' | 'lastOrderDate' | 'rep' | 'zone' | 'customerType'
> {
  const orderCount = g.orderIds.size;
  const lastDate = g.dates.length > 0 ? g.dates.reduce((a, b) => a > b ? a : b) : null;
  return {
    avgOrder: orderCount > 0 ? g.revenue / orderCount : 0,
    marginPercent: g.revenue > 0 ? (g.profit / g.revenue) * 100 : 0,
    marginAmount: g.profit,
    frequency: periodMonths >= 1 ? orderCount / periodMonths : null,
    lastOrderDate: lastDate,
    rep: null, zone: null, customerType: null,
  };
}

export function groupByVendor(orders: RawOrder[], periodMonths: number): EntityListItem[] {
  const groups = new Map<string, ItemGroup>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const id = item.Y_1159_5_ESH || 'UNKNOWN';
    const g = groups.get(id) ?? { name: item.Y_1530_5_ESH || id, revenue: 0, profit: 0, productIds: new Set(), orderIds: new Set(), dates: [] };
    g.revenue += item.QPRICE;
    g.profit += item.QPROFIT;
    g.productIds.add(item.PARTNAME);
    g.orderIds.add(o.ORDNAME);
    g.dates.push(o.CURDATE);
    groups.set(id, g);
  }));

  return [...groups.entries()].map(([id, g]) => ({
    id, name: g.name,
    meta1: `${g.productIds.size} products`,
    meta2: `${g.orderIds.size} orders`,
    revenue: g.revenue, orderCount: g.orderIds.size,
    ...buildEnrichment(g, periodMonths),
  }));
}

export function groupByBrand(orders: RawOrder[], periodMonths: number): EntityListItem[] {
  const groups = new Map<string, ItemGroup>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const brand = item.Y_9952_5_ESH || 'Other';
    const g = groups.get(brand) ?? { name: brand, revenue: 0, profit: 0, productIds: new Set(), orderIds: new Set(), dates: [] };
    g.revenue += item.QPRICE;
    g.profit += item.QPROFIT;
    g.productIds.add(item.PARTNAME);
    g.orderIds.add(o.ORDNAME);
    g.dates.push(o.CURDATE);
    groups.set(brand, g);
  }));

  return [...groups.entries()].map(([name, g]) => ({
    id: name, name,
    meta1: `${g.productIds.size} products`,
    meta2: `${g.orderIds.size} orders`,
    revenue: g.revenue, orderCount: g.orderIds.size,
    ...buildEnrichment(g, periodMonths),
  }));
}

export function groupByProductType(orders: RawOrder[], periodMonths: number): EntityListItem[] {
  const groups = new Map<string, ItemGroup & { code: string }>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const name = item.Y_3021_5_ESH || 'Other';
    const g = groups.get(name) ?? { code: item.Y_3020_5_ESH, name, revenue: 0, profit: 0, productIds: new Set(), orderIds: new Set(), dates: [] };
    g.revenue += item.QPRICE;
    g.profit += item.QPROFIT;
    g.productIds.add(item.PARTNAME);
    g.orderIds.add(o.ORDNAME);
    g.dates.push(o.CURDATE);
    groups.set(name, g);
  }));

  return [...groups.entries()].map(([name, g]) => ({
    id: g.code || name, name,
    meta1: `${g.productIds.size} products`,
    meta2: `${g.orderIds.size} orders`,
    revenue: g.revenue, orderCount: g.orderIds.size,
    ...buildEnrichment(g, periodMonths),
  }));
}

export function groupByProduct(orders: RawOrder[], periodMonths: number): EntityListItem[] {
  const groups = new Map<string, ItemGroup & { brand: string }>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const g = groups.get(item.PARTNAME) ?? { name: item.PARTDES, brand: item.Y_9952_5_ESH, revenue: 0, profit: 0, productIds: new Set(), orderIds: new Set(), dates: [] };
    g.revenue += item.QPRICE;
    g.profit += item.QPROFIT;
    g.productIds.add(item.PARTNAME);
    g.orderIds.add(o.ORDNAME);
    g.dates.push(o.CURDATE);
    groups.set(item.PARTNAME, g);
  }));

  return [...groups.entries()].map(([sku, g]) => ({
    id: sku, name: g.name,
    meta1: [sku, g.brand].filter(Boolean).join(' \u00B7 '),
    meta2: `${g.orderIds.size} orders`,
    revenue: g.revenue, orderCount: g.orderIds.size,
    ...buildEnrichment(g, periodMonths),
  }));
}
