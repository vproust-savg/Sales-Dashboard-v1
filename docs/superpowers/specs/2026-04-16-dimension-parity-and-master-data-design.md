# Dimension Parity & Master-Data Design (v2)

**Date:** 2026-04-16
**Status:** v2 — revised after 6-agent adversarial review (3 explorers + 3 architects)
**Scope:** Bring zone, vendor, brand, product_type, and product dimensions to full feature parity with the customer dimension. Reuse the existing universal order cache and `entity-subset-filter` predicates. Fix the real root-cause of empty non-customer panels.

---

## Changes from v1

The v1 spec was largely right on intent but over-engineered. Six independent agents converged on the same simplifications. Key revisions:

| v1 proposal | v2 decision | Reason |
|---|---|---|
| Invent `EntityScope` interface (150 LOC) | **Reuse `entity-subset-filter.ts` (46 LOC, already exists)** | Agent audit: it already handles all 6 dimensions. v1 would have left it as a zombie file. |
| `isItemBased` branch in 3 aggregator functions | **Pre-filter normalization: rewrite `TOTPRICE = Σ QPRICE` of scoped items once, aggregators stay unchanged** | v1 would have required identical branch in `computeKPIs`, `computeMonthlyRevenue`, `computeSparklines`. High risk of one-file-forgets bug. |
| Eager `customerIds` on every request | **Lazy — resolved only in `contacts.ts`** | v1 no-op scope would have scanned all orders for every dashboard request + triggered 1800-customer batch fetches. |
| `enrich=true` second endpoint + `useEntityMetrics` + `mergeMetrics` | **Single endpoint; master-data-first serves nullable metrics** | v1 invented a two-endpoint protocol for a problem the client already handles (skeleton cells on null metrics). |
| `entity-scope.ts` + `master-data.ts` + `kpi-breakdowns.ts` + `product-mix-aggregator.ts` + `fetch-all-filters.ts` (5 new semantic files) | **2 new files: `order-transforms.ts` (mandatory LOC split), `entity-list-builder.ts` (master-data stub builder)** | Most v1 splits were single-consumer extractions violating "no abstractions for single-use code." |
| Feature flag `DASHBOARD_MULTI_DIM` | **Dropped** | No staged-rollout requirement. Incremental landing is already safe. |
| `ctype:all` Redis cache + `fetchCustomerTypes` | **Dropped** | `customers:all` already carries `CTYPENAME` on every row. Derive distinct values. |
| `contacts_scope:{dim}:{hash}` 15-min cache | **Dropped** | Per-entity-switch hash changes anyway; cache miss rate ~100%. |
| 80%-join-ratio Vitest assertion | **Dropped; keep Railway log line only** | Asserts on Priority data, not code; false positives/negatives. |
| "POST /api/sales/fetch-all" (typo) | **GET (corrected)** | Fetch-all is already GET. |
| Cache keys written as bare strings `customers:all` | **Use `cacheKey('customers','all')` → `dashboard:customers:all`** | Convention consistency with existing keys. |
| Spec mentioned fixing `computeKPIs` total revenue only | **Also fixes `computeMonthlyRevenue` (YoY chart) + `computeSparklines`** | v1 would have left YoY bar chart + sparklines wrong for item-based dims. |

### Root-cause of empty non-customer panels (v1 missed this)

**The empty left panel for vendor/brand/zone/product_type/product is NOT a "warm cache didn't run" problem. It's a cache-key mismatch introduced by commit `70d7f68`.**

- `entity-stub-builder.ts:30` reads the legacy bulk key `cacheKey('orders_ytd', 'ytd')` via `redis.get`.
- After commit `70d7f68`, `fetch-all.ts` writes orders via `writeOrders(orders, period, filterHash, ttl)` to **per-order keys + an index**, never updating the legacy bulk key.
- `warm-cache.ts:19-23` **skips** running when the per-order meta key (`orders_raw_meta:ytd:customer:all`) exists from a previous fetch-all run.
- Net result: after a production fetch-all, the legacy bulk key is stale/absent. `entity-stub-builder.ts` returns `null` → `/entities?groupBy=vendor` renders "0 of 0".

**Fix:** replace `redis.get(cacheKey('orders_ytd','ytd'))` in the stub builder with `readOrders('ytd', 'customer:all')`. Zero new files needed for this line.

---

## 1. Motivation

