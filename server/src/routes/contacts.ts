// FILE: server/src/routes/contacts.ts
// PURPOSE: GET /api/sales/contacts — single/multi-customer contacts, or dimension-aware
//   resolution for non-customer dims (vendor/zone/product_type/etc. → customers who buy).
// USED BY: client/hooks/useContacts.ts, ConsolidatedContactsTable, non-customer-dim TabsSection
// EXPORTS: contactsRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { priorityClient } from '../services/priority-instance.js';
import { fetchContacts, fetchCustomers } from '../services/priority-queries.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { readOrders } from '../cache/order-cache.js';
import { scopeOrders } from '../services/entity-subset-filter.js';
import type { Contact, Dimension } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

// WHY: Accept either customerId(s) (direct customer mode) or dimension + entityId(s)
// (resolve customers via scopeOrders on the universal order cache).
const querySchema = z.object({
  customerId: z.string().optional(),
  customerIds: z.string().optional(),
  dimension: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).optional(),
  entityId: z.string().optional(),
  entityIds: z.string().optional(),
}).refine(
  q => q.customerId || q.customerIds || (q.dimension && (q.entityId || q.entityIds)),
  { message: 'Requires customerId(s) or dimension + entityId(s)' },
);

export const contactsRouter = Router();

contactsRouter.get('/contacts', validateQuery(querySchema), async (_req, res, next) => {
  try {
    const q = res.locals.query as z.infer<typeof querySchema>;

    // Resolve customerIds based on input mode
    const customerIds = await resolveCustomerIds(q);
    if (customerIds === null) {
      res.status(400).json({ error: { message: 'No customers resolved from query params' } });
      return;
    }
    if (customerIds.length === 0) {
      // Valid empty result — no customers match this dimension's scope
      const response: ApiResponse<Contact[]> = {
        data: [],
        meta: { cached: false, cachedAt: null, period: 'all', dimension: 'contacts', entityCount: 0 },
      };
      res.json(response);
      return;
    }

    // Single-customer fast path (original contract, no customerName annotation)
    if (customerIds.length === 1 && q.customerId && !q.customerIds && !q.dimension) {
      const only = customerIds[0];
      const result = await cachedFetch(
        cacheKey('contacts', only),
        getTTL('contacts'),
        async () => {
          const raw = await fetchContacts(priorityClient, only);
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

    // Multi-customer path — always annotates with customerName. One row per (customer, contact).
    // Codex #4: NO cross-customer email dedup — that would drop legitimate contact relationships.
    const customersResult = await cachedFetch(
      cacheKey('customers', 'all'),
      getTTL('customers'),
      () => fetchCustomers(priorityClient),
    );
    const custNameById = new Map(customersResult.data.map(c => [c.CUSTNAME, c.CUSTDES]));

    const perCustomerResults = await Promise.all(
      customerIds.map(id => cachedFetch(
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
      const id = customerIds[i];
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

/** Resolve customerIds from query. Returns:
 *  - string[] of CUSTNAMEs when customerId(s) are provided directly
 *  - string[] of CUSTNAMEs resolved via scopeOrders for non-customer dims
 *  - null on unexpected input (shouldn't happen — Zod refine covers most cases) */
async function resolveCustomerIds(q: {
  customerId?: string;
  customerIds?: string;
  dimension?: Dimension;
  entityId?: string;
  entityIds?: string;
}): Promise<string[] | null> {
  if (q.customerId && !q.customerIds && !q.dimension) {
    return [q.customerId];
  }
  if (q.customerIds && !q.dimension) {
    return q.customerIds.split(',').map(s => s.trim()).filter(Boolean);
  }

  // Dimension-aware path
  if (!q.dimension || q.dimension === 'customer') {
    // Customer dimension with entityId(s) → treat as customerIds
    const ids = q.entityIds
      ? q.entityIds.split(',').map(s => s.trim()).filter(Boolean)
      : q.entityId ? [q.entityId] : [];
    return ids.length > 0 ? ids : null;
  }

  const entityIds = q.entityIds
    ? q.entityIds.split(',').map(s => s.trim()).filter(Boolean)
    : q.entityId ? [q.entityId] : [];
  if (entityIds.length === 0) return null;

  // WHY universal cache read: contacts for non-customer dims are "customers who buy this
  // vendor's products" — we need to filter orders by the item-based dim then collect CUSTNAMEs.
  const cached = await readOrders('ytd', 'all');
  if (!cached) {
    // No orders cached yet — cannot resolve. Return empty (valid — nothing to show).
    return [];
  }
  const customersResult = await cachedFetch(
    cacheKey('customers', 'all'),
    getTTL('customers'),
    () => fetchCustomers(priorityClient),
  );

  const scoped = scopeOrders(cached.orders, q.dimension, new Set(entityIds), customersResult.data);
  const custSet = new Set(scoped.map(o => o.CUSTNAME));
  return [...custSet];
}
