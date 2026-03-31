// FILE: server/src/services/warm-cache.ts
// PURPOSE: Background cache warm on server startup — pre-computes entity summaries for fast first load
// USED BY: server/src/index.ts
// EXPORTS: warmEntityCache

import { priorityClient } from './priority-instance.js';
import { fetchOrders, fetchCustomers } from './priority-queries.js';
import { groupByDimension } from './dimension-grouper.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import type { EntityListItem } from '@shared/types/dashboard';

/**
 * Pre-fetch YTD orders + customers, group by customer dimension, and cache the entity summaries.
 * Runs in the background after server starts — does not block request handling.
 */
export async function warmEntityCache(): Promise<void> {
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

  const periodMonths = now.getUTCMonth() + 1;
  const entities: EntityListItem[] = groupByDimension('customer', ordersResult.data, customersResult.data, periodMonths);

  // Derive years available from order dates
  const years = new Set(ordersResult.data.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
  const yearsAvailable = [...years].sort().reverse();

  // WHY: Cache the pre-computed entity summary so the /entities endpoint returns instantly.
  const summaryKey = cacheKey('entities_summary', 'ytd', 'customer');
  await cachedFetch(summaryKey, getTTL('entities_summary'),
    () => Promise.resolve({ entities, yearsAvailable }));

  const ordersCacheStatus = ordersResult.cached ? 'cache hit' : 'fetched fresh';
  const customersCacheStatus = customersResult.cached ? 'cache hit' : 'fetched fresh';
  console.log(
    `[warm-cache] Done. ${entities.length} customer entities cached.`
    + ` Orders: ${ordersCacheStatus}. Customers: ${customersCacheStatus}.`,
  );
}
