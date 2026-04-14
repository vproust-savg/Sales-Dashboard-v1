# Entity List Optimization + View Consolidated Fix

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Frontend + Backend + Shared Types

## Overview

The left-panel entity list currently shows **$0 / "0 orders"** for all 1,850 customers because the server warm-cache either hasn't run or has expired. This is misleading. Additionally, the "View Consolidated" feature is broken — it tries to aggregate data from a single-entity dashboard response that doesn't contain metrics for the other selected entities.

**Solution:** 8 features that make the entity list lightweight by default, add an "All {Dimension}" entry with SSE-powered full data loading, server-side pre-fetch filters, a properly working View Consolidated, and an incremental cache strategy with 365-day TTL + manual refresh.

---

## Feature 1: Lightweight Entity List (Default State)

### 1A. Null Metrics Instead of Zero

The `/api/sales/entities` endpoint returns entities with null metric fields instead of zero.

**Shared type change** (`shared/types/dashboard.ts`):
```typescript
// BEFORE: revenue: number;
// AFTER:
revenue: number | null;
orderCount: number | null;
avgOrder: number | null;
marginPercent: number | null;
marginAmount: number | null;
```

**Backend change** (`server/src/routes/entities.ts`):
- `buildCustomerStubs()` returns `revenue: null`, `orderCount: null`, `avgOrder: null`, `marginPercent: null`, `marginAmount: null` instead of 0
- `meta2` set to `null` (was `'0 orders'`)
- Check for `entities_full` cache key first — if found, return enriched entities with real metrics

**Non-customer dimensions** (zone, vendor, brand, product_type, product):
- Currently return `[]` on cache miss — behavior unchanged
- After "All" fetch, return enriched entities with metrics from `entities_full` cache

### 1B. Hidden Metrics in Entity Rows

**Component** (`client/src/components/left-panel/EntityListItem.tsx`):
- When `entity.revenue === null`: hide the revenue display entirely (no `$0`)
- When `entity.meta2 === null`: hide the meta2 line (no "0 orders")
- Row height adjusts naturally — name + meta1 only

### 1C. Hidden Count in Header

**Component** (`client/src/components/left-panel/EntityList.tsx`):
- When metrics not loaded: header shows just `"CUSTOMERS"` (no parenthetical count)
- When metrics loaded: header shows `"CUSTOMERS (1247 OF 1850)"` — entities with orders / total

**New prop:** `dataLoaded: boolean` — controls count visibility

### 1D. Default Sort Change

**Hook** (`client/src/hooks/useSort.ts`):
- Change `INITIAL_STATE` from `{ field: 'revenue', direction: 'desc' }` to `{ field: 'id', direction: 'asc' }` (Customer ID ascending)
- Add `'id'` to the `SortField` union type if not already present

### 1E. Disabled Metric Sorts and Filters

**Sort options disabled until data loaded:**
- `revenue`, `orders`, `avgOrder`, `marginPercent`, `frequency` — grayed out
- Tooltip on hover: "Load all data first"
- `name` and `lastOrder` remain available (metadata present in lightweight list)

**Filter fields disabled until data loaded:**
- Revenue, Orders, Avg Order, Margin %, Margin $, Frequency — grayed out in dropdown
- **Metadata-based filters still work:** Name (text search), Rep, Zone, Customer Type, Last Order Date

**Implementation:**
- `client/src/components/left-panel/FilterSortToolbar.tsx` — Accept `dataLoaded` prop, pass to sort dropdown
- Sort dropdown: render disabled options with `opacity-50 cursor-not-allowed` and title tooltip
- Filter field dropdown: exclude metric fields when `!dataLoaded`

### 1F. Auto-Select First Customer

On initial load, auto-select the first entity in the list (as today). Do NOT select "All {Dimension}" by default.

---

## Feature 2: "All {Dimension}" Pinned Entry

### 2A. Component Design

**New file:** `client/src/components/left-panel/AllEntityEntry.tsx`

Pinned above the scrollable entity list, always visible regardless of scroll position.

**Three visual states:**

