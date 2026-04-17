// FILE: server/src/routes/__tests__/fetch-all-narrow-fetch.test.ts
// PURPOSE: TDD regression guard for the fetch-all cold-cache narrow-fetch path.
//   When View Consolidated is invoked with a small customer/zone subset (entityIds),
//   fetch-all MUST narrow the Priority ORDERS call AND must NOT write the narrowed
//   subset to the universal `readOrders(period, 'all')` cache (that would corrupt
//   the shared cache for every other request).
//   Parity with dashboard-cold-cache-narrow-fetch.test.ts for the single-entity path.
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../cache/redis-client.js', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

vi.mock('../../cache/cache-layer.js', () => ({
  cachedFetch: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => {
    const data = await fn();
    return { data, cached: false, cachedAt: new Date().toISOString() };
  }),
}));

vi.mock('../../cache/order-cache.js', () => ({
  writeOrders: vi.fn().mockResolvedValue(true),
  readOrders: vi.fn().mockResolvedValue(null),
  deleteOrderIndex: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/priority-instance.js', () => ({
  priorityClient: {},
}));

vi.mock('../../services/priority-queries.js', () => ({
  fetchOrders: vi.fn().mockResolvedValue([]),
  fetchCustomers: vi.fn().mockResolvedValue([]),
  fetchProducts: vi.fn().mockResolvedValue([]),
}));

import { fetchAllRouter } from '../fetch-all.js';
import { redis } from '../../cache/redis-client.js';
import { fetchOrders, fetchCustomers } from '../../services/priority-queries.js';
import { writeOrders } from '../../cache/order-cache.js';
import type { RawCustomer } from '../../services/priority-queries.js';

const CUSTOMERS: RawCustomer[] = [
  { CUSTNAME: 'C7826', CUSTDES: "Disney's Club 33",           ZONECODE: 'Z1', ZONEDES: 'SoCal', AGENTCODE: 'A', AGENTNAME: 'A', CREATEDDATE: '', CTYPECODE: '', CTYPENAME: '' },
  { CUSTNAME: 'C7825', CUSTDES: "Disney's Grand Californian", ZONECODE: 'Z1', ZONEDES: 'SoCal', AGENTCODE: 'A', AGENTNAME: 'A', CREATEDDATE: '', CTYPECODE: '', CTYPENAME: '' },
  { CUSTNAME: 'C2303', CUSTDES: 'Ami Group',                  ZONECODE: 'Z2', ZONEDES: 'Bay',   AGENTCODE: 'A', AGENTNAME: 'A', CREATEDDATE: '', CTYPECODE: '', CTYPENAME: '' },
];

function makeApp() {
  const app = express();
  app.use('/api/sales', fetchAllRouter);
  return app;
}

function filterArg(args: unknown[]): string | undefined {
  // fetchOrders signature: (client, startDate, endDate, isCurrentPeriod, extraFilter?, onProgress?, signal?)
  return args[4] as string | undefined;
}

describe('GET /api/sales/fetch-all — cold-cache narrow fetch (View Consolidated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCustomers).mockResolvedValue(CUSTOMERS);
    vi.mocked(fetchOrders).mockResolvedValue([]);
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
    (redis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
  });

  it('with entityIds (multi-customer): narrows Priority fetchOrders with CUSTNAME OR-chain', async () => {
    await request(makeApp())
      .get('/api/sales/fetch-all?groupBy=customer&entityIds=C7826,C7825&period=ytd')
      .buffer(true)
      .parse((res, cb) => { res.on('data', () => {}); res.on('end', () => cb(null, Buffer.from(''))); });

    const calls = vi.mocked(fetchOrders).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    // Both the current-year and prev-year fetches must carry the narrow filter.
    for (const args of calls) {
      expect(filterArg(args)).toBe("CUSTNAME eq 'C7826' or CUSTNAME eq 'C7825'");
    }
  });

  it('with entityIds (single customer): narrows Priority fetchOrders with single CUSTNAME eq', async () => {
    await request(makeApp())
      .get('/api/sales/fetch-all?groupBy=customer&entityIds=C7826&period=ytd')
      .buffer(true)
      .parse((res, cb) => { res.on('data', () => {}); res.on('end', () => cb(null, Buffer.from(''))); });

    const calls = vi.mocked(fetchOrders).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) {
      expect(filterArg(args)).toBe("CUSTNAME eq 'C7826'");
    }
  });

  it('with entityIds (zone subset): narrows via CUSTNAME lookup from zone', async () => {
    await request(makeApp())
      .get('/api/sales/fetch-all?groupBy=zone&entityIds=Z1&period=ytd')
      .buffer(true)
      .parse((res, cb) => { res.on('data', () => {}); res.on('end', () => cb(null, Buffer.from(''))); });

    const calls = vi.mocked(fetchOrders).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) {
      expect(filterArg(args)).toBe("CUSTNAME eq 'C7826' or CUSTNAME eq 'C7825'");
    }
  });

  it('with entityIds: MUST NOT write the narrowed subset to the universal cache (poisoning defense)', async () => {
    await request(makeApp())
      .get('/api/sales/fetch-all?groupBy=customer&entityIds=C7826,C7825&period=ytd')
      .buffer(true)
      .parse((res, cb) => { res.on('data', () => {}); res.on('end', () => cb(null, Buffer.from(''))); });

    // writeOrders is the entry point for persisting to the universal readOrders cache.
    // Calling it with a narrowed subset would let other users see only those 2 customers'
    // orders for the entire period — a silent correctness bug.
    expect(writeOrders).not.toHaveBeenCalled();
  });

  it('without entityIds (full Report run): does NOT narrow, DOES write to universal cache', async () => {
    // Make fetchOrders return something so writeOrders sees non-empty data.
    vi.mocked(fetchOrders).mockResolvedValue([]);

    await request(makeApp())
      .get('/api/sales/fetch-all?groupBy=customer&period=ytd')
      .buffer(true)
      .parse((res, cb) => { res.on('data', () => {}); res.on('end', () => cb(null, Buffer.from(''))); });

    const calls = vi.mocked(fetchOrders).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) {
      expect(filterArg(args)).toBeUndefined();
    }
    // Full Report path MUST write to the universal cache so subsequent readers benefit.
    expect(writeOrders).toHaveBeenCalled();
  });

  it('with entityIds (per-item dim, e.g. vendor): does NOT narrow (no ORDERS-level filter)', async () => {
    // Per-item dimensions (vendor/brand/product_type/product) cannot be narrowed at the
    // ORDERS level in Priority's OData surface. The fetch-all handler falls back to the
    // full-universe path; in-memory filtering kicks in later.
    await request(makeApp())
      .get('/api/sales/fetch-all?groupBy=vendor&entityIds=V123&period=ytd')
      .buffer(true)
      .parse((res, cb) => { res.on('data', () => {}); res.on('end', () => cb(null, Buffer.from(''))); });

    const calls = vi.mocked(fetchOrders).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) {
      expect(filterArg(args)).toBeUndefined();
    }
  });
});
