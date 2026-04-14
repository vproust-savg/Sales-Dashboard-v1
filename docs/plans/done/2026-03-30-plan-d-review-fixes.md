# Code Review Fixes — Implementation Plan (Plan D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 21 issues from the post-implementation code review — 3 Critical, 10 Important, 8 Minor.

**Architecture:** 5 work areas in dependency order: (1) Server pipeline fixes, (2) Shared type enrichment, (3) Filter/sort system rebuild, (4) Client rendering fixes, (5) Cleanup. Areas 1+2 are parallel; Area 3 depends on Area 2; Areas 4+5 are independent.

**Tech Stack:** Express 5, TypeScript strict, React 19, TanStack Query v5, Tailwind v4, Zod, Vitest

**Spec:** `docs/specs/2026-03-30-code-review-fixes.md`

**Pre-requisite reading:**
- `CLAUDE.md` — project rules, design tokens, common mistakes
- `docs/specs/2026-03-30-code-review-fixes.md` — full fix spec with Railway guardrails

---

## File Map

### Created (4 files)
| File | Responsibility |
|------|---------------|
| `server/src/services/priority-instance.ts` | Module-scoped PriorityClient singleton |
| `client/src/components/shared/ErrorBoundary.tsx` | React error boundary with fallback UI |
| `client/src/utils/filter-types.ts` | Shared filter field/operator types and mappings |
| `learnings/priority-odata-date-literals.md` | Priority OData date format documentation |

### Modified (20 files)
| File | Changes |
|------|---------|
| `server/src/services/priority-client.ts` | Pagination infinite loop guard |
| `server/src/routes/dashboard.ts` | Import singleton, pass periodMonths |
| `server/src/routes/contacts.ts` | Import singleton |
| `server/src/services/data-aggregator.ts` | Remove server-side order sort |
| `server/src/services/kpi-aggregator.ts` | UTC consistency |
| `server/src/services/dimension-grouper.ts` | Compute enrichment fields |
| `server/src/index.ts` | Add CORS middleware |
| `shared/types/dashboard.ts` | Enrich EntityListItem |
| `shared/utils/formatting.ts` | Fix formatCurrencyCompact negatives |
| `client/src/utils/filter-types.ts` | NEW — field/operator type definitions |
| `client/src/utils/filter-engine.ts` | Rewrite with correct operators + all fields |
| `client/src/utils/sort-engine.ts` | Add all 7 sort fields |
| `client/src/hooks/useSort.ts` | Refactor to useReducer |
| `client/src/hooks/useFilters.ts` | Type-tighten field/operator |
| `client/src/hooks/useEntitySelection.ts` | Memoize selectedIds array |
| `client/src/components/left-panel/SearchBox.tsx` | Fix debounce dependencies |
| `client/src/components/left-panel/FilterCondition.tsx` | Align types, field-type-aware operators |
| `client/src/components/left-panel/FilterPanel.tsx` | Remove unsafe adapter |
| `client/src/components/right-panel/Sparkline.tsx` | useId() for gradient |
| `client/src/components/right-panel/DetailHeader.tsx` | Add type="button" |
| `client/src/App.tsx` | Wrap with ErrorBoundary |
| `client/src/layouts/DashboardLayout.tsx` | Remove isConsolidated, type meta |
| `client/src/components/right-panel/HeroRevenueCard.tsx` | Design tokens |
| `client/src/components/right-panel/KPICard.tsx` | Design tokens |
| `client/src/components/right-panel/KPISection.tsx` | Design tokens |
| `client/src/components/right-panel/YoYBarChart.tsx` | Design tokens |
| `.gitignore` | Exclude .js alongside .ts |

### Deleted (37 files)
- `client/src/components/shared/Badge.tsx` + `Badge.js`
- All 35 `.js` files in `client/src/` and `shared/`

---

## Area 1: Server Pipeline

### Task 1: PriorityClient Singleton

**Fixes:** C2 (rate limiter not shared across requests)

**Files:**
- Create: `server/src/services/priority-instance.ts`
- Modify: `server/src/routes/dashboard.ts`
- Modify: `server/src/routes/contacts.ts`

- [ ] **Step 1: Create the singleton module**

Create `server/src/services/priority-instance.ts`:

```typescript
// FILE: server/src/services/priority-instance.ts
// PURPOSE: Module-scoped PriorityClient singleton — rate limiter state shared across all requests
// USED BY: server/src/routes/dashboard.ts, server/src/routes/contacts.ts
// EXPORTS: priorityClient

import { PriorityClient } from './priority-client.js';
import { env } from '../config/env.js';

// WHY: Creating one instance per request (the old pattern) gave each request its own
// requestTimestamps array, defeating rate limiting. A singleton shares the array.
export const priorityClient = new PriorityClient({
  baseUrl: env.PRIORITY_BASE_URL,
  username: env.PRIORITY_USERNAME,
  password: env.PRIORITY_PASSWORD,
});
```

- [ ] **Step 2: Update dashboard.ts to use singleton**

In `server/src/routes/dashboard.ts`:

Replace:
```typescript
import { PriorityClient } from '../services/priority-client.js';
```
With:
```typescript
import { priorityClient } from '../services/priority-instance.js';
```

Remove lines 39-43 (the `new PriorityClient({...})` block) and replace `client` with `priorityClient` in the three `cachedFetch` calls (lines 48-53).

- [ ] **Step 3: Update contacts.ts to use singleton**

In `server/src/routes/contacts.ts`:

Replace:
```typescript
import { PriorityClient } from '../services/priority-client.js';
```
With:
```typescript
import { priorityClient } from '../services/priority-instance.js';
```

Remove lines 26-30 (the `new PriorityClient({...})` block) and replace `client` with `priorityClient` in the `cachedFetch` call.

- [ ] **Step 4: Remove unused PriorityClient import from env.ts**

