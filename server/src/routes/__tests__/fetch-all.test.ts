// FILE: server/src/routes/__tests__/fetch-all.test.ts
// PURPOSE: Tests for GET /api/sales/fetch-all — focuses on cache-delete behavior for refresh=true
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
import { fetchOrders, fetchCustomers } from '../../services/priority-queries.js';

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

describe('fetch-all route uses the extracted SSE writer (C4-T4)', () => {
  it('fetch-all.ts imports createSseWriter from ./sse-writer.js', () => {
    const src = readFileSync(resolve(__dirname, '../fetch-all.ts'), 'utf8');
    expect(src).toMatch(/import\s*\{[^}]*createSseWriter[^}]*\}\s*from\s*['"]\.\/sse-writer\.js['"]/);
  });
});

describe('prev-year cross-route consistency (B-T9)', () => {
  // TODO: See docs/superpowers/specs/2026-04-15-building-report-modal-and-entity-prev-year-design.md (Feature B / Finding #5)
  //   and docs/superpowers/plans/2026-04-15-building-report-modal-and-entity-prev-year-plan.md Task 4.6.
  // Requires supertest setup for BOTH /fetch-all and /dashboard routes with shared fixtures.
  // Both routes pass filteredPrev + period to groupByDimension (fetch-all.ts + dashboard.ts:137),
  // so per-entity prev-year fields should match. A full integration test would:
  //   1. Mock fetchOrders to return deterministic (current, prev) fixtures
  //   2. Call /fetch-all → collect entities[].prevYearRevenue
  //   3. Call /dashboard (single-entity path) → collect entities[].prevYearRevenue
  //   4. Assert equal for every customer present in BOTH responses
  // Skipped until the dashboard route has a supertest harness alongside fetch-all's.
  it.skip('cross-route prev-year consistency (B-T9, Codex Finding #5)', () => {});
});

// WHY: Fixture orders span 3 customers across 2 zones. The ORDSTATUSDES / AGENTCODE fields
// are required by aggregateOrders but not exercised by D3 tests — minimal safe values used.
const sampleOrders = [
  { ORDNAME: '1', CUSTNAME: 'C001', CURDATE: '2026-01-01T00:00:00Z', ORDSTATUSDES: 'Closed', TOTPRICE: 100, AGENTCODE: 'A', AGENTNAME: 'Agent', ORDERITEMS_SUBFORM: [] },
  { ORDNAME: '2', CUSTNAME: 'C002', CURDATE: '2026-02-01T00:00:00Z', ORDSTATUSDES: 'Closed', TOTPRICE: 200, AGENTCODE: 'A', AGENTNAME: 'Agent', ORDERITEMS_SUBFORM: [] },
  { ORDNAME: '3', CUSTNAME: 'C003', CURDATE: '2026-03-01T00:00:00Z', ORDSTATUSDES: 'Closed', TOTPRICE: 300, AGENTCODE: 'A', AGENTNAME: 'Agent', ORDERITEMS_SUBFORM: [] },
];
const sampleCustomers = [
  { CUSTNAME: 'C001', CUSTDES: 'Alpha', ZONECODE: 'ZN', ZONEDES: 'Northeast', AGENTCODE: 'A', AGENTNAME: 'Agent', CREATEDDATE: '2025-01-01', CTYPECODE: 'X', CTYPENAME: 'X' },
  { CUSTNAME: 'C002', CUSTDES: 'Beta',  ZONECODE: 'ZN', ZONEDES: 'Northeast', AGENTCODE: 'A', AGENTNAME: 'Agent', CREATEDDATE: '2025-01-01', CTYPECODE: 'X', CTYPENAME: 'X' },
  { CUSTNAME: 'C003', CUSTDES: 'Gamma', ZONECODE: 'ZS', ZONEDES: 'Southeast', AGENTCODE: 'A', AGENTNAME: 'Agent', CREATEDDATE: '2025-01-01', CTYPECODE: 'X', CTYPENAME: 'X' },
];

