# Universal Order Cache — Filter In-Memory Pattern

## Discovery
With per-order caching, each filter combination (agent/zone/customerType) created a separate cache scope (`orders:idx:ytd:agent=Charles Gauguin`). This meant filtered Reports made redundant 4-minute Priority API calls even when the same orders already existed in the "all" cache.

## Solution
Always cache raw orders under a single `filterHash: "all"` scope. Apply agent/zone/customerType filters post-cache in-memory. One painful initial load → all filtered views are instant.

## Key Design Decisions
- **Raw cache scope is always "all":** `readOrders(period, 'all')`, `writeOrders(orders, period, 'all', ttl)`
- **Agent filtering is now ORDER-level post-cache:** `filterOrdersByAgent()` filters by `AGENTNAME` directly on each order (not customer lookup). Case-insensitive, comma-separated multi-select.
- **Zone/customerType remain CUSTOMER-level post-cache:** Unchanged — uses `filterOrdersByCustomerCriteria()`.
- **Aggregated caches keep per-filter scoping:** `entities_full`, `report_payload`, `entity_detail` use `buildFilterHash()` because aggregated data differs per filter combo.
- **No OData agent filter:** `fetchOrders` is always called without `extraFilter` from fetch-all. Always fetches ALL orders.
- **Incremental refresh is universal:** Delta fetch has no agent filter — ALL new orders get merged into the universal cache.
- **AGENTNAME added to prev-year select:** Required for in-memory agent filtering of YoY data.

## Deduplication Guarantees
1. `Map<string, RawOrder>` keyed by ORDNAME in incremental merge — no duplicates in merged set
2. `order:{ORDNAME}` Redis keys — deterministic, writing same ORDNAME overwrites same key
3. Index rebuilt from Map values — authoritative, not a union of partial indexes

## Performance Impact
- First load (cold cache): Same as before (~12 min for all orders)
- Filtered load (warm cache, same day): ~10-12 seconds (cache read + in-memory filter)
- Previously filtered load (warm cache): ~4 min (redundant Priority API call) → now ~10-12 seconds

## Files
- `server/src/routes/fetch-all.ts` — Universal "all" scope, removed buildODataFilter
- `server/src/services/customer-filter.ts` — New filterOrdersByAgent()
- `server/src/services/priority-queries.ts` — AGENTNAME in prev-year select