Check if `PriorityClient` is still imported anywhere in routes. Run:
```bash
grep -rn "from '../services/priority-client" server/src/routes/
```
Expected: zero matches.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 6: Run tests**

```bash
cd server && npx vitest run
```
Expected: all tests pass.

- [ ] **Step 7: Verify no `new PriorityClient` in routes**

```bash
grep -rn "new PriorityClient" server/src/routes/
```
Expected: zero matches.

- [ ] **Step 8: Commit**

```bash
git add server/src/services/priority-instance.ts server/src/routes/dashboard.ts server/src/routes/contacts.ts
git commit -m "fix(server): use PriorityClient singleton for shared rate limiting (C2)"
```

---

### Task 2: Pagination Infinite Loop Guard

**Fixes:** C3 (cursor doesn't advance when last two records share same cursor value)

**Files:**
- Modify: `server/src/services/priority-client.ts`
- Test: `server/tests/priority-client.test.ts`

- [ ] **Step 1: Write failing test**

Add to the existing test file (or create if needed) in `server/tests/`:

```typescript
it('breaks out of pagination when cursor value does not advance', async () => {
  // Simulate: two batches where the last record has the same cursor value
  // The outer loop should detect this and break instead of looping forever
  // ... mock fetchEntity to return records with duplicate cursor values
});
```

Note: If mocking `fetchEntity` is complex due to the class structure, add the guard and write a verification test that confirms `fetchAllPages` terminates.

- [ ] **Step 2: Add the guard to priority-client.ts**

In `server/src/services/priority-client.ts`, in the `fetchAllPages` method, add `previousCursorValue` tracking before the outer `while (true)` loop:

Find the line `let cursorValue: string | null = null;` and after it add:
```typescript
let previousCursorValue: string | null = null;
```

Then inside the outer loop, after the inner loop completes and before the cursor advancement logic, add:
```typescript
// Guard: if cursor didn't advance, we'd loop forever
if (cursorValue !== null && cursorValue === previousCursorValue) break;
previousCursorValue = cursorValue;
```

- [ ] **Step 3: Run tests**

```bash
cd server && npx vitest run
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/priority-client.ts
git commit -m "fix(server): add pagination infinite loop guard (C3)"
```

---

### Task 3: Server Housekeeping (I7, I9, M5, M7)

**Fixes:** I7 (duplicate sort), I9 (no CORS), M5 (UTC consistency), M7 (OData date docs)

**Files:**
- Modify: `server/src/services/data-aggregator.ts`
- Modify: `server/src/index.ts`
- Modify: `server/src/services/kpi-aggregator.ts`
- Create: `learnings/priority-odata-date-literals.md`

- [ ] **Step 1: Install cors package**

```bash
cd server && npm install cors && npm install -D @types/cors
```

CRITICAL: `cors` goes in `dependencies` (not `devDependencies`). Docker production stage uses `npm ci --omit=dev`. Verify:
```bash
node -e "const p=require('./package.json'); console.log('deps:', !!p.dependencies.cors, 'devDeps:', !!p.devDependencies?.cors)"
```
Expected: `deps: true devDeps: false`

- [ ] **Step 2: Add CORS middleware to index.ts**

In `server/src/index.ts`, add after `import express from 'express';`:

```typescript
import cors from 'cors';
```

Add after `app.use(express.json());`:

```typescript
// WHY: Dashboard is iframe-embedded in Airtable; cross-origin requests may be needed.
// credentials: false because all Priority auth is server-to-server (no browser cookies).
const allowedOrigins = [
  'http://localhost:5173',
  process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : undefined,
].filter(Boolean) as string[];

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: false,
}));
```

- [ ] **Step 3: Remove duplicate server-side order sort**

In `server/src/services/data-aggregator.ts`, line 105, change:

```typescript
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
```

Remove this `.sort()` call entirely. The client-side `OrdersTable` already sorts by date and allows user-controlled direction.

- [ ] **Step 4: Fix UTC consistency in kpi-aggregator.ts**

In `server/src/services/kpi-aggregator.ts`, make these changes:

Line 28: change `now.getMonth()` to `now.getUTCMonth()`:
```typescript
  const monthsInPeriod = period === 'ytd'
    ? Math.max(1, now.getUTCMonth() + 1)
    : 12;
```

Line 32-34: change to UTC:
```typescript
  const currentQuarter = Math.floor(now.getUTCMonth() / 3);
  const qStart = new Date(Date.UTC(now.getUTCFullYear(), currentQuarter * 3, 1));
  const prevQStart = new Date(Date.UTC(now.getUTCFullYear(), (currentQuarter - 1) * 3, 1));
```

Line 109: change to UTC for sparkline month generation:
```typescript
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
```

- [ ] **Step 5: Create OData date learning file**

Create `learnings/priority-odata-date-literals.md`:

```markdown
# Priority OData: Unquoted Date Literals

**Discovery date:** 2026-03-30

Priority's OData implementation accepts unquoted ISO 8601 date strings in `$filter`:

```
CURDATE ge 2026-01-01T00:00:00Z and CURDATE lt 2027-01-01T00:00:00Z
```

Per OData v4 spec, `Edm.DateTimeOffset` literals should be unquoted (unlike `Edm.String`).
Priority conforms here. No quoting needed for date filters.

Used in: `server/src/services/priority-queries.ts:91`
```

- [ ] **Step 6: Run tests + TypeScript check**

```bash
cd server && npx tsc --noEmit && npx vitest run
```
Expected: zero TS errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/index.ts server/src/services/data-aggregator.ts server/src/services/kpi-aggregator.ts server/package.json server/package-lock.json learnings/priority-odata-date-literals.md
git commit -m "fix(server): add CORS, UTC consistency, remove duplicate sort (I7, I9, M5, M7)"
```

---

## Area 2: Shared Types + Utils

### Task 4: Enrich EntityListItem

**Fixes:** EntityListItem only has 3 filterable/sortable fields; needs 10

**Files:**
- Modify: `shared/types/dashboard.ts`
- Modify: `server/src/services/dimension-grouper.ts`
- Modify: `server/src/routes/dashboard.ts` (pass periodMonths)

- [ ] **Step 1: Add fields to EntityListItem**

In `shared/types/dashboard.ts`, replace the `EntityListItem` interface:

```typescript
/** One entity in the left-panel list (customer, zone, vendor, brand, product type, or product) */
export interface EntityListItem {
  id: string;
  name: string;
  meta1: string;        // Line 2 left (e.g., zone + rep, or SKU + brand)
  meta2: string;        // Line 2 right (e.g., "22 orders")
  revenue: number;      // For sort + display
  orderCount: number;   // For sort + display
  // WHY: Enrichment fields enable client-side filter + sort on all spec-defined fields.
  // Computed by dimension-grouper from the same order data already fetched.
  avgOrder: number;                // revenue / orderCount, 0 when no orders
  marginPercent: number;           // (totalProfit / totalRevenue) * 100
  marginAmount: number;            // total profit in dollars
  frequency: number | null;        // orders per month, null when period < 1 month
  lastOrderDate: string | null;    // ISO date of most recent order, null when no orders
  rep: string | null;              // sales agent name (customer dimension only, null otherwise)
  zone: string | null;             // zone name (customer dimension only, null otherwise)
  customerType: string | null;     // customer type (customer dimension only, null otherwise)
}
```

- [ ] **Step 2: Update dimension-grouper signature**

In `server/src/services/dimension-grouper.ts`, change the `groupByDimension` signature:

```typescript
export function groupByDimension(
  dimension: Dimension,
  orders: RawOrder[],
  customers: RawCustomer[],
  periodMonths: number,
): EntityListItem[] {
```

Update each `groupBy*` call in the `groupers` record to pass `periodMonths`:

```typescript
  const groupers: Record<Dimension, () => EntityListItem[]> = {
    customer: () => groupByCustomer(orders, customers, periodMonths),
    zone: () => groupByZone(orders, customers, periodMonths),
    vendor: () => groupByVendor(orders, periodMonths),
    brand: () => groupByBrand(orders, periodMonths),
    product_type: () => groupByProductType(orders, periodMonths),
    product: () => groupByProduct(orders, periodMonths),
  };
```

- [ ] **Step 3: Update groupByCustomer to compute enrichment fields**

In `groupByCustomer`, change the groups Map value type and computation:

```typescript
function groupByCustomer(orders: RawOrder[], customers: RawCustomer[], periodMonths: number): EntityListItem[] {
  const custMap = new Map(customers.map(c => [c.CUSTNAME, c]));
  const groups = new Map<string, { revenue: number; orderCount: number; profit: number; dates: string[] }>();

  orders.forEach(o => {
    const g = groups.get(o.CUSTNAME) ?? { revenue: 0, orderCount: 0, profit: 0, dates: [] };
    g.revenue += o.TOTPRICE;
    g.orderCount += 1;
    g.dates.push(o.CURDATE);
    // WHY: Compute profit from items for margin calculation
    const itemProfit = (o.ORDERITEMS_SUBFORM ?? []).reduce((s, i) => s + i.QPROFIT, 0);
    g.profit += itemProfit;
    groups.set(o.CUSTNAME, g);
  });

  return [...groups.entries()].map(([id, g]) => {
    const cust = custMap.get(id);
    const lastDate = g.dates.length > 0
      ? g.dates.reduce((a, b) => a > b ? a : b)
      : null;
    return {
      id,
      name: cust?.CUSTDES ?? id,
      meta1: [cust?.ZONEDES, cust?.AGENTDES].filter(Boolean).join(' \u00B7 '),
      meta2: `${g.orderCount} orders`,
      revenue: g.revenue,
      orderCount: g.orderCount,
      avgOrder: g.orderCount > 0 ? g.revenue / g.orderCount : 0,
      marginPercent: g.revenue > 0 ? (g.profit / g.revenue) * 100 : 0,
      marginAmount: g.profit,
      frequency: periodMonths >= 1 ? g.orderCount / periodMonths : null,
      lastOrderDate: lastDate,
      rep: cust?.AGENTDES ?? null,
      zone: cust?.ZONEDES ?? null,
      customerType: cust?.CTYPEDES ?? null,
    };
  });
}
```

- [ ] **Step 4: Update all other groupBy functions**

Apply the same enrichment pattern to `groupByZone`, `groupByVendor`, `groupByBrand`, `groupByProductType`, `groupByProduct`. Each must:

1. Track `profit` (from `QPROFIT`) and `dates` (from `CURDATE`) in the groups Map
2. Compute `avgOrder`, `marginPercent`, `marginAmount`, `frequency`, `lastOrderDate`
3. Set `rep`, `zone`, `customerType` to `null` (only customer dimension has these)

For example, `groupByZone`:
```typescript
function groupByZone(orders: RawOrder[], customers: RawCustomer[], periodMonths: number): EntityListItem[] {
  const custZone = new Map(customers.map(c => [c.CUSTNAME, { zone: c.ZONECODE, zoneName: c.ZONEDES }]));
  const groups = new Map<string, { name: string; revenue: number; orderCount: number; profit: number; customerIds: Set<string>; dates: string[] }>();

  orders.forEach(o => {
    const z = custZone.get(o.CUSTNAME);
    const zoneId = z?.zone ?? 'UNKNOWN';
    const g = groups.get(zoneId) ?? { name: z?.zoneName ?? zoneId, revenue: 0, orderCount: 0, profit: 0, customerIds: new Set(), dates: [] };
    g.revenue += o.TOTPRICE;
    g.orderCount += 1;
    g.dates.push(o.CURDATE);
    const itemProfit = (o.ORDERITEMS_SUBFORM ?? []).reduce((s, i) => s + i.QPROFIT, 0);
    g.profit += itemProfit;
    g.customerIds.add(o.CUSTNAME);
    groups.set(zoneId, g);
  });

  return [...groups.entries()].map(([id, g]) => {
    const lastDate = g.dates.length > 0 ? g.dates.reduce((a, b) => a > b ? a : b) : null;
    return {
      id, name: g.name,
      meta1: `${g.customerIds.size} customers`,
      meta2: `${g.orderCount} orders`,
      revenue: g.revenue, orderCount: g.orderCount,
      avgOrder: g.orderCount > 0 ? g.revenue / g.orderCount : 0,
      marginPercent: g.revenue > 0 ? (g.profit / g.revenue) * 100 : 0,
      marginAmount: g.profit,
      frequency: periodMonths >= 1 ? g.orderCount / periodMonths : null,
      lastOrderDate: lastDate,
      rep: null, zone: null, customerType: null,
    };
  });
}
```

Repeat for `groupByVendor`, `groupByBrand`, `groupByProductType`, `groupByProduct` — same enrichment pattern, `rep`/`zone`/`customerType` always `null`.

**WARNING:** `dimension-grouper.ts` may exceed 200 lines after these changes. If so, split into `dimension-grouper.ts` (main function + customer/zone) and `dimension-grouper-items.ts` (vendor/brand/productType/product).

- [ ] **Step 5: Update dashboard.ts to pass periodMonths**

In `server/src/routes/dashboard.ts`, compute and pass `periodMonths`:

After `const year = ...` (line 31), add:
```typescript
    // WHY: periodMonths is used by dimension-grouper for frequency calculation
    const periodMonths = period === 'ytd' ? now.getUTCMonth() + 1 : 12;
```

Update the `groupByDimension` call:
```typescript
    const entities = groupByDimension(groupBy as Dimension, ordersResult.data, customersResult.data, periodMonths);
```

- [ ] **Step 6: TypeScript check + tests**

```bash
cd server && npx tsc --noEmit && npx vitest run
cd ../client && npx tsc -b --noEmit
```
Expected: zero errors on both. Tests pass.

- [ ] **Step 7: Verify @shared imports are still type-only in server**

```bash
cd server && npm run build && grep -r "@shared" dist/ && echo "FAIL" || echo "OK"
```
Expected: "OK" — no unresolved `@shared` references.

- [ ] **Step 8: Commit**

```bash
git add shared/types/dashboard.ts server/src/services/dimension-grouper.ts server/src/routes/dashboard.ts
git commit -m "feat(shared): enrich EntityListItem with filter/sort fields"
```

---

### Task 5: Fix formatCurrencyCompact Negatives

**Fixes:** I2 (negative sign dropped)

**Files:**
- Modify: `shared/utils/formatting.ts`

- [ ] **Step 1: Fix the function**

In `shared/utils/formatting.ts`, replace `formatCurrencyCompact`:

```typescript
export function formatCurrencyCompact(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return k % 1 === 0 ? `${sign}$${k}K` : `${sign}$${k.toFixed(1)}K`;
  }
  return `${sign}$${abs}`;
}
```

- [ ] **Step 2: Verify both compiles pass**

```bash
cd server && npx tsc --noEmit
cd ../client && npx tsc -b --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add shared/utils/formatting.ts
git commit -m "fix(shared): formatCurrencyCompact preserves negative sign (I2)"
```

---

## Area 3: Filter/Sort System

### Task 6: Create Shared Filter Types

**Fixes:** I3 (operator mismatch), I4 (field mapping)

**Files:**
- Create: `client/src/utils/filter-types.ts`

- [ ] **Step 1: Create the types file**

Create `client/src/utils/filter-types.ts`:

```typescript
// FILE: client/src/utils/filter-types.ts
// PURPOSE: Single source of truth for filter field names, operators, and type classifications
// USED BY: filter-engine.ts, FilterCondition.tsx, FilterPanel.tsx, useFilters.ts
// EXPORTS: FilterField, FilterOperator, FieldType, FIELD_LABELS, OPERATOR_LABELS, FIELD_TYPES, OPERATORS_BY_TYPE, DIMENSION_FILTER_FIELDS

import type { Dimension } from '@shared/types/dashboard';

/** Internal field keys matching EntityListItem property names */
export type FilterField =
  | 'revenue' | 'orderCount' | 'avgOrder' | 'marginPercent'
  | 'frequency' | 'lastOrderDate'
  | 'name' | 'rep' | 'zone' | 'customerType';

export type FilterOperator =
  | 'gt' | 'lt' | 'gte' | 'lte'
  | 'equals' | 'not_equals' | 'contains'
  | 'between' | 'is_before' | 'is_after' | 'is_empty';

export type FieldType = 'numeric' | 'date' | 'text';

/** Human-readable labels shown in filter field dropdown */
export const FIELD_LABELS: Record<FilterField, string> = {
  revenue: 'Revenue', orderCount: 'Orders', avgOrder: 'Avg Order',
  marginPercent: 'Margin %', frequency: 'Frequency',
  lastOrderDate: 'Last Order',
  name: 'Name', rep: 'Rep', zone: 'Zone', customerType: 'Customer Type',
};

/** Human-readable labels shown in operator dropdown */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  gt: '>', lt: '<', gte: '>=', lte: '<=',
  equals: 'equals', not_equals: 'not equals',
  contains: 'contains', between: 'between',
  is_before: 'is before', is_after: 'is after',
  is_empty: 'is empty',
};

