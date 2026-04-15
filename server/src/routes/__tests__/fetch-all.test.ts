// FILE: server/src/routes/__tests__/fetch-all.test.ts
// PURPOSE: Tests for GET /api/sales/fetch-all — focuses on cache-delete behavior for refresh=true
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// WHY: Mock the boundary dependencies so we can observe Redis del calls without
// a real Redis or Priority API. The SSE endpoint's behavior is deterministic
// once these three mocks are in place.

vi.mock('../../cache/redis-client.js', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../../cache/cache-layer.js', () => ({
  cachedFetch: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => {
    const data = await fn();
    return { data, cached: false, cachedAt: new Date().toISOString() };
  }),
}));

vi.mock('../../services/priority-instance.js', () => ({
  priorityClient: {},
}));

vi.mock('../../services/priority-queries.js', () => ({
  fetchOrders: vi.fn().mockResolvedValue([]),
  fetchCustomers: vi.fn().mockResolvedValue([]),
}));

// Import AFTER mocks are set up so the route picks up the mocked modules.
import { fetchAllRouter } from '../fetch-all.js';
import { redis } from '../../cache/redis-client.js';

function makeApp() {
  const app = express();
  app.use('/api/sales', fetchAllRouter);
  return app;
}

describe('GET /api/sales/fetch-all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
    (redis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
  });

  it('with refresh=true: deletes current-year raw, meta, AND prev-year raw caches', async () => {
    const year = new Date().getFullYear();

    await request(makeApp())
      .get('/api/sales/fetch-all?period=ytd&refresh=true')
      .expect(200);

    const delCalls = (redis.del as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(delCalls).toContain('dashboard:orders_raw:ytd:all');
    expect(delCalls).toContain('dashboard:orders_raw_meta:ytd:all');
    expect(delCalls).toContain(`dashboard:orders_year:${year - 1}:all`);
  });

  it('without refresh: does NOT delete any raw caches (uses incremental path or full fetch)', async () => {
    const year = new Date().getFullYear();

    await request(makeApp())
      .get('/api/sales/fetch-all?period=ytd')
      .expect(200);

    const delCalls = (redis.del as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(delCalls).not.toContain('dashboard:orders_raw:ytd:all');
    expect(delCalls).not.toContain(`dashboard:orders_year:${year - 1}:all`);
  });

  it('with refresh=true AND agentName filter: prev-year del uses the same filterHash', async () => {
    const year = new Date().getFullYear();

    await request(makeApp())
      .get('/api/sales/fetch-all?period=ytd&refresh=true&agentName=Alexandra')
      .expect(200);

    const delCalls = (redis.del as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(delCalls).toContain(`dashboard:orders_raw:ytd:agent=Alexandra`);
    expect(delCalls).toContain(`dashboard:orders_raw_meta:ytd:agent=Alexandra`);
    expect(delCalls).toContain(`dashboard:orders_year:${year - 1}:agent=Alexandra`);
  });
});
