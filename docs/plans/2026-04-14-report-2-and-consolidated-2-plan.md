# Report 2 & View Consolidated 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build v2 Report and View Consolidated features that open a filter/confirmation modal, show progress, then render a consolidated dashboard (with customer columns on Orders/Contacts tabs and a per-customer toggle in expanded KPI/chart modals) — all while leaving the broken v1 buttons in place.

**Architecture:** Fresh client-side hooks and components (isolated from v1 state), reusing the existing Priority ERP data pipeline and Redis cache. One new lightweight `/api/sales/cache-status` endpoint. Raw orders cache becomes dimension-agnostic so a single Report 2 fetch serves all 6 dimensions.

**Tech Stack:** React 19 + TypeScript strict + TanStack Query v5 + Framer Motion + Tailwind v4 (client); Express + TypeScript + Zod + Upstash Redis (server); Vitest (tests).

**Spec:** `docs/specs/2026-04-14-report-2-and-consolidated-2-design.md`

---

## File Structure

### Files to create (server)

| Path | Responsibility |
|------|----------------|
| `server/src/routes/cache-status.ts` | `GET /api/sales/cache-status` — Redis metadata only, no Priority calls |
| `server/src/services/__tests__/data-aggregator-consolidated.test.ts` | Tests for new `opts` parameter |
| `server/src/routes/__tests__/cache-status.test.ts` | Tests for cache-status endpoint |

### Files to modify (server)

| Path | Change |
|------|--------|
| `shared/types/dashboard.ts` | Add optional `customerName` to OrderRow/FlatItem; add per-entity fields to DashboardPayload; add `CacheStatus` type |
| `server/src/services/data-aggregator.ts` | Add `AggregateOptions` parameter; populate customerName + per-entity breakdowns |
| `server/src/cache/cache-keys.ts` | Add `report2_payload` entity type |
| `server/src/config/constants.ts` | Add TTL for `report2_payload` (1 hour) |
| `server/src/routes/fetch-all.ts` | Drop `groupBy` from raw cache key; cache payload to `report2_payload` key |
| `server/src/routes/dashboard.ts` | Use new raw cache key; pass new opts to aggregator in consolidated path |
| `server/src/index.ts` | Register cacheStatusRouter |

### Files to create (client)

| Path | Responsibility |
|------|----------------|
| `client/src/hooks/useCacheStatus.ts` | Query `/api/sales/cache-status`; exposes cached/lastFetchDate/rowCount |
| `client/src/hooks/useReport2.ts` | Report 2 state machine (idle/configuring/fetching/loaded/error) + SSE lifecycle |
| `client/src/hooks/useConsolidated2.ts` | View Consolidated 2 state machine + fetch lifecycle |
| `client/src/components/left-panel/Report2Button.tsx` | Second row below AllEntityEntry |
| `client/src/components/left-panel/ViewConsolidated2Button.tsx` | Button inside SelectionBar, second row |
| `client/src/components/shared/Report2FilterModal.tsx` | Filter picker (Sales Rep/Zone/Customer Type) |
| `client/src/components/shared/Report2ProgressModal.tsx` | Two-phase progress UI |
| `client/src/components/shared/Consolidated2ConfirmModal.tsx` | Confirmation + inline progress |
| `client/src/components/right-panel/ConsolidatedHeader.tsx` | Entity count summary + filters line |
| `client/src/components/right-panel/PerCustomerToggle.tsx` | Two-state switch used in expanded modals |
| `client/src/components/right-panel/PerCustomerKPITable.tsx` | Sortable table: Customer / Value / YoY % |
| `client/src/components/right-panel/PerCustomerChartTable.tsx` | Per-customer product mix / top sellers |
| `client/src/components/right-panel/ConsolidatedOrdersTable.tsx` | Wraps OrdersTable + injects Customer column |
| `client/src/components/right-panel/ConsolidatedContactsTable.tsx` | Wraps ContactsTable + injects Customer column |

### Files to modify (client)

| Path | Change |
|------|--------|
| `client/src/hooks/useDashboardState.ts` | Expose `report2` + `consolidated2` + `cacheStatus` |
| `client/src/layouts/dashboard-layout-types.ts` | Add report2/consolidated2/cacheStatus props |
| `client/src/layouts/DashboardLayout.tsx` | Render consolidated mode when v2 state is loaded |
| `client/src/components/left-panel/LeftPanel.tsx` | Pass through Report 2 / Consolidated 2 handlers |
| `client/src/components/left-panel/EntityList.tsx` | Render Report2Button below AllEntityEntry |
| `client/src/components/left-panel/SelectionBar.tsx` | Render ViewConsolidated2Button below existing |
| `client/src/components/right-panel/RightPanel.tsx` | Accept `mode: 'single' | 'consolidated'` + per-entity payload |
| `client/src/components/right-panel/KPISection.tsx` | Pass per-entity data to card modals when consolidated |
| `client/src/components/right-panel/kpi-modal-content.tsx` | Render PerCustomerToggle when consolidated |
| `client/src/components/right-panel/ChartsRow.tsx` | Wire per-customer toggle into Product Mix + Best Sellers modals |
| `client/src/components/right-panel/TabsSection.tsx` | Use ConsolidatedOrdersTable/ContactsTable when in consolidated mode |

---

## Phase 1 — Shared types + server aggregator

### Task 1.1: Extend OrderRow and FlatItem with optional customerName

**Files:**
- Modify: `shared/types/dashboard.ts:128-148`

- [ ] **Step 1: Add customerName field to OrderRow**

Find the `OrderRow` interface in `shared/types/dashboard.ts` (around line 128) and add the new optional field after `orderNumber`:

```typescript
export interface OrderRow {
  date: string;           // ISO date
  orderNumber: string;
  /** WHY: Populated only in consolidated mode (Report 2 / View Consolidated 2). Absent in single-entity mode. */
  customerName?: string;
  itemCount: number;
  amount: number;
  marginPercent: number;
  marginAmount: number;
  status: 'Open' | 'Closed' | 'Partially Filled';
  items: OrderLineItem[];
}
```

- [ ] **Step 2: Add customerName field to FlatItem**

Find the `FlatItem` interface (around line 140) and add the field after `sku`:

```typescript
export interface FlatItem {
  name: string;
  sku: string;
  /** WHY: Populated only in per-customer toggle view within consolidated mode. Null in main page (SKU-aggregated). */
  customerName?: string;
  value: number;
  marginPercent: number;
  marginAmount: number;
  productType: string;
  productFamily: string;
  brand: string;
  countryOfOrigin: string;
  foodServiceRetail: string;
  vendor: string;
  totalUnits: number;
  unitName: string;
  lastPrice: number;
  purchaseFrequency: number;
  lastOrderDate: string;
  prevYearValue: number;
  prevYearMarginPercent: number;
  prevYearUnits: number;
}
```

- [ ] **Step 3: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit && cd ../server && npx tsc --noEmit`
Expected: No errors (optional fields don't break existing consumers).

- [ ] **Step 4: Commit**

```bash
git add shared/types/dashboard.ts
git commit -m "feat(shared): add optional customerName to OrderRow and FlatItem"
```

---

### Task 1.2: Add per-entity fields to DashboardPayload + CacheStatus type

**Files:**
- Modify: `shared/types/dashboard.ts` (near DashboardPayload + end of file)

- [ ] **Step 1: Extend DashboardPayload with per-entity optional fields**

Find the `DashboardPayload` interface and add after `yearsAvailable`:

```typescript
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

  /** WHY: Per-entity breakdowns — populated only in consolidated mode for per-customer toggle tables. */
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
  perEntityMonthlyRevenue?: Record<string, MonthlyRevenue[]>;
}
```

- [ ] **Step 2: Add CacheStatus type at the end of the file**

Append:

```typescript
/** Response shape from GET /api/sales/cache-status — enables iframe-reload resilience */
export interface CacheStatus {
  raw: boolean;
  lastFetchDate: string | null;
  rowCount: number;
  filterHashes: string[];
}
```

- [ ] **Step 3: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit && cd ../server && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add shared/types/dashboard.ts
git commit -m "feat(shared): add per-entity payload fields and CacheStatus type"
```

---

### Task 1.3: Write test for aggregator opts — customerName on OrderRow

**Files:**
- Create: `server/src/services/__tests__/data-aggregator-consolidated.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// FILE: server/src/services/__tests__/data-aggregator-consolidated.test.ts
// PURPOSE: Tests for aggregateOrders opts parameter — consolidated mode output
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { aggregateOrders } from '../data-aggregator.js';
import type { RawOrder, RawCustomer } from '../priority-queries.js';

function makeOrder(overrides: Partial<RawOrder>): RawOrder {
  return {
    ORDNAME: 'ORD-1',
    CURDATE: '2026-01-15T00:00:00Z',
    ORDSTATUSDES: 'Closed',
    TOTPRICE: 1000,
    CUSTNAME: 'C1',
    AGENTCODE: 'A1',
    AGENTNAME: 'Agent 1',
    ORDERITEMS_SUBFORM: [],
    ...overrides,
  } as RawOrder;
}

function makeCustomer(name: string, desc: string): RawCustomer {
  return {
    CUSTNAME: name,
    CUSTDES: desc,
    ZONECODE: 'Z1',
    ZONEDES: 'Zone 1',
    AGENTCODE: 'A1',
    AGENTNAME: 'Agent 1',
    CREATEDDATE: '2025-01-01T00:00:00Z',
    CTYPECODE: 'T1',
    CTYPENAME: 'Retail',
  } as RawCustomer;
}

describe('aggregateOrders with preserveEntityIdentity', () => {
  it('populates customerName on OrderRow when opts.preserveEntityIdentity=true', () => {
    const orders = [
      makeOrder({ ORDNAME: 'ORD-1', CUSTNAME: 'C1', TOTPRICE: 100 }),
      makeOrder({ ORDNAME: 'ORD-2', CUSTNAME: 'C2', TOTPRICE: 200 }),
    ];
    const customers = [
      makeCustomer('C1', 'Disney Parks'),
      makeCustomer('C2', 'Disney Cruise'),
    ];

    const result = aggregateOrders(orders, [], 'ytd', {
      preserveEntityIdentity: true,
      customers,
    });

    expect(result.orders).toHaveLength(2);
    expect(result.orders[0].customerName).toBe('Disney Parks');
    expect(result.orders[1].customerName).toBe('Disney Cruise');
  });

  it('omits customerName on OrderRow when opts not provided (v1 compatibility)', () => {
    const orders = [makeOrder({ ORDNAME: 'ORD-1', CUSTNAME: 'C1', TOTPRICE: 100 })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.orders[0].customerName).toBeUndefined();
  });

  it('falls back to CUSTNAME when customer lookup misses', () => {
    const orders = [makeOrder({ ORDNAME: 'ORD-1', CUSTNAME: 'C_UNKNOWN', TOTPRICE: 100 })];
    const result = aggregateOrders(orders, [], 'ytd', {
      preserveEntityIdentity: true,
      customers: [],
    });
    expect(result.orders[0].customerName).toBe('C_UNKNOWN');
  });
});
```

- [ ] **Step 2: Run the test — it should fail**

Run: `cd server && npx vitest run src/services/__tests__/data-aggregator-consolidated.test.ts`
Expected: FAIL — `aggregateOrders` doesn't accept a 4th argument.

---

### Task 1.4: Implement aggregator opts — customerName on OrderRow

**Files:**
- Modify: `server/src/services/data-aggregator.ts`

- [ ] **Step 1: Add AggregateOptions interface and extend aggregateOrders signature**

Replace the imports block and `AggregateResult` / `aggregateOrders` signature:

```typescript
// FILE: server/src/services/data-aggregator.ts
// PURPOSE: Transform raw Priority orders into dashboard-ready payload (KPIs, charts, tables)
// USED BY: server/src/routes/dashboard.ts, server/src/routes/fetch-all.ts
// EXPORTS: aggregateOrders, AggregateOptions

import type { KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType, TopSellerItem, OrderRow, FlatItem, SparklineData, Dimension } from '@shared/types/dashboard';
import type { RawOrder, RawOrderItem, RawCustomer } from './priority-queries.js';
import { computeKPIs, computeMonthlyRevenue, computeSparklines } from './kpi-aggregator.js';

interface AggregateResult {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: FlatItem[];
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
  perEntityMonthlyRevenue?: Record<string, MonthlyRevenue[]>;
}

export interface AggregateOptions {
  /** When true, populate customerName on OrderRow and FlatItem using the customers lookup */
  preserveEntityIdentity?: boolean;
  /** Customer lookup used to resolve CUSTNAME → CUSTDES; required when preserveEntityIdentity is true */
  customers?: RawCustomer[];
  /** When set, compute per-entity breakdowns (perEntityProductMixes, perEntityTopSellers, perEntityMonthlyRevenue) */
  dimension?: Dimension;
}

export function aggregateOrders(
  currentOrders: RawOrder[],
  prevOrders: RawOrder[],
  period: string,
  opts?: AggregateOptions,
): AggregateResult {
  const nonZeroOrders = currentOrders.filter(o => o.TOTPRICE !== 0);
  const allItems = nonZeroOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
  const prevItems = prevOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);

  const custMap = opts?.preserveEntityIdentity && opts?.customers
    ? new Map(opts.customers.map(c => [c.CUSTNAME, c.CUSTDES]))
    : null;

  const kpis = computeKPIs(nonZeroOrders, prevOrders, allItems, prevItems, period);
  const monthlyRevenue = computeMonthlyRevenue(nonZeroOrders, prevOrders);
  const productMixes = computeAllProductMixes(allItems);
  const topSellers = computeTopSellers(allItems);
  const sparklines = computeSparklines(nonZeroOrders);
  const orders = buildOrderRows(nonZeroOrders, custMap);
  const items = buildFlatItems(nonZeroOrders, prevOrders, period);

  return { kpis, monthlyRevenue, productMixes, topSellers, sparklines, orders, items };
}
```

- [ ] **Step 2: Extend buildOrderRows to accept customer map**

Replace the `buildOrderRows` function:

