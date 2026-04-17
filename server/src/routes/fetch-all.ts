// FILE: server/src/routes/fetch-all.ts
// PURPOSE: SSE endpoint for full data fetch with progress — supports incremental refresh + filters
// USED BY: client/hooks/useReport.ts via EventSource
// EXPORTS: fetchAllRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { priorityClient } from '../services/priority-instance.js';
import { fetchOrders, fetchCustomers, fetchProducts } from '../services/priority-queries.js';
import type { RawProduct } from '@shared/types/dashboard';
import { aggregateOrders } from '../services/data-aggregator.js';
import { groupByDimension, type PrevYearInput } from '../services/dimension-grouper.js';
import { filterOrdersByAgent, filterOrdersByCustomerCriteria, filterOrdersByItemCriteria } from '../services/customer-filter.js';
import { filterOrdersByEntityIds } from '../services/entity-subset-filter.js';
import { decideNarrowFilter } from '../services/narrow-filter-decision.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { writeOrders, readOrders, deleteOrderIndex } from '../cache/order-cache.js';
import { cacheKey, getTTL, buildFilterQualifier, buildFilterHash } from '../cache/cache-keys.js';
import { redis } from '../cache/redis-client.js';
import type { Dimension, DashboardPayload } from '@shared/types/dashboard';
import { createSseWriter } from './sse-writer.js';
import type { FetchedOrders } from './fetch-all-stream.js';
import { fullFetch, tryIncrementalRefresh } from './fetch-all-stream.js';

// WHY: Filter params arrive as comma-separated strings (multi-select UI)
const querySchema = z.object({
  groupBy: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).default('customer'),
  period: z.string().default('ytd'),
  agentName: z.string().optional(),        // comma-separated agent names
  zone: z.string().optional(),             // comma-separated zone names
  customerType: z.string().optional(),     // comma-separated customer types
  brand: z.string().optional(),            // comma-separated brand codes
  productFamily: z.string().optional(),    // comma-separated family codes
  countryOfOrigin: z.string().optional(),  // comma-separated country names
  foodServiceRetail: z.string().optional(),// 'Y' (Retail) and/or '' (Food Service) comma-separated
  entityIds: z.string().optional(),        // WHY: comma-separated entity IDs for View Consolidated subset (D3)
  refresh: z.enum(['true', 'false']).optional(),
});

export const fetchAllRouter = Router();