Today only the **customer** dimension is fully wired:

- Left panel is empty for non-customer dimensions (`0 of 0`) — root cause above.
- `dashboard.ts:40` only applies entity filter when `groupBy === 'customer'`; non-customer `entityId` is silently dropped.
- `dashboard.ts:45-65` writes the `entity_detail` cache key using the full un-scoped order set whenever `groupBy !== 'customer'` — **pre-existing silent data corruption** (unscoped data under a key that looks scoped).
- Contacts tab is hidden for non-customer dimensions via `useDashboardState.ts:86,91-99`.
- Multi-select / Report / View Consolidated aggregates only across customers.
- KPI revenue, YoY bar chart, sparklines all sum `TOTPRICE` — wrong for item-based dimensions where an order may contain items from many vendors/brands.

User requirements:

1. **Full parity this round** — all 6 dimensions support single-select detail, multi-select consolidated view, Report export, and dimension-aware filters.
2. **Fast load** — left-panel must render instantly, independent of `orders_ytd` being warm. Matches current customer-dim behavior (1876 stubs).
3. **Shared cached data** — same universal order cache for all dims.
4. **Extended filters** — item-attribute filters (`brand`, `productFamily`, `countryOfOrigin`, `foodServiceRetail`) for both the left-panel Filter panel and the Report dialog.
5. **Master-data fetches** — pull zone / vendor / brand / product-family / product master data from Priority so the entity list is complete (including entities with zero orders this period).

---

## 2. Dimension Semantics

Single source of truth. Verified live against Priority UAT on 2026-04-16.

| Dimension | Master entity (filter) | Entity `id` | Entity `name` | Order-predicate | Item-predicate | KPI revenue method |
|---|---|---|---|---|---|---|
| customer | CUSTOMERS | CUSTNAME | CUSTDES | `CUSTNAME ∈ ids` | `true` (keep all items) | Σ TOTPRICE |
| zone | DISTRLINES | ZONECODE | ZONEDES | `custZoneMap[CUSTNAME] ∈ ids` | `true` | Σ TOTPRICE |
| vendor | SUPPLIERS `STATDES='Active'` | SUPNAME | SUPDES | order has any item with `Y_1159_5_ESH ∈ ids` | `Y_1159_5_ESH ∈ ids` | Σ QPRICE of scoped items |
| brand | SPEC4VALUES | SPECVALUE | SPECVALUE | order has any item with `Y_9952_5_ESH ∈ ids` | `Y_9952_5_ESH ∈ ids` | Σ QPRICE of scoped items |
| product_type | FAMILY_LOG distinct `FTCODE` | FTCODE | FTNAME | order has any item with `Y_3020_5_ESH ∈ ids` | `Y_3020_5_ESH ∈ ids` | Σ QPRICE of scoped items |
| product | LOGPART `STATDES='In Use'` | PARTNAME | PARTDES | order has any item with `PARTNAME ∈ ids` | `PARTNAME ∈ ids` | Σ QPRICE of scoped items |

**Key compatibility verified live:** `Y_1159_5_ESH` ("V8534") ↔ `SUPNAME` ("V00001") — V-prefix; `Y_9952_5_ESH` ("ANTICA VALLE DOFANTA") ↔ `SPECVALUE` ("ACETUM") — uppercase brand name; `Y_3020_5_ESH`/`Y_3021_5_ESH` ("01"/"Culinary") ↔ `FTCODE`/`FTNAME` — exact match. Brand join uses case-sensitive comparison; if Priority writes drift to mixed case we fall back to `toLowerCase()` on both sides (tracked as risk, not yet observed).

---

## 3. Architecture — Pre-Filter Normalization

**Core insight (from clean-architecture review):** don't branch aggregator logic on `isItemBased`. Instead, **scope-normalize the orders array before any aggregator runs.** After normalization, aggregators are dimension-agnostic and the existing `TOTPRICE`-summing math is correct by construction.

### The normalization step (new function in `entity-subset-filter.ts`)

```ts
// Takes raw orders + a scope selector; returns a new order array where:
//   - Only matching orders remain (order-predicate)
//   - For item-based dims, each order's ORDERITEMS_SUBFORM is narrowed to matching items (item-predicate)
//   - For item-based dims, each order's TOTPRICE is rewritten to Σ QPRICE of remaining items
// For customer/zone, orders are unchanged (TOTPRICE already correct).

export function scopeOrders(
  orders: RawOrder[],
  dimension: Dimension,
  entityIds: Set<string>,
  customers: RawCustomer[],
): RawOrder[]
```

