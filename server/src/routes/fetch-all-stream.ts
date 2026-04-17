// FILE: server/src/routes/fetch-all-stream.ts
// PURPOSE: SSE fetch helpers — fullFetch and tryIncrementalRefresh for the fetch-all route
// USED BY: server/src/routes/fetch-all.ts
// EXPORTS: FetchedOrders, fullFetch, tryIncrementalRefresh

import { priorityClient } from '../services/priority-instance.js';
import { fetchOrders } from '../services/priority-queries.js';
import type { RawOrder } from '../services/priority-queries.js';
import { readOrders } from '../cache/order-cache.js';

// WHY: Signals whether we fetched from Priority (didFetch=true → raw cache must be rewritten) or
// reused same-day raw cache (didFetch=false → skip the two redis.set calls). Local to this route.
export interface FetchedOrders { orders: RawOrder[]; didFetch: boolean; }

// WHY extraFilter: cold-cache View Consolidated for a small customer/zone subset should
// narrow the Priority query instead of pulling the full universal set. When `extraFilter`
// is provided, the caller is responsible for skipping the universal-cache write (the
// fetched rows are a subset and would poison `readOrders(period, 'all')` for other users).
// When undefined (the default), behaviour is unchanged — full agent-agnostic fetch.
export async function fullFetch(startDate: string, endDate: string,
  sendEvent: (event: string, data: unknown) => void, signal?: AbortSignal,
  extraFilter?: string): Promise<FetchedOrders> {
  sendEvent('progress', { phase: 'fetching', rowsFetched: 0, estimatedTotal: 0 });
  // WHY: onProgress sends SSE events as each page arrives, preventing Railway proxy timeout
  // during the 1–5 min it takes to paginate 50,000 orders from Priority API.
  const orders = await fetchOrders(priorityClient, startDate, endDate, true, extraFilter,
    (rowsFetched, estimatedTotal) => {
      sendEvent('progress', { phase: 'fetching', rowsFetched, estimatedTotal });
    },
    signal,
  );
  return { orders, didFetch: true };
}

// WHY: Always reads/writes the universal "all" cache. Incremental delta fetches ALL orders
// (no agent filter) so every new order gets cached regardless of who placed it.
export async function tryIncrementalRefresh(
  period: string,
  startDate: string, endDate: string,
  sendEvent: (event: string, data: unknown) => void,
  signal?: AbortSignal,
): Promise<FetchedOrders | null> {
  // Read from universal "all" per-order cache
  const cached = await readOrders(period, 'all');
  if (!cached) return null;

  const { orders: cachedOrders, meta } = cached;
  const lastFetchDate = new Date(meta.lastFetchDate);

  // If fetched today, use as-is (didFetch=false → caller skips raw-cache rewrite)
  const today = new Date();
  if (lastFetchDate.toDateString() === today.toDateString()) {
    sendEvent('progress', { phase: 'processing', message: 'Using cached data from today...' });
    return { orders: cachedOrders, didFetch: false };
  }

  // Incremental: fetch since lastFetchDate - 1 day
  const sinceDate = new Date(lastFetchDate);
  sinceDate.setDate(sinceDate.getDate() - 1);
  const sinceDateStr = sinceDate.toISOString().split('T')[0] + 'T00:00:00Z';
  sendEvent('progress', { phase: 'incremental', message: `Fetching orders since ${sinceDate.toLocaleDateString()}...`, rowsFetched: 0 });

  // WHY: No extraFilter — delta fetch includes ALL agents' orders so the universal cache
  // stays complete. Every fetched order gets written back as order:{ORDNAME} key.
  const newOrders = await fetchOrders(priorityClient, sinceDateStr, endDate, true, undefined,
    (rowsFetched, estimatedTotal) => {
      sendEvent('progress', { phase: 'incremental', rowsFetched, estimatedTotal });
    },
    signal,
  );
  sendEvent('progress', { phase: 'merging', message: `Merging ${newOrders.length} new orders with ${cachedOrders.length} cached...` });

  // WHY: Deduplicate by ORDNAME — new version wins. Map ensures no duplicate order IDs
  // in the merged set, which would produce incorrect KPIs (double-counted revenue).
  const orderMap = new Map<string, RawOrder>();
  cachedOrders.forEach(o => orderMap.set(o.ORDNAME, o));
  newOrders.forEach(o => orderMap.set(o.ORDNAME, o));

  // Filter to date range (remove orders from before startDate in case of overlap)
  const startTime = new Date(startDate).getTime();
  const merged = [...orderMap.values()].filter(o => new Date(o.CURDATE).getTime() >= startTime);
  return { orders: merged, didFetch: true };
}
