# Cache Integrity & Data Flow Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 structural data-flow issues found by Codex adversarial review: cache key contamination, ghost filters, cold-cache empty panels, and broken consolidated view.

**Architecture:** Shared filter-aware cache key infrastructure (Phase 1) enables safe filtered caching. New services (`customer-filter.ts`, `entity-stub-builder.ts`) handle post-fetch filtering and cold-cache fallback. Server-side consolidated aggregation replaces broken client-side approach.

**Tech Stack:** Express + TypeScript, Vitest, Upstash Redis, TanStack Query v5, Zod

**Spec:** `docs/specs/2026-04-13-cache-integrity-and-data-flow-fixes.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `server/src/services/customer-filter.ts` | Post-fetch filtering of orders by zone/customerType |
| `server/src/services/entity-stub-builder.ts` | Derive entity stubs from warm-cache orders |
| `server/tests/cache/cache-keys.test.ts` | Tests for buildFilterQualifier |
| `server/tests/services/customer-filter.test.ts` | Tests for filterOrdersByCustomerCriteria |
| `server/tests/services/entity-stub-builder.test.ts` | Tests for deriveEntityStubs |
| `server/tests/services/entity-filter.test.ts` | Tests for filterOrdersByEntityIds |

### Modified files
| File | Change |
|------|--------|
| `server/src/cache/cache-keys.ts` | Add `buildFilterQualifier` |
| `server/src/routes/fetch-all.ts` | Filter-aware key + post-fetch customer filtering |
| `server/src/routes/entities.ts` | Filter-aware key read + entity stub derivation |
| `server/src/routes/dashboard.ts` | Dimension-aware entityIds filtering |
| `client/src/hooks/useDashboardData.ts` | Add `useConsolidatedDashboard` hook |
| `client/src/hooks/useDashboardState.ts` | Wire consolidated hook |
| `client/src/utils/aggregation.ts` | Remove dead `aggregateForConsolidated` |

---

## Shared Test Factories

All new test files should reuse these builders (copy from `data-aggregator.test.ts` pattern):

```typescript
import type { RawOrder, RawOrderItem, RawCustomer } from '../../src/services/priority-queries';