All downstream aggregators (`computeKPIs`, `computeMonthlyRevenue`, `computeSparklines`, `computeProductMix`, `buildFlatItems`, `groupOrdersByDimension`) **remain unchanged**. They iterate a normalized `RawOrder[]` and sum `TOTPRICE` as they always have.

### Pipeline

```
                ┌──────────────────────────┐
GET /dashboard  │  orders_ytd (universal)  │
  + entityIds   │  customers:all           │
                └───────────┬──────────────┘
                            ▼
                 ┌─────────────────────┐
                 │  scopeOrders(       │  ← only new logic (30-40 LOC)
                 │    orders, dim, ids │
                 │  )                  │
                 └──────────┬──────────┘
                            ▼
                 ┌─────────────────────┐
                 │  aggregateOrders    │  ← existing function, unchanged
                 │  (scoped orders)    │
                 └──────────┬──────────┘
                            ▼
                     DashboardPayload
```

### Why pre-filter beats scope-inside-aggregator

- **Only one place to get wrong.** v1's `isItemBased` branch had to be duplicated in 3 aggregator functions (`computeKPIs`, `computeMonthlyRevenue`, `computeSparklines`). v2 has one scope boundary.
- **Aggregators stay pure and testable.** They consume `RawOrder[]` and don't know about dimensions.
- **Prev-year scope is trivial.** Same `scopeOrders` call with the same `entityIds` applied to prev-year order array. No double-wiring.
- **Matches existing patterns.** `customer-filter.ts` already works as a pre-filter (`filterOrdersByAgent`, `filterOrdersByCustomerCriteria`). Extending the same pattern.

---

## 4. Fast-Load: Master-Data-First Left Panel

**Fix:** change `entities.ts` to always serve stubs from master-data caches, for all 6 dimensions, exactly as it already does for the customer dim (from `customers:all`). When the universal orders cache is warm, enrich with metrics inline in the same response. When not warm, return stubs with `null` metrics and let the Report SSE populate metrics on next load.

No new endpoint. No `enrich=true` param. No two-track TanStack Query dance. One endpoint, progressively-populated payload.

### Pseudocode for `entities.ts` (replaces current customer-only fast path)

```
GET /api/sales/entities?groupBy=<dim>&period=ytd
  ├─► masterList = readMasterCache(<dim>)      // always present — 7 caches warm-cached at startup
  ├─► orders = await readOrders('ytd', 'customer:all')  // may be null if never fetched
  ├─► if orders:
  │      metrics = groupByDimension(<dim>, orders, customers, periodMonths, prevOrders, period)
  │      merge metrics into masterList by id        // zero-order entities: metrics = 0 (not null)
  │   else:
  │      leave masterList with metrics = null       // client renders skeleton cells
  └─► return { entities: masterList, yearsAvailable, meta: { enriched: !!orders } }
```

**Zero-vs-null contract** (agent finding): entities that exist in master data but have zero orders this period return `{ revenue: 0, orderCount: 0, ... }`, not `null`. `null` means "not loaded yet." Clients distinguish skeleton (null) vs zero-display ("0 orders") based on this.

### Seven master-data caches

All warm-cached at server startup via `Promise.all`, TTL 24h. Cache keys via `cacheKey()` — consistent with existing `dashboard:customers:all`.

| Key (`cacheKey` form) → Redis key | Priority entity | Filter | Select |
|---|---|---|---|
| `cacheKey('customers','all')` → `dashboard:customers:all` | CUSTOMERS | none | existing |
| `cacheKey('zones','all')` → `dashboard:zones:all` | DISTRLINES | none | `DISTRLINECODE,DISTRLINEDES,ZONECODE,ZONEDES` |
| `cacheKey('vendors','all')` → `dashboard:vendors:all` | SUPPLIERS | `STATDES eq 'Active'` | `SUPNAME,SUPDES,STATDES` |
| `cacheKey('brands','all')` → `dashboard:brands:all` | SPEC4VALUES | none | `SPECVALUE` |
| `cacheKey('product_types','all')` → `dashboard:product_types:all` | FAMILY_LOG | none (dedup FTCODE in-memory) | `FTCODE,FTNAME` |
| `cacheKey('products','all')` → `dashboard:products:all` | LOGPART | `STATDES eq 'In Use'` | `PARTNAME,PARTDES,FAMILYNAME,Y_9952_5_ESH,STATDES` |

