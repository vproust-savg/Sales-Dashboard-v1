// FILE: server/src/services/data-aggregator.ts
// PURPOSE: Transform raw Priority orders into dashboard-ready payload (KPIs, charts, tables)
// USED BY: server/src/routes/dashboard.ts
// EXPORTS: aggregateOrders

import type { KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType, TopSellerItem, OrderRow, FlatItem, SparklineData } from '@shared/types/dashboard';
import type { RawOrder, RawOrderItem } from './priority-queries.js';
import { computeKPIs, computeMonthlyRevenue, computeSparklines } from './kpi-aggregator.js';

interface AggregateResult {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: FlatItem[];
}

export function aggregateOrders(
  currentOrders: RawOrder[],
  prevOrders: RawOrder[],
  period: string,
): AggregateResult {
  /** WHY: $0 orders are noise — no revenue, no margin contribution. Filter before all downstream
   * consumers so both order rows and KPI counts are consistent. Negative totals (credit memos) kept. */
  const nonZeroOrders = currentOrders.filter(o => o.TOTPRICE !== 0);
  const allItems = nonZeroOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
  const prevItems = prevOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);

  const kpis = computeKPIs(nonZeroOrders, prevOrders, allItems, prevItems, period);
  const monthlyRevenue = computeMonthlyRevenue(nonZeroOrders, prevOrders);
  const productMixes = computeAllProductMixes(allItems);
  const topSellers = computeTopSellers(allItems);
  const sparklines = computeSparklines(nonZeroOrders);
  const orders = buildOrderRows(nonZeroOrders);
  const items = buildFlatItems(nonZeroOrders, prevOrders, period);

  return { kpis, monthlyRevenue, productMixes, topSellers, sparklines, orders, items };
}

/** Spec Section 20.2 — Group items by a category field, max 7 segments */
function computeProductMix(
  items: RawOrderItem[],
  getCategory: (item: RawOrderItem) => string,
): ProductMixSegment[] {
  const byCategory = new Map<string, number>();
  items.forEach(item => {
    const cat = getCategory(item) || 'Other';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + item.QPRICE);
  });

  const total = items.reduce((sum, i) => sum + i.QPRICE, 0);
  const sorted = [...byCategory.entries()]
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([category, value]) => ({
      category,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0,
    }));

  if (sorted.length > 7) {
    const top6 = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    const otherValue = rest.reduce((sum, s) => sum + s.value, 0);
    top6.push({ category: 'Other', value: otherValue, percentage: total > 0 ? Math.round((otherValue / total) * 100) : 0 });
    return top6;
  }

  return sorted;
}

/** Compute all 5 product mix breakdowns in a single pass concept */
function computeAllProductMixes(items: RawOrderItem[]): Record<ProductMixType, ProductMixSegment[]> {
  return {
    productType: computeProductMix(items, i => i.Y_3021_5_ESH),
    productFamily: computeProductMix(items, i => i.Y_2075_5_ESH),
    brand: computeProductMix(items, i => i.Y_9952_5_ESH),
    countryOfOrigin: computeProductMix(items, i => i.Y_5380_5_ESH),
    foodServiceRetail: computeProductMix(items, i => i.Y_9967_5_ESH === 'Y' ? 'Retail' : 'Food Service'),
  };
}

/** Spec Section 22.5 — Top 25 by revenue, aggregated by SKU, with unit of measure */
function computeTopSellers(items: RawOrderItem[]): TopSellerItem[] {
  const bySku = new Map<string, { name: string; sku: string; revenue: number; units: number; unit: string }>();
  items.forEach(item => {
    const existing = bySku.get(item.PARTNAME);
    if (existing) {
      existing.revenue += item.QPRICE;
      existing.units += item.TQUANT;
    } else {
      bySku.set(item.PARTNAME, {
        name: item.PDES,
        sku: item.PARTNAME,
        revenue: item.QPRICE,
        units: item.TQUANT,
        unit: item.TUNITNAME || 'units',
      });
    }
  });

  return [...bySku.values()]
    .filter(item => item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 25)
    .map((item, i) => ({ ...item, rank: i + 1 }));
}

/** Spec Section 10.4 + 13.6 — Order table rows */
function buildOrderRows(orders: RawOrder[]): OrderRow[] {
  return orders
    .map(o => ({
      date: o.CURDATE,
      orderNumber: o.ORDNAME,
      itemCount: o.ORDERITEMS_SUBFORM?.length ?? 0,
      amount: o.TOTPRICE,
      marginPercent: computeOrderMarginPct(o),
      marginAmount: (o.ORDERITEMS_SUBFORM ?? []).reduce((s, i) => s + i.QPROFIT, 0),
      status: o.ORDSTATUSDES as OrderRow['status'],
      items: (o.ORDERITEMS_SUBFORM ?? [])
        .map(i => ({
          productName: i.PDES,
          sku: i.PARTNAME,
          quantity: i.TQUANT,
          unit: i.TUNITNAME || 'units',
          unitPrice: i.PRICE,
          lineTotal: i.QPRICE,
          marginPercent: i.PERCENT,
        }))
        .sort((a, b) => b.lineTotal - a.lineTotal),
    }));
    // WHY: Client-side OrdersTable handles sorting — users can change direction
}

function computeOrderMarginPct(order: RawOrder): number {
  const items = order.ORDERITEMS_SUBFORM ?? [];
  const revenue = items.reduce((s, i) => s + i.QPRICE, 0);
  const profit = items.reduce((s, i) => s + i.QPROFIT, 0);
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}

/** WHY: Accepts RawOrder[] (not flattened items) to preserve order-level context
 * (ORDNAME, CURDATE) needed for per-SKU frequency, lastOrderDate, lastPrice.
 * Pattern from dimension-grouper-items.ts groupByProduct. */
function buildFlatItems(
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