function makeItem(overrides: Partial<RawOrderItem> = {}): RawOrderItem {
  return {
    PDES: 'Widget A', PARTNAME: 'WGT-A', TQUANT: 100, TUNITNAME: 'ea',
    QPRICE: 5000, PRICE: 50, PURCHASEPRICE: 30, QPROFIT: 2000, PERCENT: 40,
    Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One', Y_9952_5_ESH: 'BrandX',
    Y_3020_5_ESH: 'FAM1', Y_3021_5_ESH: 'Packaging', Y_17936_5_ESH: 'VP-001',
    Y_2075_5_ESH: 'Family A', Y_5380_5_ESH: 'USA', Y_9967_5_ESH: 'N',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    ORDNAME: 'ORD-001', CURDATE: '2026-02-15T00:00:00Z', ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000, CUSTNAME: 'C001', AGENTCODE: 'A01', AGENTNAME: 'Sarah M.',
    ORDERITEMS_SUBFORM: [makeItem()],
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<RawCustomer> = {}): RawCustomer {
  return {
    CUSTNAME: 'C001', CUSTDES: 'Acme Corp', ZONECODE: 'Z1', ZONEDES: 'North',
    AGENTCODE: 'A01', AGENTNAME: 'Sarah M.', CREATEDDATE: '2021-01-15T00:00:00Z',
    CTYPECODE: 'RT', CTYPENAME: 'Retail',
    ...overrides,
  };
}
```

---

## Phase 1: Cache Key Contamination Fix (Critical)

### Task 1: Test + implement `buildFilterQualifier`

**Files:**
- Create: `server/tests/cache/cache-keys.test.ts`
- Modify: `server/src/cache/cache-keys.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/cache/cache-keys.test.ts`:

```typescript
// FILE: server/tests/cache/cache-keys.test.ts
import { describe, it, expect } from 'vitest';
import { cacheKey, buildFilterQualifier } from '../../src/cache/cache-keys';

describe('buildFilterQualifier', () => {
  it('combines groupBy and filterHash with colon separator', () => {
    const result = buildFilterQualifier('customer', 'agent=Sarah');
    expect(result).toBe('customer:agent=Sarah');
  });

  it('produces the unfiltered qualifier when hash is "all"', () => {
    const result = buildFilterQualifier('customer', 'all');
    expect(result).toBe('customer:all');
  });

  it('works with non-customer dimensions', () => {
    const result = buildFilterQualifier('zone', 'zone=North&type=Retail');
    expect(result).toBe('zone:zone=North&type=Retail');
  });
});

describe('cacheKey with buildFilterQualifier', () => {
  it('builds filter-aware entities_full key', () => {
    const key = cacheKey('entities_full', 'ytd', buildFilterQualifier('customer', 'agent=Sarah'));
    expect(key).toBe('dashboard:entities_full:ytd:customer:agent=Sarah');
  });

  it('builds unfiltered entities_full key', () => {
    const key = cacheKey('entities_full', 'ytd', buildFilterQualifier('customer', 'all'));
    expect(key).toBe('dashboard:entities_full:ytd:customer:all');
  });

  it('filtered and unfiltered keys are different', () => {
    const filtered = cacheKey('entities_full', 'ytd', buildFilterQualifier('customer', 'agent=Sarah'));
    const unfiltered = cacheKey('entities_full', 'ytd', buildFilterQualifier('customer', 'all'));
    expect(filtered).not.toBe(unfiltered);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/cache/cache-keys.test.ts`
Expected: FAIL — `buildFilterQualifier` is not exported from `cache-keys.ts`

- [ ] **Step 3: Implement `buildFilterQualifier`**

Edit `server/src/cache/cache-keys.ts` — add after line 15 (after the `cacheKey` function):

```typescript
/** Combine dimension + filter hash into a cache key qualifier.
 * WHY: Ensures filtered and unfiltered cache entries use distinct keys.
 * Without this, filtered fetch-all results overwrite unfiltered data. */
export function buildFilterQualifier(groupBy: string, filterHash: string): string {
  return `${groupBy}:${filterHash}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/cache/cache-keys.test.ts`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add server/tests/cache/cache-keys.test.ts server/src/cache/cache-keys.ts
git commit -m "feat: add buildFilterQualifier to cache-keys for filter-aware caching"
```

---

### Task 2: Update `fetch-all.ts` to use filter-aware `entities_full` key

**Files:**
- Modify: `server/src/routes/fetch-all.ts` (line 114)

- [ ] **Step 1: Update the entities_full cache key write**

Edit `server/src/routes/fetch-all.ts`:

Change line 1 imports — add `buildFilterQualifier`:
```typescript
import { cacheKey, getTTL, buildFilterQualifier } from '../cache/cache-keys.js';
```

Change line 114:
```typescript
// Before:
const fullKey = cacheKey('entities_full', period, groupBy);

// After:
const fullKey = cacheKey('entities_full', period, buildFilterQualifier(groupBy, filterHash));
```

- [ ] **Step 2: Run existing tests to verify no regression**

Run: `cd server && npx vitest run`
Expected: All existing tests pass (the fetch-all route has no dedicated tests — this is safe because the key is only consumed by the entities route which we update next)

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/fetch-all.ts
git commit -m "fix: add filterHash to entities_full cache key to prevent contamination"
```

---

### Task 3: Update `entities.ts` to read filter-aware key

**Files:**
- Modify: `server/src/routes/entities.ts` (line 32)

- [ ] **Step 1: Update the entities_full cache key read**

Edit `server/src/routes/entities.ts`:

Change imports — add `buildFilterQualifier`:
```typescript
import { cacheKey, getTTL, buildFilterQualifier } from '../cache/cache-keys.js';
```

Change line 32:
```typescript
// Before:
const fullKey = cacheKey('entities_full', period, groupBy);

// After:
// WHY: Always read the UNFILTERED key. Filtered entity lists are sent
// directly via the fetch-all SSE response, not re-read from cache here.
const fullKey = cacheKey('entities_full', period, buildFilterQualifier(groupBy, 'all'));
```

- [ ] **Step 2: Run all tests to verify no regression**

Run: `cd server && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run TypeScript check**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/entities.ts
git commit -m "fix: entities endpoint reads unfiltered entities_full key only"
```

---

## Phase 2: Cold Cache Empty Left Panel Fix (High)

### Task 4: Test + implement `deriveEntityStubs`

**Files:**
- Create: `server/tests/services/entity-stub-builder.test.ts`
- Create: `server/src/services/entity-stub-builder.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/services/entity-stub-builder.test.ts`:

```typescript
// FILE: server/tests/services/entity-stub-builder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RawOrder, RawOrderItem, RawCustomer } from '../../src/services/priority-queries';

// Mock Redis
const mockGet = vi.fn();
vi.mock('../../src/cache/redis-client', () => ({
  redis: { get: (...args: unknown[]) => mockGet(...args) },
}));

// Mock cachedFetch to return customers directly
const mockCachedFetch = vi.fn();
vi.mock('../../src/cache/cache-layer', () => ({
  cachedFetch: (...args: unknown[]) => mockCachedFetch(...args),
}));

// Mock priority-instance (required by import chain)
vi.mock('../../src/services/priority-instance', () => ({
  priorityClient: {},
}));

import { deriveEntityStubs } from '../../src/services/entity-stub-builder';

function makeItem(overrides: Partial<RawOrderItem> = {}): RawOrderItem {
  return {
    PDES: 'Widget A', PARTNAME: 'WGT-A', TQUANT: 100, TUNITNAME: 'ea',
    QPRICE: 5000, PRICE: 50, PURCHASEPRICE: 30, QPROFIT: 2000, PERCENT: 40,
    Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One', Y_9952_5_ESH: 'BrandX',
    Y_3020_5_ESH: 'FAM1', Y_3021_5_ESH: 'Packaging', Y_17936_5_ESH: 'VP-001',
    Y_2075_5_ESH: 'Family A', Y_5380_5_ESH: 'USA', Y_9967_5_ESH: 'N',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    ORDNAME: 'ORD-001', CURDATE: '2026-02-15T00:00:00Z', ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000, CUSTNAME: 'C001', AGENTCODE: 'A01', AGENTNAME: 'Sarah M.',
    ORDERITEMS_SUBFORM: [makeItem()],
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<RawCustomer> = {}): RawCustomer {
  return {
    CUSTNAME: 'C001', CUSTDES: 'Acme Corp', ZONECODE: 'Z1', ZONEDES: 'North',
    AGENTCODE: 'A01', AGENTNAME: 'Sarah M.', CREATEDDATE: '2021-01-15T00:00:00Z',
    CTYPECODE: 'RT', CTYPENAME: 'Retail',
    ...overrides,
  };
}

describe('deriveEntityStubs', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockCachedFetch.mockReset();
  });

  it('returns null when orders_ytd cache is empty', async () => {
    mockGet.mockResolvedValue(null);

    const result = await deriveEntityStubs('zone', 'ytd');

    expect(result).toBeNull();
  });

  it('derives zone entities from cached orders', async () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C001', TOTPRICE: 10000 }),
      makeOrder({ ORDNAME: 'O2', CUSTNAME: 'C002', TOTPRICE: 5000 }),
    ];
    const customers = [
      makeCustomer({ CUSTNAME: 'C001', ZONECODE: 'Z1', ZONEDES: 'North' }),
      makeCustomer({ CUSTNAME: 'C002', ZONECODE: 'Z2', ZONEDES: 'South' }),
    ];

    mockGet.mockResolvedValue(JSON.stringify({ data: orders, cachedAt: new Date().toISOString() }));
    mockCachedFetch.mockResolvedValue({ data: customers, cached: true, cachedAt: null });

    const result = await deriveEntityStubs('zone', 'ytd');

    expect(result).not.toBeNull();
    expect(result!.entities).toHaveLength(2);
    expect(result!.entities.find(e => e.id === 'Z1')).toBeDefined();
    expect(result!.entities.find(e => e.id === 'Z2')).toBeDefined();
  });

  it('derives vendor entities from cached orders', async () => {
    const orders = [
      makeOrder({
        ORDNAME: 'O1',
        ORDERITEMS_SUBFORM: [
          makeItem({ Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One', QPRICE: 5000 }),
          makeItem({ Y_1159_5_ESH: 'V02', Y_1530_5_ESH: 'Vendor Two', QPRICE: 3000 }),
        ],
      }),
    ];
    const customers = [makeCustomer()];

    mockGet.mockResolvedValue(JSON.stringify({ data: orders, cachedAt: new Date().toISOString() }));
    mockCachedFetch.mockResolvedValue({ data: customers, cached: true, cachedAt: null });

    const result = await deriveEntityStubs('vendor', 'ytd');

    expect(result).not.toBeNull();
    expect(result!.entities).toHaveLength(2);
    expect(result!.entities.find(e => e.id === 'V01')?.name).toBe('Vendor One');
  });

  it('returns yearsAvailable from order dates', async () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', CURDATE: '2026-03-01T00:00:00Z' }),
      makeOrder({ ORDNAME: 'O2', CURDATE: '2025-11-01T00:00:00Z' }),
    ];
    const customers = [makeCustomer()];

    mockGet.mockResolvedValue(JSON.stringify({ data: orders, cachedAt: new Date().toISOString() }));
    mockCachedFetch.mockResolvedValue({ data: customers, cached: true, cachedAt: null });

    const result = await deriveEntityStubs('zone', 'ytd');

    expect(result!.yearsAvailable).toContain('2026');
    expect(result!.yearsAvailable).toContain('2025');
    // Sorted descending
    expect(result!.yearsAvailable[0]).toBe('2026');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/services/entity-stub-builder.test.ts`
Expected: FAIL — module `../../src/services/entity-stub-builder` not found

- [ ] **Step 3: Implement `entity-stub-builder.ts`**

Create `server/src/services/entity-stub-builder.ts`:

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
 * WHY: Non-customer dimensions need order data to group. The warm cache
 * already has this in Redis — use it instead of returning an empty panel.
 * Returns null if orders_ytd is not yet cached (rare — warm cache runs on startup).
 */
export async function deriveEntityStubs(
  groupBy: Dimension,
  period: string,
): Promise<EntityStubResult | null> {
  const ordersKey = cacheKey('orders_ytd', 'ytd');
  const ordersCached = await redis.get(ordersKey);
  if (!ordersCached) {
    console.warn('[entity-stub-builder] orders_ytd cache miss — warm cache may not have run yet');
    return null;
  }

  const envelope = typeof ordersCached === 'string' ? JSON.parse(ordersCached) : ordersCached;
  const orders: RawOrder[] = (envelope as { data: RawOrder[] }).data;

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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/services/entity-stub-builder.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/services/entity-stub-builder.ts server/tests/services/entity-stub-builder.test.ts
git commit -m "feat: add entity-stub-builder for cold-cache entity list derivation"
```

---

### Task 5: Wire `deriveEntityStubs` into entities route

**Files:**
- Modify: `server/src/routes/entities.ts` (lines 58-61)

- [ ] **Step 1: Update entities.ts to use stub builder**

Edit `server/src/routes/entities.ts`:

Add import after line 14:
```typescript
import { deriveEntityStubs } from '../services/entity-stub-builder.js';
import type { Dimension } from '@shared/types/dashboard';
```

Replace lines 58-61:
```typescript
// Before:
if (groupBy !== 'customer') {
  // WHY: Non-customer dimensions require order data to group — return empty list.
  // The warm cache or dashboard endpoint will populate this key later.
  return { entities: [], yearsAvailable: [] };
}

// After:
if (groupBy !== 'customer') {
  // WHY: Derive entity stubs from warm-cache orders instead of returning empty.
  // Same pattern as customers: show entity list first, load details on click.
  const stubs = await deriveEntityStubs(groupBy as Dimension, period);
  return stubs ?? { entities: [], yearsAvailable: [] };
}
```

- [ ] **Step 2: Run all tests**

Run: `cd server && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run TypeScript check**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/entities.ts
git commit -m "fix: non-customer dimensions derive entity stubs from warm cache instead of empty array"
```

---

## Phase 3: Zone & CustomerType Filters (High)

### Task 6: Test + implement `filterOrdersByCustomerCriteria`

**Files:**
- Create: `server/tests/services/customer-filter.test.ts`
- Create: `server/src/services/customer-filter.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/services/customer-filter.test.ts`:

```typescript
// FILE: server/tests/services/customer-filter.test.ts
import { describe, it, expect } from 'vitest';
import { filterOrdersByCustomerCriteria } from '../../src/services/customer-filter';
import type { RawOrder, RawOrderItem, RawCustomer } from '../../src/services/priority-queries';

function makeItem(overrides: Partial<RawOrderItem> = {}): RawOrderItem {
  return {
    PDES: 'Widget A', PARTNAME: 'WGT-A', TQUANT: 100, TUNITNAME: 'ea',
    QPRICE: 5000, PRICE: 50, PURCHASEPRICE: 30, QPROFIT: 2000, PERCENT: 40,
    Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One', Y_9952_5_ESH: 'BrandX',
    Y_3020_5_ESH: 'FAM1', Y_3021_5_ESH: 'Packaging', Y_17936_5_ESH: 'VP-001',
    Y_2075_5_ESH: 'Family A', Y_5380_5_ESH: 'USA', Y_9967_5_ESH: 'N',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    ORDNAME: 'ORD-001', CURDATE: '2026-02-15T00:00:00Z', ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000, CUSTNAME: 'C001', AGENTCODE: 'A01', AGENTNAME: 'Sarah M.',
    ORDERITEMS_SUBFORM: [makeItem()],
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<RawCustomer> = {}): RawCustomer {
  return {
    CUSTNAME: 'C001', CUSTDES: 'Acme Corp', ZONECODE: 'Z1', ZONEDES: 'North',
    AGENTCODE: 'A01', AGENTNAME: 'Sarah M.', CREATEDDATE: '2021-01-15T00:00:00Z',
    CTYPECODE: 'RT', CTYPENAME: 'Retail',
    ...overrides,
  };
}

const customers: RawCustomer[] = [
  makeCustomer({ CUSTNAME: 'C001', ZONEDES: 'North', CTYPENAME: 'Retail' }),
  makeCustomer({ CUSTNAME: 'C002', ZONEDES: 'South', CTYPENAME: 'Wholesale' }),
  makeCustomer({ CUSTNAME: 'C003', ZONEDES: 'North', CTYPENAME: 'Wholesale' }),
];

const orders: RawOrder[] = [
  makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C001' }),
  makeOrder({ ORDNAME: 'O2', CUSTNAME: 'C002' }),
  makeOrder({ ORDNAME: 'O3', CUSTNAME: 'C003' }),
];

describe('filterOrdersByCustomerCriteria', () => {
  it('returns all orders when no criteria set', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, {});
    expect(result).toHaveLength(3);
  });

  it('filters by zone — single zone', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { zone: 'North' });
    expect(result).toHaveLength(2);
    expect(result.map(o => o.CUSTNAME).sort()).toEqual(['C001', 'C003']);
  });

  it('filters by zone — multiple zones (OR within type)', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { zone: 'North,South' });
    expect(result).toHaveLength(3);
  });

  it('filters by customerType — single type', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { customerType: 'Retail' });
    expect(result).toHaveLength(1);
    expect(result[0].CUSTNAME).toBe('C001');
  });

  it('filters by customerType — multiple types (OR within type)', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { customerType: 'Retail,Wholesale' });
    expect(result).toHaveLength(3);
  });

  it('AND logic across zone + customerType', () => {
    // North AND Wholesale = only C003
    const result = filterOrdersByCustomerCriteria(orders, customers, {
      zone: 'North',
      customerType: 'Wholesale',
    });
    expect(result).toHaveLength(1);
    expect(result[0].CUSTNAME).toBe('C003');
  });

  it('is case-insensitive', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { zone: 'north' });
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no customers match', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { zone: 'West' });
    expect(result).toHaveLength(0);
  });

  it('handles whitespace in comma-separated values', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { zone: ' North , South ' });
    expect(result).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/services/customer-filter.test.ts`
Expected: FAIL — module `../../src/services/customer-filter` not found

- [ ] **Step 3: Implement `customer-filter.ts`**

Create `server/src/services/customer-filter.ts`:

```typescript
// FILE: server/src/services/customer-filter.ts
// PURPOSE: Post-fetch filtering of orders by customer-level criteria (zone, customerType)
// USED BY: server/src/routes/fetch-all.ts
// EXPORTS: filterOrdersByCustomerCriteria

