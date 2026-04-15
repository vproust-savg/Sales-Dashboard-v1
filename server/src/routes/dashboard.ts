// FILE: server/src/routes/dashboard.ts
// PURPOSE: GET /api/sales/dashboard — main endpoint returning full dashboard payload
// USED BY: client/hooks/useDashboardData.ts
// EXPORTS: dashboardRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { priorityClient } from '../services/priority-instance.js';
import { fetchOrders, fetchCustomers } from '../services/priority-queries.js';
import { aggregateOrders } from '../services/data-aggregator.js';
import { groupByDimension } from '../services/dimension-grouper.js';
import { filterOrdersByCustomerCriteria } from '../services/customer-filter.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL, buildFilterHash } from '../cache/cache-keys.js';
import { redis } from '../cache/redis-client.js';
import type { RawOrder, RawCustomer } from '../services/priority-queries.js';
import type { Dimension, DashboardPayload } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

const querySchema = z.object({
  groupBy: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).default('customer'),
  period: z.string().default('ytd'),
  entityId: z.string().optional(),
  entityIds: z.string().optional(), // WHY: comma-separated IDs for View Consolidated
  // WHY: Filter params are threaded from Consolidated 2 so the server can derive the same
  // filterHash that fetch-all used to write the raw cache. Previously hardcoded 'all' which
  // never matched filtered runs.
  agentName: z.string().optional(),
  zone: z.string().optional(),
  customerType: z.string().optional(),
});

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', validateQuery(querySchema), async (_req, res, next) => {
  try {
    const { groupBy, period, entityId, entityIds, agentName, zone, customerType } = res.locals.query as z.infer<typeof querySchema>;
    const now = new Date();
    const year = period === 'ytd' ? now.getFullYear() : parseInt(period, 10);

    // Date ranges
    const startDate = `${year}-01-01T00:00:00Z`;
    const endDate = `${year + 1}-01-01T00:00:00Z`;
    const prevStartDate = `${year - 1}-01-01T00:00:00Z`;
    const prevEndDate = `${year}-01-01T00:00:00Z`;

    // WHY: entityIds (comma-separated) enables View Consolidated — filters cached raw orders
    // and re-aggregates for only the selected subset.
    const entityIdList = entityIds ? entityIds.split(',').map(s => s.trim()) : undefined;
    if (entityIdList && entityIdList.length > 0) {
      const entitySet = new Set(entityIdList);
      // WHY: Compute filterHash using the same function fetch-all writes with, so the probe
      // hits the exact same raw cache entry that was just populated. If filters are absent
      // ('all'), we probe the unfiltered cache. If filters are present but the matching raw
      // cache is missing (no prior Report with that filter), we try 'all' as a fallback.
      const filterHash = buildFilterHash(agentName, zone, customerType);
      const rawCached = await readFirstMatchingRaw(period, filterHash);
      if (rawCached) {
        const allOrders: RawOrder[] = rawCached;
        const customersResult = await cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
          () => fetchCustomers(priorityClient));
        const filteredOrders = filterOrdersByEntityIds(allOrders, entitySet, groupBy as Dimension, customersResult.data);
        // WHY: Prev-year orders for YoY. Try cached prev-year (same filterHash as fetch-all).
        // If missing, pass [] — better to have no YoY than wrong YoY.
        const prevKey = cacheKey('orders_year', String(year - 1), filterHash);
        const prevCached = await redis.get(prevKey);
        let prevOrders: RawOrder[] = [];
        if (prevCached) {
          const env = typeof prevCached === 'string' ? JSON.parse(prevCached) : prevCached;
          const rawPrev = (env as { data: RawOrder[] }).data;
          // WHY: Same zone/customerType filter applied to prev — agent was OData-filtered already.
          const zoneTypeFilteredPrev = filterOrdersByCustomerCriteria(rawPrev, customersResult.data, { zone, customerType });
          prevOrders = filterOrdersByEntityIds(zoneTypeFilteredPrev, entitySet, groupBy as Dimension, customersResult.data);
        }
        const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
        // TODO(D3): This consolidated branch is scheduled for deletion per
        // docs/superpowers/plans/2026-04-15-report-abort-signal-and-wall-clock-plan.md Commit 2b.
        // Until then, per-entity prevYearRevenue/prevYearRevenueFull remain null on THIS path
        // (not passed to groupByDimension). Single-entity-detail path at line 137 already passes them.
        // If D3 is delayed beyond the main spec's deploy window, pass `prevOrders` and `period` here
        // to match line 137's behavior — the variables are already in scope above.
        const entities = groupByDimension(groupBy as Dimension, filteredOrders, customersResult.data, periodMonths);
        // WHY: Pass opts to populate customerName on order rows + per-entity breakdowns for consolidated view.
        const aggregate = aggregateOrders(filteredOrders, prevOrders, period, {
          preserveEntityIdentity: true,
          customers: customersResult.data,
          dimension: groupBy as Dimension,
        });
        const years = new Set(filteredOrders.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
        prevOrders.forEach(o => years.add(new Date(o.CURDATE).getUTCFullYear().toString()));
        const payload: DashboardPayload = {
          entities, ...aggregate, yearsAvailable: [...years].sort().reverse(),
        };
        return res.json({ data: payload, meta: { cached: true, cachedAt: null, period, dimension: groupBy, entityCount: entities.length } });
      }
      /** WHY: Falling through to the normal fetch path silently returns ALL-orders data
       *  instead of the consolidated subset — wrong data is worse than a clear error.
       *  The client (TanStack Query) surfaces this as a visible error state. */
      return res.status(422).json({
        error: { message: 'Consolidated view requires loaded data. Use "Report" first, then try again.' },
      });
    }

    // WHY: When entityId is provided, fetch only that entity's orders (10-100 rows vs 5000+).
    // This makes per-entity detail fast while background warm handles the full list.
    const entityFilter = entityId && groupBy === 'customer'
      ? `CUSTNAME eq '${entityId.replace(/'/g, "''")}'`
      : undefined;

    // WHY: Per-entity requests use a separate cache key with shorter TTL so detail data stays fresh.
    const detailKey = entityId
      ? cacheKey('entity_detail', period, `${groupBy}:${entityId}`)
      : undefined;
    const cacheEntityType = period === 'ytd' ? 'orders_ytd' : 'orders_year';

    // Fetch all data in parallel, with caching
    const [ordersResult, prevOrdersResult, customersResult] = await Promise.all([
      detailKey
        ? cachedFetch(detailKey, getTTL('entity_detail'),
            () => fetchOrders(priorityClient, startDate, endDate, true, entityFilter))
        : cachedFetch(cacheKey(cacheEntityType, period), getTTL(cacheEntityType),
            () => fetchOrders(priorityClient, startDate, endDate, true)),
      // WHY: When entityId is provided, prev-year orders are also entity-scoped.
      // Use a separate cache key to avoid corrupting the global prev-year cache.
      entityId
        ? cachedFetch(cacheKey('entity_detail', String(year - 1), `${groupBy}:${entityId}:prev`),
            getTTL('entity_detail'),
            () => fetchOrders(priorityClient, prevStartDate, prevEndDate, false, entityFilter))
        : cachedFetch(cacheKey('orders_year', String(year - 1)), getTTL('orders_year'),
            () => fetchOrders(priorityClient, prevStartDate, prevEndDate, false)),
      cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
        () => fetchCustomers(priorityClient)),
    ]);

    // Aggregate and group
    const aggregate = aggregateOrders(ordersResult.data, prevOrdersResult.data, period);
    // WHY: periodMonths is used by dimension-grouper for frequency calculation
    const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
    // WHY: Pass prevOrdersResult.data + period so EntityListItem carries prevYearRevenue fields
    // for the Per-Customer table in the Revenue hero card modal (Feature B).
    // dashboard.ts:77 (consolidated branch) intentionally omitted — D3 will delete that branch.
    const entities = groupByDimension(groupBy as Dimension, ordersResult.data, customersResult.data, periodMonths, prevOrdersResult.data, period);

    // Derive years available from order dates
    const years = new Set(ordersResult.data.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
    prevOrdersResult.data.forEach(o => years.add(new Date(o.CURDATE).getUTCFullYear().toString()));

    const payload: DashboardPayload = {
      entities,
      ...aggregate,
      yearsAvailable: [...years].sort().reverse(),
    };

    const response: ApiResponse<DashboardPayload> = {
      data: payload,
      meta: {
        cached: ordersResult.cached,
        cachedAt: ordersResult.cachedAt,
        period,
        dimension: groupBy,
        entityCount: entities.length,
      },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * Probe raw-orders cache: first try the exact filterHash, then fall back to 'all'.
 * WHY: Report can be run with filters (raw cache written under computed hash) or without
 * (written under 'all'). Consolidated must find whichever exists; previously the reader
 * hardcoded 'all' and ignored the filtered variant, causing false 422 errors.
 */
async function readFirstMatchingRaw(period: string, filterHash: string): Promise<RawOrder[] | null> {
  const primaryKey = cacheKey('orders_raw', period, filterHash);
  const primary = await redis.get(primaryKey);
  if (primary) {
    const env = typeof primary === 'string' ? JSON.parse(primary) : primary;
    return (env as { data: RawOrder[] }).data;
  }
  if (filterHash !== 'all') {
    const fallbackKey = cacheKey('orders_raw', period, 'all');
    const fallback = await redis.get(fallbackKey);
    if (fallback) {
      const env = typeof fallback === 'string' ? JSON.parse(fallback) : fallback;
      return (env as { data: RawOrder[] }).data;
    }
  }
  return null;
}

/**
 * Filter orders by entity IDs for any dimension.
 * WHY: The consolidated view needs to filter cached raw orders to the selected
 * entity subset. Each dimension uses different fields for entity identity.
 */
export function filterOrdersByEntityIds(
  orders: RawOrder[],
  entityIds: Set<string>,
  dimension: Dimension,
  customers: RawCustomer[],
): RawOrder[] {
  switch (dimension) {
    case 'customer':
      return orders.filter(o => entityIds.has(o.CUSTNAME));
    case 'zone': {
      const custInZones = new Set(
        customers.filter(c => entityIds.has(c.ZONECODE)).map(c => c.CUSTNAME),
      );
      return orders.filter(o => custInZones.has(o.CUSTNAME));
    }
    case 'vendor':
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i => entityIds.has(i.Y_1159_5_ESH ?? '')),
      );
    case 'brand':
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i => entityIds.has(i.Y_9952_5_ESH ?? '')),
      );
    case 'product_type':
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i =>
          entityIds.has(i.Y_3020_5_ESH ?? i.Y_3021_5_ESH ?? ''),
        ),
      );
    case 'product':
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i => entityIds.has(i.PARTNAME)),
      );
    default:
      return orders;
  }
}
