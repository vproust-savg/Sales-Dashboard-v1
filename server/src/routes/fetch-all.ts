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
import { filterOrdersByCustomerCriteria } from '../services/customer-filter.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL, buildFilterQualifier, buildFilterHash } from '../cache/cache-keys.js';
import { redis } from '../cache/redis-client.js';
import type { Dimension, DashboardPayload } from '@shared/types/dashboard';

// WHY: Filter params arrive as comma-separated strings (multi-select UI)
const querySchema = z.object({
  groupBy: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).default('customer'),
  period: z.string().default('ytd'),
  agentName: z.string().optional(),   // comma-separated agent names
  zone: z.string().optional(),         // comma-separated zone names
  customerType: z.string().optional(), // comma-separated customer types
  refresh: z.enum(['true', 'false']).optional(),
});

export const fetchAllRouter = Router();

fetchAllRouter.get('/fetch-all', validateQuery(querySchema), async (_req, res) => {
  const { groupBy, period, agentName, zone, customerType, refresh }
    = res.locals.query as z.infer<typeof querySchema>;
  const forceRefresh = refresh === 'true';

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // WHY: Railway nginx has ~60s idle timeout. Heartbeat keeps SSE alive during long
  // async operations (Redis writes, aggregation) that don't send their own events.
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25_000);
  try {
    const filterHash = buildFilterHash(agentName, zone, customerType);
    // WHY: Raw cache key is dimension-agnostic — the same 22K orders serve all 6 dimensions.
    // Only the aggregation step differs per dimension. This eliminates redundant full fetches.
    const rawKey = cacheKey('orders_raw', period, filterHash);
    const metaKey = cacheKey('orders_raw_meta', period, filterHash);

    // Date ranges
    const now = new Date();
    const year = period === 'ytd' ? now.getFullYear() : parseInt(period, 10);
    const startDate = `${year}-01-01T00:00:00Z`;
    const endDate = `${year + 1}-01-01T00:00:00Z`;

    // Build OData filter from dialog dropdowns
    const extraFilter = buildODataFilter(agentName);

    // Check for cached raw orders (incremental refresh)
    let orders: RawOrder[];
    if (!forceRefresh) {
      const cached = await tryIncrementalRefresh(rawKey, metaKey, startDate, endDate, extraFilter, sendEvent);
      if (cached) {
        orders = cached;
      } else {
        orders = await fullFetch(startDate, endDate, extraFilter, sendEvent);
      }
    } else {
      // Force refresh: delete cache, do full fetch
      await redis.del(rawKey);
      await redis.del(metaKey);
      orders = await fullFetch(startDate, endDate, extraFilter, sendEvent);
    }

    // Cache raw orders + metadata
    sendEvent('progress', { phase: 'processing', message: 'Computing metrics...' });
    const rawEnvelope = { data: orders, cachedAt: new Date().toISOString() };
    await redis.set(rawKey, JSON.stringify(rawEnvelope), { ex: getTTL('orders_raw') });
    const metaEnvelope = {
      data: { lastFetchDate: new Date().toISOString(), rowCount: orders.length, filterHash },
      cachedAt: new Date().toISOString(),
    };
    await redis.set(metaKey, JSON.stringify(metaEnvelope), { ex: getTTL('orders_raw_meta') });

    // Aggregate
    const prevStartDate = `${year - 1}-01-01T00:00:00Z`;
    const prevEndDate = `${year}-01-01T00:00:00Z`;
    // WHY: Include filterHash in prev-year key. Without it, the first filtered Report
    // poisons the prev-year cache for every subsequent filter (e.g., running Alexandra's
    // report caches her prev-year orders under a global key; the next rep reads her data).
    const prevOrders = await cachedFetch(
      cacheKey('orders_year', String(year - 1), filterHash), getTTL('orders_year'),
      () => fetchOrders(priorityClient, prevStartDate, prevEndDate, false, extraFilter),
    );
    const customers = await cachedFetch(
      cacheKey('customers', 'all'), getTTL('customers'),
      () => fetchCustomers(priorityClient),
    );

    // WHY: Zone/customerType are CUSTOMERS-level. Post-fetch filter after join.
    const filteredOrders = filterOrdersByCustomerCriteria(orders, customers.data, { zone, customerType });
    // WHY: Same zone/customerType filter must be applied to prev-year data so YoY compares
    // the same entity population. Agent filtering already happened in OData.
    const filteredPrev = filterOrdersByCustomerCriteria(prevOrders.data, customers.data, { zone, customerType });
    const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
    const entities = groupByDimension(groupBy as Dimension, filteredOrders, customers.data, periodMonths);
    const aggregate = aggregateOrders(filteredOrders, filteredPrev, period);

    const years = new Set(filteredOrders.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
    prevOrders.data.forEach(o => years.add(new Date(o.CURDATE).getUTCFullYear().toString()));

    const payload: DashboardPayload = {
      entities,
      ...aggregate,
      yearsAvailable: [...years].sort().reverse(),
    };

    // WHY: Cache aggregated results — entities_full for the entity list
    // + report_payload (per-dimension payload for instant dimension switches).
    const fullKey = cacheKey('entities_full', period, buildFilterQualifier(groupBy, filterHash));
    const fullEnvelope = { data: { entities, yearsAvailable: payload.yearsAvailable }, cachedAt: new Date().toISOString() };
    await redis.set(fullKey, JSON.stringify(fullEnvelope), { ex: getTTL('entities_full') });

    const payloadKey = cacheKey('report_payload', period, `${filterHash}:${groupBy}`);
    const payloadEnvelope = { data: payload, cachedAt: new Date().toISOString() };
    await redis.set(payloadKey, JSON.stringify(payloadEnvelope), { ex: getTTL('report_payload') });

    const detailKey = cacheKey('entity_detail', period, `${groupBy}:ALL:${filterHash}`);
    const detailEnvelope = { data: payload, cachedAt: new Date().toISOString() };
    await redis.set(detailKey, JSON.stringify(detailEnvelope), { ex: getTTL('entities_full') });

    sendEvent('complete', payload);
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sendEvent('error', { message });
    res.end();
  } finally {
    clearInterval(heartbeat);
  }
});

