// FILE: server/src/services/__tests__/warm-cache-revidx-hook.test.ts
// PURPOSE: Verify warmEntityCache builds + writes the reverse index on cold boot.
//   On hot-meta skip, the index is NOT rebuilt (cheap to reuse the existing Redis blob).

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---- Mocks (must come before the SUT import so Vitest hoists them) ----

vi.mock('../../cache/redis-client.js', () => ({
  redis: { get: vi.fn() },
}));

vi.mock('../../cache/cache-layer.js', () => ({
  cachedFetch: vi.fn(async (_k: string, _ttl: number, fn: () => Promise<unknown>) => {
    const data = await fn();
    return { data, cached: false, cachedAt: null };
  }),
}));

vi.mock('../priority-instance.js', () => ({
  priorityClient: {},
}));

vi.mock('../priority-queries.js', () => ({
  fetchOrders:       vi.fn().mockResolvedValue([]),
  fetchCustomers:    vi.fn().mockResolvedValue([]),
  fetchZones:        vi.fn().mockResolvedValue([]),
  fetchVendors:      vi.fn().mockResolvedValue([]),
  fetchProductTypes: vi.fn().mockResolvedValue([]),
  fetchProducts:     vi.fn().mockResolvedValue([]),
}));

vi.mock('../reverse-index.js', () => ({
  buildReverseIndex: vi.fn(() => ({ vendor: {}, brand: {}, product_type: {}, product: {} })),
  writeReverseIndex: vi.fn().mockResolvedValue(undefined),
}));

import { warmEntityCache } from '../warm-cache.js';
import { redis } from '../../cache/redis-client.js';
import { buildReverseIndex, writeReverseIndex } from '../reverse-index.js';
import { fetchOrders } from '../priority-queries.js';
import type { RawOrder } from '../priority-queries.js';

const makeOrder = (ordname: string): RawOrder => ({
  ORDNAME: ordname, CURDATE: '2026-01-01T00:00:00Z', ORDSTATUSDES: 'Open',
  TOTPRICE: 0, CUSTNAME: 'C1', AGENTCODE: 'A', AGENTNAME: 'Alice',
  ORDERITEMS_SUBFORM: [],
});

describe('warmEntityCache → reverse-index hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('builds + writes reverse index on cold boot (orders meta absent)', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    const orders = [makeOrder('SO1'), makeOrder('SO2')];
    vi.mocked(fetchOrders).mockResolvedValueOnce(orders);

    await warmEntityCache();

    expect(buildReverseIndex).toHaveBeenCalledWith(orders);
    expect(writeReverseIndex).toHaveBeenCalledTimes(1);
    const [period, , ttl] = vi.mocked(writeReverseIndex).mock.calls[0]!;
    expect(period).toBe('ytd');
    expect(typeof ttl).toBe('number');
  });

  it('does NOT rebuild reverse index when orders meta already exists (hot skip)', async () => {
    vi.mocked(redis.get).mockResolvedValue('{"lastFetchDate":"2026-04-17T00:00:00Z","orderCount":100,"filterHash":"all"}');

    await warmEntityCache();

    expect(buildReverseIndex).not.toHaveBeenCalled();
    expect(writeReverseIndex).not.toHaveBeenCalled();
  });
});
