# Dimension Parity & Master-Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring vendor, zone, product_type, and product dimensions to full feature parity with the customer dimension — correct KPIs, working detail view, multi-select consolidated, Report export — using the existing universal order cache and dimension-derived entity lists, with a thin master-data layer for name resolution and filter dropdowns.

**Architecture:** One-pass pre-filter normalization for global aggregations; per-entity re-scoping for consolidated breakdowns; master-data cache as reference layer (NOT the entity universe); conditional TanStack staleTime to avoid skeleton lock-in. Brand dim is deferred this round.

**Tech Stack:** TypeScript strict, Express + Zod, TanStack Query v5, React 19 + Tailwind v4, Upstash Redis, Vitest.

**Spec:** [docs/superpowers/specs/2026-04-16-dimension-parity-and-master-data-design.md](../specs/2026-04-16-dimension-parity-and-master-data-design.md)

---

## Working Agreement

- TDD: write the failing test first for every behavior change. Pure refactors can be commit-then-test.
- Commit after every passing test or every file change that leaves the tree green. No multi-concern commits.
- Every commit must pass: `cd client && npx tsc -b --noEmit && cd ../server && npx tsc --noEmit && npx vitest run`.
- No `any` types. No files over 300 LOC.
- Touch only files required by the current task.

**Dimension priority order:** vendor → product_type → product → zone. Vendor lands first end-to-end; other dims are data-driven from the same foundation.

---

## Phase 1 — Foundation Types & Utilities

### Task 1.1: Extend `cache-keys.ts` — new CacheEntity values + item-level filter fields

**Files:**
- Modify: `server/src/cache/cache-keys.ts`
- Modify: `server/src/config/constants.ts` (add TTLs for new cache entities)
- Test: `server/src/cache/__tests__/cache-keys.test.ts` (create if missing)

- [ ] **Step 1: Write the failing test**

```ts
// server/src/cache/__tests__/cache-keys.test.ts
import { describe, it, expect } from 'vitest';
import { cacheKey, buildFilterHash, buildEntitySetHash } from '../cache-keys.js';

describe('cacheKey', () => {
  it('builds dashboard:product_types:all', () => {
    expect(cacheKey('product_types', 'all')).toBe('dashboard:product_types:all');
  });
  it('builds dashboard:products:all', () => {
    expect(cacheKey('products', 'all')).toBe('dashboard:products:all');
  });
});

describe('buildFilterHash extended', () => {
  it('includes item-level filter fields', () => {
    const hash = buildFilterHash({
      agentName: 'Alex',
      brand: 'ACETUM',
      countryOfOrigin: 'Italy',
    });
    expect(hash).toContain('agent=Alex');
    expect(hash).toContain('brand=ACETUM');
    expect(hash).toContain('country=Italy');
  });
  it('returns "all" when no fields set', () => {
    expect(buildFilterHash({})).toBe('all');
  });
  it('is order-deterministic across argument orderings', () => {
    const a = buildFilterHash({ agentName: 'X', brand: 'Y' });
    const b = buildFilterHash({ brand: 'Y', agentName: 'X' });
    expect(a).toBe(b);
  });
});

describe('buildEntitySetHash', () => {
  it('is sort-invariant', () => {
    expect(buildEntitySetHash(['C1', 'A2', 'B3'])).toBe(buildEntitySetHash(['A2', 'B3', 'C1']));
  });
  it('returns "empty" for empty input', () => {
    expect(buildEntitySetHash([])).toBe('empty');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/cache/__tests__/cache-keys.test.ts`
Expected: FAIL — `buildEntitySetHash` not exported; `buildFilterHash` doesn't accept object.

- [ ] **Step 3: Extend cache-keys.ts**

```ts
// server/src/cache/cache-keys.ts
// Extend CacheEntity union:
type CacheEntity = 'orders_ytd' | 'orders_year' | 'customers' | 'zones' | 'agents'
  | 'vendors' | 'contacts' | 'years_available' | 'entities_summary' | 'entity_detail'
  | 'entities_full' | 'orders_raw' | 'orders_raw_meta' | 'report_payload'
  | 'product_types' | 'products';

// Replace buildFilterHash with object-based signature (back-compat preserved by positional-call helper):
export interface FilterHashInput {
  agentName?: string;
  zone?: string;
  customerType?: string;
  brand?: string;
  productFamily?: string;
  countryOfOrigin?: string;
  foodServiceRetail?: string;
}
export function buildFilterHash(input: FilterHashInput): string {
  const parts: string[] = [];
  if (input.agentName) parts.push(`agent=${input.agentName}`);
  if (input.zone) parts.push(`zone=${input.zone}`);
  if (input.customerType) parts.push(`type=${input.customerType}`);
  if (input.brand) parts.push(`brand=${input.brand}`);
  if (input.productFamily) parts.push(`family=${input.productFamily}`);
  if (input.countryOfOrigin) parts.push(`country=${input.countryOfOrigin}`);
  if (input.foodServiceRetail) parts.push(`fsr=${input.foodServiceRetail}`);
  return parts.length > 0 ? parts.join('&') : 'all';
}

/** Canonical hash for an entity-id set. Sort-invariant. WHY: same (dimension, entityIds)
 *  set must always produce the same cache key regardless of input ordering. */
export function buildEntitySetHash(ids: string[]): string {
  if (ids.length === 0) return 'empty';
  return [...ids].sort().join(',');
}
```

Update `server/src/config/constants.ts` CACHE_TTLS with `product_types: 86400, products: 86400` (24h each).

Update all existing call-sites of `buildFilterHash` to use the object form. Grep: `grep -rn "buildFilterHash(" server/`.

- [ ] **Step 4: Run tests**

Run: `cd server && npx vitest run src/cache/__tests__/cache-keys.test.ts && npx tsc --noEmit`
Expected: PASS, no TS errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/victorproust/Documents/Work/SG\ Interface/Sales\ Dashboard\ v1
git add server/src/cache/cache-keys.ts server/src/cache/__tests__/cache-keys.test.ts server/src/config/constants.ts
# Plus any callsites grep surfaced in step 3:
git add <callsite files>
git commit -m "feat(cache): extend buildFilterHash with item-level fields + add buildEntitySetHash"
```

---

### Task 1.2: Extend `shared/types/dashboard.ts` — filters, master types, dimension labels

**Files:**
- Modify: `shared/types/dashboard.ts`

- [ ] **Step 1: Edit `shared/types/dashboard.ts`**

Add these types/constants:

```ts
/** Master-data raw types used only on the server but exported shared for test fixtures. */
export interface RawProductType {
  FTCODE: string;
  FTNAME: string;
}

export interface RawProduct {
  PARTNAME: string;
  PARTDES: string;
  FAMILYNAME: string;
  Y_9952_5_ESH: string | null;  // brand on part
  STATDES: string;
}

/** Extended FetchAllFilters — item-level filters added (brand dim deferred but filter preserved). */
export interface FetchAllFilters {
  agentName?: string[];
  zone?: string[];
  customerType?: string[];
  brand?: string[];              // NEW — item level
  productFamily?: string[];      // NEW
  countryOfOrigin?: string[];    // NEW
  foodServiceRetail?: string[];  // NEW
  entityIds?: string[];
}

/** Singular labels for empty-state ("All Vendors", "All Zones"). */
export const DIMENSION_SINGULAR_LABELS: Record<Dimension, string> = {
  customer: 'Customer',
  zone: 'Zone',
  vendor: 'Vendor',
  brand: 'Brand',
  product_type: 'Product Type',
  product: 'Product',
};