| State | Σ icon | Text | Right side |
|-------|--------|------|------------|
| Not loaded | Gold-subtle bg, gold-primary text | "All Customers" / "Click to load all data" | "Not loaded" badge (gold-subtle bg, gold text, 10px font) |
| Loading | Gold-subtle bg, animated pulse | "All Customers" / "Loading..." | Spinner |
| Loaded + active | Gold-primary bg, white text | "All Customers" / "1,247 with orders" | `$4.2M` + `8,430 orders` |
| Loaded + inactive | Gold-subtle bg, gold-primary text | "All Customers" / "1,247 with orders" | `$4.2M` + `8,430 orders` |

### 2B. Styling

- Container: `padding: 12px 16px`, border-bottom `2px solid var(--color-gold-subtle)`
- Σ icon: 32px circle, `font-size: 14px`, `font-weight: 700`
- Active state: 3px gold left border (same pattern as EntityListItem)
- Framer Motion: hover scale 1.005 (subtle), state transitions fade 150ms

### 2C. Dimension Labels

Uses existing `DIMENSION_CONFIG[dim].allLabel`:
- "All Customers", "All Zones", "All Vendors", "All Brands", "All Product Types", "All Products"

### 2D. Click Behavior

- **Not loaded:** Opens FetchAllDialog (Feature 3)
- **Loaded:** Selects "All" as active entity — right panel shows aggregate KPIs/charts/tables
- **Loading:** No action (click absorbed)

### 2E. Integration

Rendered inside `EntityList.tsx` above the `role="listbox"` div, not inside it (it's not a selectable list item in the ARIA sense — it's a separate control).

---

## Feature 3: Confirmation Dialog with Server-Side Filters

### 3A. Dialog Layout

**New file:** `client/src/components/shared/FetchAllDialog.tsx`

```
┌──────────────────────────────────────┐
│         ⏳ (hourglass icon)          │
│                                      │
│    Load All Customer Data?           │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Sales Rep        [All     ▼] │    │
│  │ Zone             [All     ▼] │    │
│  │ Customer Type    [All     ▼] │    │
│  └──────────────────────────────┘    │
│                                      │
│  This will fetch order data from      │
│  Priority ERP. Estimated 4–7         │
│  minutes.                            │
│                                      │
│      [Cancel]    [Yes, Load All]     │
└──────────────────────────────────────┘
```

### 3B. Filter Dropdowns Per Dimension

| Dimension | Dropdown 1 | Dropdown 2 | Dropdown 3 |
|-----------|-----------|-----------|-----------|
| Customer | Sales Rep | Zone | Customer Type |
| Zone | Sales Rep | Customer Type | — |
| Vendor | Zone | Customer Type | — |
| Brand | Zone | Customer Type | — |
| Prod. Type | Zone | Customer Type | — |
| Product | Zone | Customer Type | — |

### 3C. Dropdown Values

Extracted from the lightweight entity list metadata:
- **Sales Rep:** Unique values of `entity.rep` field across all entities, sorted alphabetically
- **Zone:** Unique values of `entity.zone` field
- **Customer Type:** Unique values of `entity.customerType` field
- Default option: "All" (no filter applied)

### 3D. Dynamic Count and Time Estimate

When a filter is selected, the dialog dynamically updates:
- **Customer count:** Filter the lightweight entity list by selected criteria, show count
- **Time estimate:** `count < 200` → "~1 minute", `count < 500` → "~2 minutes", `count < 1000` → "~3–4 minutes", `count >= 1000` → "4–7 minutes"

### 3E. OData Filter Mapping

Filters map to Priority OData `$filter` clauses on the ORDERS query:
- Sales Rep: `AGENTNAME eq '{value}'`
- Zone: Filter customers first by zone, then fetch orders for those customers
- Customer Type: Filter customers first by type, then fetch orders for those customers

**Implementation:** Server receives filter params as query strings: `?agentName=Sarah+M.&zone=North&customerType=Bakery`

### 3F. Styling