**Customer Type values for filter dropdowns** are derived from `customers:all` via `[...new Set(customers.map(c => c.CTYPENAME).filter(Boolean))]`. No separate `ctype:all` cache. No `fetchCustomerTypes`.

### Rate-limit mitigation during cold startup

Master-data fetches (~5 small calls) run in parallel, but `fetchOrders` is a long paginated loop. Start master-data fetches first, then `fetchOrders` with a 500ms deliberate delay to avoid the 15-queued-max ceiling when both are in-flight during cold boot. Code comment explains.

### `cache-keys.ts` extensions (build-order critical)

- Add `'zones' | 'vendors' | 'brands' | 'product_types' | 'products'` to `CacheEntity` union.
- Add TTLs to `CACHE_TTLS` in `constants.ts` (24h for all five).
- Extend `buildFilterHash` to accept the 4 new item-level filter fields: `brand`, `productFamily`, `countryOfOrigin`, `foodServiceRetail`. **Without this, two Report requests that differ only by brand filter collide on the same aggregated cache key.**
- Add `buildEntitySetHash(ids: string[]): string` that sorts then joins then hashes. Only caller (for now): the optional contacts cache if we later decide to add one. Single canonical implementation avoids filter-hash-mismatch bugs documented in `learnings/universal-order-cache-pattern.md`.

**Build order:** `cache-keys.ts` + `constants.ts` must land before `warm-cache.ts`. Otherwise `getTTL('brands')` triggers a TS error and Railway deploy fails.

---

## 5. File-by-File Changes

### New files: 2

| File | Purpose | ~LOC |
|---|---|---|
| `server/src/services/order-transforms.ts` | Extract `buildFlatItems` (~80 LOC) + `groupOrdersByDimension` helpers (~90 LOC) from `data-aggregator.ts`. Mandatory LOC-rule split. | ~180 |
| `server/src/services/entity-list-builder.ts` | Replaces `entity-stub-builder.ts`. Master-data-first stub builder for all 6 dims; merges metrics inline when orders cache is populated. | ~130 |

**Explicitly dropped vs v1:** `entity-scope.ts`, `master-data.ts`, `kpi-breakdowns.ts`, `product-mix-aggregator.ts`, `fetch-all-filters.ts`.

### Modified server files: 8

| File | Current LOC | Target LOC | Change |
|---|---|---|---|
| `services/entity-subset-filter.ts` | 46 | ~90 | Add `scopeOrders(orders, dim, ids, customers)` that applies predicates AND rewrites `TOTPRICE = Σ QPRICE` for item-based dims. Existing `filterOrdersByEntityIds` retained as the order-predicate step. |
| `services/data-aggregator.ts` | 366 | ~220 | Extract `order-transforms.ts`. Accept scoped orders; no scope awareness inside aggregator. |
| `services/kpi-aggregator.ts` | 314 | ~260 | No behavior change — aggregators consume scoped orders. Inline-extract 2 private quarter/month helpers to stay under 300 LOC without a new file. |
| `services/customer-filter.ts` | 61 | ~110 | Add `filterOrdersByItemCriteria(orders, { brand?, productFamily?, countryOfOrigin?, foodServiceRetail? })`. Composable with existing customer-level filters. |
| `services/priority-queries.ts` | 167 | ~240 | Add `fetchBrands`, `fetchProductTypes`, `fetchProducts`. Update `fetchVendors` to filter `STATDES='Active'`. Add 4 new raw types. `fetchZones` already reads DISTRLINES (unchanged). |
| `services/warm-cache.ts` | 50 | ~100 | Warm 5 new master caches in parallel. Apply 500ms delay before `fetchOrders` to respect rate limits. Remove the "skip when orders_raw_meta exists" guard for master-data fetches (master data should always refresh on startup). |
| `routes/dashboard.ts` | 104 | ~130 | Drop the `groupBy === 'customer'` special-case at line 40. Drop the buggy `entity_detail` cache writes for non-customer dims (silent-corruption fix). Normalize `entityId → [entityId]` at the Zod schema layer. Build predicate from `entity-subset-filter` helpers, call `scopeOrders`, then feed to `aggregateOrders`. |
| `routes/entities.ts` | 89 | ~130 | Always read master cache for the dimension. When orders cache warm, enrich metrics. When cold, return null metrics. Replaces the `entity-stub-builder` path. |
| `routes/contacts.ts` | ~80 | ~130 | Accept `dimension` + `entityId(s)`. For `customer`: unchanged. For other dims: resolve `customerIds` lazily via `scopeOrders` → collect `CUSTNAME`s → single batched Priority call `CUSTOMERS?$filter=CUSTNAME in (…)&$expand=CUSTPERSONNEL_SUBFORM(...)`. Dedupe by email. **No contacts_scope cache** (Karpathy review: cache hit rate ~0% in practice). |
| `routes/fetch-all.ts` | 307 | ~300 | Accept `dimension` + item-attribute filters (Zod). Call `filterOrdersByItemCriteria` after existing customer-level filters. Build entity predicate from `entity-subset-filter` helpers (already imported). No file extraction — fits under 300 after dropping the removed entity_detail write. |
| `cache/cache-keys.ts` | 54 | ~80 | Add 5 new `CacheEntity` values. Extend `buildFilterHash` signature with 4 new item filter fields. Add `buildEntitySetHash(ids)`. |

