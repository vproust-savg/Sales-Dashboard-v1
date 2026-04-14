# Entity List Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the entity list lightweight by default, add "All {Dimension}" with SSE-powered full data loading, incremental caching (365 days), server-side filters, and fix View Consolidated.

**Architecture:** Two-phase loading — Stage 1 returns entity stubs with null metrics (instant). Stage 2 is an on-demand SSE endpoint that fetches all orders from Priority, caches raw + aggregated data in Redis (365-day TTL), and streams progress to the client. Incremental refresh fetches only new orders since last visit. View Consolidated uses server-side re-aggregation from cached orders.

**Tech Stack:** Express + TypeScript (SSE via native `res.write()`), React 19, TanStack Query v5, Framer Motion, Upstash Redis, Zod, native EventSource API.

**Spec:** `docs/specs/2026-03-31-entity-list-optimization.md`

---

## Execution Requirements

### Test-Driven Development (TDD)

Every backend task follows red-green-refactor:
1. **Red:** Write the failing test FIRST — run it, confirm it fails with the expected error
2. **Green:** Write the minimal implementation to make the test pass
3. **Refactor:** Clean up, then commit

Test files and cases to write BEFORE implementation:

**`server/tests/routes/entities.test.ts`** (Task 3):
- "returns null metrics in customer stubs when no entities_full cache" — Assert: `revenue === null`, `orderCount === null`, `meta2 === null`
- "returns enriched entities when entities_full cache exists" — Pre-populate Redis `entities_full:ytd:customer`, assert: `revenue === 5000`, `meta2 === '14 orders'`

**`server/tests/routes/fetch-all.test.ts`** (Task 5):
- "streams SSE progress events" — Mock fetchOrders, assert: receives `progress` with phase `'fetching'` then `complete` with valid DashboardPayload
- "uses incremental refresh when cache exists" — Pre-populate Redis `orders_raw` + `orders_raw_meta` (lastFetchDate = yesterday), assert: receives phase `'incremental'`, fetchOrders called with sinceDate filter
- "force refresh deletes cache and does full fetch" — Pre-populate Redis, call with `refresh=true`, assert: cache deleted, receives phase `'fetching'`
- "deduplicates orders by ORDNAME on merge" — Cached O1 at TOTPRICE=100, new O1 at TOTPRICE=200, assert: merged has single O1 at 200
- "applies agentName filter to OData query" — Call with `agentName=Sarah+M.`, assert: fetchOrders filter contains `AGENTNAME eq 'Sarah M.'`
- "sends error event on Priority API failure" — Mock fetchOrders to throw, assert: receives `error` event

**`server/tests/routes/dashboard-consolidated.test.ts`** (Task 6):
- "accepts entityIds param and filters cached orders" — Pre-populate Redis `orders_raw` with C001/C002/C003, call with `entityIds=C001,C002`, assert: KPIs reflect only those two
- "falls through to normal fetch when no cached orders" — Call with `entityIds=C001`, no cache, assert: standard fetchOrders path used

**`client/src/utils/__tests__/sort-engine.test.ts`** (Task 8):
- "sorts by ID ascending" — ids ['C003','C001','C002'], field='id', direction='asc', assert: ['C001','C002','C003']
- "null revenue sorts last (desc)" — [{revenue:5000},{revenue:null},{revenue:3000}], assert: [5000,3000,null]
- "null metrics don't crash sort engine" — All nullable metrics as null, sort by each field, assert: no errors

### Visual Review Checkpoints

After each frontend task that produces visible UI, **take a screenshot** via Chrome plugin (`mcp__Claude_in_Chrome__computer` → screenshot action) or preview MCP (`mcp__Claude_Preview__preview_screenshot`) and verify against the spec. Do NOT mark a task complete until visual output matches.

| After Task | What to Screenshot | What to Verify |
|-----------|-------------------|----------------|
| Task 9 | Left panel entity list | No `$0` anywhere, no "0 orders", header says "CUSTOMERS" only (no count), rows show name + zone/agent only |
| Task 10 | Left panel with AllEntityEntry | Σ icon in 32px circle pinned above list, "All Customers" / "Click to load all data", "Not loaded" badge right-aligned, first customer still has gold left border |
| Task 11 | Click "All Customers" → dialog | Backdrop blur (bg-black/30), hourglass icon, "Load All Customer Data?" title, 3 dropdowns (Sales Rep, Zone, Customer Type), "Estimated 4–7 minutes", Cancel + "Yes, Load All" buttons |
| Task 14 | Full flow: unloaded → dialog → progress → loaded | (1) Dialog opens on click, (2) progress card replaces right panel with gold progress bar + phase text, (3) after completion: rows show revenue + orders with fade-in animation, header shows "(X OF Y)", sort/filter metric options clickable, "All Customers" shows total $+orders, refresh ↻ icon visible |
| Task 15 | Select 3 customers → View Consolidated | "View Consolidated" button NOT grayed out, click shows right panel with KPIs/charts/tables for ONLY those 3 entities |

### Skills to Use During Execution

| Skill | When |
|-------|------|
| `/test-driven-development` | Before writing implementation code for Tasks 3, 5, 6, 8 |
| `/feature-dev:feature-dev` | For Tasks 10, 11, 12 (new component architecture) |
| `/frontend-design` | For Tasks 10, 11 (AllEntityEntry, FetchAllDialog visual design) |
| `/systematic-debugging` | When hitting any bug — diagnose root cause, don't guess |
| `/verification-before-completion` | Before marking any task complete — run tests + visual check |

---

## File Map

### New Files (5)

| File | Responsibility |
|------|---------------|
| `server/src/routes/fetch-all.ts` | SSE endpoint — full data fetch with progress, incremental refresh, filter params |
| `client/src/hooks/useFetchAll.ts` | EventSource lifecycle, per-dimension load state map, progress tracking |
| `client/src/components/left-panel/AllEntityEntry.tsx` | Pinned "All {Dimension}" entry with 4 visual states + refresh button |
| `client/src/components/shared/FetchAllDialog.tsx` | Confirmation modal with filter dropdowns + time estimate |
| `client/src/components/right-panel/FetchAllProgress.tsx` | Progress card replacing right panel during SSE fetch |

### Modified Files (17)

