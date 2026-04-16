// FILE: server/src/services/order-transforms.ts
// PURPOSE: Order-to-row transformations used by the dashboard aggregator.
// USED BY: server/src/services/data-aggregator.ts
// EXPORTS: buildFlatItems

import type { RawOrder } from './priority-queries.js';
import type { FlatItem } from '@shared/types/dashboard';

/** WHY: Accepts RawOrder[] (not flattened items) to preserve order-level context
 * (ORDNAME, CURDATE) needed for per-SKU frequency, lastOrderDate, lastPrice.
 * Pattern from dimension-grouper-items.ts groupByProduct. */
export function buildFlatItems(
  orders: RawOrder[],
  prevOrders: RawOrder[],
  period: string,
): FlatItem[] {
  // Phase 1: Build current-period accumulator per SKU
  const bySku = new Map<string, {
    name: string; sku: string; value: number; profit: number;
    totalUnits: number; unitName: string; lastPrice: number; lastOrderDate: string;
    orderIds: Set<string>;
    productType: string; productFamily: string; brand: string;
    countryOfOrigin: string; foodServiceRetail: string; vendor: string;
  }>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const existing = bySku.get(item.PARTNAME);
    if (existing) {
      existing.value += item.QPRICE;
      existing.profit += item.QPROFIT;
      existing.totalUnits += item.TQUANT;
      existing.orderIds.add(o.ORDNAME);
      // WHY: Track latest order date + price for "last purchase" display
      if (o.CURDATE > existing.lastOrderDate) {
        existing.lastOrderDate = o.CURDATE;
        existing.lastPrice = item.PRICE;
      }
    } else {
      bySku.set(item.PARTNAME, {
        name: item.PDES,
        sku: item.PARTNAME,
        value: item.QPRICE,
        profit: item.QPROFIT,
        totalUnits: item.TQUANT,
        unitName: item.TUNITNAME || 'units',
        lastPrice: item.PRICE,
        lastOrderDate: o.CURDATE,
        orderIds: new Set([o.ORDNAME]),
        productType: item.Y_3021_5_ESH || 'Other',
        productFamily: item.Y_2075_5_ESH || 'Other',
        brand: item.Y_9952_5_ESH || 'Other',
        countryOfOrigin: item.Y_5380_5_ESH || 'Other',
        foodServiceRetail: item.Y_9967_5_ESH === 'Y' ? 'Retail' : 'Food Service',
        vendor: item.Y_1530_5_ESH || 'Other',
      });
    }
  }));

  // Phase 2: Build prev-year lookup per SKU (only 6 fields available on prev items)
  const prevBySku = new Map<string, { value: number; profit: number; units: number }>();
  prevOrders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const existing = prevBySku.get(item.PARTNAME);
    if (existing) {
      existing.value += item.QPRICE;
      existing.profit += item.QPROFIT;
      existing.units += (item.TQUANT ?? 0);
    } else {
      prevBySku.set(item.PARTNAME, {
        value: item.QPRICE,
        profit: item.QPROFIT,
        units: item.TQUANT ?? 0,
      });
    }
  }));

  // Phase 3: Merge and return FlatItem[]
  const now = new Date();
  const periodMonths = period === 'ytd'
    ? Math.max(1, now.getUTCMonth() + 1)
    : 12;

  return [...bySku.values()].map(p => {
    const prev = prevBySku.get(p.sku);
    return {
      name: p.name,
      sku: p.sku,
      value: p.value,
      marginPercent: p.value > 0 ? (p.profit / p.value) * 100 : 0,
      marginAmount: p.profit,
      productType: p.productType,
      productFamily: p.productFamily,
      brand: p.brand,
      countryOfOrigin: p.countryOfOrigin,
      foodServiceRetail: p.foodServiceRetail,
      vendor: p.vendor,
      totalUnits: p.totalUnits,
      unitName: p.unitName,
      lastPrice: p.lastPrice,
      purchaseFrequency: periodMonths > 0 ? p.orderIds.size / periodMonths : 0,
      lastOrderDate: p.lastOrderDate,
      prevYearValue: prev?.value ?? 0,
      prevYearMarginPercent: prev && prev.value > 0 ? (prev.profit / prev.value) * 100 : 0,
      prevYearUnits: prev?.units ?? 0,
    };
  });
}
