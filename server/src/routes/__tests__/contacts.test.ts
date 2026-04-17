// FILE: server/src/routes/__tests__/contacts.test.ts
// PURPOSE: Tests for GET /api/sales/contacts — regression guard for Codex #4 (no cross-customer
//   email dedup) and for dimension-aware customer resolution via scopeOrders.
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// WHY mock order: the contacts route imports readOrders, cachedFetch, scopeOrders, and
// priority-queries at module load. We mock them BEFORE importing the router so the route
// picks up our test doubles. Matches the pattern in fetch-all.test.ts.

vi.mock('../../cache/order-cache.js', () => ({
  readOrders: vi.fn(),
}));

vi.mock('../../cache/cache-layer.js', () => ({
  cachedFetch: vi.fn(),
}));

vi.mock('../../services/priority-instance.js', () => ({
  priorityClient: {},
}));

vi.mock('../../services/priority-queries.js', () => ({
  fetchContacts: vi.fn(),
  fetchCustomers: vi.fn(),
}));

// scopeOrders is pure — we use the real implementation so routing logic exercises the
// same scope semantics the dashboard uses. If its contract changes, this test will catch
// integration breaks, not silently pass.
import { contactsRouter } from '../contacts.js';
import { readOrders } from '../../cache/order-cache.js';
import { cachedFetch } from '../../cache/cache-layer.js';
import { fetchContacts, fetchCustomers } from '../../services/priority-queries.js';
import type { RawContact, RawCustomer, RawOrder } from '../../services/priority-queries.js';

function makeApp() {
  const app = express();
  app.use('/api/sales', contactsRouter);
  return app;
}

// Shared fixtures — keep lean and realistic.
const CUSTOMERS: RawCustomer[] = [
  { CUSTNAME: 'C1', CUSTDES: 'Cust One', ZONECODE: 'Z1', ZONEDES: 'Zone 1', AGENTCODE: 'A', AGENTNAME: 'Alice', CREATEDDATE: '', CTYPECODE: '', CTYPENAME: '' },
  { CUSTNAME: 'C2', CUSTDES: 'Cust Two', ZONECODE: 'Z1', ZONEDES: 'Zone 1', AGENTCODE: 'A', AGENTNAME: 'Alice', CREATEDDATE: '', CTYPECODE: '', CTYPENAME: '' },
];

const baseItem = {
  PDES: '', PARTNAME: 'P1', TQUANT: 0, TUNITNAME: '', QPRICE: 0, PRICE: 0,
  PURCHASEPRICE: 0, QPROFIT: 0, PERCENT: 0,
  Y_1159_5_ESH: '', Y_1530_5_ESH: '', Y_9952_5_ESH: '',
  Y_3020_5_ESH: '', Y_3021_5_ESH: '', Y_17936_5_ESH: '',
  Y_2075_5_ESH: '', Y_5380_5_ESH: '', Y_9967_5_ESH: '',
};

function mkOrder(ordname: string, custname: string, vendor: string): RawOrder {
  return {
    ORDNAME: ordname,
    CURDATE: '2026-01-15T00:00:00Z',
    ORDSTATUSDES: 'Open',
    TOTPRICE: 100,
    CUSTNAME: custname,
    AGENTCODE: 'A',
    AGENTNAME: 'Alice',
    ORDERITEMS_SUBFORM: [{ ...baseItem, Y_1159_5_ESH: vendor, QPRICE: 100 }],
  };
}

function mkContact(name: string, email: string): RawContact {
  return {
    NAME: name,
    POSITIONDES: 'Manager',
    PHONENUM: '555-0100',
    CELLPHONE: '555-0101',
    EMAIL: email,
    INACTIVE: '',
  };
}

