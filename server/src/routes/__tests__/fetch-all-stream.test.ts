// FILE: server/src/routes/__tests__/fetch-all-stream.test.ts
// PURPOSE: Tests for fetchYearWithCache, fullFetch, tryIncrementalRefresh — unified per-year
//   fetch helper covering both current-year and prev-year branches.
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect, vi, beforeEach } from 'vitest';

// WHY: Mock priority-instance + priority-queries + order-cache at the module boundary so we can
// observe calls into fetchOrders/readOrders without hitting Priority or Redis.
vi.mock('../../services/priority-instance.js', () => ({
  priorityClient: {},
}));

vi.mock('../../services/priority-queries.js', () => ({
  fetchOrders: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../cache/order-cache.js', () => ({
  readOrders: vi.fn().mockResolvedValue(null),
}));

// Import AFTER mocks
import { fetchYearWithCache } from '../fetch-all-stream.js';
import { fetchOrders } from '../../services/priority-queries.js';
import { readOrders } from '../../cache/order-cache.js';
import type { RawOrder } from '../../services/priority-queries.js';

describe('fetchYearWithCache — shared helper for current + prev year fetches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readOrders).mockResolvedValue(null);
  });

  it('T1: tags every progress event with `scope: current` on cold cache', async () => {
    // WHY: cold cache (readOrders returns null) → falls through to fullFetch → fetchOrders
    // invokes onProgress. We assert sendEvent was called at least once with scope='current'.
    vi.mocked(fetchOrders).mockImplementation(
      async (_client, _start, _end, _isCurrent, _filter, onProgress) => {
        onProgress?.(100, 1000);
        return [];
      },
    );

    const sendEvent = vi.fn();
    await fetchYearWithCache({
      period: 'ytd',
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2027-01-01T00:00:00Z',
      forceRefresh: false,
      sendEvent,
      scope: 'current',
    });

    // Collect all progress events
    const progressEvents = sendEvent.mock.calls.filter(c => c[0] === 'progress');
    expect(progressEvents.length).toBeGreaterThan(0);
    // Every progress event must carry scope: 'current'
    for (const call of progressEvents) {
      expect(call[1]).toMatchObject({ scope: 'current' });
    }
    // At least one has the rowsFetched=100 from onProgress
    const hasOnProgress = progressEvents.some(
      c => (c[1] as { rowsFetched?: number }).rowsFetched === 100,
    );
    expect(hasOnProgress).toBe(true);
  });

  it('T1: tags every progress event with `scope: prev` on cold cache', async () => {
    vi.mocked(fetchOrders).mockImplementation(
      async (_c, _s, _e, _i, _f, onProgress) => {
        onProgress?.(200, 5000);
        return [];
      },
    );

    const sendEvent = vi.fn();
    await fetchYearWithCache({
      period: '2025',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2026-01-01T00:00:00Z',
      forceRefresh: false,
      sendEvent,
      scope: 'prev',
    });

    const progressEvents = sendEvent.mock.calls.filter(c => c[0] === 'progress');
    expect(progressEvents.length).toBeGreaterThan(0);
    for (const call of progressEvents) {
      expect(call[1]).toMatchObject({ scope: 'prev' });
    }
  });

  it('T1: forceRefresh=true skips readOrders and goes straight to fullFetch', async () => {
    vi.mocked(fetchOrders).mockResolvedValue([]);

    const sendEvent = vi.fn();
    await fetchYearWithCache({
      period: 'ytd',
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2027-01-01T00:00:00Z',
      forceRefresh: true,
      sendEvent,
      scope: 'current',
    });

    expect(readOrders).not.toHaveBeenCalled();
    expect(fetchOrders).toHaveBeenCalledTimes(1);
  });

  it('T1: narrowFilter=CUSTNAME eq X skips readOrders and passes filter through', async () => {
    vi.mocked(fetchOrders).mockResolvedValue([]);

    const sendEvent = vi.fn();
    await fetchYearWithCache({
      period: 'ytd',
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2027-01-01T00:00:00Z',
      forceRefresh: false,
      narrowFilter: "CUSTNAME eq 'C7826'",
      sendEvent,
      scope: 'current',
    });

    expect(readOrders).not.toHaveBeenCalled();
    expect(fetchOrders).toHaveBeenCalledTimes(1);
    // narrowFilter is the 5th arg (index 4) of fetchOrders
    const args = vi.mocked(fetchOrders).mock.calls[0];
    expect(args[4]).toBe("CUSTNAME eq 'C7826'");
  });

  it('T1: fullFetch path always uses isCurrentPeriod=true (full items for both years)', async () => {
    vi.mocked(fetchOrders).mockResolvedValue([]);

    const sendEvent = vi.fn();
    // Prev-year cold fetch — should STILL pass isCurrentPeriod=true so full ORDERITEM_SELECT applies
    await fetchYearWithCache({
      period: '2025',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2026-01-01T00:00:00Z',
      forceRefresh: true,
      sendEvent,
      scope: 'prev',
    });

    const args = vi.mocked(fetchOrders).mock.calls[0];
    // isCurrentPeriod is the 4th arg (index 3)
    expect(args[3]).toBe(true);
  });

  it('T7: warm prev-year cache with stale lastFetchDate triggers delta merge', async () => {
    // WHY: Prev-year gains the delta-merge path for free by routing through
    // tryIncrementalRefresh. A 3-day-old cache must emit a delta fetch whose range starts
    // at lastFetchDate-1d and ends at the prev-year endDate.
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const cachedOrder: RawOrder = {
      ORDNAME: 'PREV_OLD',
      CURDATE: '2025-06-15T00:00:00Z',
      ORDSTATUSDES: 'Closed',
      TOTPRICE: 200,
      CUSTNAME: 'C001',
      AGENTCODE: 'A',
      AGENTNAME: 'Agent',
      ORDERITEMS_SUBFORM: [],
    };
    const lateOrder: RawOrder = {
      ORDNAME: 'PREV_LATE',
      CURDATE: '2025-12-31T00:00:00Z',
      ORDSTATUSDES: 'Closed',
      TOTPRICE: 75,
      CUSTNAME: 'C002',
      AGENTCODE: 'A',
      AGENTNAME: 'Agent',
      ORDERITEMS_SUBFORM: [],
    };

    vi.mocked(readOrders).mockResolvedValueOnce({
      orders: [cachedOrder],
      meta: {
        lastFetchDate: threeDaysAgo.toISOString(),
        orderCount: 1,
        filterHash: 'all',
      },
    });
    vi.mocked(fetchOrders).mockResolvedValue([lateOrder]);

    const sendEvent = vi.fn();
    const result = await fetchYearWithCache({
      period: '2025',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2026-01-01T00:00:00Z',
      forceRefresh: false,
      sendEvent,
      scope: 'prev',
    });

    // Delta fetch ran
    expect(fetchOrders).toHaveBeenCalledTimes(1);
    const deltaArgs = vi.mocked(fetchOrders).mock.calls[0];
    const deltaStart = new Date(deltaArgs[1] as string);
    // sinceDate should be ~2 days ago (threeDaysAgo - 1 day)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    // Within a 24h window of 2 days ago
    expect(deltaStart.getTime()).toBeLessThanOrEqual(twoDaysAgo.getTime() + 24 * 60 * 60 * 1000);
    // endDate is the prev-year endDate
    expect(deltaArgs[2]).toBe('2026-01-01T00:00:00Z');

    // Merged: cached + delta
    expect(result.didFetch).toBe(true);
    expect(result.orders.map(o => o.ORDNAME).sort()).toEqual(['PREV_LATE', 'PREV_OLD']);
  });

  it('T7: same-day warm cache returns cached orders without fetching', async () => {
    const nowIso = new Date().toISOString();
    vi.mocked(readOrders).mockResolvedValueOnce({
      orders: [
        {
          ORDNAME: 'CACHED',
          CURDATE: '2026-03-01T00:00:00Z',
          ORDSTATUSDES: 'Closed',
          TOTPRICE: 50,
          CUSTNAME: 'C1',
          AGENTCODE: 'A',
          AGENTNAME: 'Agent',
          ORDERITEMS_SUBFORM: [],
        },
      ],
      meta: { lastFetchDate: nowIso, orderCount: 1, filterHash: 'all' },
    });

    const sendEvent = vi.fn();
    const result = await fetchYearWithCache({
      period: 'ytd',
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2027-01-01T00:00:00Z',
      forceRefresh: false,
      sendEvent,
      scope: 'current',
    });

    expect(fetchOrders).not.toHaveBeenCalled();
    expect(result.didFetch).toBe(false);
    expect(result.orders.map(o => o.ORDNAME)).toEqual(['CACHED']);
  });
});