- Modal: `max-width: 400px`, `border-radius: var(--radius-3xl)` (16px), `padding: 28px 32px`
- Backdrop: `bg-black/30 backdrop-blur-sm`
- Hourglass icon: 48px circle, amber/gold background
- Dropdowns: full-width, `border-radius: var(--radius-base)`, gold-subtle border
- Cancel button: `bg-[var(--color-gold-subtle)]`, `color: var(--color-text-secondary)`
- Confirm button: `bg-[var(--color-dark)]`, white text
- Framer Motion: backdrop `opacity 0→1` 200ms, card `scale 0.95→1 + opacity 0→1` 250ms

---

## Feature 4: SSE Progress Stream

### 4A. Backend Endpoint

**New file:** `server/src/routes/fetch-all.ts`

**Endpoint:** `GET /api/sales/fetch-all`

**Query params:**
| Param | Required | Description |
|-------|---------|-------------|
| `groupBy` | Yes | Dimension: customer, zone, vendor, brand, product_type, product |
| `period` | Yes | Period: 'ytd' or year string |
| `agentName` | No | Filter by sales rep name |
| `zone` | No | Filter by zone name |
| `customerType` | No | Filter by customer type name |

**SSE response headers:**
```
Content-Type: text/event-stream
Connection: keep-alive
Cache-Control: no-cache
X-Accel-Buffering: no
```

**Event types:**

```
event: progress
data: {"phase":"fetching","rowsFetched":15200,"estimatedTotal":40000}

event: progress
data: {"phase":"processing","message":"Computing metrics for 320 customers..."}

event: complete
data: <full DashboardPayload JSON>

event: error
data: {"message":"Priority API timeout after 3 minutes"}
```

### 4B. Server Processing Pipeline

1. Validate query params with Zod
2. Set SSE headers, send initial `progress` event
3. Build OData `$filter` from filter params
4. Call `fetchOrders()` with `onProgress` callback — each page triggers a `progress` SSE event
5. Call `fetchOrders()` for previous period (lighter schema, for YoY trends)
6. Call `fetchCustomers()` (likely cached)
7. Run `groupByDimension()` → `EntityListItem[]` with full metrics
8. Run `aggregateOrders()` → full KPIs, charts, tables
9. Cache result: `entities_full:{period}:{dimension}:{filterHash}` and `entity_detail:{period}:{dimension}:ALL:{filterHash}`
10. Send `complete` event with full `DashboardPayload`
11. Close connection

### 4C. Cache Key Strategy

Cache key includes filter params to avoid cross-contamination:
```
dashboard:entities_full:ytd:customer:agentName=Sarah+M.&zone=North
```

**TTLs:** 365 days for both YTD and historical years. See Feature 8 for incremental refresh strategy.

### 4D. Progress Callback

**Modified:** `server/src/services/priority-client.ts` → `fetchAllPages()`

Add optional `onProgress` callback:
```typescript
interface FetchOptions {
  onProgress?: (rowsFetched: number, estimatedTotal: number) => void;
}
```

Called after each page of results is fetched. Estimated total = `rowsFetched + PAGE_SIZE` when more pages remain, or `rowsFetched` when done.

### 4E. Frontend Progress Card

**New file:** `client/src/components/right-panel/FetchAllProgress.tsx`

Replaces right panel content during loading. Shows:
- Title: "Loading All Customers"
- Subtitle: "Fetching order data from Priority ERP..."
- Phase indicator: "Phase 1 of 2 — Fetching orders" (gold text)
- Progress bar: gold gradient fill on gold-subtle background, 6px height, rounded
- Stats: "15,200 of ~40,000 rows" left, "38%" right
- Phase 2: "Computing metrics" — shown below, grayed out until Phase 1 completes

**Styling:**
- Card: same `bg-card`, `shadow-card`, `radius-3xl` as other right-panel cards
- Progress bar: `background: linear-gradient(90deg, var(--color-gold-primary), var(--color-gold-light))`
- Phase text: `var(--color-gold-primary)`, 12px, font-weight 500

### 4F. Frontend Hook

**New file:** `client/src/hooks/useFetchAll.ts`

**State:**
```typescript
interface FetchAllState {
  loadStateMap: Map<string, EntityListLoadState>;  // key = `${dimension}:${period}`
  progress: { phase: string; rowsFetched: number; estimatedTotal: number } | null;
  error: string | null;
}

type EntityListLoadState = 'not-loaded' | 'loading' | 'loaded' | 'error';
```

