// FILE: server/src/cache/cache-keys.ts
// PURPOSE: Cache key schema and TTL mapping — spec Section 19.1
// USED BY: server/src/cache/cache-layer.ts
// EXPORTS: cacheKey, getTTL, buildFilterQualifier

import { CACHE_TTLS } from '../config/constants.js';

type CacheEntity = 'orders_ytd' | 'orders_year' | 'customers' | 'zones' | 'agents' | 'vendors' | 'contacts' | 'years_available' | 'entities_summary' | 'entity_detail' | 'entities_full' | 'orders_raw' | 'orders_raw_meta';

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

export function getTTL(entity: CacheEntity): number {
  return CACHE_TTLS[entity];
}
