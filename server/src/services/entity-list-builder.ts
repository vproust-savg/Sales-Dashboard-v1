// FILE: server/src/services/entity-list-builder.ts
// PURPOSE: Build the left-panel entity list for any dimension. Every dimension merges master
//   data (full universe) with orders-derived metrics, returning stubs when orders are cold.
// USED BY: server/src/routes/entities.ts (wired in Task 4.3)
// EXPORTS: buildEntityList, EntityListResult

import type { EntityListItem, Dimension } from '@shared/types/dashboard';
import type { RawZone } from './priority-queries.js';
import { readOrders } from '../cache/order-cache.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { priorityClient } from './priority-instance.js';
import { fetchCustomers, fetchZones, fetchVendors, fetchProductTypes, fetchProducts } from './priority-queries.js';
import { groupByDimension } from './dimension-grouper.js';
import {
  customerStub,
  zoneStub,
  vendorStub,
  productTypeStub,
  productStub,
  brandStub,
  brandMasters,
} from './entity-list-stubs.js';

export interface EntityListResult {
  entities: EntityListItem[];
  yearsAvailable: string[];
  /** true if orders cache was warm (metrics populated). false → stub-only entries. */
  enriched: boolean;
}

/** Build the entity list for a dimension.
 *  - customer: union of master CUSTOMERS with orders-derived metrics (zero-metric stubs when no orders).
 *  - zone: union of master DISTRLINES with orders-derived metrics keyed by ZONECODE.
 *  - vendor/brand/product_type/product: union of warmed master data with orders-derived metrics. */
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

  if (dimension === 'vendor') {
    const vendorsResult = await cachedFetch(
      cacheKey('vendors', 'all'),
      getTTL('vendors'),
      () => fetchVendors(priorityClient),
    );
    if (!enriched) {
      return { entities: vendorsResult.data.map(vendorStub), yearsAvailable, enriched: false };
    }
    return {
      entities: mergeMasterEntities(
        vendorsResult.data,
        (vendor) => vendor.SUPNAME,
        vendorStub,
        groupByDimension('vendor', orders, [], periodMonths),
      ),
      yearsAvailable,
      enriched: true,
    };
  }

  if (dimension === 'product_type') {
    const productTypesResult = await cachedFetch(
      cacheKey('product_types', 'all'),
      getTTL('product_types'),
      () => fetchProductTypes(priorityClient),
    );
    if (!enriched) {
      return { entities: productTypesResult.data.map(productTypeStub), yearsAvailable, enriched: false };
    }
    return {
      entities: mergeMasterEntities(
        productTypesResult.data,
        (productType) => productType.FTCODE,
        productTypeStub,
        groupByDimension('product_type', orders, [], periodMonths),
      ),
      yearsAvailable,
      enriched: true,
    };
  }

  if (dimension === 'product' || dimension === 'brand') {
    const productsResult = await cachedFetch(
      cacheKey('products', 'all'),
      getTTL('products'),
      () => fetchProducts(priorityClient),
    );
    if (dimension === 'brand') {
      const brands = brandMasters(productsResult.data);
      if (!enriched) {
        return { entities: brands.map(brandStub), yearsAvailable, enriched: false };
      }
      return {
        entities: mergeMasterEntities(
          brands,
          (brand) => brand,
          brandStub,
          groupByDimension('brand', orders, [], periodMonths),
        ),
        yearsAvailable,
        enriched: true,
      };
    }

    const productsByPartname = new Map(productsResult.data.map(product => [product.PARTNAME, product]));
    if (!enriched) {
      return { entities: productsResult.data.map(productStub), yearsAvailable, enriched: false };
    }
    return {
      entities: mergeMasterEntities(
        productsResult.data,
        (product) => product.PARTNAME,
        productStub,
        groupByDimension('product', orders, [], periodMonths, undefined, productsByPartname),
      ),
      yearsAvailable,
      enriched: true,
    };
  }

  return { entities: [], yearsAvailable, enriched };
}
function mergeMasterEntities<T>(
  masters: T[],
  idOf: (raw: T) => string,
  stubOf: (raw: T) => EntityListItem,
  enrichedEntities: EntityListItem[],
): EntityListItem[] {
  const enrichedById = new Map(enrichedEntities.map(entity => [entity.id, entity]));
  return masters.map(master => enrichedById.get(idOf(master)) ?? stubOf(master));
}