| File | Change |
|------|--------|
| `shared/types/dashboard.ts` | Make 5 EntityListItem metrics nullable, add `FetchAllFilters`, `EntityListLoadState`, `SSEProgressEvent` |
| `server/src/config/constants.ts` | Add `entities_full`, `orders_raw`, `orders_raw_meta` TTLs (365 days) |
| `server/src/cache/cache-keys.ts` | Add 3 new cache entity types |
| `server/src/services/priority-client.ts` | Add `onProgress` callback to `fetchAllPages()` |
| `server/src/routes/entities.ts` | Null metric stubs, check `entities_full` cache first |
| `server/src/routes/dashboard.ts` | Accept `entityIds` query param for consolidated |
| `server/src/services/warm-cache.ts` | Check existing cache before warming |
| `client/src/hooks/useSort.ts` | Add `'id'` to SortField, default to `{field:'id', direction:'asc'}` |
| `client/src/utils/sort-engine.ts` | Handle `'id'` sort field, handle nullable metrics |
| `client/src/utils/filter-types.ts` | Add `METRIC_FILTER_FIELDS` set for disable logic |
| `client/src/components/left-panel/EntityListItem.tsx` | Hide metrics when null, fade-in animation |
| `client/src/components/left-panel/EntityList.tsx` | Render AllEntityEntry, conditional header count |
| `client/src/components/left-panel/LeftPanel.tsx` | Pass `dataLoaded` and fetch-all props |
| `client/src/components/left-panel/SelectionBar.tsx` | Disable "View Consolidated" when `!dataLoaded` |
| `client/src/components/left-panel/FilterSortToolbar.tsx` | Disable metric sorts when `!dataLoaded` |
| `client/src/hooks/useDashboardState.ts` | Wire `useFetchAll`, consolidated `entityIds`, `dataLoaded` |
| `client/src/layouts/DashboardLayout.tsx` | Render FetchAllProgress, pass new props, sortActive fix |

---

## Task 1: Shared Types — Nullable Metrics + New Types

**Files:**
- Modify: `shared/types/dashboard.ts`

- [ ] **Step 1: Make EntityListItem metrics nullable**

In `shared/types/dashboard.ts`, change the 5 metric fields:

```typescript
// Lines 12-13: change from number to number | null
revenue: number | null;      // null when metrics not loaded
orderCount: number | null;   // null when metrics not loaded
// Lines 16-18: change from number to number | null
avgOrder: number | null;                // revenue / orderCount, null when not loaded
marginPercent: number | null;           // (totalProfit / totalRevenue) * 100
marginAmount: number | null;            // total profit in dollars
```

Also change `meta2` to allow null:
```typescript
meta2: string | null;        // Line 2 right (e.g., "22 orders"), null when not loaded
```

- [ ] **Step 2: Add new types at the end of the file**

Append before `DashboardPayload`:

```typescript
/** Load state for the "All {Dimension}" fetch — per dimension+period */
export type EntityListLoadState = 'not-loaded' | 'loading' | 'loaded' | 'error';

/** Filter params for the fetch-all dialog — narrows the server-side OData query */
export interface FetchAllFilters {
  agentName?: string;
  zone?: string;
  customerType?: string;
}

/** SSE progress events from GET /api/sales/fetch-all */
export type SSEProgressEvent =
  | { phase: 'fetching'; rowsFetched: number; estimatedTotal: number }
  | { phase: 'incremental'; message: string; rowsFetched: number }
  | { phase: 'merging'; message: string }
  | { phase: 'processing'; message: string };
```

- [ ] **Step 3: Verify types compile**

Run: `cd server && npx tsc --noEmit && cd ../client && npx tsc -b --noEmit`
Expected: Failures in ~14 files that reference `revenue`, `orderCount`, etc. as `number`. That's expected — Tasks 2-9 fix those.

- [ ] **Step 4: Commit**

```bash
git add shared/types/dashboard.ts
git commit -m "feat: make EntityListItem metrics nullable, add FetchAll types

Spec: Feature 1A, 4F — nullable metrics enable lightweight entity list
without misleading $0 values. New types support SSE fetch-all flow."
```

---

## Task 2: Backend — Cache Keys + Constants

**Files:**
- Modify: `server/src/cache/cache-keys.ts`
- Modify: `server/src/config/constants.ts`

- [ ] **Step 1: Add cache entity types**

In `server/src/cache/cache-keys.ts`, update the `CacheEntity` type:

```typescript
type CacheEntity = 'orders_ytd' | 'orders_year' | 'customers' | 'zones' | 'agents' | 'vendors' | 'contacts' | 'years_available' | 'entities_summary' | 'entity_detail' | 'entities_full' | 'orders_raw' | 'orders_raw_meta';
```

- [ ] **Step 2: Add TTLs**

In `server/src/config/constants.ts`, add to `CACHE_TTLS`:

```typescript
entities_full: 365 * 24 * 60 * 60,    // 365 days — enriched entity list with metrics
orders_raw: 365 * 24 * 60 * 60,       // 365 days — raw order rows for incremental refresh
orders_raw_meta: 365 * 24 * 60 * 60,  // 365 days — metadata (lastFetchDate, rowCount)
```

- [ ] **Step 3: Verify**

Run: `cd server && npx tsc --noEmit`
Expected: PASS (cache-keys and constants are leaf files with no consumers of the new types yet)

- [ ] **Step 4: Commit**

```bash
git add server/src/cache/cache-keys.ts server/src/config/constants.ts
git commit -m "feat: add cache keys and 365-day TTLs for fetch-all data

Spec: Feature 8A — long-lived cache for raw orders, aggregated entities,
and metadata supporting incremental refresh."
```

---

## Task 3: Backend — Entities Endpoint (Null Stubs + Cache Check)

**Files:**
- Modify: `server/src/routes/entities.ts`

- [ ] **Step 1: Update buildCustomerStubs to return null metrics**

Change `buildCustomerStubs` function:

```typescript
function buildCustomerStubs(customers: RawCustomer[]): EntityListItem[] {
  return customers.map(c => ({
    id: c.CUSTNAME,
    name: c.CUSTDES,
    meta1: [c.ZONEDES, c.AGENTNAME].filter(Boolean).join(' \u00B7 '),
    meta2: null,           // WHY: null signals "not loaded" — client hides this
    revenue: null,
    orderCount: null,
    avgOrder: null,
    marginPercent: null,
    marginAmount: null,
    frequency: null,
    lastOrderDate: null,
    rep: c.AGENTNAME || null,
    zone: c.ZONEDES || null,
    customerType: c.CTYPENAME || null,
  }));
}
```

- [ ] **Step 2: Add entities_full cache check before stubs fallback**

Update the `cachedFetch` call in the route handler. Before the existing `cachedFetch`, add:

```typescript
// WHY: Check for enriched entities first (populated by fetch-all endpoint).
// If found, return entities with real metrics instead of null stubs.
const fullKey = cacheKey('entities_full', period, groupBy);
const fullResult = await redis.get(fullKey);
if (fullResult !== null) {
  const envelope = typeof fullResult === 'string' ? JSON.parse(fullResult) : fullResult;
  const response: ApiResponse<{ entities: EntityListItem[]; yearsAvailable: string[] }> = {
    data: envelope.data,
    meta: {
      cached: true,
      cachedAt: envelope.cachedAt,
      period,
      dimension: groupBy,
      entityCount: envelope.data.entities.length,
    },
  };
  return res.json(response);
}
```

Add `import { redis } from '../cache/redis-client.js';` at the top.

- [ ] **Step 3: Verify**

