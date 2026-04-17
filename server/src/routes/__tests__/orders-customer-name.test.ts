// FILE: server/src/routes/__tests__/orders-customer-name.test.ts
// PURPOSE: TDD regression guard — every OrderRow must carry customerName for non-customer dims
//   (zone/vendor/brand/product_type/product). The dashboard route is the delivery vehicle;
//   orders live inside DashboardPayload.orders (Task 11).
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// WHY mock order: dashboard route imports readOrders, cachedFetch, and priority-queries at module
// load. We mock them BEFORE importing the router so the route picks up our test doubles.
// Mirrors the pattern in contacts.test.ts and fetch-all.test.ts.

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
  fetchOrders: vi.fn(),
  fetchCustomers: vi.fn(),
  fetchProducts: vi.fn(),
}));

import { dashboardRouter } from '../dashboard.js';
import { readOrders } from '../../cache/order-cache.js';
import { cachedFetch } from '../../cache/cache-layer.js';
import { fetchOrders, fetchCustomers } from '../../services/priority-queries.js';
import type { RawOrder, RawCustomer } from '../../services/priority-queries.js';
import type { DashboardPayload, OrderRow } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

function makeApp() {
  const app = express();
  app.use('/api/sales', dashboardRouter);
  return app;
}

// Shared fixtures — zone Z1 has customers C1 + C2, each with 1 order.
const CUSTOMERS: RawCustomer[] = [
  { CUSTNAME: 'C1', CUSTDES: 'Cust One', ZONECODE: 'Z1', ZONEDES: 'Zone 1', AGENTCODE: 'A', AGENTNAME: 'Alice', CREATEDDATE: '', CTYPECODE: '', CTYPENAME: '' },
  { CUSTNAME: 'C2', CUSTDES: 'Cust Two', ZONECODE: 'Z1', ZONEDES: 'Zone 1', AGENTCODE: 'A', AGENTNAME: 'Alice', CREATEDDATE: '', CTYPECODE: '', CTYPENAME: '' },
];

const baseItem = {
  PDES: 'Widget', PARTNAME: 'P1', TQUANT: 1, TUNITNAME: 'EA', QPRICE: 100, PRICE: 100,
  PURCHASEPRICE: 60, QPROFIT: 40, PERCENT: 40,
  Y_1159_5_ESH: 'V1', Y_1530_5_ESH: '', Y_9952_5_ESH: '',
  Y_3020_5_ESH: '', Y_3021_5_ESH: '', Y_17936_5_ESH: '',
  Y_2075_5_ESH: '', Y_5380_5_ESH: '', Y_9967_5_ESH: '',
};

function mkOrder(ordname: string, custname: string): RawOrder {
  return {
    ORDNAME: ordname,
    CURDATE: '2026-01-15T00:00:00Z',
    ORDSTATUSDES: 'Closed',
    TOTPRICE: 100,
    CUSTNAME: custname,
    AGENTCODE: 'A',
    AGENTNAME: 'Alice',
    ORDERITEMS_SUBFORM: [{ ...baseItem }],
  };
}

const ORDERS: RawOrder[] = [
  mkOrder('O1', 'C1'),
  mkOrder('O2', 'C2'),
];

describe('GET /api/sales/dashboard — customerName on OrderRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // WHY: readOrders returns the universal order cache. We simulate a warm cache.
    vi.mocked(readOrders).mockResolvedValue({
      orders: ORDERS,
      meta: { lastFetchDate: '2026-04-17T00:00:00Z', orderCount: 2, filterHash: 'all' },
    });
    // WHY: cachedFetch is used for customers (and prev-year fallback). Pass-through to fn().
    vi.mocked(cachedFetch).mockImplementation(async (_key, _ttl, fn) => {
      const data = await fn();
      return { data, cached: false, cachedAt: null };
    });
    vi.mocked(fetchCustomers).mockResolvedValue(CUSTOMERS);
    vi.mocked(fetchOrders).mockResolvedValue([]);
  });

  it('annotates customerName on every OrderRow for dimension=zone (non-customer dim)', async () => {
    // WHY: zone dimension must populate customerName so the UI can display which customer
    // placed each order in the Orders tab of a zone entity.
    const res = await request(makeApp())
      .get('/api/sales/dashboard?groupBy=zone&entityId=Z1')
      .expect(200);

    const body = res.body as ApiResponse<DashboardPayload>;
    const orders = body.data.orders as OrderRow[];

    expect(orders.length).toBeGreaterThan(0);
    for (const row of orders) {
      expect(row.customerName).toBeTruthy();
      expect(['Cust One', 'Cust Two']).toContain(row.customerName);
    }
  });

  it('each OrderRow customerName matches the correct customer (not cross-contaminated)', async () => {
    const res = await request(makeApp())
      .get('/api/sales/dashboard?groupBy=zone&entityId=Z1')
      .expect(200);

    const body = res.body as ApiResponse<DashboardPayload>;
    const orders = body.data.orders as OrderRow[];

    const o1 = orders.find(o => o.orderNumber === 'O1');
    const o2 = orders.find(o => o.orderNumber === 'O2');
    expect(o1?.customerName).toBe('Cust One');
    expect(o2?.customerName).toBe('Cust Two');
  });

  it('dimension=customer: customerName is optional/absent (single-entity view)', async () => {
    // WHY: In customer dimension, the entity IS the customer — showing customerName on every row
    // is redundant. The field may be omitted or set (both are acceptable for back-compat).
    // This test documents expected behavior rather than asserting absence.
    const res = await request(makeApp())
      .get('/api/sales/dashboard?groupBy=customer&entityId=C1')
      .expect(200);

    const body = res.body as ApiResponse<DashboardPayload>;
    // Should not throw — the route must still return 200 with order rows.
    const orders = body.data.orders as OrderRow[];
    expect(Array.isArray(orders)).toBe(true);
  });
});
