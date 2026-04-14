// FILE: server/src/routes/contacts.ts
// PURPOSE: GET /api/sales/contacts?customerId=C00001 (single) or customerIds=C1,C2,... (multi)
// USED BY: client/hooks/useContacts.ts, Consolidated 2 ConsolidatedContactsTable
// EXPORTS: contactsRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { priorityClient } from '../services/priority-instance.js';
import { fetchContacts, fetchCustomers } from '../services/priority-queries.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import type { Contact } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

// WHY: Accept either single (customerId) or multi (customerIds) — back-compat with v1
// single-entity usage plus new Consolidated 2 multi-customer requirement (adversarial H5).
const querySchema = z.object({
  customerId: z.string().optional(),
  customerIds: z.string().optional(),
}).refine(q => q.customerId || q.customerIds, {
  message: 'Either customerId or customerIds is required',
});

export const contactsRouter = Router();

contactsRouter.get('/contacts', validateQuery(querySchema), async (_req, res, next) => {
  try {
    const { customerId, customerIds } = res.locals.query as z.infer<typeof querySchema>;

    // WHY: Single-customer path preserves the original contract — no customerName annotation
    // since the consumer already knows which customer it asked for.
    if (customerId && !customerIds) {
      const result = await cachedFetch(
        cacheKey('contacts', customerId),
        getTTL('contacts'),
        async () => {
          const raw = await fetchContacts(priorityClient, customerId);
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
      return;
    }

    // WHY: Multi-customer path annotates each contact with customerName (CUSTDES) so the
    // ConsolidatedContactsTable can render a Customer column. Uses per-customer cache so
    // repeated requests for overlapping sets are instant after the first fetch.
    const ids = (customerIds ?? '').split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      res.status(400).json({ error: { message: 'customerIds must contain at least one id' } });
      return;
    }

    const customersResult = await cachedFetch(
      cacheKey('customers', 'all'),
      getTTL('customers'),
      () => fetchCustomers(priorityClient),
    );
    const custNameById = new Map(customersResult.data.map(c => [c.CUSTNAME, c.CUSTDES]));

    const perCustomerResults = await Promise.all(
      ids.map(id => cachedFetch(
        cacheKey('contacts', id),
        getTTL('contacts'),
        async () => {
          const raw = await fetchContacts(priorityClient, id);
          return raw.map(c => ({
            fullName: c.NAME,
            position: c.POSITIONDES,
            phone: c.CELLPHONE || c.PHONENUM,
            email: c.EMAIL,
          })) satisfies Contact[];
        },
      )),
    );

    const annotated: Contact[] = perCustomerResults.flatMap((result, i) => {
      const id = ids[i];
      const customerName = custNameById.get(id) ?? id;
      return result.data.map(c => ({ ...c, customerName }));
    });

    const response: ApiResponse<Contact[]> = {
      data: annotated,
      meta: {
        cached: perCustomerResults.every(r => r.cached),
        cachedAt: null,
        period: 'all',
        dimension: 'contacts',
        entityCount: annotated.length,
      },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});
