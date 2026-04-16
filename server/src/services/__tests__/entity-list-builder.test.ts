// FILE: server/src/services/__tests__/entity-list-builder.test.ts
// PURPOSE: Tests for buildEntityList — cold/warm cache paths for customer and item-based dims.
// USED BY: vitest test suite
// EXPORTS: (test file)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the cache and priority layer before importing the module under test
vi.mock('../../cache/order-cache.js', () => ({
  readOrders: vi.fn(),
}));
vi.mock('../../cache/cache-layer.js', () => ({
  cachedFetch: vi.fn(),
}));
vi.mock('../priority-instance.js', () => ({
  priorityClient: {} as unknown,
}));
vi.mock('../priority-queries.js', () => ({
  fetchCustomers: vi.fn(),
  fetchZones: vi.fn(),
}));

import { buildEntityList } from '../entity-list-builder.js';
import { readOrders } from '../../cache/order-cache.js';
import { cachedFetch } from '../../cache/cache-layer.js';

const mkCustomer = (code: string, name: string) => ({
  CUSTNAME: code, CUSTDES: name, ZONECODE: 'Z1', ZONEDES: 'Zone 1',
  AGENTCODE: 'A1', AGENTNAME: 'Agent 1', CREATEDDATE: '', CTYPECODE: 'T', CTYPENAME: 'Retail',
});

const mkOrder = (custname: string) => ({
  ORDNAME: `O-${custname}`,
  CURDATE: '2026-01-15T00:00:00Z',
  ORDSTATUSDES: 'Open',
  TOTPRICE: 100,
  CUSTNAME: custname,
  AGENTCODE: 'A1',
  AGENTNAME: 'Agent 1',
  ORDERITEMS_SUBFORM: [],
});

describe('buildEntityList — customer dim', () => {
  beforeEach(() => {
    vi.mocked(readOrders).mockReset();
    vi.mocked(cachedFetch).mockReset();
  });

  it('cold cache: returns all master customers as stubs with null metrics, enriched=false', async () => {
    vi.mocked(readOrders).mockResolvedValue(null);
    vi.mocked(cachedFetch).mockResolvedValue({
      data: [mkCustomer('C1', 'Disney Parks'), mkCustomer('C2', 'Disney Cruise')],
      cached: false,
      cachedAt: null,
    });

    const result = await buildEntityList('customer', 'ytd');
    expect(result.enriched).toBe(false);
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].id).toBe('C1');
    expect(result.entities[0].revenue).toBeNull();
    expect(result.entities[0].orderCount).toBeNull();
    expect(result.yearsAvailable).toEqual([]);
  });

  it('warm cache: merges master customers with orders-derived metrics, enriched=true', async () => {
    const customers = [mkCustomer('C1', 'Disney Parks'), mkCustomer('C2', 'Disney Cruise')];
    vi.mocked(readOrders).mockResolvedValue({
      orders: [mkOrder('C1'), mkOrder('C1')],  // C1 has orders, C2 does not
      meta: { lastFetchDate: '2026-04-16T00:00:00Z', orderCount: 2, filterHash: 'all' },
    });
    vi.mocked(cachedFetch).mockResolvedValue({ data: customers, cached: true, cachedAt: '2026-04-16T00:00:00Z' });

    const result = await buildEntityList('customer', 'ytd');
    expect(result.enriched).toBe(true);
    expect(result.entities).toHaveLength(2);

    // C1 should have enriched metrics
    const c1 = result.entities.find(e => e.id === 'C1');
    expect(c1?.revenue).toBe(200);  // 2 orders × $100
    expect(c1?.orderCount).toBe(2);

    // C2 should be a stub (no orders)
    const c2 = result.entities.find(e => e.id === 'C2');
    expect(c2?.revenue).toBeNull();
    expect(c2?.orderCount).toBeNull();
  });

  it('yearsAvailable derived from order dates', async () => {
    vi.mocked(readOrders).mockResolvedValue({
      orders: [
        { ...mkOrder('C1'), CURDATE: '2026-01-15T00:00:00Z' },
        { ...mkOrder('C1'), CURDATE: '2025-06-15T00:00:00Z' },
      ],
      meta: { lastFetchDate: '', orderCount: 2, filterHash: 'all' },
    });
    vi.mocked(cachedFetch).mockResolvedValue({ data: [mkCustomer('C1', 'C1')], cached: true, cachedAt: null });

    const result = await buildEntityList('customer', 'ytd');
    expect(result.yearsAvailable).toEqual(['2026', '2025']);
  });
});

describe('buildEntityList — vendor dim (item-based)', () => {
  beforeEach(() => {
    vi.mocked(readOrders).mockReset();
    vi.mocked(cachedFetch).mockReset();
  });

  it('cold cache: returns empty list, enriched=false (item-dims need orders to derive entities)', async () => {
    vi.mocked(readOrders).mockResolvedValue(null);
    const result = await buildEntityList('vendor', 'ytd');
    expect(result.enriched).toBe(false);
    expect(result.entities).toEqual([]);
  });
});
