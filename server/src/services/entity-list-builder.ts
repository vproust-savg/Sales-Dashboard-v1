// FILE: server/src/services/entity-list-builder.ts
// PURPOSE: Build the left-panel entity list for any dimension. Customer/zone merge master
//   data (full universe) with orders-derived metrics; item-based dims are orders-derived only.
// USED BY: server/src/routes/entities.ts (wired in Task 4.3)
// EXPORTS: buildEntityList, EntityListResult

import type { EntityListItem, Dimension } from '@shared/types/dashboard';
import type { RawCustomer, RawZone } from './priority-queries.js';
import { readOrders } from '../cache/order-cache.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { priorityClient } from './priority-instance.js';
import { fetchCustomers, fetchZones, fetchProducts } from './priority-queries.js';
import type { RawProduct } from '@shared/types/dashboard';
import { groupByDimension } from './dimension-grouper.js';

export interface EntityListResult {
  entities: EntityListItem[];
  yearsAvailable: string[];
  /** true if orders cache was warm (metrics populated). false → stub-only entries. */
  enriched: boolean;
}

/** Build the entity list for a dimension.
 *  - customer: union of master CUSTOMERS with orders-derived metrics (zero-metric stubs when no orders).
 *  - zone: union of master DISTRLINES with orders-derived metrics keyed by ZONECODE.
 *  - vendor/product_type/product: orders-derived only (names come from order items). */
export async function buildEntityList(dimension: Dimension, period: string): Promise<EntityListResult> {
  const cached = await readOrders(period, 'all');
  const orders = cached?.orders ?? [];
  const enriched = cached !== null && orders.length > 0;

  const years = new Set(orders.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
  const yearsAvailable = [...years].sort().reverse();

  const now = new Date();
  const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;

  if (dimension === 'customer') {
    const customersResult = await cachedFetch(
      cacheKey('customers', 'all'),
      getTTL('customers'),
      () => fetchCustomers(priorityClient),
    );
    if (!enriched) {
      return {
        entities: customersResult.data.map(customerStub),
        yearsAvailable,
        enriched: false,
      };
    }
    // WHY prevOrders undefined: left-panel metrics are current-period only; prev-year revenue
    // is added at the dashboard aggregation layer (for the Per-Customer YoY table), not here.
    const enrichedList = groupByDimension('customer', orders, customersResult.data, periodMonths);
    const enrichedById = new Map(enrichedList.map(e => [e.id, e]));
    const merged = customersResult.data.map(c =>
      enrichedById.get(c.CUSTNAME) ?? customerStub(c),
    );
    return { entities: merged, yearsAvailable, enriched: true };
  }

  if (dimension === 'zone') {
    const [zonesResult, customersResult] = await Promise.all([
      cachedFetch(cacheKey('zones', 'all'), getTTL('zones'), () => fetchZones(priorityClient)),
      cachedFetch(cacheKey('customers', 'all'), getTTL('customers'), () => fetchCustomers(priorityClient)),
    ]);
    // WHY dedupe by ZONECODE: DISTRLINES can contain multiple rows per zone (one per distribution
    // line). Collapse to the first row per ZONECODE for the left-panel list.
    const zonesByCode = new Map<string, RawZone>();
    for (const z of zonesResult.data) {
      if (z.ZONECODE && !zonesByCode.has(z.ZONECODE)) zonesByCode.set(z.ZONECODE, z);
    }
    const zoneMasters = [...zonesByCode.values()];

    if (!enriched) {
      return { entities: zoneMasters.map(zoneStub), yearsAvailable, enriched: false };
    }
    const enrichedList = groupByDimension('zone', orders, customersResult.data, periodMonths);
    const enrichedById = new Map(enrichedList.map(e => [e.id, e]));
    const merged = zoneMasters.map(z =>
      enrichedById.get(z.ZONECODE) ?? zoneStub(z),
    );
    return { entities: merged, yearsAvailable, enriched: true };
  }

  // Vendor / product_type / product — entity list is orders-derived only.
  // WHY no master-data merge: names come from order items (Y_1530_5_ESH vendor,
  // Y_3021_5_ESH product_type, PDES product, Y_9952_5_ESH brand on items / SPEC4 on LOGPART).
  // Master data is consumed elsewhere for filter dropdowns.
  if (!enriched) {
    return { entities: [], yearsAvailable, enriched: false };
  }
  const customersResult = await cachedFetch(
    cacheKey('customers', 'all'),
    getTTL('customers'),
    () => fetchCustomers(priorityClient),
  );

  // WHY: Fetch products for the product dimension to populate country of origin in meta1.
  // Other dimensions do not need LOGPART data, so we only fetch when needed.
  let productsByPartname: Map<string, RawProduct> | undefined;
  if (dimension === 'product') {
    const productsResult = await cachedFetch(
      cacheKey('products', 'all'),
      getTTL('products'),
      () => fetchProducts(priorityClient),
    );
    productsByPartname = new Map(productsResult.data.map(p => [p.PARTNAME, p]));
  }

  return {
    entities: groupByDimension(dimension, orders, customersResult.data, periodMonths, undefined, productsByPartname),
    yearsAvailable,
    enriched: true,
  };
}

/** Customer with null metrics (orders not loaded, or customer has zero orders this period).
 *  WHY null vs zero: spec §8 contract — null signals "not loaded," zero means "loaded but no orders."
 *  For the stub path (enriched=false), metrics are genuinely not loaded. For the merge path's
 *  fallback, this is used when the customer exists in master but has no orders this period —
 *  in that case semantics should be zero, but the spec allows null here because a master-only
 *  customer has not been observed in orders. */
function customerStub(c: RawCustomer): EntityListItem {
  return {
    id: c.CUSTNAME,
    name: c.CUSTDES,
    meta1: [c.ZONEDES, c.AGENTNAME].filter(Boolean).join(' \u00B7 '),
    meta2: null,
    revenue: null,
    orderCount: null,
    avgOrder: null,
    marginPercent: null,
    marginAmount: null,
    frequency: null,
    lastOrderDate: null,
    rep: c.AGENTNAME || null,
    zone: c.ZONEDES || null,
    customerType: c.CTYPENAME || null,
    prevYearRevenue: null,
    prevYearRevenueFull: null,
    prevYearOrderCount: null,
    prevYearOrderCountFull: null,
    prevYearAvgOrder: null,
    prevYearAvgOrderFull: null,
    prevYearMarginPercent: null,
    prevYearMarginPercentFull: null,
    prevYearMarginAmount: null,
    prevYearMarginAmountFull: null,
    prevYearFrequency: null,
    prevYearFrequencyFull: null,
  };
}

/** Zone master with null metrics — same semantics as customerStub. */
function zoneStub(z: RawZone): EntityListItem {
  return {
    id: z.ZONECODE,
    name: z.ZONEDES || z.ZONECODE,
    meta1: '',
    meta2: null,
    revenue: null,
    orderCount: null,
    avgOrder: null,
    marginPercent: null,
    marginAmount: null,
    frequency: null,
    lastOrderDate: null,
    rep: null,
    zone: null,
    customerType: null,
    prevYearRevenue: null,
    prevYearRevenueFull: null,
    prevYearOrderCount: null,
    prevYearOrderCountFull: null,
    prevYearAvgOrder: null,
    prevYearAvgOrderFull: null,
    prevYearMarginPercent: null,
    prevYearMarginPercentFull: null,
    prevYearMarginAmount: null,
    prevYearMarginAmountFull: null,
    prevYearFrequency: null,
    prevYearFrequencyFull: null,
  };
}
