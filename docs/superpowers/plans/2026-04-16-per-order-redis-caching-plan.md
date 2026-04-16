# Per-Order Redis Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace bulk Redis caching (single 20+ MB keys that exceed Upstash's 10 MB limit) with per-order keys (~2 KB each) + index keys, using all-or-nothing write semantics and full-or-miss read semantics.

**Architecture:** Each `RawOrder` is stored as `order:{ORDNAME}` → JSON. An index key `orders:idx:{period}:{filterHash}` lists which order IDs belong to a given fetch scope. Writes pipeline 500 orders per batch; index/meta are only published after all batches succeed. Reads validate completeness — any missing order triggers a cache miss.

**Tech Stack:** TypeScript, Upstash Redis (`@upstash/redis`), Express, Vitest

**Spec:** `docs/superpowers/specs/2026-04-16-per-order-redis-caching-design.md`

---

## Pre-flight: Current State

There are uncommitted changes from an interim chunking approach (`safeRedisWrite`/`safeRedisRead`/`safeRedisDelete` in cache-layer.ts, plus corresponding fetch-all.ts and test changes). These must be **reverted** before starting — the per-order approach replaces them entirely.

---

### Task 0: Revert Interim Chunking Changes

**Files:**
- Revert: `server/src/cache/cache-layer.ts`
- Revert: `server/src/routes/fetch-all.ts`
- Revert: `server/src/routes/__tests__/fetch-all.test.ts`
- Revert: `server/tests/cache/cache-layer.test.ts`

- [ ] **Step 1: Revert all uncommitted changes**

```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1"
git checkout -- server/src/cache/cache-layer.ts server/src/routes/fetch-all.ts server/src/routes/__tests__/fetch-all.test.ts server/tests/cache/cache-layer.test.ts
```

- [ ] **Step 2: Verify tests still pass after revert**

```bash
cd server && npx vitest run
```

Expected: 162 passed, 5 skipped. The SSE streaming changes (commit `c41e997`) and spec commits remain — only the chunking layer is reverted.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
cd ../client && npx tsc -b --noEmit
```

Expected: No errors.

---

### Task 1: Add Order Key Helpers + Pipeline Batch Constant

**Files:**
- Modify: `server/src/cache/cache-keys.ts`
- Modify: `server/src/config/constants.ts`

- [ ] **Step 1: Add order key builder functions to cache-keys.ts**

Add these three functions after the existing `buildFilterHash` function:

```typescript
/** Per-order Redis key. WHY: Orders are shared across periods/filters — top-level namespace. */
export function orderKey(ordname: string): string {
  return `order:${ordname}`;
}

/** Index key listing all ORDNAME IDs for a period/filter scope. */
export function orderIndexKey(period: string, filterHash: string): string {
  return `orders:idx:${period}:${filterHash}`;
}

/** Meta key with lastFetchDate and orderCount for a period/filter scope. */
export function orderMetaKey(period: string, filterHash: string): string {
  return `orders:meta:${period}:${filterHash}`;
}
```

Also update the USED BY comment at the top to include `server/src/cache/order-cache.ts`.

- [ ] **Step 2: Add ORDER_PIPELINE_BATCH constant to constants.ts**

Add after the `MAXAPILINES` line:

```typescript
/** Orders per Redis pipeline batch — 500 × ~2 KB = ~1 MB per pipeline, well under 10 MB limit */
export const ORDER_PIPELINE_BATCH = 500;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/cache/cache-keys.ts server/src/config/constants.ts
git commit -m "feat(cache): add per-order key helpers and pipeline batch constant"
```

---

### Task 2: Create order-cache.ts — Write Path

**Files:**
- Create: `server/src/cache/order-cache.ts`
- Create: `server/tests/cache/order-cache.test.ts`

- [ ] **Step 1: Write failing tests for writeOrders**

Create `server/tests/cache/order-cache.test.ts`:

```typescript
// FILE: server/tests/cache/order-cache.test.ts
// PURPOSE: Verify per-order Redis caching with all-or-nothing write semantics
// USED BY: vitest runner

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeOrders, readOrders, deleteOrderIndex } from '../../src/cache/order-cache';
import type { RawOrder } from '../../src/services/priority-queries';

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();
const mockMget = vi.fn();
const mockPipeline = vi.fn();

