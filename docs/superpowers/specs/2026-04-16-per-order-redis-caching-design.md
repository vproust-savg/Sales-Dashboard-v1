# Per-Order Redis Caching Design

## Problem

Upstash Redis enforces a **10 MB max request size** per SET command. When the dashboard runs a full Report (all customers, no filters), the raw order cache exceeds this limit:

- Current-year orders: ~10K orders × ~2 KB = **~20 MB** → SET fails
- Prev-year orders: similar size → SET fails
- Aggregated payloads (report_payload, entity_detail): include `orders: OrderRow[]` → **~40 MB** → SET fails

The Upstash error propagates through the SSE error handler and crashes the Report with a wall of red text containing raw order data (the SET command string is included in the error message).

## Solution: Per-Order Redis Keys

Store each `RawOrder` as its own Redis key. Each order is ~2 KB — well under the 10 MB limit. Replace bulk array caches with index keys that list order IDs for a given period/filter combination.

### Key Schema

| Key Pattern | Value | Size | TTL |
|---|---|---|---|
| `order:{ORDNAME}` | `JSON.stringify(RawOrder)` | ~2 KB | 365 days |
| `orders:idx:{period}:{filterHash}` | `JSON.stringify(string[])` — array of ORDNAME IDs | ~100 KB for 10K orders | 365 days (raw), 24h (year) |
| `orders:meta:{period}:{filterHash}` | `{lastFetchDate, orderCount, filterHash}` | ~100 bytes | 365 days |

**Why `order:{ORDNAME}` and not `dashboard:order:{ORDNAME}`?**
Orders are shared across all periods and filters. A single order key is referenced by multiple index keys (ytd index, full-year index, filtered indexes). The `order:` prefix is a top-level namespace.

**Why index keys instead of SCAN?**
Redis SCAN is O(N) over the keyspace. An index key with 10K IDs is one GET + one MGET — O(1) lookups.

### Write Path (fetch-all.ts)

When `fetchOrders()` returns orders from Priority:

1. **Write individual orders** — Pipeline `SET order:{ORDNAME} <json>` for each order, batched in groups of 500 (pipeline keeps it to ~1 MB per batch, well under 10 MB).
2. **Write index key** — `SET orders:idx:{period}:{filterHash}` with the array of ORDNAME strings.
3. **Write meta key** — `SET orders:meta:{period}:{filterHash}` with `{lastFetchDate, orderCount, filterHash}`.

Steps 1-3 replace the current `safeRedisWrite(rawKey, JSON.stringify({data: orders, ...}))`.

**Pipeline batching math:**
- 500 orders × 2 KB = ~1 MB per pipeline
- 10K orders = 20 pipelines × ~100ms each = ~2 seconds total
- Acceptable overhead for a Report that already takes 2-5 minutes

### Read Path (tryIncrementalRefresh, cachedFetch for prev-year)

When reading cached orders:

1. **Read index** — `GET orders:idx:{period}:{filterHash}` → array of ORDNAME strings.
2. **Read orders** — `MGET order:{id1} order:{id2} ...` in batches of 500.
3. **Parse and return** — `RawOrder[]`.

**MGET batching math:**
- 500 keys per MGET × 2 KB response = ~1 MB per response
- 10K orders = 20 MGET calls × ~50ms each = ~1 second total
- Current single-key read takes ~500ms for a 20 MB value — comparable

### Incremental Refresh

The current incremental refresh (fetch orders since lastFetchDate - 1 day, merge by ORDNAME) works naturally:

1. Fetch new/updated orders from Priority.
2. **Pipeline SET** each new order → overwrites stale versions automatically.
3. **Update index** — read existing index, add new IDs (Set union), remove IDs for orders before `startDate`, write back.
4. **Update meta** — new lastFetchDate and orderCount.

No deduplication logic needed — Redis SET is inherently idempotent per key.

### Force Refresh

When `refresh=true`:

1. **Delete index + meta** — `DEL orders:idx:{period}:{filterHash}`, `DEL orders:meta:{period}:{filterHash}`.
2. **Do NOT delete individual order keys** — they're shared across periods/filters. They'll be overwritten by the fresh fetch. Stale order keys expire via TTL.
3. **Delete prev-year index + meta** — same pattern.

### Aggregated Payload Caching

The `report_payload` and `entity_detail` caches currently store the full `DashboardPayload` including `orders: OrderRow[]`. With per-order keys, these caches can **exclude orders** from the payload:

- Store `{ ...payload, orders: [] }` in `report_payload` — the client already receives orders via SSE `orders-batch` events, not from this cache.
- When the `dashboard.ts` route reads `entity_detail` from cache, it reconstructs orders by reading the per-order keys.

