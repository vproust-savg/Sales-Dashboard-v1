# Per-Order Redis Caching Design (v2 — post-adversarial review)

## Problem

Upstash Redis enforces a **10 MB max request size** per SET command. When the dashboard runs a full Report (all customers, no filters), the raw order cache exceeds this limit:

- Current-year orders: ~10K orders × ~2 KB = **~20 MB** → SET fails
- Prev-year orders: similar size → SET fails
- Aggregated consolidated payloads (`report_payload`): include `orders: OrderRow[]` → **~40 MB** → SET fails

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

**Index size check:** 70K order IDs × 12-char ORDNAME ≈ 1.1 MB of JSON. Well under 10 MB even at maximum scale.

### Write Path (fetch-all.ts) — All-or-Nothing Semantics

When `fetchOrders()` returns orders from Priority:

1. **Write individual orders** — Pipeline `SET order:{ORDNAME} <json>` for each order, batched in groups of 500 (pipeline keeps it to ~1 MB per batch, well under 10 MB).
2. **If ALL batches succeed** → write index key + meta key.
3. **If ANY batch fails** → do NOT write index/meta. Log an error. The report still completes (data is in memory) — it just won't be cached. Next request retries the full write.

**WHY all-or-nothing (Codex finding #1):** If we publish the index after a partial write, the cache advertises itself as valid while orders are missing. The incremental refresh path only looks back 1 day — older missing orders would never be backfilled, producing permanently wrong KPIs. By gating the index on full success, a partial write is equivalent to a cache miss — safe and self-healing.

Steps 1-3 replace the current `safeRedisWrite(rawKey, JSON.stringify({data: orders, ...}))`.

**Pipeline batching math:**
- 500 orders × 2 KB = ~1 MB per pipeline
- 10K orders = 20 pipelines × ~100ms each = ~2 seconds total
- Acceptable overhead for a Report that already takes 2-5 minutes

### Read Path (tryIncrementalRefresh, cachedFetch for prev-year)

When reading cached orders:

1. **Read index** — `GET orders:idx:{period}:{filterHash}` → array of ORDNAME strings.
2. **Read orders** — `MGET order:{id1} order:{id2} ...` in batches of 500.
3. **Validate completeness** — if any MGET key returns null, treat as **cache corruption**: log a warning with the count of missing orders and return null (cache miss). Do NOT return partial data.
4. **Parse and return** — `RawOrder[]`.

**WHY full-or-miss (Codex finding #1):** Returning partial data would produce silently wrong aggregations. A cache miss triggers a fresh Priority fetch, which is slow but correct. Stale individual order keys don't cause harm — they'll be overwritten on the next write or expire via TTL.

**MGET batching math:**
- 500 keys per MGET × 2 KB response = ~1 MB per response
- 10K orders = 20 MGET calls × ~50ms each = ~1 second total
- MGET is billed as one Upstash command regardless of key count — rate-limit friendly

### Incremental Refresh — Authoritative Rebuild

The current incremental refresh (fetch orders since lastFetchDate - 1 day, merge by ORDNAME) adapts as follows:

1. Fetch new/updated orders from Priority.
2. **Pipeline SET** each new order → overwrites stale versions automatically.
3. **If all writes succeed:**
   a. Read the **full existing order set** from cache (index + MGET).
   b. Merge in-memory: existing orders + new orders, deduped by ORDNAME (new wins).
   c. Filter to date range (remove orders before `startDate`).
   d. **Write a complete replacement index** from the merged set's ORDNAME list.
   e. **Write updated meta** with new lastFetchDate and orderCount.

**WHY authoritative rebuild, not union (Codex finding #2):** A read-modify-write union on the index has a last-writer-wins race when two concurrent Reports share the same `period/filterHash`. By building the replacement index from the authoritative in-memory merged order set, the index is always consistent with the actual data. If the old cache can't be read (corruption), fall back to writing only the new orders' index — still correct, just fewer orders cached until next refresh.

### Force Refresh

When `refresh=true`:

1. **Delete index + meta** — `DEL orders:idx:{period}:{filterHash}`, `DEL orders:meta:{period}:{filterHash}`.
2. **Do NOT delete individual order keys** — they're shared across periods/filters. They'll be overwritten by the fresh fetch. Stale order keys expire via TTL.
3. **Delete prev-year index + meta** — same pattern.

### Index Strategy — Only Order-Intrinsic Filters

**WHY no per-filter indexes for zone/customerType (Codex finding #3):** Zone and customerType are derived from **live customer records** (`filterOrdersByCustomerCriteria` in fetch-all.ts:134-137), not from immutable order fields. If a customer changes zone, their historical orders should move between filtered reports. A materialized filtered index would serve stale membership indefinitely.

**Rule:** Only persist indexes keyed by **order-intrinsic predicates**:
- `period` — derived from `CURDATE`, immutable
- `agentName` — an OData filter applied at Priority fetch time, immutable per order

Zone and customerType filtering happens **post-cache**, applied in-memory after reading the full (or agent-filtered) order set — exactly as it does today. This means:
- `orders:idx:ytd:all` — all YTD orders (no agent filter)
- `orders:idx:ytd:agent=Alexandra Gasia` — YTD orders for one agent
- No `orders:idx:ytd:zone=...` or `orders:idx:ytd:type=...` keys

The post-fetch filter (`filterOrdersByCustomerCriteria`) runs on the cached order set. With 10K orders in memory, this filter takes <10ms — no performance concern.

### Aggregated Payload Caching — Scoped by Size

**`report_payload` (consolidated mode):** Strip orders → store `{ ...payload, orders: [] }`. The client already receives orders via SSE `orders-batch` events, not from this cache. The `report_payload` cache is only read by `dashboard.ts` for instant dimension switches, which reconstructs orders from per-order keys.

**`entity_detail` (single-entity mode): Keep orders embedded.** Per-entity detail payloads are small (10-100 orders per entity, ~20-200 KB) — well under the 10 MB limit. No changes needed.

**WHY keep entity_detail orders (Codex finding #4):** `/api/sales/dashboard` uses `entity_detail` cache for single-entity clicks. Stripping orders would require entity-scoped order indexes (not defined in this spec) and regress the current fast path. Since per-entity payloads are small, the 10 MB limit is not a concern here.

### cache-status.ts Impact

The `/api/sales/cache-status` endpoint currently reads the `orders_raw` key to check if data is cached. Change it to read the meta key instead: `orders:meta:{period}:{filterHash}`.

### Files Changed

| File | Change |
|---|---|
| `server/src/cache/order-cache.ts` | **New file.** `writeOrders(orders, period, filterHash, ttl)` (all-or-nothing), `readOrders(period, filterHash)` (full-or-miss), `deleteOrderIndex(period, filterHash)`. |
| `server/src/cache/cache-layer.ts` | Remove `safeRedisWrite`/`safeRedisRead`/`safeRedisDelete` (replaced by order-cache.ts). Keep `cachedFetch` unchanged. |
| `server/src/cache/cache-keys.ts` | Add `orderKey(ordname)`, `orderIndexKey(period, filterHash)`, `orderMetaKey(period, filterHash)` helpers. |
| `server/src/routes/fetch-all.ts` | Replace raw-cache writes with `writeOrders(...)`. Replace raw-cache reads in `tryIncrementalRefresh` with `readOrders(...)`. Replace raw-cache deletes with `deleteOrderIndex(...)`. Strip orders from `report_payload` cache write. Keep orders in `entity_detail` cache write. |
| `server/src/routes/dashboard.ts` | When reading `report_payload` from cache (consolidated mode), reconstruct orders from per-order keys if orders array is empty. No change for `entity_detail` reads (orders already embedded). |
| `server/src/routes/cache-status.ts` | Read `orders:meta:{period}:{filterHash}` instead of `orders_raw:{period}:{filterHash}`. |
| `server/src/config/constants.ts` | Add `ORDER_PIPELINE_BATCH = 500` constant. |

### What Stays the Same

- **`cachedFetch` generic function** — still used for customers, contacts, zones, agents, years_available, entities_summary. These are all small enough for single-key storage.
- **SSE streaming** — `orders-batch` events stay (they solved the SSE payload size issue independently).
- **data-aggregator.ts** — no changes. It receives `RawOrder[]` regardless of how they were stored/retrieved.
- **Client code** — no changes. The client doesn't know about the caching layer.
- **`entity_detail` cache shape** — unchanged. Orders stay embedded for per-entity lookups.
- **Post-cache filtering** — zone/customerType filtering remains in-memory, applied after cache read.

### Error Handling

- **Write failures:** If ANY pipeline batch fails during order writes, do NOT publish the index/meta. Log an error with the failed batch range. The Report still completes (data is in memory) — it just won't be cached. Next request retries.
- **Read: missing index** — treat as cache miss. Re-fetch from Priority.
- **Read: index exists but MGET returns nulls** — treat as cache corruption. Log a warning with missing count. Return null (cache miss). Do NOT return partial data.
- **Read: index exists, all orders found** — return the full `RawOrder[]`. Happy path.

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
- **Production test**: Run a full Report (all customers, no filters) → completes without Upstash errors. Railway logs show `[order-cache] Wrote N orders in M batches` — no `ERR max request size exceeded`.
- **All-or-nothing check**: Simulate a batch failure (e.g., network drop mid-write) → index/meta should NOT be written. Next Report retries the full write.
- **Incremental refresh**: Run the same Report the next day → `tryIncrementalRefresh` merges new orders, writes authoritative replacement index.
- **Cache-status**: `/api/sales/cache-status?period=ytd` shows updated `rowCount` and `lastFetchDate`.
- **Single-entity detail**: Click a customer → Orders tab loads from `entity_detail` cache (orders embedded, no reconstruction needed).
- **Consolidated dimension switch**: After Report loads, switch dimension → `report_payload` cache hit. Orders reconstructed from per-order keys (or still in SSE payload from initial load).

## Codex Review Findings (Addressed)

| # | Finding | Severity | Resolution |
|---|---|---|---|
| 1 | Partial writes become permanent silent data loss | Critical | All-or-nothing: index/meta only published after ALL order writes succeed. Reads treat missing MGET keys as corruption → cache miss. |
| 2 | Incremental index updates lose IDs under concurrent refreshes | High | Authoritative rebuild: replacement index built from full merged order set, not read-modify-write union. |
| 3 | Filter-hash indexes drift when customer metadata changes | High | Only index on order-intrinsic predicates (period, agent). Zone/customerType filtering stays post-cache in-memory. |
| 4 | Removing orders from entity_detail breaks dashboard fast path | High | Keep orders embedded in `entity_detail` (small payloads, under 10 MB). Only strip from `report_payload`. |