/** WHY: Different field types support different operators — spec Section 22.7 */
export const FIELD_TYPES: Record<FilterField, FieldType> = {
  revenue: 'numeric', orderCount: 'numeric', avgOrder: 'numeric',
  marginPercent: 'numeric', frequency: 'numeric',
  lastOrderDate: 'date',
  name: 'text', rep: 'text', zone: 'text', customerType: 'text',
};

/** Operators available per field type */
export const OPERATORS_BY_TYPE: Record<FieldType, FilterOperator[]> = {
  numeric: ['gt', 'lt', 'gte', 'lte', 'equals', 'between', 'is_empty'],
  date: ['is_before', 'is_after', 'between', 'is_empty'],
  text: ['equals', 'not_equals', 'contains', 'is_empty'],
};

/** WHY: Not all fields exist on all dimensions — rep/zone/customerType only on customers */
export const DIMENSION_FILTER_FIELDS: Record<Dimension, FilterField[]> = {
  customer: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name', 'rep', 'zone', 'customerType'],
  zone: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
  vendor: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
  brand: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
  product_type: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
  product: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
};
```

- [ ] **Step 2: Verify it compiles**

```bash
cd client && npx tsc -b --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add client/src/utils/filter-types.ts
git commit -m "feat(client): add shared filter type definitions"
```

---

### Task 7: Rewrite Filter Engine

**Fixes:** I3 (operator names), I4 (field mapping — now all 10 fields)

**Files:**
- Modify: `client/src/utils/filter-engine.ts`

- [ ] **Step 1: Rewrite filter-engine.ts**

Replace entire contents of `client/src/utils/filter-engine.ts`:

```typescript
// FILE: client/src/utils/filter-engine.ts
// PURPOSE: Client-side filter condition evaluation on enriched entity list
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: filterEntities