Run: `cd server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/entities.ts
git commit -m "feat: entities endpoint returns null metrics, checks entities_full cache

Spec: Feature 1A, 5A — null stubs eliminate misleading \$0 values.
Cache check returns enriched entities when fetch-all has been run."
```

---

## Task 4: Backend — onProgress Callback in Priority Client

**Files:**
- Modify: `server/src/services/priority-client.ts`

- [ ] **Step 1: Add onProgress to PaginateOptions**

```typescript
interface PaginateOptions {
  select: string;
  filter?: string;
  orderby: string;
  expand?: string;
  pageSize?: number;
  cursorField?: string;
  onProgress?: (rowsFetched: number, estimatedTotal: number) => void;  // NEW
}
```

- [ ] **Step 2: Call onProgress in fetchAllPages inner loop**

After `allRecords.push(...batch);` (line 109), add:

```typescript
// WHY: Report progress after each batch for SSE streaming
if (opts.onProgress) {
  const hasMore = batch.length > 0 && batch.length % pageSize === 0 && batch.length >= pageSize;
  const estimated = hasMore ? allRecords.length + pageSize : allRecords.length;
  opts.onProgress(allRecords.length, estimated);
}
```

- [ ] **Step 3: Verify**

Run: `cd server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/services/priority-client.ts
git commit -m "feat: add onProgress callback to fetchAllPages for SSE streaming

Spec: Feature 4D — reports row count after each batch so the fetch-all
endpoint can stream progress to the client."
```

---

## Task 5: Backend — SSE Fetch-All Endpoint

**Files:**
- Create: `server/src/routes/fetch-all.ts`
- Modify: `server/src/index.ts` (register route)

This is the most complex new file. It handles full fetch, incremental refresh, filter params, SSE streaming, and caching.

- [ ] **Step 1: Create the SSE endpoint**

Create `server/src/routes/fetch-all.ts`:

```typescript
// FILE: server/src/routes/fetch-all.ts
// PURPOSE: SSE endpoint for full data fetch with progress — supports incremental refresh + filters
// USED BY: client/hooks/useFetchAll.ts via EventSource
// EXPORTS: fetchAllRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { priorityClient } from '../services/priority-instance.js';
import { fetchOrders, fetchCustomers } from '../services/priority-queries.js';
import type { RawOrder } from '../services/priority-queries.js';
import { aggregateOrders } from '../services/data-aggregator.js';
import { groupByDimension } from '../services/dimension-grouper.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { redis } from '../cache/redis-client.js';
import type { Dimension, DashboardPayload } from '@shared/types/dashboard';

const querySchema = z.object({
  groupBy: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).default('customer'),
  period: z.string().default('ytd'),
  agentName: z.string().optional(),
  zone: z.string().optional(),
  customerType: z.string().optional(),
  refresh: z.enum(['true', 'false']).optional(),
});

export const fetchAllRouter = Router();

fetchAllRouter.get('/fetch-all', validateQuery(querySchema), async (_req, res) => {
  const { groupBy, period, agentName, zone, customerType, refresh }
    = res.locals.query as z.infer<typeof querySchema>;
  const forceRefresh = refresh === 'true';

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const filterHash = buildFilterHash(agentName, zone, customerType);
    const rawKey = cacheKey('orders_raw', period, `${groupBy}:${filterHash}`);
    const metaKey = cacheKey('orders_raw_meta', period, `${groupBy}:${filterHash}`);

    // Date ranges
    const now = new Date();
    const year = period === 'ytd' ? now.getFullYear() : parseInt(period, 10);
    const startDate = `${year}-01-01T00:00:00Z`;
    const endDate = `${year + 1}-01-01T00:00:00Z`;

    // Build OData filter from dialog dropdowns
    const extraFilter = buildODataFilter(agentName, zone, customerType);

    // Check for cached raw orders (incremental refresh)
    let orders: RawOrder[];
    if (!forceRefresh) {
      const cached = await tryIncrementalRefresh(rawKey, metaKey, startDate, endDate, extraFilter, sendEvent);
      if (cached) {
        orders = cached;
      } else {
        orders = await fullFetch(startDate, endDate, extraFilter, sendEvent);
      }
    } else {
      // Force refresh: delete cache, do full fetch
      await redis.del(rawKey);
      await redis.del(metaKey);
      orders = await fullFetch(startDate, endDate, extraFilter, sendEvent);
    }

    // Cache raw orders + metadata
    sendEvent('progress', { phase: 'processing', message: `Computing metrics...` });
    const rawEnvelope = { data: orders, cachedAt: new Date().toISOString() };
    await redis.set(rawKey, JSON.stringify(rawEnvelope), { ex: getTTL('orders_raw') });
    const metaEnvelope = {
      data: { lastFetchDate: new Date().toISOString(), rowCount: orders.length, filterHash },
      cachedAt: new Date().toISOString(),
    };
    await redis.set(metaKey, JSON.stringify(metaEnvelope), { ex: getTTL('orders_raw_meta') });

    // Aggregate
    const prevStartDate = `${year - 1}-01-01T00:00:00Z`;
    const prevEndDate = `${year}-01-01T00:00:00Z`;
    const prevOrders = await cachedFetch(
      cacheKey('orders_year', String(year - 1)), getTTL('orders_year'),
      () => fetchOrders(priorityClient, prevStartDate, prevEndDate, false, extraFilter),
    );
    const customers = await cachedFetch(
      cacheKey('customers', 'all'), getTTL('customers'),
      () => fetchCustomers(priorityClient),
    );

    const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
    const entities = groupByDimension(groupBy as Dimension, orders, customers.data, periodMonths);
    const aggregate = aggregateOrders(orders, prevOrders.data, period);

    const years = new Set(orders.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
    prevOrders.data.forEach(o => years.add(new Date(o.CURDATE).getUTCFullYear().toString()));

    const payload: DashboardPayload = {
      entities,
      ...aggregate,
      yearsAvailable: [...years].sort().reverse(),
    };

    // Cache aggregated results
    const fullKey = cacheKey('entities_full', period, groupBy);
    const fullEnvelope = { data: { entities, yearsAvailable: payload.yearsAvailable }, cachedAt: new Date().toISOString() };
    await redis.set(fullKey, JSON.stringify(fullEnvelope), { ex: getTTL('entities_full') });

    const detailKey = cacheKey('entity_detail', period, `${groupBy}:ALL:${filterHash}`);
    const detailEnvelope = { data: payload, cachedAt: new Date().toISOString() };
    await redis.set(detailKey, JSON.stringify(detailEnvelope), { ex: getTTL('entities_full') });

    sendEvent('complete', payload);
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sendEvent('error', { message });
    res.end();
  }
});

async function fullFetch(
  startDate: string, endDate: string, extraFilter: string | undefined,
  sendEvent: (event: string, data: unknown) => void,
): Promise<RawOrder[]> {
  sendEvent('progress', { phase: 'fetching', rowsFetched: 0, estimatedTotal: 0 });
  return fetchOrders(priorityClient, startDate, endDate, true, extraFilter);
}

async function tryIncrementalRefresh(
  rawKey: string, metaKey: string,
  startDate: string, endDate: string, extraFilter: string | undefined,
  sendEvent: (event: string, data: unknown) => void,
): Promise<RawOrder[] | null> {
  const rawCached = await redis.get(rawKey);
  const metaCached = await redis.get(metaKey);
  if (!rawCached || !metaCached) return null;

  const rawEnvelope = typeof rawCached === 'string' ? JSON.parse(rawCached) : rawCached;
  const metaEnvelope = typeof metaCached === 'string' ? JSON.parse(metaCached) : metaCached;
  const lastFetchDate = new Date(metaEnvelope.data.lastFetchDate);
  const cachedOrders: RawOrder[] = rawEnvelope.data;

  // If fetched today, use as-is
  const today = new Date();
  if (lastFetchDate.toDateString() === today.toDateString()) {
    sendEvent('progress', { phase: 'processing', message: 'Using cached data from today...' });
    return cachedOrders;
  }

  // Incremental: fetch since lastFetchDate - 1 day
  const sinceDate = new Date(lastFetchDate);
  sinceDate.setDate(sinceDate.getDate() - 1);
  const sinceDateStr = sinceDate.toISOString().split('T')[0] + 'T00:00:00Z';
  sendEvent('progress', { phase: 'incremental', message: `Fetching orders since ${sinceDate.toLocaleDateString()}...`, rowsFetched: 0 });

  const newOrders = await fetchOrders(priorityClient, sinceDateStr, endDate, true, extraFilter);
  sendEvent('progress', { phase: 'merging', message: `Merging ${newOrders.length} new orders with ${cachedOrders.length} cached...` });

  // Deduplicate by ORDNAME — new version wins
  const orderMap = new Map<string, RawOrder>();
  cachedOrders.forEach(o => orderMap.set(o.ORDNAME, o));
  newOrders.forEach(o => orderMap.set(o.ORDNAME, o));

  // Filter to date range (remove orders from before startDate in case of overlap)
  const startTime = new Date(startDate).getTime();
  const merged = [...orderMap.values()].filter(o => new Date(o.CURDATE).getTime() >= startTime);
  return merged;
}

function buildODataFilter(agentName?: string, zone?: string, customerType?: string): string | undefined {
  // WHY: Zone and customerType filter at the CUSTOMERS level, but we're querying ORDERS.
  // For agentName, we can filter directly on ORDERS.AGENTNAME.
  // Zone and customerType require pre-filtering customers then passing as CUSTNAME list.
  // For now, only agentName filters server-side. Zone/customerType handled post-fetch.
  if (!agentName) return undefined;
  const escaped = agentName.replace(/'/g, "''");
  return `AGENTNAME eq '${escaped}'`;
}

function buildFilterHash(agentName?: string, zone?: string, customerType?: string): string {
  const parts: string[] = [];
  if (agentName) parts.push(`agent=${agentName}`);
  if (zone) parts.push(`zone=${zone}`);
  if (customerType) parts.push(`type=${customerType}`);
  return parts.length > 0 ? parts.join('&') : 'all';
}
```