async function fullFetch(startDate: string, endDate: string, extraFilter: string | undefined,
  sendEvent: (event: string, data: unknown) => void): Promise<RawOrder[]> {
  sendEvent('progress', { phase: 'fetching', rowsFetched: 0, estimatedTotal: 0 });
  // WHY: onProgress sends SSE events as each page arrives, preventing Railway proxy timeout
  // during the 1–5 min it takes to paginate 50,000 orders from Priority API.
  return fetchOrders(priorityClient, startDate, endDate, true, extraFilter,
    (rowsFetched, estimatedTotal) => {
      sendEvent('progress', { phase: 'fetching', rowsFetched, estimatedTotal });
    },
  );
}

async function tryIncrementalRefresh(
  rawKey: string, metaKey: string,
  startDate: string, endDate: string, extraFilter: string | undefined,
  sendEvent: (event: string, data: unknown) => void,
): Promise<RawOrder[] | null> {
  const rawCached = await redis.get(rawKey);
  const metaCached = await redis.get(metaKey);
  if (!rawCached || !metaCached) return null;

  const rawEnvelope = typeof rawCached === 'string' ? JSON.parse(rawCached) : rawCached;
  const metaEnvelope = typeof metaCached === 'string' ? JSON.parse(metaCached) : metaCached;
  const lastFetchDate = new Date((metaEnvelope as { data: { lastFetchDate: string } }).data.lastFetchDate);
  const cachedOrders: RawOrder[] = (rawEnvelope as { data: RawOrder[] }).data;

  // If fetched today, use as-is
  const today = new Date();
  if (lastFetchDate.toDateString() === today.toDateString()) {
    sendEvent('progress', { phase: 'processing', message: 'Using cached data from today...' });
    return cachedOrders;
  }

  // Incremental: fetch since lastFetchDate - 1 day
  const sinceDate = new Date(lastFetchDate);
  sinceDate.setDate(sinceDate.getDate() - 1);
  const sinceDateStr = sinceDate.toISOString().split('T')[0] + 'T00:00:00Z';
  sendEvent('progress', { phase: 'incremental', message: `Fetching orders since ${sinceDate.toLocaleDateString()}...`, rowsFetched: 0 });

  const newOrders = await fetchOrders(priorityClient, sinceDateStr, endDate, true, extraFilter,
    (rowsFetched, estimatedTotal) => {
      sendEvent('progress', { phase: 'incremental', rowsFetched, estimatedTotal });
    },
  );
  sendEvent('progress', { phase: 'merging', message: `Merging ${newOrders.length} new orders with ${cachedOrders.length} cached...` });

  // Deduplicate by ORDNAME — new version wins
  const orderMap = new Map<string, RawOrder>();
  cachedOrders.forEach(o => orderMap.set(o.ORDNAME, o));
  newOrders.forEach(o => orderMap.set(o.ORDNAME, o));

  // Filter to date range (remove orders from before startDate in case of overlap)
  const startTime = new Date(startDate).getTime();
  const merged = [...orderMap.values()].filter(o => new Date(o.CURDATE).getTime() >= startTime);
  return merged;
}

// WHY: agentName is OData-filterable on ORDERS. Zone/customerType handled by filterOrdersByCustomerCriteria().
function buildODataFilter(agentName?: string): string | undefined {
  if (!agentName) return undefined;
  const names = agentName.split(',').map(n => n.trim()).filter(Boolean);
  if (names.length === 0) return undefined;
  if (names.length === 1) {
    return `AGENTNAME eq '${names[0].replace(/'/g, "''")}'`;
  }
  // WHY: Multiple agents → OR clause: (AGENTNAME eq 'A' or AGENTNAME eq 'B')
  const clauses = names.map(n => `AGENTNAME eq '${n.replace(/'/g, "''")}'`);
  return `(${clauses.join(' or ')})`;
}