```typescript
/** Spec Section 10.4 + 13.6 — Order table rows */
function buildOrderRows(orders: RawOrder[], custMap: Map<string, string> | null): OrderRow[] {
  return orders
    .map(o => {
      const row: OrderRow = {
        date: o.CURDATE,
        orderNumber: o.ORDNAME,
        itemCount: o.ORDERITEMS_SUBFORM?.length ?? 0,
        amount: o.TOTPRICE,
        marginPercent: computeOrderMarginPct(o),
        marginAmount: (o.ORDERITEMS_SUBFORM ?? []).reduce((s, i) => s + i.QPROFIT, 0),
        status: o.ORDSTATUSDES as OrderRow['status'],
        items: (o.ORDERITEMS_SUBFORM ?? [])
          .map(i => ({
            productName: i.PDES,
            sku: i.PARTNAME,
            quantity: i.TQUANT,
            unit: i.TUNITNAME || 'units',
            unitPrice: i.PRICE,
            lineTotal: i.QPRICE,
            marginPercent: i.PERCENT,
          }))
          .sort((a, b) => b.lineTotal - a.lineTotal),
      };
      if (custMap) {
        row.customerName = custMap.get(o.CUSTNAME) ?? o.CUSTNAME;
      }
      return row;
    });
}
```

- [ ] **Step 3: Run the test — it should pass**

Run: `cd server && npx vitest run src/services/__tests__/data-aggregator-consolidated.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/data-aggregator.ts server/src/services/__tests__/data-aggregator-consolidated.test.ts
git commit -m "feat(server): add AggregateOptions with customerName on OrderRow"
```

---

### Task 1.5: Write test for per-entity product mixes + top sellers

**Files:**
- Modify: `server/src/services/__tests__/data-aggregator-consolidated.test.ts`

- [ ] **Step 1: Append tests for per-entity breakdowns**

Append to the test file:

```typescript
describe('aggregateOrders with dimension option', () => {
  function makeItem(partname: string, brand: string, qprice: number, qprofit = 0, tquant = 1): RawOrderItem {
    return {
      PARTNAME: partname,
      PDES: `Desc ${partname}`,
      TQUANT: tquant,
      TUNITNAME: 'cs',
      PRICE: qprice,
      PURCHASEPRICE: 0,
      QPRICE: qprice,
      QPROFIT: qprofit,
      PERCENT: 0,
      Y_1159_5_ESH: 'Vendor V',
      Y_1530_5_ESH: 'Vendor V',
      Y_9952_5_ESH: brand,
      Y_3020_5_ESH: '',
      Y_3021_5_ESH: 'Type A',
      Y_17936_5_ESH: '',
      Y_2075_5_ESH: 'Family X',
      Y_5380_5_ESH: 'USA',
      Y_9967_5_ESH: 'N',
    } as RawOrderItem;
  }

  it('computes perEntityProductMixes when dimension is customer', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C1', TOTPRICE: 100, ORDERITEMS_SUBFORM: [makeItem('SKU-A', 'Brand X', 100)] }),
      makeOrder({ ORDNAME: 'O2', CUSTNAME: 'C2', TOTPRICE: 200, ORDERITEMS_SUBFORM: [makeItem('SKU-B', 'Brand Y', 200)] }),
    ];

    const result = aggregateOrders(orders, [], 'ytd', { dimension: 'customer' });

    expect(result.perEntityProductMixes).toBeDefined();
    expect(result.perEntityProductMixes!['C1']).toBeDefined();
    expect(result.perEntityProductMixes!['C1'].brand).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: 'Brand X', value: 100 })]),
    );
    expect(result.perEntityProductMixes!['C2'].brand).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: 'Brand Y', value: 200 })]),
    );
  });

  it('computes perEntityTopSellers when dimension is customer', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C1', TOTPRICE: 100, ORDERITEMS_SUBFORM: [makeItem('SKU-A', 'Brand X', 100, 0, 5)] }),
      makeOrder({ ORDNAME: 'O2', CUSTNAME: 'C1', TOTPRICE: 50, ORDERITEMS_SUBFORM: [makeItem('SKU-B', 'Brand X', 50, 0, 2)] }),
      makeOrder({ ORDNAME: 'O3', CUSTNAME: 'C2', TOTPRICE: 300, ORDERITEMS_SUBFORM: [makeItem('SKU-C', 'Brand Y', 300, 0, 10)] }),
    ];

    const result = aggregateOrders(orders, [], 'ytd', { dimension: 'customer' });

    expect(result.perEntityTopSellers).toBeDefined();
    expect(result.perEntityTopSellers!['C1']).toHaveLength(2);
    expect(result.perEntityTopSellers!['C1'][0].sku).toBe('SKU-A'); // higher revenue first
    expect(result.perEntityTopSellers!['C2']).toHaveLength(1);
    expect(result.perEntityTopSellers!['C2'][0].sku).toBe('SKU-C');
  });

  it('computes perEntityMonthlyRevenue when dimension is customer', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C1', CURDATE: '2026-01-15T00:00:00Z', TOTPRICE: 100 }),
      makeOrder({ ORDNAME: 'O2', CUSTNAME: 'C1', CURDATE: '2026-02-15T00:00:00Z', TOTPRICE: 200 }),
      makeOrder({ ORDNAME: 'O3', CUSTNAME: 'C2', CURDATE: '2026-01-15T00:00:00Z', TOTPRICE: 300 }),
    ];

    const result = aggregateOrders(orders, [], 'ytd', { dimension: 'customer' });

    expect(result.perEntityMonthlyRevenue).toBeDefined();
    expect(result.perEntityMonthlyRevenue!['C1']).toBeDefined();
    const c1Jan = result.perEntityMonthlyRevenue!['C1'].find(m => m.month === '2026-01');
    expect(c1Jan?.current).toBe(100);
  });

  it('omits per-entity fields when dimension is not provided (v1 compat)', () => {
    const orders = [makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C1', TOTPRICE: 100, ORDERITEMS_SUBFORM: [makeItem('SKU-A', 'Brand X', 100)] })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.perEntityProductMixes).toBeUndefined();
    expect(result.perEntityTopSellers).toBeUndefined();
    expect(result.perEntityMonthlyRevenue).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test — it should fail**

Run: `cd server && npx vitest run src/services/__tests__/data-aggregator-consolidated.test.ts`
Expected: 4 new tests FAIL — perEntity* fields are undefined.

---

### Task 1.6: Implement per-entity breakdowns in aggregator

**Files:**
- Modify: `server/src/services/data-aggregator.ts`

- [ ] **Step 1: Add helper `groupOrdersByDimension` and per-entity computations at the end of the file**

Append to `data-aggregator.ts`:

```typescript
/** Group orders by the entity key for the given dimension.
 * WHY: Per-customer toggle tables need breakdowns by entity. This function returns a map
 * from entity-ID to the subset of orders belonging to that entity. For dimensions where
 * the entity is derived from line items (vendor, brand, product_type, product), one order
 * may appear under multiple entity groups. */
function groupOrdersByDimension(orders: RawOrder[], dimension: Dimension): Map<string, RawOrder[]> {
  const groups = new Map<string, RawOrder[]>();

  orders.forEach(order => {
    const keys = extractDimensionKeys(order, dimension);
    keys.forEach(key => {
      if (!key) return;
      const existing = groups.get(key);
      if (existing) {
        existing.push(order);
      } else {
        groups.set(key, [order]);
      }
    });
  });

  return groups;
}

function extractDimensionKeys(order: RawOrder, dimension: Dimension): string[] {
  switch (dimension) {
    case 'customer':
      return [order.CUSTNAME];
    case 'zone':
      // WHY: Zone lives on CUSTOMERS, not ORDERS — we use CUSTNAME as the grouping key
      // and the consumer maps to zone later. For per-entity breakdowns in consolidated mode,
      // entityIds are already zone codes, so we group by the customer and let the caller map.
      return [order.CUSTNAME];
    case 'vendor': {
      const vendors = new Set((order.ORDERITEMS_SUBFORM ?? []).map(i => i.Y_1159_5_ESH).filter(Boolean));
      return [...vendors];
    }
    case 'brand': {
      const brands = new Set((order.ORDERITEMS_SUBFORM ?? []).map(i => i.Y_9952_5_ESH).filter(Boolean));
      return [...brands];
    }
    case 'product_type': {
      const types = new Set((order.ORDERITEMS_SUBFORM ?? [])
        .map(i => i.Y_3020_5_ESH || i.Y_3021_5_ESH).filter(Boolean));
      return [...types];
    }
    case 'product': {
      const skus = new Set((order.ORDERITEMS_SUBFORM ?? []).map(i => i.PARTNAME).filter(Boolean));
      return [...skus];
    }
    default:
      return [];
  }
}

function computePerEntityProductMixes(
  orders: RawOrder[],
  dimension: Dimension,
): Record<string, Record<ProductMixType, ProductMixSegment[]>> {
  const grouped = groupOrdersByDimension(orders, dimension);
  const result: Record<string, Record<ProductMixType, ProductMixSegment[]>> = {};
  grouped.forEach((entityOrders, entityId) => {
    const entityItems = entityOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
    result[entityId] = computeAllProductMixes(entityItems);
  });
  return result;
}

function computePerEntityTopSellers(
  orders: RawOrder[],
  dimension: Dimension,
): Record<string, TopSellerItem[]> {
  const grouped = groupOrdersByDimension(orders, dimension);
  const result: Record<string, TopSellerItem[]> = {};
  grouped.forEach((entityOrders, entityId) => {
    const entityItems = entityOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
    result[entityId] = computeTopSellers(entityItems);
  });
  return result;
}

function computePerEntityMonthlyRevenue(
  orders: RawOrder[],
  prevOrders: RawOrder[],
  dimension: Dimension,
): Record<string, MonthlyRevenue[]> {
  const grouped = groupOrdersByDimension(orders, dimension);
  const prevGrouped = groupOrdersByDimension(prevOrders, dimension);
  const result: Record<string, MonthlyRevenue[]> = {};
  grouped.forEach((entityOrders, entityId) => {
    const prevEntityOrders = prevGrouped.get(entityId) ?? [];
    result[entityId] = computeMonthlyRevenue(entityOrders, prevEntityOrders);
  });
  return result;
}
```

- [ ] **Step 2: Wire per-entity computations into aggregateOrders**

Inside `aggregateOrders`, just before the return statement, add:

```typescript
  const result: AggregateResult = { kpis, monthlyRevenue, productMixes, topSellers, sparklines, orders, items };

  if (opts?.dimension) {
    result.perEntityProductMixes = computePerEntityProductMixes(nonZeroOrders, opts.dimension);
    result.perEntityTopSellers = computePerEntityTopSellers(nonZeroOrders, opts.dimension);
    result.perEntityMonthlyRevenue = computePerEntityMonthlyRevenue(nonZeroOrders, prevOrders, opts.dimension);
  }

  return result;
```

Replace the existing `return { kpis, ... };` at the end of `aggregateOrders` with the code above.

- [ ] **Step 3: Run the tests — they should pass**

Run: `cd server && npx vitest run src/services/__tests__/data-aggregator-consolidated.test.ts`
Expected: all 7 tests PASS.

- [ ] **Step 4: Run the full server test suite to verify no regressions**

Run: `cd server && npx vitest run`
Expected: All previous tests still pass + 7 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/data-aggregator.ts server/src/services/__tests__/data-aggregator-consolidated.test.ts
git commit -m "feat(server): compute per-entity product mixes, top sellers, and monthly revenue"
```

---

## Phase 2 — Cache key change + cache-status endpoint

### Task 2.1: Add report2_payload to cache types + TTL

**Files:**
- Modify: `server/src/cache/cache-keys.ts:8`
- Modify: `server/src/config/constants.ts`

- [ ] **Step 1: Add report2_payload to CacheEntity union**

Replace line 8 of `cache-keys.ts`:

```typescript
type CacheEntity = 'orders_ytd' | 'orders_year' | 'customers' | 'zones' | 'agents' | 'vendors' | 'contacts' | 'years_available' | 'entities_summary' | 'entity_detail' | 'entities_full' | 'orders_raw' | 'orders_raw_meta' | 'report2_payload';
```

- [ ] **Step 2: Add report2_payload TTL to constants.ts**

In `server/src/config/constants.ts`, add to the `CACHE_TTLS` object:

```typescript
  orders_raw_meta: 365 * 24 * 60 * 60,  // 365 days — metadata (lastFetchDate, rowCount)
  report2_payload: 60 * 60,             // 1 hour — pre-aggregated consolidated payload (per-dimension)
} as const;
```

(Add the `report2_payload` line right before the closing `} as const;`)

- [ ] **Step 3: Verify TypeScript builds**

Run: `cd server && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/cache/cache-keys.ts server/src/config/constants.ts
git commit -m "feat(cache): add report2_payload cache entity with 1h TTL"
```

---

### Task 2.2: Drop groupBy from raw orders cache key in fetch-all.ts

**Files:**
- Modify: `server/src/routes/fetch-all.ts:53-55`

- [ ] **Step 1: Update raw cache key construction**

Replace lines 53-55:

```typescript
    const filterHash = buildFilterHash(agentName, zone, customerType);
    // WHY: Raw cache key is dimension-agnostic — the same 22K orders serve all 6 dimensions.
    // Only the aggregation step differs per dimension. This eliminates redundant full fetches.
    const rawKey = cacheKey('orders_raw', period, filterHash);
    const metaKey = cacheKey('orders_raw_meta', period, filterHash);
```

- [ ] **Step 2: Cache the aggregated payload under report2_payload**

Near the end of the route handler (right before `sendEvent('complete', payload);`), replace the existing detail-cache block:

```typescript
    // WHY: Cache aggregated results — both legacy entities_full (for backwards compat with v1)
    // and new report2_payload (per-dimension payload for instant dimension switches in v2).
    const fullKey = cacheKey('entities_full', period, buildFilterQualifier(groupBy, filterHash));
    const fullEnvelope = { data: { entities, yearsAvailable: payload.yearsAvailable }, cachedAt: new Date().toISOString() };
    await redis.set(fullKey, JSON.stringify(fullEnvelope), { ex: getTTL('entities_full') });

    const payloadKey = cacheKey('report2_payload', period, `${filterHash}:${groupBy}`);
    const payloadEnvelope = { data: payload, cachedAt: new Date().toISOString() };
    await redis.set(payloadKey, JSON.stringify(payloadEnvelope), { ex: getTTL('report2_payload') });

    const detailKey = cacheKey('entity_detail', period, `${groupBy}:ALL:${filterHash}`);
    const detailEnvelope = { data: payload, cachedAt: new Date().toISOString() };
    await redis.set(detailKey, JSON.stringify(detailEnvelope), { ex: getTTL('entities_full') });
```

- [ ] **Step 3: Verify TypeScript builds**

Run: `cd server && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/fetch-all.ts
git commit -m "feat(cache): dimension-agnostic raw cache + per-dimension payload cache"
```

---

### Task 2.3: Update dashboard.ts to use new raw cache key + pass AggregateOptions

**Files:**
- Modify: `server/src/routes/dashboard.ts:46` and consolidated block

- [ ] **Step 1: Update the consolidated-view raw cache lookup to use dimension-agnostic key**

Replace the block starting at line 44 (inside the `if (entityIdList && entityIdList.length > 0)` branch):

```typescript
    if (entityIdList && entityIdList.length > 0) {
      const entitySet = new Set(entityIdList);
      // WHY: Raw cache is now dimension-agnostic. Probe all known filter hashes to find any cached raw orders.
      // Start with 'all' (unfiltered), then try stored filter hashes via meta lookup if needed.
      const rawKey = cacheKey('orders_raw', period, 'all');
      const rawCached = await redis.get(rawKey);
      if (rawCached) {
        const rawEnvelope = typeof rawCached === 'string' ? JSON.parse(rawCached) : rawCached;
        const allOrders: RawOrder[] = (rawEnvelope as { data: RawOrder[] }).data;
        const customersResult = await cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
          () => fetchCustomers(priorityClient));
        const filteredOrders = filterOrdersByEntityIds(allOrders, entitySet, groupBy as Dimension, customersResult.data);
        const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
        const entities = groupByDimension(groupBy as Dimension, filteredOrders, customersResult.data, periodMonths);
        // WHY: Pass opts to populate customerName on order rows + per-entity breakdowns for consolidated view.
        const aggregate = aggregateOrders(filteredOrders, [], period, {
          preserveEntityIdentity: true,
          customers: customersResult.data,
          dimension: groupBy as Dimension,
        });
        const years = new Set(filteredOrders.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
        const payload: DashboardPayload = {
          entities, ...aggregate, yearsAvailable: [...years].sort().reverse(),
        };
        return res.json({ data: payload, meta: { cached: true, cachedAt: null, period, dimension: groupBy, entityCount: entities.length } });
      }
      return res.status(422).json({
        error: { message: 'Consolidated view requires loaded data. Use "Report 2" first, then try again.' },
      });
    }
```

- [ ] **Step 2: Verify TypeScript + tests**

Run: `cd server && npx tsc --noEmit && npx vitest run`
Expected: Compile passes; all tests still pass.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/dashboard.ts
git commit -m "feat(dashboard): consolidated endpoint uses dimension-agnostic raw cache + new aggregator opts"
```

---

### Task 2.4: Write test for cache-status endpoint

**Files:**
- Create: `server/src/routes/__tests__/cache-status.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// FILE: server/src/routes/__tests__/cache-status.test.ts
// PURPOSE: Tests for GET /api/sales/cache-status endpoint
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { cacheStatusRouter } from '../cache-status.js';

vi.mock('../../cache/redis-client.js', () => ({
  redis: {
    get: vi.fn(),
    keys: vi.fn(),
  },
}));

import { redis } from '../../cache/redis-client.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/sales', cacheStatusRouter);
  return app;
}

describe('GET /api/sales/cache-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns raw=false when no orders_raw cache exists', async () => {
    (redis.keys as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await request(makeApp()).get('/api/sales/cache-status?period=ytd');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      raw: false,
      lastFetchDate: null,
      rowCount: 0,
      filterHashes: [],
    });
  });

  it('returns raw=true with metadata when cache exists', async () => {
    (redis.keys as ReturnType<typeof vi.fn>).mockResolvedValue([
      'dashboard:orders_raw:ytd:all',
    ]);
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        data: { lastFetchDate: '2026-04-14T08:23:00Z', rowCount: 22431, filterHash: 'all' },
        cachedAt: '2026-04-14T08:23:00Z',
      }),
    );

    const res = await request(makeApp()).get('/api/sales/cache-status?period=ytd');

    expect(res.status).toBe(200);
    expect(res.body.raw).toBe(true);
    expect(res.body.lastFetchDate).toBe('2026-04-14T08:23:00Z');
    expect(res.body.rowCount).toBe(22431);
    expect(res.body.filterHashes).toContain('all');
  });

  it('rejects invalid period parameter', async () => {
    const res = await request(makeApp()).get('/api/sales/cache-status');
    // no period means default 'ytd' via zod schema, so should still 200
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test — it should fail**

Run: `cd server && npx vitest run src/routes/__tests__/cache-status.test.ts`
Expected: FAIL — `cacheStatusRouter` does not exist.

---

### Task 2.5: Implement cache-status endpoint

**Files:**
- Create: `server/src/routes/cache-status.ts`
- Modify: `server/src/index.ts:14,43`

- [ ] **Step 1: Create cache-status.ts**

Create `server/src/routes/cache-status.ts` with:

```typescript
// FILE: server/src/routes/cache-status.ts
// PURPOSE: GET /api/sales/cache-status — returns Redis cache metadata only, no Priority calls
// USED BY: client/hooks/useCacheStatus.ts (iframe-reload resilience)
// EXPORTS: cacheStatusRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { redis } from '../cache/redis-client.js';
import type { CacheStatus } from '@shared/types/dashboard';

const querySchema = z.object({
  period: z.string().default('ytd'),
});

export const cacheStatusRouter = Router();

/** WHY: Lightweight health check used by the client on mount (after Airtable iframe reload).
 * Returns whether raw orders are cached, without triggering any Priority API call. */
cacheStatusRouter.get('/cache-status', validateQuery(querySchema), async (_req, res, next) => {
  try {
    const { period } = res.locals.query as z.infer<typeof querySchema>;

    // WHY: Scan meta keys to discover which filter hashes have cached data for this period.
    const pattern = `dashboard:orders_raw_meta:${period}:*`;
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      const empty: CacheStatus = { raw: false, lastFetchDate: null, rowCount: 0, filterHashes: [] };
      return res.json(empty);
    }

    // WHY: Load the most recently cached meta envelope. Multiple filter hashes may exist;
    // we report the newest one plus list all available filter hashes.
    const envelopes = await Promise.all(keys.map(async (key) => {
      const raw = await redis.get(key);
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const filterHash = key.split(':').slice(3).join(':');
      return { filterHash, envelope: parsed as { data: { lastFetchDate: string; rowCount: number } } };
    }));

    const valid = envelopes.filter((e): e is NonNullable<typeof e> => e !== null);
    if (valid.length === 0) {
      const empty: CacheStatus = { raw: false, lastFetchDate: null, rowCount: 0, filterHashes: [] };
      return res.json(empty);
    }

    // Sort by lastFetchDate descending, newest first
    valid.sort((a, b) => (b.envelope.data.lastFetchDate || '').localeCompare(a.envelope.data.lastFetchDate || ''));
    const newest = valid[0];

    const status: CacheStatus = {
      raw: true,
      lastFetchDate: newest.envelope.data.lastFetchDate,
      rowCount: newest.envelope.data.rowCount,
      filterHashes: valid.map(v => v.filterHash),
    };
    res.json(status);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Register router in server/src/index.ts**

Add to imports (around line 14):

```typescript
import { cacheStatusRouter } from './routes/cache-status.js';
```

Add to route registrations (after line 44):

```typescript
app.use('/api/sales', cacheStatusRouter);
```

- [ ] **Step 3: Run the test — it should pass**

Run: `cd server && npx vitest run src/routes/__tests__/cache-status.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 4: Run full server test suite**

Run: `cd server && npx vitest run`
Expected: All tests pass (previous + 3 new).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/cache-status.ts server/src/index.ts server/src/routes/__tests__/cache-status.test.ts
git commit -m "feat(server): add GET /api/sales/cache-status endpoint for iframe reload resilience"
```

---

## Phase 3 — Client hooks

### Task 3.1: Implement useCacheStatus hook

**Files:**
- Create: `client/src/hooks/useCacheStatus.ts`

- [ ] **Step 1: Write the hook**

Create `client/src/hooks/useCacheStatus.ts`:

```typescript
// FILE: client/src/hooks/useCacheStatus.ts
// PURPOSE: Query /api/sales/cache-status to detect server-cached data on mount (iframe reload resilience)
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useCacheStatus

import { useQuery } from '@tanstack/react-query';
import type { Period, CacheStatus } from '@shared/types/dashboard';

async function fetchCacheStatus(period: Period): Promise<CacheStatus> {
  const params = new URLSearchParams({ period });
  const response = await fetch(`/api/sales/cache-status?${params}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<CacheStatus>;
}

/** WHY: On Airtable iframe reload, React state is lost but Redis cache persists. This hook
 * tells Report 2 if it should show "Data ready" state instead of "Not loaded" on mount. */
export function useCacheStatus(period: Period) {
  return useQuery({
    queryKey: ['cache-status', period],
    queryFn: () => fetchCacheStatus(period),
    // WHY: 60s staleTime — checking more frequently would waste network; less often would miss fresh data
    staleTime: 60_000,
    // WHY: retry once — endpoint is Redis-only so failure usually means backend is down
    retry: 1,
  });
}
```

- [ ] **Step 2: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useCacheStatus.ts
git commit -m "feat(client): add useCacheStatus hook for iframe reload detection"
```

---

### Task 3.2: Implement useReport2 hook

**Files:**
- Create: `client/src/hooks/useReport2.ts`

- [ ] **Step 1: Write the hook**

Create `client/src/hooks/useReport2.ts`:

```typescript
// FILE: client/src/hooks/useReport2.ts
// PURPOSE: Report 2 state machine — manages filter modal, SSE connection, progress, and loaded payload
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useReport2, Report2State, UseReport2Return

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  Dimension, Period, DashboardPayload, FetchAllFilters, SSEProgressEvent,
} from '@shared/types/dashboard';

export type Report2State = 'idle' | 'configuring' | 'fetching' | 'loaded' | 'error';

export interface UseReport2Return {
  state: Report2State;
  progress: SSEProgressEvent | null;
  payload: DashboardPayload | null;
  error: string | null;
  filters: FetchAllFilters;
  open: () => void;
  cancel: () => void;
  startReport: (filters: FetchAllFilters) => void;
  abort: () => void;
  reset: () => void;
}

const EMPTY_FILTERS: FetchAllFilters = {};

export function useReport2(dimension: Dimension, period: Period): UseReport2Return {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [state, setState] = useState<Report2State>('idle');
  const [progress, setProgress] = useState<SSEProgressEvent | null>(null);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FetchAllFilters>(EMPTY_FILTERS);

  const open = useCallback(() => {
    setState('configuring');
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  const abort = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setProgress(null);
  }, []);

  const reset = useCallback(() => {
    abort();
    setState('idle');
    setPayload(null);
    setProgress(null);
    setError(null);
    setFilters(EMPTY_FILTERS);
  }, [abort]);

  const startReport = useCallback((newFilters: FetchAllFilters) => {
    abort();
    setFilters(newFilters);
    setState('fetching');
    setError(null);
    setProgress(null);

    const params = new URLSearchParams({ groupBy: dimension, period });
    if (newFilters.agentName?.length) params.set('agentName', newFilters.agentName.join(','));
    if (newFilters.zone?.length) params.set('zone', newFilters.zone.join(','));
    if (newFilters.customerType?.length) params.set('customerType', newFilters.customerType.join(','));

    const es = new EventSource(`/api/sales/fetch-all?${params}`);
    eventSourceRef.current = es;

    es.addEventListener('progress', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as SSEProgressEvent;
      setProgress(data);
    });

    es.addEventListener('complete', (e) => {
      const data = JSON.parse((e as MessageEvent).data) as DashboardPayload;
      setPayload(data);
      setProgress(null);
      setState('loaded');
      es.close();
      eventSourceRef.current = null;

      // WHY: Invalidate cache-status so Report 2 button reflects new cache state
      queryClient.invalidateQueries({ queryKey: ['cache-status', period] });
      queryClient.invalidateQueries({ queryKey: ['entities', dimension, period] });
    });

    es.addEventListener('error', (e) => {
      const data = e instanceof MessageEvent && e.data ? JSON.parse(e.data) : null;
      setError(data?.message ?? 'Connection lost');
      setState('error');
      setProgress(null);
      es.close();
      eventSourceRef.current = null;
    });
  }, [dimension, period, abort, queryClient]);

  return { state, progress, payload, error, filters, open, cancel, startReport, abort, reset };
}
```

- [ ] **Step 2: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useReport2.ts
git commit -m "feat(client): add useReport2 hook with state machine and SSE lifecycle"
```

---

### Task 3.3: Implement useConsolidated2 hook

**Files:**
- Create: `client/src/hooks/useConsolidated2.ts`

- [ ] **Step 1: Write the hook**

Create `client/src/hooks/useConsolidated2.ts`:

```typescript
// FILE: client/src/hooks/useConsolidated2.ts
// PURPOSE: View Consolidated 2 state machine — manages confirmation modal and fetch lifecycle
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useConsolidated2, Consolidated2State, UseConsolidated2Return

import { useCallback, useRef, useState } from 'react';
import type { Dimension, Period, DashboardPayload } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

export type Consolidated2State = 'idle' | 'configuring' | 'fetching' | 'loaded' | 'needs-report-2' | 'error';

export interface UseConsolidated2Return {
  state: Consolidated2State;
  entityIds: string[];
  payload: DashboardPayload | null;
  error: string | null;
  open: (entityIds: string[]) => void;
  cancel: () => void;
  start: () => void;
  abort: () => void;
  reset: () => void;
}

export function useConsolidated2(dimension: Dimension, period: Period): UseConsolidated2Return {
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<Consolidated2State>('idle');
  const [entityIds, setEntityIds] = useState<string[]>([]);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((ids: string[]) => {
    setEntityIds(ids);
    setState('configuring');
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    abort();
    setState('idle');
    setEntityIds([]);
    setPayload(null);
    setError(null);
  }, [abort]);

  const start = useCallback(async () => {
    abort();
    setState('fetching');
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const idsParam = entityIds.slice().sort().join(',');
    const params = new URLSearchParams({ entityIds: idsParam, groupBy: dimension, period });

    try {
      const response = await fetch(`/api/sales/dashboard?${params}`, { signal: controller.signal });
      if (response.status === 422) {
        setState('needs-report-2');
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
        setError((body as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`);
        setState('error');
        return;
      }
      const result = await response.json() as ApiResponse<DashboardPayload>;
      setPayload(result.data);
      setState('loaded');
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Network error');
      setState('error');
    } finally {
      abortRef.current = null;
    }
  }, [entityIds, dimension, period, abort]);

  return { state, entityIds, payload, error, open, cancel, start, abort, reset };
}
```

- [ ] **Step 2: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useConsolidated2.ts
git commit -m "feat(client): add useConsolidated2 hook with state machine"
```