**Note:** This file is ~150 lines. The `fetchOrders` call doesn't use `onProgress` yet because it goes through `fetchAllPages` internally. The progress callback from Task 4 can be wired in when testing with real data.

- [ ] **Step 2: Register route in index.ts**

Add to `server/src/index.ts`:

```typescript
import { fetchAllRouter } from './routes/fetch-all.js';
// ... in the router setup section:
app.use('/api/sales', fetchAllRouter);
```

- [ ] **Step 3: Verify**

Run: `cd server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/fetch-all.ts server/src/index.ts
git commit -m "feat: SSE fetch-all endpoint with incremental refresh and filter params

Spec: Features 4A-4C, 8A-8C — streams progress events via SSE.
Supports full fetch, incremental refresh (ORDNAME deduplication),
force refresh, and agentName filter. Caches raw orders 365 days."
```

---

## Task 6: Backend — Dashboard entityIds for Consolidated

**Files:**
- Modify: `server/src/routes/dashboard.ts`

- [ ] **Step 1: Add entityIds to query schema**

```typescript
const querySchema = z.object({
  groupBy: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).default('customer'),
  period: z.string().default('ytd'),
  entityId: z.string().optional(),
  entityIds: z.string().optional(), // NEW: comma-separated IDs for consolidated
});
```

- [ ] **Step 2: Add entityIds handling after entityFilter**

After the existing `entityFilter` logic (around line 42), add:

```typescript
// WHY: entityIds (comma-separated) enables View Consolidated — fetches cached orders
// and re-aggregates for only the selected subset.
const entityIdList = entityIds ? entityIds.split(',').map(s => s.trim()) : undefined;
if (entityIdList && entityIdList.length > 0) {
  const entitySet = new Set(entityIdList);
  // Use cached raw orders from fetch-all if available
  const rawKey = cacheKey('orders_raw', period, `${groupBy}:all`);
  const rawCached = await redis.get(rawKey);
  if (rawCached) {
    const rawEnvelope = typeof rawCached === 'string' ? JSON.parse(rawCached) : rawCached;
    const allOrders: RawOrder[] = rawEnvelope.data;
    const filteredOrders = allOrders.filter(o => entitySet.has(o.CUSTNAME));
    const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
    const entities = groupByDimension(groupBy as Dimension, filteredOrders, customersResult.data, periodMonths);
    const aggregate = aggregateOrders(filteredOrders, [], period);
    const payload: DashboardPayload = {
      entities,
      ...aggregate,
      yearsAvailable: [...years].sort().reverse(),
    };
    return res.json({ data: payload, meta: { cached: true, cachedAt: null, period, dimension: groupBy, entityCount: entities.length } });
  }
  // If no cached raw orders, fall through to normal fetch with entity filter
}
```

Add imports at top: `import { redis } from '../cache/redis-client.js';` and `import type { RawOrder } from '../services/priority-queries.js';`

- [ ] **Step 3: Verify**

Run: `cd server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/dashboard.ts
git commit -m "feat: dashboard endpoint accepts entityIds for consolidated view

Spec: Feature 7C — when entityIds is provided, filters cached raw orders
to the selected subset and re-aggregates for accurate consolidated KPIs."
```

---

## Task 7: Backend — Warm Cache Behavior Change

**Files:**
- Modify: `server/src/services/warm-cache.ts`

- [ ] **Step 1: Add cache existence check**

Wrap the existing logic with a check:

```typescript
export async function warmEntityCache(): Promise<void> {
  // WHY: Skip warm if recent cached data exists from a previous fetch-all run.
  // This prevents blocking server startup with a 4-7 minute fetch.
  const rawMetaKey = cacheKey('orders_raw_meta', 'ytd', 'customer:all');
  const existingMeta = await redis.get(rawMetaKey);
  if (existingMeta) {
    console.log('[warm-cache] Skipping — cached data exists from previous fetch-all run.');
    return;
  }

  // ... existing warm logic unchanged ...
}
```

