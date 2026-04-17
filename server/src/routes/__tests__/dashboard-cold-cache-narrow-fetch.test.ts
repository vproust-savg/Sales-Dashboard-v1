// FILE: server/src/routes/__tests__/dashboard-cold-cache-narrow-fetch.test.ts
// PURPOSE: TDD regression guard for the cold-cache single-entity fallback. When the
//   universal per-order cache is empty AND the request is scoped to one or more entities,
//   dashboard.ts narrows the Priority fetchOrders call so we don't pull all YTD orders
//   (~22K rows, 6+ min, times out at the 170s per-request cap).
//
//   Narrowing strategy by dimension:
//     customer → CUSTNAME eq '{id}' (or OR-chain for multi)
//     zone     → look up customers in zone, then CUSTNAME OR-chain
//     vendor/brand/product_type/product → resolve customers via warm-cache reverse index,
//       then reuse the CUSTNAME OR-chain. See services/resolve-customers-for-entity.ts
//       and learnings/odata-any-lambda-support.md for why direct OData narrowing isn't
//       possible.
//
//   This guards the regression observed after the Plan A universal-cache refactor AND
//   the per-item extension added in 2026-04.
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

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

vi.mock('../../services/resolve-customers-for-entity.js', () => ({
  resolveCustomersForEntity: vi.fn(),
  MAX_CUSTNAMES_PER_NARROW: 500,
}));

import { dashboardRouter } from '../dashboard.js';
import { readOrders } from '../../cache/order-cache.js';
import { cachedFetch } from '../../cache/cache-layer.js';
import { fetchOrders, fetchCustomers, fetchProducts } from '../../services/priority-queries.js';
import { resolveCustomersForEntity } from '../../services/resolve-customers-for-entity.js';
import type { RawCustomer } from '../../services/priority-queries.js';

function makeApp() {
  const app = express();
  app.use('/api/sales', dashboardRouter);
  return app;
}

// Two zones: Z1 has C7826 + C7825, Z2 has C2303.
const CUSTOMERS: RawCustomer[] = [
  { CUSTNAME: 'C7826', CUSTDES: "Disney's Club 33",            ZONECODE: 'Z1', ZONEDES: 'SoCal', AGENTCODE: 'A', AGENTNAME: 'A', CREATEDDATE: '', CTYPECODE: '', CTYPENAME: '' },
  { CUSTNAME: 'C7825', CUSTDES: "Disney's Grand Californian",  ZONECODE: 'Z1', ZONEDES: 'SoCal', AGENTCODE: 'A', AGENTNAME: 'A', CREATEDDATE: '', CTYPECODE: '', CTYPENAME: '' },
  { CUSTNAME: 'C2303', CUSTDES: 'Ami Group',                   ZONECODE: 'Z2', ZONEDES: 'Bay',   AGENTCODE: 'A', AGENTNAME: 'A', CREATEDDATE: '', CTYPECODE: '', CTYPENAME: '' },
];

function filterArg(args: unknown[]): string | undefined {
  return args[4] as string | undefined;
}

