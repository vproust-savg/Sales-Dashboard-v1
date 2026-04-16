# Dimension Parity & Master-Data Design

**Date:** 2026-04-16
**Status:** Draft — awaiting user review
**Scope:** Bring zone, vendor, brand, product_type, and product dimensions to full feature parity with the customer dimension, using master-data-first fast loading and an in-memory `EntityScope` resolver over the existing universal order cache.

---

## 1. Motivation

Today only the **customer** dimension is fully wired. The other five dimension toggles render, but:

- **Left panel is empty for non-customer dimensions** (`0 of 0`) because `entity-stub-builder.ts` depends on the warm `orders_ytd` cache, which may not be hot.
- **Detail view silently ignores `entityId`** for non-customer dimensions — `dashboard.ts:40` only applies an entity filter when `groupBy === 'customer'`, so clicking a Vendor returns the same payload as "all vendors".
- **Contacts tab is hidden** for non-customer dimensions, losing user-visible functionality.
- **Multi-select / Report / View Consolidated** only aggregates across customers.
- **KPI revenue math** uses order-level `TOTPRICE` — wrong for item-based dimensions, where an order may contain items from many vendors/brands.

Two user requirements anchor this design:

1. **Full parity this round** — all 6 dimensions must support single-select detail, multi-select consolidated view, Report export, and dimension-aware filters. Per-dimension refinements (e.g., vendor-contacts tab with a new Priority form, per-customer breakdown cards) are deferred.
2. **Fast load, master-data-first** — the left-panel entity list must render instantly, independent of the orders cache being warm. Matches how Customers already works (1876 stubs from CUSTOMERS master data).

---

## 2. Dimension Semantics

The single source of truth for how each dimension behaves:

| Dimension | Entity id source | Entity name | `orderPredicate(o)` | `itemPredicate(i)` | `customerIds` source | KPI revenue |
|---|---|---|---|---|---|---|
| customer | `CUSTOMERS.CUSTNAME` | CUSTDES | `CUSTNAME ∈ ids` | `true` | `ids` directly | Σ TOTPRICE |
| zone | `DISTRLINES.ZONECODE` | ZONEDES | `custZoneMap[CUSTNAME] ∈ ids` | `true` | customers whose zone ∈ ids | Σ TOTPRICE |
| vendor | `SUPPLIERS.SUPNAME` | SUPDES | order has item with `Y_1159_5_ESH ∈ ids` | `Y_1159_5_ESH ∈ ids` | CUSTNAMEs of matching orders | Σ QPRICE (scoped items) |
| brand | `SPEC4VALUES.SPECVALUE` | SPECVALUE | order has item with `Y_9952_5_ESH ∈ ids` | `Y_9952_5_ESH ∈ ids` | CUSTNAMEs of matching orders | Σ QPRICE |
| product_type | FAMILY_LOG distinct `FTCODE` | FTNAME | order has item with `Y_3020_5_ESH ∈ ids` | `Y_3020_5_ESH ∈ ids` | CUSTNAMEs of matching orders | Σ QPRICE |
| product | `LOGPART.PARTNAME` (STATDES='In Use') | PARTDES | order has item with `PARTNAME ∈ ids` | `PARTNAME ∈ ids` | CUSTNAMEs of matching orders | Σ QPRICE |

**Key compatibility verified live** against the UAT Priority instance on 2026-04-16:
- `Y_1159_5_ESH` ("V8534") ↔ `SUPPLIERS.SUPNAME` ("V00001") — same V-prefix convention
- `Y_9952_5_ESH` ("ANTICA VALLE DOFANTA") ↔ `SPEC4VALUES.SPECVALUE` ("ACETUM") — uppercase brand name string
- `Y_3020_5_ESH`/`Y_3021_5_ESH` ("01"/"Culinary") ↔ `FAMILY_LOG.FTCODE`/`FTNAME` ("01"/"Culinary") — exact match

**Item-based vs. order-based revenue:** For customer and zone, order revenue (`TOTPRICE`) is the right KPI. For vendor/brand/product_type/product, the order may contain items from other entities; we must sum `QPRICE` across items matching `itemPredicate`. `EntityScope.isItemBased` flags this branch in the KPI aggregator.

---

## 3. Fast-Load Architecture — Two Independent Tracks

Left panel must render in under 200ms. Metrics come after.

### Track 1 — Entity list (fast, master-data-only)

