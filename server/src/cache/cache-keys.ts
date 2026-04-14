// FILE: server/src/cache/cache-keys.ts
// PURPOSE: Cache key schema and TTL mapping — spec Section 19.1
// USED BY: server/src/cache/cache-layer.ts, server/src/routes/fetch-all.ts, server/src/routes/dashboard.ts
// EXPORTS: cacheKey, getTTL, buildFilterQualifier, buildFilterHash

import { CACHE_TTLS } from '../config/constants.js';

type CacheEntity = 'orders_ytd' | 'orders_year' | 'customers' | 'zones' | 'agents' | 'vendors' | 'contacts' | 'years_available' | 'entities_summary' | 'entity_detail' | 'entities_full' | 'orders_raw' | 'orders_raw_meta' | 'report2_payload';

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

/** Build a stable filter hash used in raw-orders cache keys.
 * WHY: Must produce identical output for both the writer (fetch-all SSE) and the reader
 * (dashboard.ts consolidated fast path). Previously each route built its own hash — the
 * reader hardcoded 'all' while the writer used actual filter values, so keys never matched. */
export function buildFilterHash(agentName?: string, zone?: string, customerType?: string): string {
  const parts: string[] = [];
  if (agentName) parts.push(`agent=${agentName}`);
  if (zone) parts.push(`zone=${zone}`);
  if (customerType) parts.push(`type=${customerType}`);
  return parts.length > 0 ? parts.join('&') : 'all';
}

export function getTTL(entity: CacheEntity): number {
  return CACHE_TTLS[entity];
}