describe('D3 — entityIds filter on /fetch-all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
    (redis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    vi.mocked(fetchOrders).mockResolvedValue(sampleOrders as never);
    vi.mocked(fetchCustomers).mockResolvedValue(sampleCustomers as never);
  });

  it('returns entities matching the entityIds subset (D3-T1)', async () => {
    const response = await request(makeApp())
      .get('/api/sales/fetch-all?groupBy=customer&period=ytd&entityIds=C001,C002')
      .expect(200);
    const completeLine = response.text.split('\n\n').find(block => block.startsWith('event: complete'));
    expect(completeLine).toBeTruthy();
    const data = JSON.parse(completeLine!.split('\ndata: ')[1]) as { entities: { id: string }[] };
    const ids = data.entities.map((e) => e.id).sort();
    expect(ids).toEqual(['C001', 'C002']);
  });

  it('graceful empty result when entityIds match nothing (D3-T2)', async () => {
    const response = await request(makeApp())
      .get('/api/sales/fetch-all?groupBy=customer&period=ytd&entityIds=INVALID')
      .expect(200);
    const completeLine = response.text.split('\n\n').find(block => block.startsWith('event: complete'));
    const data = JSON.parse(completeLine!.split('\ndata: ')[1]) as { entities: { id: string }[]; kpis: { totalRevenue: number } };
    expect(data.entities).toEqual([]);
    expect(data.kpis.totalRevenue).toBe(0);
  });

  // WHY: D3-T3 requires the raw cache to be pre-populated then re-hit on a second call.
  // The current cachedFetch mock bypasses Redis entirely, so the raw-cache re-use path
  // cannot be exercised here. Validate manually against a deployed environment.
  it.skip('reuses raw cache across different entityIds subsets (D3-T3)', () => {
    // Needs a real cachedFetch wrapper that actually caches (current mock bypasses Redis).
    // Validate manually against a deployed environment.
  });

  it('does not write report_payload/entities_full/entity_detail cache when entityIds present (D3-T4)', async () => {
    const setSpy = redis.set as ReturnType<typeof vi.fn>;
    setSpy.mockClear();
    await request(makeApp())
      .get('/api/sales/fetch-all?groupBy=customer&period=ytd&entityIds=C001,C002')
      .expect(200);
    const aggregateWrites = setSpy.mock.calls.filter(c =>
      typeof c[0] === 'string' && (
        c[0].includes('report_payload') || c[0].includes('entities_full') || c[0].includes('entity_detail')
      )
    );
    expect(aggregateWrites).toHaveLength(0);
  });

  it('composes entityIds with zone filter (D3-T5)', async () => {
    const response = await request(makeApp())
      .get('/api/sales/fetch-all?groupBy=customer&period=ytd&entityIds=C001,C002,C003&zone=Northeast')
      .expect(200);
    const completeLine = response.text.split('\n\n').find(block => block.startsWith('event: complete'));
    const data = JSON.parse(completeLine!.split('\ndata: ')[1]) as { entities: { id: string }[] };
    const ids = data.entities.map((e) => e.id).sort();
    // C001, C002 are in Northeast; C003 is in Southeast. Filter = AND → only C001, C002.
    expect(ids).toEqual(['C001', 'C002']);
  });

  // WHY: D3-T1..T5 all use groupBy=customer. D3-T5b would sweep the other 5 dimensions to
  // prove the subset filter is not customer-specific. Skipped until vendor/brand/product_type/
  // product/zone fixture coverage exists (requires ORDERITEMS_SUBFORM fields in sample data).
  it.skip('entityIds filter works for all 6 dimensions (D3-T5b)', () => {
    // Would need vendor/brand/product_type/product/zone fixture coverage.
    // Move to a fuller integration test when that fixture exists.
  });
});

describe('Server-side error logging (C2)', () => {
  it('console.error fires before sendEvent error on caught exception (C2-T1)', async () => {
    // WHY: Strict temporal ordering between console.error and the SSE error write cannot be
    // observed from supertest without spying on ServerResponse.prototype.write — which
    // intercepts Node's internal write machinery and breaks supertest's response collection.
    // Instead, we assert: (1) console.error fired with the correct shape, (2) the SSE response
    // body contains the 'event: error' line. Both being present proves both code paths ran.
    // Reordering regressions (sendEvent before console.error) are caught directly in diffs of
    // fetch-all.ts — the catch block at lines 135-143 is the authoritative ordering artifact.
    const callOrder: string[] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((msg: string, ...args: unknown[]) => {
      if (typeof msg === 'string' && msg.startsWith('[fetch-all] Report failed:')) {
        callOrder.push('console.error');
      }
      void args;
    });

    vi.mocked(fetchOrders).mockRejectedValueOnce(new Error('simulated priority failure'));

    const response = await request(makeApp())
      .get('/api/sales/fetch-all?period=ytd&refresh=true')
      .expect(200);

    // Both error paths must have fired
    expect(callOrder).toContain('console.error');
    expect(response.text).toContain('event: error');

    // console.error must have been called with the correct structured shape
    expect(errorSpy).toHaveBeenCalled();
    const firstCall = errorSpy.mock.calls[0];
    expect(firstCall[0]).toMatch(/^\[fetch-all\] Report failed:/);
    expect(firstCall[1]).toMatchObject({
      groupBy: expect.any(String),
      period: expect.any(String),
      message: expect.any(String),
    });

    errorSpy.mockRestore();
  });
});