import type { EntityListItem } from '@shared/types/dashboard';
import type { FilterField, FilterOperator } from './filter-types';

export interface FilterCondition {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string | number;
  conjunction: 'and' | 'or';
}

/** Apply active filter conditions to entity list — spec Section 13.3 */
export function filterEntities(
  entities: EntityListItem[],
  conditions: FilterCondition[],
): EntityListItem[] {
  const active = conditions.filter(c => c.field && c.operator && c.value !== '');
  if (active.length === 0) return entities;

  return entities.filter(entity => {
    let result = evaluateCondition(entity, active[0]);
    for (let i = 1; i < active.length; i++) {
      const matches = evaluateCondition(entity, active[i]);
      result = active[i].conjunction === 'or'
        ? result || matches
        : result && matches;
    }
    return result;
  });
}

function evaluateCondition(entity: EntityListItem, cond: FilterCondition): boolean {
  const fieldValue = getFieldValue(entity, cond.field);
  if (cond.operator === 'is_empty') {
    return fieldValue === null || fieldValue === undefined || fieldValue === '';
  }

  const condValue = typeof cond.value === 'string' ? parseFloat(cond.value) || cond.value : cond.value;

  switch (cond.operator) {
    case 'gt':
      return typeof fieldValue === 'number' && fieldValue > (condValue as number);
    case 'lt':
      return typeof fieldValue === 'number' && fieldValue < (condValue as number);
    case 'gte':
      return typeof fieldValue === 'number' && fieldValue >= (condValue as number);
    case 'lte':
      return typeof fieldValue === 'number' && fieldValue <= (condValue as number);
    case 'equals':
      return String(fieldValue).toLowerCase() === String(condValue).toLowerCase();
    case 'not_equals':
      return String(fieldValue).toLowerCase() !== String(condValue).toLowerCase();
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(condValue).toLowerCase());
    case 'is_before':
      return fieldValue !== null && new Date(String(fieldValue)) < new Date(String(condValue));
    case 'is_after':
      return fieldValue !== null && new Date(String(fieldValue)) > new Date(String(condValue));
    case 'between': {
      const parts = String(condValue).split(',');
      if (parts.length !== 2) return true;
      const [min, max] = parts.map(s => parseFloat(s.trim()));
      return typeof fieldValue === 'number' && fieldValue >= min && fieldValue <= max;
    }
    default:
      return true;
  }
}