describe('GET /api/sales/dashboard — cold-cache narrow fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate cold universal cache.
    vi.mocked(readOrders).mockResolvedValue(null);
    // Pass-through so fetchers run.
    vi.mocked(cachedFetch).mockImplementation(async (_key, _ttl, fn) => {
      const data = await fn();
      return { data, cached: false, cachedAt: null };
    });
    vi.mocked(fetchCustomers).mockResolvedValue(CUSTOMERS);
    vi.mocked(fetchOrders).mockResolvedValue([]);
    // WHY: product dimension triggers a LOGPART fetch for country-of-origin enrichment.
    // Return an empty list so the route continues without throwing.
    vi.mocked(fetchProducts).mockResolvedValue([]);
    // Default: reverse index not available — per-item requests fall through to universal.
    vi.mocked(resolveCustomersForEntity).mockResolvedValue({ kind: 'no-index' });
  });

  describe('customer dimension', () => {
    it('single-customer request narrows Priority fetchOrders with CUSTNAME eq', async () => {
      await request(makeApp())
        .get('/api/sales/dashboard?groupBy=customer&entityId=C7826&period=ytd')
        .expect(200);

      const calls = vi.mocked(fetchOrders).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const args of calls) {
        expect(filterArg(args)).toBe("CUSTNAME eq 'C7826'");
      }
    });

    it('multi-customer request uses OR-chain CUSTNAME filter', async () => {
      await request(makeApp())
        .get('/api/sales/dashboard?groupBy=customer&entityIds=C7826,C7825&period=ytd')
        .expect(200);

      const calls = vi.mocked(fetchOrders).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const args of calls) {
        expect(filterArg(args)).toBe("CUSTNAME eq 'C7826' or CUSTNAME eq 'C7825'");
      }
    });

    it('escapes single quotes (OData injection defense)', async () => {
      await request(makeApp())
        .get("/api/sales/dashboard?groupBy=customer&entityId=C'7826&period=ytd")
        .expect(200);

      const calls = vi.mocked(fetchOrders).mock.calls;
      for (const args of calls) {
        expect(filterArg(args)).toBe("CUSTNAME eq 'C''7826'");
      }
    });

    it('no-entity request (left-panel boot) does NOT narrow', async () => {
      await request(makeApp())
        .get('/api/sales/dashboard?groupBy=customer&period=ytd')
        .expect(200);

      const calls = vi.mocked(fetchOrders).mock.calls;
      for (const args of calls) {
        expect(filterArg(args)).toBeUndefined();
      }
    });
  });

  describe('zone dimension', () => {
    it('single-zone request narrows by looking up customers in that zone', async () => {
      await request(makeApp())
        .get('/api/sales/dashboard?groupBy=zone&entityId=Z1&period=ytd')
        .expect(200);

      const calls = vi.mocked(fetchOrders).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const args of calls) {
        // Z1 has C7826 + C7825 → OR-chain of those two.
        expect(filterArg(args)).toBe("CUSTNAME eq 'C7826' or CUSTNAME eq 'C7825'");
      }
    });

    it('zone with zero customers does NOT narrow (avoids empty filter)', async () => {
      await request(makeApp())
        .get('/api/sales/dashboard?groupBy=zone&entityId=Z_UNKNOWN&period=ytd')
        .expect(200);

      const calls = vi.mocked(fetchOrders).mock.calls;
      for (const args of calls) {
        expect(filterArg(args)).toBeUndefined();
      }
    });
  });

  describe('per-item dimensions (vendor/brand/product_type/product)', () => {
    // These dimensions' discriminator fields live on ORDERITEMS_SUBFORM. Priority's OData
    // doesn't support any() or a queryable standalone ORDERITEMS (see
    // learnings/odata-any-lambda-support.md). The workaround: warm-cache builds a reverse
    // index mapping dim+id → CUSTNAMEs, and the route resolves that to a CUSTNAME OR-chain.

    it.each([
      ['vendor',       'V123'],
      ['brand',        'BRAND_A'],
      ['product_type', 'PT_X'],
      ['product',      'SKU_001'],
    ])('%s with resolver kind:ok narrows fetchOrders with resolved CUSTNAMEs', async (dim, id) => {
      vi.mocked(resolveCustomersForEntity).mockResolvedValue({ kind: 'ok', custnames: ['C7826', 'C2303'] });

      await request(makeApp())
        .get(`/api/sales/dashboard?groupBy=${dim}&entityId=${id}&period=ytd`)
        .expect(200);

      expect(resolveCustomersForEntity).toHaveBeenCalledWith(dim, [id], 'ytd');
      const calls = vi.mocked(fetchOrders).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const args of calls) {
        expect(filterArg(args)).toBe("CUSTNAME eq 'C7826' or CUSTNAME eq 'C2303'");
      }
    });

    it.each([
      ['vendor',       'V_UNSOLD'],
      ['brand',        'BRAND_NONE'],
      ['product_type', 'PT_NONE'],
      ['product',      'SKU_UNSOLD'],
    ])('%s with resolver kind:empty short-circuits — fetchOrders NOT called', async (dim, id) => {
      vi.mocked(resolveCustomersForEntity).mockResolvedValue({ kind: 'empty' });

      await request(makeApp())
        .get(`/api/sales/dashboard?groupBy=${dim}&entityId=${id}&period=ytd`)
        .expect(200);

      expect(fetchOrders).not.toHaveBeenCalled();
    });

    it.each([
      ['vendor',       'V_MEGA'],
      ['brand',        'BRAND_UBIQUITOUS'],
      ['product_type', 'PT_COMMON'],
      ['product',      'SKU_HOT'],
    ])('%s with resolver kind:over-cap falls through to universal (narrowFilter undefined)', async (dim, id) => {
      vi.mocked(resolveCustomersForEntity).mockResolvedValue({ kind: 'over-cap', count: 1234 });

      await request(makeApp())
        .get(`/api/sales/dashboard?groupBy=${dim}&entityId=${id}&period=ytd`)
        .expect(200);

      const calls = vi.mocked(fetchOrders).mock.calls;
      for (const args of calls) {
        expect(filterArg(args)).toBeUndefined();
      }
    });

    it.each([
      ['vendor',       'V1'],
      ['brand',        'B1'],
      ['product_type', '01'],
      ['product',      'P1'],
    ])('%s with resolver kind:no-index falls through to universal (index not built yet)', async (dim, id) => {
      vi.mocked(resolveCustomersForEntity).mockResolvedValue({ kind: 'no-index' });

      await request(makeApp())
        .get(`/api/sales/dashboard?groupBy=${dim}&entityId=${id}&period=ytd`)
        .expect(200);

      const calls = vi.mocked(fetchOrders).mock.calls;
      for (const args of calls) {
        expect(filterArg(args)).toBeUndefined();
      }
    });

    it('no-entity boot request does NOT invoke resolver (no ids to resolve)', async () => {
      await request(makeApp())
        .get('/api/sales/dashboard?groupBy=vendor&period=ytd')
        .expect(200);

      expect(resolveCustomersForEntity).not.toHaveBeenCalled();
    });
  });

  describe('warm universal cache', () => {
    it('wins over narrow fetch — fetchOrders never called when readOrders returns data', async () => {
      vi.mocked(readOrders).mockResolvedValue({
        orders: [],
        meta: { lastFetchDate: '2026-04-17T00:00:00Z', orderCount: 0, filterHash: 'all' },
      });

      await request(makeApp())
        .get('/api/sales/dashboard?groupBy=customer&entityId=C7826&period=ytd')
        .expect(200);

      expect(fetchOrders).not.toHaveBeenCalled();
    });
  });
});
