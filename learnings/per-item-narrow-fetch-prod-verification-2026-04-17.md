# Per-Item Narrow-Fetch — Production Verification Notes (2026-04-17)

**Commit:** fe20665 — `feat(narrow-fetch): per-item dim cold-cache via warm-cache reverse index`
**Production URL:** https://sales-dashboard-production-dbff.up.railway.app/
**Status:** Deployed + safe fallback confirmed. **Fast-path cannot be fully verified today** because Priority ERP is transiently slow (independent of our change).

## What was verified

| Check | Result |
|---|---|
| Deploy succeeded (GitHub → Railway) | ✅ health endpoint 200 after push |
| No regression: customer dim narrow | ✅ `entityId=C7826` → 1.0s / 10s cold |
| No regression: zone dim narrow | ✅ `entityId=01` → 35.8s (Priority slow, but completed 200) |
| No regression: entities master (fast) | ✅ 232 vendors / 1876 customers, sub-second |
| Per-item dim safe fallback | ✅ `groupBy=vendor&entityId=V5840` with no revidx → falls through to universal path (same as pre-change) |
| Per-item fast path (reverse index narrow) | ⚠️ **Could not verify** — revidx requires warm-cache completion, blocked by Priority slowness |

## Why the fast path isn't exercised today

The reverse index (`dashboard:revidx:ytd`) is populated by two hooks, both of which depend on a successful full YTD ORDERS fetch from Priority:
1. `warm-cache.ts` on cold-boot: fetches orders, builds + persists index.
2. `order-cache.writeOrders('ytd', 'all', …)` called from `fetch-all.ts`: same.

Priority's OData API is currently responding very slowly:
- `ORDERS?$top=1` → 30–55s (normally < 1s)
- `fetch-all` full YTD → 170s timeout (`rowsFetched: 0`)

With Priority this slow, neither the warm-cache hook nor the fetch-all hook can complete. The revidx key never materialises, and per-item requests hit the `kind: 'no-index'` branch of the resolver, which correctly falls through to the universal path (i.e., the same code path that existed before this change).

**This is NOT a bug in our change** — it's a Priority ERP availability issue. Once Priority recovers and warm-cache next completes a full fetch, the reverse index will materialise automatically and per-item narrow will activate.

## Verified via direct Redis inspection

| Key | State | Meaning |
|---|---|---|
| `dashboard:customers:all` | exists | Master data warmed OK |
| `dashboard:zones:all` | exists | Master data warmed OK |
| `dashboard:products:all` | exists | Master data warmed OK |
| `dashboard:vendors:all` | exists | Master data warmed OK |
| `dashboard:orders_ytd:ytd` | **absent** | Warm-cache orders fetch never completed (Priority slow) |
| `orders:meta:ytd:all` | **absent** | fetch-all hasn't successfully persisted full universe |
| `dashboard:revidx:ytd` | **absent** | Blocked on orders persistence above |
| `order:*` | 0 keys | No per-order cache entries |

## Acceptance criteria revisit

Plan Step 9 target: "all four dims < 30s single, < 45s 2-entity Consolidated."

Today: cannot meet this target because revidx is not populated. Fallback path (universal cache) is also cold, so per-item requests time out at 180s — same as pre-commit behavior. No regression; no new capability until Priority recovers.

## Rollback decision: **DO NOT ROLLBACK**

Rollback triggers from the plan:
- any 500 on existing working paths → ❌ customer/zone still 200
- any > 60s response on paths that were fast → ❌ the only > 60s response (zone=01, 35.8s) is a Priority-slowness artifact, not our change; customer single-id is 1s
- cache-poisoning regression → ❌ `dashboard:orders:ytd:all` / `orders:meta:ytd:all` absent (good — nothing wrote a narrowed subset there)

None of the triggers are met. The commit is safe in production. The feature is effectively dormant until Priority recovers.

## Follow-up plan

1. **When Priority recovers** (Priority $top=1 under ~5s): re-run warm-cache fetch (either by waiting for server restart or manually triggering). Verify `dashboard:revidx:ytd` appears. Then re-run per-dim cold-cache probes.
2. **Acceptance probe script** (save for re-use):
   ```bash
   for dim in vendor brand product_type product; do
     # pick a real id from /api/sales/entities first
     curl -sS -o /dev/null -w "$dim → HTTP %{http_code} time=%{time_total}s\n" --max-time 60 \
       "https://sales-dashboard-production-dbff.up.railway.app/api/sales/dashboard?groupBy=$dim&entityId=<ID>&period=ytd"
   done
   ```
3. **Monitor** whether warm-cache eventually completes on its own. If it repeatedly fails, warm-cache may need a retry-with-backoff policy — separate concern from this change.

## Unit + integration test evidence (deterministic, independent of prod state)

290 passing (was 258 pre-change): +32 new tests. Full TDD coverage:
- `reverse-index.test.ts` — 8 tests (build + read/write)
- `resolve-customers-for-entity.test.ts` — 7 tests (all four resolution kinds)
- `narrow-order-filter.test.ts` — 7 tests (custnameOrFilter export + escape + buildNarrowOrderFilter)
- `order-cache-revidx-hook.test.ts` — 3 tests (hook only fires on filterHash='all', skips on narrow/empty)
- `warm-cache-revidx-hook.test.ts` — 2 tests (cold boot builds; hot skip doesn't)
- `dashboard-cold-cache-narrow-fetch.test.ts` extended — 24 tests (per-dim: ok/empty/over-cap/no-index)
- `fetch-all-narrow-fetch.test.ts` extended — 9 tests (incl. poisoning defense assertion)

These simulate Priority responses and Redis state directly and prove the resolver logic behaves correctly for every branch, independent of whether today's Priority instance is responsive.
