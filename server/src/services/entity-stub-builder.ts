// FILE: server/src/services/entity-stub-builder.ts
// PURPOSE: Derive entity list stubs from cached warm-cache orders for non-customer dimensions
// USED BY: server/src/routes/entities.ts (cold cache fallback)
// EXPORTS: deriveEntityStubs

import { redis } from '../cache/redis-client.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { fetchCustomers } from './priority-queries.js';
import { priorityClient } from './priority-instance.js';
import { groupByDimension } from './dimension-grouper.js';
import type { RawOrder, RawCustomer } from './priority-queries.js';
import type { Dimension, EntityListItem } from '@shared/types/dashboard';

interface EntityStubResult {
  entities: EntityListItem[];
  yearsAvailable: string[];
}

/**
 * Derive entity stubs from the warm-cache orders_ytd data.
 * WHY: Non-customer dimensions need order data to group. The warm cache
 * already has this in Redis — use it instead of returning an empty panel.
 * Returns null if orders_ytd is not yet cached (rare — warm cache runs on startup).
 */
export async function deriveEntityStubs(
  groupBy: Dimension,
  period: string,
): Promise<EntityStubResult | null> {
  const ordersKey = cacheKey('orders_ytd', 'ytd');
  const ordersCached = await redis.get(ordersKey);
  if (!ordersCached) {
    console.warn('[entity-stub-builder] orders_ytd cache miss — warm cache may not have run yet');
    return null;
  }

  const envelope = typeof ordersCached === 'string' ? JSON.parse(ordersCached) : ordersCached;
  const orders: RawOrder[] = (envelope as { data: RawOrder[] }).data;

  const customersResult = await cachedFetch<RawCustomer[]>(
    cacheKey('customers', 'all'), getTTL('customers'),
    () => fetchCustomers(priorityClient),
  );

  const now = new Date();
  const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
  const entities = groupByDimension(groupBy, orders, customersResult.data, periodMonths);

  const years = new Set(orders.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
  const yearsAvailable = [...years].sort().reverse();

  return { entities, yearsAvailable };
}
