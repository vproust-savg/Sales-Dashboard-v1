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
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { redis } from '../cache/redis-client.js';
import type { RawOrder, RawCustomer } from '../services/priority-queries.js';
import type { Dimension, DashboardPayload } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

const querySchema = z.object({
  groupBy: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).default('customer'),
  period: z.string().default('ytd'),
  entityId: z.string().optional(),
  entityIds: z.string().optional(), // WHY: comma-separated IDs for View Consolidated
});

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', validateQuery(querySchema), async (_req, res, next) => {
  try {
    const { groupBy, period, entityId, entityIds } = res.locals.query as z.infer<typeof querySchema>;
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
      const rawKey = cacheKey('orders_raw', period, `${groupBy}:all`);
      const rawCached = await redis.get(rawKey);
      if (rawCached) {
        const rawEnvelope = typeof rawCached === 'string' ? JSON.parse(rawCached) : rawCached;
        const allOrders: RawOrder[] = (rawEnvelope as { data: RawOrder[] }).data;
        const customersResult = await cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
          () => fetchCustomers(priorityClient));
        const filteredOrders = filterOrdersByEntityIds(allOrders, entitySet, groupBy as Dimension, customersResult.data);
        const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
        const entities = groupByDimension(groupBy as Dimension, filteredOrders, customersResult.data, periodMonths);
        const aggregate = aggregateOrders(filteredOrders, [], period);
        const years = new Set(filteredOrders.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
        const payload: DashboardPayload = {
          entities, ...aggregate, yearsAvailable: [...years].sort().reverse(),
        };
        return res.json({ data: payload, meta: { cached: true, cachedAt: null, period, dimension: groupBy, entityCount: entities.length } });
      }
      /** WHY: Falling through to the normal fetch path silently returns ALL-orders data
       *  instead of the consolidated subset — wrong data is worse than a clear error.
       *  The client (TanStack Query) surfaces this as a visible error state. */
      return res.status(422).json({
        error: { message: 'Consolidated view requires loaded data. Use "Load All" first, then try again.' },
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
    const entities = groupByDimension(groupBy as Dimension, ordersResult.data, customersResult.data, periodMonths);

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