**Actions:**
- `startFetchAll(filters: FetchAllFilters)` — Opens EventSource, updates progress, handles completion
- `getLoadState(dimension, period)` — Returns load state for current dimension+period
- `abortFetch()` — Closes EventSource (called on dimension switch or unmount)

**On completion:**
- Set load state to `'loaded'`
- Invalidate TanStack Query `['entities', groupBy, period]` — triggers refetch, now returns cached full data
- Store the `DashboardPayload` for "All" aggregate view

---

## Feature 5: Loaded State

### 5A. Entities Endpoint Cache Check

**Modified:** `server/src/routes/entities.ts`

On entity list request:
1. Check `entities_full:{period}:{dimension}:{filterHash}` cache → if found, return enriched entities with metrics
2. Fall back to lightweight stubs with null metrics

### 5B. Header Count

When `dataLoaded === true`:
- Header: `"CUSTOMERS (1247 OF 1850)"` — entities with non-null revenue > 0 / total entities
- `(X OF Y)` uses the enriched entity list to count entities with orders

### 5C. Value Fade-In Animation

When entity metrics transition from `null` to populated values:
- Revenue: fade-in + slight slide-left (opacity 0→1, x: 4→0, 200ms)
- Meta2 (order count): same animation
- Staggered: revenue first, meta2 50ms later

### 5D. Sort/Filter Unlock

When `dataLoaded` transitions to `true`:
- All sort options become clickable
- All filter fields become available
- Sort does NOT auto-change — stays on whatever the user set (likely ID ascending)

### 5E. "All" Aggregate Right Panel

When "All {Dimension}" is the active selection and data is loaded:
- Right panel shows the full `DashboardPayload` from the SSE completion event
- This includes aggregate KPIs, monthly revenue chart, product mix donuts, top sellers, orders table, items table — all computed across ALL entities (or filtered subset)
- Detail header shows the `allLabel` text (e.g., "All Customers") instead of an entity name

---

## Feature 6: Dimension Switching

### 6A. Independent Load State

Each `${dimension}:${period}` combination has its own load state:
- Switching from loaded `customer:ytd` to unloaded `zone:ytd` shows fresh unloaded state
- Switching back to `customer:ytd` shows loaded state (values still cached)

### 6B. SSE Abort on Dimension Switch

If SSE is in-flight when user switches dimensions:
- `EventSource.close()` called immediately
- Progress state reset to null
- Load state for the abandoned dimension stays as `'not-loaded'`

### 6C. Period Switch Behavior

Switching period (e.g., YTD → 2025) resets load state for that dimension:
- `customer:ytd` may be loaded, but `customer:2025` starts as `'not-loaded'`
- User must explicitly load each period

---

## Feature 7: View Consolidated Fix

### 7A. Root Cause

`aggregateForConsolidated(dashboard, selectedIds)` operates on `dashboard` which is the `DashboardPayload` for the **single active entity** only. It doesn't have revenue/order data for the other selected entities. The function filters `dashboard.entities` by `selectedIds`, but that entities array only reflects the active entity's data.

### 7B. Fix: Disable Until Loaded

The "View Consolidated" button in `SelectionBar.tsx` is **disabled** when `dataLoaded === false`:
- Visual: `opacity-50 cursor-not-allowed`
- Tooltip: "Load all data first to view consolidated"
- Click does nothing

### 7C. Fix: Server-Side Aggregation for Subset

When "View Consolidated" is clicked (data is loaded):

1. Client sends: `GET /api/sales/dashboard?groupBy=customer&period=ytd&entityIds=C001,C002,C003`
2. Server parses `entityIds` (comma-separated string → array)
3. Server retrieves orders from Redis cache (already populated by "All" fetch)
4. Server filters orders to only those matching the entity IDs
5. Server runs `groupByDimension()` + `aggregateOrders()` for the subset
6. Returns full `DashboardPayload` with accurate KPIs, charts, tables for just those entities

**Backend change** (`server/src/routes/dashboard.ts`):
- Accept `entityIds` query param as alternative to `entityId`
- When `entityIds` present: filter cached orders by customer list, aggregate for subset
- Validate with Zod: `entityIds` is a comma-separated string of IDs