Add import: `import { redis } from '../cache/redis-client.js';`

- [ ] **Step 2: Verify**

Run: `cd server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/src/services/warm-cache.ts
git commit -m "feat: warm-cache skips when fetch-all data exists

Spec: Feature 8E — prevents redundant 4-7 min fetch on server startup
when long-lived cached data already exists from a previous user session."
```

---

## Task 8: Frontend — Sort + Sort Engine (ID Default, Nullable Handling)

**Files:**
- Modify: `client/src/hooks/useSort.ts`
- Modify: `client/src/utils/sort-engine.ts`

- [ ] **Step 1: Add 'id' to SortField and change default**

In `client/src/hooks/useSort.ts`:

```typescript
export type SortField =
  | 'id'        // NEW: entity ID (customer code)
  | 'name'
  | 'revenue'
  | 'orders'
  | 'avgOrder'
  | 'marginPercent'
  | 'frequency'
  | 'lastOrder';

// Change default from revenue desc to ID ascending
const INITIAL_STATE: SortState = { field: 'id', direction: 'asc' };
```

- [ ] **Step 2: Handle 'id' and nullable metrics in sort engine**

In `client/src/utils/sort-engine.ts`, update `getValue`:

```typescript
const getValue = (e: EntityListItem): number | string => {
  switch (field) {
    case 'id':
      return e.id.toLowerCase();
    case 'name':
      return e.name.toLowerCase();
    case 'revenue':
      return e.revenue ?? -Infinity;    // WHY: null sorts last
    case 'orders':
      return e.orderCount ?? -Infinity;
    case 'avgOrder':
      return e.avgOrder ?? -Infinity;
    case 'marginPercent':
      return e.marginPercent ?? -Infinity;
    case 'frequency':
      return e.frequency ?? -Infinity;
    case 'lastOrder':
      return e.lastOrderDate ? new Date(e.lastOrderDate).getTime() : -Infinity;
    default:
      return e.revenue ?? -Infinity;
  }
};
```

- [ ] **Step 3: Verify**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS (or remaining errors from other files that reference `revenue` as `number`)

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useSort.ts client/src/utils/sort-engine.ts
git commit -m "feat: default sort to ID ascending, handle nullable metrics in sort engine