```
GET /api/sales/entities?groupBy=<dim>
  ├─► Read master cache for <dim>  (always present — warm-cached at startup)
  ├─► Build EntityListItem[] with metrics: null
  └─► Return ~300ms incl. network

Left panel renders full entity list immediately.
```

### Track 2 — Metrics enrichment (async)

```
GET /api/sales/entities?groupBy=<dim>&enrich=true&period=ytd
  ├─► Read orders_ytd (if warm) OR trigger warm cache
  ├─► group orders by <dim> via existing groupers → metrics map
  ├─► Merge metrics into master-data stubs by id
  └─► Return same shape with revenue/orders/margin/prevYear populated

Left panel smoothly fills in numbers as they arrive.
```

### Client pattern (TanStack Query)

```ts
// Fast: master-data only, cache for 24h
const entitiesQuery = useEntityList(dimension);

// Slow: metrics, cache per period, run in parallel after entities resolve
const metricsQuery = useEntityMetrics(dimension, period, {
  enabled: !!entitiesQuery.data,
});

// Merge in render: for each entity, attach metrics if present
const merged = useMemo(() =>
  mergeMetrics(entitiesQuery.data, metricsQuery.data), [entitiesQuery.data, metricsQuery.data]);
```

Entities without metrics show a subtle skeleton on the numeric column — consistent with the current cold-cache customer behaviour.

---

## 4. Master-Data Cache Layer

Seven cache keys, all warm-cached at server startup, all read by the fast-path entity list before any orders are touched. TTL 24h (master data rarely changes).

| Cache key | Priority entity | Filter | Select | Purpose |
|---|---|---|---|---|
| `customers:all` | CUSTOMERS | none | existing (`CUSTOMER_SELECT`) | Customer dim list + CUSTNAME→zone/type joins |
| `zones:all` | DISTRLINES | none | `DISTRLINECODE,DISTRLINEDES,ZONECODE,ZONEDES` | Zone dim list |
| `vendors:all` | SUPPLIERS | `STATDES eq 'Active'` | `SUPNAME,SUPDES,STATDES` | Vendor dim list (~90% of all, excludes inactive) |
| `brands:all` | SPEC4VALUES | none | `SPECVALUE` | Brand dim list |
| `product_types:all` | FAMILY_LOG | none (deduped client-side) | `FTCODE,FTNAME` | Prod. Type dim list (distinct FTCODE pairs) |
| `products:all` | LOGPART | `STATDES eq 'In Use'` | `PARTNAME,PARTDES,FAMILYNAME,Y_9952_5_ESH,STATDES` | Product dim list |
| `ctype:all` | CTYPE | none | `CTYPECODE,CTYPENAME` | Customer Type filter dropdown values |

### New `priority-queries.ts` exports

```ts
export async function fetchZones(client): Promise<RawZone[]>              // DISTRLINES  (exists, keep)
export async function fetchVendors(client): Promise<RawVendor[]>          // SUPPLIERS w/ STATDES='Active' (update existing)
export async function fetchBrands(client): Promise<RawBrand[]>            // SPEC4VALUES
export async function fetchProductTypes(client): Promise<RawProductType[]> // FAMILY_LOG → dedup FTCODE
export async function fetchProducts(client): Promise<RawProduct[]>         // LOGPART w/ STATDES='In Use'
export async function fetchCustomerTypes(client): Promise<RawCustomerType[]> // CTYPE
```

### Warm-cache startup changes

`warm-cache.ts` currently warms `orders_ytd` + `customers`. Extend to warm all seven master caches in parallel:

```ts
await Promise.all([
  cachedFetch('customers:all', 24h, fetchCustomers),
  cachedFetch('zones:all',     24h, fetchZones),
  cachedFetch('vendors:all',   24h, fetchVendors),
  cachedFetch('brands:all',    24h, fetchBrands),
  cachedFetch('product_types:all', 24h, fetchProductTypes),
  cachedFetch('products:all',  24h, fetchProducts),
  cachedFetch('ctype:all',     24h, fetchCustomerTypes),
  cachedFetch('orders_ytd',    6h,  fetchOrders),
]);
```

**Rate-limit budget:** 7 parallel calls, all small (under 5K rows each except LOGPART). Well under Priority's 10-concurrent / 100-per-minute limits.

---

## 5. EntityScope — the in-memory filter resolver

New file: `server/src/services/entity-scope.ts` (~150 lines).