describe('GET /api/sales/contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cachedFetch).mockImplementation(async (_key, _ttl, fn) => {
      const data = await fn();
      return { data, cached: false, cachedAt: null };
    });
  });

  describe('Codex #4 — no cross-customer email dedup', () => {
    it('same email on two customers yields two rows (one per customer)', async () => {
      // Each of C1 and C2 has a contact with the same email — intentionally the classic
      // shared-accounting-inbox pattern. Priority stores these separately per customer.
      vi.mocked(fetchContacts).mockImplementation(async (_client, customerId) => {
        if (customerId === 'C1') return [mkContact('AP C1', 'accounts@shared.com')];
        if (customerId === 'C2') return [mkContact('AP C2', 'accounts@shared.com')];
        return [];
      });
      vi.mocked(fetchCustomers).mockResolvedValue(CUSTOMERS);

      const res = await request(makeApp()).get('/api/sales/contacts?customerIds=C1,C2');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      const emails = res.body.data.map((c: { email: string; customerName: string }) => c.email);
      const customers = res.body.data.map((c: { customerName: string }) => c.customerName);
      expect(emails).toEqual(['accounts@shared.com', 'accounts@shared.com']);
      expect(new Set(customers)).toEqual(new Set(['Cust One', 'Cust Two']));
    });

    it('duplicate email WITHIN a single customer is not deduped either (one contact = one row)', async () => {
      // Within-customer dedup would also be wrong — Priority allows two contacts at the
      // same customer with the same email (rare, but legitimate for role-based inboxes).
      vi.mocked(fetchContacts).mockResolvedValue([
        mkContact('Primary', 'shared@co.com'),
        mkContact('Backup', 'shared@co.com'),
      ]);
      vi.mocked(fetchCustomers).mockResolvedValue(CUSTOMERS);

      const res = await request(makeApp()).get('/api/sales/contacts?customerIds=C1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((c: { customerName: string }) => c.customerName === 'Cust One')).toBe(true);
    });
  });

  describe('Dimension-aware resolution', () => {
    it('dimension=vendor resolves to customers who bought from that vendor, annotates with customerName', async () => {
      // C1 and C2 both ordered from V1; V1 contacts come from BOTH customers.
      vi.mocked(readOrders).mockResolvedValue({
        orders: [mkOrder('O1', 'C1', 'V1'), mkOrder('O2', 'C2', 'V1'), mkOrder('O3', 'C1', 'V2')],
        meta: { lastFetchDate: '2026-04-17T00:00:00Z', orderCount: 3, filterHash: 'all' },
      });
      vi.mocked(fetchContacts).mockImplementation(async (_client, customerId) => {
        if (customerId === 'C1') return [mkContact('Alice', 'alice@c1.com')];
        if (customerId === 'C2') return [mkContact('Bob', 'bob@c2.com')];
        return [];
      });
      vi.mocked(fetchCustomers).mockResolvedValue(CUSTOMERS);

      const res = await request(makeApp()).get('/api/sales/contacts?dimension=vendor&entityId=V1');

      expect(res.status).toBe(200);
      // WHY cast: supertest types res.body as any. Narrow here so the reduce below has
      // proper element types under TS strict mode (noImplicitAny).
      const contacts = res.body.data as Array<{ email: string; customerName: string }>;
      expect(contacts).toHaveLength(2);
      const byCustomer: Record<string, string[]> = {};
      for (const c of contacts) {
        (byCustomer[c.customerName] ??= []).push(c.email);
      }
      expect(byCustomer['Cust One']).toEqual(['alice@c1.com']);
      expect(byCustomer['Cust Two']).toEqual(['bob@c2.com']);
    });

    it('dimension=vendor with no matching orders → 200 empty array (not 500)', async () => {
      // V_NOPE never appears in any order — the scope resolves to zero customers.
      vi.mocked(readOrders).mockResolvedValue({
        orders: [mkOrder('O1', 'C1', 'V1')],
        meta: { lastFetchDate: '2026-04-17T00:00:00Z', orderCount: 1, filterHash: 'all' },
      });
      vi.mocked(fetchCustomers).mockResolvedValue(CUSTOMERS);

      const res = await request(makeApp()).get('/api/sales/contacts?dimension=vendor&entityId=V_NOPE');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('dimension=vendor with cold orders cache → 200 empty array (cache not yet warm)', async () => {
      // Before Report has ever run, readOrders returns null — don't crash, don't 500.
      vi.mocked(readOrders).mockResolvedValue(null);

      const res = await request(makeApp()).get('/api/sales/contacts?dimension=vendor&entityId=V1');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('Legacy single-customer contract', () => {
    it('?customerId=X uses the fast path — NO customerName annotation (back-compat)', async () => {
      // The old single-customer contract didn't annotate contacts with customerName since
      // the caller already knew which customer it asked for. Preserved for v1 consumers.
      vi.mocked(fetchContacts).mockResolvedValue([mkContact('Alice', 'alice@c1.com')]);

      const res = await request(makeApp()).get('/api/sales/contacts?customerId=C1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].customerName).toBeUndefined();
      expect(res.body.data[0].email).toBe('alice@c1.com');
    });
  });

  describe('Validation', () => {
    it('rejects request with no customerId, customerIds, dimension, or entityId', async () => {
      const res = await request(makeApp()).get('/api/sales/contacts');
      // Zod refine returns 400 (validated by middleware/request-validator.ts).
      expect(res.status).toBe(400);
    });
  });
});