**Delete:** `server/src/services/entity-stub-builder.ts` (replaced by `entity-list-builder.ts`).

### Modified client files: 11

| File | Change |
|---|---|
| `hooks/useDashboardData.ts` | Pass `entityIds` (array) to dashboard endpoint. Drop any non-customer guards. |
| `hooks/useContacts.ts` | Accept `dimension` + `entityId(s)`. Rename query params: `dimension`, `entityId`, `entityIds` (not `customerId`/`customerIds`). |
| `hooks/useDashboardState.ts` | **L86**: drop `activeDimension === 'customer'` gate on `useContacts`. **L91-99**: drop gates on consolidated contacts. **L122**: parameterize the "Loading…" label via a `DIMENSION_PLURAL_LABELS` map. |
| `hooks/useReport.ts` | Pass `dimension` + extended filters. |
| `hooks/build-report-url.ts` | Serialize the 4 new `FetchAllFilters` fields into the SSE URL. |
| `utils/filter-types.ts` | Add `brand` / `productType` / `countryOfOrigin` / `foodServiceRetail` to `FilterField` union. Extend `DIMENSION_FILTER_FIELDS` per dimension (vendor/brand/product_type/product can filter by these item-attrs). Add `DIMENSION_PLURAL_LABELS` and `DIMENSION_SINGULAR_LABELS` maps used across the UI. |
| `components/right-panel/RightPanel.tsx` | Thread `activeDimension` prop to `DetailHeader`. |
| `components/right-panel/DetailHeader.tsx` | Use `DIMENSION_SINGULAR_LABELS[activeDimension]` for empty-state: "All Customers" / "All Vendors" / etc. |
| `components/right-panel/TabsSection.tsx` | Contacts tab rendered for every dimension. |
| `components/right-panel/PerCustomerToggle.tsx` | Add `entityLabel: string` prop; default "Customer" → "Vendor" / "Brand" / etc. from caller. |
| `components/right-panel/PerCustomerKPITable.tsx` + `PerCustomerChartTable.tsx` | Add `entityLabel?: string` prop; default "Customer"; apply to first column header. |
| `components/right-panel/KPISection.tsx` | Thread `entityLabel` through to toggle + tables. **Do NOT rename `getActivityStatus` labels** ("Active buyer" / "At risk") — customer-specific language is a deferred item, labels still render valid data for non-customer dims and fixing copy is out-of-scope for this round (tracked below). |
| `components/right-panel/kpi-modal-content.tsx` | Accept + pass `entityLabel`. |
| `components/shared/ReportFilterModal.tsx` | Per-dimension filter dropdown set: customer shows rep/zone/type; others show brand/productFamily/countryOfOrigin/foodServiceRetail. Hardcoded "Fetching data for N customers" string → dimension-plural label. |
| `components/right-panel/ConsolidatedHeader.tsx` | `formatFilters` extended to render the 4 new item-level filter field labels. |

### Shared