vi.mock('../../src/cache/redis-client', () => ({
  redis: {
    get: (...args: unknown[]) => mockGet(...args),
    set: (...args: unknown[]) => mockSet(...args),
    del: (...args: unknown[]) => mockDel(...args),
    mget: (...args: unknown[]) => mockMget(...args),
    pipeline: () => mockPipeline(),
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
  });

  it('writes orders in pipeline batches then publishes index + meta (WO-T1)', async () => {
    const execMock = vi.fn().mockResolvedValue([]);
    const pipelineSetMock = vi.fn().mockReturnThis();
    mockPipeline.mockReturnValue({ set: pipelineSetMock, exec: execMock });
    mockSet.mockResolvedValue('OK');

    const orders = [makeOrder('SO001'), makeOrder('SO002')];
    await writeOrders(orders, 'ytd', 'all', 3600);

    // Pipeline should have been called with SET for each order
    expect(pipelineSetMock).toHaveBeenCalledTimes(2);
    expect(pipelineSetMock).toHaveBeenCalledWith('order:SO001', expect.any(String), expect.objectContaining({ ex: expect.any(Number) }));
    // Index + meta should be written via redis.set (not pipeline)
    expect(mockSet).toHaveBeenCalledTimes(2); // index + meta
    const indexCall = mockSet.mock.calls.find((c: unknown[]) => (c[0] as string).startsWith('orders:idx:'));
    expect(indexCall).toBeTruthy();
    const metaCall = mockSet.mock.calls.find((c: unknown[]) => (c[0] as string).startsWith('orders:meta:'));
    expect(metaCall).toBeTruthy();
  });

  it('does NOT publish index/meta if a pipeline batch fails (WO-T2)', async () => {
    const execMock = vi.fn().mockRejectedValue(new Error('Redis pipeline failed'));
    const pipelineSetMock = vi.fn().mockReturnThis();
    mockPipeline.mockReturnValue({ set: pipelineSetMock, exec: execMock });

    const orders = [makeOrder('SO001')];
    await writeOrders(orders, 'ytd', 'all', 3600);

    // Index + meta should NOT be written
    expect(mockSet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/cache/order-cache.test.ts
```

Expected: FAIL — `writeOrders` not found.

- [ ] **Step 3: Implement writeOrders**

Create `server/src/cache/order-cache.ts`:

```typescript
// FILE: server/src/cache/order-cache.ts
// PURPOSE: Per-order Redis caching — write/read/delete with all-or-nothing semantics.
//   Replaces bulk array caching that exceeds Upstash's 10 MB limit.
// USED BY: server/src/routes/fetch-all.ts
// EXPORTS: writeOrders, readOrders, deleteOrderIndex

import { redis } from './redis-client.js';
import { orderKey, orderIndexKey, orderMetaKey } from './cache-keys.js';
import { ORDER_PIPELINE_BATCH } from '../config/constants.js';
import { CACHE_TTLS } from '../config/constants.js';
import type { RawOrder } from '../services/priority-queries.js';

/** WHY: 365 days — same as orders_raw TTL. Individual order keys are shared across periods. */
const ORDER_KEY_TTL = CACHE_TTLS.orders_raw;

/** Write orders to Redis as individual keys + publish index/meta.
 *  All-or-nothing: if ANY pipeline batch fails, index/meta are NOT published.
 *  WHY: Partial index would produce permanently wrong KPIs (Codex finding #1). */
export async function writeOrders(
  orders: RawOrder[],
  period: string,
  filterHash: string,
  indexTtl: number,
): Promise<boolean> {
  if (orders.length === 0) {
    // WHY: Empty order set is valid (e.g., new agent with no sales). Still write index/meta.
    await redis.set(orderIndexKey(period, filterHash), JSON.stringify([]), { ex: indexTtl });
    await redis.set(orderMetaKey(period, filterHash), JSON.stringify({
      lastFetchDate: new Date().toISOString(),
      orderCount: 0,
      filterHash,
    }), { ex: indexTtl });
    return true;
  }

  // Phase 1: Write individual orders in pipeline batches
  let allBatchesSucceeded = true;
  for (let i = 0; i < orders.length; i += ORDER_PIPELINE_BATCH) {
    const batch = orders.slice(i, i + ORDER_PIPELINE_BATCH);
    try {
      const pipeline = redis.pipeline();
      for (const order of batch) {
        pipeline.set(orderKey(order.ORDNAME), JSON.stringify(order), { ex: ORDER_KEY_TTL });
      }
      await pipeline.exec();
    } catch (err) {
      console.error(`[order-cache] Pipeline batch ${i}-${i + batch.length} failed:`, err instanceof Error ? err.message : err);
      allBatchesSucceeded = false;
      break;
    }
  }

  // Phase 2: Only publish index + meta if ALL batches succeeded
  if (!allBatchesSucceeded) {
    console.warn(`[order-cache] Skipping index/meta publish — partial write for ${period}:${filterHash}`);
    return false;
  }

  const ordnames = orders.map(o => o.ORDNAME);
  await redis.set(orderIndexKey(period, filterHash), JSON.stringify(ordnames), { ex: indexTtl });
  await redis.set(orderMetaKey(period, filterHash), JSON.stringify({
    lastFetchDate: new Date().toISOString(),
    orderCount: orders.length,
    filterHash,
  }), { ex: indexTtl });

  console.log(`[order-cache] Wrote ${orders.length} orders in ${Math.ceil(orders.length / ORDER_PIPELINE_BATCH)} batches for ${period}:${filterHash}`);
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/cache/order-cache.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add server/src/cache/order-cache.ts server/tests/cache/order-cache.test.ts
git commit -m "feat(cache): add writeOrders with all-or-nothing pipeline semantics"
```

---

### Task 3: Add readOrders + deleteOrderIndex

**Files:**
- Modify: `server/src/cache/order-cache.ts`
- Modify: `server/tests/cache/order-cache.test.ts`

- [ ] **Step 1: Write failing tests for readOrders and deleteOrderIndex**

Append to `server/tests/cache/order-cache.test.ts`:

```typescript
describe('readOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns orders when index and all MGET keys exist (RO-T1)', async () => {
    const order1 = makeOrder('SO001');
    const order2 = makeOrder('SO002');
    mockGet.mockResolvedValueOnce(JSON.stringify(['SO001', 'SO002'])); // index
    mockMget.mockResolvedValueOnce([JSON.stringify(order1), JSON.stringify(order2)]);

    const result = await readOrders('ytd', 'all');

    expect(result).not.toBeNull();
    expect(result!.orders).toHaveLength(2);
    expect(result!.orders[0].ORDNAME).toBe('SO001');
  });

  it('returns null when index key is missing (RO-T2)', async () => {
    mockGet.mockResolvedValueOnce(null); // index miss

    const result = await readOrders('ytd', 'all');
    expect(result).toBeNull();
  });

  it('returns null (cache corruption) when MGET has null entries (RO-T3)', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['SO001', 'SO002'])); // index
    mockMget.mockResolvedValueOnce([JSON.stringify(makeOrder('SO001')), null]); // SO002 missing

    const result = await readOrders('ytd', 'all');
    expect(result).toBeNull();
  });
});

describe('deleteOrderIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes index + meta keys (DO-T1)', async () => {
    mockDel.mockResolvedValue(1);

    await deleteOrderIndex('ytd', 'all');

    expect(mockDel).toHaveBeenCalledWith('orders:idx:ytd:all');
    expect(mockDel).toHaveBeenCalledWith('orders:meta:ytd:all');
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
cd server && npx vitest run tests/cache/order-cache.test.ts
```

Expected: WO-T1 and WO-T2 pass, RO-T1/T2/T3 and DO-T1 fail.

- [ ] **Step 3: Implement readOrders and deleteOrderIndex**

Add to `server/src/cache/order-cache.ts` after `writeOrders`:

```typescript
/** Read result from readOrders — null means cache miss (index missing or corruption). */
export interface CachedOrders {
  orders: RawOrder[];
  meta: { lastFetchDate: string; orderCount: number; filterHash: string };
}

/** Read orders from per-order Redis keys via the index.
 *  Full-or-miss: if ANY indexed order key is missing, returns null (cache corruption).
 *  WHY: Partial data produces silently wrong KPIs (Codex finding #1). */
export async function readOrders(period: string, filterHash: string): Promise<CachedOrders | null> {
  // Read index
  const indexRaw = await redis.get(orderIndexKey(period, filterHash));
  if (indexRaw === null) return null;

  const ordnames: string[] = typeof indexRaw === 'string' ? JSON.parse(indexRaw) : indexRaw as string[];
  if (ordnames.length === 0) {
    // WHY: Empty index is valid (agent with no sales). Read meta for completeness.
    const metaRaw = await redis.get(orderMetaKey(period, filterHash));
    const meta = metaRaw
      ? (typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw) as CachedOrders['meta']
      : { lastFetchDate: new Date().toISOString(), orderCount: 0, filterHash };
    return { orders: [], meta };
  }

  // Read orders in MGET batches
  const allOrders: RawOrder[] = [];
  for (let i = 0; i < ordnames.length; i += ORDER_PIPELINE_BATCH) {
    const batchIds = ordnames.slice(i, i + ORDER_PIPELINE_BATCH);
    const keys = batchIds.map(id => orderKey(id));
    const results = await redis.mget<(string | null)[]>(...keys);

    // Validate completeness — any null = corruption
    const nullCount = results.filter(r => r === null).length;
    if (nullCount > 0) {
      console.warn(`[order-cache] ${nullCount}/${batchIds.length} orders missing in batch ${i}-${i + batchIds.length} for ${period}:${filterHash} — treating as cache miss`);
      return null;
    }

    for (const raw of results) {
      allOrders.push(typeof raw === 'string' ? JSON.parse(raw) as RawOrder : raw as unknown as RawOrder);
    }
  }

  // Read meta
  const metaRaw = await redis.get(orderMetaKey(period, filterHash));
  const meta = metaRaw
    ? (typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw) as CachedOrders['meta']
    : { lastFetchDate: new Date().toISOString(), orderCount: allOrders.length, filterHash };

  return { orders: allOrders, meta };
}

/** Delete index + meta for a period/filter scope. Individual order keys are NOT deleted
 *  (they're shared across scopes and expire via TTL). */
export async function deleteOrderIndex(period: string, filterHash: string): Promise<void> {
  await Promise.all([
    redis.del(orderIndexKey(period, filterHash)),
    redis.del(orderMetaKey(period, filterHash)),
  ]);
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
cd server && npx vitest run tests/cache/order-cache.test.ts
```

Expected: 5 passed (WO-T1, WO-T2, RO-T1, RO-T2, RO-T3, DO-T1 — 6 total).

- [ ] **Step 5: Run full server tests**

```bash
cd server && npx vitest run
```

Expected: All pass (the new file doesn't affect existing tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/cache/order-cache.ts server/tests/cache/order-cache.test.ts
git commit -m "feat(cache): add readOrders (full-or-miss) and deleteOrderIndex"
```

---

### Task 4: Wire fetch-all.ts to Use order-cache

This is the largest task — replaces all raw-cache interactions in `fetch-all.ts`.

**Files:**
- Modify: `server/src/routes/fetch-all.ts`

- [ ] **Step 1: Update imports**

Replace the cache-layer import line:

```typescript
// OLD
import { cachedFetch, safeRedisWrite, safeRedisRead, safeRedisDelete } from '../cache/cache-layer.js';

// NEW
import { cachedFetch } from '../cache/cache-layer.js';
import { writeOrders, readOrders, deleteOrderIndex } from '../cache/order-cache.js';
```

- [ ] **Step 2: Update force-refresh delete block**

Replace the `if (forceRefresh)` block (lines ~66-77):

```typescript
    if (forceRefresh) {
      // WHY: Force refresh clears index + meta for both current and prev-year scopes.
      // Individual order keys are NOT deleted — they're shared across scopes and expire via TTL.
      await Promise.all([
        deleteOrderIndex(period, filterHash),
        deleteOrderIndex(String(year - 1), filterHash),
      ]);
    }
```

This replaces `safeRedisDelete(rawKey)`, `redis.del(metaKey)`, and `safeRedisDelete(cacheKey('orders_year', ...))`.

- [ ] **Step 3: Update raw-cache write block**

Replace the `if (ordersWrapped.didFetch)` block (lines ~117-130):

```typescript
    if (ordersWrapped.didFetch) {
      // WHY: Per-order keys with all-or-nothing semantics. If any pipeline batch fails,
      // index/meta won't be published — the next request retries the full write.
      await writeOrders(orders, period, filterHash, getTTL('orders_raw'));
    }
```

This replaces the `safeRedisWrite(rawKey, ...)` + `redis.set(metaKey, ...)` block.

- [ ] **Step 4: Strip orders from report_payload and entity_detail consolidated cache**

In the aggregated cache writes block (lines ~170-183), change `report_payload` and `entity_detail` writes to strip orders:

```typescript
    if (!entityIdList || entityIdList.length === 0) {
      const fullKey = cacheKey('entities_full', period, buildFilterQualifier(groupBy, filterHash));
      const fullEnvelope = { data: { entities, yearsAvailable: payload.yearsAvailable }, cachedAt: new Date().toISOString() };
      await redis.set(fullKey, JSON.stringify(fullEnvelope), { ex: getTTL('entities_full') });

      // WHY: Strip orders from report_payload — with 10K+ orders, the payload exceeds Upstash's
      // 10 MB limit. Orders are reconstructed from per-order keys when this cache is read.
      // entity_detail with ALL scope also strips orders for the same reason.
      const payloadKey = cacheKey('report_payload', period, `${filterHash}:${groupBy}`);
      const strippedPayload = { ...payload, orders: [] as typeof payload.orders };
      const payloadEnvelope = { data: strippedPayload, cachedAt: new Date().toISOString() };
      await redis.set(payloadKey, JSON.stringify(payloadEnvelope), { ex: getTTL('report_payload') });

      const detailKey = cacheKey('entity_detail', period, `${groupBy}:ALL:${filterHash}`);
      const detailEnvelope = { data: strippedPayload, cachedAt: new Date().toISOString() };
      await redis.set(detailKey, JSON.stringify(detailEnvelope), { ex: getTTL('entities_full') });
    }
```

- [ ] **Step 5: Update tryIncrementalRefresh to use readOrders**

Replace `tryIncrementalRefresh` function signature and the cache-read section:

```typescript
async function tryIncrementalRefresh(
  period: string, filterHash: string,
  startDate: string, endDate: string, extraFilter: string | undefined,
  sendEvent: (event: string, data: unknown) => void,
  signal?: AbortSignal,
): Promise<FetchedOrders | null> {
  // Read from per-order cache
  const cached = await readOrders(period, filterHash);
  if (!cached) return null;

  const { orders: cachedOrders, meta } = cached;
  const lastFetchDate = new Date(meta.lastFetchDate);

  // If fetched today, use as-is (didFetch=false → caller skips raw-cache rewrite)
  const today = new Date();
  if (lastFetchDate.toDateString() === today.toDateString()) {
    sendEvent('progress', { phase: 'processing', message: 'Using cached data from today...' });
    return { orders: cachedOrders, didFetch: false };
  }

  // Incremental: fetch since lastFetchDate - 1 day
  const sinceDate = new Date(lastFetchDate);
  sinceDate.setDate(sinceDate.getDate() - 1);
  const sinceDateStr = sinceDate.toISOString().split('T')[0] + 'T00:00:00Z';
  sendEvent('progress', { phase: 'incremental', message: `Fetching orders since ${sinceDate.toLocaleDateString()}...`, rowsFetched: 0 });

  const newOrders = await fetchOrders(priorityClient, sinceDateStr, endDate, true, extraFilter,
    (rowsFetched, estimatedTotal) => {
      sendEvent('progress', { phase: 'incremental', rowsFetched, estimatedTotal });
    },
    signal,
  );
  sendEvent('progress', { phase: 'merging', message: `Merging ${newOrders.length} new orders with ${cachedOrders.length} cached...` });

  // Deduplicate by ORDNAME — new version wins (authoritative rebuild per Codex finding #2)
  const orderMap = new Map<string, RawOrder>();
  cachedOrders.forEach(o => orderMap.set(o.ORDNAME, o));
  newOrders.forEach(o => orderMap.set(o.ORDNAME, o));

  // Filter to date range (remove orders from before startDate in case of overlap)
  const startTime = new Date(startDate).getTime();
  const merged = [...orderMap.values()].filter(o => new Date(o.CURDATE).getTime() >= startTime);
  return { orders: merged, didFetch: true };
}
```

- [ ] **Step 6: Update the tryIncrementalRefresh call site**

In the Promise.all block, update the call to pass `period` and `filterHash` instead of `rawKey` and `metaKey`:

```typescript
        const cached = await tryIncrementalRefresh(period, filterHash, startDate, endDate, extraFilter, sendEvent, abortController.signal);
```

- [ ] **Step 7: Remove unused `rawKey` and `metaKey` variables**

Delete these two lines (they were used for the old bulk cache):

```typescript
    const rawKey = cacheKey('orders_raw', period, filterHash);
    const metaKey = cacheKey('orders_raw_meta', period, filterHash);
```

Also remove `import { redis } from '../cache/redis-client.js';` if it's no longer used directly. Check: `entities_full` still uses `redis.set` directly, so keep the import.

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add server/src/routes/fetch-all.ts
git commit -m "refactor(fetch-all): replace bulk cache with per-order writeOrders/readOrders"
```

---

### Task 5: Update cache-status.ts for New Meta Key Pattern

**Files:**
- Modify: `server/src/routes/cache-status.ts`
- Modify: `server/src/routes/__tests__/cache-status.test.ts`

- [ ] **Step 1: Update the key pattern in cache-status.ts**

Change the SCAN pattern from `dashboard:orders_raw_meta:` to `orders:meta:`:

```typescript
    // WHY: Scan meta keys to discover which filter hashes have cached data for this period.
    const pattern = `orders:meta:${period}:*`;
    const keys = await redis.keys(pattern);
```

Also update the filterHash extraction (the key format changed):

```typescript
      // WHY: Key format is orders:meta:{period}:{filterHash} — filterHash starts at index 3
      const filterHash = key.split(':').slice(3).join(':');
```

And update the meta parsing — the new meta format stores data directly (no envelope wrapper):

```typescript
    const envelopes = await Promise.all(keys.map(async (key) => {
      const raw = await redis.get(key);
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const filterHash = key.split(':').slice(3).join(':');
      // WHY: New meta format stores {lastFetchDate, orderCount, filterHash} directly — no envelope wrapper.
      const data = parsed as { lastFetchDate: string; orderCount: number };
      return { filterHash, data };
    }));

    const valid = envelopes.filter((e): e is NonNullable<typeof e> => e !== null);
    if (valid.length === 0) {
      const empty: CacheStatus = { raw: false, lastFetchDate: null, rowCount: 0, filterHashes: [] };
      return res.json(empty);
    }

    valid.sort((a, b) => (b.data.lastFetchDate || '').localeCompare(a.data.lastFetchDate || ''));
    const newest = valid[0];

    const status: CacheStatus = {
      raw: true,
      lastFetchDate: newest.data.lastFetchDate,
      rowCount: newest.data.orderCount,
      filterHashes: valid.map(v => v.filterHash),
    };
```

- [ ] **Step 2: Update cache-status test**

Update the test to use the new key pattern and meta format:

```typescript
  it('returns raw=true with metadata when cache exists', async () => {
    (redis.keys as ReturnType<typeof vi.fn>).mockResolvedValue([
      'orders:meta:ytd:all',
    ]);
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        lastFetchDate: '2026-04-14T08:23:00Z',
        orderCount: 22431,
        filterHash: 'all',
      }),
    );

    const res = await request(makeApp()).get('/api/sales/cache-status?period=ytd');

    expect(res.status).toBe(200);
    expect(res.body.raw).toBe(true);
    expect(res.body.lastFetchDate).toBe('2026-04-14T08:23:00Z');
    expect(res.body.rowCount).toBe(22431);
    expect(res.body.filterHashes).toContain('all');
  });
```

Also update the `raw=false` test to use the new pattern (the mock already returns `[]`, so just ensure the pattern is correct — no change needed if `redis.keys` mock doesn't inspect the pattern).

- [ ] **Step 3: Verify tests pass**

```bash
cd server && npx vitest run src/routes/__tests__/cache-status.test.ts
```

Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/cache-status.ts server/src/routes/__tests__/cache-status.test.ts
git commit -m "refactor(cache-status): read from orders:meta: keys instead of dashboard:orders_raw_meta:"
```

---

### Task 6: Restore cache-layer.ts to Simple cachedFetch

**Files:**
- Modify: `server/src/cache/cache-layer.ts`
- Modify: `server/tests/cache/cache-layer.test.ts`

- [ ] **Step 1: Rewrite cache-layer.ts — remove safe* functions**

Replace the entire file:

```typescript
// FILE: server/src/cache/cache-layer.ts
// PURPOSE: Get-or-fetch pattern with Redis caching — spec Section 19.3
// USED BY: server/src/routes/dashboard.ts, server/src/routes/fetch-all.ts
// EXPORTS: cachedFetch

import { redis } from './redis-client.js';

interface CacheResult<T> {
  data: T;
  cached: boolean;
  cachedAt: string | null;
}

interface CacheEnvelope<T> {
  data: T;
  cachedAt: string;
}

/** Fetch from cache if available, otherwise call fetcher and cache the result.
 *  WHY: Used for small-to-medium payloads (customers, zones, agents, etc.) that fit
 *  in a single Redis key (<10 MB). For large order data, use order-cache.ts instead. */
export async function cachedFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<CacheResult<T>> {
  // Try cache first
  const raw = await redis.get(key);
  if (raw !== null) {
    const envelope: CacheEnvelope<T> = typeof raw === 'string' ? JSON.parse(raw) : raw as CacheEnvelope<T>;
    return { data: envelope.data, cached: true, cachedAt: envelope.cachedAt };
  }

  // Cache miss — fetch fresh data
  const data = await fetcher();
  const envelope: CacheEnvelope<T> = { data, cachedAt: new Date().toISOString() };
  await redis.set(key, JSON.stringify(envelope), { ex: ttlSeconds });

  return { data, cached: false, cachedAt: null };
}
```

- [ ] **Step 2: Restore cache-layer.test.ts — remove chunking mock expectations**

Replace the entire test file:

```typescript
// FILE: server/tests/cache/cache-layer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cachedFetch } from '../../src/cache/cache-layer';

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
```

- [ ] **Step 3: Verify all tests pass**

```bash
cd server && npx vitest run
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/cache/cache-layer.ts server/tests/cache/cache-layer.test.ts
git commit -m "refactor(cache-layer): remove safe* chunking functions — replaced by order-cache.ts"
```

---

### Task 7: Update fetch-all Tests

**Files:**
- Modify: `server/src/routes/__tests__/fetch-all.test.ts`

- [ ] **Step 1: Update mock setup — remove importOriginal for cache-layer**

The cache-layer mock no longer needs the real `safeRedis*` imports. Add `order-cache.js` mock instead:

```typescript
vi.mock('../../cache/cache-layer.js', () => ({
  cachedFetch: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => {
    const data = await fn();
    return { data, cached: false, cachedAt: new Date().toISOString() };
  }),
}));

vi.mock('../../cache/order-cache.js', () => ({
  writeOrders: vi.fn().mockResolvedValue(true),
  readOrders: vi.fn().mockResolvedValue(null),   // default: cache miss → fullFetch
  deleteOrderIndex: vi.fn().mockResolvedValue(undefined),
}));
```

Import the mocked module:

```typescript
import { writeOrders, readOrders, deleteOrderIndex } from '../../cache/order-cache.js';
```

- [ ] **Step 2: Update force-refresh delete assertions**

Replace `redis.del` assertions with `deleteOrderIndex` assertions:

```typescript
  it('with refresh=true: deletes current-year and prev-year order indexes', async () => {
    const year = new Date().getFullYear();

    await request(makeApp())
      .get('/api/sales/fetch-all?period=ytd&refresh=true')
      .expect(200);

    expect(deleteOrderIndex).toHaveBeenCalledWith('ytd', 'all');
    expect(deleteOrderIndex).toHaveBeenCalledWith(String(year - 1), 'all');
  });
```

- [ ] **Step 3: Update write assertions to check writeOrders**

For tests that check `redis.set` for raw cache writes, replace with `writeOrders` assertions:

```typescript
    expect(writeOrders).toHaveBeenCalledWith(
      expect.any(Array),  // orders
      'ytd',
      'all',
      expect.any(Number), // TTL
    );
```

- [ ] **Step 4: Remove stale redis.del assertions on old key patterns**

Any test that asserts `redis.del` was called with `dashboard:orders_raw:*` or `dashboard:orders_raw_meta:*` should be updated to use `deleteOrderIndex` instead.

- [ ] **Step 5: Run all tests**

```bash
cd server && npx vitest run
```

Expected: All 162+ tests pass, 5 skipped.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/__tests__/fetch-all.test.ts
git commit -m "test(fetch-all): update mocks for per-order cache (writeOrders/readOrders/deleteOrderIndex)"
```

---

### Task 8: Full Pre-Deploy Verification

- [ ] **Step 1: TypeScript check — both sides**

```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1"
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run all server tests**

```bash
cd server && npx vitest run
```

Expected: All pass.

- [ ] **Step 3: Build client bundle**

```bash
cd client && npx vite build
```

Expected: Bundle < 500 KB gzip.

- [ ] **Step 4: Check for any type violations**

```bash
grep -rn ": any\|as any" server/src/ client/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__ | grep -v ".test."
```

Expected: No output.

- [ ] **Step 5: Verify file sizes**

```bash
wc -l server/src/cache/order-cache.ts server/src/cache/cache-layer.ts server/src/cache/cache-keys.ts server/src/routes/fetch-all.ts
```

Expected: All under 300 lines.

- [ ] **Step 6: Final commit — learnings document**

Create `learnings/upstash-10mb-per-order-caching.md`:

```markdown
# Upstash 10 MB Limit — Per-Order Caching Pattern

## Discovery
Upstash Redis enforces a 10 MB max request size per SET command. With 10K+ orders (~2 KB each), the bulk cache exceeds this limit (~20 MB). The Upstash error includes the SET command string, which leaks raw order data into the SSE error modal.

## Solution
Store each RawOrder as its own key (`order:{ORDNAME}` → ~2 KB). Use an index key (`orders:idx:{period}:{filterHash}`) listing all order IDs. Pipeline writes in 500-order batches (~1 MB each).

## Key Design Decisions
- **All-or-nothing writes:** Index/meta only published after ALL pipeline batches succeed. Prevents permanently wrong KPIs from partial caches.
- **Full-or-miss reads:** If any MGET key returns null, treat as cache corruption → re-fetch. Never return partial data.
- **Order-intrinsic indexes only:** No indexes for zone/customerType (derived from mutable customer records). Filter post-cache in-memory.
- **entity_detail keeps embedded orders:** Per-entity payloads are small (~200 KB). Only consolidated `report_payload` strips orders.
- **Authoritative index rebuild on incremental refresh:** Build replacement index from the full merged order set, not a read-modify-write union (prevents last-writer-wins race).

## MGET Performance
MGET is billed as one Upstash command regardless of key count. 500-key MGET × 20 batches ≈ 1 second for 10K orders.
```

```bash
git add learnings/upstash-10mb-per-order-caching.md
git commit -m "docs: add learnings for Upstash 10 MB per-order caching pattern"
```