**Frontend change** (`client/src/hooks/useDashboardState.ts`):
- When `isConsolidated && selectedIds.length > 0`: call dashboard endpoint with `entityIds` param
- Replace client-side `aggregateForConsolidated()` with server response

**Cleanup:**
- `client/src/utils/aggregation.ts` — Remove or simplify `aggregateForConsolidated()` (server does the real work now)

---

## Feature 8: Incremental Fetch + Long-Lived Cache + Refresh Button

### 8A. Cache Architecture

Instead of short-lived caches that require expensive full re-fetches, use a **365-day TTL** with **incremental refresh**.

**What gets cached in Redis:**

| Cache key | Content | TTL |
|-----------|---------|-----|
| `dashboard:orders_raw:ytd:customer:{filterHash}` | Raw order rows (RawOrder[]) from Priority | 365 days |
| `dashboard:orders_raw:ytd:customer:{filterHash}:meta` | Metadata: `{ lastFetchDate, rowCount, filterParams }` | 365 days |
| `dashboard:entities_full:ytd:customer:{filterHash}` | Aggregated EntityListItem[] with metrics | 365 days |
| `dashboard:entity_detail:ytd:customer:ALL:{filterHash}` | Full DashboardPayload for "All" view | 365 days |

**Historical years (2025, 2024...):** Data is frozen — once fetched, cache is valid until TTL expires. No incremental refresh needed.

**YTD (current year):** Data grows daily — incremental refresh fetches only new/updated orders.

### 8B. Incremental Refresh Logic

When the user clicks "All {Dimension}" and cached data exists:

1. **Check cache metadata:** Read `lastFetchDate` from `orders_raw:...:meta`
2. **If cache exists and `lastFetchDate` is today:** Use cached data as-is (instant)
3. **If cache exists and `lastFetchDate` is older:** Incremental fetch:
   - Fetch orders with `$filter=CURDATE ge '{lastFetchDate minus 1 day}'` (overlap by 1 day to catch late entries)
   - Merge with cached raw orders, deduplicate by `ORDNAME` (keep newer version)
   - Re-aggregate metrics from merged dataset
   - Update cache + metadata with new `lastFetchDate`
   - **Time: ~10-30 seconds** (vs 4-7 minutes for full fetch)
4. **If no cache exists:** Full fetch (4-7 minutes) — same as Feature 4

**SSE progress events for incremental fetch:**
```
event: progress
data: {"phase":"incremental","message":"Fetching orders since Mar 30...","rowsFetched":320}

event: progress
data: {"phase":"merging","message":"Merging 320 new orders with 38,000 cached..."}

event: complete
data: <full DashboardPayload JSON>
```

### 8C. Deduplication Strategy

Orders are deduplicated by `ORDNAME` (unique order number):
- Build a `Map<string, RawOrder>` from cached orders
- Overlay new orders (same ORDNAME → new version wins, handles modifications)
- Convert back to array for aggregation

This handles:
- **New orders:** Added to the map
- **Modified orders:** Overwritten (e.g., status changed from Open → Closed)
- **Canceled orders:** Overwritten with canceled status → excluded by `EXCLUDED_STATUSES` filter

### 8D. Refresh Button

A manual refresh button appears on the "All {Dimension}" entry **when data is loaded**:

**Visual:** Small refresh icon (↻) on the right side of the AllEntityEntry, next to the revenue display
- Color: `var(--color-text-muted)` idle → `var(--color-gold-primary)` on hover
- Size: 16px icon, 28px clickable area
- Tooltip: "Refresh data (force full re-fetch)"

**Behavior:**
- Click → **bypasses incremental logic** — deletes cached raw orders, triggers full SSE fetch
- Shows the same confirmation dialog (Feature 3) but with modified message: "Re-fetch all order data from Priority ERP? This will replace cached data. Estimated 4–7 minutes."
- Useful when: orders were manually modified in Priority, or user suspects stale data

