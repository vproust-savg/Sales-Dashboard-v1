// FILE: server/src/cache/cache-keys.ts
// PURPOSE: Cache key schema and TTL mapping — spec Section 19.1
// USED BY: server/src/cache/cache-layer.ts, server/src/routes/fetch-all.ts, server/src/routes/dashboard.ts, server/src/cache/order-cache.ts
// EXPORTS: cacheKey, getTTL, buildFilterQualifier, buildFilterHash, FilterHashInput, buildEntitySetHash, orderKey, orderIndexKey, orderMetaKey

import { CACHE_TTLS } from '../config/constants.js';

type CacheEntity = 'orders_ytd' | 'orders_year' | 'customers' | 'zones' | 'agents' | 'vendors' | 'contacts' | 'years_available' | 'entities_summary' | 'entity_detail' | 'entities_full' | 'orders_raw' | 'orders_raw_meta' | 'report_payload' | 'product_types' | 'products' | 'revidx' | 'customer_types';

/** Build a cache key: dashboard:{entity}:{period}:{qualifier} */
export function cacheKey(entity: CacheEntity, period: string, qualifier = ''): string {
  const parts = ['dashboard', entity, period];
  if (qualifier) parts.push(qualifier);
  return parts.join(':');
}

/** Combine dimension + filter hash into a cache key qualifier.
 * WHY: Ensures filtered and unfiltered cache entries use distinct keys.
 * Without this, filtered fetch-all results overwrite unfiltered data. */
export function buildFilterQualifier(groupBy: string, filterHash: string): string {
  return `${groupBy}:${filterHash}`;
}

export interface FilterHashInput {
  agentName?: string;
  zone?: string;
  customerType?: string;
  brand?: string;
  productFamily?: string;
  countryOfOrigin?: string;
  foodServiceRetail?: string;
}

/** Build a stable filter hash used in raw-orders cache keys.
 * WHY: Must produce identical output for both the writer (fetch-all SSE) and the reader
 * (dashboard.ts consolidated fast path). Previously each route built its own hash — the
 * reader hardcoded 'all' while the writer used actual filter values, so keys never matched.
 * Object-form signature: positional would be unreadable with 7+ filter fields. */
export function buildFilterHash(input: FilterHashInput): string {
  const parts: string[] = [];
  if (input.agentName) parts.push(`agent=${input.agentName}`);
  if (input.zone) parts.push(`zone=${input.zone}`);
  if (input.customerType) parts.push(`type=${input.customerType}`);
  if (input.brand) parts.push(`brand=${input.brand}`);
  if (input.productFamily) parts.push(`family=${input.productFamily}`);
  if (input.countryOfOrigin) parts.push(`country=${input.countryOfOrigin}`);
  if (input.foodServiceRetail) parts.push(`fsr=${input.foodServiceRetail}`);
  return parts.length > 0 ? parts.join('&') : 'all';
}

/** Canonical hash for an entity-id set. Sort-invariant. WHY: same (dimension, entityIds)
 *  set must always produce the same cache key regardless of input ordering.
 *  WHY exported now: consumed by Task 1.3's scopeOrders and Task 4.2's entity-list-builder
 *  caching layer. Foundation export — no production callers in this commit. */
export function buildEntitySetHash(ids: string[]): string {
  if (ids.length === 0) return 'empty';
  return [...ids].sort().join(',');
}

/** Per-order Redis key. WHY: Orders are shared across periods/filters — top-level namespace. */
export function orderKey(ordname: string): string {
  return `order:${ordname}`;
}

/** Index key listing all ORDNAME IDs for a period/filter scope. */
export function orderIndexKey(period: string, filterHash: string): string {
  return `orders:idx:${period}:${filterHash}`;
}

/** Meta key with lastFetchDate and orderCount for a period/filter scope. */
export function orderMetaKey(period: string, filterHash: string): string {
  return `orders:meta:${period}:${filterHash}`;
}

export function getTTL(entity: CacheEntity): number {
  return CACHE_TTLS[entity];
}
