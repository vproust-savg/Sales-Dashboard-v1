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
import type { Dimension, DashboardPayload } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

const querySchema = z.object({
  groupBy: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).default('customer'),
  period: z.string().default('ytd'),
  entityId: z.string().optional(),
});

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', validateQuery(querySchema), async (_req, res, next) => {
  try {
    const { groupBy, period, entityId } = res.locals.query as z.infer<typeof querySchema>;
    const now = new Date();
    const year = period === 'ytd' ? now.getFullYear() : parseInt(period, 10);

    // Date ranges
    const startDate = `${year}-01-01T00:00:00Z`;
    const endDate = `${year + 1}-01-01T00:00:00Z`;
    const prevStartDate = `${year - 1}-01-01T00:00:00Z`;
    const prevEndDate = `${year}-01-01T00:00:00Z`;

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
    // dashboard.ts:84 (consolidated branch) intentionally omitted — D3 will delete that branch.
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