| File | Change |
|---|---|
| `shared/types/dashboard.ts` | Add `RawBrand`, `RawProductType`, `RawProduct` types. Extend `FetchAllFilters` with `brand`, `productFamily`, `countryOfOrigin`, `foodServiceRetail`. Add `DIMENSION_SINGULAR_LABELS` + `DIMENSION_PLURAL_LABELS` constants. |

### LOC Compliance After Changes

| File | Before | After | Under 300? |
|---|---|---|---|
| `data-aggregator.ts` | 366 | ~220 | ✓ |
| `kpi-aggregator.ts` | 314 | ~260 | ✓ |
| `fetch-all.ts` | 307 | ~300 | ✓ (tight) |
| `entity-subset-filter.ts` | 46 | ~90 | ✓ |
| `customer-filter.ts` | 61 | ~110 | ✓ |
| `priority-queries.ts` | 167 | ~240 | ✓ |
| `entities.ts` | 89 | ~130 | ✓ |
| `dashboard.ts` | 104 | ~130 | ✓ |
| `contacts.ts` | ~80 | ~130 | ✓ |

---

## 6. API Contracts

### `GET /api/sales/entities` — unified single endpoint

| Param | Values | Default |
|---|---|---|
| `groupBy` | 6-dim union | `customer` |
| `period` | `ytd`\|year | `ytd` |

Response:

```ts
{
  data: {
    entities: EntityListItem[],    // always from master cache; metrics either populated or null
    yearsAvailable: string[],
  },
  meta: {
    cached: boolean,
    cachedAt: string | null,
    dimension: Dimension,
    enriched: boolean,             // true iff metrics are populated
    entityCount: number,
  }
}
```

### `GET /api/sales/dashboard` — detail view

| Param | Values | Default |
|---|---|---|
| `groupBy` | 6-dim union | `customer` |
| `entityId` | string | optional — single |
| `entityIds` | comma-separated string | optional — multi |
| `period` | `ytd`\|year | `ytd` |

**Zod normalization** (at schema layer, NOT inside the handler): both `entityId` and `entityIds` produce a single `entityIds: string[]` array internally. Empty array → no scope filtering (returns "all-entities" dashboard).

Back-compat: existing URLs `?groupBy=customer&entityId=C7826` continue to work unchanged.

### `GET /api/sales/contacts` — dimension-aware

| Param | Values |
|---|---|
| `dimension` | 6-dim union (default `customer`) |
| `entityId` | string (single) |
| `entityIds` | comma-separated (multi) |

For `dimension=customer`: behavior unchanged. For other dims: resolves `customerIds` from scoped orders, then single batched Priority call for all customers' contacts expanded. Dedupes by email. Each `Contact` carries `customerName` for UI grouping.

### `GET /api/sales/fetch-all` (SSE) — extended

Query params (all optional, all comma-separated):
- `dimension` (default `customer`)
- `entityIds`
- `agentName`
- `zone`
- `customerType`
- `brand` — NEW
- `productFamily` — NEW
- `countryOfOrigin` — NEW
- `foodServiceRetail` — NEW
- `period`

Back-compat: existing customer-dim requests without `dimension` fall through to `customer`.

### Extended `FetchAllFilters`

```ts
export interface FetchAllFilters {
  agentName?: string[];
  zone?: string[];
  customerType?: string[];
  brand?: string[];               // NEW — item-level
  productFamily?: string[];       // NEW — item-level
  countryOfOrigin?: string[];     // NEW — item-level
  foodServiceRetail?: string[];   // NEW — item-level
  entityIds?: string[];
}
```

---

## 7. Error Handling

1. **Master-data cache miss** — Entities endpoint returns 503; client retries with TanStack exponential backoff.
2. **`orders_ytd` cache miss** — Entities endpoint returns stubs with `metrics: null`; client renders skeleton cells. Report SSE or warm-cache next cycle populates. No user-facing error.
3. **Unknown `entityId`** — `scopeOrders` returns empty array; dashboard payload is all zeros / empty lists; client shows empty state per component.
4. **Priority key format drift** — metrics-merge silently leaves entities with `metrics: null`; Railway logs emit `[entities] join-ratio dim=<dim> ratio=0.XX` on every enrichment call. Visible in logs, no CI gate.
5. **Contacts batch size** — batch `CUSTOMERS?$filter=CUSTNAME in (...)` at 50 CUSTNAMEs/call to stay under OData filter-length limits.
6. **SSE abort on fetch-all** — existing `AbortSignal` pattern preserved; `scopeOrders` is pure and bails on signal.
7. **Silent data-corruption fix** — `dashboard.ts:45-65` pre-existing behavior writes `entity_detail` cache key with un-scoped orders whenever `groupBy !== 'customer'`. **Removing this write is part of this change.** Confirm no downstream reads depend on the corrupt cache. Grep says no other reader; safe to drop.
8. **TanStack staleTime defaults** — master-data query: `staleTime: Infinity` (invalidate only on dimension change). Dashboard query per `(dimension, period, entityIds)` key: `staleTime: 5min`. Documented in hook JSDoc to avoid refetch storms on dimension toggle.

