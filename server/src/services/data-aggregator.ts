// FILE: server/src/services/data-aggregator.ts
// PURPOSE: Transform raw Priority orders into dashboard-ready payload (KPIs, charts, tables)
// USED BY: server/src/routes/dashboard.ts
// EXPORTS: aggregateOrders

import type { KPIs, MonthlyRevenue, ProductMixSegment, TopSellerItem, OrderRow, ItemCategory, SparklineData } from '@shared/types/dashboard';
import type { RawOrder, RawOrderItem } from './priority-queries.js';
import { ORDER_STATUS_MAP } from '../config/constants.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface AggregateResult {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMix: ProductMixSegment[];
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
  const productMix = computeProductMix(allItems);
  const topSellers = computeTopSellers(allItems);
  const sparklines = computeSparklines(currentOrders);
  const orders = buildOrderRows(currentOrders);
  const items = buildItemCategories(allItems);

  return { kpis, monthlyRevenue, productMix, topSellers, sparklines, orders, items };
}

/** Spec Section 10.1 — KPI formulas */
function computeKPIs(
  orders: RawOrder[],
  prevOrders: RawOrder[],
  items: RawOrderItem[],
  prevItems: RawOrderItem[],
  period: string,
): KPIs {
  const totalRevenue = orders.reduce((sum, o) => sum + o.TOTPRICE, 0);
  const prevRevenue = prevOrders.reduce((sum, o) => sum + o.TOTPRICE, 0);
  const orderCount = orders.length;

  const totalItemRevenue = items.reduce((sum, i) => sum + i.QPRICE, 0);
  const totalProfit = items.reduce((sum, i) => sum + i.QPROFIT, 0);

  const now = new Date();
  const monthsInPeriod = period === 'ytd'
    ? Math.max(1, now.getMonth() + 1)
    : 12;

  // Quarter calculations
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const qStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
  const prevQStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
  const thisQuarterRevenue = orders
    .filter(o => new Date(o.CURDATE) >= qStart)
    .reduce((sum, o) => sum + o.TOTPRICE, 0);
  const lastQuarterRevenue = orders
    .filter(o => { const d = new Date(o.CURDATE); return d >= prevQStart && d < qStart; })
    .reduce((sum, o) => sum + o.TOTPRICE, 0);

  // Best month
  const monthRevenues = new Array(12).fill(0) as number[];
  orders.forEach(o => { monthRevenues[new Date(o.CURDATE).getUTCMonth()] += o.TOTPRICE; });
  const bestMonthIdx = monthRevenues.indexOf(Math.max(...monthRevenues));

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

  return {
    totalRevenue,
    prevYearRevenue: prevRevenue,
    revenueChangePercent,
    revenueChangeAmount: totalRevenue - prevRevenue,
    thisQuarterRevenue,
    lastQuarterRevenue,
    bestMonth: { name: MONTH_NAMES[bestMonthIdx] ?? 'N/A', amount: monthRevenues[bestMonthIdx] ?? 0 },
    orders: orderCount,
    ordersChange: orderCount - prevOrders.length,
    avgOrder: orderCount > 0 ? totalRevenue / orderCount : null,
    marginPercent: currentMarginPct,
    marginAmount: totalProfit,
    marginChangepp: currentMarginPct !== null && prevMarginPct !== null
      ? currentMarginPct - prevMarginPct : null,
    frequency: orderCount > 0 ? orderCount / monthsInPeriod : null,
    frequencyChange: null, // Computed on client from avg across all entities
    lastOrderDays,
    fillRate: null, // Requires delivered qty data not yet mapped
    fillRateChangepp: null,
  };
}

/** Spec Section 20.1 — 12 months, current vs previous year */
function computeMonthlyRevenue(current: RawOrder[], prev: RawOrder[]): MonthlyRevenue[] {
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

/** Spec Section 20.2 — Group by family type, max 7 segments */
function computeProductMix(items: RawOrderItem[]): ProductMixSegment[] {
  const byCategory = new Map<string, number>();
  items.forEach(item => {
    const cat = item.Y_3021_5_ESH || 'Other';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + item.QPRICE);
  });

  const total = items.reduce((sum, i) => sum + i.QPRICE, 0);
  const sorted = [...byCategory.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([category, value]) => ({
      category,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0,
    }));

  // Collapse 7+ into "Other"
  if (sorted.length > 7) {
    const top6 = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    const otherValue = rest.reduce((sum, s) => sum + s.value, 0);
    top6.push({ category: 'Other', value: otherValue, percentage: total > 0 ? Math.round((otherValue / total) * 100) : 0 });
    return top6;
  }

  return sorted;
}

/** Spec Section 22.5 — Top 10 by revenue, aggregated by SKU */
function computeTopSellers(items: RawOrderItem[]): TopSellerItem[] {
  const bySku = new Map<string, { name: string; sku: string; revenue: number; units: number }>();
  items.forEach(item => {
    const existing = bySku.get(item.PARTNAME);
    if (existing) {
      existing.revenue += item.QPRICE;
      existing.units += item.TQUANT;
    } else {
      bySku.set(item.PARTNAME, {
        name: item.PARTDES,
        sku: item.PARTNAME,
        revenue: item.QPRICE,
        units: item.TQUANT,
      });
    }
  });

  return [...bySku.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((item, i) => ({ ...item, rank: i + 1 }));
}

/** Spec Section 20.3 — last 6 months of revenue for sparklines */
function computeSparklines(orders: RawOrder[]): Record<string, SparklineData> {
  const now = new Date();
  const months: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.getFullYear() * 12 + d.getMonth());
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
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
          bySku.set(item.PARTNAME, { name: item.PARTDES, sku: item.PARTNAME, value: item.QPRICE, profit: item.QPROFIT });
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
