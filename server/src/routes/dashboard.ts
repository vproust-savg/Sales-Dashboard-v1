// FILE: server/src/routes/dashboard.ts
// PURPOSE: GET /api/sales/dashboard — main endpoint returning full dashboard payload
// USED BY: client/hooks/useDashboardData.ts
// EXPORTS: dashboardRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { priorityClient } from '../services/priority-instance.js';
import { fetchOrders, fetchCustomers, fetchProducts } from '../services/priority-queries.js';
import type { RawOrder } from '../services/priority-queries.js';
import type { RawProduct } from '@shared/types/dashboard';
import { aggregateOrders } from '../services/data-aggregator.js';
import { groupByDimension, type PrevYearInput } from '../services/dimension-grouper.js';
import { buildNarrowOrderFilter } from '../services/narrow-order-filter.js';
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

    // WHY: Customers are needed both for aggregation and for computing the zone→CUSTNAME
    // narrow filter used on cold cache. Fetch them first (cheap: 1s when cached) so the
    // filter builder sees the full customer list.
    const customersResult = await cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
      () => fetchCustomers(priorityClient));

    // WHY narrow-fetch fallback: before Plan A's universal-cache refactor, single-entity
    // dashboard loads filtered Priority ORDERS by CUSTNAME. The refactor removed that fast
    // path so every cold-cache load pulled ~22K YTD orders (6+ min, often timing out at
    // Priority's per-page cap). Restoring the narrow filter for dims where it's possible
    // makes the cold path fast again without compromising the consolidated/Report flow.
    const narrowFilter = buildNarrowOrderFilter(groupBy as Dimension, ids, customersResult.data);

    const [ordersCached, prevOrdersCached] = await Promise.all([
      readOrdersOrFallback(period, cacheEntityType, startDate, endDate, true, narrowFilter),
      readOrdersOrFallback(String(year - 1), 'orders_year', prevStartDate, prevEndDate, false, narrowFilter),
    ]);

    // Build scope if entity subset requested
    const scope = ids.length > 0
      ? { dimension: groupBy as Dimension, entityIds: ids }
      : undefined;

    // WHY preserveEntityIdentity: non-customer dims show an Orders tab where each row must
    // carry customerName so the UI can display which customer placed the order. For customer
    // dim it is redundant (entity IS the customer) but harmless — always set so the rows are
    // enriched regardless of dim. customers is already fetched above in Promise.all.
    const aggregate = aggregateOrders(
      ordersCached.orders,
      prevOrdersCached.orders,
      period,
      scope
        ? { scope, customers: customersResult.data, preserveEntityIdentity: true }
        : { preserveEntityIdentity: true, customers: customersResult.data },
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
    // WHY: Fetch products only for the product dimension — LOGPART lookup for country of origin.
    let productsByPartname: Map<string, RawProduct> | undefined;
    if (groupBy === 'product') {
      const productsResult = await cachedFetch(cacheKey('products', 'all'), getTTL('products'),
        () => fetchProducts(priorityClient));
      productsByPartname = new Map(productsResult.data.map(p => [p.PARTNAME, p]));
    }

    const entities = groupByDimension(
      groupBy as Dimension,
      ordersCached.orders,
      customersResult.data,
      periodMonths,
      prevYearInput,
      productsByPartname,
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
 *  WHY extraFilter: When the universal cache is cold AND the request is scoped to one or
 *  a few entities (customer or zone dim), narrow the Priority fetch by a CUSTNAME filter.
 *  This restores the pre-Plan A fast path: instead of pulling 22K YTD orders (6+ min,
 *  timeout-prone), we pull only ~10-200 orders for the selected entity (~2-5s). The
 *  narrowed result lives under a per-entity cache key so it can't corrupt the universal
 *  'all' cache key. If `extraFilter` is undefined (per-item dims, boot, multi-dim
 *  consolidated), behaviour is unchanged. */
async function readOrdersOrFallback(
  period: string,
  cacheEntity: 'orders_ytd' | 'orders_year',
  startDate: string,
  endDate: string,
  isCurrentPeriod: boolean,
  extraFilter?: string,
): Promise<{ orders: RawOrder[]; fromCache: boolean; cachedAt: string | null }> {
  const cached = await readOrders(period, 'all');
  if (cached) {
    return { orders: cached.orders, fromCache: true, cachedAt: cached.meta.lastFetchDate };
  }
  if (extraFilter) {
    // WHY hash-suffixed cache key: the narrow-fetch result is entity-scoped; never mix it
    // with the universal cache's 'all' bucket. Uses 'entity_detail' TTL (10 min) — stale
    // enough to reuse across rapid clicks but fresh enough to pick up new orders soon.
    const narrowKey = cacheKey('entity_detail', period, `narrow:${hashFilter(extraFilter)}`);
    const result = await cachedFetch(narrowKey, getTTL('entity_detail'),
      () => fetchOrders(priorityClient, startDate, endDate, isCurrentPeriod, extraFilter));
    return { orders: result.data, fromCache: result.cached, cachedAt: result.cachedAt };
  }
  // Fallback: use legacy bulk cache (still populated by warm-cache for cold boot).
  const result = await cachedFetch(cacheKey(cacheEntity, period), getTTL(cacheEntity),
    () => fetchOrders(priorityClient, startDate, endDate, isCurrentPeriod));
  return { orders: result.data, fromCache: result.cached, cachedAt: result.cachedAt };
}

/** Tiny stable hash for a filter string — used as a cache key qualifier so two different
 *  narrow-fetch filters don't collide. Not cryptographic; FNV-1a 32-bit is plenty here
 *  since collision only causes a re-fetch (same safety property as any cache key). */
function hashFilter(filter: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < filter.length; i++) {
    hash ^= filter.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}