---

## 8. Edge Cases (explicit)

- **Empty orders after scope:** `totalRevenue = 0`, `orderCount = 0`, `lastOrderDate = null`, `bestMonth = { name: 'Jan', amount: 0 }` (the inherent `indexOf(Math.max(0,0,...))` behavior). Test asserts this exact shape.
- **Entity in master data, zero YTD orders:** enriched row has `revenue: 0, orderCount: 0, prevYearRevenue: 0` — numeric zeros, not `null`. Client renders "$0" / "0 orders", not skeleton.
- **Multi-select with 400+ customers (e.g., popular vendor):** `scopeOrders` is O(orders × items); YTD ~5000 orders × ~10 items ≈ 50K checks, expect <20ms. Contacts batch: 400 / 50 = 8 Priority calls, ~2s total.
- **Prev-year orders:** same `scopeOrders` call applied to prev-year order array before feeding to `aggregateOrders` prev-year branch. Same `entityIds`, same `customers` list, same function.
- **Brand case-drift:** agents flagged as theoretical risk. Mitigation: `toLowerCase()` both sides of the join in `entity-list-builder` — cheap defensive. Activate only if join-ratio log shows < 95%.

---

## 9. Testing Plan

### Unit (Vitest, server/)

- `entity-subset-filter.test.ts` — per-dim `scopeOrders`: matches expected orders, narrows items, rewrites `TOTPRICE = Σ QPRICE` for item-based dims, leaves customer/zone `TOTPRICE` unchanged. Empty `entityIds` returns empty array.
- `entity-list-builder.test.ts` — master-data-only list shape (nulls); metrics-merged shape (zeros for no-order entities, actual values otherwise). Join-ratio log emitted.
- `kpi-aggregator.test.ts` — existing tests pass unchanged (aggregator is now dimension-agnostic, operates on scoped orders).
- `dashboard.test.ts` — `?groupBy=customer&entityId=C7826` produces identical payload before/after (regression). `entityIds` multi-select works for all 6 dims. Missing entity → zero payload.
- `contacts.test.ts` — dimension=customer unchanged; non-customer resolves customer-id set then batches.
- `cache-keys.test.ts` — `buildFilterHash` with 7 fields produces distinct hashes for distinct filter combos. `buildEntitySetHash` sort-invariant.

### Integration (live Priority, manual)

1. Cold Railway deploy — verify all 7 master caches populate in parallel in <10s.
2. Cold cache, navigate to Vendor dim — expect master-data list rendered with skeleton metric cells; within ~30s fetch-all populates and numbers fill in.
3. Click each of 6 dimensions → select an entity → verify KPIs, YoY chart, product mix, orders tab, items tab, contacts tab.
4. Multi-select on Brand dim (3 brands) → verify consolidated dashboard.
5. Report export on Vendor dim with `brand` + `countryOfOrigin` filters → verify SSE completes and CSV contains only scoped rows.

### Regression (must pass identically to today)

- `?groupBy=customer&entityId=C7826` response — byte-for-byte identical to pre-change (prev-year fields, breakdowns, order/item arrays).
- Customer-dim consolidated with 3 customers — identical to pre-change.
- Airtable Omni embed at prod URL — renders customer list + detail view without visual diff.

---

## 10. Out of Scope (tracked for future rounds)

1. **Vendor-contacts tab** (new Priority form TBD). Separate spec when credentials provided.
2. **Per-customer breakdown cards/tabs** on non-customer dims.
3. **`KPISection.getActivityStatus` copy** — "Active buyer" / "At risk" wording is customer-specific but renders valid data for non-customer dims. Rename deferred.
4. **`useExport.ts` CSV dimension/entity context line** — deferred clarity improvement.
5. **Contacts scope cache** — if measured latency justifies it later, add `contacts_scope:{dim}:{buildEntitySetHash(ids)}` with the pre-built hash helper.

