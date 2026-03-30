// FILE: server/src/routes/contacts.ts
// PURPOSE: GET /api/sales/contacts?customerId=C00001 — fetch contacts for one customer
// USED BY: client/hooks/useContacts.ts
// EXPORTS: contactsRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { PriorityClient } from '../services/priority-client.js';
import { fetchContacts } from '../services/priority-queries.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { env } from '../config/env.js';
import type { Contact } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

const querySchema = z.object({
  customerId: z.string().min(1),
});

export const contactsRouter = Router();

contactsRouter.get('/contacts', validateQuery(querySchema), async (_req, res, next) => {
  try {
    const { customerId } = res.locals.query as z.infer<typeof querySchema>;
    const client = new PriorityClient({
      baseUrl: env.PRIORITY_BASE_URL,
      username: env.PRIORITY_USERNAME,
      password: env.PRIORITY_PASSWORD,
    });

    const result = await cachedFetch(
      cacheKey('contacts', customerId),
      getTTL('contacts'),
      async () => {
        const raw = await fetchContacts(client, customerId);
        return raw.map(c => ({
          fullName: c.NAME,
          position: c.POSITIONDES,
          phone: c.CELLPHONE || c.PHONENUM,
          email: c.EMAIL,
        })) satisfies Contact[];
      },
    );

    const response: ApiResponse<Contact[]> = {
      data: result.data,
      meta: {
        cached: result.cached,
        cachedAt: result.cachedAt,
        period: 'all',
        dimension: 'contacts',
        entityCount: result.data.length,
      },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});
