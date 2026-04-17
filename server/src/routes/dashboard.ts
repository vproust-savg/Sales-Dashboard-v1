// FILE: server/src/routes/dashboard.ts
// PURPOSE: GET /api/sales/dashboard — main endpoint returning full dashboard payload
// USED BY: client/hooks/useDashboardData.ts
// EXPORTS: dashboardRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { priorityClient } from '../services/priority-instance.js';
import { fetchOrders, fetchCustomers } from '../services/priority-queries.js';
import type { RawOrder } from '../services/priority-queries.js';
import { aggregateOrders } from '../services/data-aggregator.js';
import { groupByDimension, type PrevYearInput } from '../services/dimension-grouper.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { readOrders } from '../cache/order-cache.js';
import type { Dimension, DashboardPayload } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

const querySchema = z.object({
  groupBy: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).default('customer'),
  period: z.string().default('ytd'),
  entityId: z.string().optional(),           // single-select (back-compat)
  entityIds: z.string().optional(),          // comma-separated multi-select
});

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', validateQuery(querySchema), async (_req, res, next) => {
  try {
    const { groupBy, period, entityId, entityIds } = res.locals.query as z.infer<typeof querySchema>;
    const now = new Date();
    const year = period === 'ytd' ? now.getFullYear() : parseInt(period, 10);

    // Normalize: entityIds array always, whether from entityId or entityIds
    const ids: string[] = entityIds
      ? entityIds.split(',').map(s => s.trim()).filter(Boolean)
      : entityId
        ? [entityId]
        : [];

    const startDate = `${year}-01-01T00:00:00Z`;
    const endDate = `${year + 1}-01-01T00:00:00Z`;
    const prevStartDate = `${year - 1}-01-01T00:00:00Z`;
    const prevEndDate = `${year}-01-01T00:00:00Z`;

    // WHY universal cache: orders_ytd / orders_{year} are dimension-agnostic. scopeOrders at
    // aggregator layer narrows to entity subset without per-entity cache keys (which previously
    // caused silent corruption for non-customer dims).
    const cacheEntityType = period === 'ytd' ? 'orders_ytd' : 'orders_year';

    const [ordersCached, prevOrdersCached, customersResult] = await Promise.all([
      readOrdersOrFallback(period, cacheEntityType, startDate, endDate, true),
      readOrdersOrFallback(String(year - 1), 'orders_year', prevStartDate, prevEndDate, false),
      cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
        () => fetchCustomers(priorityClient)),
    ]);

    // Build scope if entity subset requested
    const scope = ids.length > 0
      ? { dimension: groupBy as Dimension, entityIds: ids }
      : undefined;

    const aggregate = aggregateOrders(
      ordersCached.orders,
      prevOrdersCached.orders,
      period,
      scope ? { scope, customers: customersResult.data } : undefined,
    );

    // WHY: entity list is derived from the FULL period orders (not scoped) — the left panel
    // shows every entity in the dimension, not just the selected subset.
    const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
    // WHY: Pre-split prev-year orders into same-period vs full-year slices before passing to
    // groupByDimension. For YTD periods, "same period" means prev-year orders up to the same
    // month+day as today (apples-to-apples comparison). For full-year periods (e.g. "2025"),
    // all prev-year orders count as same-period. prevFull always covers the full prev calendar year.
    const prevSameOrders = period === 'ytd'
      ? prevOrdersCached.orders.filter(o => {
          const d = new Date(o.CURDATE);
          return d.getUTCMonth() < now.getUTCMonth()
            || (d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() <= now.getUTCDate());
        })
      : prevOrdersCached.orders;
    const prevYearInput: PrevYearInput = {
      today: now,
      prevSame: prevSameOrders,
      prevFull: prevOrdersCached.orders,
    };
    const entities = groupByDimension(
      groupBy as Dimension,
      ordersCached.orders,
      customersResult.data,
      periodMonths,
      prevYearInput,
    );

    const years = new Set(ordersCached.orders.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
    prevOrdersCached.orders.forEach(o => years.add(new Date(o.CURDATE).getUTCFullYear().toString()));

    const payload: DashboardPayload = {
      entities,
      ...aggregate,
      yearsAvailable: [...years].sort().reverse(),
    };

    const response: ApiResponse<DashboardPayload> = {
      data: payload,
      meta: {
        cached: ordersCached.fromCache,
        cachedAt: ordersCached.cachedAt,
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

/** Read orders from the universal per-order cache; fall back to Priority fetch on miss.
 *  WHY two layers:
 *    Layer 1 — readOrders(period, 'all'): universal per-order cache populated by fetch-all.ts
 *      (the Report flow). Fastest path; covers the typical "user runs Report, then shares
 *      dashboard" operational pattern.
 *    Layer 2 — cachedFetch(cacheKey(cacheEntity, period), ...): legacy bulk cache populated
 *      by warm-cache.ts on server startup. Covers the cold-boot case when no Report has
 *      ever run. 15-minute TTL (orders_ytd) means a fresh deploy without Report runs will
 *      re-fetch every 15 minutes.
 *  A future task could update warm-cache.ts to write the per-order cache instead, unifying
 *  these paths — but that migration is out of scope for the dimension-parity rollout. */
async function readOrdersOrFallback(
  period: string,
  cacheEntity: 'orders_ytd' | 'orders_year',
  startDate: string,
  endDate: string,
  isCurrentPeriod: boolean,
): Promise<{ orders: RawOrder[]; fromCache: boolean; cachedAt: string | null }> {
  const cached = await readOrders(period, 'all');
  if (cached) {
    return { orders: cached.orders, fromCache: true, cachedAt: cached.meta.lastFetchDate };
  }
  // Fallback: use legacy bulk cache (still populated by warm-cache for cold boot).
  const result = await cachedFetch(cacheKey(cacheEntity, period), getTTL(cacheEntity),
    () => fetchOrders(priorityClient, startDate, endDate, isCurrentPeriod));
  return { orders: result.data, fromCache: result.cached, cachedAt: result.cachedAt };
}
