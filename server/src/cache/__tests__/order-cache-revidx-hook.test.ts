// FILE: server/src/cache/__tests__/order-cache-revidx-hook.test.ts
// PURPOSE: Verify that writeOrders side-effects the reverse index ONLY when the caller is
//   writing the full universe (filterHash === 'all'). Narrowed writes must not write the
//   reverse index — it would be incomplete and would mislead per-item narrow resolvers.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../redis-client.js', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn(),
    mget: vi.fn(),
    pipeline: vi.fn(() => ({
      set: vi.fn(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock('../../services/reverse-index.js', () => ({
  buildReverseIndex: vi.fn(() => ({ vendor: { V1: ['C1'] }, brand: {}, product_type: {}, product: {} })),
  writeReverseIndex: vi.fn().mockResolvedValue(undefined),
}));

import { writeOrders } from '../order-cache.js';
import { buildReverseIndex, writeReverseIndex } from '../../services/reverse-index.js';
import type { RawOrder } from '../../services/priority-queries.js';

const makeOrder = (ordname: string, custname: string): RawOrder => ({
  ORDNAME: ordname, CURDATE: '2026-01-01T00:00:00Z', ORDSTATUSDES: 'Open',
  TOTPRICE: 0, CUSTNAME: custname, AGENTCODE: 'A', AGENTNAME: 'Alice',
  ORDERITEMS_SUBFORM: [],
});

describe('writeOrders → reverse-index hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('builds + writes reverse index when filterHash is "all"', async () => {
    const orders = [makeOrder('O1', 'C1'), makeOrder('O2', 'C2')];
    await writeOrders(orders, 'ytd', 'all', 3600);

    expect(buildReverseIndex).toHaveBeenCalledWith(orders);
    expect(writeReverseIndex).toHaveBeenCalledWith('ytd', expect.any(Object), 3600);
  });

  it('does NOT write reverse index when filterHash is a narrow hash', async () => {
    const orders = [makeOrder('O1', 'C1')];
    await writeOrders(orders, 'ytd', 'narrow:abc123', 3600);

    expect(buildReverseIndex).not.toHaveBeenCalled();
    expect(writeReverseIndex).not.toHaveBeenCalled();
  });

  it('does NOT write reverse index on empty-orders write (no real data to index)', async () => {
    await writeOrders([], 'ytd', 'all', 3600);
    // WHY: an empty reverse index would overwrite a valid one. Leave the existing index alone.
    expect(buildReverseIndex).not.toHaveBeenCalled();
    expect(writeReverseIndex).not.toHaveBeenCalled();
  });
});
