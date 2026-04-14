// FILE: server/src/routes/__tests__/cache-status.test.ts
// PURPOSE: Tests for GET /api/sales/cache-status endpoint
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { cacheStatusRouter } from '../cache-status.js';

vi.mock('../../cache/redis-client.js', () => ({
  redis: {
    get: vi.fn(),
    keys: vi.fn(),
  },
}));

import { redis } from '../../cache/redis-client.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/sales', cacheStatusRouter);
  return app;
}

describe('GET /api/sales/cache-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns raw=false when no orders_raw cache exists', async () => {
    (redis.keys as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await request(makeApp()).get('/api/sales/cache-status?period=ytd');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      raw: false,
      lastFetchDate: null,
      rowCount: 0,
      filterHashes: [],
    });
  });

  it('returns raw=true with metadata when cache exists', async () => {
    (redis.keys as ReturnType<typeof vi.fn>).mockResolvedValue([
      'dashboard:orders_raw_meta:ytd:all',
    ]);
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        data: { lastFetchDate: '2026-04-14T08:23:00Z', rowCount: 22431, filterHash: 'all' },
        cachedAt: '2026-04-14T08:23:00Z',
      }),
    );

    const res = await request(makeApp()).get('/api/sales/cache-status?period=ytd');

    expect(res.status).toBe(200);
    expect(res.body.raw).toBe(true);
    expect(res.body.lastFetchDate).toBe('2026-04-14T08:23:00Z');
    expect(res.body.rowCount).toBe(22431);
    expect(res.body.filterHashes).toContain('all');
  });

  it('returns 200 with default period when no period param given', async () => {
    (redis.keys as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await request(makeApp()).get('/api/sales/cache-status');
    // no period means default 'ytd' via zod schema, so should still 200
    expect(res.status).toBe(200);
  });
});
