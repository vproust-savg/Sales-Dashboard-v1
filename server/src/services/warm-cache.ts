// FILE: server/src/services/warm-cache.ts
// PURPOSE: Background cache warm on server startup — pre-computes entity summaries for fast first load
// USED BY: server/src/index.ts
// EXPORTS: warmEntityCache

import { priorityClient } from './priority-instance.js';
import { fetchOrders, fetchCustomers } from './priority-queries.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { redis } from '../cache/redis-client.js';

/**
 * Pre-fetch YTD orders + customers and cache them for fast first load.
 * Runs in the background after server starts — does not block request handling.
 */
export async function warmEntityCache(): Promise<void> {
  // WHY: Skip warm if recent cached data exists from a previous fetch-all run.
  // This prevents blocking server startup with a 4-7 minute fetch.
  const rawMetaKey = cacheKey('orders_raw_meta', 'ytd', 'customer:all');
  const existingMeta = await redis.get(rawMetaKey);
  if (existingMeta) {
    console.log('[warm-cache] Skipping — cached data exists from previous fetch-all run.');
    return;
  }

  const now = new Date();
  const year = now.getFullYear();
  const startDate = `${year}-01-01T00:00:00Z`;
  const endDate = `${year + 1}-01-01T00:00:00Z`;

  console.log('[warm-cache] Starting background cache warm for YTD entity summaries...');

  const [ordersResult, customersResult] = await Promise.all([
    cachedFetch(cacheKey('orders_ytd', 'ytd'), getTTL('orders_ytd'),
      () => fetchOrders(priorityClient, startDate, endDate, true)),
    cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
      () => fetchCustomers(priorityClient)),
  ]);

  // WHY: Only warm the customers cache — the /entities endpoint builds stubs from this.
  // Do NOT cache entities_summary for customer dimension here, because groupByDimension
  // only includes customers with orders. The /entities endpoint fallback correctly
  // builds stubs from ALL customers via fetchCustomers + buildCustomerStubs.
  const customersCacheStatus = customersResult.cached ? 'cache hit' : 'fetched fresh';
  const ordersCacheStatus = ordersResult.cached ? 'cache hit' : 'fetched fresh';
  console.log(
    `[warm-cache] Done. ${customersResult.data.length} customers cached.`
    + ` Orders: ${ordersCacheStatus}. Customers: ${customersCacheStatus}.`,
  );
}
