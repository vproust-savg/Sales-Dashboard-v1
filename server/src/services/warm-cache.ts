// FILE: server/src/services/warm-cache.ts
// PURPOSE: Background cache warm on server startup. Always refreshes master-data caches
//   (customers, zones, vendors, product_types, products) on boot; warms YTD orders if cold.
// USED BY: server/src/index.ts
// EXPORTS: warmEntityCache

import { priorityClient } from './priority-instance.js';
import {
  fetchOrders,
  fetchCustomers,
  fetchZones,
  fetchVendors,
  fetchProductTypes,
  fetchProducts,
} from './priority-queries.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { redis } from '../cache/redis-client.js';

/**
 * Warm master-data caches on every server boot (customers, zones, vendors, product_types, products).
 * If the YTD orders cache is cold, also fetch YTD orders.
 * Runs in the background after server start — does not block request handling.
 */
export async function warmEntityCache(): Promise<void> {
  const rawMetaKey = cacheKey('orders_raw_meta', 'ytd', 'customer:all');
  const existingMeta = await redis.get(rawMetaKey);

  // WHY: Always refresh master data (small, rarely changes, cheap). cachedFetch no-ops on
  // hot cache, so this is free on subsequent reloads. Master data drives entity list names
  // and filter dropdowns — stale data produces wrong labels.
  const masterDataPromises = [
    cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
      () => fetchCustomers(priorityClient)),
    cachedFetch(cacheKey('zones', 'all'), getTTL('zones'),
      () => fetchZones(priorityClient)),
    cachedFetch(cacheKey('vendors', 'all'), getTTL('vendors'),
      () => fetchVendors(priorityClient)),
    cachedFetch(cacheKey('product_types', 'all'), getTTL('product_types'),
      () => fetchProductTypes(priorityClient)),
    cachedFetch(cacheKey('products', 'all'), getTTL('products'),
      () => fetchProducts(priorityClient)),
  ];

  if (existingMeta) {
    console.log('[warm-cache] Orders cache exists — warming master data only.');
    await Promise.all(masterDataPromises);
    return;
  }

  const now = new Date();
  const year = now.getFullYear();
  const startDate = `${year}-01-01T00:00:00Z`;
  const endDate = `${year + 1}-01-01T00:00:00Z`;

  console.log('[warm-cache] Cold boot — warming master data + YTD orders...');

  // WHY: Start master data first, delay orders by 500ms — avoids Priority's 15-queued-max limit
  // when the 5 master-data calls + paginated fetchOrders would otherwise overlap.
  await Promise.all(masterDataPromises);
  await new Promise(r => setTimeout(r, 500));

  const ordersResult = await cachedFetch(cacheKey('orders_ytd', 'ytd'), getTTL('orders_ytd'),
    () => fetchOrders(priorityClient, startDate, endDate, true));

  console.log(`[warm-cache] Done. Orders: ${ordersResult.cached ? 'cache hit' : 'fetched fresh'}.`);
}