import type { RawOrder, RawCustomer } from './priority-queries.js';

interface CustomerFilterCriteria {
  zone?: string;         // comma-separated zone names (ZONEDES)
  customerType?: string; // comma-separated customer type names (CTYPENAME)
}

/**
 * Filter orders to only those from customers matching zone/customerType criteria.
 * WHY: Zone and customerType are CUSTOMERS-level fields — can't be OData-filtered
 * on ORDERS. This post-fetch filter runs after the join.
 * Within a filter type, values are OR'd. Across types, AND'd.
 * Returns all orders if no criteria are set.
 */
export function filterOrdersByCustomerCriteria(
  orders: RawOrder[],
  customers: RawCustomer[],
  criteria: CustomerFilterCriteria,
): RawOrder[] {
  const { zone, customerType } = criteria;
  if (!zone && !customerType) return orders;

  const zoneSet = zone
    ? new Set(zone.split(',').map(z => z.trim().toLowerCase()))
    : null;
  const typeSet = customerType
    ? new Set(customerType.split(',').map(t => t.trim().toLowerCase()))
    : null;

  // WHY: Build customer lookup once, then filter orders. O(customers + orders) not O(customers * orders).
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/services/customer-filter.test.ts`
Expected: PASS (all 9 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/services/customer-filter.ts server/tests/services/customer-filter.test.ts
git commit -m "feat: add customer-filter for post-fetch zone/customerType filtering"
```

---

### Task 7: Wire `filterOrdersByCustomerCriteria` into fetch-all route

**Files:**
- Modify: `server/src/routes/fetch-all.ts`

- [ ] **Step 1: Update fetch-all.ts to apply post-fetch filtering**

Edit `server/src/routes/fetch-all.ts`:

Add import after line 13:
```typescript
import { filterOrdersByCustomerCriteria } from '../services/customer-filter.js';
```

After line 98 (customers fetch), before line 100, insert:

```typescript
    // WHY: Zone and customerType are CUSTOMERS-level fields. Filter orders
    // after fetching both datasets. agentName is already OData-filtered above.
    const filteredOrders = filterOrdersByCustomerCriteria(orders, customers.data, { zone, customerType });
```

Then replace `orders` with `filteredOrders` on the following lines:

Line 101 (was `orders`):
```typescript
    const entities = groupByDimension(groupBy as Dimension, filteredOrders, customers.data, periodMonths);
```

Line 102 (was `orders`):
```typescript
    const aggregate = aggregateOrders(filteredOrders, prevOrders.data, period);
```

Line 104 (was `orders`):
```typescript
    const years = new Set(filteredOrders.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
```

- [ ] **Step 2: Update the comment at lines 180-182**

Replace:
```typescript
// WHY: Zone and customerType filter at CUSTOMERS level, but we query ORDERS.
// For agentName, we can filter directly on ORDERS.AGENTNAME.
// Zone/customerType handled post-fetch by groupByDimension filtering.
```

With:
```typescript
// WHY: agentName can be OData-filtered directly on ORDERS.AGENTNAME.
// Zone/customerType are CUSTOMERS-level — handled by filterOrdersByCustomerCriteria() above.
```

- [ ] **Step 3: Run all tests**

Run: `cd server && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Run TypeScript check**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/fetch-all.ts
git commit -m "fix: apply zone/customerType post-fetch filtering in fetch-all route"
```

---

## Phase 4: Consolidated View Fix (High)

### Task 8: Test + implement `filterOrdersByEntityIds`

**Files:**
- Create: `server/tests/services/entity-filter.test.ts`
- Modify: `server/src/routes/dashboard.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/services/entity-filter.test.ts`:

```typescript
// FILE: server/tests/services/entity-filter.test.ts
import { describe, it, expect, vi } from 'vitest';

// WHY: dashboard.ts imports Redis, fetch, and other services.
// We must mock these before importing the function under test.
vi.mock('../../src/cache/redis-client', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}));
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ value: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
));
vi.mock('../../src/services/priority-instance', () => ({
  priorityClient: {},
}));

import { filterOrdersByEntityIds } from '../../src/routes/dashboard';
import type { RawOrder, RawOrderItem, RawCustomer } from '../../src/services/priority-queries';

function makeItem(overrides: Partial<RawOrderItem> = {}): RawOrderItem {
  return {
    PDES: 'Widget A', PARTNAME: 'WGT-A', TQUANT: 100, TUNITNAME: 'ea',
    QPRICE: 5000, PRICE: 50, PURCHASEPRICE: 30, QPROFIT: 2000, PERCENT: 40,
    Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One', Y_9952_5_ESH: 'BrandX',
    Y_3020_5_ESH: 'FAM1', Y_3021_5_ESH: 'Packaging', Y_17936_5_ESH: 'VP-001',
    Y_2075_5_ESH: 'Family A', Y_5380_5_ESH: 'USA', Y_9967_5_ESH: 'N',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    ORDNAME: 'ORD-001', CURDATE: '2026-02-15T00:00:00Z', ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000, CUSTNAME: 'C001', AGENTCODE: 'A01', AGENTNAME: 'Sarah M.',
    ORDERITEMS_SUBFORM: [makeItem()],
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<RawCustomer> = {}): RawCustomer {
  return {
    CUSTNAME: 'C001', CUSTDES: 'Acme Corp', ZONECODE: 'Z1', ZONEDES: 'North',
    AGENTCODE: 'A01', AGENTNAME: 'Sarah M.', CREATEDDATE: '2021-01-15T00:00:00Z',
    CTYPECODE: 'RT', CTYPENAME: 'Retail',
    ...overrides,
  };
}

const customers: RawCustomer[] = [
  makeCustomer({ CUSTNAME: 'C001', ZONECODE: 'Z1' }),
  makeCustomer({ CUSTNAME: 'C002', ZONECODE: 'Z2' }),
  makeCustomer({ CUSTNAME: 'C003', ZONECODE: 'Z1' }),
];

const orders: RawOrder[] = [
  makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C001' }),
  makeOrder({ ORDNAME: 'O2', CUSTNAME: 'C002' }),
  makeOrder({ ORDNAME: 'O3', CUSTNAME: 'C003' }),
];

describe('filterOrdersByEntityIds', () => {
  it('filters by CUSTNAME for customer dimension', () => {
    const result = filterOrdersByEntityIds(orders, new Set(['C001', 'C003']), 'customer', customers);
    expect(result).toHaveLength(2);
    expect(result.map(o => o.ORDNAME).sort()).toEqual(['O1', 'O3']);
  });

  it('filters by zone — includes orders from all customers in matching zones', () => {
    // Z1 includes C001 and C003
    const result = filterOrdersByEntityIds(orders, new Set(['Z1']), 'zone', customers);
    expect(result).toHaveLength(2);
    expect(result.map(o => o.CUSTNAME).sort()).toEqual(['C001', 'C003']);
  });

  it('filters by vendor — matches item Y_1159_5_ESH', () => {
    const vendorOrders = [
      makeOrder({
        ORDNAME: 'O1',
        ORDERITEMS_SUBFORM: [makeItem({ Y_1159_5_ESH: 'V01' }), makeItem({ Y_1159_5_ESH: 'V02' })],
      }),
      makeOrder({
        ORDNAME: 'O2',
        ORDERITEMS_SUBFORM: [makeItem({ Y_1159_5_ESH: 'V02' })],
      }),
    ];
    const result = filterOrdersByEntityIds(vendorOrders, new Set(['V01']), 'vendor', customers);
    expect(result).toHaveLength(1);
    expect(result[0].ORDNAME).toBe('O1');
  });

  it('filters by brand — matches item Y_9952_5_ESH', () => {
    const brandOrders = [
      makeOrder({
        ORDNAME: 'O1',
        ORDERITEMS_SUBFORM: [makeItem({ Y_9952_5_ESH: 'BrandX' })],
      }),
      makeOrder({
        ORDNAME: 'O2',
        ORDERITEMS_SUBFORM: [makeItem({ Y_9952_5_ESH: 'BrandY' })],
      }),
    ];
    const result = filterOrdersByEntityIds(brandOrders, new Set(['BrandX']), 'brand', customers);
    expect(result).toHaveLength(1);
    expect(result[0].ORDNAME).toBe('O1');
  });

  it('filters by product_type — matches item Y_3020_5_ESH code', () => {
    const typeOrders = [
      makeOrder({
        ORDNAME: 'O1',
        ORDERITEMS_SUBFORM: [makeItem({ Y_3020_5_ESH: 'FAM1' })],
      }),
      makeOrder({
        ORDNAME: 'O2',
        ORDERITEMS_SUBFORM: [makeItem({ Y_3020_5_ESH: 'FAM2' })],
      }),
    ];
    const result = filterOrdersByEntityIds(typeOrders, new Set(['FAM1']), 'product_type', customers);
    expect(result).toHaveLength(1);
    expect(result[0].ORDNAME).toBe('O1');
  });

  it('filters by product — matches item PARTNAME', () => {
    const productOrders = [
      makeOrder({
        ORDNAME: 'O1',
        ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'WGT-A' }), makeItem({ PARTNAME: 'GDG-B' })],
      }),
      makeOrder({
        ORDNAME: 'O2',
        ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'GDG-B' })],
      }),
    ];
    const result = filterOrdersByEntityIds(productOrders, new Set(['WGT-A']), 'product', customers);
    expect(result).toHaveLength(1);
    expect(result[0].ORDNAME).toBe('O1');
  });

  it('returns all orders for unknown dimension', () => {
    const result = filterOrdersByEntityIds(orders, new Set(['C001']), 'customer', customers);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/services/entity-filter.test.ts`
Expected: FAIL — `filterOrdersByEntityIds` is not exported from `dashboard`

- [ ] **Step 3: Implement `filterOrdersByEntityIds` in dashboard.ts**

Edit `server/src/routes/dashboard.ts`:

Add imports after line 14:
```typescript
import { buildFilterQualifier } from '../cache/cache-keys.js';
```

Add import for `RawCustomer` after line 16:
```typescript
import type { RawCustomer } from '../services/priority-queries.js';
```

Update line 46 — the rawKey in the entityIds handler:
```typescript
// Before:
const rawKey = cacheKey('orders_raw', period, `${groupBy}:all`);

// After:
const rawKey = cacheKey('orders_raw', period, buildFilterQualifier(groupBy, 'all'));
```

Add the exported function after the router handler (after line 128, before the file ends):

```typescript
/**
 * Filter orders by entity IDs for any dimension.
 * WHY: The consolidated view needs to filter cached raw orders to the selected
 * entity subset. Each dimension uses different fields for entity identity.
 */
export function filterOrdersByEntityIds(
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
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i => entityIds.has(i.Y_1159_5_ESH ?? '')),
      );
    case 'brand':
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i => entityIds.has(i.Y_9952_5_ESH ?? '')),
      );
    case 'product_type':
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i =>
          entityIds.has(i.Y_3020_5_ESH ?? i.Y_3021_5_ESH ?? ''),
        ),
      );
    case 'product':
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i => entityIds.has(i.PARTNAME)),
      );
    default:
      return orders;
  }
}
```

Then update line 51 to use the new function:

```typescript
// Before:
const filteredOrders = allOrders.filter(o => entitySet.has(o.CUSTNAME));

// After:
const filteredOrders = filterOrdersByEntityIds(allOrders, entitySet, groupBy as Dimension, customersResult.data);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/services/entity-filter.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Run all tests**

Run: `cd server && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/dashboard.ts server/tests/services/entity-filter.test.ts
git commit -m "feat: dimension-aware filterOrdersByEntityIds for consolidated view"
```

---

### Task 9: Add `useConsolidatedDashboard` client hook

**Files:**
- Modify: `client/src/hooks/useDashboardData.ts`

- [ ] **Step 1: Read existing hook pattern**

Read `client/src/hooks/useDashboardData.ts` to understand the `fetchJson` utility and `useQuery` pattern used by `useDashboardDetail`.

- [ ] **Step 2: Add `useConsolidatedDashboard` hook**

Add after the `useDashboardDetail` export in `client/src/hooks/useDashboardData.ts`:

```typescript
/** Stage 3: Consolidated data for multi-select — fetches /dashboard with entityIds param.
 * WHY: "View Consolidated" needs a real multi-entity payload, not single-entity data
 * with client-side aggregation. The server already supports entityIds. */
export function useConsolidatedDashboard(params: {
  entityIds: string[];
  groupBy: Dimension;
  period: string;
  enabled: boolean;
}) {
  // WHY: Sort IDs so the query key is stable regardless of selection order.
  const idsParam = params.entityIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['dashboard', 'consolidated', idsParam, params.groupBy, params.period],
    queryFn: () => fetchJson<ApiResponse<DashboardPayload>>(
      `/api/sales/dashboard?entityIds=${encodeURIComponent(idsParam)}&groupBy=${params.groupBy}&period=${params.period}`,
    ),
    enabled: params.enabled && params.entityIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useDashboardData.ts
git commit -m "feat: add useConsolidatedDashboard hook for multi-entity fetching"
```

---

### Task 10: Wire consolidated hook into `useDashboardState`

**Files:**
- Modify: `client/src/hooks/useDashboardState.ts`
- Modify: `client/src/utils/aggregation.ts`

- [ ] **Step 1: Update useDashboardState.ts**

Edit `client/src/hooks/useDashboardState.ts`:

Update import on line 7:
```typescript
import { useEntities, useDashboardDetail, useConsolidatedDashboard } from './useDashboardData';
```

Remove import of `aggregateForConsolidated` on line 19:
```typescript
// DELETE this line:
// import { aggregateForConsolidated } from '../utils/aggregation';
```

Add after line 68 (after detailQuery):
```typescript
  // --- Stage 3: Consolidated data for multi-select (on-demand) ---
  const consolidatedQuery = useConsolidatedDashboard({
    entityIds: selectedIdsArray,
    groupBy: activeDimension,
    period: activePeriod,
    enabled: isConsolidated && selectedIdsArray.length > 0,
  });
  const consolidatedDashboard = consolidatedQuery.data?.data ?? null;
```

Replace lines 88-96 (the `finalDashboard` memo):
```typescript
  // --- Consolidated view uses server-aggregated multi-entity data ---
  const finalDashboard = useMemo(() => {
    if (isConsolidated && consolidatedDashboard) {
      return { ...consolidatedDashboard, entities: processedEntities };
    }
    if (!dashboard) return null;
    return { ...dashboard, entities: processedEntities };
  }, [dashboard, consolidatedDashboard, isConsolidated, processedEntities]);
```

Add `isConsolidatedLoading` to the loading stage (after line 103):
```typescript
  const isConsolidatedLoading = consolidatedQuery.isLoading && isConsolidated;
```

Add to the return object (after `isDetailLoading`):
```typescript
    isConsolidatedLoading,
```

- [ ] **Step 2: Remove dead code from aggregation.ts**

Edit `client/src/utils/aggregation.ts`:

Replace entire file contents with:
```typescript
// FILE: client/src/utils/aggregation.ts
// PURPOSE: Client-side aggregation utilities (currently empty — server handles consolidated aggregation)
// USED BY: none (previously used by useDashboardState for client-side consolidation)
// EXPORTS: none

// WHY: aggregateForConsolidated was removed because the server now handles
// consolidated aggregation via the entityIds parameter on /api/sales/dashboard.
// This file is kept as a placeholder for future client-side aggregation needs.
```

- [ ] **Step 3: Run TypeScript check (client)**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Run TypeScript check (server)**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Run all server tests**

Run: `cd server && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Run client build**

Run: `cd client && npx vite build`
Expected: Build succeeds, bundle <500KB gzip

- [ ] **Step 7: Commit**

```bash
git add client/src/hooks/useDashboardState.ts client/src/hooks/useDashboardData.ts client/src/utils/aggregation.ts
git commit -m "fix: consolidated view fetches real multi-entity data from server"
```

---

## Phase 5: Final Verification

### Task 11: Full pre-deploy verification

- [ ] **Step 1: TypeScript compilation (both projects)**

```bash
cd client && npx tsc -b --noEmit && echo "CLIENT OK"
cd ../server && npx tsc --noEmit && echo "SERVER OK"
```
Expected: Both output "OK" with no errors

- [ ] **Step 2: Run all server tests**

```bash
cd server && npx vitest run
```
Expected: All tests pass (original 63 + new tests from Tasks 1, 4, 6, 8)

- [ ] **Step 3: Build client bundle**

```bash
cd client && npx vite build
```
Expected: Build succeeds, bundle <500KB gzip

- [ ] **Step 4: Code quality checks**

```bash
grep -rn ": any\|as any" server/src/ client/src/
```
Expected: No matches (no `any` types)

```bash
find server/src client/src -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -n | tail -20
```
Expected: No file exceeds 200 lines

- [ ] **Step 5: Commit all verification passing**

```bash
git add -A
git commit -m "chore: all pre-deploy verification passes for cache integrity fixes"
```