/** Plural labels for list headers + loading messages ("Loading vendors..."). */
export const DIMENSION_PLURAL_LABELS: Record<Dimension, string> = {
  customer: 'Customers',
  zone: 'Zones',
  vendor: 'Vendors',
  brand: 'Brands',
  product_type: 'Product Types',
  product: 'Products',
};
```

- [ ] **Step 2: Verify TS builds**

Run: `cd shared && npx tsc --noEmit` (if there's a shared tsconfig) then `cd server && npx tsc --noEmit && cd ../client && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add shared/types/dashboard.ts
git commit -m "feat(shared): extend FetchAllFilters + add dimension labels and master-data types"
```

---

### Task 1.3: Add `scopeOrders` to `entity-subset-filter.ts`

**Files:**
- Modify: `server/src/services/entity-subset-filter.ts`
- Test: `server/src/services/__tests__/entity-subset-filter.test.ts` (create or extend)

- [ ] **Step 1: Write failing tests**

```ts
// server/src/services/__tests__/entity-subset-filter.test.ts
import { describe, it, expect } from 'vitest';
import { scopeOrders } from '../entity-subset-filter.js';
import type { RawOrder, RawCustomer } from '../priority-queries.js';

const customers: RawCustomer[] = [
  { CUSTNAME: 'C1', CUSTDES: 'Cust1', ZONECODE: 'Z1', ZONEDES: 'Zone1', AGENTCODE: 'A', AGENTNAME: 'Alice', CREATEDDATE: '', CTYPECODE: 'T', CTYPENAME: 'T' },
  { CUSTNAME: 'C2', CUSTDES: 'Cust2', ZONECODE: 'Z2', ZONEDES: 'Zone2', AGENTCODE: 'A', AGENTNAME: 'Alice', CREATEDDATE: '', CTYPECODE: 'T', CTYPENAME: 'T' },
];
const baseItem = { PDES: '', TQUANT: 0, TUNITNAME: '', QPRICE: 0, PRICE: 0, PURCHASEPRICE: 0, QPROFIT: 0, PERCENT: 0, Y_17936_5_ESH: '', Y_2075_5_ESH: '', Y_5380_5_ESH: '', Y_9967_5_ESH: '' };
const makeOrder = (ordname: string, custname: string, items: Partial<typeof baseItem & { PARTNAME: string; Y_1159_5_ESH?: string; Y_9952_5_ESH?: string; Y_3020_5_ESH?: string; Y_3021_5_ESH?: string; Y_1530_5_ESH?: string }>[]): RawOrder => ({
  ORDNAME: ordname, CURDATE: '2026-01-01T00:00:00Z', ORDSTATUSDES: 'Open', TOTPRICE: items.reduce((s, i) => s + (i.QPRICE || 0), 0),
  CUSTNAME: custname, AGENTCODE: 'A', AGENTNAME: 'Alice',
  ORDERITEMS_SUBFORM: items.map(i => ({ ...baseItem, PARTNAME: 'P1', Y_1159_5_ESH: '', Y_1530_5_ESH: '', Y_9952_5_ESH: '', Y_3020_5_ESH: '', Y_3021_5_ESH: '', ...i })),
});

