// FILE: server/src/services/data-aggregator.ts
// PURPOSE: Transform raw Priority orders into dashboard-ready payload (KPIs, charts, tables)
// USED BY: server/src/routes/dashboard.ts
// EXPORTS: aggregateOrders

import type { KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType, TopSellerItem, OrderRow, ItemCategory, SparklineData } from '@shared/types/dashboard';
import type { RawOrder, RawOrderItem } from './priority-queries.js';
import { ORDER_STATUS_MAP } from '../config/constants.js';
import { computeKPIs, computeMonthlyRevenue, computeSparklines } from './kpi-aggregator.js';

interface AggregateResult {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: ItemCategory[];
}

export function aggregateOrders(
  currentOrders: RawOrder[],
  prevOrders: RawOrder[],
  period: string,
): AggregateResult {
  const allItems = currentOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
  const prevItems = prevOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);

  const kpis = computeKPIs(currentOrders, prevOrders, allItems, prevItems, period);
  const monthlyRevenue = computeMonthlyRevenue(currentOrders, prevOrders);
  const productMixes = computeAllProductMixes(allItems);
  const topSellers = computeTopSellers(allItems);
  const sparklines = computeSparklines(currentOrders);
  const orders = buildOrderRows(currentOrders);
  const items = buildItemCategories(allItems);

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
      status: (ORDER_STATUS_MAP[o.ORDSTATUSDES] ?? 'Processing') as OrderRow['status'],
    }));
    // WHY: Client-side OrdersTable handles sorting — users can change direction
}

function computeOrderMarginPct(order: RawOrder): number {
  const items = order.ORDERITEMS_SUBFORM ?? [];
  const revenue = items.reduce((s, i) => s + i.QPRICE, 0);
  const profit = items.reduce((s, i) => s + i.QPROFIT, 0);
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}

/** Spec Section 4.4 — Items grouped by category (Y_3021_5_ESH) */
function buildItemCategories(items: RawOrderItem[]): ItemCategory[] {
  const byCategory = new Map<string, RawOrderItem[]>();
  items.forEach(item => {
    const cat = item.Y_3021_5_ESH || 'Other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(item);
  });

  return [...byCategory.entries()]
    .map(([category, catItems]) => {
      const totalValue = catItems.reduce((s, i) => s + i.QPRICE, 0);
      const totalProfit = catItems.reduce((s, i) => s + i.QPROFIT, 0);

      // Aggregate by SKU within category
      const bySku = new Map<string, { name: string; sku: string; value: number; profit: number }>();
      catItems.forEach(item => {
        const existing = bySku.get(item.PARTNAME);
        if (existing) {
          existing.value += item.QPRICE;
          existing.profit += item.QPROFIT;
        } else {
          bySku.set(item.PARTNAME, { name: item.PDES, sku: item.PARTNAME, value: item.QPRICE, profit: item.QPROFIT });
        }
      });

      const products = [...bySku.values()]
        .sort((a, b) => b.value - a.value)
        .map(p => ({
          name: p.name,
          sku: p.sku,
          value: p.value,
          marginPercent: p.value > 0 ? (p.profit / p.value) * 100 : 0,
          marginAmount: p.profit,
        }));

      return {
        category,
        totalValue,
        marginPercent: totalValue > 0 ? (totalProfit / totalValue) * 100 : 0,
        marginAmount: totalProfit,
        itemCount: products.length,
        products,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);
}
