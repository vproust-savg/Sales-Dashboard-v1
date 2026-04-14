# Report 2 & View Consolidated 2 — Design Spec

**Date:** 2026-04-14
**Status:** Draft (awaiting review)
**Authors:** Claude Code (for Victor Proust)

---

## 1. Context

The existing **Report** (left-panel `AllEntityEntry` button) and **View Consolidated** (`SelectionBar` button) features do not work reliably in production. The user has tried to fix them multiple times (the latest attempt, `done/2026-04-14-view-consolidated-fix.md`, landed today but still doesn't resolve the issue). Rather than keep debugging, the user wants to **rebuild both features from scratch as parallel v2 implementations** placed directly below the existing buttons. The broken v1 buttons stay in place during the transition — both versions coexist.

Individual entity views work correctly — when a user clicks a customer, the right panel renders the dashboard with KPIs, charts, and tables as expected. The bugs are in the client-side orchestration that stitches together multi-entity aggregation, the SSE streaming state, and the display-selection logic. The server-side data pipeline (Priority ERP fetching, Redis caching, aggregation math) is proven and reused as-is.

**Dashboard embedding:** The dashboard runs inside an Airtable Omni iframe. React state is lost whenever the user navigates away in Airtable and returns — but Redis-cached data survives. The v2 design must leverage this asymmetry: detect cached data on mount and render instantly instead of forcing a re-fetch.

---

## 2. Goals

1. Add a **"Report 2"** button below the existing Report button that opens a filter modal, shows a progress bar during fetch, and renders a consolidated dashboard.
2. Add a **"View Consolidated 2"** button below the existing View Consolidated button that opens a confirmation modal, shows a progress bar, and renders a consolidated dashboard for the user-checked entities.
3. Reuse the existing Priority ERP data pipeline and Redis cache layer — no new heavy endpoints.
4. Display consolidated data with per-customer identity preserved where it matters:
   - Orders tab gets a `Customer` column
   - Contacts tab gets a `Customer` column
   - Expanded KPI / chart modals get a toggle between aggregated and per-customer table views
5. Optimize cache usage so a single Report 2 fetch serves all 6 dimensions (customer, zone, vendor, brand, product type, product) without re-fetching from Priority.
6. Be resilient to Airtable iframe reloads — server-cached data is detectable on mount and triggers "data ready" UI instantly.
7. Leave all broken v1 code untouched. v1 and v2 coexist. v1 removal is a separate future task.

## 3. Non-Goals

- Fixing the v1 Report / View Consolidated bugs
- Removing the v1 buttons
- Export of per-customer breakdown tables (export reuses the existing aggregated CSV flow)
- Per-customer breakdown in the Items Explorer main page (only available in the expanded Items modal)
- Quarter-over-quarter comparison in per-customer tables (only year-over-year)
- Parallel per-entity fetching as a fallback when raw cache is cold (future optimization; for now View Consolidated 2 requires Report 2 data)
- Modifying `shared/` types or server aggregation in ways that would break existing v1 consumers — all type changes use optional fields

---

## 4. User Flows

### 4.1 Report 2 Flow

```
Left panel
┌────────────────────────────────────┐
│ Dimension toggles                  │
│ Search box                         │
│ Filter/Sort toolbar                │
├────────────────────────────────────┤
│ [Report]        (v1, untouched)    │
│ [Report 2]      ← NEW              │
│ ── entity list ──                  │
│ Customer 1                         │
│ Customer 2                         │
│ ...                                │
└────────────────────────────────────┘
```

1. User clicks **Report 2**
2. `Report2FilterModal` opens:
   - Title: "Please select"
   - Icon: gold filter glyph (matches user's screenshot)
   - Fields: **Sales Rep** (multi-select), **Zone** (multi-select), **Customer Type** (multi-select) — all default to "All"
   - Helper text: "Fetching data for N customers. Estimated 4–7 minutes." (N computed from current entity list)
   - Buttons: **Cancel** | **Start**
3. User clicks **Start**
4. `Report2ProgressModal` replaces the filter modal:
   - Title: "Loading All Data"
   - Subtitle: "Fetching order data from Priority ERP…"
   - Phase 1: "Phase 1 of 2 — Fetching orders" with live progress bar and `N rows / Y%`
   - Phase 2: "Phase 2 — Computing metrics" with a waiting state until complete
5. SSE connection opens to `GET /api/sales/fetch-all?groupBy=X&period=Y&agentName=...&zone=...&customerType=...`
6. Server streams `progress` events → modal updates progress bar
7. Server emits `complete` event with full `DashboardPayload`
8. Modal closes. Right panel renders the consolidated dashboard with `ConsolidatedHeader`.

### 4.2 View Consolidated 2 Flow

1. User searches "disney" in the entity list
2. User checks 3 Disney accounts using the circular checkboxes → `selectedIds = {D1, D2, D3}`
3. `SelectionBar` slides up at the bottom of the entity list showing:
   - Left: `3 selected`
   - Right: `[Clear] [View Consolidated] (v1, untouched)`
   - Right: `[View Consolidated 2]` — **NEW**, on a second row below the first button
4. User clicks **View Consolidated 2**
5. `Consolidated2ConfirmModal` opens:
   - Title: "Confirm View Consolidated"
   - Body: "Fetching data for 3 selected entities" + entity names listed
   - Buttons: **Cancel** | **Start**
6. User clicks **Start**
7. Client calls `GET /api/sales/dashboard?entityIds=D1,D2,D3&groupBy=X&period=Y`
8. **Fast path** (raw cache exists): server filters cached raw orders → returns payload (<1 s). Confirmation modal shows a brief "Loading…" then closes.
9. **Slow path** (no raw cache): server returns HTTP 422 → modal shows a clear error: "This requires running Report 2 first to load data. [Go to Report 2]". A one-click button takes the user back to Report 2.
10. On success, right panel renders consolidated dashboard with `ConsolidatedHeader: "3 selected customers"`.

### 4.3 Per-Customer Toggle Flow (expanded modals)

Main page renders lean aggregated cards. When the user clicks a card to expand it:

1. KPI modal opens via existing `useModal()` (reuse `ModalProvider`)
2. Top of the modal shows a `PerCustomerToggle` (two-state switch) with labels **Aggregated** (default) and **Per Customer**
3. **Aggregated** view: identical to today's modal content
4. **Per Customer** view: sortable table with columns `Customer | Value | YoY %` — rows come from the `entities[]` array of the consolidated payload
5. Toggle state is local to the modal (resets each time the modal opens)
6. Same toggle pattern applies to: Hero Revenue modal, each of the 5 KPI card modals, Product Mix modals, Best Sellers modal, Items Explorer expanded view

---

## 5. Display Design

### 5.1 ConsolidatedHeader

Replaces `DetailHeader` when in consolidated/report mode.

```
┌──────────────────────────────────────────────────────────┐
│ Report: 47 Customers                   [Period ▼] [Export]│
│ Filters: Rep=John Doe, Zone=East                          │
└──────────────────────────────────────────────────────────┘
```

- **Report 2 mode**: `Report: {entityCount} {dimensionLabel}` (e.g., "Report: 47 Customers")
- **View Consolidated 2 mode**: `Consolidated: {entityCount} {dimensionLabel}` (e.g., "Consolidated: 7 Customers")
- Subtitle lists active filters with human-readable labels; omitted if no filters applied
- Right side: identical to existing DetailHeader (PeriodSelector + Export button)

### 5.2 Main Page — Aggregated View

| Section | In Consolidated Mode |
|---------|----------------------|
| Hero Revenue card | Aggregated total revenue, aggregated YoY bar chart, aggregated sub-items |
| 5 KPI cards + Last Order | Aggregated totals |
| Product Mix Carousel (5 donuts) | Aggregated across all entities |
| Best Sellers (top 25) | Aggregated across all entities |
| Orders tab | **Adds `Customer` column** between Date and Order Number |
| Items Explorer | No customer column (SKU-level aggregation) |
| Contacts tab | **Adds `Customer` column** as first column |

### 5.3 Expanded Modals — Per-Customer Toggle

All expanded card and chart modals get the toggle when in consolidated mode. When aggregated, modal content is identical to today. When per-customer:

| Modal | Per-Customer Table Columns |
|-------|--------------------------|
| Hero Revenue | Customer / Revenue / YoY % |
| Orders KPI | Customer / Orders / YoY % |
| Avg. Order | Customer / Avg Order / YoY % |
| Margin % | Customer / Margin % / YoY % |
| Margin $ | Customer / Margin $ / YoY % |
| Frequency | Customer / Frequency / YoY % |
| Last Order | Customer / Last Order Date / Status (color dot) |
| Product Mix (each of 5) | Customer / Top Category / % of Revenue |
| Best Sellers | Customer / Top SKU / Revenue from that SKU |
| Items (expanded) | Customer / SKU / Revenue / Units |

All tables sortable. Default sort: Revenue descending (or the relevant primary metric).

---

## 6. Server-Side Design

### 6.1 Type extensions (`shared/types/dashboard.ts`)

```typescript
export interface OrderRow {
  date: string;
  orderNumber: string;
  customerName?: string;   // NEW — populated only in consolidated mode
  itemCount: number;
  amount: number;
  marginPercent: number;
  marginAmount: number;
  status: 'Open' | 'Closed' | 'Partially Filled';
  items: OrderLineItem[];
}

export interface FlatItem {
  name: string;
  sku: string;
  customerName?: string;   // NEW — populated only when per-customer view requested
  value: number;
  // ... rest unchanged
}

export interface DashboardPayload {
  entities: EntityListItem[];
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: FlatItem[];
  yearsAvailable: string[];

  // NEW — populated only in consolidated mode
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
  perEntityMonthlyRevenue?: Record<string, MonthlyRevenue[]>;
}
```

All new fields are **optional** so existing v1 code paths are unaffected.

### 6.2 Aggregator extension (`server/src/services/data-aggregator.ts`)

```typescript
interface AggregateOptions {
  preserveEntityIdentity?: boolean;  // if true, populate customerName on rows
  customers?: RawCustomer[];          // CUSTNAME → CUSTDES lookup
  dimension?: Dimension;              // for perEntity* breakdowns
}

export function aggregateOrders(
  currentOrders: RawOrder[],
  prevOrders: RawOrder[],
  period: string,
  opts?: AggregateOptions,
): AggregateResult {
  // ... existing logic ...

  if (opts?.preserveEntityIdentity && opts?.customers) {
    const custMap = new Map(opts.customers.map(c => [c.CUSTNAME, c.CUSTDES]));
    // Populate OrderRow.customerName during buildOrderRows
    // Populate FlatItem.customerName during buildFlatItems (for per-customer mode)
  }

  if (opts?.dimension) {
    // Compute perEntityProductMixes, perEntityTopSellers, perEntityMonthlyRevenue
    // by grouping orders by dimension key, then running existing computeProductMix,
    // computeTopSellers, computeMonthlyRevenue on each group
  }

  return result;
}
```

### 6.3 Cache key change (`server/src/routes/fetch-all.ts`, `server/src/routes/dashboard.ts`)

**Before:**
```
orders_raw:{period}:{groupBy}:{filterHash}
orders_raw_meta:{period}:{groupBy}:{filterHash}
```

**After:**
```
orders_raw:{period}:{filterHash}        ← dimension-agnostic
orders_raw_meta:{period}:{filterHash}   ← dimension-agnostic
```

**New additional key** for pre-aggregated payloads (so dimension switches skip re-aggregation too):
```
report2_payload:{period}:{filterHash}:{groupBy}   ← 1 hour TTL
```

### 6.4 New endpoint: `GET /api/sales/cache-status`

Purpose: Enable iframe-reload resilience without fetching data.

Query: `?period=ytd` (or a year string)

Response:
```json
{
  "raw": true,
  "lastFetchDate": "2026-04-14T08:23:00Z",
  "rowCount": 22431,
  "filterHashes": ["all", "zone=East", "agent=John"]
}
```

Reads Redis metadata only (`orders_raw_meta:*` keys). Zero Priority API calls. Under 50 ms response time.

### 6.5 Reused existing code (no changes)

- `server/src/services/priority-queries.ts` — `fetchOrders`, `fetchCustomers`
- `server/src/services/priority-instance.ts` — rate-limited Priority client
- `server/src/cache/cache-layer.ts` — `cachedFetch`
- `server/src/routes/fetch-all.ts:tryIncrementalRefresh` — same-day cache + UDATE-based incremental refresh
- `server/src/services/dimension-grouper.ts` — `groupByDimension`
- `server/src/services/customer-filter.ts` — `filterOrdersByCustomerCriteria`

---

## 7. Client-Side Design

### 7.1 New hooks

**`client/src/hooks/useReport2.ts`**
```typescript
type Report2State = 'idle' | 'configuring' | 'fetching' | 'loaded' | 'error';

interface UseReport2 {
  state: Report2State;
  progress: SSEProgressEvent | null;
  payload: DashboardPayload | null;
  error: string | null;
  open: () => void;          // state: idle → configuring
  cancel: () => void;        // state: configuring → idle
  startReport: (filters: FetchAllFilters) => void;  // state: configuring → fetching
  abort: () => void;         // cancels in-flight SSE
  reset: () => void;         // state: * → idle (for switching back to single-entity)
}
```

**`client/src/hooks/useConsolidated2.ts`**
```typescript
type Consolidated2State = 'idle' | 'configuring' | 'fetching' | 'loaded' | 'needs-report-2' | 'error';

interface UseConsolidated2 {
  state: Consolidated2State;
  payload: DashboardPayload | null;
  error: string | null;
  open: (entityIds: string[]) => void;
  cancel: () => void;
  start: () => void;   // fires the fetch
  abort: () => void;
  reset: () => void;
}
```

**`client/src/hooks/useCacheStatus.ts`**
```typescript
interface UseCacheStatus {
  cached: boolean;
  lastFetchDate: string | null;
  rowCount: number;
  filterHashes: string[];
  isLoading: boolean;
}

// Internally uses useQuery({ queryKey: ['cache-status', period], staleTime: 60_000 })
```

### 7.2 New components

| Component | Path | Purpose |
|-----------|------|---------|
| `Report2Button` | `client/src/components/left-panel/Report2Button.tsx` | Second row below `AllEntityEntry` |
| `ViewConsolidated2Button` | `client/src/components/left-panel/ViewConsolidated2Button.tsx` | Second button row inside `SelectionBar` |
| `Report2FilterModal` | `client/src/components/shared/Report2FilterModal.tsx` | Filter picker matching user's screenshot |
| `Report2ProgressModal` | `client/src/components/shared/Report2ProgressModal.tsx` | Two-phase progress UI matching user's screenshot |
| `Consolidated2ConfirmModal` | `client/src/components/shared/Consolidated2ConfirmModal.tsx` | Confirmation + progress for View Consolidated 2 |
| `ConsolidatedHeader` | `client/src/components/right-panel/ConsolidatedHeader.tsx` | Entity count summary + filters |
| `PerCustomerToggle` | `client/src/components/right-panel/PerCustomerToggle.tsx` | Two-state switch inside expanded modals |
| `PerCustomerKPITable` | `client/src/components/right-panel/PerCustomerKPITable.tsx` | Sortable table: Customer / Value / YoY % |
| `PerCustomerChartTable` | `client/src/components/right-panel/PerCustomerChartTable.tsx` | For product mix + best sellers |
| `ConsolidatedOrdersTable` | `client/src/components/right-panel/ConsolidatedOrdersTable.tsx` | Wraps `OrdersTable`, injects Customer column |
| `ConsolidatedContactsTable` | `client/src/components/right-panel/ConsolidatedContactsTable.tsx` | Wraps `ContactsTable`, injects Customer column |

### 7.3 Wiring into existing layout

`DashboardLayout` gets two new optional props passed from `useDashboardState`:
```typescript
report2: UseReport2;
consolidated2: UseConsolidated2;
```

When either `report2.state === 'loaded'` or `consolidated2.state === 'loaded'`, the layout renders the consolidated display (ConsolidatedHeader + tables with customer columns + per-customer-toggle-capable modals) instead of the single-entity display. This is mutually exclusive with the v1 `isConsolidated` / `activeEntityId === '__ALL__'` paths — v2 takes priority when active.

### 7.4 NOT reused (broken v1 left in place)
- `useFetchAll.ts`, `useEntitySelection.ts` (`isConsolidated` flag) — stay as-is for v1 compatibility
- `FetchAllDialog.tsx`, `FetchAllProgress.tsx` — v1-only, superseded by Report2 counterparts
- `select-display-dashboard.ts` — v2 has its own selection logic

---

## 8. Cache Strategy

### 8.1 Goals
- One Report 2 fetch should serve all 6 dimensions without extra Priority calls
- View Consolidated 2 should be instant when raw orders are cached, regardless of which Report 2 run produced them
- Airtable iframe reloads should never trigger a full re-fetch when data exists
- Switching dimensions should never trigger a Priority fetch if raw orders are cached

### 8.2 Key changes

| Concern | Current | v2 |
|---------|---------|----|
| Raw orders cache key | `orders_raw:{period}:{groupBy}:{filterHash}` | `orders_raw:{period}:{filterHash}` (dimension-agnostic) |
| Payload cache | Exists only inside `entities_full` for entity lists | Add `report2_payload:{period}:{filterHash}:{groupBy}` (1 h TTL) |
| TTL on raw orders | 365 days | 365 days (unchanged) |
| Dimension switch | Re-fetches from Priority | Reads from raw cache, re-aggregates server-side (<1 s) |
| Iframe reload UX | Always shows "Not loaded" | `useCacheStatus` on mount detects cached data → Report 2 shows "Data ready" state |
| Cross-feature cache reuse | None | View Consolidated 2 filters from the same raw cache Report 2 populated |
| Incremental refresh | Today: reuses cache; next day: fetches new orders only | Keep this behavior — `tryIncrementalRefresh` is proven |

### 8.3 Memory and bandwidth
- Raw orders cache stays server-side only. Client never holds 22K orders in React state.
- Client holds only the aggregated `DashboardPayload` (~50 KB) and the per-entity breakdowns (small — ~N × 5 KB for N entities).
- Airtable iframe reload overhead: client re-fetches aggregated payload (~50 KB, <100 ms), not raw orders.

---

## 9. Priority ERP Considerations

(References: `priority-erp-api` skill — sections 2, 3, 6, 11, 13)

- **Read-only access** — per CLAUDE.md safety rule, Priority must NEVER be written to. All operations are GETs.
- **`IEEE754Compatible: true` header** — already configured in the existing Priority client.
- **Rate limit** — 100 calls/minute shared across all users. v2 must not increase Priority call volume. Goal: reduce calls via better caching.
- **`$expand` with nested `$select`** — already used by `fetchOrders` for `ORDERITEMS_SUBFORM`. v2 makes no changes.
- **Date format** — ISO 8601 with `Z` suffix, already correctly used.
- **Customer name resolution** — `RawOrder.CUSTNAME` is the ID (e.g., `C7826`). Friendly name is `CUSTDES` on the customers table. Use existing `customers:all` cached lookup.
- **Custom fields on `ORDERITEMS_SUBFORM`** — `Y_XXXX_5_ESH` naming convention. Used for vendor, brand, product type dimension grouping. No changes needed.
- **Incremental refresh via UDATE** — existing `tryIncrementalRefresh` uses `UDATE gt '...'` to fetch only changed orders. Reused as-is.
- **Test customer** — `C7826` for validation per CLAUDE.md.
- **No new Priority calls introduced by v2** — all new functionality is client-side UI + server-side re-aggregation from existing Redis cache.

---

## 10. Verification Plan

### 10.1 Automated checks (must all pass)

```bash
cd client && npx tsc -b --noEmit        # Client TS build
cd ../server && npx tsc --noEmit        # Server TS build
cd ../server && npx vitest run          # All server tests pass
cd ../client && npx vite build          # Bundle < 500 KB gzip
```

Plus:
- No `any` types: `grep -rn ": any\|as any" server/src/ client/src/`
- No file over 300 lines: `find {server,client}/src -name "*.ts*" | xargs wc -l | awk '$1 > 300'` returns empty
- Every new file has an intent block (`FILE:`, `PURPOSE:`, `USED BY:`, `EXPORTS:`)
- No hardcoded hex colors in new files — Tailwind tokens only
- No Priority writes: `grep -rn "POST\|PATCH\|PUT\|DELETE" server/src/services/priority-queries.ts` returns only comments

### 10.2 Manual UAT script (Disney customers, C7826 for single-entity regression)

1. Start both dev servers. Open `http://localhost:5173`.
2. **Report 2 happy path:**
   1. Click "Report 2" — filter modal opens.
   2. Select "All" for Sales Rep, Zone, Customer Type. Click Start.
   3. Progress modal shows Phase 1 rows increasing, Phase 2 "Computing metrics".
   4. Right panel renders with `ConsolidatedHeader: "Report: {N} Customers"`.
   5. Orders tab has Customer column populated with `CUSTDES` values.
   6. Contacts tab has Customer column.
   7. Click Hero Revenue card. Modal has `PerCustomerToggle`. Flip to "Per Customer" — table sorted by revenue descending.
3. **View Consolidated 2 happy path (warm cache):**
   1. In entity list search, type "disney".
   2. Check 3 entities using checkboxes.
   3. SelectionBar shows `View Consolidated 2` below the v1 button.
   4. Click it. Confirm modal shows "Fetching data for 3 selected entities" with entity names.
   5. Click Start. Dashboard renders within ~1 second (fast path from cache).
   6. Header shows "Consolidated: 3 Customers".
4. **View Consolidated 2 cold cache path:**
   1. Clear Redis (or start with empty cache).
   2. Check entities. Click View Consolidated 2. Click Start.
   3. Verify modal shows "This requires running Report 2 first…" with a button to go to Report 2.
5. **Cross-dimension cache reuse:**
   1. After Report 2 has loaded on `customer` dimension, switch dimension to `vendor`.
   2. Verify no loading spinner beyond 1 second (re-aggregation only).
   3. Network tab: only `/api/sales/entities?groupBy=vendor` and `/api/sales/dashboard?*` hits — no `/api/sales/fetch-all`, no Priority-bound calls.
6. **Iframe reload resilience:**
   1. With Report 2 loaded, hard-refresh the page (Cmd+R).
   2. `useCacheStatus` fires on mount.
   3. Report 2 button displays "Data ready — click to view" (instead of "Not loaded").
   4. Click it → consolidated dashboard renders without a new fetch.
7. **v1 coexistence regression:**
   1. Click the v1 Report button (original AllEntityEntry). Verify it still behaves as before (even if broken) — does not interfere with v2 state.
   2. Check some entities and click v1 View Consolidated. Verify no v2 modals open.
8. **Single-entity regression (C7826):**
   1. Click customer C7826 in the entity list.
   2. Verify right panel renders dashboard with single-customer data.
   3. No Customer column in Orders tab (single-entity mode).
   4. KPI modals have NO per-customer toggle (only consolidated mode shows it).

### 10.3 Performance budget
- Report 2 cold fetch: 4–7 minutes (unchanged from v1, limited by Priority API)
- Report 2 warm cache (same day): <2 seconds (incremental refresh) or instant (cache hit)
- View Consolidated 2 with warm raw cache: <1 second
- Dimension switch with raw cache: <1 second (re-aggregation only)
- Iframe reload with cached data: <500 ms to "Data ready" state

---

## 11. Open Questions

All design questions from brainstorming are resolved. No open questions remaining.

---

## 12. Next Steps

After this spec is approved:
1. Invoke `writing-plans` skill → produce phased implementation plan under `docs/plans/`
2. Invoke `writing-evals` skill → produce evaluation criteria under `docs/evals/`
3. Begin Phase 1 (server foundation) implementation

No code is written until all three documents (spec + plan + evals) are approved.