fetchAllRouter.get('/fetch-all', validateQuery(querySchema), async (req, res) => {
  const { groupBy, period, agentName, zone, customerType, brand, productFamily, countryOfOrigin, foodServiceRetail, entityIds, refresh }
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
    const filterHash = buildFilterHash({
      agentName, zone, customerType,
      brand, productFamily, countryOfOrigin, foodServiceRetail,
    });

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

    // WHY: Fetch customers first (cheap; cached in Redis) so the narrow-filter builder has
    // the full customer master for zone→CUSTNAME lookups. Customers are also needed for
    // scope-aware aggregation below, so this also consolidates two fetches into one.
    const customers = await cachedFetch(
      cacheKey('customers', 'all'), getTTL('customers'),
      () => fetchCustomers(priorityClient, abortController.signal),
    );

    // WHY: entityIds narrows filteredOrders to the pre-selected entity subset (View Consolidated D3).
    // Hoisted BEFORE the orders fetch so we can pass a narrow filter down to Priority when
    // the subset is small (customer/zone dims) or resolvable via the warm-cache reverse index
    // (per-item dims). Without this, a 2-customer "View Consolidated" on cold cache would
    // still pull the full ~50K-order universe (6+ min, timeouts), then discard 99.5% in-memory.
    // Parity with the single-entity dashboard.ts narrow fallback.
    const entityIdList = entityIds ? entityIds.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const { narrowFilter, shortCircuitEmpty } = await decideNarrowFilter(
      groupBy as Dimension,
      entityIdList ?? [],
      customers.data,
      period,
    );

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
    // WHY skip universal-cache READ when narrowFilter is set: the narrowed subset is
    // intentionally scoped to a few entities, but readOrders(period, 'all') would return
    // either nothing (cold) or the full agent-agnostic set (warm). Neither is useful here.
    // We also SKIP the universal-cache WRITE below so the narrowed subset doesn't poison
    // `readOrders(period, 'all')` for other users — other users would see only our subset.
    const [ordersWrapped, prevOrdersResult] = shortCircuitEmpty
      ? [
          // WHY: resolver proved zero matching orders for this per-item selection — skip the
          // Priority fetch and return an empty-but-well-structured payload. Prevents paying
          // the full ~6-min cold-cache cost just to compute the same empty result.
          { orders: [], didFetch: false } as FetchedOrders,
          { orders: [], didFetch: false } as FetchedOrders,
        ]
      : await Promise.all([
          (async (): Promise<FetchedOrders> => {
            if (forceRefresh || narrowFilter) {
              return fullFetch(startDate, endDate, sendEvent, abortController.signal, narrowFilter);
            }
            const cached = await tryIncrementalRefresh(period, startDate, endDate, sendEvent, abortController.signal);
            return cached ?? fullFetch(startDate, endDate, sendEvent, abortController.signal);
          })(),
          // WHY: Prev-year also uses per-order caching — with 50K+ orders the bulk cachedFetch
          // payload exceeds Upstash's 10 MB limit (production failure: 20 MB for 2025 orders).
          // Same readOrders/writeOrders pattern as current-year, keyed by prev-year period.
          (async (): Promise<FetchedOrders> => {
            const prevPeriod = String(year - 1);
            if (!forceRefresh && !narrowFilter) {
              const cached = await readOrders(prevPeriod, 'all');
              if (cached) return { orders: cached.orders, didFetch: false };
            }
            // WHY: When narrowFilter is set, fetch only the narrowed subset from Priority.
            //   Otherwise (default path), fetch ALL prev-year orders for the universal cache.
            const prevData = await fetchOrders(priorityClient, prevStartDate, prevEndDate, false, narrowFilter, undefined, abortController.signal);
            return { orders: prevData, didFetch: true };
          })(),
        ]);
    const orders = ordersWrapped.orders;
    const prevOrders = prevOrdersResult;

    // Cache raw orders + metadata (sequential after Promise.all — depends on orders result)
    sendEvent('progress', { phase: 'processing', message: 'Computing metrics...' });
    // WHY skip writes when narrowFilter: the fetched set is a narrow subset; writing it
    // under the universal 'all' scope would corrupt `readOrders(period, 'all')` for other
    // users / other requests. The narrow subset is request-scoped and discarded after
    // aggregation, matching the dashboard.ts narrow-fetch policy.
    if (ordersWrapped.didFetch && !narrowFilter) {
      // WHY: Per-order keys with all-or-nothing semantics. Always write under 'all' scope.
      // Every order gets its own `order:{ORDNAME}` key (365-day TTL) so it's available
      // for any future read regardless of filter. Index rebuilt authoritatively from full set.
      await writeOrders(orders, period, 'all', getTTL('orders_raw'));
    }
    if (prevOrders.didFetch && !narrowFilter) {
      // WHY: Prev-year also written under 'all' scope — same pattern, same 10 MB limit applies.
      await writeOrders(prevOrders.orders, String(year - 1), 'all', getTTL('orders_year'));
    }

    // WHY: All filters are post-cache in-memory. Agent filtering is ORDER-level (AGENTNAME),
    // zone/customerType are CUSTOMER-level (require customer lookup). Applied in sequence.
    // Same filters on both current + prev year so YoY compares the same population.
    const agentFiltered = filterOrdersByAgent(orders, agentName);
    const agentFilteredPrev = filterOrdersByAgent(prevOrders.orders, agentName);
    const custFiltered = filterOrdersByCustomerCriteria(agentFiltered, customers.data, { zone, customerType });
    const custFilteredPrev = filterOrdersByCustomerCriteria(agentFilteredPrev, customers.data, { zone, customerType });

    // WHY: Item-level criteria (brand/family/country/FS-vs-Retail) live on ORDERITEMS_SUBFORM custom
    // fields. Applied after agent/customer filters for consistent AND semantics across all filter types.
    const itemCriteria = {
      brand:             brand             ? brand.split(',').map(s => s.trim()).filter(Boolean)             : undefined,
      productFamily:     productFamily     ? productFamily.split(',').map(s => s.trim()).filter(Boolean)     : undefined,
      countryOfOrigin:   countryOfOrigin   ? countryOfOrigin.split(',').map(s => s.trim()).filter(Boolean)   : undefined,
      foodServiceRetail: foodServiceRetail ? foodServiceRetail.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    };
    const filteredOrders = filterOrdersByItemCriteria(custFiltered, itemCriteria);
    const filteredPrev   = filterOrdersByItemCriteria(custFilteredPrev, itemCriteria);

    // WHY: entityIds narrows filteredOrders to the pre-selected entity subset (View Consolidated D3).
    // Applied AFTER customer-criteria so both filters compose correctly (AND semantics).
    // NOTE: `entityIdList` is hoisted above (next to the narrow-filter builder).
    const subsetOrders = entityIdList && entityIdList.length > 0
      ? filterOrdersByEntityIds(filteredOrders, new Set(entityIdList), groupBy as Dimension, customers.data)
      : filteredOrders;
    const subsetPrev = entityIdList && entityIdList.length > 0
      ? filterOrdersByEntityIds(filteredPrev, new Set(entityIdList), groupBy as Dimension, customers.data)
      : filteredPrev;

    const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
    // WHY: Pre-split prev-year orders into same-period vs full-year slices — matches the
    // semantics in dashboard.ts. For YTD, same-period = prev orders up to same month+day.
    const prevSameOrders = period === 'ytd'
      ? subsetPrev.filter(o => {
          const d = new Date(o.CURDATE);
          return d.getUTCMonth() < now.getUTCMonth()
            || (d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() <= now.getUTCDate());
        })
      : subsetPrev;
    const fetchAllPrevInput: PrevYearInput = {
      today: now,
      prevSame: prevSameOrders,
      prevFull: subsetPrev,
    };
    // WHY: Fetch products only for the product dimension — LOGPART lookup for country of origin.
    let productsByPartname: Map<string, RawProduct> | undefined;
    if (groupBy === 'product') {
      const productsResult = await cachedFetch(cacheKey('products', 'all'), getTTL('products'),
        () => fetchProducts(priorityClient, abortController.signal));
      productsByPartname = new Map(productsResult.data.map(p => [p.PARTNAME, p]));
    }

    const entities = groupByDimension(groupBy as Dimension, subsetOrders, customers.data, periodMonths, fetchAllPrevInput, productsByPartname);

    // WHY: Build scope for aggregateOrders so item-based dims get per-entity rescoping in
    // consolidated mode (Task 3.3 fix). filterOrdersByEntityIds above is predicate-only
    // (order-level match) for the entities list; scope adds item-narrowing + TOTPRICE rewrite
    // needed for correct KPIs and per-entity breakdowns.
    const scope = entityIdList && entityIdList.length > 0
      ? { dimension: groupBy as Dimension, entityIds: entityIdList }
      : undefined;
    // WHY preserveEntityIdentity: consolidated Orders tab renders a Customer column,
    // so every OrderRow must carry customerName regardless of the groupBy dimension.
    // Task 11 fixed the single-entity dashboard route; this fixes the fetch-all path.
    const aggregate = aggregateOrders(
      subsetOrders,
      subsetPrev,
      period,
      scope
        ? { scope, customers: customers.data, preserveEntityIdentity: true }
        : { preserveEntityIdentity: true, customers: customers.data },
    );

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