/** WHY: Direct property access from enriched EntityListItem — no label translation needed */
function getFieldValue(entity: EntityListItem, field: FilterField): number | string | null {
  const map: Record<FilterField, number | string | null> = {
    revenue: entity.revenue,
    orderCount: entity.orderCount,
    avgOrder: entity.avgOrder,
    marginPercent: entity.marginPercent,
    frequency: entity.frequency,
    lastOrderDate: entity.lastOrderDate,
    name: entity.name,
    rep: entity.rep,
    zone: entity.zone,
    customerType: entity.customerType,
  };
  return map[field] ?? null;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd client && npx tsc -b --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add client/src/utils/filter-engine.ts
git commit -m "fix(client): rewrite filter engine with correct operators + all 10 fields (I3, I4)"
```

---

### Task 8: Complete Sort Engine + Refactor useSort

**Fixes:** Sort engine only has 3/8 fields, I5 (useSort stale closure)

**Files:**
- Modify: `client/src/utils/sort-engine.ts`
- Modify: `client/src/hooks/useSort.ts`

- [ ] **Step 1: Complete sort-engine.ts**

Replace `client/src/utils/sort-engine.ts`:

```typescript
// FILE: client/src/utils/sort-engine.ts
// PURPOSE: Client-side sort with field accessors for enriched entity list
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: sortEntities

import type { EntityListItem } from '@shared/types/dashboard';
import type { SortField, SortDirection } from '../hooks/useSort';

/** Sort entities by the specified field and direction — spec Section 15.4 */
export function sortEntities(
  entities: EntityListItem[],
  field: SortField,
  direction: SortDirection,
): EntityListItem[] {
  const getValue = (e: EntityListItem): number | string => {
    switch (field) {
      case 'name':
        return e.name.toLowerCase();
      case 'revenue':
        return e.revenue;
      case 'orders':
        return e.orderCount;
      case 'avgOrder':
        return e.avgOrder;
      case 'marginPercent':
        return e.marginPercent;
      case 'frequency':
        return e.frequency ?? -Infinity; // WHY: null sorts last
      case 'lastOrder':
        return e.lastOrderDate ? new Date(e.lastOrderDate).getTime() : -Infinity;
      default:
        return e.revenue;
    }
  };

  return [...entities].sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return direction === 'asc' ? cmp : -cmp;
  });
}
```

- [ ] **Step 2: Refactor useSort to useReducer**

Replace `client/src/hooks/useSort.ts`:

```typescript
// FILE: client/src/hooks/useSort.ts
// PURPOSE: Sort field + direction state — spec Section 15.4
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useSort, SortField, SortDirection

