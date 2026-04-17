// FILE: server/tests/cache/order-cache.test.ts
// PURPOSE: Verify per-order Redis caching with all-or-nothing write and full-or-miss read semantics
// USED BY: vitest runner

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeOrders, readOrders, deleteOrderIndex } from '../../src/cache/order-cache';
import type { RawOrder } from '../../src/services/priority-queries';

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();
const mockMget = vi.fn();
const mockPipelineSet = vi.fn().mockReturnThis();
const mockPipelineExec = vi.fn().mockResolvedValue([]);

vi.mock('../../src/cache/redis-client', () => ({
  redis: {
    get: (...args: unknown[]) => mockGet(...args),
    set: (...args: unknown[]) => mockSet(...args),
    del: (...args: unknown[]) => mockDel(...args),
    mget: (...args: unknown[]) => mockMget(...args),
    pipeline: () => ({ set: mockPipelineSet, exec: mockPipelineExec }),
  },
}));

function makeOrder(ordname: string): RawOrder {
  return {
    ORDNAME: ordname,
    CURDATE: '2026-01-15T00:00:00Z',
    ORDSTATUSDES: 'Closed',
    TOTPRICE: 100,
    CUSTNAME: 'C001',
    AGENTCODE: '010',
    AGENTNAME: 'Test Agent',
    ORDERITEMS_SUBFORM: [],
  };
}

describe('writeOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockResolvedValue('OK');
    mockPipelineSet.mockReturnThis();
    mockPipelineExec.mockResolvedValue([]);
  });

  it('writes orders in pipeline batches then publishes index + meta (WO-T1)', async () => {
    const orders = [makeOrder('SO001'), makeOrder('SO002')];
    const result = await writeOrders(orders, 'ytd', 'all', 3600);

    expect(result).toBe(true);
    // Pipeline should have SET for each order
    expect(mockPipelineSet).toHaveBeenCalledTimes(2);
    expect(mockPipelineSet).toHaveBeenCalledWith('order:SO001', expect.any(String), expect.objectContaining({ ex: expect.any(Number) }));
    expect(mockPipelineSet).toHaveBeenCalledWith('order:SO002', expect.any(String), expect.objectContaining({ ex: expect.any(Number) }));
    // Index + meta + reverse-index should be written via redis.set
    // (reverse-index write added by the per-item narrow-fetch feature: see
    //  learnings/odata-any-lambda-support.md and server/src/services/reverse-index.ts)
    expect(mockSet).toHaveBeenCalledTimes(3);
    const indexCall = mockSet.mock.calls.find((c: unknown[]) => (c[0] as string).startsWith('orders:idx:'));
    expect(indexCall).toBeTruthy();
    const metaCall = mockSet.mock.calls.find((c: unknown[]) => (c[0] as string).startsWith('orders:meta:'));
    expect(metaCall).toBeTruthy();
    const revidxCall = mockSet.mock.calls.find((c: unknown[]) => (c[0] as string) === 'dashboard:revidx:ytd');
    expect(revidxCall).toBeTruthy();
  });

  it('does NOT publish index/meta if a pipeline batch fails (WO-T2)', async () => {
    mockPipelineExec.mockRejectedValueOnce(new Error('Redis pipeline failed'));

    const orders = [makeOrder('SO001')];
    const result = await writeOrders(orders, 'ytd', 'all', 3600);

    expect(result).toBe(false);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('handles empty order array by writing empty index + meta (WO-T3)', async () => {
    const result = await writeOrders([], 'ytd', 'all', 3600);

    expect(result).toBe(true);
    expect(mockPipelineSet).not.toHaveBeenCalled(); // no pipeline for empty
    expect(mockSet).toHaveBeenCalledTimes(2); // index + meta
  });
});

describe('readOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns orders when index and all MGET keys exist (RO-T1)', async () => {
    const order1 = makeOrder('SO001');
    const order2 = makeOrder('SO002');
    mockGet.mockResolvedValueOnce(JSON.stringify(['SO001', 'SO002'])); // index
    mockMget.mockResolvedValueOnce([JSON.stringify(order1), JSON.stringify(order2)]);
    mockGet.mockResolvedValueOnce(JSON.stringify({ lastFetchDate: '2026-01-15T00:00:00Z', orderCount: 2, filterHash: 'all' })); // meta

    const result = await readOrders('ytd', 'all');

    expect(result).not.toBeNull();
    expect(result!.orders).toHaveLength(2);
    expect(result!.orders[0].ORDNAME).toBe('SO001');
    expect(result!.meta.orderCount).toBe(2);
  });

  it('returns null when index key is missing (RO-T2)', async () => {
    mockGet.mockResolvedValueOnce(null);

    const result = await readOrders('ytd', 'all');
    expect(result).toBeNull();
  });

  it('returns null (cache corruption) when MGET has null entries (RO-T3)', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['SO001', 'SO002']));
    mockMget.mockResolvedValueOnce([JSON.stringify(makeOrder('SO001')), null]);

    const result = await readOrders('ytd', 'all');
    expect(result).toBeNull();
  });

  it('returns empty orders for empty index (RO-T4)', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify([])); // empty index
    mockGet.mockResolvedValueOnce(JSON.stringify({ lastFetchDate: '2026-01-15T00:00:00Z', orderCount: 0, filterHash: 'all' })); // meta

    const result = await readOrders('ytd', 'all');
    expect(result).not.toBeNull();
    expect(result!.orders).toHaveLength(0);
  });
});

describe('deleteOrderIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDel.mockResolvedValue(1);
  });

  it('deletes index + meta keys (DO-T1)', async () => {
    await deleteOrderIndex('ytd', 'all');

    expect(mockDel).toHaveBeenCalledWith('orders:idx:ytd:all');
    expect(mockDel).toHaveBeenCalledWith('orders:meta:ytd:all');
  });
});
