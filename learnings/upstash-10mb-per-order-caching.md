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

## Files
- `server/src/cache/order-cache.ts` — writeOrders, readOrders, deleteOrderIndex
- `server/src/cache/cache-keys.ts` — orderKey, orderIndexKey, orderMetaKey helpers
- `server/src/config/constants.ts` — ORDER_PIPELINE_BATCH = 500