**Implementation:**
- `useFetchAll.ts`: Add `forceRefresh: boolean` param to `startFetchAll()`
- `server/src/routes/fetch-all.ts`: Accept `refresh=true` query param → delete existing cache before fetching
- `AllEntityEntry.tsx`: Render refresh icon when `loadState === 'loaded'`

### 8E. Cache Warm Behavior Change

The existing `server/src/services/warm-cache.ts` currently pre-fetches ALL orders on server startup. With the new architecture:

**Option:** Keep warm-cache but change its behavior:
- On startup, check if `orders_raw` cache exists and is recent (< 24h old)
- If yes: skip warm (data is still fresh from last user visit)
- If no: run incremental fetch (if old cache exists) or skip entirely (let user trigger via "All")
- This prevents the server startup from being blocked by a 4-7 minute fetch

### 8F. Redis Storage Estimate

| Data | Size per dimension+period | Notes |
|------|--------------------------|-------|
| Raw orders (YTD, ~40K rows) | ~10-30MB | Includes expanded ORDERITEMS |
| Aggregated entities | ~500KB | EntityListItem[] with metrics |
| DashboardPayload | ~500KB-1MB | KPIs, charts, tables |
| **Total per dimension+period** | **~12-32MB** | |
| **Total for 3 years × 6 dimensions** | **~200-600MB** | Upper bound (unlikely all loaded) |

**Realistic usage:** Most users load 1-2 dimensions for YTD only → ~15-35MB Redis total.

**Files:**
- `server/src/routes/fetch-all.ts` — Incremental fetch logic, `refresh` param
- `server/src/cache/cache-keys.ts` — Add `orders_raw` and `orders_raw_meta` cache entities
- `server/src/config/constants.ts` — Add 365-day TTL for raw orders
- `server/src/services/warm-cache.ts` — Modified to check existing cache before warming
- `client/src/components/left-panel/AllEntityEntry.tsx` — Refresh button icon
- `client/src/hooks/useFetchAll.ts` — `forceRefresh` param, incremental vs full logic

---

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `client/src/components/left-panel/AllEntityEntry.tsx` | Pinned "All {Dimension}" entry above entity list |
| `client/src/components/shared/FetchAllDialog.tsx` | Confirmation modal with filter dropdowns |
| `client/src/components/right-panel/FetchAllProgress.tsx` | SSE progress card (replaces right panel during load) |
| `client/src/hooks/useFetchAll.ts` | EventSource lifecycle, per-dimension load state, filter params |
| `server/src/routes/fetch-all.ts` | SSE endpoint for full data fetch with progress |

### Modified Files

