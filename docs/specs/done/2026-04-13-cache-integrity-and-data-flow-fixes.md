# Cache Integrity & Data Flow Fixes

**Date:** 2026-04-13
**Status:** Draft
**Triggered by:** Codex adversarial review (full codebase, 191 files)
**Verdict:** needs-attention — 1 critical, 3 high findings

## Context

A full-codebase Codex adversarial review identified 4 structural issues in the dashboard's data flow:

1. **Cache key contamination** — filtered fetch-all results overwrite the unfiltered entity cache
2. **Ghost filters** — zone/customerType filters in UI do nothing server-side
3. **Cold cache empty panel** — non-customer dimensions show "No zone found" until fetch-all completes
4. **Consolidated view data mismatch** — "View Consolidated" shows single-entity data, not multi-entity

These are not cosmetic bugs. They cause wrong data to be displayed, silent data loss through cache overwrites, and broken UX flows for non-customer dimensions.

## Scope

Server: `fetch-all.ts`, `entities.ts`, `dashboard.ts`, `cache-keys.ts`
Client: `useDashboardState.ts`, `useDashboardData.ts`, `aggregation.ts`
New files: `customer-filter.ts`, `entity-stub-builder.ts`

---

## Fix 1: Cache Key Contamination (Critical)

### Problem

`fetch-all.ts:114` writes the enriched entity list to:
```
dashboard:entities_full:{period}:{groupBy}
```

This key has NO filter discriminator. But `orders_raw` keys DO include one:
```
dashboard:orders_raw:{period}:{groupBy}:{filterHash}
```

When a user runs fetch-all with `agentName=Sarah`, the filtered entity list is written to `entities_full:ytd:customer` — overwriting any previous unfiltered data. The next time `/entities` reads that key (line 32), it returns Sarah's filtered entities as if they were the full unfiltered list.

The spec (2026-03-31-entity-list-optimization.md:430) says the key should be `entities_full:{period}:{groupBy}:{filterHash}`. The code omits `{filterHash}`.

### Solution

#### 1. Add `buildFilterQualifier` helper to `cache-keys.ts`

```typescript
/** Combine dimension + filter hash into a cache key qualifier */
export function buildFilterQualifier(groupBy: string, filterHash: string): string {
  return `${groupBy}:${filterHash}`;
}
```

#### 2. Update writer in `fetch-all.ts:114`

Before:
```typescript
const fullKey = cacheKey('entities_full', period, groupBy);
```

After:
```typescript
const fullKey = cacheKey('entities_full', period, buildFilterQualifier(groupBy, filterHash));
```

Result: `dashboard:entities_full:ytd:customer:agent=Sarah` (filtered) vs `dashboard:entities_full:ytd:customer:all` (unfiltered)

#### 3. Update reader in `entities.ts:32`

Before:
```typescript
const fullKey = cacheKey('entities_full', period, groupBy);
```

After:
```typescript
const fullKey = cacheKey('entities_full', period, buildFilterQualifier(groupBy, 'all'));
```