Spec: Features 1D, 1E — sort defaults to customer ID instead of revenue.
Null metrics sort to -Infinity (sort last) for all metric fields."
```

---

## Task 9: Frontend — EntityListItem (Hide Null Metrics, Fade-In)

**Files:**
- Modify: `client/src/components/left-panel/EntityListItem.tsx`

- [ ] **Step 1: Update formatRevenue to handle null**

```typescript
function formatRevenue(value: number | null): string | null {
  if (value === null) return null;
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  }
  return `$${value.toLocaleString()}`;
}
```

- [ ] **Step 2: Conditionally render revenue and meta2**

Replace the existing revenue + meta2 display (lines 91-106) with:

```typescript
<div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-2xs)]">
  <div className="flex items-start justify-between gap-[var(--spacing-md)]">
    <span className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
      {entity.name}
    </span>
    {formatRevenue(entity.revenue) !== null && (
      <motion.span
        initial={{ opacity: 0, x: 4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="shrink-0 text-[13px] font-bold tabular-nums text-[var(--color-text-primary)]"
      >
        {formatRevenue(entity.revenue)}
      </motion.span>
    )}
  </div>
  <div className="flex items-center justify-between">
    <span className="truncate text-[11px] text-[var(--color-text-muted)]">
      {entity.meta1}
    </span>
    {entity.meta2 !== null && (
      <motion.span
        initial={{ opacity: 0, x: 4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className="shrink-0 text-[11px] text-[var(--color-text-muted)]"
      >
        {entity.meta2}
      </motion.span>
    )}
  </div>
</div>
```

- [ ] **Step 3: Verify**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS (or remaining errors from other consumers)

- [ ] **Step 4: Commit**

```bash
git add client/src/components/left-panel/EntityListItem.tsx
git commit -m "feat: hide null metrics in entity rows, fade-in animation when loaded

Spec: Features 1B, 5C — no more misleading \$0 values. Revenue and order
count animate in with Framer Motion when metrics become available."
```

---

## Task 10: Frontend — AllEntityEntry Component

**Files:**
- Create: `client/src/components/left-panel/AllEntityEntry.tsx`

- [ ] **Step 1: Create the component**

Create `client/src/components/left-panel/AllEntityEntry.tsx`:

```typescript
// FILE: client/src/components/left-panel/AllEntityEntry.tsx
// PURPOSE: Pinned "All {Dimension}" entry above entity list — 4 visual states
// USED BY: client/src/components/left-panel/EntityList.tsx
// EXPORTS: AllEntityEntry

import { motion } from 'framer-motion';
import type { EntityListLoadState, DashboardPayload } from '@shared/types/dashboard';

interface AllEntityEntryProps {
  label: string;                    // e.g., "All Customers"
  loadState: EntityListLoadState;
  isActive: boolean;
  aggregateData: DashboardPayload | null;
  entityCount: number;              // total entities in list
  entitiesWithOrders: number;       // entities with revenue > 0
  onClick: () => void;
  onRefresh: () => void;
}

function formatLargeNumber(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

export function AllEntityEntry({
  label, loadState, isActive, aggregateData,
  entityCount, entitiesWithOrders, onClick, onRefresh,
}: AllEntityEntryProps) {
  const isLoaded = loadState === 'loaded';
  const isLoading = loadState === 'loading';

  const iconBg = isActive
    ? 'bg-[var(--color-gold-primary)] text-white'
    : 'bg-[var(--color-gold-subtle)] text-[var(--color-gold-primary)]';

  return (
    <motion.div
      onClick={isLoading ? undefined : onClick}
      whileHover={isLoading ? undefined : { scale: 1.005 }}
      className={`
        relative flex cursor-pointer items-center gap-[var(--spacing-md)]
        border-b-2 border-[var(--color-gold-subtle)]
        px-[var(--spacing-2xl)] py-[var(--spacing-lg)]
        ${isActive ? 'bg-[var(--color-gold-hover)]' : 'bg-transparent hover:bg-[var(--color-gold-hover)]'}
        ${isLoading ? 'cursor-wait' : ''}
      `}
    >
      {isActive && (
        <div className="absolute left-0 top-0 h-full w-[3px] rounded-r-[2px] bg-[var(--color-gold-primary)]" />
      )}

      {/* Σ icon */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${iconBg} ${isLoading ? 'animate-pulse' : ''}`}>
        Σ
      </div>

      {/* Text */}
      <div className="flex-1">
        <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">{label}</div>
        <div className="text-[11px] text-[var(--color-text-muted)]">
          {isLoaded
            ? `${entitiesWithOrders.toLocaleString()} with orders`
            : isLoading
              ? 'Loading...'
              : 'Click to load all data'}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-[var(--spacing-sm)]">
        {isLoaded && aggregateData ? (
          <div className="text-right">
            <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">
              {formatLargeNumber(aggregateData.kpis.totalRevenue)}
            </div>
            <div className="text-[11px] text-[var(--color-text-muted)]">
              {aggregateData.kpis.orders.toLocaleString()} orders
            </div>
          </div>
        ) : isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-gold-primary)] border-t-transparent" />
        ) : (
          <span className="rounded-full bg-[var(--color-gold-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-gold-primary)]">
            Not loaded
          </span>
        )}

        {/* Refresh button — only when loaded */}
        {isLoaded && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            title="Refresh data (force full re-fetch)"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-gold-subtle)] hover:text-[var(--color-gold-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M13.65 2.35A8 8 0 1 0 16 8h-2a6 6 0 1 1-1.76-4.24L10 6h6V0l-2.35 2.35z" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/components/left-panel/AllEntityEntry.tsx
git commit -m "feat: AllEntityEntry component with 4 visual states + refresh button

Spec: Features 2A-2D, 8D — pinned entry above entity list showing
not-loaded/loading/loaded-active/loaded-inactive states. Refresh icon
for force re-fetch when data is loaded."
```

---

## Task 11: Frontend — FetchAllDialog + FetchAllProgress

**Files:**
- Create: `client/src/components/shared/FetchAllDialog.tsx`
- Create: `client/src/components/right-panel/FetchAllProgress.tsx`

- [ ] **Step 1: Create FetchAllDialog**

Create `client/src/components/shared/FetchAllDialog.tsx`:

```typescript
// FILE: client/src/components/shared/FetchAllDialog.tsx
// PURPOSE: Confirmation modal with pre-fetch filter dropdowns
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: FetchAllDialog

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EntityListItem, Dimension, FetchAllFilters } from '@shared/types/dashboard';
import { DIMENSION_CONFIG } from '../../utils/dimension-config';

interface FetchAllDialogProps {
  isOpen: boolean;
  dimension: Dimension;
  entities: EntityListItem[];
  isRefresh?: boolean;
  onConfirm: (filters: FetchAllFilters) => void;
  onCancel: () => void;
}

function estimateTime(count: number): string {
  if (count < 200) return '~1 minute';
  if (count < 500) return '~2 minutes';
  if (count < 1000) return '~3\u20134 minutes';
  return '4\u20137 minutes';
}

export function FetchAllDialog({ isOpen, dimension, entities, isRefresh, onConfirm, onCancel }: FetchAllDialogProps) {
  const [agentName, setAgentName] = useState('');
  const [zone, setZone] = useState('');
  const [customerType, setCustomerType] = useState('');

  const config = DIMENSION_CONFIG[dimension];
  const showRep = dimension === 'customer';

  // Extract unique values for dropdowns
  const reps = useMemo(() => [...new Set(entities.map(e => e.rep).filter(Boolean) as string[])].sort(), [entities]);
  const zones = useMemo(() => [...new Set(entities.map(e => e.zone).filter(Boolean) as string[])].sort(), [entities]);
  const types = useMemo(() => [...new Set(entities.map(e => e.customerType).filter(Boolean) as string[])].sort(), [entities]);

  // Filter entities to estimate count
  const filteredCount = useMemo(() => {
    let filtered = entities;
    if (agentName) filtered = filtered.filter(e => e.rep === agentName);
    if (zone) filtered = filtered.filter(e => e.zone === zone);
    if (customerType) filtered = filtered.filter(e => e.customerType === customerType);
    return filtered.length;
  }, [entities, agentName, zone, customerType]);

  const handleConfirm = () => {
    const filters: FetchAllFilters = {};
    if (agentName) filters.agentName = agentName;
    if (zone) filters.zone = zone;
    if (customerType) filters.customerType = customerType;
    onConfirm(filters);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[400px] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-8 shadow-lg"
          >
            {/* Hourglass icon */}
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fef3c7] text-2xl">
              ⏳
            </div>

            <h2 className="mb-2 text-center text-[16px] font-semibold text-[var(--color-text-primary)]">
              {isRefresh ? `Re-fetch ${config.allLabel} Data?` : `Load ${config.allLabel} Data?`}
            </h2>

            {/* Filter dropdowns */}
            <div className="mb-4 space-y-2">
              {showRep && (
                <FilterDropdown label="Sales Rep" value={agentName} options={reps} onChange={setAgentName} />
              )}
              <FilterDropdown label="Zone" value={zone} options={zones} onChange={setZone} />
              <FilterDropdown label="Customer Type" value={customerType} options={types} onChange={setCustomerType} />
            </div>

            <p className="mb-5 text-center text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              {isRefresh
                ? `Re-fetch all order data from Priority ERP? This will replace cached data. Estimated ${estimateTime(filteredCount)}.`
                : `This will fetch order data from Priority ERP. Estimated ${estimateTime(filteredCount)}.`}
            </p>

            <div className="flex gap-3">
              <button type="button" onClick={onCancel}
                className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] py-2.5 text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-gold-muted)]">
                Cancel
              </button>
              <button type="button" onClick={handleConfirm}
                className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-dark)] py-2.5 text-[13px] font-semibold text-white transition-colors hover:opacity-90">
                Yes, Load All
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FilterDropdown({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-[12px] text-[var(--color-text-muted)]">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="flex-1 rounded-[var(--radius-base)] border border-[var(--color-gold-subtle)] bg-white px-3 py-1.5 text-[12px] text-[var(--color-text-primary)]">
        <option value="">All</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Create FetchAllProgress**

Create `client/src/components/right-panel/FetchAllProgress.tsx`:

```typescript
// FILE: client/src/components/right-panel/FetchAllProgress.tsx
// PURPOSE: Progress card replacing right panel during SSE fetch
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: FetchAllProgress

import type { SSEProgressEvent } from '@shared/types/dashboard';

interface FetchAllProgressProps {
  progress: SSEProgressEvent | null;
}

export function FetchAllProgress({ progress }: FetchAllProgressProps) {
  const phase = progress?.phase ?? 'fetching';
  const isFetching = phase === 'fetching' || phase === 'incremental';
  const rowsFetched = progress && 'rowsFetched' in progress ? progress.rowsFetched : 0;
  const estimatedTotal = progress && 'estimatedTotal' in progress ? progress.estimatedTotal : 0;
  const percent = estimatedTotal > 0 ? Math.min(100, Math.round((rowsFetched / estimatedTotal) * 100)) : 0;

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-[400px] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-8 shadow-[var(--shadow-card)]">
        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          Loading All Data
        </h3>
        <p className="mb-4 text-[12px] text-[var(--color-text-muted)]">
          Fetching order data from Priority ERP...
        </p>

        {/* Phase 1 */}
        <p className="mb-3 text-[12px] font-medium text-[var(--color-gold-primary)]">
          Phase 1 of 2 — {phase === 'incremental' ? 'Fetching new orders' : 'Fetching orders'}
        </p>
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-gold-subtle)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-gold-primary)] to-[var(--color-gold-light)] transition-all duration-300"
            style={{ width: `${isFetching ? percent : 100}%` }}
          />
        </div>
        <div className="mb-4 flex justify-between text-[11px] text-[var(--color-text-muted)]">
          <span>{rowsFetched.toLocaleString()} {estimatedTotal > 0 ? `of ~${estimatedTotal.toLocaleString()} rows` : 'rows'}</span>
          {isFetching && <span>{percent}%</span>}
        </div>

        {/* Phase 2 */}
        <div className="border-t border-[var(--color-gold-subtle)] pt-3">
          <p className={`text-[12px] font-medium ${phase === 'processing' || phase === 'merging' ? 'text-[var(--color-gold-primary)]' : 'text-[var(--color-text-muted)]'}`}>
            Phase 2 — Computing metrics
          </p>
          {(phase === 'processing' || phase === 'merging') && progress && 'message' in progress && (
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{progress.message}</p>
          )}
          {isFetching && (
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Waiting...</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/components/shared/FetchAllDialog.tsx client/src/components/right-panel/FetchAllProgress.tsx
git commit -m "feat: FetchAllDialog with filter dropdowns + FetchAllProgress card

Spec: Features 3A-3F, 4E — confirmation modal with Rep/Zone/Type dropdowns
that narrow the server-side query. Progress card replaces right panel
showing phase indicators and progress bar during SSE fetch."
```

---

## Task 12: Frontend — useFetchAll Hook

**Files:**
- Create: `client/src/hooks/useFetchAll.ts`

- [ ] **Step 1: Create the hook**

Create `client/src/hooks/useFetchAll.ts`:

```typescript
// FILE: client/src/hooks/useFetchAll.ts
// PURPOSE: Manages EventSource lifecycle, per-dimension load state, and progress tracking
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useFetchAll

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  Dimension, Period, DashboardPayload, FetchAllFilters,
  EntityListLoadState, SSEProgressEvent,
} from '@shared/types/dashboard';

interface FetchAllReturn {
  loadState: EntityListLoadState;
  progress: SSEProgressEvent | null;
  allDashboard: DashboardPayload | null;
  error: string | null;
  startFetchAll: (filters: FetchAllFilters, forceRefresh?: boolean) => void;
  abortFetch: () => void;
}

export function useFetchAll(dimension: Dimension, period: Period): FetchAllReturn {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  // WHY: Map keyed by `${dimension}:${period}` preserves state across dimension switches
  const [loadStateMap, setLoadStateMap] = useState<Map<string, EntityListLoadState>>(new Map());
  const [allDashboardMap, setAllDashboardMap] = useState<Map<string, DashboardPayload>>(new Map());
  const [progress, setProgress] = useState<SSEProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stateKey = `${dimension}:${period}`;
  const loadState = loadStateMap.get(stateKey) ?? 'not-loaded';
  const allDashboard = allDashboardMap.get(stateKey) ?? null;

  const abortFetch = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setProgress(null);
  }, []);

  const startFetchAll = useCallback((filters: FetchAllFilters, forceRefresh = false) => {
    abortFetch();
    setError(null);

    setLoadStateMap(prev => new Map(prev).set(stateKey, 'loading'));

    const params = new URLSearchParams({ groupBy: dimension, period });
    if (filters.agentName) params.set('agentName', filters.agentName);
    if (filters.zone) params.set('zone', filters.zone);
    if (filters.customerType) params.set('customerType', filters.customerType);
    if (forceRefresh) params.set('refresh', 'true');

    const es = new EventSource(`/api/sales/fetch-all?${params}`);
    eventSourceRef.current = es;

    es.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data) as SSEProgressEvent;
      setProgress(data);
    });

    es.addEventListener('complete', (e) => {
      const payload = JSON.parse(e.data) as DashboardPayload;
      setLoadStateMap(prev => new Map(prev).set(stateKey, 'loaded'));
      setAllDashboardMap(prev => new Map(prev).set(stateKey, payload));
      setProgress(null);
      es.close();
      eventSourceRef.current = null;

      // WHY: Invalidate entity list query so it refetches — now returns enriched data from cache
      queryClient.invalidateQueries({ queryKey: ['entities', dimension, period] });
    });

    es.addEventListener('error', (e) => {
      const data = e instanceof MessageEvent ? JSON.parse(e.data) : null;
      setError(data?.message ?? 'Connection lost');
      setLoadStateMap(prev => new Map(prev).set(stateKey, 'error'));
      setProgress(null);
      es.close();
      eventSourceRef.current = null;
    });
  }, [dimension, period, stateKey, abortFetch, queryClient]);

  return { loadState, progress, allDashboard, error, startFetchAll, abortFetch };
}
```

- [ ] **Step 2: Verify**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useFetchAll.ts
git commit -m "feat: useFetchAll hook with EventSource lifecycle and per-dimension state

Spec: Features 4F, 6A-6C — manages SSE connection, progress tracking,
per-dimension load state (Map keyed by dim:period), and TanStack Query
invalidation on completion."
```

---

## Task 13: Frontend — EntityList Header + SelectionBar + FilterSortToolbar

**Files:**
- Modify: `client/src/components/left-panel/EntityList.tsx`
- Modify: `client/src/components/left-panel/SelectionBar.tsx`
- Modify: `client/src/components/left-panel/FilterSortToolbar.tsx`
- Modify: `client/src/utils/filter-types.ts`

- [ ] **Step 1: Update EntityList — conditional header count**

In `EntityList.tsx`, add `dataLoaded` prop:

```typescript
interface EntityListProps {
  entities: EntityListItemType[];
  activeId: string | null;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onCheck: (id: string) => void;
  dimensionLabel: string;
  totalCount: number;
  dataLoaded: boolean;    // NEW
}
```

Update the header span:

```typescript
<span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
  {dataLoaded
    ? `${dimensionLabel} (${entities.length} of ${totalCount})`
    : dimensionLabel}
</span>
```

- [ ] **Step 2: Add METRIC_FILTER_FIELDS to filter-types**

In `client/src/utils/filter-types.ts`, add:

```typescript
/** Fields that require "All" data to be loaded before they can be used for filtering/sorting */
export const METRIC_FILTER_FIELDS: Set<FilterField> = new Set([
  'revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency',
]);
```

- [ ] **Step 3: Update SelectionBar — disable View Consolidated when !dataLoaded**

Add `dataLoaded` prop to SelectionBar:

```typescript
interface SelectionBarProps {
  selectedCount: number;
  dataLoaded: boolean;     // NEW
  onViewConsolidated: () => void;
  onClear: () => void;
}
```

Update the "View Consolidated" button:

```typescript
<button
  type="button"
  onClick={dataLoaded ? onViewConsolidated : undefined}
  disabled={!dataLoaded}
  title={dataLoaded ? undefined : 'Load all data first to view consolidated'}
  className={`rounded-[var(--radius-base)] px-3 py-1.5 text-[12px] font-medium transition-colors
    ${dataLoaded
      ? 'bg-[var(--color-dark)] text-white hover:opacity-90'
      : 'cursor-not-allowed bg-[var(--color-dark)] text-white opacity-50'}`}
>
  View Consolidated
</button>
```

- [ ] **Step 4: Verify**

Run: `cd client && npx tsc -b --noEmit`
Expected: Errors in LeftPanel.tsx (needs to pass new props) — fixed in Task 14

- [ ] **Step 5: Commit**

```bash
git add client/src/components/left-panel/EntityList.tsx client/src/components/left-panel/SelectionBar.tsx client/src/components/left-panel/FilterSortToolbar.tsx client/src/utils/filter-types.ts
git commit -m "feat: conditional header count, disabled View Consolidated, metric field set

Spec: Features 1C, 1E, 5B, 7B — header hides count when unloaded.
View Consolidated disabled until data loaded. METRIC_FILTER_FIELDS
set for disabling sorts/filters."
```

---

## Task 14: Integration — useDashboardState + DashboardLayout + LeftPanel

**Files:**
- Modify: `client/src/hooks/useDashboardState.ts`
- Modify: `client/src/layouts/DashboardLayout.tsx`
- Modify: `client/src/components/left-panel/LeftPanel.tsx`

- [ ] **Step 1: Wire useFetchAll into useDashboardState**

In `useDashboardState.ts`, add:

```typescript
import { useFetchAll } from './useFetchAll';
```

Inside the hook, after the sort hook:

```typescript
const { loadState: fetchAllLoadState, progress: fetchAllProgress, allDashboard, error: fetchAllError, startFetchAll, abortFetch } = useFetchAll(activeDimension, activePeriod);
const dataLoaded = fetchAllLoadState === 'loaded';
```

Update `switchDimension` to abort:

```typescript
const switchDimension = useCallback((dim: Dimension) => {
  rawSwitchDimension(dim);
  resetSelection();
  resetSearch();
  clearFilters();
  resetSort();
  abortFetch();  // NEW: abort SSE on dimension switch
}, [rawSwitchDimension, resetSelection, resetSearch, clearFilters, resetSort, abortFetch]);
```

Update `sortActive` check (it references old default):

Update the return object to include new props:

```typescript
return {
  // ... existing props ...
  dataLoaded,
  fetchAllLoadState,
  fetchAllProgress,
  allDashboard,
  startFetchAll,
  abortFetch,
};
```

- [ ] **Step 2: Update LeftPanel props**

Add to `LeftPanelProps`:

```typescript
dataLoaded: boolean;
```

Pass `dataLoaded` to `EntityList`, `SelectionBar`:

```typescript
<EntityList ... dataLoaded={dataLoaded} />
// ...
<SelectionBar ... dataLoaded={dataLoaded} />
```

- [ ] **Step 3: Update DashboardLayout**

Add new props to `DashboardLayoutProps` and destructure them.

In the right panel section, show `FetchAllProgress` when loading:

```typescript
import { FetchAllProgress } from '../components/right-panel/FetchAllProgress';

// In the render, after the AnimatePresence for dashboard:
{fetchAllLoadState === 'loading' ? (
  <FetchAllProgress progress={fetchAllProgress} />
) : dashboard ? (
  // ... existing dashboard render ...
) : (
  // ... existing placeholder ...
)}
```

Update `sortActive`:

```typescript
const sortActive = sortField !== 'id' || sortDirection !== 'asc';
```

- [ ] **Step 4: Verify all compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS

Run: `cd server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useDashboardState.ts client/src/layouts/DashboardLayout.tsx client/src/components/left-panel/LeftPanel.tsx
git commit -m "feat: wire useFetchAll into dashboard state, layout, and left panel

Spec: Features 1-8 integration — connects SSE fetch-all hook to the
dashboard state orchestration. Shows FetchAllProgress in right panel
during loading. Passes dataLoaded to child components."
```

---

## Task 15: Verification + Remaining TypeScript Fixes

- [ ] **Step 1: Full TypeScript check**

```bash
cd server && npx tsc --noEmit
cd ../client && npx tsc -b --noEmit
```

Fix any remaining nullable metric errors across consumer files. Common fixes:
- `e.revenue` → `e.revenue ?? 0` in aggregation utils
- `e.orderCount` → `e.orderCount ?? 0` in filter engine
- Dimension-grouper sort: `b.revenue - a.revenue` → `(b.revenue ?? 0) - (a.revenue ?? 0)`

- [ ] **Step 2: Run existing tests**

```bash
cd server && npx vitest run
```

Expected: All tests pass (existing tests use `makeOrder` which produces full RawOrder objects with numeric metrics — the null-metric change only affects the entities endpoint, not the aggregator).

- [ ] **Step 3: Verify build**

```bash
cd client && npx vite build
```

Expected: Build succeeds, bundle <500KB gzip.

- [ ] **Step 4: Manual browser test**

Start both dev servers:
```bash
cd server && npm run dev
cd client && npm run dev
```

Verify:
1. Entity list shows names + metadata only (no $0, no "0 orders")
2. "All Customers" entry visible at top with "Not loaded" badge
3. Click "All Customers" → confirmation dialog with filter dropdowns
4. Confirm → right panel shows progress bar
5. After load → entity rows show revenue + order counts
6. Sort/filter metric options become available

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: resolve nullable metric TypeScript errors across all consumers

All files compile cleanly. Entity list optimization complete with
8 features: lightweight default, All entry, dialog with filters,
SSE progress, loaded state, dimension switching, View Consolidated
fix, and incremental 365-day cache."
```

---

## Review Checkpoints

| After Task | Type | Check |
|-----------|------|-------|
| Task 1 | TypeScript | `npx tsc` shows expected errors in ~14 consumer files (nullable metrics) |
| Task 3 | TDD | `server/tests/routes/entities.test.ts` — null stubs test passes, cache fallback test passes |
| Task 5 | TDD | `server/tests/routes/fetch-all.test.ts` — all 6 tests pass (SSE, incremental, dedup, filters, error) |
| Task 6 | TDD | `server/tests/routes/dashboard-consolidated.test.ts` — entityIds filter tests pass |
| Task 9 | Visual | Screenshot: entity list shows names only, no $0, no "0 orders", header says "CUSTOMERS" |
| Task 10 | Visual | Screenshot: Σ entry pinned at top, "Not loaded" badge, correct styling |
| Task 11 | Visual | Screenshot: dialog with backdrop blur, 3 dropdowns, time estimate, buttons |
| Task 12 | TypeScript | All new frontend files compile independently |
| Task 14 | Visual + TS | Full integration compiles. Screenshot full flow: unloaded → dialog → progress → loaded state |
| Task 15 | Full | All tests pass (`npx vitest run`), build succeeds (`npx vite build`), View Consolidated works visually |
