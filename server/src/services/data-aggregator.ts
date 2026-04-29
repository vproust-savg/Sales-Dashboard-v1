// FILE: server/src/services/data-aggregator.ts
// PURPOSE: Transform raw Priority orders into dashboard-ready payload (KPIs, charts, tables)
// USED BY: server/src/routes/dashboard.ts, server/src/routes/fetch-all.ts
// EXPORTS: aggregateOrders, AggregateOptions

import type { KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType, TopSellerItem, OrderRow, FlatItem, SparklineData, Dimension } from '@shared/types/dashboard';
import type { RawOrder, RawOrderItem, RawCustomer } from './priority-queries.js';
import { computeKPIs, computeMonthlyRevenue, computeSparklines } from './kpi-aggregator.js';
import { buildFlatItems } from './order-transforms.js';
import { scopeOrders } from './entity-subset-filter.js';

interface AggregateResult {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: FlatItem[];
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
  perEntityMonthlyRevenue?: Record<string, MonthlyRevenue[]>;
}

export interface AggregateOptions {
  /** When true, populate customerName on OrderRow using the customers lookup. */
  preserveEntityIdentity?: boolean;
  /** Customer lookup used to resolve CUSTNAME → CUSTDES and required for scope's zone dim. */
  customers?: RawCustomer[];
  /** Consolidated-mode scope. When set:
   *  - Global view: orders pre-filtered via scopeOrders(rawOrders, dim, entityIds, customers).
   *  - When entityIds.length > 1, perEntity{ProductMixes,TopSellers,MonthlyRevenue} populated
   *    via per-entity loop (Codex finding #2 fix).
   *  WHY: pre-filter normalization keeps downstream aggregators dimension-agnostic. They sum
   *  TOTPRICE; scopeOrders rewrites TOTPRICE for item-based dims so those sums stay correct. */
  scope?: {
    dimension: Dimension;
    entityIds: string[];
  };
}

export function aggregateOrders(
  rawOrders: RawOrder[],
  rawPrevOrders: RawOrder[],
  period: string,
  opts?: AggregateOptions,
): AggregateResult {
  // WHY throw: scope without customers silently bypasses all scoping and returns unscoped
  // data — a correctness landmine. Require both together so the type-absence is a loud
  // failure at the boundary, not a quiet wrong answer downstream.
  if (opts?.scope && !opts.customers) {
    throw new Error('aggregateOrders: opts.scope requires opts.customers');
  }

  // WHY scope pre-filter: keeps downstream aggregators dimension-agnostic. scopeOrders
  // narrows item-based dims and rewrites TOTPRICE = Σ QPRICE of in-scope items.
  const currentOrders = opts?.scope && opts.customers
    ? scopeOrders(rawOrders, opts.scope.dimension, new Set(opts.scope.entityIds), opts.customers)
    : rawOrders;
  const prevOrders = opts?.scope && opts.customers
    ? scopeOrders(rawPrevOrders, opts.scope.dimension, new Set(opts.scope.entityIds), opts.customers)
    : rawPrevOrders;

  /** WHY: $0 orders are noise — no revenue, no margin contribution. Filter before all downstream
   * consumers so both order rows and KPI counts are consistent. Negative totals (credit memos) kept. */
  const nonZeroOrders = currentOrders.filter(o => o.TOTPRICE !== 0);
  const allItems = nonZeroOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
  const prevItems = prevOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);

  const custMap = opts?.preserveEntityIdentity && opts?.customers
    ? new Map(opts.customers.map(c => [c.CUSTNAME, c.CUSTDES]))
    : null;

  const kpis = computeKPIs(nonZeroOrders, prevOrders, allItems, prevItems, period);
  const monthlyRevenue = computeMonthlyRevenue(nonZeroOrders, prevOrders);
  const productMixes = computeAllProductMixes(allItems);
  const topSellers = computeTopSellers(allItems);
  const sparklines = computeSparklines(nonZeroOrders);
  const orders = buildOrderRows(nonZeroOrders, custMap);
  const items = buildFlatItems(nonZeroOrders, prevOrders, period);

  const result: AggregateResult = { kpis, monthlyRevenue, productMixes, topSellers, sparklines, orders, items };

  if (opts?.scope && opts.customers && opts.scope.entityIds.length > 1) {
    const perEntityProductMixes: Record<string, Record<ProductMixType, ProductMixSegment[]>> = {};
    const perEntityTopSellers: Record<string, TopSellerItem[]> = {};
    const perEntityMonthlyRevenue: Record<string, MonthlyRevenue[]> = {};
    for (const entityId of opts.scope.entityIds) {
      // WHY scope from rawOrders (not currentOrders): each entity needs its OWN filtered view
      // from the unscoped source. Using currentOrders would double-filter (harmless but wasteful
      // for item-based dims) and would need re-rewriting TOTPRICE per entity.
      const perCurrent = scopeOrders(rawOrders, opts.scope.dimension, new Set([entityId]), opts.customers);
      const perPrev = scopeOrders(rawPrevOrders, opts.scope.dimension, new Set([entityId]), opts.customers);
      const perNonZero = perCurrent.filter(o => o.TOTPRICE !== 0);
      const perItems = perNonZero.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
      perEntityProductMixes[entityId] = computeAllProductMixes(perItems);
      perEntityTopSellers[entityId] = computeTopSellers(perItems);
      perEntityMonthlyRevenue[entityId] = computeMonthlyRevenue(perNonZero, perPrev);
    }
    result.perEntityProductMixes = perEntityProductMixes;
    result.perEntityTopSellers = perEntityTopSellers;
    result.perEntityMonthlyRevenue = perEntityMonthlyRevenue;
  }

  return result;
}

/** Spec Section 20.2 — Group items by a category field, max 15 segments (top 14 named + Other) */
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

  if (sorted.length > 15) {
    const top14 = sorted.slice(0, 14);
    const rest = sorted.slice(14);
    const otherValue = rest.reduce((sum, s) => sum + s.value, 0);
    top14.push({ category: 'Other', value: otherValue, percentage: total > 0 ? Math.round((otherValue / total) * 100) : 0 });
    return top14;
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

/** Top 100 by revenue, aggregated by SKU, with unit of measure. Modal slices client-side to user's selected topN (20/50/100). */
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
    .slice(0, 100)
    .map((item, i) => ({ ...item, rank: i + 1 }));
}

/** Spec Section 10.4 + 13.6 — Order table rows */
function buildOrderRows(orders: RawOrder[], custMap: Map<string, string> | null): OrderRow[] {
  return orders
    .map(o => {
      const row: OrderRow = {
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
      };
      if (custMap) {
        row.customerName = custMap.get(o.CUSTNAME) ?? o.CUSTNAME;
      }
      return row;
    });
    // WHY: Client-side OrdersTable handles sorting — users can change direction
}

function computeOrderMarginPct(order: RawOrder): number {
  const items = order.ORDERITEMS_SUBFORM ?? [];
  const revenue = items.reduce((s, i) => s + i.QPRICE, 0);
  const profit = items.reduce((s, i) => s + i.QPROFIT, 0);
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}