describe('scopeOrders', () => {
  it('customer dim: filters orders by CUSTNAME, keeps items unchanged, TOTPRICE unchanged', () => {
    const orders = [makeOrder('O1', 'C1', [{ QPRICE: 100 }]), makeOrder('O2', 'C2', [{ QPRICE: 200 }])];
    const scoped = scopeOrders(orders, 'customer', new Set(['C1']), customers);
    expect(scoped).toHaveLength(1);
    expect(scoped[0].ORDNAME).toBe('O1');
    expect(scoped[0].TOTPRICE).toBe(100);
    expect(scoped[0].ORDERITEMS_SUBFORM).toHaveLength(1);
  });

  it('zone dim: filters orders by customer zone, keeps items unchanged', () => {
    const orders = [makeOrder('O1', 'C1', [{ QPRICE: 100 }]), makeOrder('O2', 'C2', [{ QPRICE: 200 }])];
    const scoped = scopeOrders(orders, 'zone', new Set(['Z1']), customers);
    expect(scoped).toHaveLength(1);
    expect(scoped[0].ORDNAME).toBe('O1');
    expect(scoped[0].TOTPRICE).toBe(100);  // zone keeps original TOTPRICE
  });

  it('vendor dim: narrows items and rewrites TOTPRICE = Σ QPRICE of matching items', () => {
    const orders = [
      makeOrder('O1', 'C1', [
        { Y_1159_5_ESH: 'V1', QPRICE: 100 },
        { Y_1159_5_ESH: 'V2', QPRICE: 200 },
        { Y_1159_5_ESH: 'V3', QPRICE: 50 },
      ]),
    ];
    const scoped = scopeOrders(orders, 'vendor', new Set(['V1', 'V2']), customers);
    expect(scoped).toHaveLength(1);
    expect(scoped[0].ORDERITEMS_SUBFORM).toHaveLength(2);  // V3 removed
    expect(scoped[0].TOTPRICE).toBe(300);  // rewritten to V1 + V2 items only
  });

  it('vendor dim: drops orders with no matching items', () => {
    const orders = [
      makeOrder('O1', 'C1', [{ Y_1159_5_ESH: 'V1', QPRICE: 100 }]),
      makeOrder('O2', 'C2', [{ Y_1159_5_ESH: 'V3', QPRICE: 200 }]),
    ];
    const scoped = scopeOrders(orders, 'vendor', new Set(['V1']), customers);
    expect(scoped.map(o => o.ORDNAME)).toEqual(['O1']);
  });

  it('product_type dim: matches on Y_3020_5_ESH', () => {
    const orders = [makeOrder('O1', 'C1', [
      { Y_3020_5_ESH: '01', Y_3021_5_ESH: 'Culinary', QPRICE: 100 },
      { Y_3020_5_ESH: '02', Y_3021_5_ESH: 'Pastry', QPRICE: 50 },
    ])];
    const scoped = scopeOrders(orders, 'product_type', new Set(['01']), customers);
    expect(scoped[0].ORDERITEMS_SUBFORM).toHaveLength(1);
    expect(scoped[0].TOTPRICE).toBe(100);
  });

  it('product dim: matches on PARTNAME', () => {
    const orders = [makeOrder('O1', 'C1', [
      { PARTNAME: 'P1', QPRICE: 100 },
      { PARTNAME: 'P2', QPRICE: 50 },
    ])];
    const scoped = scopeOrders(orders, 'product', new Set(['P1']), customers);
    expect(scoped[0].ORDERITEMS_SUBFORM.map(i => i.PARTNAME)).toEqual(['P1']);
    expect(scoped[0].TOTPRICE).toBe(100);
  });

  it('empty entityIds returns empty array', () => {
    const orders = [makeOrder('O1', 'C1', [{ QPRICE: 100 }])];
    expect(scopeOrders(orders, 'customer', new Set(), customers)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `cd server && npx vitest run src/services/__tests__/entity-subset-filter.test.ts`
Expected: FAIL — `scopeOrders` not exported.

- [ ] **Step 3: Implement `scopeOrders` in `entity-subset-filter.ts`**

Append to the file (keep existing `filterOrdersByEntityIds`):

```ts
/** Scope orders to a dimension + entity-id set. For item-based dims, also narrow each order's
 *  ORDERITEMS_SUBFORM to matching items AND rewrite TOTPRICE = Σ QPRICE of remaining items.
 *  This lets downstream aggregators (computeKPIs, computeMonthlyRevenue, etc.) remain
 *  dimension-agnostic — they sum TOTPRICE as they always have, and it's correct by construction.
 *  WHY not mutate: callers may reuse the input orders array for other scopes (consolidated
 *  perEntity loop). Return new objects. */
export function scopeOrders(
  orders: RawOrder[],
  dimension: Dimension,
  entityIds: Set<string>,
  customers: RawCustomer[],
): RawOrder[] {
  if (entityIds.size === 0) return [];

  if (dimension === 'customer') {
    return orders.filter(o => entityIds.has(o.CUSTNAME));
  }

  if (dimension === 'zone') {
    const custInZones = new Set(
      customers.filter(c => entityIds.has(c.ZONECODE)).map(c => c.CUSTNAME),
    );
    return orders.filter(o => custInZones.has(o.CUSTNAME));
  }

  // Item-based dims: narrow items + rewrite TOTPRICE
  const itemKey = (i: RawOrder['ORDERITEMS_SUBFORM'][number]): string => {
    switch (dimension) {
      case 'vendor':       return i.Y_1159_5_ESH ?? '';
      case 'brand':        return i.Y_9952_5_ESH ?? '';
      case 'product_type': return i.Y_3020_5_ESH ?? i.Y_3021_5_ESH ?? '';
      case 'product':      return i.PARTNAME;
      default: return '';
    }
  };

  return orders.reduce<RawOrder[]>((acc, o) => {
    const items = (o.ORDERITEMS_SUBFORM ?? []).filter(i => entityIds.has(itemKey(i)));
    if (items.length === 0) return acc;
    const scopedTotprice = items.reduce((s, i) => s + i.QPRICE, 0);
    acc.push({ ...o, ORDERITEMS_SUBFORM: items, TOTPRICE: scopedTotprice });
    return acc;
  }, []);
}
```

- [ ] **Step 4: Run tests**

Run: `cd server && npx vitest run src/services/__tests__/entity-subset-filter.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/entity-subset-filter.ts server/src/services/__tests__/entity-subset-filter.test.ts
git commit -m "feat(server): add scopeOrders — per-dim scope with TOTPRICE rewrite for item-based dims"
```

---

### Task 1.4: Add `filterOrdersByItemCriteria` to `customer-filter.ts`

**Files:**
- Modify: `server/src/services/customer-filter.ts`
- Test: `server/src/services/__tests__/customer-filter.test.ts` (create or extend)

- [ ] **Step 1: Write failing test**

```ts
// append to customer-filter.test.ts
describe('filterOrdersByItemCriteria', () => {
  it('filters orders where any item matches brand', () => {
    const orders = [
      makeOrder('O1', 'C1', [{ Y_9952_5_ESH: 'ACETUM', QPRICE: 100 }]),
      makeOrder('O2', 'C1', [{ Y_9952_5_ESH: 'OTHER', QPRICE: 200 }]),
    ];
    const result = filterOrdersByItemCriteria(orders, { brand: ['ACETUM'] });
    expect(result.map(o => o.ORDNAME)).toEqual(['O1']);
  });

  it('AND across criteria fields, OR within each field', () => {
    const orders = [
      makeOrder('O1', 'C1', [{ Y_9952_5_ESH: 'A', Y_5380_5_ESH: 'Italy', QPRICE: 100 }]),
      makeOrder('O2', 'C1', [{ Y_9952_5_ESH: 'A', Y_5380_5_ESH: 'France', QPRICE: 200 }]),
      makeOrder('O3', 'C1', [{ Y_9952_5_ESH: 'B', Y_5380_5_ESH: 'Italy', QPRICE: 300 }]),
    ];
    const result = filterOrdersByItemCriteria(orders, { brand: ['A', 'B'], countryOfOrigin: ['Italy'] });
    // brand ∈ {A,B} AND country='Italy' → O1 and O3
    expect(result.map(o => o.ORDNAME).sort()).toEqual(['O1', 'O3']);
  });

  it('returns all orders when criteria is empty', () => {
    const orders = [makeOrder('O1', 'C1', [{ QPRICE: 100 }])];
    expect(filterOrdersByItemCriteria(orders, {})).toEqual(orders);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `cd server && npx vitest run src/services/__tests__/customer-filter.test.ts`
Expected: FAIL — `filterOrdersByItemCriteria` not exported.

- [ ] **Step 3: Implement**

Append to `customer-filter.ts`:

```ts
export interface ItemFilterCriteria {
  brand?: string[];
  productFamily?: string[];
  countryOfOrigin?: string[];
  foodServiceRetail?: string[];
}

/** Filter orders to those where ANY item matches ALL supplied criteria fields.
 *  Each criteria field uses OR within, and fields are AND'd together.
 *  Empty criteria → all orders pass through unchanged. */
export function filterOrdersByItemCriteria(
  orders: RawOrder[],
  criteria: ItemFilterCriteria,
): RawOrder[] {
  const brands = criteria.brand?.length ? new Set(criteria.brand) : null;
  const families = criteria.productFamily?.length ? new Set(criteria.productFamily) : null;
  const countries = criteria.countryOfOrigin?.length ? new Set(criteria.countryOfOrigin) : null;
  const fsr = criteria.foodServiceRetail?.length ? new Set(criteria.foodServiceRetail) : null;
  if (!brands && !families && !countries && !fsr) return orders;

  return orders.filter(o =>
    (o.ORDERITEMS_SUBFORM ?? []).some(i =>
      (!brands || brands.has(i.Y_9952_5_ESH ?? '')) &&
      (!families || families.has(i.Y_2075_5_ESH ?? '')) &&
      (!countries || countries.has(i.Y_5380_5_ESH ?? '')) &&
      (!fsr || fsr.has(i.Y_9967_5_ESH ?? ''))
    ),
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd server && npx vitest run src/services/__tests__/customer-filter.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/customer-filter.ts server/src/services/__tests__/customer-filter.test.ts
git commit -m "feat(server): add filterOrdersByItemCriteria for brand/family/country/fsr filters"
```

---

## Phase 2 — Master Data Fetches

### Task 2.1: Add `fetchProductTypes` to `priority-queries.ts`

**Files:**
- Modify: `server/src/services/priority-queries.ts`

- [ ] **Step 1: Append function**

```ts
import type { RawProductType } from '@shared/types/dashboard';
// ... existing code ...

/** Fetch distinct product-type (family-type) pairs from FAMILY_LOG.
 *  WHY: FTCODE/FTNAME matches order items' Y_3020_5_ESH/Y_3021_5_ESH for the Prod. Type dim. */
export async function fetchProductTypes(client: PriorityClient, signal?: AbortSignal): Promise<RawProductType[]> {
  const rows = await client.fetchAllPages<{ FTCODE: string | null; FTNAME: string | null }>('FAMILY_LOG', {
    select: 'FTCODE,FTNAME',
    orderby: 'FTCODE asc',
    signal,
  });
  // Dedupe by FTCODE — FAMILY_LOG has many part families grouped under few product types.
  const seen = new Map<string, RawProductType>();
  for (const r of rows) {
    if (r.FTCODE && r.FTNAME && !seen.has(r.FTCODE)) {
      seen.set(r.FTCODE, { FTCODE: r.FTCODE, FTNAME: r.FTNAME });
    }
  }
  return [...seen.values()];
}
```

- [ ] **Step 2: Verify TS**

Run: `cd server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/priority-queries.ts
git commit -m "feat(server): add fetchProductTypes (FAMILY_LOG, deduped by FTCODE)"
```

### Task 2.2: Add `fetchProducts` to `priority-queries.ts`

- [ ] **Step 1: Append function**

```ts
import type { RawProduct } from '@shared/types/dashboard';

/** Fetch all in-use products from LOGPART. */
export async function fetchProducts(client: PriorityClient, signal?: AbortSignal): Promise<RawProduct[]> {
  return client.fetchAllPages<RawProduct>('LOGPART', {
    select: 'PARTNAME,PARTDES,FAMILYNAME,Y_9952_5_ESH,STATDES',
    filter: "STATDES eq 'In Use'",
    orderby: 'PARTNAME asc',
    signal,
  });
}
```

- [ ] **Step 2: Verify TS**

Run: `cd server && npx tsc --noEmit` — no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/priority-queries.ts
git commit -m "feat(server): add fetchProducts (LOGPART STATDES='In Use')"
```

### Task 2.3: Update `warm-cache.ts` to warm master caches + add rate-limit delay

**Files:**
- Modify: `server/src/services/warm-cache.ts`

- [ ] **Step 1: Edit `warm-cache.ts`**

```ts
import { fetchOrders, fetchCustomers, fetchZones, fetchVendors, fetchProductTypes, fetchProducts } from './priority-queries.js';
// ...

export async function warmEntityCache(): Promise<void> {
  const rawMetaKey = cacheKey('orders_raw_meta', 'ytd', 'customer:all');
  const existingMeta = await redis.get(rawMetaKey);

  // WHY: Always refresh master data (small, rarely changes, cheap). Only skip orders warm
  // when fetch-all already populated the per-order cache recently.
  const masterDataPromises = [
    cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
      () => fetchCustomers(priorityClient)),
    cachedFetch(cacheKey('zones', 'all'), getTTL('zones'),
      () => fetchZones(priorityClient)),
    cachedFetch(cacheKey('vendors', 'all'), getTTL('vendors'),
      () => fetchVendors(priorityClient)),
    cachedFetch(cacheKey('product_types', 'all'), getTTL('product_types'),
      () => fetchProductTypes(priorityClient)),
    cachedFetch(cacheKey('products', 'all'), getTTL('products'),
      () => fetchProducts(priorityClient)),
  ];

  if (existingMeta) {
    console.log('[warm-cache] Orders cache exists — warming master data only.');
    await Promise.all(masterDataPromises);
    return;
  }

  const now = new Date();
  const year = now.getFullYear();
  const startDate = `${year}-01-01T00:00:00Z`;
  const endDate = `${year + 1}-01-01T00:00:00Z`;

  console.log('[warm-cache] Cold boot — warming master data + YTD orders...');

  // WHY: Start master data first, delay orders by 500ms — avoids hitting Priority's 15-queued-max
  // during cold boot when master-data calls + paginated fetchOrders would otherwise overlap.
  await Promise.all(masterDataPromises);
  await new Promise(r => setTimeout(r, 500));

  const ordersResult = await cachedFetch(cacheKey('orders_ytd', 'ytd'), getTTL('orders_ytd'),
    () => fetchOrders(priorityClient, startDate, endDate, true));

  console.log(`[warm-cache] Done. Orders: ${ordersResult.cached ? 'cache hit' : 'fetched fresh'}.`);
}
```

- [ ] **Step 2: Verify TS**

Run: `cd server && npx tsc --noEmit` — no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/warm-cache.ts
git commit -m "feat(server): warm 5 master caches in parallel; always refresh master data"
```

---

## Phase 3 — Backend Scope Aggregation

### Task 3.1: Extract `order-transforms.ts` from `data-aggregator.ts` (pure refactor)

**Files:**
- Create: `server/src/services/order-transforms.ts`
- Modify: `server/src/services/data-aggregator.ts`

- [ ] **Step 1: Identify functions to extract**

Open `data-aggregator.ts` and locate `buildFlatItems` (~80 LOC) and `groupOrdersByDimension` helpers (~90 LOC).

- [ ] **Step 2: Move them to `order-transforms.ts`**

Create `server/src/services/order-transforms.ts`:

```ts
// FILE: server/src/services/order-transforms.ts
// PURPOSE: Order-to-row transformations used by the dashboard aggregator.
// USED BY: server/src/services/data-aggregator.ts
// EXPORTS: buildFlatItems, groupOrdersByDimension (and any helpers they rely on)

import type { RawOrder, RawCustomer } from './priority-queries.js';
import type { FlatItem } from '@shared/types/dashboard';

// <paste buildFlatItems implementation here, with imports updated>
// <paste groupOrdersByDimension + helpers here>
```

In `data-aggregator.ts`: replace the extracted code with imports from `./order-transforms.js`.

- [ ] **Step 3: Run all tests (no behavior change expected)**

Run: `cd server && npx vitest run && npx tsc --noEmit`
Expected: PASS — all existing tests green.

- [ ] **Step 4: Verify LOC**

Run: `wc -l server/src/services/data-aggregator.ts server/src/services/order-transforms.ts`
Expected: `data-aggregator.ts` < 300; `order-transforms.ts` < 300.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/order-transforms.ts server/src/services/data-aggregator.ts
git commit -m "refactor(server): extract buildFlatItems + groupOrdersByDimension to order-transforms.ts"
```

---

### Task 3.2: Inline-extract private helpers in `kpi-aggregator.ts` to get under 300 LOC

**Files:**
- Modify: `server/src/services/kpi-aggregator.ts`

- [ ] **Step 1: Identify longest compute blocks**

Read `kpi-aggregator.ts` (~315 LOC). Identify 2 quarter/month arithmetic blocks inside `computeKPIs` that can become private functions in the same file.

- [ ] **Step 2: Extract within the same file**

Define `function computeQuarterBlocks(...)` and `function computeMonthBlocks(...)` at the bottom (private module-scope). Replace the two inline blocks with calls.

- [ ] **Step 3: Run tests**

Run: `cd server && npx vitest run && npx tsc --noEmit && wc -l server/src/services/kpi-aggregator.ts`
Expected: PASS; LOC < 300.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/kpi-aggregator.ts
git commit -m "refactor(server): inline-extract quarter/month helpers to keep kpi-aggregator under 300 LOC"
```

---

### Task 3.3: Update `aggregateOrders` with per-entity re-scoping loop for consolidated breakdowns

**Files:**
- Modify: `server/src/services/data-aggregator.ts`
- Test: `server/src/services/__tests__/data-aggregator.test.ts` (extend)

- [ ] **Step 1: Write failing test — perEntity breakdown must not cross-contaminate**

```ts
describe('aggregateOrders — perEntity breakdowns for item-based dims', () => {
  it('per-entity revenue is NOT the full-order total when an order has multiple entities selected', () => {
    // One order with items from V1 (100) and V2 (200). Select both vendors.
    const orders = [makeOrder('O1', 'C1', [
      { Y_1159_5_ESH: 'V1', QPRICE: 100 },
      { Y_1159_5_ESH: 'V2', QPRICE: 200 },
    ])];
    const result = aggregateOrders(orders, [], 'ytd', {
      dimension: 'vendor',
      entityIds: ['V1', 'V2'],
      customers,
    });
    // Each vendor's perEntity monthlyRevenue must reflect only its own items.
    expect(result.perEntityMonthlyRevenue?.['V1']?.[0]?.currentYear).toBe(100);
    expect(result.perEntityMonthlyRevenue?.['V2']?.[0]?.currentYear).toBe(200);
    // NOT 300 + 300 which is what bare reuse of the consolidated order would give.
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd server && npx vitest run src/services/__tests__/data-aggregator.test.ts`
Expected: FAIL — current code reuses consolidated orders for all entities.

- [ ] **Step 3: Implement per-entity re-scoping in `aggregateOrders`**

Update `aggregateOrders` to accept an optional scope, and when `scope.entityIds.length > 1` (consolidated mode), run a per-entity loop for perEntity breakdowns:

```ts
export interface AggregateScope {
  dimension: Dimension;
  entityIds: string[];
  customers: RawCustomer[];
}

export function aggregateOrders(
  rawOrders: RawOrder[],
  rawPrevOrders: RawOrder[],
  period: string,
  scope?: AggregateScope,
): Omit<DashboardPayload, 'entities' | 'yearsAvailable'> {
  // Scoped global view
  const orders = scope ? scopeOrders(rawOrders, scope.dimension, new Set(scope.entityIds), scope.customers) : rawOrders;
  const prevOrders = scope ? scopeOrders(rawPrevOrders, scope.dimension, new Set(scope.entityIds), scope.customers) : rawPrevOrders;

  // ...existing global aggregations (kpis, monthlyRevenue, productMixes, topSellers, orders, items)...

  // Per-entity breakdowns (consolidated mode only)
  let perEntityProductMixes: Record<string, Record<ProductMixType, ProductMixSegment[]>> | undefined;
  let perEntityTopSellers: Record<string, TopSellerItem[]> | undefined;
  let perEntityMonthlyRevenue: Record<string, MonthlyRevenue[]> | undefined;

  if (scope && scope.entityIds.length > 1) {
    perEntityProductMixes = {};
    perEntityTopSellers = {};
    perEntityMonthlyRevenue = {};
    for (const entityId of scope.entityIds) {
      const perOrders = scopeOrders(rawOrders, scope.dimension, new Set([entityId]), scope.customers);
      const perPrev = scopeOrders(rawPrevOrders, scope.dimension, new Set([entityId]), scope.customers);
      perEntityProductMixes[entityId] = computeAllProductMixes(perOrders);
      perEntityTopSellers[entityId] = computeTopSellers(perOrders);
      perEntityMonthlyRevenue[entityId] = computeMonthlyRevenue(perOrders, perPrev, period);
    }
  }

  return { kpis, monthlyRevenue, productMixes, topSellers, orders: orderRows, items: flatItems,
    perEntityProductMixes, perEntityTopSellers, perEntityMonthlyRevenue };
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `cd server && npx vitest run src/services/__tests__/data-aggregator.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/data-aggregator.ts server/src/services/__tests__/data-aggregator.test.ts
git commit -m "fix(server): per-entity re-scoping for consolidated item-based breakdowns (Codex #2)"
```

---

## Phase 4 — Backend Routes

### Task 4.1: Update `dashboard.ts` — drop customer-only guard, drop entity_detail write, integrate scope

**Files:**
- Modify: `server/src/routes/dashboard.ts`
- Test: `server/src/routes/__tests__/dashboard.test.ts` (extend or create)

- [ ] **Step 1: Write failing tests**

```ts
describe('GET /api/sales/dashboard', () => {
  it('applies scope for vendor dim with entityId', async () => {
    // Seed cache with orders; vendor V1 in one item, V2 in another.
    // GET ?groupBy=vendor&entityId=V1 — returns scoped dashboard (revenue = V1 items only).
    // Fill in details per existing fetch-all.test.ts patterns.
  });

  it('back-compat: customer dim with entityId produces identical payload', async () => {
    // Run the same query shape as before, assert key fields match.
  });

  it('entityIds comma-separated multi-select', async () => {
    // ?groupBy=vendor&entityIds=V1,V2 — consolidated response with perEntity breakdowns.
  });

  it('drops the entity_detail cache write for non-customer dims', async () => {
    // Spy on redis.set; assert no entity_detail:* write occurs during a vendor-dim request.
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `cd server && npx vitest run src/routes/__tests__/dashboard.test.ts`
Expected: FAIL on vendor-scope test (entityId dropped) and entity_detail absence test.

- [ ] **Step 3: Edit `dashboard.ts`**

Normalize entity IDs at the Zod layer:

```ts
const querySchema = z.object({
  groupBy: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).default('customer'),
  period: z.string().default('ytd'),
  entityId: z.string().optional(),
  entityIds: z.string().optional(),
}).transform(q => ({
  ...q,
  // Normalize: entityIds array always, whether from entityId or entityIds.
  _ids: q.entityIds ? q.entityIds.split(',').map(s => s.trim()).filter(Boolean)
      : q.entityId ? [q.entityId] : [],
}));
```

Remove the `entityFilter` customer-special-case and the `entity_detail` cache branch. Always fetch from universal cache; scope at aggregator layer:

```ts
const ordersResult = await readOrders('ytd', 'customer:all')
  ?? await cachedFetch(cacheKey('orders_ytd', 'ytd'), getTTL('orders_ytd'),
        () => fetchOrders(priorityClient, startDate, endDate, true));

// ...similarly for prev-year orders via the same universal cache...

const customersResult = await cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
  () => fetchCustomers(priorityClient));

const scope = _ids.length > 0
  ? { dimension: groupBy as Dimension, entityIds: _ids, customers: customersResult.data }
  : undefined;

const aggregate = aggregateOrders(ordersResult.data, prevOrdersResult.data, period, scope);
const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
const entities = groupByDimension(groupBy as Dimension, ordersResult.data, customersResult.data, periodMonths, prevOrdersResult.data, period);
// ...existing response shape...
```

- [ ] **Step 4: Run tests**

Run: `cd server && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/dashboard.ts server/src/routes/__tests__/dashboard.test.ts
git commit -m "fix(server): drop customer-only entityId guard; remove entity_detail corruption; wire scope"
```

---

### Task 4.2: Rewrite `entity-stub-builder.ts` → `entity-list-builder.ts` (master-data + orders-derived)

**Files:**
- Create: `server/src/services/entity-list-builder.ts`
- Delete: `server/src/services/entity-stub-builder.ts` (after migration)
- Modify: `server/src/routes/entities.ts` (next task)

- [ ] **Step 1: Create `entity-list-builder.ts`**

```ts
// FILE: server/src/services/entity-list-builder.ts
// PURPOSE: Build the left-panel entity list for any dimension, combining master-data (for
//   customer/zone where the list is the master universe) with orders-derived metrics.
// USED BY: server/src/routes/entities.ts
// EXPORTS: buildEntityList

import type { EntityListItem, Dimension } from '@shared/types/dashboard';
import type { RawOrder, RawCustomer, RawVendor, RawProductType, RawProduct } from './priority-queries.js';
import { readOrders } from '../cache/order-cache.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { priorityClient } from './priority-instance.js';
import {
  fetchCustomers, fetchZones, fetchVendors, fetchProductTypes, fetchProducts,
} from './priority-queries.js';
import { groupByDimension } from './dimension-grouper.js';

export interface EntityListResult {
  entities: EntityListItem[];
  yearsAvailable: string[];
  enriched: boolean;
}

/** Build the entity list for a dimension. Master-data path for customer/zone always returns
 *  the full universe (even entities with zero orders). For vendor/product_type/product, the
 *  list is derived from orders via existing groupByX; master data is used for name fallback
 *  on items with empty Y_1530_5_ESH. */
export async function buildEntityList(dimension: Dimension, period: string): Promise<EntityListResult> {
  const cachedOrders = await readOrders(period, 'customer:all');
  const orders = cachedOrders?.orders ?? [];
  const prevOrders: RawOrder[] = [];  // metrics-enrichment only uses current orders; prev-year enrichment happens at dashboard time
  const enriched = orders.length > 0;

  const years = new Set(orders.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
  const yearsAvailable = [...years].sort().reverse();

  if (dimension === 'customer') {
    const customersResult = await cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
      () => fetchCustomers(priorityClient));
    if (!enriched) {
      return { entities: customersResult.data.map(customerStub), yearsAvailable, enriched: false };
    }
    const now = new Date();
    const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
    const enrichedList = groupByDimension('customer', orders, customersResult.data, periodMonths, prevOrders, period);
    const enrichedById = new Map(enrichedList.map(e => [e.id, e]));
    // Union: all customers from master, enriched metrics where available, zero metrics otherwise.
    const merged = customersResult.data.map(c => {
      const m = enrichedById.get(c.CUSTNAME);
      return m ?? customerStubWithZeroMetrics(c, periodMonths);
    });
    return { entities: merged, yearsAvailable, enriched: true };
  }

  if (dimension === 'zone') {
    // Zone list = master data (DISTRLINES). Orders may be absent or enriched.
    const zonesResult = await cachedFetch(cacheKey('zones', 'all'), getTTL('zones'),
      () => fetchZones(priorityClient));
    const customersResult = await cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
      () => fetchCustomers(priorityClient));
    if (!enriched) {
      return { entities: zonesResult.data.map(zoneStub), yearsAvailable, enriched: false };
    }
    const now = new Date();
    const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
    const enrichedList = groupByDimension('zone', orders, customersResult.data, periodMonths, prevOrders, period);
    const enrichedById = new Map(enrichedList.map(e => [e.id, e]));
    const merged = zonesResult.data.map(z => enrichedById.get(z.ZONECODE) ?? zoneStubZeroed(z, periodMonths));
    return { entities: merged, yearsAvailable, enriched: true };
  }

  // Vendor / product_type / product — entity list is orders-derived.
  if (!enriched) {
    return { entities: [], yearsAvailable, enriched: false };
  }
  const customersResult = await cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
    () => fetchCustomers(priorityClient));
  const now = new Date();
  const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
  return {
    entities: groupByDimension(dimension, orders, customersResult.data, periodMonths, prevOrders, period),
    yearsAvailable,
    enriched: true,
  };
}

function customerStub(c: RawCustomer): EntityListItem {
  return {
    id: c.CUSTNAME, name: c.CUSTDES,
    meta1: [c.ZONEDES, c.AGENTNAME].filter(Boolean).join(' · '),
    meta2: null,
    revenue: null, orderCount: null, avgOrder: null,
    marginPercent: null, marginAmount: null, frequency: null, lastOrderDate: null,
    rep: c.AGENTNAME || null, zone: c.ZONEDES || null, customerType: c.CTYPENAME || null,
    prevYearRevenue: null, prevYearRevenueFull: null,
  };
}

// Analogous: customerStubWithZeroMetrics, zoneStub, zoneStubZeroed, etc.
// (Fill in with actual zero values per the zero-vs-null contract in the spec §8.)
```

- [ ] **Step 2: Test that `buildEntityList` works cold (orders empty)**

```ts
// server/src/services/__tests__/entity-list-builder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock readOrders to return null (cold).
// Mock fetchCustomers to return 3 customers.
// Assert buildEntityList('customer','ytd') returns { entities: 3 items with null metrics, enriched: false }.
// Change readOrders mock to return orders; assert enriched=true and metrics populated.
```

- [ ] **Step 3: Run tests**

Run: `cd server && npx vitest run src/services/__tests__/entity-list-builder.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Delete `entity-stub-builder.ts` (superseded)**

Run: `rm server/src/services/entity-stub-builder.ts`. Verify no remaining imports: `grep -rn "entity-stub-builder" server/`.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/entity-list-builder.ts server/src/services/__tests__/entity-list-builder.test.ts
git rm server/src/services/entity-stub-builder.ts
git commit -m "feat(server): entity-list-builder — master-data for customer/zone, orders-derived for item dims"
```

---

### Task 4.3: Update `entities.ts` to use `buildEntityList`

**Files:**
- Modify: `server/src/routes/entities.ts`

- [ ] **Step 1: Rewrite `entities.ts` handler**

```ts
import { buildEntityList } from '../services/entity-list-builder.js';

entitiesRouter.get('/entities', validateQuery(querySchema), async (_req, res, next) => {
  try {
    const { groupBy, period } = res.locals.query as z.infer<typeof querySchema>;
    const result = await buildEntityList(groupBy as Dimension, period);
    const response: ApiResponse<{ entities: EntityListItem[]; yearsAvailable: string[] }> = {
      data: { entities: result.entities, yearsAvailable: result.yearsAvailable },
      meta: {
        cached: true,
        cachedAt: null,
        period,
        dimension: groupBy,
        entityCount: result.entities.length,
        enriched: result.enriched,  // expose to client for refetchInterval logic
      },
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});
```

Update the `ApiResponse` meta type in `shared/types/api-responses.ts` to include `enriched?: boolean`.

- [ ] **Step 2: Run tests**

Run: `cd server && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/entities.ts shared/types/api-responses.ts
git commit -m "feat(server): entities route uses buildEntityList + exposes meta.enriched"
```

---

### Task 4.4: Update `contacts.ts` — dimension-aware + `(customer, email)` pair preservation

**Files:**
- Modify: `server/src/routes/contacts.ts`
- Test: `server/src/routes/__tests__/contacts.test.ts` (create or extend)

- [ ] **Step 1: Write failing tests**

```ts
describe('GET /api/sales/contacts', () => {
  it('dimension=customer unchanged: returns contacts for a single customer', async () => {
    // existing behavior — assert identical payload for ?customerId=C1.
  });

  it('dimension=vendor resolves customerIds via scope and preserves (customer, email) pairs', async () => {
    // Seed cache: orders where V1 appears in items from C1 and C2.
    // GET ?dimension=vendor&entityId=V1 → contacts from C1 + C2, each contact with customerName.
    // Assert no email is dropped that appears in both customers.
  });

  it('no cross-customer email dedup: same email in C1 + C2 yields 2 rows', async () => {
    // ...
  });
});
```

- [ ] **Step 2: Implement**

Extend the querySchema:

```ts
const querySchema = z.object({
  customerId: z.string().optional(),
  customerIds: z.string().optional(),
  dimension: z.enum(['customer','zone','vendor','brand','product_type','product']).optional(),
  entityId: z.string().optional(),
  entityIds: z.string().optional(),
}).refine(q => q.customerId || q.customerIds || q.entityId || q.entityIds, {
  message: 'Either a customerId(s) or dimension + entityId(s) is required',
});
```

Branch on `dimension` when provided:
- If `dimension === 'customer'` (or absent + customerId/customerIds set): existing behavior unchanged.
- Else: resolve `customerIds` by calling `scopeOrders(cachedOrders.orders, dimension, new Set(entityIds), cachedCustomers).map(o => o.CUSTNAME)`. Dedupe CUSTNAMEs. Then reuse the existing `perCustomerResults` path — which already annotates with `customerName` and produces one row per (customer, contact) pair. **Do NOT dedupe across customers.**

- [ ] **Step 3: Run tests**

Run: `cd server && npx vitest run src/routes/__tests__/contacts.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/contacts.ts server/src/routes/__tests__/contacts.test.ts
git commit -m "feat(server): contacts dimension-aware; preserve (customer, email) pairs (Codex #4)"
```

---

### Task 4.5: Update `fetch-all.ts` — accept new filter params and apply item predicates

**Files:**
- Modify: `server/src/routes/fetch-all.ts`

- [ ] **Step 1: Extend Zod query schema**

Add `brand`, `productFamily`, `countryOfOrigin`, `foodServiceRetail` as optional comma-separated strings. Transform to `string[]` in schema. Add `dimension` param (default `'customer'` for back-compat).

- [ ] **Step 2: Wire `filterOrdersByItemCriteria` into the filter pipeline**

Current pipeline (from earlier agent report):
```
filterOrdersByAgent → filterOrdersByCustomerCriteria → filterOrdersByEntityIds
```
Add after `filterOrdersByCustomerCriteria`:
```ts
filtered = filterOrdersByItemCriteria(filtered, {
  brand: brandFilter,
  productFamily: familyFilter,
  countryOfOrigin: countryFilter,
  foodServiceRetail: fsrFilter,
});
```

- [ ] **Step 3: Build scope from `dimension` + `entityIds` and pass to `aggregateOrders`**

Replace the existing direct `aggregateOrders(filtered, prev, period)` with scope-aware call if `dimension !== 'customer'` or entityIds present.

- [ ] **Step 4: Verify LOC + run tests**

Run: `wc -l server/src/routes/fetch-all.ts && cd server && npx vitest run && npx tsc --noEmit`
Expected: LOC ≤ 300. All tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/fetch-all.ts
git commit -m "feat(server): fetch-all accepts dimension + item-level filters; reuse scopeOrders"
```

---

## Phase 5 — Client Types, Hooks, Utils

### Task 5.1: Extend `client/src/utils/filter-types.ts`

**Files:**
- Modify: `client/src/utils/filter-types.ts`

- [ ] **Step 1: Add FilterField members + update DIMENSION_FILTER_FIELDS**

```ts
export type FilterField =
  | 'revenue' | 'orderCount' | 'avgOrder' | 'marginPercent'
  | 'frequency' | 'lastOrderDate'
  | 'name' | 'rep' | 'zone' | 'customerType'
  | 'brand' | 'productFamily' | 'countryOfOrigin' | 'foodServiceRetail';  // NEW

// Extend FIELD_LABELS + FIELD_TYPES for the 4 new fields (all type: 'text').

export const DIMENSION_FILTER_FIELDS: Record<Dimension, FilterField[]> = {
  customer: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name', 'rep', 'zone', 'customerType'],
  zone:        ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
  vendor:      ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name', 'brand', 'productFamily', 'countryOfOrigin', 'foodServiceRetail'],
  brand:       ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
  product_type:['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name', 'brand', 'countryOfOrigin', 'foodServiceRetail'],
  product:     ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name', 'brand', 'productFamily', 'countryOfOrigin', 'foodServiceRetail'],
};
```

- [ ] **Step 2: Verify TS**

Run: `cd client && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/utils/filter-types.ts
git commit -m "feat(client): add item-attribute filter fields per dimension"
```

---

### Task 5.2: Update entities query hook with conditional staleTime/refetchInterval (Codex #3)

**Files:**
- Modify: `client/src/hooks/useDashboardState.ts` (or wherever entities query lives — find via grep)

- [ ] **Step 1: Locate the entities `useQuery` call**

Run: `grep -rn "queryKey.*entities" client/src/hooks/`
Identify the hook where `/api/sales/entities` is fetched.

- [ ] **Step 2: Add conditional policy**

```ts
const entitiesQuery = useQuery({
  queryKey: ['entities', activeDimension, activePeriod],
  queryFn: async () => {
    const res = await fetch(`/api/sales/entities?groupBy=${activeDimension}&period=${activePeriod}`);
    return res.json() as Promise<ApiResponse<{ entities: EntityListItem[]; yearsAvailable: string[] }>>;
  },
  staleTime: (query) => query.state.data?.meta?.enriched === false ? 0 : 5 * 60_000,
  refetchInterval: (query) => query.state.data?.meta?.enriched === false ? 15_000 : false,
});
```

- [ ] **Step 3: Run TS + client build**

Run: `cd client && npx tsc -b --noEmit && npx vite build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useDashboardState.ts
git commit -m "fix(client): conditional entities-query polling until meta.enriched (Codex #3)"
```

---

### Task 5.3: Update `useDashboardData.ts` — pass entityIds + drop non-customer guards

**Files:**
- Modify: `client/src/hooks/useDashboardData.ts`

- [ ] **Step 1: Edit**

```ts
const params = new URLSearchParams({ groupBy, period });
if (activeEntityIds.length === 1) params.set('entityId', activeEntityIds[0]);
else if (activeEntityIds.length > 1) params.set('entityIds', activeEntityIds.join(','));

const res = await fetch(`/api/sales/dashboard?${params}`);
```

Remove any `if (activeDimension !== 'customer') return` short-circuits.

- [ ] **Step 2: Verify TS + commit**

```bash
cd client && npx tsc -b --noEmit
git add client/src/hooks/useDashboardData.ts
git commit -m "feat(client): useDashboardData supports entityIds array for all dimensions"
```

---

### Task 5.4: Update `useContacts.ts` — accept dimension + entityId(s)

**Files:**
- Modify: `client/src/hooks/useContacts.ts`

- [ ] **Step 1: Edit fetch functions**

```ts
async function fetchContacts(dimension: Dimension, entityId: string) {
  const params = new URLSearchParams({ dimension, entityId });
  const response = await fetch(`/api/sales/contacts?${params}`);
  return response.json();
}

async function fetchConsolidatedContacts(dimension: Dimension, entityIds: string[]) {
  const params = new URLSearchParams({ dimension, entityIds: entityIds.join(',') });
  const response = await fetch(`/api/sales/contacts?${params}`);
  return response.json();
}

export function useContacts(dimension: Dimension, entityId: string | null, enabled: boolean) { /* ... */ }
export function useConsolidatedContacts(dimension: Dimension, entityIds: string[], enabled: boolean) { /* ... */ }
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useContacts.ts
git commit -m "feat(client): useContacts accepts dimension + entityId(s)"
```

---

### Task 5.5: Update `useDashboardState.ts` — drop customer gates, parameterize loading label

**Files:**
- Modify: `client/src/hooks/useDashboardState.ts`

- [ ] **Step 1: Edit**

- L86: change `useContacts(activeEntityId, activeDimension === 'customer')` → `useContacts(activeDimension, activeEntityId, !!activeEntityId)`.
- L91-99: remove `if (activeDimension !== 'customer')` guards. Always compute `consolidatedContactIds` based on `activeEntityIds`.
- L97-99: `useConsolidatedContacts(activeDimension, consolidatedContactIds, consolidatedContactIds.length > 0)`.
- L122: change `'Loading customers...'` → `` `Loading ${DIMENSION_PLURAL_LABELS[activeDimension].toLowerCase()}...` ``.

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useDashboardState.ts
git commit -m "feat(client): remove dimension=='customer' gates; parameterize loading label"
```

---

### Task 5.6: Update `useReport.ts` and `build-report-url.ts` — serialize new filter fields

**Files:**
- Modify: `client/src/hooks/useReport.ts`
- Modify: `client/src/hooks/build-report-url.ts`

- [ ] **Step 1: Extend `build-report-url.ts`**

For each of `brand`, `productFamily`, `countryOfOrigin`, `foodServiceRetail`: if the array is non-empty, `params.set(key, value.join(','))`. Also add `dimension` as a param always.

- [ ] **Step 2: Wire through `useReport.ts`**

Pass the new filter fields + dimension from the consumer to `build-report-url`.

- [ ] **Step 3: Run TS build**

Run: `cd client && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useReport.ts client/src/hooks/build-report-url.ts
git commit -m "feat(client): serialize dimension + new item-level filters to Report SSE URL"
```

---

## Phase 6 — Client Components

### Task 6.1: Thread `activeDimension` through `RightPanel` → `DetailHeader`

**Files:**
- Modify: `client/src/components/right-panel/RightPanel.tsx`
- Modify: `client/src/components/right-panel/DetailHeader.tsx`

- [ ] **Step 1: Add prop to `DetailHeader`**

```ts
interface DetailHeaderProps {
  entity: EntityListItem | null;
  activeDimension: Dimension;  // NEW
  activePeriod: Period;
  yearsAvailable: string[];
  onPeriodChange: (period: Period) => void;
  onExport: () => void;
}
```

Replace `const name = entity?.name ?? 'All Customers'` with `` const name = entity?.name ?? `All ${DIMENSION_PLURAL_LABELS[activeDimension]}` ``.

- [ ] **Step 2: Thread from `RightPanel`**

```tsx
<DetailHeader entity={selectedEntity} activeDimension={activeDimension} ... />
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/right-panel/RightPanel.tsx client/src/components/right-panel/DetailHeader.tsx
git commit -m "feat(client): DetailHeader empty-state uses DIMENSION_PLURAL_LABELS"
```

---

### Task 6.2: Add `entityLabel` prop to `PerCustomer*` components

**Files:**
- Modify: `client/src/components/right-panel/PerCustomerToggle.tsx`
- Modify: `client/src/components/right-panel/PerCustomerKPITable.tsx`
- Modify: `client/src/components/right-panel/PerCustomerChartTable.tsx`

- [ ] **Step 1: Add prop to `PerCustomerToggle`**

```ts
interface PerCustomerToggleProps {
  mode: PerCustomerMode;
  onChange: (mode: PerCustomerMode) => void;
  entityLabel?: string;  // NEW — default "Customer"
}
// Replace hardcoded "Per Customer" with `Per ${entityLabel ?? 'Customer'}`.
```

- [ ] **Step 2: Add prop to tables**

Both `PerCustomerKPITable` and `PerCustomerChartTable` add `entityLabel?: string` and use it for the first column header (default 'Customer').

- [ ] **Step 3: Commit**

```bash
git add client/src/components/right-panel/PerCustomer*.tsx
git commit -m "feat(client): PerCustomer* components accept entityLabel prop"
```

---

### Task 6.3: Thread `entityLabel` from `KPISection` + `kpi-modal-content`

**Files:**
- Modify: `client/src/components/right-panel/KPISection.tsx`
- Modify: `client/src/components/right-panel/kpi-modal-content.tsx`

- [ ] **Step 1: Receive + pass `activeDimension` through**

In `KPISection`, accept `activeDimension` as prop (threaded from `RightPanel`). Pass `entityLabel={DIMENSION_SINGULAR_LABELS[activeDimension]}` to `PerCustomerToggle`, `PerCustomerKPITable`, `PerCustomerChartTable` wherever they're rendered.

- [ ] **Step 2: Same for `kpi-modal-content.tsx`**

- [ ] **Step 3: Commit**

```bash
git add client/src/components/right-panel/KPISection.tsx client/src/components/right-panel/kpi-modal-content.tsx
git commit -m "feat(client): pass entityLabel through KPI section → modal → per-customer components"
```

---

### Task 6.4: Update `ConsolidatedHeader.tsx` `formatFilters` for new filter fields

**Files:**
- Modify: `client/src/components/right-panel/ConsolidatedHeader.tsx`

- [ ] **Step 1: Extend `formatFilters`**

Add cases for `brand`, `productFamily`, `countryOfOrigin`, `foodServiceRetail` that render "Brand: X, Y, Z" etc.

- [ ] **Step 2: Commit**

```bash
git add client/src/components/right-panel/ConsolidatedHeader.tsx
git commit -m "feat(client): ConsolidatedHeader renders new item-level filter labels"
```

---

### Task 6.5: Update `ReportFilterModal.tsx` — per-dimension filter dropdowns + dimension plural label

**Files:**
- Modify: `client/src/components/shared/ReportFilterModal.tsx`

- [ ] **Step 1: Build a per-dimension filter-dropdown set**

```ts
const FILTERS_BY_DIMENSION: Record<Dimension, Array<'agentName'|'zone'|'customerType'|'brand'|'productFamily'|'countryOfOrigin'|'foodServiceRetail'>> = {
  customer:    ['agentName','zone','customerType'],
  zone:        ['agentName','customerType'],
  vendor:      ['agentName','zone','customerType','brand','productFamily','countryOfOrigin','foodServiceRetail'],
  brand:       ['agentName','zone','customerType'],
  product_type:['agentName','zone','customerType','brand','countryOfOrigin','foodServiceRetail'],
  product:     ['agentName','zone','customerType','brand','productFamily','countryOfOrigin','foodServiceRetail'],
};
```

Render only the dropdowns listed for the active dimension.

- [ ] **Step 2: Replace "Fetching data for {N} customers"**

Use `` `Fetching data for ${N} ${DIMENSION_PLURAL_LABELS[activeDimension].toLowerCase()}` ``.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/shared/ReportFilterModal.tsx
git commit -m "feat(client): per-dim filter dropdowns + dimension plural label in ReportFilterModal"
```

---

### Task 6.6: Remove contacts-tab dimension gate in `TabsSection.tsx`

**Files:**
- Modify: `client/src/components/right-panel/TabsSection.tsx`

- [ ] **Step 1: Always render Contacts tab**

Find and remove any `if (activeDimension !== 'customer')` that hides the Contacts tab. Ensure the tab renders for all dims; its content comes from `useContacts` which now handles any dimension.

- [ ] **Step 2: Commit**

```bash
git add client/src/components/right-panel/TabsSection.tsx
git commit -m "feat(client): Contacts tab rendered for all dimensions"
```

---

## Phase 7 — Vendor Smoke Test & Verification

### Task 7.1: Full pre-deploy verification

- [ ] **Step 1: Run client build**

Run: `cd client && npx tsc -b --noEmit && npx vite build`
Expected: PASS, bundle ≤ 500KB gzip.

- [ ] **Step 2: Run server build + tests**

Run: `cd server && npx tsc --noEmit && npx vitest run`
Expected: PASS, all tests green (63 existing + ~18 new = ~81 total).

- [ ] **Step 3: No `any`, no files > 300 LOC, no secrets**

```bash
grep -rn ": any\|as any" server/src/ client/src/ | grep -v ".test." && echo "FAIL: any detected" || echo "PASS: no any"
find server/src client/src shared -name "*.ts" -o -name "*.tsx" | xargs wc -l | awk '$1 > 300 {print "FAIL:", $0; found=1} END {if (!found) print "PASS: all files ≤ 300 LOC"}'
grep -rn "password\|secret\|SGAPI" server/src/ client/src/ --include="*.ts" --include="*.tsx" && echo "FAIL: secret leak" || echo "PASS: no secrets"
```

- [ ] **Step 4: Local dev smoke — Vendor dim end-to-end**

Start dev:
```bash
cd server && npm run dev &
cd client && npm run dev
```

Open `http://localhost:5173/`. Use the test customer baseline (`C7826` if needed) but drive the vendor-dim flow:

1. Click the Vendors toggle → left panel shows populated vendor list (at minimum the ~63 vendors seen in current orders).
2. Click any vendor → right panel fills with KPIs. **Verify revenue = Σ QPRICE of that vendor's items**, not TOTPRICE.
3. Click the Orders tab → shows orders containing vendor's items with correct line items.
4. Click the Items tab → shows items filtered to this vendor.
5. Click Contacts tab → shows contacts from the customers who bought this vendor's items, with Customer column.
6. Multi-select 2 vendors → View Consolidated → per-entity tables show distinct per-vendor metrics (NOT the same for both — Codex #2 fix).
7. Click Report → modal shows Brand / Country dropdowns (vendor-dim has them). Run export. CSV should contain only scoped rows.

- [ ] **Step 5: No-commit, document results**

Create `docs/superpowers/plans/vendor-smoke-results.md` with pass/fail per step + observed values. If any step fails, fix in its own task before proceeding.

---

## Phase 8 — Extend to Other Dimensions

### Task 8.1: Zone dim smoke test

- [ ] **Step 1: Click Zones toggle in dev**

Verify: left panel shows all zones (from DISTRLINES master). Click a zone → KPIs based on customers-in-zone orders. Contacts tab shows contacts from customers in that zone.

- [ ] **Step 2: If failures — debug + patch + commit**

### Task 8.2: Product Type dim smoke test

- [ ] **Step 1: Click Prod. Type toggle**

Verify: 3 product types shown (Culinary / Pastry / Beverages). Click any → item-based KPIs via QPRICE sums. Orders tab shows orders containing matching items. Contacts tab shows customers who bought those types.

### Task 8.3: Product dim smoke test

- [ ] **Step 1: Click Products toggle**

Verify: populated list from cached orders (sold products). Click one → item-level KPIs (single PARTNAME).

### Task 8.4: Final commit marker

- [ ] **Step 1: Commit any smoke-test-documentation files**

```bash
git add docs/superpowers/plans/vendor-smoke-results.md
git commit -m "docs: vendor + multi-dim smoke-test results"
```

### Task 8.5: Push and deploy

- [ ] **Step 1: Push main (after user sign-off)**

```bash
git push origin main
```

- [ ] **Step 2: Monitor Railway deploy logs for the `[entities] join-ratio` log lines**

Verify the Railway deploy completes, entities route responds, and the join-ratio for vendor is 100% (all order-vendor-codes resolve in SUPPLIERS master).

---

## Scope Coverage Self-Review

| Spec section | Task | Status |
|---|---|---|
| §1 Motivation / root-cause (entity-stub-builder cache-key mismatch) | Task 4.2 replaces stub-builder with buildEntityList using `readOrders('ytd','customer:all')` | ✓ |
| §2 Dimension semantics | Task 1.3 `scopeOrders` implements every dim's predicate | ✓ |
| §3 Pre-filter normalization + per-entity re-scoping | Task 1.3 (scope) + Task 3.3 (per-entity loop) | ✓ |
| §4 Master-data caches (customers, zones, vendors, product_types, products) | Tasks 2.1-2.3 fetch + warm | ✓ |
| §4 `buildFilterHash` extension + `buildEntitySetHash` | Task 1.1 | ✓ |
| §5 File-by-file | All Phase-1→6 tasks map 1-to-1 | ✓ |
| §6 API contracts (`entities`, `dashboard`, `contacts`, `fetch-all`) | Tasks 4.1, 4.3, 4.4, 4.5 | ✓ |
| §7 Error handling (staleTime + refetchInterval conditional) | Task 5.2 | ✓ |
| §7 Zero-vs-null contract | Task 4.2 `customerStub` vs `customerStubWithZeroMetrics` | ✓ |
| §8 Edge cases (empty orders, multi-select ≥400, prev-year scope) | Covered by Task 1.3 tests + Task 3.3 tests | ✓ |
| §9 Unit + integration + regression tests | Tasks 1.1, 1.3, 1.4, 3.3, 4.1, 4.4 + Phase 7 smoke | ✓ |
| §10 Out of scope (brand dim, vendor-contacts tab, per-customer breakdowns on non-customer dims) | Documented — not implemented | ✓ |
| §11 Build order | Phase 1→6 follows exact spec order | ✓ |
| §12 Integration contracts | Tasks verify imports + state propagation | ✓ |
| §13 Codex finding resolution | #1 Task 1.3+4.2; #2 Task 3.3; #3 Task 5.2; #4 Task 4.4 | ✓ |

No gaps.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-16-dimension-parity-and-master-data-plan.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Best fit given this plan spans 35+ tasks across 8 phases and each task is self-contained.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
