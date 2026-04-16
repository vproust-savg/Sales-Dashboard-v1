// FILE: server/src/routes/fetch-all.ts
// PURPOSE: SSE endpoint for full data fetch with progress — supports incremental refresh + filters
// USED BY: client/hooks/useReport.ts via EventSource
// EXPORTS: fetchAllRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { priorityClient } from '../services/priority-instance.js';
import { fetchOrders, fetchCustomers } from '../services/priority-queries.js';
import type { RawOrder } from '../services/priority-queries.js';
import { aggregateOrders } from '../services/data-aggregator.js';
import { groupByDimension } from '../services/dimension-grouper.js';
import { filterOrdersByAgent, filterOrdersByCustomerCriteria } from '../services/customer-filter.js';
import { filterOrdersByEntityIds } from '../services/entity-subset-filter.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { writeOrders, readOrders, deleteOrderIndex } from '../cache/order-cache.js';
import { cacheKey, getTTL, buildFilterQualifier, buildFilterHash } from '../cache/cache-keys.js';
import { redis } from '../cache/redis-client.js';
import type { Dimension, DashboardPayload } from '@shared/types/dashboard';
import { createSseWriter } from './sse-writer.js';

// WHY: Filter params arrive as comma-separated strings (multi-select UI)
const querySchema = z.object({
  groupBy: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).default('customer'),
  period: z.string().default('ytd'),
  agentName: z.string().optional(),   // comma-separated agent names
  zone: z.string().optional(),         // comma-separated zone names
  customerType: z.string().optional(), // comma-separated customer types
  entityIds: z.string().optional(),    // WHY: comma-separated entity IDs for View Consolidated subset (D3)
  refresh: z.enum(['true', 'false']).optional(),
});

export const fetchAllRouter = Router();

