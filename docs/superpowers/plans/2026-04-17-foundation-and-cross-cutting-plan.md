# Foundation & Cross-Cutting Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship all dashboard improvements from the 2026-04-17 spec EXCEPT the Product Family migration (which has its own plan). This includes diagnostics, prev-year backend enrichment, UI polish (hide toggle, search by ID, Orders column, Reports exit button, time-range tabs), Products filter + country of origin, contacts grouping redesign, KPI modal redesign, and vendor prev-year verification.

**Architecture:** Server-side enrichment in `dimension-grouper.ts` + `dimension-grouper-items.ts` for prev-year metrics. Client-side UI rewires using existing period state (hidden but live). Shared `TrendArrow` + `GroupedContactsTable` components introduced. Data shape changes surface in `shared/types/dashboard.ts`.

**Tech Stack:** Express + TypeScript, React 19 + Vite, Tailwind CSS v4, Framer Motion, TanStack Query v5, Vitest, Upstash Redis. Priority ERP read-only oData.

**Reference spec:** `docs/specs/2026-04-17-all-dimensions-review-design.md` (v2).

**Critical guardrail:** Priority ERP is **read-only**. No POST/PUT/PATCH/DELETE to Priority. Test customer `C7826`.

---

## Pre-flight — Live diagnostics (Task 0)

These are READ-ONLY live Priority queries that gate downstream code work. Run them FIRST. If they surface data issues, pause and escalate before writing code.

### Task 0.A: Verify `Y_5380_5_ESH` is queryable on LOGPART

**Why:** The field is in the XML metadata, but we recently hit the `Y_9952_5_ESH` trap where an XML-listed field returned HTTP 400 on live LOGPART queries. Verify before committing to it in §5.6.2.

- [ ] **Step 1: Run live query**

Run:
```bash
cd "server" && npx tsx -e "
import { getPriorityClient } from './src/services/priority-client.js';
const client = getPriorityClient();
const rows = await client.fetchAllPages('LOGPART', {
  select: 'PARTNAME,Y_5380_5_ESH',
  filter: \"STATDES eq 'In Use'\",
  top: 5,
});
console.log(JSON.stringify(rows, null, 2));
"
```

Expected: HTTP 200 with 5 rows, each row has a `Y_5380_5_ESH` value (string or null).
If HTTP 400: the field is not queryable on LOGPART → halt and report to user. Fall-back plan: inspect `tools/Priority ERP March 30.xml` for a SPEC field holding country data.

- [ ] **Step 2: Capture finding**

Create `learnings/logpart-country-of-origin-field.md` with the query and result (working or broken).

### Task 0.B: Investigate Zones — SF North / SF East missing

- [ ] **Step 1: Query DISTRLINES for SF zones**

Run:
```bash
cd "server" && npx tsx -e "
import { getPriorityClient } from './src/services/priority-client.js';
const client = getPriorityClient();
const rows = await client.fetchAllPages('DISTRLINES', {
  select: 'DISTRLINECODE,DISTRLINEDES,ZONECODE,ZONEDES',
  filter: \"contains(ZONEDES, 'SF')\",
  top: 50,
});
console.log(JSON.stringify(rows, null, 2));
"
```

- [ ] **Step 2: Branch on result**

- If rows contain SF North / SF East: verify they aren't filtered by dedup in `server/src/services/entity-list-builder.ts` lines 68-71. Document finding.
- If rows empty or missing: query without filter, search manually, check for `INACTIVE` flag.
- If still missing from Priority entirely: halt and report to user.

- [ ] **Step 3: Capture finding**

Create `learnings/zones-fetch-investigation.md` with the query, result, and root cause.

---

## Task 1: Extract `computeMetrics` helper (prev-year unit of computation)

**Files:**
- Create: `server/src/services/__tests__/compute-metrics.test.ts`
- Create: `server/src/services/prev-year-metrics.ts`

**Why:** All six metrics (revenue / orderCount / avgOrder / marginPercent / marginAmount / frequency) need to be computed for three windows (current / prev-same-period / prev-full). Extracting a pure function keeps `dimension-grouper.ts` under 300 LOC and enables the tests we'll write in later tasks.

- [ ] **Step 1: Write failing test for computeMetrics**

```typescript
// server/src/services/__tests__/compute-metrics.test.ts
import { describe, it, expect } from 'vitest';
import { computeMetrics } from '../prev-year-metrics.js';

describe('computeMetrics', () => {
  it('computes all six metrics for a set of order items', () => {
    const items = [
      { orderId: 'O1', amount: 100, cost: 60 },
      { orderId: 'O1', amount: 200, cost: 150 },
      { orderId: 'O2', amount: 300, cost: 200 },
    ];
    const windowDays = 30;
    const result = computeMetrics(items, windowDays);
    expect(result.revenue).toBe(600);
    expect(result.orderCount).toBe(2); // distinct orders
    expect(result.avgOrder).toBe(300);
    expect(result.marginAmount).toBe(190); // 600 - 410
    expect(result.marginPercent).toBeCloseTo(31.666, 2);
    expect(result.frequency).toBeCloseTo(2 / 30, 5);
  });

  it('returns null metrics when items empty', () => {
    const result = computeMetrics([], 30);
    expect(result.revenue).toBeNull();
    expect(result.orderCount).toBeNull();
    expect(result.avgOrder).toBeNull();
    expect(result.marginAmount).toBeNull();
    expect(result.marginPercent).toBeNull();
    expect(result.frequency).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/services/__tests__/compute-metrics.test.ts`
Expected: FAIL — "Cannot find module '../prev-year-metrics.js'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// server/src/services/prev-year-metrics.ts
/**
 * FILE: server/src/services/prev-year-metrics.ts
 * PURPOSE: Pure metric-computation helper shared by current-window and prev-year
 *          aggregations in dimension-grouper.ts. One pass per window → 6 metrics.
 * USED BY: dimension-grouper.ts, dimension-grouper-items.ts
 * EXPORTS: computeMetrics, MetricsSnapshot
 */

export interface MetricItem {
  orderId: string;
  amount: number;
  cost: number;
}

export interface MetricsSnapshot {
  revenue: number | null;
  orderCount: number | null;
  avgOrder: number | null;
  marginAmount: number | null;
  marginPercent: number | null;
  frequency: number | null;
}

