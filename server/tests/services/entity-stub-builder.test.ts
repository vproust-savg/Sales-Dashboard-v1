// FILE: server/tests/services/entity-stub-builder.test.ts
// PURPOSE: Tests for deriving entity list stubs from warm-cache orders
// USED BY: CI — validates cold-cache fallback logic
// EXPORTS: none (test file)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RawOrder, RawOrderItem, RawCustomer } from '../../src/services/priority-queries';

// Mock Redis
const mockGet = vi.fn();
vi.mock('../../src/cache/redis-client', () => ({
  redis: { get: (...args: unknown[]) => mockGet(...args) },
}));

// Mock cachedFetch to return customers directly
const mockCachedFetch = vi.fn();
vi.mock('../../src/cache/cache-layer', () => ({
  cachedFetch: (...args: unknown[]) => mockCachedFetch(...args),
}));

// Mock priority-instance (required by import chain)
vi.mock('../../src/services/priority-instance', () => ({
  priorityClient: {},
}));

import { deriveEntityStubs } from '../../src/services/entity-stub-builder';

function makeItem(overrides: Partial<RawOrderItem> = {}): RawOrderItem {
  return {
    PDES: 'Widget A', PARTNAME: 'WGT-A', TQUANT: 100, TUNITNAME: 'ea',
    QPRICE: 5000, PRICE: 50, PURCHASEPRICE: 30, QPROFIT: 2000, PERCENT: 40,
    Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One', Y_9952_5_ESH: 'BrandX',
    Y_3020_5_ESH: 'FAM1', Y_3021_5_ESH: 'Packaging', Y_17936_5_ESH: 'VP-001',
    Y_2075_5_ESH: 'Family A', Y_5380_5_ESH: 'USA', Y_9967_5_ESH: 'N',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    ORDNAME: 'ORD-001', CURDATE: '2026-02-15T00:00:00Z', ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000, CUSTNAME: 'C001', AGENTCODE: 'A01', AGENTNAME: 'Sarah M.',
    ORDERITEMS_SUBFORM: [makeItem()],
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<RawCustomer> = {}): RawCustomer {
  return {
    CUSTNAME: 'C001', CUSTDES: 'Acme Corp', ZONECODE: 'Z1', ZONEDES: 'North',
    AGENTCODE: 'A01', AGENTNAME: 'Sarah M.', CREATEDDATE: '2021-01-15T00:00:00Z',
    CTYPECODE: 'RT', CTYPENAME: 'Retail',
    ...overrides,
  };
}

describe('deriveEntityStubs', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockCachedFetch.mockReset();
  });

  it('returns null when orders_ytd cache is empty', async () => {
    mockGet.mockResolvedValue(null);
    const result = await deriveEntityStubs('zone', 'ytd');
    expect(result).toBeNull();
  });

  it('derives zone entities from cached orders', async () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C001', TOTPRICE: 10000 }),
      makeOrder({ ORDNAME: 'O2', CUSTNAME: 'C002', TOTPRICE: 5000 }),
    ];
    const customers = [
      makeCustomer({ CUSTNAME: 'C001', ZONECODE: 'Z1', ZONEDES: 'North' }),
      makeCustomer({ CUSTNAME: 'C002', ZONECODE: 'Z2', ZONEDES: 'South' }),
    ];
    mockGet.mockResolvedValue(JSON.stringify({ data: orders, cachedAt: new Date().toISOString() }));
    mockCachedFetch.mockResolvedValue({ data: customers, cached: true, cachedAt: null });

    const result = await deriveEntityStubs('zone', 'ytd');
    expect(result).not.toBeNull();
    expect(result!.entities).toHaveLength(2);
    expect(result!.entities.find(e => e.id === 'Z1')).toBeDefined();
    expect(result!.entities.find(e => e.id === 'Z2')).toBeDefined();
  });

  it('derives vendor entities from cached orders', async () => {
    const orders = [
      makeOrder({
        ORDNAME: 'O1',
        ORDERITEMS_SUBFORM: [
          makeItem({ Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One', QPRICE: 5000 }),
          makeItem({ Y_1159_5_ESH: 'V02', Y_1530_5_ESH: 'Vendor Two', QPRICE: 3000 }),
        ],
      }),
    ];
    const customers = [makeCustomer()];
    mockGet.mockResolvedValue(JSON.stringify({ data: orders, cachedAt: new Date().toISOString() }));
    mockCachedFetch.mockResolvedValue({ data: customers, cached: true, cachedAt: null });

    const result = await deriveEntityStubs('vendor', 'ytd');
    expect(result).not.toBeNull();
    expect(result!.entities).toHaveLength(2);
    expect(result!.entities.find(e => e.id === 'V01')?.name).toBe('Vendor One');
  });

  it('returns yearsAvailable from order dates', async () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', CURDATE: '2026-03-01T00:00:00Z' }),
      makeOrder({ ORDNAME: 'O2', CURDATE: '2025-11-01T00:00:00Z' }),
    ];
    const customers = [makeCustomer()];
    mockGet.mockResolvedValue(JSON.stringify({ data: orders, cachedAt: new Date().toISOString() }));
    mockCachedFetch.mockResolvedValue({ data: customers, cached: true, cachedAt: null });

    const result = await deriveEntityStubs('zone', 'ytd');
    expect(result!.yearsAvailable).toContain('2026');
    expect(result!.yearsAvailable).toContain('2025');
    expect(result!.yearsAvailable[0]).toBe('2026');
  });
});