fetchAllRouter.get('/fetch-all', validateQuery(querySchema), async (req, res) => {
  const { groupBy, period, agentName, zone, customerType, entityIds, refresh }
    = res.locals.query as z.infer<typeof querySchema>;
  const forceRefresh = refresh === 'true';

  const sse = createSseWriter(req, res);
  const { sendEvent } = sse;
  // WHY: D1 — propagate client disconnect down to the Priority pagination loop so we don't burn
  // API budget on work the user no longer wants. Works alongside createSseWriter's own close guard
  // (Node EventEmitter supports multiple listeners — both fire on close).
  const abortController = new AbortController();
  req.on('close', () => abortController.abort(new Error('Client cancelled Report')));
  try {
    // WHY: filterHash is used ONLY for aggregated caches (entities_full, report_payload,
    // entity_detail). Raw order cache always uses 'all' — one universal scope.
    // Agent/zone/customerType filtering happens post-cache in-memory.
    const filterHash = buildFilterHash(agentName, zone, customerType);

    // Date ranges
    const now = new Date();
    const year = period === 'ytd' ? now.getFullYear() : parseInt(period, 10);
    const startDate = `${year}-01-01T00:00:00Z`;
    const endDate = `${year + 1}-01-01T00:00:00Z`;

    // WHY: D2 — hoist redis.del calls BEFORE Promise.all when forceRefresh is true.
    // If these ran inside the current-year IIFE, the prev-year branch (running concurrently)
    // could read the stale prev-year cache key before the del completed — a race condition.
    // Hoisting them sequentially here guarantees both branches start with a clean slate.
    if (forceRefresh) {
      // WHY: Force refresh clears the universal "all" index + meta for both years.
      // Individual order keys are NOT deleted — they're shared and expire via TTL.
      await Promise.all([
        deleteOrderIndex(period, 'all'),
        deleteOrderIndex(String(year - 1), 'all'),
      ]);
    }

    const prevStartDate = `${year - 1}-01-01T00:00:00Z`;
    const prevEndDate = `${year}-01-01T00:00:00Z`;

    // WHY: D2 — parallelise current + prev fetch. Benchmark measured 23.5% wall-clock speedup
    // (18m02s sequential → 13m48s parallel) for a ~46K-order uncached Report. Both branches
    // share abortController.signal so user cancel cascades to both streams.
    //
    // STARVATION RISK (spec D2.2): both streams share PriorityClient.requestTimestamps (one
    // rate-limit budget, 100 calls/min). At 10K-order scale, the benchmark observed 0 throttle
    // delays. At larger scale one stream could consistently back off while the other sprints.
    // Trigger condition: if a Railway log ever shows one stream with >30s cumulative throttle
    // wait while the other has <5s, queue a round-robin-throttle refactor spec.
    //
    // HEADROOM CAVEAT: 13m48s on laptop leaves ~1m12s (8.7%) under the 15-min Railway cap.
    // The laptop benchmark does NOT survive the ±30% laptop-vs-Railway variance. A production
    // measurement (see spec "Runtime — D2" verification) is required before closing the
    // wall-clock risk; the architectural-redesign path stays open in the backlog.
    // WHY: Universal "all" cache — always read/write with filterHash='all'. Agent/zone/customerType
    // filtering happens post-cache in-memory. This means one painful initial load caches everything,
    // then all filtered views are instant reads from the same cache.
    const [ordersWrapped, prevOrdersResult] = await Promise.all([
      (async (): Promise<FetchedOrders> => {
        if (forceRefresh) {
          return fullFetch(startDate, endDate, sendEvent, abortController.signal);
        }
        const cached = await tryIncrementalRefresh(period, startDate, endDate, sendEvent, abortController.signal);
        return cached ?? fullFetch(startDate, endDate, sendEvent, abortController.signal);
      })(),
      // WHY: Prev-year also uses per-order caching — with 50K+ orders the bulk cachedFetch
      // payload exceeds Upstash's 10 MB limit (production failure: 20 MB for 2025 orders).
      // Same readOrders/writeOrders pattern as current-year, keyed by prev-year period.
      (async (): Promise<FetchedOrders> => {
        const prevPeriod = String(year - 1);
        if (!forceRefresh) {
          const cached = await readOrders(prevPeriod, 'all');
          if (cached) return { orders: cached.orders, didFetch: false };
        }
        // WHY: No extraFilter — always fetch ALL prev-year orders for the universal cache.
        const prevData = await fetchOrders(priorityClient, prevStartDate, prevEndDate, false, undefined, undefined, abortController.signal);
        return { orders: prevData, didFetch: true };
      })(),
    ]);
    const orders = ordersWrapped.orders;
    const prevOrders = prevOrdersResult;

    // Cache raw orders + metadata (sequential after Promise.all — depends on orders result)
    sendEvent('progress', { phase: 'processing', message: 'Computing metrics...' });
    if (ordersWrapped.didFetch) {
      // WHY: Per-order keys with all-or-nothing semantics. Always write under 'all' scope.
      // Every order gets its own `order:{ORDNAME}` key (365-day TTL) so it's available
      // for any future read regardless of filter. Index rebuilt authoritatively from full set.
      await writeOrders(orders, period, 'all', getTTL('orders_raw'));
    }
    if (prevOrders.didFetch) {
      // WHY: Prev-year also written under 'all' scope — same pattern, same 10 MB limit applies.
      await writeOrders(prevOrders.orders, String(year - 1), 'all', getTTL('orders_year'));
    }
    const customers = await cachedFetch(
      cacheKey('customers', 'all'), getTTL('customers'),
      () => fetchCustomers(priorityClient, abortController.signal),
    );

    // WHY: All filters are post-cache in-memory. Agent filtering is ORDER-level (AGENTNAME),
    // zone/customerType are CUSTOMER-level (require customer lookup). Applied in sequence.
    // Same filters on both current + prev year so YoY compares the same population.
    const agentFiltered = filterOrdersByAgent(orders, agentName);
    const agentFilteredPrev = filterOrdersByAgent(prevOrders.orders, agentName);
    const filteredOrders = filterOrdersByCustomerCriteria(agentFiltered, customers.data, { zone, customerType });
    const filteredPrev = filterOrdersByCustomerCriteria(agentFilteredPrev, customers.data, { zone, customerType });

    // WHY: entityIds narrows filteredOrders to the pre-selected entity subset (View Consolidated D3).
    // Applied AFTER customer-criteria so both filters compose correctly (AND semantics).
    const entityIdList = entityIds ? entityIds.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const subsetOrders = entityIdList && entityIdList.length > 0
      ? filterOrdersByEntityIds(filteredOrders, new Set(entityIdList), groupBy as Dimension, customers.data)
      : filteredOrders;
    const subsetPrev = entityIdList && entityIdList.length > 0
      ? filterOrdersByEntityIds(filteredPrev, new Set(entityIdList), groupBy as Dimension, customers.data)
      : filteredPrev;

    const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
    const entities = groupByDimension(groupBy as Dimension, subsetOrders, customers.data, periodMonths, subsetPrev, period);
    const aggregate = aggregateOrders(subsetOrders, subsetPrev, period);

    // WHY: yearsAvailable is derived from filteredOrders (not subsetOrders) so the year picker
    // reflects all years the raw cache covers — not just the subset's years.
    const years = new Set(filteredOrders.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
    prevOrders.orders.forEach(o => years.add(new Date(o.CURDATE).getUTCFullYear().toString()));

    const payload: DashboardPayload = {
      entities,
      ...aggregate,
      yearsAvailable: [...years].sort().reverse(),
    };

    // WHY: Skip aggregated cache writes when entityIds is present — each unique subset would
    // produce a distinct cache entry (combinatorial blowup). Raw cache writes stay in place above;
    // they are entity-agnostic and benefit all subsets equally.
    if (!entityIdList || entityIdList.length === 0) {
      const fullKey = cacheKey('entities_full', period, buildFilterQualifier(groupBy, filterHash));
      const fullEnvelope = { data: { entities, yearsAvailable: payload.yearsAvailable }, cachedAt: new Date().toISOString() };
      await redis.set(fullKey, JSON.stringify(fullEnvelope), { ex: getTTL('entities_full') });

      // WHY: Strip orders from report_payload — with 10K+ orders, the payload exceeds Upstash's
      // 10 MB limit. Orders are reconstructed from per-order keys when this cache is read.
      const payloadKey = cacheKey('report_payload', period, `${filterHash}:${groupBy}`);
      const strippedPayload = { ...payload, orders: [] as typeof payload.orders };
      const payloadEnvelope = { data: strippedPayload, cachedAt: new Date().toISOString() };
      await redis.set(payloadKey, JSON.stringify(payloadEnvelope), { ex: getTTL('report_payload') });

      const detailKey = cacheKey('entity_detail', period, `${groupBy}:ALL:${filterHash}`);
      const detailEnvelope = { data: strippedPayload, cachedAt: new Date().toISOString() };
      await redis.set(detailKey, JSON.stringify(detailEnvelope), { ex: getTTL('entities_full') });
    }

    // WHY: Stream orders separately from the summary payload. With 60K orders at ~650 bytes
    // per row (+ nested OrderLineItems), the `complete` event can exceed 40 MB — enough to
    // crash the browser EventSource or get truncated by Railway's nginx proxy. Splitting into:
    //   1. `complete`      — summary (entities, KPIs, charts, items) with orders=[]
    //   2. `orders-batch`  — 1000 orders per event (~650 KB each, well within SSE limits)
    //   3. `orders-done`   — signals client to close EventSource
    // Cache writes above keep the FULL payload; only the SSE transport is chunked.
    const ORDER_BATCH_SIZE = 1000;
    const allOrders = payload.orders;
    payload.orders = [];
    sendEvent('complete', payload);

    for (let i = 0; i < allOrders.length; i += ORDER_BATCH_SIZE) {
      if (sse.isClosed()) break;
      sendEvent('orders-batch', allOrders.slice(i, i + ORDER_BATCH_SIZE));
    }
    sendEvent('orders-done', {});
  } catch (err) {
    // WHY: AbortError means the user cancelled the Report — not a server fault. Logging it
    // as a failure would pollute Railway logs and mask real errors. The SSE connection is
    // already closed (sse.isClosed() will short-circuit any sendEvent attempt) so we
    // intentionally don't emit an error event either.
    // WHY use `Error && name === 'AbortError'` (not `DOMException`): Node native fetch throws
    // a DOMException for aborts, but Node's AbortSignal.timeout() composition and some fetch
    // polyfills surface the abort as a plain Error with name='AbortError'. The permissive check
    // catches both without losing specificity — only abort errors have that exact name.
    if (err instanceof Error && err.name === 'AbortError') {
      console.log('[fetch-all] Report cancelled by client');
    } else {
      const rawMessage = err instanceof Error ? err.message : 'Unknown error';
      const stack = err instanceof Error ? err.stack : undefined;
      console.error('[fetch-all] Report failed:', {
        groupBy, period, agentName, zone, customerType,
        message: rawMessage,
        stack,
      });
      // WHY: Truncate to 500 chars. A thrown Error with a very large message (e.g., from a
      // failed JSON.stringify of the full order set) would otherwise be sent as the SSE error
      // event data, which the client renders verbatim in the error modal — producing a wall
      // of unreadable text (the raw-data-as-error screenshot that surfaced this fix).
      const message = rawMessage.length > 500 ? rawMessage.slice(0, 500) + '…' : rawMessage;
      sendEvent('error', { message });
    }
  } finally {
    sse.dispose();
    if (!res.writableEnded) res.end();
  }
});

// WHY: Signals whether we fetched from Priority (didFetch=true → raw cache must be rewritten) or
// reused same-day raw cache (didFetch=false → skip the two redis.set calls). Local to this route.
interface FetchedOrders { orders: RawOrder[]; didFetch: boolean; }

// WHY: No extraFilter — always fetches ALL orders for the universal "all" cache.
// Agent/zone/customerType filtering happens post-fetch in the main handler.
async function fullFetch(startDate: string, endDate: string,
  sendEvent: (event: string, data: unknown) => void, signal?: AbortSignal): Promise<FetchedOrders> {
  sendEvent('progress', { phase: 'fetching', rowsFetched: 0, estimatedTotal: 0 });
  // WHY: onProgress sends SSE events as each page arrives, preventing Railway proxy timeout
  // during the 1–5 min it takes to paginate 50,000 orders from Priority API.
  const orders = await fetchOrders(priorityClient, startDate, endDate, true, undefined,
    (rowsFetched, estimatedTotal) => {
      sendEvent('progress', { phase: 'fetching', rowsFetched, estimatedTotal });
    },
    signal,
  );
  return { orders, didFetch: true };
}

// WHY: Always reads/writes the universal "all" cache. Incremental delta fetches ALL orders
// (no agent filter) so every new order gets cached regardless of who placed it.
async function tryIncrementalRefresh(
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


