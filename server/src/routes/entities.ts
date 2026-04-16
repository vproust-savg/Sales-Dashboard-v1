// FILE: server/src/routes/entities.ts
// PURPOSE: GET /api/sales/entities — lightweight endpoint returning entity list for the left panel
// USED BY: client/hooks/useEntityList.ts
// EXPORTS: entitiesRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { buildEntityList } from '../services/entity-list-builder.js';
import type { Dimension, EntityListItem } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

const querySchema = z.object({
  groupBy: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).default('customer'),
  period: z.string().default('ytd'),
});

export const entitiesRouter = Router();

entitiesRouter.get('/entities', validateQuery(querySchema), async (_req, res, next) => {
  try {
    const { groupBy, period } = res.locals.query as z.infer<typeof querySchema>;
    const result = await buildEntityList(groupBy as Dimension, period);

    const response: ApiResponse<{ entities: EntityListItem[]; yearsAvailable: string[] }> = {
      data: { entities: result.entities, yearsAvailable: result.yearsAvailable },
      meta: {
        cached: true,
        cachedAt: null,
        period,
        dimension: groupBy,
        entityCount: result.entities.length,
        enriched: result.enriched,
      },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});