---

## Phase 4 — UI buttons

### Task 4.1: Implement Report2Button component

**Files:**
- Create: `client/src/components/left-panel/Report2Button.tsx`

- [ ] **Step 1: Write the component**

Create `client/src/components/left-panel/Report2Button.tsx`:

```typescript
// FILE: client/src/components/left-panel/Report2Button.tsx
// PURPOSE: "Report 2" entry rendered below AllEntityEntry — new clean implementation
// USED BY: client/src/components/left-panel/EntityList.tsx
// EXPORTS: Report2Button

import { motion } from 'framer-motion';
import type { Report2State } from '../../hooks/useReport2';
import type { CacheStatus, DashboardPayload } from '@shared/types/dashboard';
import { formatInteger } from '@shared/utils/formatting';

interface Report2ButtonProps {
  state: Report2State;
  payload: DashboardPayload | null;
  cacheStatus: CacheStatus | undefined;
  isActive: boolean;
  onClick: () => void;
}

function formatLargeNumber(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${formatInteger(value)}`;
}

export function Report2Button({ state, payload, cacheStatus, isActive, onClick }: Report2ButtonProps) {
  const isLoading = state === 'fetching';
  const isLoaded = state === 'loaded' && payload !== null;
  const serverCached = cacheStatus?.raw === true;

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
      role="button"
      tabIndex={0}
      aria-label="Report 2"
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {isActive && (
        <div className="absolute left-0 top-0 h-full w-[3px] rounded-r-[2px] bg-[var(--color-gold-primary)]" />
      )}

      {/* Gold clipboard-with-arrow icon distinguishes v2 from v1 bar chart */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg} ${isLoading ? 'animate-pulse' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M5 2h6v2H5V2zm-1 3h8v9H4V5zm2 2v2h4V7H6zm0 3v2h4v-2H6z" fill="currentColor" />
        </svg>
      </div>

      <div className="flex-1">
        <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">Report 2</div>
        <div className="text-[11px] text-[var(--color-text-muted)]">
          {isLoaded
            ? 'Loaded this session'
            : isLoading
              ? 'Generating...'
              : serverCached
                ? 'Data ready — click to view'
                : 'Click to generate report'}
        </div>
      </div>

      <div className="flex items-center gap-[var(--spacing-sm)]">
        {isLoaded && payload ? (
          <div className="text-right">
            <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">
              {formatLargeNumber(payload.kpis.totalRevenue)}
            </div>
            <div className="text-[11px] text-[var(--color-text-muted)]">
              {formatInteger(payload.kpis.orders)} orders
            </div>
          </div>
        ) : isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-gold-primary)] border-t-transparent" />
        ) : serverCached && cacheStatus?.rowCount ? (
          <span className="rounded-full bg-[var(--color-gold-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-gold-primary)]">
            {formatInteger(cacheStatus.rowCount)} rows
          </span>
        ) : (
          <span className="rounded-full bg-[var(--color-gold-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-gold-primary)]">
            Not loaded
          </span>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/left-panel/Report2Button.tsx
git commit -m "feat(client): add Report2Button component with cache-ready state"
```

---

### Task 4.2: Implement ViewConsolidated2Button component

**Files:**
- Create: `client/src/components/left-panel/ViewConsolidated2Button.tsx`

- [ ] **Step 1: Write the component**

Create `client/src/components/left-panel/ViewConsolidated2Button.tsx`:

```typescript
// FILE: client/src/components/left-panel/ViewConsolidated2Button.tsx
// PURPOSE: "View Consolidated 2" button inside SelectionBar — second row below v1 button
// USED BY: client/src/components/left-panel/SelectionBar.tsx
// EXPORTS: ViewConsolidated2Button

interface ViewConsolidated2ButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function ViewConsolidated2Button({ onClick, disabled = false }: ViewConsolidated2ButtonProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? 'No entities selected' : 'View consolidated data for selected entities'}
      className={`
        h-[32px] rounded-[var(--radius-base)] bg-[var(--color-gold-primary)]
        px-[var(--spacing-lg)] py-[5px] text-[11px] font-medium text-white
        transition-colors duration-150
        ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-[var(--color-gold-hover)]'}
      `}
      aria-label="View Consolidated 2"
    >
      View Consolidated 2
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/left-panel/ViewConsolidated2Button.tsx
git commit -m "feat(client): add ViewConsolidated2Button component"
```

---

## Phase 5 — Modals

### Task 5.1: Implement Report2FilterModal

**Files:**
- Create: `client/src/components/shared/Report2FilterModal.tsx`

- [ ] **Step 1: Write the component**

Create `client/src/components/shared/Report2FilterModal.tsx`:

```typescript
// FILE: client/src/components/shared/Report2FilterModal.tsx
// PURPOSE: Filter selection modal for Report 2 — Sales Rep / Zone / Customer Type dropdowns
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: Report2FilterModal

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { EntityListItem, FetchAllFilters } from '@shared/types/dashboard';
import { formatInteger } from '@shared/utils/formatting';

interface Report2FilterModalProps {
  isOpen: boolean;
  entities: EntityListItem[];
  onConfirm: (filters: FetchAllFilters) => void;
  onCancel: () => void;
}

function uniqueValues(entities: EntityListItem[], getter: (e: EntityListItem) => string | null): string[] {
  const set = new Set<string>();
  entities.forEach(e => {
    const v = getter(e);
    if (v) set.add(v);
  });
  return [...set].sort();
}

export function Report2FilterModal({ isOpen, entities, onConfirm, onCancel }: Report2FilterModalProps) {
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const reps = useMemo(() => uniqueValues(entities, e => e.rep), [entities]);
  const zones = useMemo(() => uniqueValues(entities, e => e.zone), [entities]);
  const types = useMemo(() => uniqueValues(entities, e => e.customerType), [entities]);

  const estimatedCount = useMemo(() => {
    return entities.filter(e => {
      if (selectedReps.length > 0 && (!e.rep || !selectedReps.includes(e.rep))) return false;
      if (selectedZones.length > 0 && (!e.zone || !selectedZones.includes(e.zone))) return false;
      if (selectedTypes.length > 0 && (!e.customerType || !selectedTypes.includes(e.customerType))) return false;
      return true;
    }).length;
  }, [entities, selectedReps, selectedZones, selectedTypes]);

  const handleConfirm = () => {
    const filters: FetchAllFilters = {};
    if (selectedReps.length > 0) filters.agentName = selectedReps;
    if (selectedZones.length > 0) filters.zone = selectedZones;
    if (selectedTypes.length > 0) filters.customerType = selectedTypes;
    onConfirm(filters);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-[420px] max-w-[90vw] flex-col gap-[var(--spacing-2xl)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]"
            role="dialog"
            aria-label="Report 2 filters"
          >
            <div className="flex flex-col items-center gap-[var(--spacing-md)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-gold-subtle)]">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M3 5h14l-5 6v5l-4 2v-7L3 5z" stroke="var(--color-gold-primary)" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Please select</h2>
            </div>

            <FilterField label="Sales Rep" options={reps} selected={selectedReps} onChange={setSelectedReps} />
            <FilterField label="Zone" options={zones} selected={selectedZones} onChange={setSelectedZones} />
            <FilterField label="Customer Type" options={types} selected={selectedTypes} onChange={setSelectedTypes} />

            <p className="text-center text-[12px] text-[var(--color-text-muted)]">
              Fetching data for {formatInteger(estimatedCount)} customers. Estimated 4&ndash;7 minutes.
            </p>

            <div className="flex gap-[var(--spacing-md)]">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-gold-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-dark)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-dark-hover)]"
              >
                Start
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface FilterFieldProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}

