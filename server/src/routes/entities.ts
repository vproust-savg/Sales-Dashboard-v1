// FILE: server/src/routes/entities.ts
// PURPOSE: GET /api/sales/entities — lightweight endpoint returning entity list for the left panel
// USED BY: client/hooks/useEntityList.ts
// EXPORTS: entitiesRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { priorityClient } from '../services/priority-instance.js';
import { fetchCustomers } from '../services/priority-queries.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL, buildFilterQualifier } from '../cache/cache-keys.js';
import { redis } from '../cache/redis-client.js';
import { deriveEntityStubs } from '../services/entity-stub-builder.js';
import type { EntityListItem, Dimension } from '@shared/types/dashboard';
import type { RawCustomer } from '../services/priority-queries.js';
import type { ApiResponse } from '@shared/types/api-responses';

const querySchema = z.object({
  groupBy: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).default('customer'),
  period: z.string().default('ytd'),
});

export const entitiesRouter = Router();

entitiesRouter.get('/entities', validateQuery(querySchema), async (_req, res, next) => {
  try {
    const { groupBy, period } = res.locals.query as z.infer<typeof querySchema>;

    // WHY: entities_full (from fetch-all) only contains entities with orders.
    // Customer dimension must show ALL customers, so skip enriched cache for it.
    if (groupBy !== 'customer') {
      // WHY: Always read the UNFILTERED key. Filtered entity lists are sent
      // directly via the fetch-all SSE response, not re-read from cache here.
      const fullKey = cacheKey('entities_full', period, buildFilterQualifier(groupBy, 'all'));
      const fullResult = await redis.get(fullKey);
      if (fullResult !== null) {
        const envelope = typeof fullResult === 'string' ? JSON.parse(fullResult) : fullResult;
        const fullResponse: ApiResponse<{ entities: EntityListItem[]; yearsAvailable: string[] }> = {
          data: (envelope as { data: { entities: EntityListItem[]; yearsAvailable: string[] } }).data,
          meta: {
            cached: true,
            cachedAt: (envelope as { cachedAt: string }).cachedAt,
            period,
            dimension: groupBy,
            entityCount: (envelope as { data: { entities: EntityListItem[] } }).data.entities.length,
          },
        };
        return res.json(fullResponse);
      }
    }

    const summaryKey = cacheKey('entities_summary', period, groupBy);

    // WHY: Check for pre-computed entity summaries first (set by warm cache or previous request).
    // On cache miss for customer dimension, build a minimal list from CUSTOMERS entity (no orders).
    const result = await cachedFetch<{ entities: EntityListItem[]; yearsAvailable: string[] }>(
      summaryKey,
      getTTL('entities_summary'),
      async () => {
        if (groupBy !== 'customer') {
          // WHY: Derive entity stubs from warm-cache orders instead of returning empty.
          // Same pattern as customers: show entity list first, load details on click.
          const stubs = await deriveEntityStubs(groupBy as Dimension, period);
          return stubs ?? { entities: [], yearsAvailable: [] };
        }

        const customers = await fetchCustomers(priorityClient);
        const entities = buildCustomerStubs(customers);
        return { entities, yearsAvailable: [] };
      },
    );

    const response: ApiResponse<{ entities: EntityListItem[]; yearsAvailable: string[] }> = {
      data: result.data,
      meta: {
        cached: result.cached,
        cachedAt: result.cachedAt,
        period,
        dimension: groupBy,
        entityCount: result.data.entities.length,
      },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

/** Build EntityListItem[] from customers with null metrics (no order data loaded) */
function buildCustomerStubs(customers: RawCustomer[]): EntityListItem[] {
  return customers.map(c => ({
    id: c.CUSTNAME,
    name: c.CUSTDES,
    meta1: [c.ZONEDES, c.AGENTNAME].filter(Boolean).join(' \u00B7 '),
    meta2: null,           // WHY: null signals "not loaded" — client hides this
    revenue: null,
    orderCount: null,
    avgOrder: null,
    marginPercent: null,
    marginAmount: null,
    frequency: null,
    lastOrderDate: null,
    rep: c.AGENTNAME || null,
    zone: c.ZONEDES || null,
    customerType: c.CTYPENAME || null,
    prevYearRevenue: null,
    prevYearRevenueFull: null,
  }));
}
