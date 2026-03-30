// FILE: server/src/cache/cache-keys.ts
// PURPOSE: Cache key schema and TTL mapping — spec Section 19.1
// USED BY: server/src/cache/cache-layer.ts
// EXPORTS: cacheKey, getTTL

import { CACHE_TTLS } from '../config/constants.js';

type CacheEntity = 'orders_ytd' | 'orders_year' | 'customers' | 'zones' | 'agents' | 'vendors' | 'contacts' | 'years_available';

/** Build a cache key: dashboard:{entity}:{period}:{qualifier} */
export function cacheKey(entity: CacheEntity, period: string, qualifier = ''): string {
  const parts = ['dashboard', entity, period];
  if (qualifier) parts.push(qualifier);
  return parts.join(':');
}

export function getTTL(entity: CacheEntity): number {
  return CACHE_TTLS[entity];
}