import { useReducer, useCallback } from 'react';

export type SortField =
  | 'name'
  | 'revenue'
  | 'orders'
  | 'avgOrder'
  | 'marginPercent'
  | 'frequency'
  | 'lastOrder';

export type SortDirection = 'asc' | 'desc';

interface SortState {
  field: SortField;
  direction: SortDirection;
}

type SortAction =
  | { type: 'toggle'; field: SortField }
  | { type: 'reset' };

const INITIAL_STATE: SortState = { field: 'revenue', direction: 'desc' };

// WHY: useReducer instead of two useState calls eliminates stale closure risk
// where setSortDirection was called inside setSortField's updater function.
function sortReducer(state: SortState, action: SortAction): SortState {
  switch (action.type) {
    case 'toggle':
      if (state.field === action.field) {
        return { ...state, direction: state.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field: action.field, direction: 'desc' };
    case 'reset':
      return INITIAL_STATE;
  }
}

export function useSort() {
  const [state, dispatch] = useReducer(sortReducer, INITIAL_STATE);

  const setSort = useCallback((field: SortField) => {
    dispatch({ type: 'toggle', field });
  }, []);

  const resetSort = useCallback(() => {
    dispatch({ type: 'reset' });
  }, []);

  return { sortField: state.field, sortDirection: state.direction, setSort, resetSort };
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd client && npx tsc -b --noEmit
```

Note: `outstanding` was removed from `SortField`. If any file references it, TypeScript will catch it. Fix by removing the reference.

- [ ] **Step 4: Commit**

```bash
git add client/src/utils/sort-engine.ts client/src/hooks/useSort.ts
git commit -m "fix(client): complete sort engine + refactor useSort to useReducer (I5)"
```

---

### Task 9: Update FilterCondition, FilterPanel, useFilters

**Fixes:** Align UI components with new filter types

**Files:**
- Modify: `client/src/components/left-panel/FilterCondition.tsx`
- Modify: `client/src/components/left-panel/FilterPanel.tsx`
- Modify: `client/src/hooks/useFilters.ts`

- [ ] **Step 1: Update FilterCondition.tsx**

In `client/src/components/left-panel/FilterCondition.tsx`, replace the type definitions and options:

Replace lines 9-51 (types + FIELD_OPTIONS + OPERATOR_OPTIONS) with:

```typescript
import {
  type FilterField, type FilterOperator,
  FIELD_LABELS, OPERATOR_LABELS, FIELD_TYPES, OPERATORS_BY_TYPE,
} from '../../utils/filter-types';

export interface FilterConditionData {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string;
}
```

Replace the two `<select>` bodies:

For field dropdown, replace the static `FIELD_OPTIONS.map(...)` with a prop-driven list:

Add `availableFields: FilterField[]` to `FilterConditionProps`.

For operator dropdown, make it dynamic based on selected field type:

```typescript
const fieldType = FIELD_TYPES[condition.field];
const operatorOptions = OPERATORS_BY_TYPE[fieldType];
```

Then in the operator `<select>`:
```typescript
{operatorOptions.map((op) => (
  <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
))}
```

And in the field `<select>`:
```typescript
{availableFields.map((f) => (
  <option key={f} value={f}>{FIELD_LABELS[f]}</option>
))}
```

- [ ] **Step 2: Simplify FilterPanel.tsx adapter**

In `client/src/components/left-panel/FilterPanel.tsx`:

Remove the `toConditionData` function (lines 28-35). The adapter is no longer needed because hook types now match component types.

Import `DIMENSION_FILTER_FIELDS` from filter-types and pass `activeDimension` as a prop:

Add to `FilterPanelProps`:
```typescript
  activeDimension: Dimension;
```

Compute available fields:
```typescript
const availableFields = DIMENSION_FILTER_FIELDS[activeDimension];
```

Pass to each `FilterConditionRow`:
```typescript
<FilterConditionRow
  condition={condition as FilterConditionData}
  availableFields={availableFields}
  onChange={(updated) => handleUpdate(condition.id, updated)}
  onRemove={() => handleRemove(condition.id)}
/>
```

- [ ] **Step 3: Type-tighten useFilters.ts**

In `client/src/hooks/useFilters.ts`, update `FilterCondition` to use the typed fields:

```typescript
import type { FilterField, FilterOperator } from '../utils/filter-types';

export interface FilterCondition {
  id: string;
  field: FilterField | '';
  operator: FilterOperator | '';
  value: string | number;
  conjunction: 'and' | 'or';
}
```

WHY `| ''`: Empty string represents "not yet selected" state in a new condition.

- [ ] **Step 4: Update useDashboardState to bridge types**

In `client/src/hooks/useDashboardState.ts`, the `filterEntities` call passes hook conditions (which have `field: FilterField | ''`) to the engine (which expects `field: FilterField`). The engine's internal `active` filter already skips empty fields, but TypeScript doesn't know that.

Fix: Cast the conditions when passing to `filterEntities`, or better, filter out incomplete conditions first:

```typescript
const completeConditions = conditions.filter(
  (c): c is FilterCondition & { field: FilterField; operator: FilterOperator } =>
    c.field !== '' && c.operator !== '',
);
if (completeConditions.length > 0) entities = filterEntities(entities, completeConditions);
```

Import `FilterField`, `FilterOperator` from `'../utils/filter-types'`.

- [ ] **Step 5: Verify it compiles**

```bash
cd client && npx tsc -b --noEmit
```

Fix any type mismatches that TypeScript catches.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/left-panel/FilterCondition.tsx client/src/components/left-panel/FilterPanel.tsx client/src/hooks/useFilters.ts
git commit -m "fix(client): align filter UI types with engine, add field-type-aware operators"
```

---

### Task 10: Fix SearchBox Debounce

**Fixes:** I6 (onChange in effect dependency array)

**Files:**
- Modify: `client/src/components/left-panel/SearchBox.tsx`

- [ ] **Step 1: Fix the debounce**

In `client/src/components/left-panel/SearchBox.tsx`:

Add `useRef` to imports:
```typescript
import { useState, useEffect, useRef } from 'react';
```

Add ref before the effects:
```typescript
  // WHY: Store onChange in a ref so the debounce timer only restarts when localValue changes,
  // not when the parent re-renders with a new function reference.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
```

Replace the second `useEffect` (lines 23-32):
```typescript
  useEffect(() => {
    if (localValue === value) return;
    if (!localValue) {
      onChangeRef.current('');
      return;
    }
    const timer = setTimeout(() => onChangeRef.current(localValue), 300);
    return () => clearTimeout(timer);
  }, [localValue, value]);
```

- [ ] **Step 2: Verify it compiles**

```bash
cd client && npx tsc -b --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/left-panel/SearchBox.tsx
git commit -m "fix(client): SearchBox debounce uses ref for stable onChange (I6)"
```

---

## Area 4: Client Rendering

### Task 11: Memoize useEntitySelection + Sparkline useId

**Fixes:** C1 (array spread every render), I8 (random gradient ID)

**Files:**
- Modify: `client/src/hooks/useEntitySelection.ts`
- Modify: `client/src/components/right-panel/Sparkline.tsx`

- [ ] **Step 1: Memoize selectedIds in useEntitySelection.ts**

Add `useMemo` to imports:
```typescript
import { useState, useCallback, useMemo } from 'react';
```

Replace line 54 (`selectedIds: [...selectedIds],`) with a memoized version. Before the `return` statement, add:

```typescript
  // WHY: Without useMemo, [...selectedIds] creates a new array on every render,
  // defeating React.memo on every downstream component that receives this prop.
  const selectedIdsArray = useMemo(() => [...selectedIds], [selectedIds]);
```

In the return object, change:
```typescript
    selectedIds: selectedIdsArray,
```

- [ ] **Step 2: Fix Sparkline gradient ID**

In `client/src/components/right-panel/Sparkline.tsx`, add import:
```typescript
import { useId } from 'react';
```

Replace line 41:
```typescript
  const gradientId = `sparkline-grad-${Math.random().toString(36).slice(2, 8)}`;
```
With:
```typescript
  const id = useId();
  const gradientId = `sparkline-grad-${id}`;
```

- [ ] **Step 3: Verify it compiles**

```bash
cd client && npx tsc -b --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useEntitySelection.ts client/src/components/right-panel/Sparkline.tsx
git commit -m "fix(client): memoize selectedIds array (C1), useId for sparkline (I8)"
```

---

### Task 12: Error Boundary + Export Button Fix

**Fixes:** M8 (no error boundary), I10 (missing type="button")

**Files:**
- Create: `client/src/components/shared/ErrorBoundary.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/right-panel/DetailHeader.tsx`

- [ ] **Step 1: Create ErrorBoundary.tsx**

Create `client/src/components/shared/ErrorBoundary.tsx`:

```typescript
// FILE: client/src/components/shared/ErrorBoundary.tsx
// PURPOSE: Catch React runtime errors and show a fallback UI instead of white screen
// USED BY: client/src/App.tsx
// EXPORTS: ErrorBoundary

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// WHY: React error boundaries must be class components — no hook equivalent exists.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-[var(--color-bg-page)]">
          <div className="max-w-[400px] rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] p-[var(--spacing-4xl)] text-center shadow-[var(--shadow-card)]">
            <h2 className="text-[18px] font-bold text-[var(--color-text-primary)]">
              Something went wrong
            </h2>
            <p className="mt-[var(--spacing-md)] text-[13px] text-[var(--color-text-muted)]">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-[var(--spacing-xl)] rounded-[var(--radius-base)] bg-[var(--color-dark)] px-[var(--spacing-2xl)] py-[var(--spacing-md)] text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-dark-hover)]"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Wrap App with ErrorBoundary**

In `client/src/App.tsx`, add import:
```typescript
import { ErrorBoundary } from './components/shared/ErrorBoundary';
```

Wrap the return of `App()`:
```typescript
export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <DashboardApp />
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 3: Add type="button" to Export button**

In `client/src/components/right-panel/DetailHeader.tsx`, line 53, add `type="button"`:

```typescript
        <button
          type="button"
          onClick={onExport}
```

- [ ] **Step 4: Verify it compiles**

```bash
cd client && npx tsc -b --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/shared/ErrorBoundary.tsx client/src/App.tsx client/src/components/right-panel/DetailHeader.tsx
git commit -m "feat(client): add ErrorBoundary (M8), fix Export button type (I10)"
```

---

## Area 5: Cleanup

### Task 13: Remove .js Artifacts + Badge + Unused Props

**Fixes:** I1 (.js artifacts), M2 (unused isConsolidated), M3 (unused Badge), M6 (unknown meta type)

**Files:**
- Modify: `.gitignore`
- Delete: `client/src/components/shared/Badge.tsx` + `Badge.js`
- Delete: 35 `.js` files in `client/src/` and `shared/`
- Modify: `client/src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Add .js exclusion to .gitignore**

Add to `.gitignore`:
```
# Compiled output alongside source (only dist/ should have .js)
client/src/**/*.js
shared/**/*.js
```

- [ ] **Step 2: Remove tracked .js files**

```bash
git rm client/src/**/*.js shared/**/*.js
```

This removes them from git tracking AND deletes from disk.

- [ ] **Step 3: Delete Badge component**

```bash
git rm client/src/components/shared/Badge.tsx
```

(Badge.js was already removed in Step 2.)

Verify no remaining imports:
```bash
grep -rn "Badge" client/src/ --include="*.tsx" --include="*.ts"
```
Expected: zero matches (or only the git rm output).

- [ ] **Step 4: Remove unused isConsolidated from DashboardLayout**

First, check if `isConsolidated` is used anywhere:
```bash
grep -rn "isConsolidated" client/src/
```

If only in `useEntitySelection.ts` (where it's computed) and `DashboardLayoutProps` (where it's declared but unused in the template), remove:

1. Remove `isConsolidated: boolean;` from `DashboardLayoutProps` in `DashboardLayout.tsx`
2. Remove `isConsolidated` from the destructuring in the component
3. If `useDashboardState` exposes it, check if any consumer uses it. If not, remove from there too.

- [ ] **Step 5: Type the meta prop properly**

In `client/src/layouts/DashboardLayout.tsx`, replace `meta: unknown` with:

```typescript
interface DashboardMeta {
  cached: boolean;
  cachedAt: string | null;
  period: string;
  dimension: string;
  entityCount: number;
}
```

And update the props type: `meta: DashboardMeta | undefined`.

- [ ] **Step 6: Verify it compiles**

```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove .js artifacts, unused Badge, unused props (I1, M2, M3, M6)"
```

---

### Task 14: Magic Hex Values to Design Tokens

**Fixes:** M1 (hardcoded hex colors)

**Files:**
- Modify: `client/src/components/right-panel/HeroRevenueCard.tsx`
- Modify: `client/src/components/right-panel/KPICard.tsx`
- Modify: `client/src/components/right-panel/KPISection.tsx`
- Modify: `client/src/components/right-panel/YoYBarChart.tsx`

- [ ] **Step 1: Replace hex values in HeroRevenueCard.tsx**

Find all `#888` and replace with `var(--color-text-muted)`:

```bash
# Preview changes
grep -n "#888" client/src/components/right-panel/HeroRevenueCard.tsx
```

Replace each occurrence in className strings.

- [ ] **Step 2: Replace hex values in KPICard.tsx**

Replace `#888` with `var(--color-text-muted)`.

- [ ] **Step 3: Replace hex values in KPISection.tsx**

Token mapping:
- `'#999'` → `'var(--color-text-muted)'`
- `'#22c55e'` → `'var(--color-green)'`
- `'#b8a88a'` → `'var(--color-gold-primary)'`
- `'#eab308'` → `'var(--color-yellow)'`
- `'#ef4444'` → `'var(--color-red)'`

In the status color function, replace inline hex strings with CSS variable strings.

Note: For colors used in inline `style={{ color: ... }}`, CSS variables work: `style={{ color: 'var(--color-green)' }}`.

For SVG `fill` attributes, CSS variables also work: `fill="var(--color-gold-muted)"`.

- [ ] **Step 4: Replace hex values in YoYBarChart.tsx**

Token mapping:
- `fill="#e8e0d0"` → `fill="var(--color-gold-muted)"`
- `fill="#d4c5a9"` → `fill="var(--color-gold-light)"`
- `fill="#bbb"` → `fill="var(--color-text-faint)"`
- `#888` → `var(--color-text-muted)`

- [ ] **Step 5: Verify no remaining magic hex in components**

```bash
grep -rn '#[0-9a-fA-F]\{3,6\}' client/src/components/
```

Expected: zero matches. Only `client/src/styles/index.css` should contain hex values (in CSS custom property definitions).

- [ ] **Step 6: Verify it compiles + visual check**

```bash
cd client && npx tsc -b --noEmit && npx vite build
```

- [ ] **Step 7: Commit**

```bash
git add client/src/components/right-panel/HeroRevenueCard.tsx client/src/components/right-panel/KPICard.tsx client/src/components/right-panel/KPISection.tsx client/src/components/right-panel/YoYBarChart.tsx
git commit -m "style: replace magic hex colors with design tokens (M1)"
```

---

## Final Verification

### Task 15: Full Verification Pass

**Files:** None (verification only)

- [ ] **Step 1: TypeScript compilation**

```bash
cd server && npx tsc --noEmit
cd ../client && npx tsc -b --noEmit
```
Expected: zero errors on both.

- [ ] **Step 2: Server tests**

```bash
cd server && npx vitest run
```
Expected: all tests pass.

- [ ] **Step 3: Client build**

```bash
cd client && npx vite build
```
Expected: builds successfully, bundle < 500KB gzip.

- [ ] **Step 4: Code quality checks**

```bash
# No any types
grep -rn ": any\|as any" server/src/ client/src/

# No new PriorityClient in routes
grep -rn "new PriorityClient" server/src/routes/

# No magic hex in components
grep -rn '#[0-9a-fA-F]\{3,6\}' client/src/components/

# No files over 200 lines
find client/src server/src shared -name "*.ts" -o -name "*.tsx" | xargs wc -l | awk '$1 > 200'

# No stale .js alongside .ts
find client/src shared -name "*.js" | head -5
```
Expected: zero matches on all.

- [ ] **Step 5: Railway deployment checks**

```bash
# cors in dependencies
node -e "const p=require('./server/package.json'); console.log(p.dependencies.cors ? 'OK' : 'FAIL')"

# No unresolved @shared in server output
cd server && npm run build && grep -r "@shared" dist/ && echo "FAIL" || echo "OK"

# railway.json exists
test -f railway.json && echo "OK" || echo "FAIL"
```
Expected: all OK.

- [ ] **Step 6: Commit final state**

If any fixes were needed during verification:
```bash
git add -A
git commit -m "fix: address verification findings"
```
