// FILE: server/src/routes/dashboard.ts
// PURPOSE: GET /api/sales/dashboard — main endpoint returning full dashboard payload
// USED BY: client/hooks/useDashboardData.ts
// EXPORTS: dashboardRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { PriorityClient } from '../services/priority-client.js';
import { fetchOrders, fetchCustomers } from '../services/priority-queries.js';
import { aggregateOrders } from '../services/data-aggregator.js';
import { groupByDimension } from '../services/dimension-grouper.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { env } from '../config/env.js';
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
    const { groupBy, period } = res.locals.query as z.infer<typeof querySchema>;
    const now = new Date();
    const year = period === 'ytd' ? now.getFullYear() : parseInt(period, 10);

    // Date ranges
    const startDate = `${year}-01-01T00:00:00Z`;
    const endDate = `${year + 1}-01-01T00:00:00Z`;
    const prevStartDate = `${year - 1}-01-01T00:00:00Z`;
    const prevEndDate = `${year}-01-01T00:00:00Z`;

    const client = new PriorityClient({
      baseUrl: env.PRIORITY_BASE_URL,
      username: env.PRIORITY_USERNAME,
      password: env.PRIORITY_PASSWORD,
    });

    // Fetch all data in parallel, with caching
    const cacheEntityType = period === 'ytd' ? 'orders_ytd' : 'orders_year';
    const [ordersResult, prevOrdersResult, customersResult] = await Promise.all([
      cachedFetch(cacheKey(cacheEntityType, period), getTTL(cacheEntityType),
        () => fetchOrders(client, startDate, endDate, true)),
      cachedFetch(cacheKey('orders_year', String(year - 1)), getTTL('orders_year'),
        () => fetchOrders(client, prevStartDate, prevEndDate, false)),
      cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
        () => fetchCustomers(client)),
    ]);

    // Aggregate and group
    const aggregate = aggregateOrders(ordersResult.data, prevOrdersResult.data, period);
    const entities = groupByDimension(groupBy as Dimension, ordersResult.data, customersResult.data);

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