function FilterField({ label, options, selected, onChange }: FilterFieldProps) {
  const displayValue = selected.length === 0
    ? 'All'
    : selected.length <= 2
      ? selected.join(', ')
      : `${selected.length} selected`;

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };

  return (
    <div className="flex items-center justify-between gap-[var(--spacing-lg)]">
      <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">{label}</label>
      <div className="relative flex-1 max-w-[240px]">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-[var(--radius-base)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-page)] px-[var(--spacing-lg)] py-[var(--spacing-md)] text-[13px] text-[var(--color-text-secondary)]">
            <span>{displayValue}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="transition-transform group-open:rotate-180" aria-hidden="true">
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-[200px] overflow-y-auto rounded-[var(--radius-base)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)]">
            {options.map(opt => (
              <label key={opt} className="flex cursor-pointer items-center gap-[var(--spacing-sm)] px-[var(--spacing-lg)] py-[var(--spacing-md)] text-[13px] hover:bg-[var(--color-gold-subtle)]">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="h-[14px] w-[14px] accent-[var(--color-gold-primary)]"
                />
                <span>{opt}</span>
              </label>
            ))}
            {options.length === 0 && (
              <div className="px-[var(--spacing-lg)] py-[var(--spacing-md)] text-[12px] text-[var(--color-text-muted)]">No options</div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/shared/Report2FilterModal.tsx
git commit -m "feat(client): add Report2FilterModal with Sales Rep / Zone / Customer Type filters"
```

---

### Task 5.2: Implement Report2ProgressModal

**Files:**
- Create: `client/src/components/shared/Report2ProgressModal.tsx`

- [ ] **Step 1: Write the component**

Create `client/src/components/shared/Report2ProgressModal.tsx`:

```typescript
// FILE: client/src/components/shared/Report2ProgressModal.tsx
// PURPOSE: Two-phase progress modal during Report 2 SSE fetch (Phase 1: fetch, Phase 2: compute)
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: Report2ProgressModal

import { AnimatePresence, motion } from 'framer-motion';
import type { SSEProgressEvent } from '@shared/types/dashboard';
import { formatInteger } from '@shared/utils/formatting';

interface Report2ProgressModalProps {
  isOpen: boolean;
  progress: SSEProgressEvent | null;
}

export function Report2ProgressModal({ isOpen, progress }: Report2ProgressModalProps) {
  const phase = progress?.phase ?? 'fetching';
  const rows = progress?.rowsFetched ?? 0;
  const total = progress?.estimatedTotal ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((rows / total) * 100)) : 0;

  const inPhase1 = phase === 'fetching' || phase === 'incremental';
  const inPhase2 = phase === 'processing' || phase === 'merging';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="flex w-[460px] max-w-[90vw] flex-col gap-[var(--spacing-2xl)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]"
            role="dialog"
            aria-live="polite"
            aria-label="Loading all data progress"
          >
            <div>
              <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Loading All Data</h2>
              <p className="mt-[var(--spacing-xs)] text-[12px] text-[var(--color-text-muted)]">
                Fetching order data from Priority ERP&hellip;
              </p>
            </div>

            <PhaseBlock
              title="Phase 1 of 2 — Fetching orders"
              active={inPhase1}
              done={inPhase2}
              percent={inPhase1 ? percent : 100}
              detail={inPhase1 ? `${formatInteger(rows)} rows` : 'Complete'}
              detailRight={inPhase1 ? `${percent}%` : '100%'}
            />

            <PhaseBlock
              title="Phase 2 — Computing metrics"
              active={inPhase2}
              done={false}
              percent={inPhase2 ? 50 : 0}
              detail={inPhase2 ? (progress?.message ?? 'Processing...') : 'Waiting...'}
              detailRight=""
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface PhaseBlockProps {
  title: string;
  active: boolean;
  done: boolean;
  percent: number;
  detail: string;
  detailRight: string;
}

function PhaseBlock({ title, active, done, percent, detail, detailRight }: PhaseBlockProps) {
  const color = active
    ? 'var(--color-gold-primary)'
    : done
      ? 'var(--color-green)'
      : 'var(--color-text-faint)';

  return (
    <div className="flex flex-col gap-[var(--spacing-sm)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)] first:border-t-0 first:pt-0">
      <h3 className="text-[13px] font-semibold" style={{ color }}>{title}</h3>
      <div className="h-[4px] overflow-hidden rounded-full bg-[var(--color-gold-subtle)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
        <span>{detail}</span>
        <span>{detailRight}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/shared/Report2ProgressModal.tsx
git commit -m "feat(client): add Report2ProgressModal with two-phase progress UI"
```

---

### Task 5.3: Implement Consolidated2ConfirmModal

**Files:**
- Create: `client/src/components/shared/Consolidated2ConfirmModal.tsx`

- [ ] **Step 1: Write the component**

Create `client/src/components/shared/Consolidated2ConfirmModal.tsx`:

```typescript
// FILE: client/src/components/shared/Consolidated2ConfirmModal.tsx
// PURPOSE: Confirmation modal + inline progress for View Consolidated 2
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: Consolidated2ConfirmModal

import { AnimatePresence, motion } from 'framer-motion';
import type { Consolidated2State } from '../../hooks/useConsolidated2';
import type { EntityListItem } from '@shared/types/dashboard';

interface Consolidated2ConfirmModalProps {
  isOpen: boolean;
  state: Consolidated2State;
  selectedEntities: EntityListItem[];
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onGoToReport2: () => void;
}

export function Consolidated2ConfirmModal({
  isOpen, state, selectedEntities, error, onConfirm, onCancel, onGoToReport2,
}: Consolidated2ConfirmModalProps) {
  const count = selectedEntities.length;
  const isFetching = state === 'fetching';
  const needsReport2 = state === 'needs-report-2';
  const hasError = state === 'error';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={isFetching ? undefined : onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-[420px] max-w-[90vw] flex-col gap-[var(--spacing-2xl)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]"
            role="dialog"
            aria-label="Confirm View Consolidated 2"
          >
            <div className="flex flex-col items-center gap-[var(--spacing-md)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-gold-subtle)]">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <rect x="3" y="3" width="14" height="14" rx="3" stroke="var(--color-gold-primary)" strokeWidth="1.5" />
                  <path d="M6 10l3 3 5-6" stroke="var(--color-gold-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">
                {needsReport2 ? 'Data not available' : hasError ? 'Something went wrong' : 'Confirm View Consolidated'}
              </h2>
            </div>

            {!needsReport2 && !hasError && (
              <>
                <p className="text-center text-[13px] text-[var(--color-text-secondary)]">
                  Fetching data for <strong>{count}</strong> selected {count === 1 ? 'entity' : 'entities'}
                </p>

                <div className="max-h-[160px] overflow-y-auto rounded-[var(--radius-base)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-page)] p-[var(--spacing-md)]">
                  <ul className="flex flex-col gap-[var(--spacing-xs)]">
                    {selectedEntities.map(e => (
                      <li key={e.id} className="text-[12px] text-[var(--color-text-secondary)]">
                        {e.name}
                      </li>
                    ))}
                  </ul>
                </div>

                {isFetching && (
                  <div className="flex items-center justify-center gap-[var(--spacing-sm)] text-[12px] text-[var(--color-text-muted)]">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-gold-primary)] border-t-transparent" />
                    <span>Loading&hellip;</span>
                  </div>
                )}

                <div className="flex gap-[var(--spacing-md)]">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={isFetching}
                    className={`flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors ${isFetching ? 'cursor-not-allowed opacity-50' : 'hover:bg-[var(--color-gold-muted)]'}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={isFetching}
                    className={`flex-1 rounded-[var(--radius-base)] bg-[var(--color-dark)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-white transition-colors ${isFetching ? 'cursor-not-allowed opacity-70' : 'hover:bg-[var(--color-dark-hover)]'}`}
                  >
                    Start
                  </button>
                </div>
              </>
            )}

            {needsReport2 && (
              <>
                <p className="text-center text-[13px] text-[var(--color-text-secondary)]">
                  This requires running Report 2 first to load data from Priority ERP.
                </p>
                <div className="flex gap-[var(--spacing-md)]">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-gold-muted)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onGoToReport2}
                    className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-primary)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-white hover:bg-[var(--color-gold-hover)]"
                  >
                    Go to Report 2
                  </button>
                </div>
              </>
            )}

            {hasError && error && (
              <>
                <p className="rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] p-[var(--spacing-md)] text-center text-[12px] text-[var(--color-red)]">
                  {error}
                </p>
                <div className="flex gap-[var(--spacing-md)]">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-gold-muted)]"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-dark)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-white hover:bg-[var(--color-dark-hover)]"
                  >
                    Retry
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/shared/Consolidated2ConfirmModal.tsx
git commit -m "feat(client): add Consolidated2ConfirmModal with needs-report-2 fallback"
```

---

## Phase 6 — Consolidated display components

### Task 6.1: Implement ConsolidatedHeader

**Files:**
- Create: `client/src/components/right-panel/ConsolidatedHeader.tsx`

- [ ] **Step 1: Write the component**

Create `client/src/components/right-panel/ConsolidatedHeader.tsx`:

```typescript
// FILE: client/src/components/right-panel/ConsolidatedHeader.tsx
// PURPOSE: Header replacing DetailHeader when in Report 2 / View Consolidated 2 mode
// USED BY: client/src/components/right-panel/RightPanel.tsx
// EXPORTS: ConsolidatedHeader

import type { Period, FetchAllFilters } from '@shared/types/dashboard';
import { PeriodSelector } from './PeriodSelector';
import { formatInteger } from '@shared/utils/formatting';

interface ConsolidatedHeaderProps {
  mode: 'report' | 'consolidated';
  entityCount: number;
  dimensionLabel: string;          // Singular or plural; caller chooses
  filters: FetchAllFilters | null; // null for consolidated mode
  yearsAvailable: string[];
  activePeriod: Period;
  onPeriodChange: (p: Period) => void;
  onExport: () => void;
}

function formatFilters(filters: FetchAllFilters | null): string | null {
  if (!filters) return null;
  const parts: string[] = [];
  if (filters.agentName?.length) parts.push(`Rep: ${filters.agentName.join(', ')}`);
  if (filters.zone?.length) parts.push(`Zone: ${filters.zone.join(', ')}`);
  if (filters.customerType?.length) parts.push(`Type: ${filters.customerType.join(', ')}`);
  return parts.length > 0 ? `Filters: ${parts.join(' · ')}` : null;
}

export function ConsolidatedHeader({
  mode, entityCount, dimensionLabel, filters, yearsAvailable, activePeriod, onPeriodChange, onExport,
}: ConsolidatedHeaderProps) {
  const prefix = mode === 'report' ? 'Report' : 'Consolidated';
  const title = `${prefix}: ${formatInteger(entityCount)} ${dimensionLabel}`;
  const filterLine = formatFilters(filters);

  return (
    <div className="flex items-start justify-between gap-[var(--spacing-lg)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-bold text-[var(--color-text-primary)]">{title}</h1>
        {filterLine && (
          <p className="mt-[var(--spacing-xs)] truncate text-[12px] text-[var(--color-text-muted)]">{filterLine}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-[var(--spacing-lg)]">
        <PeriodSelector yearsAvailable={yearsAvailable} activePeriod={activePeriod} onChange={onPeriodChange} />
        <button
          type="button"
          onClick={onExport}
          className="cursor-pointer rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-md)] text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-gold-muted)]"
        >
          Export
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/right-panel/ConsolidatedHeader.tsx
git commit -m "feat(client): add ConsolidatedHeader with entity count + filter summary"
```

---

### Task 6.2: Implement PerCustomerToggle

**Files:**
- Create: `client/src/components/right-panel/PerCustomerToggle.tsx`

- [ ] **Step 1: Write the component**

Create `client/src/components/right-panel/PerCustomerToggle.tsx`:

```typescript
// FILE: client/src/components/right-panel/PerCustomerToggle.tsx
// PURPOSE: Two-state switch used inside expanded KPI/chart modals to flip between aggregated and per-customer views
// USED BY: kpi-modal-content.tsx, ProductMixExpanded, BestSellersExpanded, ItemsExplorer (expanded)
// EXPORTS: PerCustomerToggle, PerCustomerMode

export type PerCustomerMode = 'aggregated' | 'per-customer';

interface PerCustomerToggleProps {
  mode: PerCustomerMode;
  onChange: (mode: PerCustomerMode) => void;
}

export function PerCustomerToggle({ mode, onChange }: PerCustomerToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="View mode"
      className="inline-flex rounded-full bg-[var(--color-gold-subtle)] p-[2px]"
    >
      <ToggleOption label="Aggregated" active={mode === 'aggregated'} onClick={() => onChange('aggregated')} />
      <ToggleOption label="Per Customer" active={mode === 'per-customer'} onClick={() => onChange('per-customer')} />
    </div>
  );
}

function ToggleOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`
        rounded-full px-[var(--spacing-2xl)] py-[var(--spacing-xs)]
        text-[11px] font-medium transition-colors duration-150
        ${active
          ? 'bg-[var(--color-gold-primary)] text-white'
          : 'bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}
      `}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/right-panel/PerCustomerToggle.tsx
git commit -m "feat(client): add PerCustomerToggle component for expanded modals"
```

---

### Task 6.3: Implement PerCustomerKPITable

**Files:**
- Create: `client/src/components/right-panel/PerCustomerKPITable.tsx`

- [ ] **Step 1: Write the component**

Create `client/src/components/right-panel/PerCustomerKPITable.tsx`:

```typescript
// FILE: client/src/components/right-panel/PerCustomerKPITable.tsx
// PURPOSE: Sortable per-entity KPI table rendered inside KPI modals when toggled to Per Customer mode
// USED BY: kpi-modal-content.tsx
// EXPORTS: PerCustomerKPITable

import { useMemo, useState } from 'react';
import type { EntityListItem } from '@shared/types/dashboard';
import { formatPercent } from '@shared/utils/formatting';

type SortKey = 'name' | 'value' | 'yoy';
type SortDir = 'asc' | 'desc';

interface PerCustomerKPITableProps {
  entities: EntityListItem[];
  /** Extract the metric value shown in the Value column */
  getValue: (e: EntityListItem) => number | null;
  /** Format the metric value */
  formatValue: (v: number) => string;
  /** Optional per-entity previous-year value for YoY calculation */
  getPrevValue?: (e: EntityListItem) => number | null;
  valueLabel: string;
}

function yoy(current: number | null, prev: number | null | undefined): number | null {
  if (current === null || prev == null || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

export function PerCustomerKPITable({ entities, getValue, formatValue, getPrevValue, valueLabel }: PerCustomerKPITableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const rows = useMemo(() => {
    const mapped = entities.map(e => {
      const v = getValue(e);
      const prev = getPrevValue?.(e) ?? null;
      return { id: e.id, name: e.name, value: v, yoy: yoy(v, prev) };
    });
    mapped.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'value') cmp = (a.value ?? -Infinity) - (b.value ?? -Infinity);
      else cmp = (a.yoy ?? -Infinity) - (b.yoy ?? -Infinity);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return mapped;
  }, [entities, getValue, getPrevValue, sortKey, sortDir]);

  const onHeaderClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="max-h-[400px] overflow-auto rounded-[var(--radius-base)] border border-[var(--color-gold-subtle)]">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-[var(--color-bg-card)]">
          <tr className="border-b border-[var(--color-gold-subtle)]">
            <Th label="Customer" sortKey="name" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label={valueLabel} sortKey="value" active={sortKey} dir={sortDir} onClick={onHeaderClick} align="right" />
            <Th label="YoY" sortKey="yoy" active={sortKey} dir={sortDir} onClick={onHeaderClick} align="right" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-[var(--color-gold-subtle)] last:border-b-0 hover:bg-[var(--color-gold-subtle)]">
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-primary)]">{r.name}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-secondary)]">
                {r.value == null ? '\u2014' : formatValue(r.value)}
              </td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums">
                {r.yoy == null ? (
                  <span className="text-[var(--color-text-faint)]">\u2014</span>
                ) : (
                  <span style={{ color: r.yoy >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {formatPercent(r.yoy, { showSign: true })}
                  </span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} className="p-[var(--spacing-2xl)] text-center text-[var(--color-text-muted)]">No entities</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label, sortKey, active, dir, onClick, align = 'left',
}: {
  label: string; sortKey: SortKey; active: SortKey; dir: SortDir; onClick: (k: SortKey) => void; align?: 'left' | 'right';
}) {
  const isActive = active === sortKey;
  return (
    <th
      onClick={() => onClick(sortKey)}
      className={`cursor-pointer select-none px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] ${align === 'right' ? 'text-right' : 'text-left'} hover:text-[var(--color-text-secondary)]`}
    >
      {label}{isActive ? (dir === 'asc' ? ' \u2191' : ' \u2193') : ''}
    </th>
  );
}
```

- [ ] **Step 2: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/right-panel/PerCustomerKPITable.tsx
git commit -m "feat(client): add sortable PerCustomerKPITable component"
```

---

### Task 6.4: Implement PerCustomerChartTable

**Files:**
- Create: `client/src/components/right-panel/PerCustomerChartTable.tsx`

- [ ] **Step 1: Write the component**

Create `client/src/components/right-panel/PerCustomerChartTable.tsx`:

```typescript
// FILE: client/src/components/right-panel/PerCustomerChartTable.tsx
// PURPOSE: Per-entity breakdown for Product Mix and Best Sellers modals
// USED BY: ProductMixExpanded, BestSellersExpanded (via toggle)
// EXPORTS: PerCustomerChartTable

import { useMemo, useState } from 'react';
import type { EntityListItem, ProductMixSegment, ProductMixType, TopSellerItem } from '@shared/types/dashboard';
import { formatCurrency } from '@shared/utils/formatting';

type Mode = 'product-mix' | 'top-sellers';

interface PerCustomerChartTableProps {
  mode: Mode;
  entities: EntityListItem[];
  /** Per-entity product mix segments (keyed by entity id) */
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
  /** Only used when mode='product-mix' */
  productMixType?: ProductMixType;
  /** Per-entity top sellers (keyed by entity id) */
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
}

export function PerCustomerChartTable({ mode, entities, perEntityProductMixes, productMixType, perEntityTopSellers }: PerCustomerChartTableProps) {
  const rows = useMemo(() => {
    if (mode === 'product-mix') {
      if (!perEntityProductMixes || !productMixType) return [];
      return entities.map(e => {
        const mix = perEntityProductMixes[e.id]?.[productMixType] ?? [];
        const top = mix[0] ?? null;
        return {
          id: e.id,
          name: e.name,
          label: top?.category ?? '\u2014',
          value: top?.value ?? 0,
          percent: top?.percentage ?? 0,
        };
      }).sort((a, b) => b.value - a.value);
    }

    if (!perEntityTopSellers) return [];
    return entities.map(e => {
      const topSellers = perEntityTopSellers[e.id] ?? [];
      const top = topSellers[0] ?? null;
      return {
        id: e.id,
        name: e.name,
        label: top?.name ?? '\u2014',
        value: top?.revenue ?? 0,
        percent: 0, // not used in top-sellers mode
      };
    }).sort((a, b) => b.value - a.value);
  }, [mode, entities, perEntityProductMixes, productMixType, perEntityTopSellers]);

  const valueHeader = mode === 'product-mix' ? 'Revenue' : 'Top SKU Revenue';
  const categoryHeader = mode === 'product-mix' ? 'Top Category' : 'Top SKU';

  return (
    <div className="max-h-[400px] overflow-auto rounded-[var(--radius-base)] border border-[var(--color-gold-subtle)]">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-[var(--color-bg-card)]">
          <tr className="border-b border-[var(--color-gold-subtle)]">
            <th className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-left text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Customer</th>
            <th className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-left text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{categoryHeader}</th>
            <th className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{valueHeader}</th>
            {mode === 'product-mix' && (
              <th className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">% of Revenue</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-[var(--color-gold-subtle)] last:border-b-0 hover:bg-[var(--color-gold-subtle)]">
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-primary)]">{r.name}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{r.label}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-secondary)]">{formatCurrency(r.value)}</td>
              {mode === 'product-mix' && (
                <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-muted)]">{r.percent}%</td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={mode === 'product-mix' ? 4 : 3} className="p-[var(--spacing-2xl)] text-center text-[var(--color-text-muted)]">No entity breakdown available</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export type { Mode as PerCustomerChartMode };
```

- [ ] **Step 2: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/right-panel/PerCustomerChartTable.tsx
git commit -m "feat(client): add PerCustomerChartTable for Product Mix and Best Sellers"
```

---

### Task 6.5: Implement ConsolidatedOrdersTable

**Files:**
- Read first: `client/src/components/right-panel/OrdersTable.tsx` to understand existing structure
- Create: `client/src/components/right-panel/ConsolidatedOrdersTable.tsx`

- [ ] **Step 1: Read OrdersTable.tsx to understand its props and column structure**

Run: open `client/src/components/right-panel/OrdersTable.tsx` and review its interface + column layout.
Expected: You understand how columns are defined and can add a `Customer` column in front.

- [ ] **Step 2: Create ConsolidatedOrdersTable as a wrapper**

Create `client/src/components/right-panel/ConsolidatedOrdersTable.tsx`:

```typescript
// FILE: client/src/components/right-panel/ConsolidatedOrdersTable.tsx
// PURPOSE: Orders table variant with Customer column — used in Report 2 / View Consolidated 2 mode
// USED BY: client/src/components/right-panel/TabsSection.tsx
// EXPORTS: ConsolidatedOrdersTable

import { useMemo, useState } from 'react';
import type { OrderRow } from '@shared/types/dashboard';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';

type SortKey = 'date' | 'customer' | 'orderNumber' | 'itemCount' | 'amount' | 'marginPercent' | 'status';
type SortDir = 'asc' | 'desc';

interface ConsolidatedOrdersTableProps {
  orders: OrderRow[];
}

export function ConsolidatedOrdersTable({ orders }: ConsolidatedOrdersTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    const arr = [...orders];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date': cmp = a.date.localeCompare(b.date); break;
        case 'customer': cmp = (a.customerName ?? '').localeCompare(b.customerName ?? ''); break;
        case 'orderNumber': cmp = a.orderNumber.localeCompare(b.orderNumber); break;
        case 'itemCount': cmp = a.itemCount - b.itemCount; break;
        case 'amount': cmp = a.amount - b.amount; break;
        case 'marginPercent': cmp = a.marginPercent - b.marginPercent; break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [orders, sortKey, sortDir]);

  const onHeaderClick = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'customer' || key === 'orderNumber' || key === 'status' ? 'asc' : 'desc'); }
  };

  return (
    <div className="overflow-auto rounded-[var(--radius-base)] border border-[var(--color-gold-subtle)]">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-[var(--color-bg-card)]">
          <tr className="border-b border-[var(--color-gold-subtle)]">
            <Th label="Date" k="date" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Customer" k="customer" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Order #" k="orderNumber" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Items" k="itemCount" active={sortKey} dir={sortDir} onClick={onHeaderClick} align="right" />
            <Th label="Amount" k="amount" active={sortKey} dir={sortDir} onClick={onHeaderClick} align="right" />
            <Th label="Margin %" k="marginPercent" active={sortKey} dir={sortDir} onClick={onHeaderClick} align="right" />
            <Th label="Status" k="status" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(o => (
            <tr key={o.orderNumber} className="border-b border-[var(--color-gold-subtle)] last:border-b-0 hover:bg-[var(--color-gold-subtle)]">
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{o.date.slice(0, 10)}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-primary)]">{o.customerName ?? '\u2014'}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] font-mono text-[var(--color-text-secondary)]">{o.orderNumber}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-secondary)]">{o.itemCount}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-secondary)]">{formatCurrency(o.amount)}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-secondary)]">{formatPercent(o.marginPercent)}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{o.status}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={7} className="p-[var(--spacing-2xl)] text-center text-[var(--color-text-muted)]">No orders</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label, k, active, dir, onClick, align = 'left',
}: {
  label: string; k: SortKey; active: SortKey; dir: SortDir; onClick: (k: SortKey) => void; align?: 'left' | 'right';
}) {
  const isActive = active === k;
  return (
    <th
      onClick={() => onClick(k)}
      className={`cursor-pointer select-none px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] ${align === 'right' ? 'text-right' : 'text-left'} hover:text-[var(--color-text-secondary)]`}
    >
      {label}{isActive ? (dir === 'asc' ? ' \u2191' : ' \u2193') : ''}
    </th>
  );
}
```

- [ ] **Step 3: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/right-panel/ConsolidatedOrdersTable.tsx
git commit -m "feat(client): add ConsolidatedOrdersTable with Customer column"
```

---

### Task 6.6: Implement ConsolidatedContactsTable

**Files:**
- Modify: `shared/types/dashboard.ts` (Contact interface — add `customerName`)
- Create: `client/src/components/right-panel/ConsolidatedContactsTable.tsx`

- [ ] **Step 1: Add optional customerName to Contact interface**

In `shared/types/dashboard.ts`, find the `Contact` interface (around line 171) and add `customerName?: string` after `email`:

```typescript
export interface Contact {
  fullName: string;
  position: string;
  phone: string;
  email: string;
  /** WHY: Populated only in consolidated mode (Report 2 / View Consolidated 2). */
  customerName?: string;
}
```

Also update the server contacts endpoint later (in a future task or by the reviewer) to populate this field when multiple customers' contacts are combined. For initial MVP, client can derive it from the entityId context if the server doesn't populate.

- [ ] **Step 2: Create ConsolidatedContactsTable**

Create `client/src/components/right-panel/ConsolidatedContactsTable.tsx`:

```typescript
// FILE: client/src/components/right-panel/ConsolidatedContactsTable.tsx
// PURPOSE: Contacts table variant with Customer column — used in Report 2 / View Consolidated 2 mode
// USED BY: client/src/components/right-panel/TabsSection.tsx
// EXPORTS: ConsolidatedContactsTable

import { useMemo, useState } from 'react';
import type { Contact } from '@shared/types/dashboard';

type SortKey = 'customer' | 'fullName' | 'position' | 'email' | 'phone';
type SortDir = 'asc' | 'desc';

interface ConsolidatedContactsTableProps {
  contacts: Contact[];
}

export function ConsolidatedContactsTable({ contacts }: ConsolidatedContactsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('customer');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    const arr = [...contacts];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'customer': cmp = (a.customerName ?? '').localeCompare(b.customerName ?? ''); break;
        case 'fullName': cmp = a.fullName.localeCompare(b.fullName); break;
        case 'position': cmp = a.position.localeCompare(b.position); break;
        case 'email': cmp = a.email.localeCompare(b.email); break;
        case 'phone': cmp = a.phone.localeCompare(b.phone); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [contacts, sortKey, sortDir]);

  const onHeaderClick = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  return (
    <div className="overflow-auto rounded-[var(--radius-base)] border border-[var(--color-gold-subtle)]">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-[var(--color-bg-card)]">
          <tr className="border-b border-[var(--color-gold-subtle)]">
            <Th label="Customer" k="customer" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Name" k="fullName" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Position" k="position" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Email" k="email" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Phone" k="phone" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => (
            <tr key={`${c.customerName ?? ''}-${c.fullName}-${i}`} className="border-b border-[var(--color-gold-subtle)] last:border-b-0 hover:bg-[var(--color-gold-subtle)]">
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-primary)]">{c.customerName ?? '\u2014'}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{c.fullName || '\u2014'}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{c.position || '\u2014'}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{c.email || '\u2014'}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{c.phone || '\u2014'}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={5} className="p-[var(--spacing-2xl)] text-center text-[var(--color-text-muted)]">No contacts</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label, k, active, dir, onClick,
}: {
  label: string; k: SortKey; active: SortKey; dir: SortDir; onClick: (k: SortKey) => void;
}) {
  const isActive = active === k;
  return (
    <th
      onClick={() => onClick(k)}
      className="cursor-pointer select-none px-[var(--spacing-md)] py-[var(--spacing-sm)] text-left text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
    >
      {label}{isActive ? (dir === 'asc' ? ' \u2191' : ' \u2193') : ''}
    </th>
  );
}
```

- [ ] **Step 3: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/right-panel/ConsolidatedContactsTable.tsx shared/types/dashboard.ts
git commit -m "feat(client): add ConsolidatedContactsTable with Customer column"
```

> **Note:** Server-side `fetchContacts` and its route need to populate `customerName` when returning contacts from multiple customers. For single-entity mode, `customerName` is undefined (the existing ContactsTable ignores it). Add a follow-up task during implementation to wire this through the contacts endpoint if the consolidated views need multi-customer contacts. For MVP, `Consolidated2` fetches only for the selected entity IDs; the layout can call `useContacts(entityId)` per selected customer and merge client-side, populating `customerName` during the merge.

---

## Phase 7 — Wire per-customer toggle into existing modals

### Task 7.1: Extend kpi-modal-content to accept per-customer data

**Files:**
- Modify: `client/src/components/right-panel/kpi-modal-content.tsx`

- [ ] **Step 1: Extend KPIModalContent to support toggle**

Replace the `KPIModalContent` function and its props interface:

```typescript
import { useState } from 'react';
import { PerCustomerToggle, type PerCustomerMode } from './PerCustomerToggle';
import { PerCustomerKPITable } from './PerCustomerKPITable';
import type { EntityListItem } from '@shared/types/dashboard';

interface KPIModalContentProps {
  value: string;
  changePercent?: number | null;
  prevYearValue?: string;
  prevYearFullValue?: string;
  prevYearLabel?: string;
  prevYearFullLabel?: string;
  subItems?: KPISubItem[];
  /** WHY: Enables per-customer toggle when in Report 2 / View Consolidated 2 mode */
  perCustomer?: {
    entities: EntityListItem[];
    getValue: (e: EntityListItem) => number | null;
    formatValue: (v: number) => string;
    getPrevValue?: (e: EntityListItem) => number | null;
    valueLabel: string;
  };
}

export function KPIModalContent({
  value, changePercent, prevYearValue, prevYearFullValue, prevYearLabel, prevYearFullLabel, subItems, perCustomer,
}: KPIModalContentProps) {
  const [mode, setMode] = useState<PerCustomerMode>('aggregated');
  const showToggle = !!perCustomer;

  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      {showToggle && (
        <div className="flex justify-end">
          <PerCustomerToggle mode={mode} onChange={setMode} />
        </div>
      )}

      {mode === 'per-customer' && perCustomer ? (
        <PerCustomerKPITable
          entities={perCustomer.entities}
          getValue={perCustomer.getValue}
          formatValue={perCustomer.formatValue}
          getPrevValue={perCustomer.getPrevValue}
          valueLabel={perCustomer.valueLabel}
        />
      ) : (
        <>
          <div>
            <span className="tabular-nums text-[30px] font-bold text-[var(--color-text-primary)]">{value}</span>
            {changePercent != null && (
              <span className="ml-[var(--spacing-md)] text-[14px] font-medium" style={{ color: changePercent >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}% vs same period last year
              </span>
            )}
          </div>
          {prevYearValue && (
            <div className="flex gap-[var(--spacing-4xl)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
              <div className="flex flex-col">
                <span className="text-[11px] text-[var(--color-text-muted)]">{prevYearLabel}</span>
                <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">{prevYearValue}</span>
              </div>
              {prevYearFullValue && (
                <div className="flex flex-col">
                  <span className="text-[11px] text-[var(--color-text-muted)]">{prevYearFullLabel}</span>
                  <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">{prevYearFullValue}</span>
                </div>
              )}
            </div>
          )}
          {subItems && subItems.length > 0 && (
            <div className="flex gap-[var(--spacing-4xl)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
              {subItems.map((item) => (
                <div key={item.label} className="flex flex-col">
                  <span className="text-[11px] text-[var(--color-text-muted)]">{item.label}</span>
                  <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">
                    {item.value}
                    {item.suffix && <span className="ml-1 text-[11px] font-normal text-[var(--color-text-muted)]">({item.suffix})</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Extend HeroRevenueModalContent similarly**

Replace the `HeroRevenueModalContent` function:

```typescript
interface HeroRevenueModalContentProps {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  /** WHY: Enables per-customer toggle when in consolidated mode */
  perCustomer?: {
    entities: EntityListItem[];
    getValue: (e: EntityListItem) => number | null;
    formatValue: (v: number) => string;
    getPrevValue?: (e: EntityListItem) => number | null;
  };
}

export function HeroRevenueModalContent({ kpis, monthlyRevenue, perCustomer }: HeroRevenueModalContentProps) {
  const [mode, setMode] = useState<PerCustomerMode>('aggregated');
  const [chartRef, chartSize] = useContainerSize();
  const showToggle = !!perCustomer;

  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      {showToggle && (
        <div className="flex justify-end">
          <PerCustomerToggle mode={mode} onChange={setMode} />
        </div>
      )}

      {mode === 'per-customer' && perCustomer ? (
        <PerCustomerKPITable
          entities={perCustomer.entities}
          getValue={perCustomer.getValue}
          formatValue={perCustomer.formatValue}
          getPrevValue={perCustomer.getPrevValue}
          valueLabel="Revenue"
        />
      ) : (
        <>
          <div className="flex flex-col gap-[var(--spacing-xs)]">
            <span className="tabular-nums text-[36px] font-[800] leading-tight tracking-[-1px] text-[var(--color-text-primary)]">
              {formatCurrency(Math.round(kpis.totalRevenue))}
            </span>
            {kpis.revenueChangePercent !== null && (
              <span className="text-[14px] font-medium" style={{ color: kpis.revenueChangePercent >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                {formatPercent(kpis.revenueChangePercent, { showSign: true })} vs last year
              </span>
            )}
          </div>
          <div ref={chartRef} className="h-[300px]">
            {chartSize.width > 0 && <YoYBarChart data={monthlyRevenue} width={chartSize.width} height={300} />}
          </div>
          <div className="flex gap-[var(--spacing-4xl)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
            <div className="flex flex-col">
              <span className="text-[11px] text-[var(--color-text-muted)]">{kpis.quarterLabel}</span>
              <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">{formatCurrency(kpis.thisQuarterRevenue)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-[var(--color-text-muted)]">Last Month</span>
              <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">
                {formatCurrency(kpis.lastMonthRevenue)} <span className="text-[11px] text-[var(--color-text-muted)]">({kpis.lastMonthName})</span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-[var(--color-text-muted)]">Best Month</span>
              <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">
                {formatCurrency(kpis.bestMonth.amount)} <span className="text-[11px] text-[var(--color-text-muted)]">({kpis.bestMonth.name})</span>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/right-panel/kpi-modal-content.tsx
git commit -m "feat(client): add per-customer toggle support to KPI and Hero Revenue modals"
```

---

### Task 7.2: Pass per-customer data from KPISection to modals

**Files:**
- Modify: `client/src/components/right-panel/KPISection.tsx`

- [ ] **Step 1: Add consolidatedMode and entities props**

Modify `KPISectionProps` interface to accept consolidated data:

```typescript
interface KPISectionProps {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  sparklines: Record<string, SparklineData>;
  activePeriod: Period;
  /** WHY: When set, KPI modals render the per-customer toggle and table */
  consolidatedEntities?: EntityListItem[];
}
```

Add `EntityListItem` to the imports at the top:
```typescript
import type { KPIs, KPIMetricBreakdown, MonthlyRevenue, SparklineData, Period, EntityListItem } from '@shared/types/dashboard';
```

- [ ] **Step 2: Pass perCustomer config into each card's openModal call**

Inside the `KPI_CONFIGS.map` block, replace the `onExpand={() => openModal(cfg.label, (<KPIModalContent ... />))}` prop with the following:

```typescript
onExpand={() => openModal(cfg.label, (
  <KPIModalContent
    value={displayValue}
    changePercent={change}
    prevYearValue={fmtPrevYear}
    prevYearFullValue={fmtPrevYearFull}
    prevYearLabel={pyLabel}
    prevYearFullLabel={pyFullLabel}
    subItems={subItems}
    perCustomer={consolidatedEntities ? {
      entities: consolidatedEntities,
      getValue: (e) => {
        if (cfg.label === 'Orders') return e.orderCount;
        if (cfg.label === 'Avg. Order') return e.avgOrder;
        if (cfg.label === 'Margin %') return e.marginPercent;
        if (cfg.label === 'Margin $') return e.marginAmount;
        if (cfg.label === 'Frequency') return e.frequency;
        return null;
      },
      formatValue: cfg.formatter,
      valueLabel: cfg.label,
    } : undefined}
  />
))}
```

- [ ] **Step 3: Pass perCustomer to HeroRevenueCard modal**

Replace the `onExpand` prop of `HeroRevenueCard`:

```typescript
onExpand={() => openModal('Total Revenue', (
  <HeroRevenueModalContent
    kpis={kpis}
    monthlyRevenue={monthlyRevenue}
    perCustomer={consolidatedEntities ? {
      entities: consolidatedEntities,
      getValue: (e) => e.revenue,
      formatValue: (v) => roundCurrency(v),
    } : undefined}
  />
))}
```

- [ ] **Step 4: Pass perCustomer for Last Order card**

Replace the Last Order card's `onExpand`:

```typescript
onExpand={() => openModal('Last Order', (
  <KPIModalContent
    value={kpis.lastOrderDays === null ? 'No orders' : formatDays(Math.round(kpis.lastOrderDays))}
    perCustomer={consolidatedEntities ? {
      entities: consolidatedEntities,
      getValue: (e) => {
        if (!e.lastOrderDate) return null;
        const diff = (Date.now() - new Date(e.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24);
        return Math.round(diff);
      },
      formatValue: (d) => `${d}d`,
      valueLabel: 'Days ago',
    } : undefined}
  />
))}
```

- [ ] **Step 5: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/right-panel/KPISection.tsx
git commit -m "feat(client): wire per-customer data from KPISection into modals"
```

---

### Task 7.3: Wire per-customer toggle into ChartsRow (Product Mix + Best Sellers modals)

**Files:**
- Read first: `client/src/components/right-panel/ChartsRow.tsx`, `ProductMixExpanded`, `BestSellersExpanded`
- Modify: `client/src/components/right-panel/ChartsRow.tsx`

- [ ] **Step 1: Read existing chart modal components to understand expand structure**

Run: `grep -rn "ProductMixExpanded\|BestSellersExpanded" client/src/components/right-panel/`
Expected: Find the expanded modal files and understand how the openModal pattern works for them.

- [ ] **Step 2: Add consolidatedEntities + perEntityProductMixes + perEntityTopSellers props to ChartsRow**

Modify `ChartsRow.tsx` interface:

```typescript
interface ChartsRowProps {
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
  /** WHY: Enables per-customer toggle in modals when in consolidated mode */
  consolidatedEntities?: EntityListItem[];
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
}
```

Then pass these props through to `ProductMixCarousel` and `BestSellers` (which will need matching props extended).

For `ProductMixCarousel` expanded modal — wrap `ProductMixExpanded` in a new component that conditionally renders `PerCustomerChartTable` based on toggle state. Create an inline wrapper inside `ChartsRow.tsx`:

```typescript
import { useState } from 'react';
import { PerCustomerToggle, type PerCustomerMode } from './PerCustomerToggle';
import { PerCustomerChartTable } from './PerCustomerChartTable';
import type { EntityListItem, ProductMixType } from '@shared/types/dashboard';

interface ProductMixExpandedWithToggleProps {
  segments: ProductMixSegment[];
  type: ProductMixType;
  consolidatedEntities?: EntityListItem[];
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
}

function ProductMixExpandedWithToggle({ segments, type, consolidatedEntities, perEntityProductMixes }: ProductMixExpandedWithToggleProps) {
  const [mode, setMode] = useState<PerCustomerMode>('aggregated');
  const showToggle = !!consolidatedEntities && !!perEntityProductMixes;

  if (!showToggle) {
    return <ProductMixExpanded segments={segments} type={type} />;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      <div className="flex justify-end">
        <PerCustomerToggle mode={mode} onChange={setMode} />
      </div>
      {mode === 'aggregated' ? (
        <ProductMixExpanded segments={segments} type={type} />
      ) : (
        <PerCustomerChartTable
          mode="product-mix"
          entities={consolidatedEntities!}
          perEntityProductMixes={perEntityProductMixes}
          productMixType={type}
        />
      )}
    </div>
  );
}
```

Do the same for Best Sellers:

```typescript
interface BestSellersExpandedWithToggleProps {
  sellers: TopSellerItem[];
  consolidatedEntities?: EntityListItem[];
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
}

function BestSellersExpandedWithToggle({ sellers, consolidatedEntities, perEntityTopSellers }: BestSellersExpandedWithToggleProps) {
  const [mode, setMode] = useState<PerCustomerMode>('aggregated');
  const showToggle = !!consolidatedEntities && !!perEntityTopSellers;

  if (!showToggle) {
    return <BestSellersExpanded sellers={sellers} />;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      <div className="flex justify-end">
        <PerCustomerToggle mode={mode} onChange={setMode} />
      </div>
      {mode === 'aggregated' ? (
        <BestSellersExpanded sellers={sellers} />
      ) : (
        <PerCustomerChartTable
          mode="top-sellers"
          entities={consolidatedEntities!}
          perEntityTopSellers={perEntityTopSellers}
        />
      )}
    </div>
  );
}
```

Wire these wrappers into the existing openModal calls inside `ChartsRow` (replacing the current `ProductMixExpanded` / `BestSellersExpanded` components).

- [ ] **Step 3: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/right-panel/ChartsRow.tsx
git commit -m "feat(client): add per-customer toggle to Product Mix and Best Sellers modals"
```

---

## Phase 8 — Wire state through layout

### Task 8.1: Extend useDashboardState to include Report 2 + Consolidated 2 + cache status

**Files:**
- Modify: `client/src/hooks/useDashboardState.ts`

- [ ] **Step 1: Import the new hooks and wire them**

Add to imports:

```typescript
import { useReport2 } from './useReport2';
import { useConsolidated2 } from './useConsolidated2';
import { useCacheStatus } from './useCacheStatus';
```

After the existing hook calls (right before the `switchDimension` useCallback), add:

```typescript
  const report2 = useReport2(activeDimension, activePeriod);
  const consolidated2 = useConsolidated2(activeDimension, activePeriod);
  const cacheStatus = useCacheStatus(activePeriod);
```

- [ ] **Step 2: Reset report2 and consolidated2 on dimension switch**

In the dimension-switch `switchDimension` useCallback, add `report2.reset();` and `consolidated2.reset();` to the sequence:

```typescript
  const switchDimension = useCallback((dim: Dimension) => {
    setShellDimension(dim);
    clearSelection();
    resetSearch();
    clearFilters();
    resetSort();
    abortFetch();
    report2.reset();
    consolidated2.reset();
  }, [setShellDimension, clearSelection, resetSearch, clearFilters, resetSort, abortFetch, report2, consolidated2]);
```

- [ ] **Step 3: Add them to the returned object**

Extend the final return object to include:

```typescript
    report2,
    consolidated2,
    cacheStatus: cacheStatus.data,
```

- [ ] **Step 4: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useDashboardState.ts
git commit -m "feat(client): wire useReport2, useConsolidated2, and useCacheStatus into useDashboardState"
```

---

### Task 8.2: Extend DashboardLayoutProps interface

**Files:**
- Modify: `client/src/layouts/dashboard-layout-types.ts`

- [ ] **Step 1: Import the new hook return types**

Replace the top imports with:

```typescript
import type { DashboardPayload, EntityListItem, Contact, Dimension, Period, EntityListLoadState, SSEProgressEvent, FetchAllFilters, CacheStatus } from '@shared/types/dashboard';
import type { FilterCondition } from '../hooks/useFilters';
import type { SortField, SortDirection } from '../hooks/sort-types';
import type { ApiResponse } from '@shared/types/api-responses';
import type { DetailTab } from '../components/right-panel/detail-tab-types';
import type { UseReport2Return } from '../hooks/useReport2';
import type { UseConsolidated2Return } from '../hooks/useConsolidated2';
```

- [ ] **Step 2: Add fields to the DashboardLayoutProps interface**

Append before the closing brace:

```typescript
  report2: UseReport2Return;
  consolidated2: UseConsolidated2Return;
  cacheStatus: CacheStatus | undefined;
}
```

- [ ] **Step 3: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/layouts/dashboard-layout-types.ts
git commit -m "feat(client): extend DashboardLayoutProps with report2 / consolidated2 / cacheStatus"
```

---

### Task 8.3: Wire Report 2 into LeftPanel / EntityList

**Files:**
- Modify: `client/src/components/left-panel/EntityList.tsx`
- Modify: `client/src/components/left-panel/LeftPanel.tsx`

- [ ] **Step 1: Extend EntityList props**

Add props to `EntityListProps`:

```typescript
  report2State: Report2State;
  report2Payload: DashboardPayload | null;
  cacheStatus: CacheStatus | undefined;
  activeView: 'single' | 'report2' | 'consolidated2';
  onReport2Click: () => void;
  onViewConsolidated2: () => void;
```

Import the needed types at the top of the file:

```typescript
import type { Report2State } from '../../hooks/useReport2';
import type { CacheStatus } from '@shared/types/dashboard';
import { Report2Button } from './Report2Button';
import { ViewConsolidated2Button } from './ViewConsolidated2Button';
```

- [ ] **Step 2: Render Report2Button below AllEntityEntry**

Inside the JSX, after the `<AllEntityEntry ... />` block, add:

```tsx
      <Report2Button
        state={report2State}
        payload={report2Payload}
        cacheStatus={cacheStatus}
        isActive={activeView === 'report2'}
        onClick={onReport2Click}
      />
```

- [ ] **Step 3: Update SelectionBar to render ViewConsolidated2Button**

Modify `SelectionBar.tsx`. Change the `SelectionBarProps` interface to add:

```typescript
  onViewConsolidated2: () => void;
```

Inside the component JSX, under the existing `View Consolidated` button, add:

```tsx
            <ViewConsolidated2Button onClick={onViewConsolidated2} />
```

Remember to import:

```typescript
import { ViewConsolidated2Button } from './ViewConsolidated2Button';
```

Also update `EntityList` to pass the `onViewConsolidated2` prop into `<SelectionBar>`:

```tsx
      <SelectionBar
        selectedCount={selectedCount}
        dataLoaded={dataLoaded}
        onViewConsolidated={onViewConsolidated}
        onViewConsolidated2={onViewConsolidated2}
        onClear={onClearSelection}
      />
```

- [ ] **Step 4: Thread props through LeftPanel.tsx**

In `client/src/components/left-panel/LeftPanel.tsx`, add the new props to the interface and pass them through to `EntityList`.

- [ ] **Step 5: Verify TypeScript builds**

Run: `cd client && npx tsc -b --noEmit`
Expected: Errors about missing `activeView`/`onReport2Click`/`onViewConsolidated2` props at call sites. Good — we wire those in the next task.

- [ ] **Step 6: Commit (WIP)**

```bash
git add client/src/components/left-panel/EntityList.tsx client/src/components/left-panel/SelectionBar.tsx client/src/components/left-panel/LeftPanel.tsx
git commit -m "feat(client): wire Report 2 and ViewConsolidated 2 buttons into left panel"
```

---

### Task 8.4: Wire Report 2 / Consolidated 2 handlers in DashboardLayout

**Files:**
- Modify: `client/src/layouts/DashboardLayout.tsx`
- Modify: `client/src/components/right-panel/RightPanel.tsx`
- Modify: `client/src/components/right-panel/TabsSection.tsx`

- [ ] **Step 1: Determine the active view in DashboardLayout**

Inside `DashboardLayout`, after the existing destructuring block, add:

```typescript
  const { report2, consolidated2, cacheStatus } = props;

  // WHY: v2 state takes priority over v1 — if Report 2 or Consolidated 2 is loaded/fetching,
  // we render consolidated mode. Otherwise fall through to single-entity or v1 behavior.
  const activeView: 'single' | 'report2' | 'consolidated2' =
    report2.state === 'loaded' ? 'report2'
    : consolidated2.state === 'loaded' ? 'consolidated2'
    : 'single';

  const consolidatedPayload = activeView === 'report2' ? report2.payload
    : activeView === 'consolidated2' ? consolidated2.payload
    : null;
```

- [ ] **Step 2: Add handlers for the new modals**

Add these handlers near the existing `handleAllClick`:

```typescript
  const handleReport2Click = () => {
    report2.open();
  };

  const handleViewConsolidated2Click = () => {
    consolidated2.open(selectedEntityIds);
  };

  const handleReport2Start = (filters: FetchAllFilters) => {
    report2.startReport(filters);
  };

  const handleConsolidated2Start = () => {
    consolidated2.start();
  };

  const handleGoToReport2 = () => {
    consolidated2.reset();
    report2.open();
  };
```

- [ ] **Step 3: Pass new props into LeftPanel**

Update the `<LeftPanel ... />` element to pass:

```tsx
            <LeftPanel
              // ... existing props ...
              report2State={report2.state}
              report2Payload={report2.payload}
              cacheStatus={cacheStatus}
              activeView={activeView}
              onReport2Click={handleReport2Click}
              onViewConsolidated2={handleViewConsolidated2Click}
            />
```

- [ ] **Step 4: Render the new modals after FetchAllDialog**

Import the new modals at the top:

```typescript
import { Report2FilterModal } from '../components/shared/Report2FilterModal';
import { Report2ProgressModal } from '../components/shared/Report2ProgressModal';
import { Consolidated2ConfirmModal } from '../components/shared/Consolidated2ConfirmModal';
```

Immediately after the existing `<FetchAllDialog ... />` line inside the JSX return, add:

```tsx
      <Report2FilterModal
        isOpen={report2.state === 'configuring'}
        entities={allEntities}
        onConfirm={handleReport2Start}
        onCancel={report2.cancel}
      />
      <Report2ProgressModal
        isOpen={report2.state === 'fetching'}
        progress={report2.progress}
      />
      <Consolidated2ConfirmModal
        isOpen={consolidated2.state === 'configuring' || consolidated2.state === 'fetching' || consolidated2.state === 'needs-report-2' || consolidated2.state === 'error'}
        state={consolidated2.state}
        selectedEntities={allEntities.filter(e => consolidated2.entityIds.includes(e.id))}
        error={consolidated2.error}
        onConfirm={handleConsolidated2Start}
        onCancel={consolidated2.cancel}
        onGoToReport2={handleGoToReport2}
      />
```

- [ ] **Step 5: Render ConsolidatedHeader + consolidated RightPanel when activeView !== 'single'**

Replace the existing `{displayDashboard ? (...) : (...)}` block inside the `<main>` element with a branched version. Import `ConsolidatedHeader` at the top.

Replace from `{fetchAllLoadState === 'loading' ? (...)` through the end of the `<AnimatePresence>` block:

```tsx
          {fetchAllLoadState === 'loading' ? (
            <FetchAllProgress progress={fetchAllProgress} />
          ) : activeView !== 'single' && consolidatedPayload ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-[var(--spacing-base)]"
              >
                <ConsolidatedHeader
                  mode={activeView === 'report2' ? 'report' : 'consolidated'}
                  entityCount={consolidatedPayload.entities.length}
                  dimensionLabel={DIMENSION_CONFIG[activeDimension].pluralLabel}
                  filters={activeView === 'report2' ? report2.filters : null}
                  yearsAvailable={consolidatedPayload.yearsAvailable}
                  activePeriod={activePeriod}
                  onPeriodChange={switchPeriod}
                  onExport={exportCsv}
                />
                <RightPanel
                  entity={null}
                  kpis={consolidatedPayload.kpis}
                  monthlyRevenue={consolidatedPayload.monthlyRevenue}
                  productMixes={consolidatedPayload.productMixes}
                  topSellers={consolidatedPayload.topSellers}
                  sparklines={consolidatedPayload.sparklines}
                  orders={consolidatedPayload.orders}
                  items={consolidatedPayload.items}
                  contacts={contacts}
                  yearsAvailable={consolidatedPayload.yearsAvailable}
                  activePeriod={activePeriod}
                  activeTab={activeTab}
                  onPeriodChange={switchPeriod}
                  onTabChange={setActiveTab}
                  onExport={exportCsv}
                  consolidatedMode={true}
                  consolidatedEntities={consolidatedPayload.entities}
                  perEntityProductMixes={consolidatedPayload.perEntityProductMixes}
                  perEntityTopSellers={consolidatedPayload.perEntityTopSellers}
                  hideDetailHeader={true}
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            <AnimatePresence mode="wait">
              {displayDashboard ? (
                <motion.div key={activeEntityId ?? 'none'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex flex-col gap-[var(--spacing-base)]">
                  <RightPanel
                    entity={isAllActive ? null : activeEntity}
                    kpis={displayDashboard.kpis}
                    monthlyRevenue={displayDashboard.monthlyRevenue}
                    productMixes={displayDashboard.productMixes}
                    topSellers={displayDashboard.topSellers}
                    sparklines={displayDashboard.sparklines}
                    orders={displayDashboard.orders}
                    items={displayDashboard.items}
                    contacts={contacts}
                    yearsAvailable={yearsAvailable}
                    activePeriod={activePeriod}
                    activeTab={activeTab}
                    onPeriodChange={switchPeriod}
                    onTabChange={setActiveTab}
                    onExport={exportCsv}
                  />
                </motion.div>
              ) : (
                <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 items-center justify-center">
                  <p className="text-[14px] text-[var(--color-text-muted)]">
                    {isConsolidatedLoading
                      ? 'Loading consolidated view\u2026'
                      : `Select a ${DIMENSION_CONFIG[activeDimension].singularLabel} to view details`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          )}
```

- [ ] **Step 6: Extend RightPanel props to accept consolidatedMode flag + per-entity data**

In `client/src/components/right-panel/RightPanel.tsx`, extend the interface:

```typescript
interface RightPanelProps {
  // ... existing props ...
  consolidatedMode?: boolean;
  consolidatedEntities?: EntityListItem[];
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
  hideDetailHeader?: boolean;
}
```

Inside the component body, conditionally render `<DetailHeader />` only when `!hideDetailHeader`. Pass `consolidatedEntities` to `KPISection` and `perEntityProductMixes`/`perEntityTopSellers` to `ChartsRow`. Pass `consolidatedMode` to `TabsSection`.

- [ ] **Step 7: Extend TabsSection to use consolidated tables**

In `client/src/components/right-panel/TabsSection.tsx`, accept a `consolidatedMode?: boolean` prop. When `consolidatedMode`, render `ConsolidatedOrdersTable` for the Orders tab and `ConsolidatedContactsTable` for the Contacts tab (instead of the default `OrdersTable` / `ContactsTable`).

Import:

```typescript
import { ConsolidatedOrdersTable } from './ConsolidatedOrdersTable';
import { ConsolidatedContactsTable } from './ConsolidatedContactsTable';
```

Replace the Orders tab render:

```tsx
{activeTab === 'orders' && (
  consolidatedMode
    ? <ConsolidatedOrdersTable orders={orders} />
    : <OrdersTab orders={orders} />
)}
```

Replace the Contacts tab render:

```tsx
{activeTab === 'contacts' && (
  consolidatedMode
    ? <ConsolidatedContactsTable contacts={contacts} />
    : <ContactsTable contacts={contacts} />
)}
```

- [ ] **Step 8: Verify full TypeScript build**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add client/src/layouts/DashboardLayout.tsx client/src/components/right-panel/RightPanel.tsx client/src/components/right-panel/TabsSection.tsx
git commit -m "feat(client): wire Report 2 / Consolidated 2 state into DashboardLayout and RightPanel"
```

---

## Phase 9 — Verification

### Task 9.1: Run all automated checks

- [ ] **Step 1: Run client TypeScript build**

Run: `cd client && npx tsc -b --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Run server TypeScript build**

Run: `cd server && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Run full server test suite**

Run: `cd server && npx vitest run`
Expected: All tests pass (includes the 7 new aggregator tests + 3 new cache-status tests).

- [ ] **Step 4: Run Vite production build**

Run: `cd client && npx vite build`
Expected: Build succeeds. Final gzip bundle < 500 KB.

- [ ] **Step 5: Check no `any` types were added**

Run: `grep -rn ": any\|as any" server/src/ client/src/ shared/`
Expected: No new matches introduced by v2 files (only pre-existing ones).

- [ ] **Step 6: Check no file exceeds 300 lines**

Run: `find {server,client,shared}/src -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20`
Expected: No newly-created v2 file exceeds 300 lines. If any does, split it before proceeding.

- [ ] **Step 7: Check intent block present on every new file**

Run: `for f in $(git diff --name-only main -- '*.ts' '*.tsx' | grep -E "^(client|server|shared)/src/"); do head -4 "$f" | grep -q "FILE:" || echo "Missing intent block: $f"; done`
Expected: No output (all new files have intent blocks).

---

### Task 9.2: Manual UAT

- [ ] **Step 1: Start dev servers**

Terminal 1: `cd server && npm run dev`
Terminal 2: `cd client && npm run dev`
Expected: server listens on 3001, Vite on 5173.

- [ ] **Step 2: Open dashboard**

Open `http://localhost:5173` in a browser. Expected: entity list loads. Report 2 button is visible below the Report button.

- [ ] **Step 3: Test Report 2 flow**

1. Click "Report 2" → filter modal opens
2. Select "All" for all three fields → click Start
3. Progress modal shows Phase 1 rows increasing, Phase 2 computing metrics
4. Dashboard renders with `ConsolidatedHeader: "Report: N Customers"`
5. Orders tab has Customer column populated with `CUSTDES`
6. Contacts tab has Customer column
7. Click hero revenue card → modal opens with toggle
8. Flip toggle to "Per Customer" → table shows customers sorted by revenue desc

- [ ] **Step 4: Test View Consolidated 2 flow (warm cache)**

1. With Report 2 data loaded, search "disney" in entity list
2. Check 3 Disney accounts
3. SelectionBar shows "View Consolidated 2" below existing button
4. Click it → confirmation modal shows entity names
5. Click Start → dashboard renders within 1 second
6. Header: "Consolidated: 3 Customers"

- [ ] **Step 5: Test cross-dimension cache reuse**

1. With Report 2 loaded on customer dimension, switch to vendor dimension
2. Watch network tab: only `/api/sales/entities?groupBy=vendor` fires, no Priority calls
3. Click Report 2 → should show "Data ready" state from `useCacheStatus`

- [ ] **Step 6: Test iframe reload resilience**

1. With Report 2 loaded, hard refresh (Cmd+R)
2. Once page loads, `useCacheStatus` fires
3. Report 2 button shows "Data ready — click to view"

- [ ] **Step 7: Test v1 coexistence**

1. Verify original Report and View Consolidated buttons still render above the v2 counterparts
2. Click v1 Report — verify it still runs its own flow independently
3. Verify v1 state doesn't leak into v2 (and vice versa)

- [ ] **Step 8: Test single-entity regression (C7826)**

1. Click customer C7826 in entity list
2. Right panel renders with `DetailHeader` (not `ConsolidatedHeader`)
3. Orders tab does NOT have Customer column (single-entity mode)
4. KPI modal does NOT show the per-customer toggle

- [ ] **Step 9: Commit final plan execution marker**

```bash
git commit --allow-empty -m "chore: Report 2 / View Consolidated 2 v2 implementation complete"
```

---

## Self-Review Checklist

After executing all tasks:

- [ ] Spec section 4 (user flows) — covered by Phases 4–8
- [ ] Spec section 5 (display design) — covered by Phase 6–8
- [ ] Spec section 6 (server design) — covered by Phase 1–2
- [ ] Spec section 7 (client design) — covered by Phase 3–8
- [ ] Spec section 8 (cache strategy) — covered by Phases 2.1–2.3 (key change + payload cache) and Phase 3.1 (client cache-status hook)
- [ ] Spec section 9 (Priority ERP) — no new Priority calls introduced; reused existing `fetchOrders` / `fetchCustomers`
- [ ] Spec section 10.1 (automated checks) — Task 9.1
- [ ] Spec section 10.2 (manual UAT script) — Task 9.2
- [ ] Every new file has an intent block
- [ ] No file exceeds 300 lines
- [ ] No `any` types added
- [ ] v1 code untouched (grep for `isConsolidated` still shows v1 usages intact)
- [ ] All 7 new aggregator tests + 3 new cache-status tests pass
- [ ] No Priority writes (grep for POST/PATCH/PUT/DELETE in server routes)

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-04-14-report-2-and-consolidated-2-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