```ts
export interface EntityScope {
  dimension: Dimension;
  entityIds: string[];
  isItemBased: boolean;
  orderPredicate: (o: RawOrder) => boolean;
  itemPredicate: (i: RawOrderItem) => boolean;
  customerIds: Set<string>;
}

export function resolveEntityScope(
  dimension: Dimension,
  entityIds: string[],
  orders: RawOrder[],
  customers: RawCustomer[],
): EntityScope
```

Behavior per dimension follows Section 2. Empty `entityIds` returns a "no-op" scope (all predicates true, `customerIds` = all CUSTNAMEs in orders). `customerIds` is resolved once by applying `orderPredicate` to the order set and collecting `CUSTNAME` values.

The universal order cache is unchanged — no new Redis keys for entity-scoped data. Filtering is purely in-memory and typically runs in under 20ms for a 5000-order YTD set.

---

## 6. File-by-File Changes

### New files

| File | Purpose | ~Lines |
|---|---|---|
| `server/src/services/entity-scope.ts` | Scope resolver for all dimensions | 150 |
| `server/src/services/entity-list-builder.ts` | Master-data-first list builder + metrics merger (replaces `entity-stub-builder.ts`) | 120 |
| `server/src/services/master-data.ts` | Cached accessors for all 7 master entities | 80 |
| `server/src/services/kpi-breakdowns.ts` | Extracted from `kpi-aggregator.ts` to stay under 300 LOC | 150 |
| `server/src/services/product-mix-aggregator.ts` | Extracted from `data-aggregator.ts` | 120 |
| `server/src/services/fetch-all-filters.ts` | Extracted filter-building helpers from `fetch-all.ts` | 100 |

### Modified server files

| File | Change |
|---|---|
| `server/src/routes/dashboard.ts` | Drop `groupBy === 'customer'` special-case. Always read universal `orders_ytd`. Build `EntityScope` from request. Accept both `entityId` (single) and `entityIds` (array). Remove `entity_detail` cache key. |
| `server/src/routes/entities.ts` | Split into two-track: fast path uses `entity-list-builder.buildEntityList()` from master cache; `enrich=true` triggers metrics merge. |
| `server/src/routes/fetch-all.ts` | Accept `dimension` + `entityIds` + extended `FetchAllFilters`. Build scope and filter in-memory. Extract filter-building into `fetch-all-filters.ts`. |
| `server/src/routes/contacts.ts` | Accept `dimension` + `entityId(s)`. For non-customer dims, resolve `scope.customerIds` then batch-fetch via `CUSTOMERS?$filter=CUSTNAME in (...) &$expand=CUSTPERSONNEL_SUBFORM`. Cache result per `contacts_scope:{dim}:{hash}` for 15min. |
| `server/src/services/data-aggregator.ts` | Accept optional `EntityScope`. Filter orders by `orderPredicate`; for item-based dims, narrow `ORDERITEMS_SUBFORM` via `itemPredicate`. |
| `server/src/services/kpi-aggregator.ts` | Branch: when `scope.isItemBased`, `totalRevenue = Σ QPRICE` over filtered items (not `Σ TOTPRICE`). Margin math unchanged. Extract breakdown computation to `kpi-breakdowns.ts`. |
| `server/src/services/dimension-grouper.ts` | Add `groupByVendor/Brand/ProductType/Product` variants that operate on filtered items (used only by the metrics-enrichment path). Existing groupers kept for Customers/Zone. |
| `server/src/services/priority-queries.ts` | Add `fetchBrands`, `fetchProductTypes`, `fetchProducts`, `fetchCustomerTypes`. Update `fetchVendors` to filter `STATDES='Active'`. |
| `server/src/services/warm-cache.ts` | Warm all 7 master caches in parallel alongside `orders_ytd`. |
| `server/src/cache/cache-keys.ts` | Register 6 new cache keys + their TTLs. |
| `server/src/services/customer-filter.ts` | Add item-level predicate evaluation for new `FetchAllFilters` fields. |

### Modified client files