The `/entities` endpoint always reads the UNFILTERED key. Filtered entity lists are only consumed within the fetch-all SSE response directly (they're sent via the `complete` event, not read back from cache by `/entities`).

### Files Changed

| File | Change |
|------|--------|
| `server/src/cache/cache-keys.ts` | Add `buildFilterQualifier()` export |
| `server/src/routes/fetch-all.ts` | Line 114: use `buildFilterQualifier(groupBy, filterHash)` |
| `server/src/routes/entities.ts` | Line 32: use `buildFilterQualifier(groupBy, 'all')` |

### Migration

Existing `entities_full:ytd:customer` keys (no `:all` suffix) become dead keys in Redis. On next read, cache misses and rebuilds from warm cache or fetch-all. TTL expiry handles cleanup. No manual migration needed.

---

## Fix 2: Implement Zone & CustomerType Filters (High)

### Problem

`buildODataFilter()` (fetch-all.ts:183-193) only processes `agentName`. Zone and customerType are CUSTOMERS-level fields — they cannot be OData-filtered on the ORDERS entity. The comment at line 180-182 claims "Zone/customerType handled post-fetch by groupByDimension filtering" but `groupByDimension()` accepts NO filter parameters.

Result: Users select zone/customerType in the FetchAllDialog, see them reflected in the UI, but the backend fetches ALL data and caches it under a filter-specific key. This is a silent data integrity issue.

### Solution: Post-Fetch Customer Filtering

Since zone and customerType live on CUSTOMERS, the correct approach is:
1. Fetch all orders (with `agentName` OData filter if set)
2. Fetch all customers (already done at line 95-98)
3. **NEW:** Build a set of matching customer IDs based on zone/customerType criteria
4. Filter orders to only those from matching customers
5. Proceed with `groupByDimension` and `aggregateOrders` using filtered orders

#### New file: `server/src/services/customer-filter.ts`

```typescript
// FILE: server/src/services/customer-filter.ts
// PURPOSE: Post-fetch filtering of orders by customer-level criteria (zone, customerType)
// USED BY: server/src/routes/fetch-all.ts
// EXPORTS: filterOrdersByCustomerCriteria

import type { RawOrder, RawCustomer } from './priority-queries.js';

interface CustomerFilterCriteria {
  zone?: string;        // comma-separated zone names (ZONEDES)
  customerType?: string; // comma-separated customer type names (CTYPENAME)
}

/**
 * Filter orders to only those from customers matching zone/customerType criteria.
 * Returns all orders if no criteria are set.
 */
export function filterOrdersByCustomerCriteria(
  orders: RawOrder[],
  customers: RawCustomer[],
  criteria: CustomerFilterCriteria,
): RawOrder[] {
  const { zone, customerType } = criteria;
  if (!zone && !customerType) return orders;

  // Build sets of filter values (comma-separated → Set)
  const zoneSet = zone
    ? new Set(zone.split(',').map(z => z.trim().toLowerCase()))
    : null;
  const typeSet = customerType
    ? new Set(customerType.split(',').map(t => t.trim().toLowerCase()))
    : null;

  // Find customer IDs that match ALL criteria (AND logic)
  const matchingCustomers = new Set<string>();
  for (const c of customers) {
    const zoneMatch = !zoneSet || zoneSet.has((c.ZONEDES ?? '').toLowerCase());
    const typeMatch = !typeSet || typeSet.has((c.CTYPENAME ?? '').toLowerCase());
    if (zoneMatch && typeMatch) {
      matchingCustomers.add(c.CUSTNAME);
    }
  }

  return orders.filter(o => matchingCustomers.has(o.CUSTNAME));
}
```

#### Changes to `fetch-all.ts`

After line 98 (customers fetch), before line 100 (groupByDimension):

```typescript
// Post-fetch filtering for zone/customerType (CUSTOMERS-level fields)
const filteredOrders = filterOrdersByCustomerCriteria(orders, customers.data, { zone, customerType });
```

Then use `filteredOrders` instead of `orders` for:
- Line 101: `groupByDimension(groupBy, filteredOrders, ...)`
- Line 102: `aggregateOrders(filteredOrders, ...)`
- Line 104: `filteredOrders.map(o => ...)`

The `filterHash` already includes zone/customerType (built at line 49), so after Fix 1, the cache key correctly reflects the filter state.

### Filter Logic: AND vs OR

Within a single filter type (e.g., multiple zones), values are OR'd: `zone=North,South` matches customers in North OR South.

Across filter types, criteria are AND'd: `zone=North&customerType=Retail` matches customers who are in North AND of type Retail.

This matches standard dashboard filter behavior and the existing `agentName` multi-select pattern.

### Zone field disambiguation

Two different zone fields exist on `RawCustomer`:
- **`ZONEDES`** (display name, e.g., "North") — used in Fix 2's customer-filter because the FetchAllDialog sends display names
- **`ZONECODE`** (internal code, e.g., "N") — used as the entity ID in dimension-grouper and in Fix 4's `filterOrdersByEntityIds`

These serve different purposes and must not be confused.

### Files Changed

| File | Change |
|------|--------|
| `server/src/services/customer-filter.ts` | **NEW** (~40 lines) |
| `server/src/routes/fetch-all.ts` | Import + call `filterOrdersByCustomerCriteria` after customers fetch |

---

## Fix 3: Cold Cache Left Panel for Non-Customer Dimensions (High)

### Problem

`entities.ts:58-61` returns `{ entities: [], yearsAvailable: [] }` for non-customer dimensions when no `entities_full` or `entities_summary` cache exists. Users see an empty left panel ("No zone found") until they manually trigger fetch-all — a 30-second to 4-minute wait with no entity list.

### Solution: Derive Entity Stubs from Warm Cache Orders

The warm cache (`warm-cache.ts`) populates `orders_ytd:ytd` on server startup with all YTD orders. This data is already in Redis. We can use it to derive entity stubs for any dimension on the fly, matching the customer flow pattern (lightweight initial fetch → user clicks for details).

#### New file: `server/src/services/entity-stub-builder.ts`

```typescript
// FILE: server/src/services/entity-stub-builder.ts
// PURPOSE: Derive entity list stubs from cached warm-cache orders for non-customer dimensions
// USED BY: server/src/routes/entities.ts (cold cache fallback)
// EXPORTS: deriveEntityStubs

import { redis } from '../cache/redis-client.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { fetchCustomers } from './priority-queries.js';
import { priorityClient } from './priority-instance.js';
import { groupByDimension } from './dimension-grouper.js';
import type { RawOrder } from './priority-queries.js';
import type { Dimension, EntityListItem } from '@shared/types/dashboard';

interface EntityStubResult {
  entities: EntityListItem[];
  yearsAvailable: string[];
}

/**
 * Derive entity stubs from the warm-cache orders_ytd data.
 * Returns null if orders_ytd is not yet cached (rare — warm cache runs on startup).
 */
export async function deriveEntityStubs(
  groupBy: Dimension,
  period: string,
): Promise<EntityStubResult | null> {
  // Read warm-cache orders
  const ordersKey = cacheKey('orders_ytd', 'ytd');
  const ordersCached = await redis.get(ordersKey);
  if (!ordersCached) {
    console.warn(`[entity-stub-builder] orders_ytd cache miss — warm cache may not have run yet`);
    return null;
  }

  const envelope = typeof ordersCached === 'string' ? JSON.parse(ordersCached) : ordersCached;
  const orders: RawOrder[] = (envelope as { data: RawOrder[] }).data;

  // Fetch customers (uses its own cache — fast)
  const customersResult = await cachedFetch(
    cacheKey('customers', 'all'), getTTL('customers'),
    () => fetchCustomers(priorityClient),
  );

  const now = new Date();
  const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
  const entities = groupByDimension(groupBy, orders, customersResult.data, periodMonths);

  const years = new Set(orders.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
  const yearsAvailable = [...years].sort().reverse();

  return { entities, yearsAvailable };
}
```

#### Changes to `entities.ts`

Replace lines 58-61:

Before:
```typescript
if (groupBy !== 'customer') {
  return { entities: [], yearsAvailable: [] };
}
```

After:
```typescript
if (groupBy !== 'customer') {
  const stubs = await deriveEntityStubs(groupBy as Dimension, period);
  return stubs ?? { entities: [], yearsAvailable: [] };
}
```

### Historical Periods

For `period=2025` (historical), `orders_ytd` only has current-year data. The entity list will be based on YTD orders, which may not include all entities that existed in 2025. This is acceptable:
- Historical periods are a secondary use case
- Users can trigger fetch-all to get the complete historical entity list
- The YTD-based stubs still provide a non-empty starting point

### Files Changed

| File | Change |
|------|--------|
| `server/src/services/entity-stub-builder.ts` | **NEW** (~50 lines) |
| `server/src/routes/entities.ts` | Import + call `deriveEntityStubs` on cache miss for non-customer dimensions |

---

## Fix 4: Consolidated View Uses Real Multi-Entity Data (High)

### Problem

"View Consolidated" (SelectionBar button) only sets `isConsolidated=true` (useEntitySelection.ts:34). It does not change the data source. `useDashboardDetail` still fetches for the single `activeEntityId`. The `aggregateForConsolidated()` function then filters that single-entity response by `selectedIds` — but since the response contains only one entity's data, the aggregation is meaningless.

The backend ALREADY supports `entityIds` (dashboard.ts:41-64), but the client never sends it.

### Solution

#### Server: Make `entityIds` filtering dimension-aware

Currently `dashboard.ts:51` hardcodes:
```typescript
const filteredOrders = allOrders.filter(o => entitySet.has(o.CUSTNAME));
```

This only works for the customer dimension. For other dimensions, we need dimension-aware filtering:

```typescript
function filterOrdersByEntityIds(
  orders: RawOrder[],
  entityIds: Set<string>,
  dimension: Dimension,
  customers: RawCustomer[],
): RawOrder[] {
  switch (dimension) {
    case 'customer':
      return orders.filter(o => entityIds.has(o.CUSTNAME));
    case 'zone': {
      // WHY: Zone entity IDs are ZONECODE values. Find customers in those zones.
      const custInZones = new Set(
        customers.filter(c => entityIds.has(c.ZONECODE)).map(c => c.CUSTNAME),
      );
      return orders.filter(o => custInZones.has(o.CUSTNAME));
    }
    case 'vendor':
      // Entity ID = Y_1159_5_ESH (vendor code on order items)
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i => entityIds.has(i.Y_1159_5_ESH ?? '')),
      );
    case 'brand':
      // Entity ID = Y_9952_5_ESH (brand name on order items)
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i => entityIds.has(i.Y_9952_5_ESH ?? '')),
      );
    case 'product_type':
      // Entity ID = Y_3020_5_ESH (product type code) or Y_3021_5_ESH (name)
      // groupByProductType uses code as ID with name fallback
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i => entityIds.has(i.Y_3020_5_ESH ?? i.Y_3021_5_ESH ?? '')),
      );
    case 'product':
      // Entity ID = PARTNAME (SKU)
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i => entityIds.has(i.PARTNAME)),
      );
    default:
      return orders;
  }
}
```

Field mapping reference (from `dimension-grouper-items.ts`):
- **Vendor**: ID = `item.Y_1159_5_ESH`, name = `item.Y_1530_5_ESH`
- **Brand**: ID = `item.Y_9952_5_ESH` (brand name used as both ID and name)
- **Product Type**: ID = `item.Y_3020_5_ESH` (code), name = `item.Y_3021_5_ESH`
- **Product**: ID = `item.PARTNAME` (SKU), name = `item.PDES`

This replaces the hardcoded `o.CUSTNAME` filter at line 51.

Also update the `rawKey` at line 46: currently `cacheKey('orders_raw', period, groupBy + ':all')`. After Fix 1, this should use `buildFilterQualifier(groupBy, 'all')` for consistency.

#### Client: New consolidated data hook

**File: `client/src/hooks/useDashboardData.ts`**

Add a new hook:
```typescript
export function useConsolidatedDashboard(params: {
  entityIds: string[];
  groupBy: Dimension;
  period: string;
  enabled: boolean;
}) {
  const idsParam = params.entityIds.sort().join(',');
  return useQuery({
    queryKey: ['dashboard', 'consolidated', idsParam, params.groupBy, params.period],
    queryFn: () => fetchJson<ApiResponse<DashboardPayload>>(
      `/api/sales/dashboard?entityIds=${encodeURIComponent(idsParam)}&groupBy=${params.groupBy}&period=${params.period}`
    ),
    enabled: params.enabled && params.entityIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
```

**File: `client/src/hooks/useDashboardState.ts`**

Wire up the consolidated hook:

```typescript
// Stage 3: Consolidated data for multi-select (on-demand)
const consolidatedQuery = useConsolidatedDashboard({
  entityIds: selectedIdsArray,
  groupBy: activeDimension,
  period: activePeriod,
  enabled: isConsolidated && selectedIdsArray.length > 0,
});
const consolidatedDashboard = consolidatedQuery.data?.data ?? null;
```

Replace the `finalDashboard` memo (lines 88-96):
```typescript
const finalDashboard = useMemo(() => {
  // Consolidated mode: use server-aggregated multi-entity data
  if (isConsolidated && consolidatedDashboard) {
    return { ...consolidatedDashboard, entities: processedEntities };
  }
  // Single entity mode
  if (!dashboard) return null;
  return { ...dashboard, entities: processedEntities };
}, [dashboard, consolidatedDashboard, isConsolidated, processedEntities]);
```

**File: `client/src/utils/aggregation.ts`**

Remove `aggregateForConsolidated()` — no longer needed. The server handles aggregation for the consolidated view.

### Loading State

When the user clicks "View Consolidated", the consolidated query fires. While loading, show a loading indicator in the right panel (same pattern as `detailQuery.isLoading`). Add `isConsolidatedLoading: consolidatedQuery.isLoading` to the returned state.

### Files Changed

| File | Change |
|------|--------|
| `server/src/routes/dashboard.ts` | Replace hardcoded `o.CUSTNAME` filter with dimension-aware `filterOrdersByEntityIds` |
| `client/src/hooks/useDashboardData.ts` | Add `useConsolidatedDashboard` hook |
| `client/src/hooks/useDashboardState.ts` | Wire consolidated hook, replace client-side aggregation |
| `client/src/utils/aggregation.ts` | Remove `aggregateForConsolidated` (dead code after fix) |

---

## Implementation Order

```
Phase 1: Fix 1 (cache keys)           — foundation, must be first
Phase 2: Fix 3 (cold cache stubs)     — low-risk, immediate UX win
Phase 3: Fix 2 (zone/type filters)    — depends on Fix 1's key format
Phase 4: Fix 4 (consolidated view)    — independent, can overlap with Phase 2-3
```

## Verification Plan

### Fix 1: Cache Key Contamination
1. Run fetch-all with `agentName=TestAgent`
2. Inspect Redis: `dashboard:entities_full:ytd:customer:agent=TestAgent` exists
3. Run fetch-all with no filters
4. Inspect Redis: `dashboard:entities_full:ytd:customer:all` exists as a SEPARATE key
5. `/entities?groupBy=customer` returns the unfiltered list (from `:all` key)

### Fix 2: Zone/CustomerType Filters
1. Open FetchAllDialog, select zone="North" only
2. Verify SSE response contains only orders from customers in the North zone
3. Inspect Redis: key includes `zone=North` in qualifier
4. Compare entity count with unfiltered run — should be smaller

### Fix 3: Cold Cache Left Panel
1. Flush Redis: `redis-cli FLUSHALL`
2. Restart server (triggers warm cache)
3. Wait for warm cache to complete (~30s)
4. Navigate to Zone dimension
5. Left panel shows zone entities with metrics within 1-2 seconds (no fetch-all needed)
6. Click a zone — right panel loads zone detail

### Fix 4: Consolidated View
1. Navigate to Customer dimension, ensure data is loaded
2. Check 3 customer checkboxes
3. Click "View Consolidated" in SelectionBar
4. Right panel shows KPIs for ALL 3 customers combined
5. Verify: total revenue = sum of 3 customers' revenues
6. Uncheck one customer, click "View Consolidated" again — KPIs update

### Integration
1. Run full pre-deploy verification:
   ```bash
   cd client && npx tsc -b --noEmit
   cd ../server && npx tsc --noEmit
   cd ../server && npx vitest run
   cd ../client && npx vite build
   ```
2. Verify no `any` types: `grep -rn ": any\|as any" server/src/ client/src/`
3. Verify no files >200 lines

## Files Summary

| File | Action | Fix |
|------|--------|-----|
| `server/src/cache/cache-keys.ts` | Modify | Fix 1: add `buildFilterQualifier` |
| `server/src/routes/fetch-all.ts` | Modify | Fix 1 + Fix 2: filter-aware key + post-fetch filtering |
| `server/src/routes/entities.ts` | Modify | Fix 1 + Fix 3: filter-aware key read + stub derivation |
| `server/src/services/customer-filter.ts` | **New** | Fix 2: ~40 lines |
| `server/src/services/entity-stub-builder.ts` | **New** | Fix 3: ~50 lines |
| `server/src/routes/dashboard.ts` | Modify | Fix 4: dimension-aware entityIds filtering |
| `client/src/hooks/useDashboardData.ts` | Modify | Fix 4: add `useConsolidatedDashboard` hook |
| `client/src/hooks/useDashboardState.ts` | Modify | Fix 4: wire consolidated hook |
| `client/src/utils/aggregation.ts` | Remove/simplify | Fix 4: dead code after server-side aggregation |