This keeps `report_payload` and `entity_detail` under the 10 MB limit without chunking.

### cache-status.ts Impact

The `/api/sales/cache-status` endpoint currently reads the `orders_raw` key to check if data is cached. Change it to read the meta key instead: `orders:meta:{period}:{filterHash}`.

### Files Changed

| File | Change |
|---|---|
| `server/src/cache/cache-layer.ts` | Add `writeOrders(orders, period, filterHash, ttl)`, `readOrders(period, filterHash)`, `deleteOrderIndex(period, filterHash)`. Remove `safeRedisWrite`/`safeRedisRead`/`safeRedisDelete` (no longer needed). |
| `server/src/cache/cache-keys.ts` | Add `orderKey(ordname)`, `orderIndexKey(period, filterHash)`, `orderMetaKey(period, filterHash)` helpers. |
| `server/src/routes/fetch-all.ts` | Replace `safeRedisWrite(rawKey, ...)` with `writeOrders(orders, ...)`. Replace `safeRedisRead(rawKey)` in `tryIncrementalRefresh` with `readOrders(...)`. Replace `safeRedisDelete(rawKey)` with `deleteOrderIndex(...)`. Exclude orders from `report_payload`/`entity_detail` cache writes. |
| `server/src/routes/dashboard.ts` | When reading `entity_detail` from cache, reconstruct orders from per-order keys if orders array is empty. |
| `server/src/routes/cache-status.ts` | Read `orders:meta:{period}:{filterHash}` instead of `orders_raw:{period}:{filterHash}`. |
| `server/src/config/constants.ts` | Add `ORDER_PIPELINE_BATCH = 500` constant. |

### What Stays the Same

- **`cachedFetch` generic function** — still used for customers, contacts, zones, agents, years_available, entities_summary. These are all small enough for single-key storage.
- **SSE streaming** — orders-batch events stay (they solved the SSE payload size issue independently).
- **data-aggregator.ts** — no changes. It receives `RawOrder[]` regardless of how they were stored/retrieved.
- **Client code** — no changes. The client doesn't know about the caching layer.

### Error Handling

- If a pipeline batch fails (network error), log a warning and continue. Partial cache is better than no cache — missing orders will be re-fetched next time.
- If an index read succeeds but some MGET keys return null (TTL expiry race), filter out nulls and return what we have. Log a warning with the count of missing orders.
- If the index key itself is missing, treat as cache miss and re-fetch from Priority.

### Performance Budget

| Operation | Current | After |
|---|---|---|
| Write 10K orders to Redis | 1 × 20 MB SET (fails) | 20 × 1 MB pipelines (~2s) |
| Read 10K orders from Redis | 1 × 20 MB GET (~500ms) | 20 × 500-key MGET (~1s) |
| Write 60K orders to Redis | 1 × 120 MB SET (fails) | 120 × 1 MB pipelines (~12s) |
| Read 60K orders from Redis | 1 × 120 MB GET (fails) | 120 × 500-key MGET (~6s) |
| Force-refresh cleanup | 1-3 DEL calls | 2-6 DEL calls (index + meta only) |

### Phase 2: Redis Search (Future)

The per-order key schema (`order:{ORDNAME}` → JSON) is directly compatible with Upstash Redis Search. When Redis Search matures:

1. Create a search index on the `order:` prefix with fields: CUSTNAME (tag), CURDATE (text), AGENTNAME (tag), TOTPRICE (numeric), and item-level fields.
2. Replace index-key-based reads with search queries: `orders.query({ filter: { CUSTNAME: { $eq: "C7826" } } })`.
3. Remove the manual index keys — Redis Search auto-indexes on write.

Zero migration of stored data — the same `order:{ORDNAME}` keys are indexed by Redis Search.

## Verification

- `cd server && npx tsc --noEmit` — type-check
- `cd server && npx vitest run` — all tests pass
- `cd client && npx tsc -b --noEmit` — client type-check
- `cd client && npx vite build` — bundle < 500 KB gzip
- **Production test**: Run a full Report (all customers, no filters) → completes without Upstash errors. Check Railway logs for `[cache] Chunking` → should NOT appear (chunking removed). Check for `[cache] Pipeline batch` log lines confirming per-order writes.
- **Incremental refresh**: Run the same Report again the next day → should hit `tryIncrementalRefresh` path, merge new orders, update index.
- **Cache-status**: `/api/sales/cache-status?period=ytd` should show updated `rowCount` and `lastFetchDate`.