---

## 11. Rollout & Sequencing

### Build order (critical to avoid Railway TS failures)

1. **Foundation** (no behavior change, safe to land first):
   - `cache-keys.ts` + `constants.ts` — new `CacheEntity` values, `buildFilterHash` signature, `buildEntitySetHash`.
   - `shared/types/dashboard.ts` — new types, extended `FetchAllFilters`, dimension-label constants.
   - `entity-subset-filter.ts` — add `scopeOrders`; existing `filterOrdersByEntityIds` preserved for back-compat.
   - `customer-filter.ts` — add `filterOrdersByItemCriteria`.

2. **Master data**:
   - `priority-queries.ts` — new `fetchX` functions + `STATDES='Active'` on vendors.
   - `warm-cache.ts` — warm 5 new caches in parallel with rate-limit delay.

3. **Backend integration**:
   - `data-aggregator.ts` + `order-transforms.ts` — extract transforms (pure refactor, no semantic change).
   - `kpi-aggregator.ts` — inline-extract 2 private helpers (pure refactor).
   - `dashboard.ts` — drop customer-only guard, remove entity_detail write, call `scopeOrders`.
   - `entities.ts` + `entity-list-builder.ts` — master-data-first flow; delete `entity-stub-builder.ts`.
   - `contacts.ts` — dimension-aware resolution.
   - `fetch-all.ts` — accept new filters; apply item predicates.

4. **Client integration**:
   - Shared types flow through.
   - `utils/filter-types.ts` — new filter fields + label maps.
   - Hooks updated.
   - Components updated (bottom-up: shared types → hooks → components).

Each step independently testable. Each must pass pre-deploy checks before the next lands. No feature flag; instead, incremental safe-by-default changes.

### Pre-deploy checks (blocking, from CLAUDE.md)

- `cd client && npx tsc -b --noEmit` passes
- `cd server && npx tsc --noEmit` passes
- `cd server && npx vitest run` — all tests pass (63 existing + ~18 new)
- `cd client && npx vite build` — bundle under 500KB gzip
- No `any` types introduced
- Every modified file under 300 LOC
- No secrets in source

---

## 12. Integration Contracts (per CLAUDE.md)

- **Every exported function imported somewhere** — `scopeOrders` wired into `dashboard.ts`, `fetch-all.ts`, `contacts.ts`; each new `fetchX` wired into `warm-cache.ts`.
- **State flows end-to-end** — `dimension` propagates from `DimensionToggles` → `useDashboardState` → `useDashboardData` / `useContacts` / `useReport` → URL param → route handler → scope resolver → aggregator.
- **Aggregation utils actually called** — `entity-list-builder` imported by `entities.ts`; `order-transforms` by `data-aggregator.ts`.
- **Default values match across files** — `FetchAllFilters` defaults match between shared Zod schema, server route, and client URL builder. `DIMENSION_SINGULAR_LABELS` / `DIMENSION_PLURAL_LABELS` single-source in `shared/types/dashboard.ts`.
- **ARIA semantics** — Contacts tab always rendered for every dimension; `aria-hidden` never applied based on dimension.

---

## 13. Karpathy Sanity Check

- **Every change traces to a user requirement** — yes; the "Out of scope" section lists four items deferred because they don't trace cleanly.
- **No speculative abstractions** — `entity-scope.ts` dropped; reused existing `entity-subset-filter.ts`. `master-data.ts` wrapper dropped. `kpi-breakdowns.ts` / `fetch-all-filters.ts` / `product-mix-aggregator.ts` / `ctype:all` / `contacts_scope` all dropped.
- **No error handling for impossible scenarios** — 80%-join-ratio CI test dropped; replaced with runtime log line.
- **Surgical changes to adjacent code** — `order-transforms.ts` extraction is forced by the 300-LOC rule, not speculative cleanup. `KPISection.getActivityStatus` copy left alone (deferred).
- **Assumptions surfaced** — brand case-sensitivity mitigation listed. `computeMonthlyRevenue` + `computeSparklines` TOTPRICE dependency surfaced and handled by pre-filter normalization. Build-order dependency (cache-keys before warm-cache) called out to prevent Railway TS failures.