| File | Change |
|------|--------|
| `shared/types/dashboard.ts` | Make 5 EntityListItem metrics nullable, add `FetchAllFilters`, `EntityListLoadState`, SSE event types |
| `server/src/routes/entities.ts` | Null metrics in stubs, check `entities_full` cache first |
| `server/src/routes/dashboard.ts` | Accept `entityIds` query param for consolidated view |
| `server/src/services/priority-client.ts` | Add `onProgress` callback to `fetchAllPages()` |
| `server/src/cache/cache-keys.ts` | Add `entities_full`, `orders_raw`, `orders_raw_meta` cache entity types |
| `server/src/config/constants.ts` | Add 365-day TTLs for `entities_full`, `orders_raw`, `orders_raw_meta` |
| `server/src/services/warm-cache.ts` | Check existing cache before warming on startup |
| `client/src/components/left-panel/EntityList.tsx` | Render AllEntityEntry, conditional header count |
| `client/src/components/left-panel/EntityListItem.tsx` | Hide metrics when null, fade-in animation |
| `client/src/components/left-panel/LeftPanel.tsx` | Pass `dataLoaded` and fetch-all props down |
| `client/src/components/left-panel/SelectionBar.tsx` | Disable "View Consolidated" when `!dataLoaded` |
| `client/src/components/left-panel/FilterSortToolbar.tsx` | Disable metric sorts/filters when `!dataLoaded` |
| `client/src/hooks/useSort.ts` | Default to `{ field: 'id', direction: 'asc' }`, add `'id'` to SortField |
| `client/src/hooks/useDashboardState.ts` | Wire `useFetchAll`, pass `dataLoaded`, consolidated `entityIds` logic |
| `client/src/layouts/DashboardLayout.tsx` | Render FetchAllProgress when loading, pass new props to panels |
| `client/src/utils/aggregation.ts` | Remove/simplify `aggregateForConsolidated()` |
| `client/src/mock-data.ts` | Update entities with null metrics, add loaded-state mock |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| **Vite proxy SSE buffering** | Add `X-Accel-Buffering: no` header. Test in dev mode. Vite 5+ should pass through SSE correctly with proper headers. |
| **Express 5 SSE compatibility** | Test `res.write()` + `res.flush()`. If `flush()` unavailable, use `res.flushHeaders()` before first write. |
| **TypeScript null-safety cascade** | Making 5 fields nullable touches ~14 consumer files. Track with `npx tsc --noEmit` after each task. |
| **Race condition: dimension switch during SSE** | `useFetchAll` closes EventSource on dimension change. Load state stays `'not-loaded'` for abandoned fetch. |
| **Consolidated fetch performance** | Dashboard endpoint with `entityIds` must use cached orders (from "All" fetch), not re-fetch from Priority. Check cache key resolution. |
| **Large SSE payload on `complete`** | DashboardPayload for 1850 customers could be 1-5MB. EventSource handles this fine (single message). Consider compression if needed. |
| **Redis storage for raw orders** | ~10-30MB per dimension+period for raw orders. Monitor Upstash usage. Realistic usage ~15-35MB (1-2 dimensions, YTD only). |
| **Order deduplication correctness** | Deduplicate by ORDNAME. Verify that modified orders (status changes, amount corrections) are properly overwritten in the merge. |
| **1-day overlap in incremental fetch** | Fetching `CURDATE >= lastFetchDate - 1 day` catches late entries but means some overlap. Deduplication handles this. |

---

## Verification Checklist

1. `cd server && npx tsc --noEmit` — no type errors
2. `cd client && npx tsc -b --noEmit` — no type errors
3. `cd server && npx vitest run` — all tests pass
4. `cd client && npx vite build` — client bundle builds, <500KB gzip
5. **Default state:** Entity list shows customer names + metadata only. No `$0`, no "0 orders". Header says "CUSTOMERS". Sort defaults to ID ascending. Metadata filters (zone, rep, type) work.
6. **Disabled sorts:** Revenue, Orders, Avg Order, Margin, Frequency sort options are grayed out with tooltip.
7. **"All Customers" entry:** Visible pinned at top of list with Σ icon. Shows "Not loaded" badge.
8. **Click "All Customers":** Confirmation dialog appears with filter dropdowns (Rep, Zone, Customer Type). Selecting a filter updates customer count estimate.
9. **Confirm fetch:** Right panel replaces with progress card. Progress bar fills as rows are fetched. Phase 2 "Computing metrics" appears briefly.
10. **Loaded state:** Entity rows show revenue + order counts (fade-in animation). Header shows "CUSTOMERS (X OF Y)". All sort/filter options enabled. "All Customers" entry shows total revenue + orders.
11. **"All Customers" active:** Right panel shows aggregate KPIs, monthly chart, product mix, top sellers for all customers.
12. **View Consolidated:** Select 3 customers → "View Consolidated" button is enabled → click → right panel shows accurate aggregated data for those 3 only (KPIs, charts, tables).
13. **Dimension switch:** Switch to Zone → fresh unloaded state with "All Zones". Switch back to Customers → values still visible (cached).
14. **Period switch:** Switch YTD → 2025 → fresh unloaded state. Load state per-period is independent.
15. **Pre-fetch filters:** Load "All Customers" with "Zone = North" → only North zone customers have metrics. Other customers remain null.
16. **Incremental refresh:** After initial "All" load, close and reopen dashboard. Click "All Customers" again → incremental fetch completes in ~10-30 seconds (not 4-7 minutes). New orders from today appear.
17. **Refresh button:** After data is loaded, refresh icon (↻) visible on "All Customers" entry. Click → confirmation → full re-fetch from scratch. Cached data replaced.
18. **Cache persistence:** Load "All Customers". Close browser. Reopen tomorrow → data still cached. Click "All" → incremental refresh (fast).