| File | Change |
|---|---|
| `client/src/hooks/useEntityList.ts` (new, replaces inline logic) | Fast query: master-data-only list |
| `client/src/hooks/useEntityMetrics.ts` (new) | Slow query: metrics-enriched list, merged in UI |
| `client/src/hooks/useDashboardData.ts` | Pass `entityIds` (array) to dashboard endpoint |
| `client/src/hooks/useContacts.ts` | Accept `dimension` + `entityId(s)`. Remove `activeDimension === 'customer'` gate. |
| `client/src/hooks/useReport.ts` | Pass `dimension` + extended filters to SSE endpoint |
| `client/src/hooks/useDashboardState.ts` | Feed new query hooks |
| `client/src/utils/filter-types.ts` | Add `brand` / `productType` / `countryOfOrigin` / `foodServiceRetail` to `FilterField`. Extend `DIMENSION_FILTER_FIELDS` per dim. |
| `client/src/components/right-panel/DetailHeader.tsx` | Dimension-aware empty state (`All Vendors`, `All Brands`, etc.). |
| `client/src/components/right-panel/TabsSection.tsx` | Contacts tab always rendered for every dimension. |

### Shared

| File | Change |
|---|---|
| `shared/types/dashboard.ts` | Extend `FetchAllFilters` with item-attribute fields; add master-data types (`RawBrand`, `RawProductType`, `RawProduct`, `RawCustomerType`); add `EntityScope` interface. |

### Size-budget compliance

Three files currently near or over the 300-LOC rule. The extractions above restore compliance:
- `data-aggregator.ts` (366 → ~250) via `product-mix-aggregator.ts`
- `kpi-aggregator.ts` (314 → ~180) via `kpi-breakdowns.ts`
- `fetch-all.ts` (307 → ~220) via `fetch-all-filters.ts`

---

## 7. API Contracts

### `GET /api/sales/entities`

| Param | Values | Default | Behavior |
|---|---|---|---|
| `groupBy` | `customer`\|`zone`\|`vendor`\|`brand`\|`product_type`\|`product` | `customer` | Dimension |
| `enrich` | `true`\|`false` | `false` | If false: master-data only. If true: merged with orders-derived metrics. |
| `period` | `ytd`\|year | `ytd` | Only relevant when `enrich=true`. |

Response `data.entities: EntityListItem[]`. When `enrich=false`, numeric fields are `null`.

### `GET /api/sales/dashboard`

| Param | Values | Default |
|---|---|---|
| `groupBy` | dimension | `customer` |
| `entityId` | string | optional — single-entity detail |
| `entityIds` | comma-sep string | optional — multi-entity consolidated |
| `period` | `ytd`\|year | `ytd` |

Server normalizes `entityId` → `[entityId]` internally. Back-compat: existing `?groupBy=customer&entityId=C7826` URLs unchanged.

### `GET /api/sales/contacts`

| Param | Values | Behavior |
|---|---|---|
| `dimension` | dimension (default `customer`) | Selects resolver |
| `entityId` | string | Single entity |
| `entityIds` | comma-sep string | Multi entity (consolidated) |

For `dimension=customer`: unchanged (single `CUSTPERSONNEL_SUBFORM` fetch).
For other dimensions: resolve `scope.customerIds`, batched fetch, dedupe by email, each `Contact` carries `customerName`.

### `POST /api/sales/fetch-all` (SSE)

Body:

```ts
{
  dimension: Dimension,
  entityIds?: string[],
  period: string,
  filters: FetchAllFilters,  // extended
}
```

Back-compat: existing customer-dim requests continue to work without `dimension`.

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

Customer-level filters (`agentName`, `zone`, `customerType`) and item-level filters (`brand`, `productFamily`, `countryOfOrigin`, `foodServiceRetail`) are AND-combined into `scope.orderPredicate` / `scope.itemPredicate`.

---

## 8. Error Handling

1. **Master-data cache miss or Priority unreachable** — Entities endpoint returns a 503 with `{ error: 'master-data-unavailable', dimension }`. Client shows a soft error banner: "Unable to load {dimension} list. Retrying…" TanStack Query auto-retries with exponential backoff.
2. **`orders_ytd` cache miss** — Metrics enrichment returns entities with `metrics: null` and a `meta.enrichment: 'pending'` flag. Client keeps skeleton cells; warm cache fills Redis and next query refreshes.
3. **Unknown `entityId` in request** — `resolveEntityScope` returns a scope that matches zero orders; dashboard returns an empty payload (zero KPIs, empty lists). Client displays a "No data for this {dimension}" state.
4. **Priority key format drift** — If `SPEC4VALUES.SPECVALUE` diverges from `Y_9952_5_ESH` (or the equivalent for vendor/product_type), the metrics-merge step silently leaves entities with `null` metrics (master-data list renders fine; numbers just never fill in). Mitigation: Vitest test asserts at least 80% of cached-order brand/vendor/type keys join to their master cache; a `join-ratio` log line is emitted on every enrichment call so drift is visible in Railway logs.
5. **Contacts batch size** — For large `customerIds` (500+), batch the `CUSTOMERS?$filter=CUSTNAME in (...)` request at 50 CUSTNAMEs per call to stay under OData filter-length limits.
6. **SSE abort on fetch-all** — Existing abort signal pattern preserved; scope-building is pure and bails out immediately on signal.

