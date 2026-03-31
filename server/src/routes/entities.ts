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
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import type { EntityListItem } from '@shared/types/dashboard';
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
    const summaryKey = cacheKey('entities_summary', period, groupBy);

    // WHY: Check for pre-computed entity summaries first (set by warm cache or previous request).
    // On cache miss for customer dimension, build a minimal list from CUSTOMERS entity (no orders).
    const result = await cachedFetch<{ entities: EntityListItem[]; yearsAvailable: string[] }>(
      summaryKey,
      getTTL('entities_summary'),
      async () => {
        if (groupBy !== 'customer') {
          // WHY: Non-customer dimensions require order data to group — return empty list.
          // The warm cache or dashboard endpoint will populate this key later.
          return { entities: [], yearsAvailable: [] };
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

/** Build EntityListItem[] from customers with revenue=0 (no order data needed) */
function buildCustomerStubs(customers: RawCustomer[]): EntityListItem[] {
  return customers.map(c => ({
    id: c.CUSTNAME,
    name: c.CUSTDES,
    meta1: [c.ZONEDES, c.AGENTNAME].filter(Boolean).join(' \u00B7 '),
    meta2: '0 orders',
    revenue: 0,
    orderCount: 0,
    avgOrder: 0,
    marginPercent: 0,
    marginAmount: 0,
    frequency: null,
    lastOrderDate: null,
    rep: c.AGENTNAME || null,
    zone: c.ZONEDES || null,
    customerType: c.CTYPENAME || null,
  }));
}