/** WHY null-valued fields for empty windows: distinguishes "no activity" from "zero". */
export function computeMetrics(items: MetricItem[], windowDays: number): MetricsSnapshot {
  if (items.length === 0) {
    return {
      revenue: null, orderCount: null, avgOrder: null,
      marginAmount: null, marginPercent: null, frequency: null,
    };
  }
  const revenue = items.reduce((sum, it) => sum + it.amount, 0);
  const totalCost = items.reduce((sum, it) => sum + it.cost, 0);
  const orderIds = new Set(items.map((it) => it.orderId));
  const orderCount = orderIds.size;
  const avgOrder = orderCount > 0 ? revenue / orderCount : null;
  const marginAmount = revenue - totalCost;
  const marginPercent = revenue > 0 ? (marginAmount / revenue) * 100 : null;
  const frequency = windowDays > 0 ? orderCount / windowDays : null;
  return { revenue, orderCount, avgOrder, marginAmount, marginPercent, frequency };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/services/__tests__/compute-metrics.test.ts`
Expected: PASS, both test cases green.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/prev-year-metrics.ts server/src/services/__tests__/compute-metrics.test.ts
git commit -m "feat(server): add computeMetrics helper for per-entity metric aggregation"
```

---

## Task 2: Extend `EntityListItem` with 10 new prev-year fields

**Files:**
- Modify: `shared/types/dashboard.ts`
- Test: no new test; type-only change verified by downstream tests failing until populated.

- [ ] **Step 1: Add fields to EntityListItem**

Open `shared/types/dashboard.ts` and locate the `EntityListItem` interface. After the existing `prevYearRevenue` / `prevYearRevenueFull` fields, add:

```typescript
  // WHY per-metric prev-year: per-customer KPI modal (PerCustomerKPITable)
  // renders YTD value + LY same-period + LY full year for every card type.
  // All produced by groupByDimension, not data-aggregator.
  prevYearOrderCount: number | null;
  prevYearOrderCountFull: number | null;
  prevYearAvgOrder: number | null;
  prevYearAvgOrderFull: number | null;
  prevYearMarginPercent: number | null;
  prevYearMarginPercentFull: number | null;
  prevYearMarginAmount: number | null;
  prevYearMarginAmountFull: number | null;
  prevYearFrequency: number | null;
  prevYearFrequencyFull: number | null;
```

- [ ] **Step 2: Verify client TypeScript still compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS. Server will fail in Task 3 until we populate the fields.

- [ ] **Step 3: Commit**

```bash
git add shared/types/dashboard.ts
git commit -m "feat(types): add 10 per-metric prev-year fields to EntityListItem"
```

---

## Task 3: Wire prev-year metrics into `groupByDimension` (customer + zone)

**Files:**
- Modify: `server/src/services/dimension-grouper.ts`
- Create: `server/src/services/__tests__/dimension-grouper-prev-year.test.ts`

- [ ] **Step 1: Write failing test covering all 18 prev-year fields**

```typescript
// server/src/services/__tests__/dimension-grouper-prev-year.test.ts
import { describe, it, expect } from 'vitest';
import { groupByDimension } from '../dimension-grouper.js';
import type { RawOrder, RawCustomer } from '../../../../shared/types/dashboard.js';

const CUSTOMERS: RawCustomer[] = [
  { CUSTNAME: 'C1', CUSTDES: 'Customer One', ZONECODE: 'Z1', ZONEDES: 'Zone 1',
    STATDES: 'Active', INACTIVE: '', CURRNCY: 'USD', PHONE: '', EMAIL: '' } as RawCustomer,
];

function mkOrder(ordname: string, date: string, total: number, cost: number): RawOrder {
  return {
    ORDNAME: ordname, CUSTNAME: 'C1', CURDATE: date,
    TOTPRICE: total, TOTCOST: cost, STATDES: 'Closed',
    ORDERITEMS_SUBFORM: [
      { PARTNAME: 'P1', PDES: 'Part', TQUANT: 1, PRICE: total, QUANTCOST: cost,
        Y_1530_5_ESH: 'VendorA', Y_1159_5_ESH: 'V1', Y_9952_5_ESH: 'BrandA',
        Y_3020_5_ESH: '01', Y_3021_5_ESH: 'TypeA', Y_5380_5_ESH: 'USA' },
    ],
  } as unknown as RawOrder;
}

describe('groupByDimension — per-metric prev-year fields', () => {
  it('populates all 18 prev-year fields for the customer dimension', () => {
    const today = new Date('2026-04-17');
    // Current YTD: 2 orders
    const ordersCurrent = [
      mkOrder('OC1', '2026-02-01', 1000, 600),
      mkOrder('OC2', '2026-03-01', 2000, 1200),
    ];
    // Prev-year same period (2025-01-01 to 2025-04-17): 1 order
    const ordersPrevSame = [
      mkOrder('OP1', '2025-02-15', 500, 300),
    ];
    // Prev-year full (2025): 3 orders
    const ordersPrevFull = [
      mkOrder('OP1', '2025-02-15', 500, 300),
      mkOrder('OP2', '2025-06-10', 800, 500),
      mkOrder('OP3', '2025-11-20', 700, 400),
    ];

    const result = groupByDimension(
      'customer',
      ordersCurrent,
      CUSTOMERS,
      /* periodMonths */ 12,
      { today, prevSame: ordersPrevSame, prevFull: ordersPrevFull },
    );

    expect(result).toHaveLength(1);
    const row = result[0];
    // current
    expect(row.revenue).toBe(3000);
    expect(row.orderCount).toBe(2);
    // prev same-period
    expect(row.prevYearRevenue).toBe(500);
    expect(row.prevYearOrderCount).toBe(1);
    expect(row.prevYearAvgOrder).toBe(500);
    expect(row.prevYearMarginAmount).toBe(200);
    expect(row.prevYearMarginPercent).toBeCloseTo(40, 2);
    expect(row.prevYearFrequency).not.toBeNull();
    // prev full-year
    expect(row.prevYearRevenueFull).toBe(2000);
    expect(row.prevYearOrderCountFull).toBe(3);
    expect(row.prevYearAvgOrderFull).toBeCloseTo(666.667, 2);
    expect(row.prevYearMarginAmountFull).toBe(800);
    expect(row.prevYearMarginPercentFull).toBeCloseTo(40, 2);
    expect(row.prevYearFrequencyFull).not.toBeNull();
  });

  it('returns null prev-year fields when customer has no prev-year activity', () => {
    const today = new Date('2026-04-17');
    const ordersCurrent = [mkOrder('OC1', '2026-02-01', 1000, 600)];
    const result = groupByDimension('customer', ordersCurrent, CUSTOMERS, 12,
      { today, prevSame: [], prevFull: [] });
    const row = result[0];
    expect(row.prevYearRevenue).toBeNull();
    expect(row.prevYearOrderCount).toBeNull();
    expect(row.prevYearAvgOrder).toBeNull();
    expect(row.prevYearMarginAmount).toBeNull();
    expect(row.prevYearMarginPercent).toBeNull();
    expect(row.prevYearFrequency).toBeNull();
    expect(row.prevYearRevenueFull).toBeNull();
    expect(row.prevYearOrderCountFull).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/services/__tests__/dimension-grouper-prev-year.test.ts`
Expected: FAIL — the new prev-year fields are undefined on the returned rows, AND the 4th/5th argument shape doesn't match the current `groupByDimension` signature.

- [ ] **Step 3: Read current groupByDimension signature**

Open `server/src/services/dimension-grouper.ts` and read lines 1-100. Identify:
- Current export signature: `groupByDimension(dimension, orders, customers, periodMonths)`
- How prev-year revenue is currently computed (should be via a `PrevYearTotals` helper).

- [ ] **Step 4: Generalize `PrevYearTotals` and accept prev-window data**

Modify `dimension-grouper.ts`. Replace the existing `PrevYearTotals` type with:

```typescript
import { computeMetrics, type MetricsSnapshot, type MetricItem } from './prev-year-metrics.js';

export interface PrevYearTotals {
  // Keyed by entity id (CUSTNAME, ZONECODE, vendor code, etc.)
  samePeriod: Map<string, MetricsSnapshot>;
  full: Map<string, MetricsSnapshot>;
}

// WHY this signature change: callers pass the prev-year order slices directly.
// Previously the grouper re-computed windows; now computation is the caller's job
// so each dimension can reuse the same cached order slices.
export interface PrevYearInput {
  today: Date;
  prevSame: RawOrder[];
  prevFull: RawOrder[];
}
```

Add a helper in the same file:

```typescript
function buildPrevYearTotals(
  input: PrevYearInput,
  keyFn: (o: RawOrder) => string,
  toMetricItems: (o: RawOrder) => MetricItem[],
  samePeriodDays: number,
): PrevYearTotals {
  const group = (orders: RawOrder[], windowDays: number) => {
    const bucket = new Map<string, MetricItem[]>();
    for (const o of orders) {
      const key = keyFn(o);
      const arr = bucket.get(key) ?? [];
      arr.push(...toMetricItems(o));
      bucket.set(key, arr);
    }
    const out = new Map<string, MetricsSnapshot>();
    for (const [k, items] of bucket) out.set(k, computeMetrics(items, windowDays));
    return out;
  };
  return {
    samePeriod: group(input.prevSame, samePeriodDays),
    full: group(input.prevFull, 365),
  };
}
```

- [ ] **Step 5: Extend groupByDimension customer + zone branches**

In the customer branch, after building the current entity list, enrich each row with the 10 new prev-year fields:

```typescript
const samePeriodDays = /* compute from today minus start-of-YTD */;
const totals = buildPrevYearTotals(
  prevInput,
  (o) => o.CUSTNAME,
  (o) => (o.ORDERITEMS_SUBFORM ?? []).map(it => ({
    orderId: o.ORDNAME,
    amount: Number(it.PRICE) * Number(it.TQUANT),
    cost: Number(it.QUANTCOST) * Number(it.TQUANT),
  })),
  samePeriodDays,
);

// After building each EntityListItem (existing code path):
const same = totals.samePeriod.get(row.id) ?? null;
const full = totals.full.get(row.id) ?? null;
row.prevYearRevenue = same?.revenue ?? null;
row.prevYearOrderCount = same?.orderCount ?? null;
row.prevYearAvgOrder = same?.avgOrder ?? null;
row.prevYearMarginPercent = same?.marginPercent ?? null;
row.prevYearMarginAmount = same?.marginAmount ?? null;
row.prevYearFrequency = same?.frequency ?? null;
row.prevYearRevenueFull = full?.revenue ?? null;
row.prevYearOrderCountFull = full?.orderCount ?? null;
row.prevYearAvgOrderFull = full?.avgOrder ?? null;
row.prevYearMarginPercentFull = full?.marginPercent ?? null;
row.prevYearMarginAmountFull = full?.marginAmount ?? null;
row.prevYearFrequencyFull = full?.frequency ?? null;
```

Do the same for the zone branch (change keyFn to `o.ZONECODE` with fallback to customer's zone).

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx vitest run src/services/__tests__/dimension-grouper-prev-year.test.ts`
Expected: PASS for both test cases.

- [ ] **Step 7: Run full server test suite**

Run: `cd server && npx vitest run`
Expected: PASS. Any callers of `groupByDimension` that don't yet pass `PrevYearInput` must be updated — fix by making the parameter optional and returning nulls when absent:

```typescript
export function groupByDimension(
  dimension: Dimension,
  orders: RawOrder[],
  customers: RawCustomer[],
  periodMonths: number,
  prevInput?: PrevYearInput,
): EntityListItem[] {
  // ...
  const totals = prevInput
    ? buildPrevYearTotals(prevInput, keyFn, toItems, samePeriodDays)
    : { samePeriod: new Map(), full: new Map() };
  // ...
}
```

Re-run `npx vitest run` → PASS.

- [ ] **Step 8: Commit**

```bash
git add server/src/services/dimension-grouper.ts server/src/services/__tests__/dimension-grouper-prev-year.test.ts
git commit -m "feat(server): compute per-metric prev-year fields in groupByDimension (customer+zone)"
```

---

## Task 4: Wire prev-year metrics into per-item groupers (vendor / brand / product_type / product)

**Files:**
- Modify: `server/src/services/dimension-grouper-items.ts`
- Modify: `server/src/services/__tests__/dimension-grouper-prev-year.test.ts` (extend)

- [ ] **Step 1: Extend the test file with per-dimension assertions**

Append to `dimension-grouper-prev-year.test.ts`:

```typescript
describe('per-item groupers — prev-year metrics', () => {
  const today = new Date('2026-04-17');
  const mkOrdersForKey = (dim: string, key: string) => [
    mkOrder('OC1', '2026-02-01', 1000, 600),
  ].map(o => ({ ...o, ORDERITEMS_SUBFORM: o.ORDERITEMS_SUBFORM.map(it => ({
    ...it,
    ...(dim === 'vendor' ? { Y_1159_5_ESH: key } : {}),
    ...(dim === 'brand' ? { Y_9952_5_ESH: key } : {}),
    ...(dim === 'product_type' ? { Y_3020_5_ESH: key } : {}),
    ...(dim === 'product' ? { PARTNAME: key } : {}),
  })) }));

  it.each(['vendor', 'brand', 'product_type', 'product'] as const)(
    'populates all 10 new prev-year fields for %s',
    (dim) => {
      const current = mkOrdersForKey(dim, 'K1');
      const prevSame = mkOrdersForKey(dim, 'K1').map(o => ({ ...o, CURDATE: '2025-02-15' }));
      const result = groupByDimension(dim, current, CUSTOMERS, 12,
        { today, prevSame, prevFull: prevSame });
      const row = result.find(r => r.id === 'K1');
      expect(row).toBeDefined();
      expect(row!.prevYearOrderCount).not.toBeNull();
      expect(row!.prevYearAvgOrder).not.toBeNull();
      expect(row!.prevYearMarginAmount).not.toBeNull();
      expect(row!.prevYearMarginPercent).not.toBeNull();
      expect(row!.prevYearFrequency).not.toBeNull();
      expect(row!.prevYearRevenueFull).not.toBeNull();
    },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/services/__tests__/dimension-grouper-prev-year.test.ts`
Expected: FAIL — per-item groupers don't yet receive `PrevYearInput` and don't populate the new fields.

- [ ] **Step 3: Extend each per-item grouper signature**

Open `server/src/services/dimension-grouper-items.ts`. For each of `groupByVendor`, `groupByBrand`, `groupByProductType`, `groupByProduct`:

1. Add `prevTotals?: PrevYearTotals` as last parameter.
2. After building each row, apply the same 12-line enrichment from Task 3 Step 5.

Example for `groupByVendor`:

```typescript
export function groupByVendor(
  orders: RawOrder[],
  customers: RawCustomer[],
  periodMonths: number,
  prevTotals?: PrevYearTotals,
): EntityListItem[] {
  // ... existing aggregation ...
  for (const row of rows) {
    const same = prevTotals?.samePeriod.get(row.id) ?? null;
    const full = prevTotals?.full.get(row.id) ?? null;
    row.prevYearRevenue = same?.revenue ?? null;
    row.prevYearOrderCount = same?.orderCount ?? null;
    row.prevYearAvgOrder = same?.avgOrder ?? null;
    row.prevYearMarginPercent = same?.marginPercent ?? null;
    row.prevYearMarginAmount = same?.marginAmount ?? null;
    row.prevYearFrequency = same?.frequency ?? null;
    row.prevYearRevenueFull = full?.revenue ?? null;
    row.prevYearOrderCountFull = full?.orderCount ?? null;
    row.prevYearAvgOrderFull = full?.avgOrder ?? null;
    row.prevYearMarginPercentFull = full?.marginPercent ?? null;
    row.prevYearMarginAmountFull = full?.marginAmount ?? null;
    row.prevYearFrequencyFull = full?.frequency ?? null;
  }
  return rows;
}
```

Repeat for brand, product_type, product — change the item-to-metric extraction to match each dimension's key.

- [ ] **Step 4: Update `groupByDimension` to build per-item totals and pass them down**

In `dimension-grouper.ts`, extend the dispatch logic so vendor/brand/product_type/product branches compute the correct keyFn for their dimension, then pass `prevTotals` into the per-item grouper:

```typescript
const keyFnByDim: Record<string, (o: RawOrder, it: RawOrderItem) => string> = {
  vendor: (_o, it) => it.Y_1159_5_ESH ?? 'UNKNOWN',
  brand: (_o, it) => it.Y_9952_5_ESH ?? 'UNKNOWN',
  product_type: (_o, it) => it.Y_3020_5_ESH ?? 'UNKNOWN',
  product: (_o, it) => it.PARTNAME,
};
// For each per-item dim: flatten orders → items, group by keyFn, apply computeMetrics.
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run src/services/__tests__/dimension-grouper-prev-year.test.ts`
Expected: PASS for all 4 per-dimension it.each cases.

- [ ] **Step 6: Run full server test suite**

Run: `cd server && npx vitest run`
Expected: PASS for all tests.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/dimension-grouper-items.ts server/src/services/dimension-grouper.ts server/src/services/__tests__/dimension-grouper-prev-year.test.ts
git commit -m "feat(server): extend per-item groupers with per-metric prev-year fields"
```

---

## Task 5: Hide period toggle in DetailHeader

**Files:**
- Modify: `client/src/components/right-panel/DetailHeader.tsx`

- [ ] **Step 1: Read current DetailHeader structure**

Run: `Read client/src/components/right-panel/DetailHeader.tsx`
Note the exact JSX for the `<PeriodSelector>` render around line 45.

- [ ] **Step 2: Comment out the PeriodSelector render**

Replace the `<PeriodSelector ... />` JSX with:

```tsx
{/* Period selector hidden 2026-04-17 — activePeriod state still flows through
    to KPISection and HeroRevenueCard for labelling. Restore when multi-year
    comparison is reintroduced. */}
```

Keep all `activePeriod` props and state flow intact.

- [ ] **Step 3: Run client build**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 4: Visual verify**

Start dev servers (`cd server && npm run dev` + `cd client && npm run dev`). Visit http://localhost:5173. No YTD/2026 tabs visible in header.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/right-panel/DetailHeader.tsx
git commit -m "feat(ui): hide period toggle in DetailHeader"
```

---

## Task 6: Hide period toggle in ConsolidatedHeader

**Files:**
- Modify: `client/src/components/right-panel/ConsolidatedHeader.tsx`

- [ ] **Step 1: Apply identical removal pattern**

Replace the `<PeriodSelector>` render (around line 55) with the same comment from Task 5.

- [ ] **Step 2: Run client build**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 3: Visual verify**

Enter Reports view via ReportButton, confirm no period tabs.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/right-panel/ConsolidatedHeader.tsx
git commit -m "feat(ui): hide period toggle in ConsolidatedHeader"
```

---

## Task 7: Search entities by ID

**Files:**
- Create: `client/src/utils/__tests__/search.test.ts`
- Modify: `client/src/utils/search.ts`

- [ ] **Step 1: Write failing test**

```typescript
// client/src/utils/__tests__/search.test.ts
import { describe, it, expect } from 'vitest';
import { searchEntities } from '../search';
import type { EntityListItem } from '../../../../shared/types/dashboard';

const make = (id: string, name: string): EntityListItem => ({
  id, name, revenue: null, orderCount: null, avgOrder: null,
  marginPercent: null, marginAmount: null, frequency: null,
  lastOrderDate: null, prevYearRevenue: null, prevYearRevenueFull: null,
  prevYearOrderCount: null, prevYearOrderCountFull: null,
  prevYearAvgOrder: null, prevYearAvgOrderFull: null,
  prevYearMarginPercent: null, prevYearMarginPercentFull: null,
  prevYearMarginAmount: null, prevYearMarginAmountFull: null,
  prevYearFrequency: null, prevYearFrequencyFull: null,
} as EntityListItem);

describe('searchEntities', () => {
  const rows = [
    make('C7826', 'Altamira Foods'),
    make('C1234', 'Ami Group'),
    make('V0099', 'Acme Ingredients'),
  ];

  it('matches on name substring', () => {
    expect(searchEntities(rows, 'altamira').map(r => r.id)).toEqual(['C7826']);
  });

  it('matches on id substring', () => {
    expect(searchEntities(rows, 'C78').map(r => r.id)).toEqual(['C7826']);
  });

  it('is case-insensitive', () => {
    expect(searchEntities(rows, 'C78').length).toBe(1);
    expect(searchEntities(rows, 'c78').length).toBe(1);
  });

  it('returns all rows when query empty', () => {
    expect(searchEntities(rows, '').length).toBe(3);
    expect(searchEntities(rows, '   ').length).toBe(3);
  });

  it('matches both name and id when query appears in both', () => {
    const ambiguous = [make('acme1', 'Other Name'), make('id1', 'Acme Foods')];
    expect(searchEntities(ambiguous, 'acme').length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/utils/__tests__/search.test.ts`
Expected: FAIL — "matches on id substring" fails because current `searchEntities` only hits `name`.

- [ ] **Step 3: Extend searchEntities**

Modify `client/src/utils/search.ts`:

```typescript
export function searchEntities(entities: EntityListItem[], query: string): EntityListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return entities;
  // WHY match on id too: IDs are meaningful to users (customer IDs like C7826,
  // vendor codes, SKUs). Matching both fields is always safe — IDs rarely collide
  // with name substrings, and if they do, the user sees both matches.
  return entities.filter(
    (e) => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/utils/__tests__/search.test.ts`
Expected: PASS for all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/search.ts client/src/utils/__tests__/search.test.ts
git commit -m "feat(search): match customer/vendor/product IDs in addition to names"
```

---

## Task 8: Filter SKU='000' in fetchProducts

**Files:**
- Modify: `server/src/services/priority-queries.ts`

- [ ] **Step 1: Extend the filter clause**

Find `fetchProducts` (around line 196). Change the filter:

```typescript
// BEFORE
filter: "STATDES eq 'In Use'",
// AFTER
filter: "STATDES eq 'In Use' and PARTNAME ne '000'",
```

- [ ] **Step 2: Run server build**

Run: `cd server && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run full server tests**

Run: `cd server && npx vitest run`
Expected: PASS (no tests exercise this specific filter, but ensure nothing regresses).

- [ ] **Step 4: Manual verify against live Priority**

Run:
```bash
cd server && npx tsx -e "
import { getPriorityClient } from './src/services/priority-client.js';
import { fetchProducts } from './src/services/priority-queries.js';
const rows = await fetchProducts(getPriorityClient());
const zero = rows.filter(r => r.PARTNAME === '000');
console.log('SKU=000 rows:', zero.length);
console.log('Total rows:', rows.length);
"
```

Expected: `SKU=000 rows: 0`.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/priority-queries.ts
git commit -m "fix(priority): exclude SKU='000' placeholder rows from product fetch"
```

---

## Task 9: Add country of origin (`Y_5380_5_ESH`) to LOGPART fetch

**Files:**
- Modify: `shared/types/dashboard.ts`
- Modify: `server/src/services/priority-queries.ts`

**Prerequisite:** Task 0.A must have confirmed `Y_5380_5_ESH` returns 200 on LOGPART.

- [ ] **Step 1: Extend RawProduct type**

In `shared/types/dashboard.ts`, add a field to `RawProduct`:

```typescript
export interface RawProduct {
  PARTNAME: string;
  PARTDES: string;
  FAMILYNAME: string;
  SPEC4: string | null;
  Y_5380_5_ESH: string | null;  // country of origin
  STATDES: string;
}
```

- [ ] **Step 2: Extend fetchProducts $select**

Modify `fetchProducts` in `priority-queries.ts`:

```typescript
select: 'PARTNAME,PARTDES,FAMILYNAME,SPEC4,Y_5380_5_ESH,STATDES',
```

- [ ] **Step 3: Run builds**

Run:
```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
```
Expected: PASS both.

- [ ] **Step 4: Live-verify field is populated**

```bash
cd server && npx tsx -e "
import { getPriorityClient } from './src/services/priority-client.js';
import { fetchProducts } from './src/services/priority-queries.js';
const rows = (await fetchProducts(getPriorityClient())).slice(0, 5);
for (const r of rows) console.log(r.PARTNAME, '→', r.Y_5380_5_ESH);
"
```
Expected: five rows printed, most with a country code/name (some may be null).

- [ ] **Step 5: Commit**

```bash
git add shared/types/dashboard.ts server/src/services/priority-queries.ts
git commit -m "feat(products): fetch country of origin (Y_5380_5_ESH) from LOGPART"
```

---

## Task 10: Replace brand with country of origin in product card sub-line

**Files:**
- Modify: `server/src/services/dimension-grouper-items.ts` (around line 154)

- [ ] **Step 1: Locate the product meta1 assembly**

Read `dimension-grouper-items.ts` around lines 133–180 — the `groupByProduct` function and its `meta1` construction.

- [ ] **Step 2: Add LOGPART map parameter and swap brand → country**

The LOGPART map should already be reachable from `entity-list-builder.ts` where `fetchProducts` is consumed. Update `groupByProduct` to accept and use it:

```typescript
export function groupByProduct(
  orders: RawOrder[],
  customers: RawCustomer[],
  periodMonths: number,
  productsByPartname: Map<string, RawProduct>,
  prevTotals?: PrevYearTotals,
): EntityListItem[] {
  // ... existing aggregation ...
  for (const row of rows) {
    const sku = row.id;
    const country = productsByPartname.get(sku)?.Y_5380_5_ESH ?? null;
    row.meta1 = [sku, country].filter(Boolean).join(' · ');
    // ... prev-year enrichment from Task 4 ...
  }
  return rows;
}
```

- [ ] **Step 3: Update call site in entity-list-builder.ts**

In the product branch, pass the map:

```typescript
const productsByPartname = new Map(productsResult.data.map(p => [p.PARTNAME, p]));
entities: groupByProduct(orders, customersResult.data, periodMonths, productsByPartname, prevTotals)
```

- [ ] **Step 4: Run full server tests**

Run: `cd server && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Manual verify**

Start both dev servers. Select any customer → switch to Products dimension → verify product cards show `SKU · Country` on the sub-line (not `SKU · Brand`).

- [ ] **Step 6: Commit**

```bash
git add server/src/services/dimension-grouper-items.ts server/src/services/entity-list-builder.ts
git commit -m "feat(products): show country of origin on product sub-line instead of brand"
```

---

## Task 11: Server-side `customerName` on single-entity Orders

**Files:**
- Modify: `server/src/routes/orders.ts` (or whichever route serves single-entity orders — grep first)

- [ ] **Step 1: Locate single-entity orders route**

Run:
```bash
grep -rn "OrderRow" server/src/routes/
```
Identify the route that returns single-entity orders (likely `orders.ts` or embedded in `dashboard.ts`).

- [ ] **Step 2: Write failing integration test**

Create `server/src/routes/__tests__/orders-customer-name.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
// ... same vi.mock pattern as contacts.test.ts ...

describe('GET /api/sales/orders — customerName annotation', () => {
  it('populates customerName on every row for non-customer dimensions', async () => {
    // mock fetchOrders + customers; request ?dimension=zone&entityId=Z1
    // assert every row has customerName
    const res = await request(app).get('/api/sales/orders?dimension=zone&entityId=Z1').expect(200);
    const rows = res.body.data as Array<{ orderNumber: string; customerName: string | null }>;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.customerName).not.toBeNull();
      expect(typeof row.customerName).toBe('string');
    }
  });

  it('omits customerName when dimension === customer (single customer context)', async () => {
    const res = await request(app).get('/api/sales/orders?dimension=customer&entityId=C1').expect(200);
    const rows = res.body.data as Array<{ customerName?: string | null }>;
    // Allowed to be absent or null; assert no cross-customer leakage
    for (const row of rows) {
      if (row.customerName != null) expect(row.customerName).toBe('Cust One');
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx vitest run src/routes/__tests__/orders-customer-name.test.ts`
Expected: FAIL — rows have null/undefined `customerName`.

- [ ] **Step 4: Enrich OrderRow with customerName**

In the orders route, after building OrderRow[]:

```typescript
const custMap = new Map(customers.map(c => [c.CUSTNAME, c.CUSTDES]));
const enriched = orderRows.map(row => ({
  ...row,
  customerName: custMap.get(row.custname) ?? null,
}));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run src/routes/__tests__/orders-customer-name.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/orders.ts server/src/routes/__tests__/orders-customer-name.test.ts
git commit -m "feat(orders): annotate customerName on every OrderRow for non-customer dimensions"
```

---

## Task 12: Reorder consolidated Orders columns (Customer between Order # and Items)

**Files:**
- Modify: `client/src/components/right-panel/ConsolidatedOrdersTable.tsx`

- [ ] **Step 1: Read current table structure**

Read lines 40–80 — note column header order and tbody cell order.

- [ ] **Step 2: Swap Customer to sit between Order # and Items**

In the header row (around line 49-56):

```tsx
<thead>
  <tr>
    <th>Date</th>
    <th>Order #</th>
    <th>Customer</th>   {/* moved */}
    <th>Items</th>
    <th>Amount</th>
    <th>Margin %</th>
    <th>Status</th>
  </tr>
</thead>
```

Update the tbody cell order to match:

```tsx
<td>{o.date.slice(0, 10)}</td>
<td>{o.orderNumber}</td>
<td>{o.customerName ?? '—'}</td>
<td>{o.itemCount}</td>
{/* ... rest unchanged ... */}
```

- [ ] **Step 3: Run client build**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 4: Visual verify**

Enter Reports view, confirm column order is `Date | Order # | Customer | Items | ...`.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/right-panel/ConsolidatedOrdersTable.tsx
git commit -m "feat(orders): place Customer column between Order # and Items in consolidated table"
```

---

## Task 13: Add Customer column to single-entity OrdersTable

**Files:**
- Modify: `client/src/components/right-panel/OrdersTable.tsx`
- Modify: `client/src/components/right-panel/OrdersTab.tsx`

- [ ] **Step 1: Add optional includeCustomer prop to OrdersTable**

In `OrdersTable.tsx`, extend the component props:

```tsx
interface OrdersTableProps {
  orders: OrderRow[];
  includeCustomer?: boolean;
}

export function OrdersTable({ orders, includeCustomer = false }: OrdersTableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Order #</th>
          {includeCustomer && <th>Customer</th>}
          <th>Items</th>
          {/* ... rest ... */}
        </tr>
      </thead>
      <tbody>
        {orders.map(o => (
          <tr key={o.orderNumber}>
            <td>{o.date.slice(0, 10)}</td>
            <td>{o.orderNumber}</td>
            {includeCustomer && <td>{o.customerName ?? '—'}</td>}
            <td>{o.itemCount}</td>
            {/* ... rest ... */}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Pass includeCustomer from OrdersTab based on dimension**

In `OrdersTab.tsx`, find the `<OrdersTable ... />` render and add:

```tsx
<OrdersTable orders={filteredOrders} includeCustomer={dimension !== 'customer'} />
```

- [ ] **Step 3: Run client build**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 4: Visual verify**

Classic single-entity view:
- Customer dim → no Customer column
- Zone / Vendor / Brand / Product Type / Product → Customer column visible between Order # and Items

- [ ] **Step 5: Commit**

```bash
git add client/src/components/right-panel/OrdersTable.tsx client/src/components/right-panel/OrdersTab.tsx
git commit -m "feat(orders): show customerName column in single-entity orders for non-customer dims"
```

---

## Task 14: Create GroupedContactsTable component

**Files:**
- Create: `client/src/components/right-panel/GroupedContactsTable.tsx`
- Create: `client/src/components/right-panel/__tests__/GroupedContactsTable.test.tsx`

- [ ] **Step 1: Write failing render test**

```tsx
// client/src/components/right-panel/__tests__/GroupedContactsTable.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GroupedContactsTable } from '../GroupedContactsTable';

const contacts = [
  { id: 'c1', name: 'Jane', email: 'j@acme.com', role: 'AP', customerName: 'Acme' },
  { id: 'c2', name: 'John', email: 'j2@acme.com', role: 'Buyer', customerName: 'Acme' },
  { id: 'c3', name: 'Bob', email: 'b@beta.com', role: 'AP', customerName: 'Beta' },
];

describe('GroupedContactsTable', () => {
  it('renders one section per customer', () => {
    render(<GroupedContactsTable contacts={contacts} />);
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('starts collapsed — contact rows are not visible initially', () => {
    render(<GroupedContactsTable contacts={contacts} />);
    expect(screen.queryByText('j@acme.com')).not.toBeInTheDocument();
  });

  it('expands a section on header click', () => {
    render(<GroupedContactsTable contacts={contacts} />);
    fireEvent.click(screen.getByRole('button', { name: /Acme/ }));
    expect(screen.getByText('j@acme.com')).toBeInTheDocument();
    expect(screen.getByText('j2@acme.com')).toBeInTheDocument();
  });

  it('reports contact count in each section header', () => {
    render(<GroupedContactsTable contacts={contacts} />);
    expect(screen.getByText(/Acme.*2 contacts/)).toBeInTheDocument();
    expect(screen.getByText(/Beta.*1 contact/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/right-panel/__tests__/GroupedContactsTable.test.tsx`
Expected: FAIL — "Cannot find module '../GroupedContactsTable'".

- [ ] **Step 3: Implement GroupedContactsTable**

```tsx
// client/src/components/right-panel/GroupedContactsTable.tsx
/**
 * FILE: client/src/components/right-panel/GroupedContactsTable.tsx
 * PURPOSE: Contacts grouped per customer with collapsible sections.
 *          Used for Zone/Vendor/Brand/Product Family/Product views where
 *          contacts span multiple customers.
 * USED BY: TabsSection.tsx
 * EXPORTS: GroupedContactsTable
 */
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Contact } from '../../../../shared/types/dashboard';

interface Props { contacts: Contact[]; }

export function GroupedContactsTable({ contacts }: Props) {
  // WHY group client-side: server already provides customerName per row.
  // Grouping here keeps the wire format flat and the UI control local.
  const groups = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of contacts) {
      const key = c.customerName ?? 'Unknown';
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [contacts]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  return (
    <div className="grouped-contacts">
      {groups.map(([customer, rows]) => {
        const open = expanded.has(customer);
        const listId = `contacts-group-${customer.replace(/\s+/g, '-')}`;
        return (
          <section key={customer} className="border-l-2 border-border-muted pl-3 mb-2">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => toggle(customer)}
              className="w-full text-left py-2 flex justify-between items-center"
            >
              <span>{open ? '▼' : '▶'} {customer}</span>
              <span className="text-xs text-text-muted">
                {rows.length} {rows.length === 1 ? 'contact' : 'contacts'}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.ul
                  id={listId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  {rows.map(c => (
                    <li key={c.id} className="py-1 flex gap-3">
                      <span>{c.name}</span>
                      <span className="text-text-muted">{c.email}</span>
                      <span className="text-xs">{c.role}</span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/right-panel/__tests__/GroupedContactsTable.test.tsx`
Expected: PASS all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/right-panel/GroupedContactsTable.tsx client/src/components/right-panel/__tests__/GroupedContactsTable.test.tsx
git commit -m "feat(contacts): add GroupedContactsTable with collapsible per-customer sections"
```

---

## Task 15: Route TabsSection to GroupedContactsTable based on data shape

**Files:**
- Modify: `client/src/components/right-panel/TabsSection.tsx`
- Delete: `client/src/components/right-panel/ConsolidatedContactsTable.tsx`

- [ ] **Step 1: Read current TabsSection contacts routing**

Read lines 120-140 of `TabsSection.tsx`. Identify the `ConsolidatedContactsTable` vs `ContactsTable` branch.

- [ ] **Step 2: Replace routing with data-shape check**

```tsx
// WHY data-shape check instead of consolidatedMode flag: contacts in single-entity
// Zone/Vendor/Brand views ALSO carry customerName (per server enrichment in
// contacts.ts). Grouping should be driven by the data, not the mode.
const hasCustomerName = contacts.length > 0 && contacts.every(c => !!c.customerName);
{activeTab === 'contacts' && (
  hasCustomerName
    ? <GroupedContactsTable contacts={contacts} />
    : <ContactsTable contacts={contacts} />
)}
```

Remove the `ConsolidatedContactsTable` import.

- [ ] **Step 3: Delete ConsolidatedContactsTable.tsx**

Run:
```bash
rm client/src/components/right-panel/ConsolidatedContactsTable.tsx
grep -rn "ConsolidatedContactsTable" client/src/
```

Expected: no remaining references. If any remain, fix them.

- [ ] **Step 4: Run client build**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 5: Visual verify**

- Customer dimension: flat `ContactsTable` (no customerName on rows).
- Zone / Vendor / Brand: `GroupedContactsTable` with expandable sections.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/right-panel/TabsSection.tsx
git rm client/src/components/right-panel/ConsolidatedContactsTable.tsx
git commit -m "refactor(contacts): route TabsSection to GroupedContactsTable by data shape; delete ConsolidatedContactsTable"
```

---

## Task 16: Verify single-entity contacts route annotates customerName

**Files:**
- Modify: `server/src/routes/contacts.ts` (possibly)
- Modify: `server/src/routes/__tests__/contacts.test.ts` (extend)

- [ ] **Step 1: Extend existing test file**

Append to `contacts.test.ts`:

```typescript
describe('GET /api/sales/contacts — single-entity customerName annotation', () => {
  it('annotates customerName for single-entity Zone requests', async () => {
    // mock: zone Z1 has customers C1 (Cust One) and C2 (Cust Two), each with 1 contact
    const res = await request(app).get('/api/sales/contacts?dimension=zone&entityId=Z1').expect(200);
    const rows = res.body.data as Array<{ customerName: string }>;
    expect(rows.length).toBe(2);
    for (const r of rows) expect(r.customerName).toMatch(/Cust One|Cust Two/);
  });

  it('omits customerName for single-entity Customer requests', async () => {
    const res = await request(app).get('/api/sales/contacts?dimension=customer&entityId=C1').expect(200);
    const rows = res.body.data as Array<{ customerName?: string }>;
    // Customer-scope has a single customer context; customerName not needed
    for (const r of rows) expect(r.customerName == null || r.customerName === 'Cust One').toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `cd server && npx vitest run src/routes/__tests__/contacts.test.ts`
Expected: either PASS (if already annotated) or FAIL (if zone single-entity path strips customerName).

- [ ] **Step 3: If failing, add annotation**

In `contacts.ts`, ensure the Zone/Vendor/Brand branch (lines 84-125) always annotates `customerName` regardless of whether request is single-entity or consolidated. The code path exists; just confirm it runs for single-entity too.

- [ ] **Step 4: Re-run test to verify it passes**

Run: `cd server && npx vitest run src/routes/__tests__/contacts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/contacts.ts server/src/routes/__tests__/contacts.test.ts
git commit -m "feat(contacts): ensure customerName annotated for single-entity non-customer dimensions"
```

---

## Task 17: Add Reports exit button to ConsolidatedHeader

**Files:**
- Modify: `client/src/components/right-panel/ConsolidatedHeader.tsx`
- Modify: `client/src/layouts/DashboardLayout.tsx` (prop threading)

- [ ] **Step 1: Add onClose prop to ConsolidatedHeader**

In `ConsolidatedHeader.tsx`:

```tsx
interface ConsolidatedHeaderProps {
  // ... existing props ...
  onClose: () => void;
}

export function ConsolidatedHeader({ /* existing */, onClose }: ConsolidatedHeaderProps) {
  return (
    <header>
      {/* existing content */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Exit Reports view"
        className="ml-auto p-2 hover:bg-hover rounded"
      >
        ✕
      </button>
    </header>
  );
}
```

- [ ] **Step 2: Wire up Escape key**

Add a `useEffect` inside ConsolidatedHeader:

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [onClose]);
```

- [ ] **Step 3: Thread report.close() from DashboardLayout**

In `DashboardLayout.tsx` where `<ConsolidatedHeader>` is rendered (around line 164):

```tsx
<ConsolidatedHeader
  /* existing props */
  onClose={() => {
    report.close();
    clearSelection();  // from useEntitySelection or equivalent
  }}
/>
```

- [ ] **Step 4: Run client build**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 5: Visual verify**

Enter Reports view → X button visible top-right → click returns to classic view → Escape key also returns.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/right-panel/ConsolidatedHeader.tsx client/src/layouts/DashboardLayout.tsx
git commit -m "feat(reports): add close button and Escape handler to exit consolidated view"
```

---

## Task 18: Reports time-range tabs (Orders only, default Last 30 Days)

**Files:**
- Create: `client/src/components/right-panel/ConsolidatedOrdersTab.tsx`
- Modify: `client/src/components/right-panel/RightPanel.tsx` (to route into it when consolidatedMode)

- [ ] **Step 1: Inspect classic OrdersTab filter pattern**

Read `client/src/components/right-panel/OrdersTab.tsx` lines 1-50. Note:
- `useState<OrderTimeFilter | null>('last30')`
- Filter bar component (likely `OrdersFilterBar.tsx`)
- Filter function (likely in `client/src/utils/orders-filter.ts`)

- [ ] **Step 2: Create ConsolidatedOrdersTab that reuses those pieces**

```tsx
// client/src/components/right-panel/ConsolidatedOrdersTab.tsx
import { useState, useMemo } from 'react';
import { OrdersFilterBar } from './OrdersFilterBar';
import { ConsolidatedOrdersTable } from './ConsolidatedOrdersTable';
import { filterOrdersByTime, type OrderTimeFilter } from '../../utils/orders-filter';
import type { OrderRow } from '../../../../shared/types/dashboard';

interface Props { orders: OrderRow[]; }

export function ConsolidatedOrdersTab({ orders }: Props) {
  const [activeFilter, setActiveFilter] = useState<OrderTimeFilter | null>('last30');
  const filtered = useMemo(
    () => (activeFilter ? filterOrdersByTime(orders, activeFilter) : orders),
    [orders, activeFilter],
  );
  return (
    <div>
      <OrdersFilterBar activeFilter={activeFilter} onChange={setActiveFilter} />
      <ConsolidatedOrdersTable orders={filtered} />
    </div>
  );
}
```

- [ ] **Step 3: Route consolidated Orders rendering through the new tab**

In `RightPanel.tsx` (or wherever `<ConsolidatedOrdersTable>` is currently rendered when `consolidatedMode=true`), replace with `<ConsolidatedOrdersTab orders={orders} />`.

- [ ] **Step 4: Run client build**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 5: Visual verify**

Enter Reports view → Orders tab → time filter bar present, defaults to Last 30 Days; switching tabs filters rows.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/right-panel/ConsolidatedOrdersTab.tsx client/src/components/right-panel/RightPanel.tsx
git commit -m "feat(reports): add time-range tabs to consolidated Orders view (default Last 30 Days)"
```

---

## Task 19: Create TrendArrow shared component

**Files:**
- Create: `client/src/components/shared/TrendArrow.tsx`
- Create: `client/src/components/shared/__tests__/TrendArrow.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendArrow } from '../TrendArrow';

describe('TrendArrow', () => {
  it('renders up arrow with positive class when current > prev', () => {
    render(<TrendArrow current={100} prev={50} />);
    const el = screen.getByTestId('trend-arrow');
    expect(el.textContent).toContain('▲');
    expect(el).toHaveClass('text-trend-positive');
  });

  it('renders down arrow with negative class when current < prev', () => {
    render(<TrendArrow current={30} prev={100} />);
    const el = screen.getByTestId('trend-arrow');
    expect(el.textContent).toContain('▼');
    expect(el).toHaveClass('text-trend-negative');
  });

  it('renders em-dash when prev is null', () => {
    render(<TrendArrow current={100} prev={null} />);
    expect(screen.getByTestId('trend-arrow').textContent).toBe('—');
  });

  it('inverts arrow direction when inverted=true (lower is better)', () => {
    render(<TrendArrow current={30} prev={100} inverted />);
    const el = screen.getByTestId('trend-arrow');
    expect(el.textContent).toContain('▲');
    expect(el).toHaveClass('text-trend-positive');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/shared/__tests__/TrendArrow.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement TrendArrow**

```tsx
// client/src/components/shared/TrendArrow.tsx
/**
 * FILE: client/src/components/shared/TrendArrow.tsx
 * PURPOSE: Inline ▲/▼/— indicator comparing current to previous value.
 * USED BY: PerCustomerKPITable.tsx, potentially HeroRevenueCard.tsx
 * EXPORTS: TrendArrow
 */
interface Props {
  current: number | null;
  prev: number | null;
  /** WHY inverted: some metrics improve as they decrease (e.g., days-since-order). */
  inverted?: boolean;
}

export function TrendArrow({ current, prev, inverted = false }: Props) {
  if (current == null || prev == null) {
    return <span data-testid="trend-arrow" className="text-text-muted">—</span>;
  }
  const rawUp = current > prev;
  const up = inverted ? !rawUp : rawUp;
  const arrow = current === prev ? '—' : up ? '▲' : '▼';
  const className = current === prev
    ? 'text-text-muted'
    : up
      ? 'text-trend-positive'
      : 'text-trend-negative';
  return <span data-testid="trend-arrow" className={className}>{arrow}</span>;
}
```

**Note:** the `text-trend-positive` / `text-trend-negative` tokens must exist in `client/src/styles/index.css`. If not, add them there (green for positive, red for negative). Check first:

Run: `grep -n "trend-positive\|trend-negative" client/src/styles/index.css`

If absent, add:
```css
@theme {
  --color-trend-positive: #16a34a;
  --color-trend-negative: #dc2626;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/shared/__tests__/TrendArrow.test.tsx`
Expected: PASS all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/shared/TrendArrow.tsx client/src/components/shared/__tests__/TrendArrow.test.tsx client/src/styles/index.css
git commit -m "feat(ui): add TrendArrow shared component with inverted-metric support"
```

---

## Task 20: Rewrite PerCustomerKPITable to 4-column layout

**Files:**
- Modify: `client/src/components/right-panel/PerCustomerKPITable.tsx`

- [ ] **Step 1: Extend props to accept two prev-value getters**

Replace the current props:

```tsx
interface Props {
  entities: EntityListItem[];
  getValue: (e: EntityListItem) => number | null;
  getPrevPeriodValue: (e: EntityListItem) => number | null;
  getPrevFullValue: (e: EntityListItem) => number | null;
  formatValue: (v: number | null) => string;
  valueLabel: string;
  invertedTrend?: boolean;
}
```

- [ ] **Step 2: Render 4 columns**

```tsx
<table>
  <thead>
    <tr>
      <th>Customer</th>
      <th className="text-right">{valueLabel}</th>
      <th className="text-right">LY same period</th>
      <th className="text-right">LY full year</th>
    </tr>
  </thead>
  <tbody>
    {sortedEntities.map(e => {
      const cur = getValue(e);
      const prev = getPrevPeriodValue(e);
      const full = getPrevFullValue(e);
      return (
        <tr key={e.id}>
          <td>{e.name}</td>
          <td className="text-right">
            {formatValue(cur)} <TrendArrow current={cur} prev={prev} inverted={invertedTrend} />
          </td>
          <td className="text-right text-text-muted">{formatValue(prev)}</td>
          <td className="text-right text-text-muted">{formatValue(full)}</td>
        </tr>
      );
    })}
  </tbody>
</table>
```

- [ ] **Step 3: Run client build**

Run: `cd client && npx tsc -b --noEmit`
Expected: FAIL at call sites (KPISection.tsx, kpi-modal-content.tsx) — they pass the old props. Fix in Task 21.

- [ ] **Step 4: Skip commit until Task 21 is done (they ship together)**

---

## Task 21: Wire all KPI cards to pass prev-period + prev-full getters

**Files:**
- Modify: `client/src/components/right-panel/KPISection.tsx`
- Modify: `client/src/components/right-panel/kpi-modal-content.tsx` (if present)

- [ ] **Step 1: Update every card's perCustomer config**

In `KPISection.tsx`, each card (Revenue, Orders, Avg Order, Margin %, Margin $, Frequency) builds a `perCustomer` config. Update each:

```tsx
// Revenue
perCustomer: consolidatedEntities ? {
  entities: consolidatedEntities,
  getValue: (e) => e.revenue,
  getPrevPeriodValue: (e) => e.prevYearRevenue,
  getPrevFullValue: (e) => e.prevYearRevenueFull,
  formatValue: formatCurrencyValue,
  valueLabel: 'Revenue',
} : undefined,

// Orders
perCustomer: { /* ... */
  getValue: (e) => e.orderCount,
  getPrevPeriodValue: (e) => e.prevYearOrderCount,
  getPrevFullValue: (e) => e.prevYearOrderCountFull,
  formatValue: formatNumber,
  valueLabel: 'Orders',
},

// Avg Order — similar, using e.avgOrder / e.prevYearAvgOrder / e.prevYearAvgOrderFull

// Margin % — formatValue: formatPercent, getters from prevYearMarginPercent{,Full}

// Margin $ — getters from prevYearMarginAmount{,Full}

// Frequency — getters from prevYearFrequency{,Full}
```

- [ ] **Step 2: Run client build**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 3: Visual verify**

On customer C7826 → click each small KPI card → Per Customer toggle → 4-column table renders with arrows for each card type.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/right-panel/PerCustomerKPITable.tsx client/src/components/right-panel/KPISection.tsx client/src/components/right-panel/kpi-modal-content.tsx
git commit -m "feat(kpi): 4-column Per-Customer modal with YTD+arrow, LY same-period, LY full for every card"
```

---

## Task 22: Investigate literal `\u2014` rendering bug

**Files:** exploratory — no guaranteed edits.

- [ ] **Step 1: Grep source for escaped em-dashes**

Run:
```bash
grep -rn '"\\\\u2014"' server/src/ client/src/
grep -rn "'\\\\u2014'" server/src/ client/src/
grep -rn "'\\\\\\\\u2014'" server/src/ client/src/
```

- [ ] **Step 2: If nothing in source, inspect a live consolidated response**

Start both dev servers. In a browser DevTools:
```javascript
fetch('/api/sales/fetch-all?dimension=customer&entityIds=C7826')
  .then(r => r.text()).then(t => console.log(t.includes('\\u2014')));
```

If `true`, the server is emitting pre-stringified JSON somewhere. Trace serializer layers; fix at the source.

- [ ] **Step 3: Document finding**

Create `learnings/literal-u2014-root-cause.md` with diagnosis + fix (or "not reproducible — user screenshot was stale").

- [ ] **Step 4: Commit any fix**

```bash
git add <fixed-files> learnings/literal-u2014-root-cause.md
git commit -m "fix(kpi): <one-line from finding>"
```

---

## Task 23: Vendor prev-year verification

**Files:** exploratory first; edits only if actually broken.

- [ ] **Step 1: Snapshot vendor API response**

```bash
curl -s 'http://localhost:3001/api/sales/entities?dimension=vendor' | jq '.data[0:5] | map({id, name, prevYearRevenue, prevYearRevenueFull, prevYearOrderCount})'
```

Expected after Tasks 3–4: every vendor that had prior-year activity has non-null `prevYearRevenue` + `prevYearOrderCount`.

- [ ] **Step 2: Branch on result**

- If all populated: write `learnings/vendor-prev-year-verified.md` with the snapshot as evidence. No code change.
- If some/all null for vendors that clearly had prior activity: inspect `dimension-grouper-items.ts` `groupByVendor` prev-year logic. Check `Y_1159_5_ESH` field presence on prev-year items.

- [ ] **Step 3: Commit findings (and fix if needed)**

```bash
git add learnings/vendor-prev-year-verified.md
git commit -m "docs(learnings): vendor prev-year verification results"
```

---

## Self-review checklist

Against the v2 spec:

| Spec § | Covered by task |
|---|---|
| §4.1 Hide period toggle | Tasks 5, 6 |
| §4.2 KPI 4-column modal | Tasks 19, 20, 21 |
| §4.3.1 Reports exit | Task 17 |
| §4.3.2 Customer name under Orders (debug) | Covered by Task 11 (server enrichment) + Task 12 (consolidated reorder); if still showing em-dash, Task 22 covers root-cause grep |
| §4.3.3 Reports time tabs | Task 18 |
| §4.4 Search by ID | Task 7 |
| §4.5 Contacts grouping | Tasks 14, 15, 16 |
| §4.6 Orders customerName on main line | Tasks 11, 12, 13 |
| §5.1 Prev-year backend (corrected producer) | Tasks 1, 2, 3, 4 |
| §5.2 customerName enrichment | Tasks 11, 16 |
| §5.3 Zone investigation | Task 0.B |
| §5.4 Vendor prev-year verify | Task 23 |
| §5.5 Product Family | *Not in this plan — separate `2026-04-17-product-family-migration-plan.md`* |
| §5.6.1 Filter SKU='000' | Task 8 |
| §5.6.2 Country of origin | Tasks 0.A, 9, 10 |

**Placeholder scan:** none found (all code blocks complete, all file paths absolute to repo root).

**Type consistency:** `computeMetrics` / `MetricsSnapshot` / `PrevYearTotals` / `PrevYearInput` are named consistently across Tasks 1, 3, 4. `includeCustomer` prop name matches between `OrdersTable` (Task 13) and its caller (same task).

**Out-of-scope:** `data-aggregator.ts` is intentionally untouched per v2 spec §5.1.
