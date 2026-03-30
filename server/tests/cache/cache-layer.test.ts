// FILE: server/tests/cache/cache-layer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cachedFetch } from '../../src/cache/cache-layer';

// Mock redis
const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock('../../src/cache/redis-client', () => ({
  redis: { get: (...args: unknown[]) => mockGet(...args), set: (...args: unknown[]) => mockSet(...args) },
}));

describe('cachedFetch', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
  });

  it('returns cached data on hit', async () => {
    const cached = { data: [1, 2, 3], cachedAt: '2026-03-30T10:00:00Z' };
    mockGet.mockResolvedValueOnce(JSON.stringify(cached));

    const fetcher = vi.fn();
    const result = await cachedFetch('dashboard:orders_ytd:ytd', 900, fetcher);

    expect(result.data).toEqual([1, 2, 3]);
    expect(result.cached).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('calls fetcher and caches on miss', async () => {
    mockGet.mockResolvedValueOnce(null);
    mockSet.mockResolvedValueOnce('OK');

    const fetcher = vi.fn().mockResolvedValueOnce([4, 5, 6]);
    const result = await cachedFetch('dashboard:orders_ytd:ytd', 900, fetcher);

    expect(result.data).toEqual([4, 5, 6]);
    expect(result.cached).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledOnce();
  });
});