---

## 9. Testing Plan

### Unit (Vitest, server/)

- `entity-scope.test.ts` — per-dimension scope resolution: predicates match expected orders/items for a fixture; empty `entityIds` returns no-op scope.
- `entity-list-builder.test.ts` — master-data-only list shape; metrics-merged shape; missing metrics produces nulls.
- `kpi-aggregator.test.ts` — item-based KPI revenue uses `QPRICE` (existing tests extended).
- `data-aggregator.test.ts` — scoped aggregation filters orders + items correctly.
- `dashboard.test.ts` — `entityId` for each dimension produces scoped response; `entityIds` multi-select works; missing entity returns zero payload.
- `contacts.test.ts` — dimension=customer unchanged; non-customer resolves customer-id set then batch-fetches.

### Integration (live Priority, manual harness)

1. Warm master caches from cold — verify seven keys populated under 10s.
2. Warm `orders_ytd` — verify metrics merge into all six dimensions.
3. Per-dimension smoke: click an entity from each dimension — verify KPI cards, YoY, product mix, orders tab, items tab, contacts tab.
4. Multi-select on Brand dim — select 3 brands, verify consolidated dashboard.
5. Report export on Vendor dim with `brand` filter — verify SSE completes and export contains only scoped rows.

### Regression

- Existing customer-dim URL `?groupBy=customer&entityId=C7826` still returns identical payload.
- Existing customer-dim consolidated request unchanged.
- Airtable embed at production URL still renders customer list and detail view without change.

---

## 10. Out of Scope (future rounds)

1. **Vendor-contacts tab** on Vendor dim using a new Priority form. User has indicated a new Priority ERP form will be granted; will design in a separate spec when credentials are provided.
2. **Per-customer breakdown cards/tabs** on non-customer dims (e.g., Brand dim showing a table of customers driving brand revenue). Deferred — requires new per-entity aggregation tables.
3. **Zone master-data refinement** — sticking with DISTRLINES; if analytics later need a pure ZONES entity we'll revisit.
4. **Country of Origin / Food Service vs Retail master data** — filter values are derived from cached orders for now; promote to master-data-backed dropdowns only if UX demands completeness.

---

## 11. Rollout & Verification

1. Land master-data layer and warm-cache changes first. Verify cache keys exist in Redis before merging.
2. Land `EntityScope` + aggregator changes with feature flag `DASHBOARD_MULTI_DIM` (default off). Validate customer-dim regression.
3. Flip flag on staging Railway deploy. Click through all dimensions.
4. Update `learnings/` with any Priority quirks discovered.
5. Production cutover — flag on, monitor cache-status endpoint, verify no TTL storms.

### Pre-deploy checks (blocking)

- `cd client && npx tsc -b --noEmit` — passes
- `cd server && npx tsc --noEmit` — passes
- `cd server && npx vitest run` — all tests pass (63 existing + ~15 new)
- `cd client && npx vite build` — bundle under 500KB gzip
- No `any` types introduced; all files under 300 LOC

---

## 12. Integration Contracts (per CLAUDE.md)

- **Every exported function imported somewhere** — `resolveEntityScope` wired into `dashboard.ts`, `fetch-all.ts`, `contacts.ts`; each new `fetchX` wired into `warm-cache.ts` + `master-data.ts`.
- **State flows end-to-end** — `dimension` propagates from `DimensionToggles` → `useDashboardState` → `useContacts`/`useDashboardData`/`useReport` → URL param → route handler → scope resolver → aggregator.
- **Aggregation utils actually called** — `entity-list-builder` is imported by `entities.ts`; `kpi-breakdowns` by `kpi-aggregator.ts`; `product-mix-aggregator` by `data-aggregator.ts`; `fetch-all-filters` by `fetch-all.ts`.
- **Default values match across files** — `FetchAllFilters` default values consistent between client and server Zod schemas.
- **ARIA semantics** — Contacts tab always rendered; `aria-hidden` never applied based on dimension.
