# Dashboard Polish Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Orders consolidated items panel, enhance Items tab with performance analytics (units, frequency, last order, YoY comparison), reorder toolbar, and fix design polish issues.

**Architecture:** Backend-first (shared types → aggregation → API constant), then frontend (new components → modified components → polish). Each task produces a working, independently testable unit.

**Tech Stack:** TypeScript strict, Express backend, React 19 + Vite + Tailwind v4, Vitest, Framer Motion

**Spec:** `docs/specs/2026-04-13-dashboard-polish-phase2.md`

---

## File Structure

### New Files (5)
| File | Responsibility |
|------|---------------|
| `client/src/utils/consolidate-order-items.ts` | Pure function: aggregate OrderRow[] items by SKU |
| `client/src/components/right-panel/OrdersConsolidatedItems.tsx` | UI: consolidated items section below orders table |
| `client/src/components/shared/TrendArrow.tsx` | Reusable ▲/▼ trend indicator component |
| `client/src/components/right-panel/ItemsCompareRow.tsx` | YoY delta sub-row for Items table |
| `client/src/utils/items-deltas.ts` | Pure function: compute YoY deltas for a FlatItem |

### Modified Files (15)
| File | Change |
|------|--------|
| `shared/types/dashboard.ts` | Add 8 new fields to FlatItem interface |
| `server/src/config/constants.ts` | Add TQUANT to ORDERITEM_SELECT_PREV |
| `server/src/services/data-aggregator.ts` | Refactor buildFlatItems signature + implementation |
| `server/tests/services/data-aggregator.test.ts` | Add ~15 tests for new FlatItem fields |
| `client/src/components/right-panel/OrdersTab.tsx` | Add consolidated items below table |
| `client/src/components/right-panel/ItemsTable.tsx` | New column headers, wider column defs, pass showCompare |
| `client/src/components/right-panel/ItemsProductRow.tsx` | New cells, trend arrows, compare sub-row |
| `client/src/components/right-panel/ItemsGroupRow.tsx` | New cells (dashes for N/A columns), wider widths |
| `client/src/components/right-panel/ItemsToolbar.tsx` | Reorder icons, add Compare toggle button |
| `client/src/components/right-panel/ItemsExplorer.tsx` | Pass showCompare + toggleCompare to children |
| `client/src/hooks/useItemsExplorer.ts` | Add showCompare state + toggleCompare action |
| `client/src/utils/items-grouping.ts` | Add new sort fields (totalUnits, purchaseFrequency, lastPrice) |
| `client/src/components/right-panel/YoYBarChart.tsx` | Increase CHART_HEIGHT from 120 to 180 |
| `client/src/components/right-panel/KPICard.tsx` | Bump detail text sizes (9→10, 12→13) |
| `client/src/components/right-panel/HeroRevenueCard.tsx` | Bump prev year text sizes |
| `client/src/components/right-panel/OrdersTable.tsx` | Remove max-w-[1100px] |

---

### Task 0: Shared Types — Add New FlatItem Fields

**Files:**
- Modify: `shared/types/dashboard.ts:138-150`

- [ ] **Step 1: Add 8 new fields to FlatItem interface**

In `shared/types/dashboard.ts`, replace the existing `FlatItem` interface (lines 138-150) with:

```typescript
/** Flat item for the Items tab explorer — aggregated by SKU, enriched with category fields */
export interface FlatItem {
  name: string;
  sku: string;
  value: number;
  marginPercent: number;
  marginAmount: number;
  productType: string;
  productFamily: string;
  brand: string;
  countryOfOrigin: string;
  foodServiceRetail: string;
  vendor: string;
  /** Sum of TQUANT across all current-period orders containing this SKU */
  totalUnits: number;
  /** Unit of measure — "cs", "lb", "ea", fallback "units" */
  unitName: string;
  /** PRICE from the most recent order containing this SKU */
  lastPrice: number;
  /** Unique orders containing this SKU / months in period */
  purchaseFrequency: number;
  /** ISO date of most recent order containing this SKU, null if none */
  lastOrderDate: string | null;
  /** Sum of QPRICE from previous year, 0 if no prev data */
  prevYearValue: number;
  /** Avg margin % from previous year, 0 if no prev data */
  prevYearMarginPercent: number;
  /** Sum of TQUANT from previous year, 0 if no prev data */
  prevYearUnits: number;
}
```

- [ ] **Step 2: Verify TypeScript catches the missing fields in data-aggregator**

Run: `cd server && npx tsc --noEmit 2>&1 | head -20`

Expected: TypeScript errors in `data-aggregator.ts` where `buildFlatItems` returns objects missing the new fields. This proves the type change propagated.

- [ ] **Step 3: Commit**

```bash
git add shared/types/dashboard.ts
git commit -m "feat: add performance + comparison fields to FlatItem type"
```

---

### Task 1: API Constant — Add TQUANT to Previous Year Query

**Files:**
- Modify: `server/src/config/constants.ts:51-53`

- [ ] **Step 1: Add TQUANT to ORDERITEM_SELECT_PREV**

In `server/src/config/constants.ts`, replace lines 51-53:

```typescript
/** Lighter set for previous-year queries — includes TQUANT for YoY units comparison */
export const ORDERITEM_SELECT_PREV = [
  'PARTNAME', 'QPRICE', 'QPROFIT', 'TQUANT', 'Y_9952_5_ESH', 'Y_3021_5_ESH',
].join(',');
```

- [ ] **Step 2: Verify the change doesn't break the server TS build**

Run: `cd server && npx tsc --noEmit 2>&1 | grep -v "dashboard.ts"` (ignore the expected FlatItem errors from Task 0)

Expected: No NEW errors from constants.ts. The `fetchOrders()` function in `priority-queries.ts` line 98 automatically picks up the updated constant via `const itemFields = isCurrentPeriod ? ORDERITEM_SELECT : ORDERITEM_SELECT_PREV`.

- [ ] **Step 3: Commit**

```bash
git add server/src/config/constants.ts
git commit -m "feat: add TQUANT to prev-year order item query for YoY units comparison"
```

---

### Task 2: Backend — Write Failing Tests for New FlatItem Fields

**Files:**
- Modify: `server/tests/services/data-aggregator.test.ts`

- [ ] **Step 1: Add tests for current-period performance fields**

Append to the `buildFlatItems (via aggregateOrders.items)` describe block in `data-aggregator.test.ts`:

```typescript
    it('computes totalUnits as sum of TQUANT per SKU', () => {
      const orders = [
        makeOrder({
          ORDNAME: 'O1',
          ORDERITEMS_SUBFORM: [
            makeItem({ PARTNAME: 'A', TQUANT: 10, QPRICE: 100 }),
            makeItem({ PARTNAME: 'A', TQUANT: 5, QPRICE: 50 }),
            makeItem({ PARTNAME: 'B', TQUANT: 20, QPRICE: 200 }),
          ],
        }),
      ];
      const result = aggregateOrders(orders, [], 'ytd');
      const itemA = result.items.find(i => i.sku === 'A')!;
      const itemB = result.items.find(i => i.sku === 'B')!;
      expect(itemA.totalUnits).toBe(15);
      expect(itemB.totalUnits).toBe(20);
    });

    it('captures unitName from first item occurrence per SKU', () => {
      const orders = [makeOrder({
        ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', TUNITNAME: 'cs' })],
      })];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].unitName).toBe('cs');
    });

    it('defaults unitName to "units" when TUNITNAME is empty', () => {
      const orders = [makeOrder({
        ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', TUNITNAME: '' })],
      })];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].unitName).toBe('units');
    });

    it('computes lastPrice from the order with the latest CURDATE', () => {
      const orders = [
        makeOrder({ ORDNAME: 'O1', CURDATE: '2026-01-10T00:00:00Z', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', PRICE: 50 })] }),
        makeOrder({ ORDNAME: 'O2', CURDATE: '2026-03-15T00:00:00Z', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', PRICE: 60 })] }),
        makeOrder({ ORDNAME: 'O3', CURDATE: '2026-02-01T00:00:00Z', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', PRICE: 55 })] }),
      ];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].lastPrice).toBe(60);
    });

    it('computes lastOrderDate as the max CURDATE per SKU', () => {
      const orders = [
        makeOrder({ ORDNAME: 'O1', CURDATE: '2026-01-10T00:00:00Z', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A' })] }),
        makeOrder({ ORDNAME: 'O2', CURDATE: '2026-03-15T00:00:00Z', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A' })] }),
      ];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].lastOrderDate).toBe('2026-03-15T00:00:00Z');
    });

    it('computes purchaseFrequency as orderCount / periodMonths', () => {
      const orders = [
        makeOrder({ ORDNAME: 'O1', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A' })] }),
        makeOrder({ ORDNAME: 'O2', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A' })] }),
        makeOrder({ ORDNAME: 'O3', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A' })] }),
      ];
      const result = aggregateOrders(orders, [], 'ytd');
      // 3 orders / periodMonths (current month index + 1)
      const expectedMonths = Math.max(1, new Date().getUTCMonth() + 1);
      expect(result.items[0].purchaseFrequency).toBeCloseTo(3 / expectedMonths, 1);
    });
```

- [ ] **Step 2: Add tests for previous year comparison fields**

Continue appending:

```typescript
    it('computes prevYearValue as sum of QPRICE from prevOrders per SKU', () => {
      const orders = [makeOrder({ ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', QPRICE: 500 })] })];
      const prevOrders = [
        makeOrder({ ORDNAME: 'P1', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', QPRICE: 300 })] }),
        makeOrder({ ORDNAME: 'P2', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', QPRICE: 200 })] }),
      ];
      const result = aggregateOrders(orders, prevOrders, 'ytd');
      expect(result.items[0].prevYearValue).toBe(500);
    });

    it('computes prevYearMarginPercent from prevOrders', () => {
      const orders = [makeOrder({ ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', QPRICE: 1000, QPROFIT: 400 })] })];
      const prevOrders = [makeOrder({ ORDNAME: 'P1', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', QPRICE: 800, QPROFIT: 200 })] })];
      const result = aggregateOrders(orders, prevOrders, 'ytd');
      expect(result.items[0].prevYearMarginPercent).toBeCloseTo(25); // 200/800 * 100
    });

    it('computes prevYearUnits as sum of TQUANT from prevOrders', () => {
      const orders = [makeOrder({ ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', TQUANT: 50 })] })];
      const prevOrders = [makeOrder({ ORDNAME: 'P1', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', TQUANT: 30 })] })];
      const result = aggregateOrders(orders, prevOrders, 'ytd');
      expect(result.items[0].prevYearUnits).toBe(30);
    });

    it('returns 0 for prev year fields when SKU not in prevOrders', () => {
      const orders = [makeOrder({ ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'NEW-SKU' })] })];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].prevYearValue).toBe(0);
      expect(result.items[0].prevYearMarginPercent).toBe(0);
      expect(result.items[0].prevYearUnits).toBe(0);
    });

    it('ignores SKUs present only in prevOrders (not in current period)', () => {
      const orders = [makeOrder({ ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A' })] })];
      const prevOrders = [makeOrder({ ORDNAME: 'P1', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'GONE-SKU' })] })];
      const result = aggregateOrders(orders, prevOrders, 'ytd');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].sku).toBe('A');
    });
```

- [ ] **Step 3: Run tests to verify they all fail**

Run: `cd server && npx vitest run tests/services/data-aggregator.test.ts 2>&1 | tail -20`

Expected: All new tests FAIL because `buildFlatItems` doesn't return the new fields yet. Existing tests should still pass.

- [ ] **Step 4: Commit failing tests**

```bash
git add server/tests/services/data-aggregator.test.ts
git commit -m "test: add failing tests for FlatItem performance + comparison fields"
```

---

### Task 3: Backend — Implement Enhanced buildFlatItems

**Files:**
- Modify: `server/src/services/data-aggregator.ts:20-40` (call site) and `server/src/services/data-aggregator.ts:144-182` (function body)

- [ ] **Step 1: Update aggregateOrders call site**

In `data-aggregator.ts`, change line 37 from:

```typescript
  const items = buildFlatItems(allItems);
```

to:

```typescript
  const items = buildFlatItems(nonZeroOrders, prevOrders, period);
```

- [ ] **Step 2: Rewrite buildFlatItems with new signature and 3-phase implementation**

Replace the entire `buildFlatItems` function (lines 144-182) with:

```typescript
/** WHY: Accepts RawOrder[] (not flattened items) to preserve order-level context
 * (ORDNAME, CURDATE) needed for per-SKU frequency, lastOrderDate, lastPrice.
 * Pattern from dimension-grouper-items.ts groupByProduct. */
function buildFlatItems(
  orders: RawOrder[],
  prevOrders: RawOrder[],
  period: string,
): FlatItem[] {
  // Phase 1: Build current-period accumulator per SKU
  const bySku = new Map<string, {
    name: string; sku: string; value: number; profit: number;
    totalUnits: number; unitName: string; lastPrice: number; lastOrderDate: string;
    orderIds: Set<string>;
    productType: string; productFamily: string; brand: string;
    countryOfOrigin: string; foodServiceRetail: string; vendor: string;
  }>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const existing = bySku.get(item.PARTNAME);
    if (existing) {
      existing.value += item.QPRICE;
      existing.profit += item.QPROFIT;
      existing.totalUnits += item.TQUANT;
      existing.orderIds.add(o.ORDNAME);
      // WHY: Track latest order date + price for "last purchase" display
      if (o.CURDATE > existing.lastOrderDate) {
        existing.lastOrderDate = o.CURDATE;
        existing.lastPrice = item.PRICE;
      }
    } else {
      bySku.set(item.PARTNAME, {
        name: item.PDES,
        sku: item.PARTNAME,
        value: item.QPRICE,
        profit: item.QPROFIT,
        totalUnits: item.TQUANT,
        unitName: item.TUNITNAME || 'units',
        lastPrice: item.PRICE,
        lastOrderDate: o.CURDATE,
        orderIds: new Set([o.ORDNAME]),
        productType: item.Y_3021_5_ESH || 'Other',
        productFamily: item.Y_2075_5_ESH || 'Other',
        brand: item.Y_9952_5_ESH || 'Other',
        countryOfOrigin: item.Y_5380_5_ESH || 'Other',
        foodServiceRetail: item.Y_9967_5_ESH === 'Y' ? 'Retail' : 'Food Service',
        vendor: item.Y_1530_5_ESH || 'Other',
      });
    }
  }));

  // Phase 2: Build prev-year lookup per SKU (only 6 fields available on prev items)
  const prevBySku = new Map<string, { value: number; profit: number; units: number }>();
  prevOrders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const existing = prevBySku.get(item.PARTNAME);
    if (existing) {
      existing.value += item.QPRICE;
      existing.profit += item.QPROFIT;
      existing.units += (item.TQUANT ?? 0);
    } else {
      prevBySku.set(item.PARTNAME, {
        value: item.QPRICE,
        profit: item.QPROFIT,
        units: item.TQUANT ?? 0,
      });
    }
  }));

  // Phase 3: Merge and return FlatItem[]
  const now = new Date();
  const periodMonths = period === 'ytd'
    ? Math.max(1, now.getUTCMonth() + 1)
    : 12;

  return [...bySku.values()].map(p => {
    const prev = prevBySku.get(p.sku);
    return {
      name: p.name,
      sku: p.sku,
      value: p.value,
      marginPercent: p.value > 0 ? (p.profit / p.value) * 100 : 0,
      marginAmount: p.profit,
      productType: p.productType,
      productFamily: p.productFamily,
      brand: p.brand,
      countryOfOrigin: p.countryOfOrigin,
      foodServiceRetail: p.foodServiceRetail,
      vendor: p.vendor,
      totalUnits: p.totalUnits,
      unitName: p.unitName,
      lastPrice: p.lastPrice,
      purchaseFrequency: periodMonths > 0 ? p.orderIds.size / periodMonths : 0,
      lastOrderDate: p.lastOrderDate,
      prevYearValue: prev?.value ?? 0,
      prevYearMarginPercent: prev && prev.value > 0 ? (prev.profit / prev.value) * 100 : 0,
      prevYearUnits: prev?.units ?? 0,
    };
  });
}
```

- [ ] **Step 3: Run all tests to verify new tests pass and existing tests still pass**

Run: `cd server && npx vitest run`

Expected: All tests pass (both existing ~63 tests and new ~12 tests). Zero failures.

- [ ] **Step 4: Verify both TS builds pass**

Run: `cd server && npx tsc --noEmit && cd ../client && npx tsc -b --noEmit`

Expected: Clean build, zero errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/data-aggregator.ts shared/types/dashboard.ts server/src/config/constants.ts server/tests/services/data-aggregator.test.ts
git commit -m "feat: enhance buildFlatItems with performance metrics + YoY comparison data"
```

---

### Task 4: Frontend — Orders Consolidated Items Utility

**Files:**
- Create: `client/src/utils/consolidate-order-items.ts`

- [ ] **Step 1: Create pure consolidation function**

```typescript
// FILE: client/src/utils/consolidate-order-items.ts
// PURPOSE: Aggregate OrderRow[] line items by SKU for the Orders tab summary
// USED BY: OrdersTab.tsx
// EXPORTS: consolidateOrderItems, ConsolidatedOrderItem

import type { OrderRow } from '@shared/types/dashboard';

export interface ConsolidatedOrderItem {
  sku: string;
  productName: string;
  totalQuantity: number;
  totalValue: number;
  orderCount: number;
  lastPrice: number;
  unit: string;
}

/** WHY: Sort orders date-desc so first encounter of each SKU captures the most recent price */
export function consolidateOrderItems(orders: OrderRow[]): ConsolidatedOrderItem[] {
  if (orders.length === 0) return [];

  const sorted = [...orders].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const bySku = new Map<string, ConsolidatedOrderItem & { orderNumbers: Set<string> }>();

  sorted.forEach(order => {
    order.items.forEach(item => {
      const existing = bySku.get(item.sku);
      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.totalValue += item.lineTotal;
        existing.orderNumbers.add(order.orderNumber);
      } else {
        bySku.set(item.sku, {
          sku: item.sku,
          productName: item.productName,
          totalQuantity: item.quantity,
          totalValue: item.lineTotal,
          orderCount: 0,
          lastPrice: item.unitPrice,
          unit: item.unit,
          orderNumbers: new Set([order.orderNumber]),
        });
      }
    });
  });

  return [...bySku.values()]
    .map(({ orderNumbers, ...rest }) => ({ ...rest, orderCount: orderNumbers.size }))
    .sort((a, b) => b.totalValue - a.totalValue);
}
```

- [ ] **Step 2: Verify client TS build**

Run: `cd client && npx tsc -b --noEmit`

Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add client/src/utils/consolidate-order-items.ts
git commit -m "feat: add consolidateOrderItems pure function for Orders summary"
```

---

### Task 5: Frontend — OrdersConsolidatedItems Component

**Files:**
- Create: `client/src/components/right-panel/OrdersConsolidatedItems.tsx`
- Modify: `client/src/components/right-panel/OrdersTab.tsx`

- [ ] **Step 1: Create OrdersConsolidatedItems component**

```typescript
// FILE: client/src/components/right-panel/OrdersConsolidatedItems.tsx
// PURPOSE: Aggregated SKU summary below orders table — shows what was bought in filtered period
// USED BY: OrdersTab.tsx
// EXPORTS: OrdersConsolidatedItems

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ConsolidatedOrderItem } from '../../utils/consolidate-order-items';
import { formatCurrency } from '@shared/utils/formatting';
import { CopyableId } from '../shared/CopyableId';

interface Props {
  items: ConsolidatedOrderItem[];
}

function rankBadgeClasses(rank: number): string {
  if (rank <= 3) return 'bg-[var(--color-gold-primary)] text-white';
  return 'bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)]';
}

export function OrdersConsolidatedItems({ items }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
      <button
        type="button"
        onClick={() => setCollapsed(prev => !prev)}
        className="flex items-center gap-2 px-[var(--spacing-3xl)] pb-[var(--spacing-base)] text-[14px] font-semibold text-[var(--color-text-primary)]"
      >
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`}
          aria-hidden="true"
        >
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Items Summary
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-gold-subtle)] px-1 text-[9px] font-semibold text-[var(--color-text-muted)]">
          {items.length}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-gold-subtle)]">
                  <th className="w-8 px-0 pl-[var(--spacing-3xl)] py-[var(--spacing-sm)] text-left text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">#</th>
                  <th className="px-[var(--spacing-lg)] py-[var(--spacing-sm)] text-left text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">Product</th>
                  <th className="px-[var(--spacing-lg)] py-[var(--spacing-sm)] text-right text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">Qty</th>
                  <th className="px-[var(--spacing-lg)] py-[var(--spacing-sm)] text-right text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">Value</th>
                  <th className="px-[var(--spacing-lg)] py-[var(--spacing-sm)] text-right text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">Orders</th>
                  <th className="px-[var(--spacing-lg)] py-[var(--spacing-sm)] text-right text-[11px] font-semibold uppercase text-[var(--color-text-muted)] pr-[var(--spacing-3xl)]">Last Price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.sku} className="border-b border-[var(--color-bg-page)] hover:bg-[var(--color-gold-hover)] transition-colors duration-150">
                    <td className="w-8 px-0 pl-[var(--spacing-3xl)] py-[var(--spacing-sm)]">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-[var(--radius-md)] text-[10px] font-semibold ${rankBadgeClasses(i + 1)}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-[var(--spacing-lg)] py-[var(--spacing-sm)]">
                      <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{item.productName}</p>
                      <CopyableId value={item.sku} label="SKU" className="block text-[11px] text-[var(--color-text-muted)]" />
                    </td>
                    <td className="px-[var(--spacing-lg)] py-[var(--spacing-sm)] text-right text-[13px] tabular-nums text-[var(--color-text-secondary)]">
                      {item.totalQuantity.toLocaleString('en-US')} {item.unit}
                    </td>
                    <td className="px-[var(--spacing-lg)] py-[var(--spacing-sm)] text-right text-[13px] tabular-nums text-[var(--color-text-primary)] font-medium">
                      {formatCurrency(item.totalValue)}
                    </td>
                    <td className="px-[var(--spacing-lg)] py-[var(--spacing-sm)] text-right text-[13px] text-[var(--color-text-secondary)]">
                      {item.orderCount}
                    </td>
                    <td className="px-[var(--spacing-lg)] py-[var(--spacing-sm)] text-right text-[13px] tabular-nums text-[var(--color-text-secondary)] pr-[var(--spacing-3xl)]">
                      {formatCurrency(item.lastPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Wire into OrdersTab**

Replace the entire `OrdersTab.tsx`:

```typescript
// FILE: client/src/components/right-panel/OrdersTab.tsx
// PURPOSE: Orchestrates orders time filter state + OrdersFilterBar + OrdersTable + consolidated items
// USED BY: TabsSection.tsx
// EXPORTS: OrdersTab

import { useState, useMemo } from 'react';
import type { OrderRow } from '@shared/types/dashboard';
import type { OrderTimeFilter } from '../../utils/orders-filter';
import { filterOrdersByTimeRange } from '../../utils/orders-filter';
import { consolidateOrderItems } from '../../utils/consolidate-order-items';
import { OrdersFilterBar } from './OrdersFilterBar';
import { OrdersTable } from './OrdersTable';
import { OrdersConsolidatedItems } from './OrdersConsolidatedItems';

interface OrdersTabProps {
  orders: OrderRow[];
}

export function OrdersTab({ orders }: OrdersTabProps) {
  /** WHY: Pre-select "Last 30 Days" so users see recent orders immediately */
  const [activeFilter, setActiveFilter] = useState<OrderTimeFilter | null>('last30');

  const filteredOrders = useMemo(
    () => filterOrdersByTimeRange(orders, activeFilter),
    [orders, activeFilter],
  );

  const consolidatedItems = useMemo(
    () => consolidateOrderItems(filteredOrders),
    [filteredOrders],
  );

  return (
    <>
      <OrdersFilterBar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        filteredCount={filteredOrders.length}
        totalCount={orders.length}
      />
      <OrdersTable orders={filteredOrders} />
      <OrdersConsolidatedItems items={consolidatedItems} />
    </>
  );
}
```

- [ ] **Step 3: Verify client TS build**

Run: `cd client && npx tsc -b --noEmit`

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/right-panel/OrdersConsolidatedItems.tsx client/src/components/right-panel/OrdersTab.tsx
git commit -m "feat: add consolidated items summary below orders table"
```

---

### Task 6: Frontend — TrendArrow + ItemsDeltas Shared Components

**Files:**
- Create: `client/src/components/shared/TrendArrow.tsx`
- Create: `client/src/utils/items-deltas.ts`

- [ ] **Step 1: Create TrendArrow component**

```typescript
// FILE: client/src/components/shared/TrendArrow.tsx
// PURPOSE: Reusable ▲/▼ trend indicator — green for improvement, red for decline
// USED BY: ItemsProductRow.tsx
// EXPORTS: TrendArrow

interface TrendArrowProps {
  current: number;
  previous: number;
}

/** WHY: No arrow when previous is 0 — means new SKU with no comparison baseline */
export function TrendArrow({ current, previous }: TrendArrowProps) {
  if (previous === 0) return null;
  const isUp = current > previous;
  return (
    <span className={`ml-0.5 text-[10px] ${isUp ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}`}>
      {isUp ? '▲' : '▼'}
    </span>
  );
}
```

- [ ] **Step 2: Create items-deltas utility**

```typescript
// FILE: client/src/utils/items-deltas.ts
// PURPOSE: Compute YoY delta values for a FlatItem (used by compare toggle sub-row)
// USED BY: ItemsCompareRow.tsx
// EXPORTS: computeItemDeltas, ItemDeltas

import type { FlatItem } from '@shared/types/dashboard';

export interface ItemDeltas {
  valueDelta: number | null;
  marginDelta: number | null;
  marginAmountDelta: number | null;
  unitsDelta: number | null;
}

/** WHY: Returns null for each delta when no prev-year baseline — prevents misleading comparisons */
export function computeItemDeltas(item: FlatItem): ItemDeltas {
  return {
    valueDelta: item.prevYearValue > 0
      ? ((item.value - item.prevYearValue) / item.prevYearValue) * 100
      : null,
    marginDelta: item.prevYearValue > 0
      ? item.marginPercent - item.prevYearMarginPercent
      : null,
    marginAmountDelta: item.prevYearValue > 0 && Math.abs(item.marginAmount - (item.prevYearMarginPercent / 100 * item.prevYearValue)) > 0.01
      ? ((item.marginAmount - (item.prevYearMarginPercent / 100 * item.prevYearValue)) / Math.abs(item.prevYearMarginPercent / 100 * item.prevYearValue)) * 100
      : null,
    unitsDelta: item.prevYearUnits > 0
      ? item.totalUnits - item.prevYearUnits
      : null,
  };
}
```

- [ ] **Step 3: Verify client TS build**

Run: `cd client && npx tsc -b --noEmit`

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/shared/TrendArrow.tsx client/src/utils/items-deltas.ts
git commit -m "feat: add TrendArrow component and items delta computation utility"
```

---

### Task 7: Frontend — Items State + Toolbar (Compare Toggle + Reorder)

**Files:**
- Modify: `client/src/hooks/useItemsExplorer.ts`
- Modify: `client/src/components/right-panel/ItemsToolbar.tsx`
- Modify: `client/src/components/right-panel/ItemsExplorer.tsx`
- Modify: `client/src/utils/items-grouping.ts`

- [ ] **Step 1: Add showCompare to useItemsExplorer state**

In `useItemsExplorer.ts`, add to the `State` interface (after line 20):

```typescript
  showCompare: boolean;
```

Add to `Action` type (after line 30):

```typescript
  | { type: 'toggleCompare' };
```

Add to `INITIAL` (after line 38):

```typescript
  showCompare: false,
```

Add case to `reducer` (before the `reset` case):

```typescript
    case 'toggleCompare':
      return { ...state, showCompare: !state.showCompare };
```

Add callback in the return object (after line 105):

```typescript
  const toggleCompare = useCallback(() => dispatch({ type: 'toggleCompare' }), []);
```

Add `toggleCompare` to the return object (after line 119):

```typescript
    toggleCompare,
```

- [ ] **Step 2: Add new sort fields to items-grouping.ts**

In `client/src/utils/items-grouping.ts`, find the `ItemSortField` type and add the new fields:

```typescript
export type ItemSortField = 'name' | 'value' | 'marginPercent' | 'marginAmount' | 'totalUnits' | 'purchaseFrequency' | 'lastPrice';
```

Also update the `sortFlatItems` function's comparator to handle the new fields. They are all `number` type, so the existing numeric comparison logic should work — just ensure the field names are included in the switch/if chain.

- [ ] **Step 3: Reorder toolbar icons and add Compare toggle**

In `ItemsToolbar.tsx`, change the icon order in the JSX (lines 61-69) from `Group → Sort → Filter` to `Filter → Sort → Group`, then add Compare:

```tsx
        <ToolbarIcon panel="filter" openPanel={openPanel} onToggle={toggle} badge={activeFilterCount > 0 ? activeFilterCount : null}
          icon={<><path d="M3 4h14M5 9h10M7 14h6" /></>} />

        <ToolbarIcon panel="sort" openPanel={openPanel} onToggle={toggle} badge={null}
          label={sortDirection === 'asc' ? '↑' : '↓'}
          icon={<><path d="M6 4v12M6 4l-3 3M6 4l3 3" /><path d="M14 16V4M14 16l-3-3M14 16l3-3" /></>} />

        <ToolbarIcon panel="group" openPanel={openPanel} onToggle={toggle} badge={groupLevels.length > 0 ? groupLevels.length : null}
          icon={<><rect x="3" y="3" width="14" height="3" rx="1" /><rect x="5" y="9" width="10" height="3" rx="1" /><rect x="7" y="15" width="6" height="3" rx="1" /></>} />

        {/* Compare toggle — not a panel, just a button */}
        <button type="button" onClick={onToggleCompare}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 ${
            showCompare ? 'bg-[var(--color-gold-primary)] text-white'
            : 'border border-[var(--color-gold-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-gold-primary)] hover:text-[var(--color-text-secondary)]'
          }`}
          aria-label="Compare with previous year" aria-pressed={showCompare}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="10" width="4" height="7" rx="1" /><rect x="8" y="6" width="4" height="11" rx="1" /><rect x="13" y="3" width="4" height="14" rx="1" />
          </svg>
        </button>
```

Also add `showCompare: boolean; onToggleCompare: () => void;` to `ItemsToolbarProps`.

- [ ] **Step 4: Update ItemsExplorer to pass new props**

In `ItemsExplorer.tsx`, add to the `ItemsToolbar` props:

```tsx
        showCompare={explorer.showCompare}
        onToggleCompare={explorer.toggleCompare}
```

And add to the `ItemsTable` props:

```tsx
          showCompare={explorer.showCompare}
```

- [ ] **Step 5: Verify client TS build**

Run: `cd client && npx tsc -b --noEmit`

Expected: TypeScript errors in ItemsTable (missing `showCompare` prop) — that's expected, we'll fix it in the next task.

- [ ] **Step 6: Commit**

```bash
git add client/src/hooks/useItemsExplorer.ts client/src/components/right-panel/ItemsToolbar.tsx client/src/components/right-panel/ItemsExplorer.tsx client/src/utils/items-grouping.ts
git commit -m "feat: add compare toggle to Items toolbar, reorder icons to Filter→Sort→Group→Compare"
```

---

### Task 8: Frontend — Enhanced Items Table + Product Row

**Files:**
- Modify: `client/src/components/right-panel/ItemsTable.tsx`
- Modify: `client/src/components/right-panel/ItemsProductRow.tsx`
- Create: `client/src/components/right-panel/ItemsCompareRow.tsx`
- Modify: `client/src/components/right-panel/ItemsGroupRow.tsx`

- [ ] **Step 1: Update ItemsTable column definitions and accept showCompare prop**

In `ItemsTable.tsx`, update the COLUMNS array:

```typescript
const COLUMNS: { label: string; field: ItemSortField | null; width: string }[] = [
  { label: 'Product', field: 'name', width: 'flex-1' },
  { label: 'Value', field: 'value', width: 'w-24' },
  { label: 'Avg Margin %', field: 'marginPercent', width: 'w-24' },
  { label: 'Margin $', field: 'marginAmount', width: 'w-24' },
  { label: 'Units', field: 'totalUnits', width: 'w-24' },
  { label: 'Freq', field: 'purchaseFrequency', width: 'w-20' },
  { label: 'Last $', field: 'lastPrice', width: 'w-24' },
  { label: 'Last Order', field: null, width: 'w-24' },
];
```

Add `showCompare: boolean` to `ItemsTableProps` and pass it to `ItemsProductRow`.

- [ ] **Step 2: Update ItemsProductRow with new cells, trend arrows, and compare sub-row**

Rewrite `ItemsProductRow.tsx` to include the 4 new data cells, `TrendArrow` components, and conditionally render `ItemsCompareRow`:

The row now shows:
- Product name + SKU (existing)
- Value + TrendArrow
- Avg Margin % + TrendArrow
- Margin $ + TrendArrow
- Units (e.g. "54 cs") + TrendArrow
- Freq (e.g. "4.2/mo")
- Last $ (unit price)
- Last Order (days-ago + colored activity dot)

Use `formatDays()` from `@shared/utils/formatting` for the last order display. Reuse the `getActivityStatus()` color thresholds.

- [ ] **Step 3: Create ItemsCompareRow**

```typescript
// FILE: client/src/components/right-panel/ItemsCompareRow.tsx
// PURPOSE: YoY delta sub-row shown when Compare toggle is active
// USED BY: ItemsProductRow.tsx
// EXPORTS: ItemsCompareRow

import type { FlatItem } from '@shared/types/dashboard';
import { computeItemDeltas } from '../../utils/items-deltas';

interface Props {
  item: FlatItem;
  paddingLeft: string;
}

export function ItemsCompareRow({ item, paddingLeft }: Props) {
  const d = computeItemDeltas(item);
  const hasPrev = item.prevYearValue > 0;
  if (!hasPrev) return null;

  return (
    <div
      className="flex items-center border-b border-[var(--color-bg-page)] py-[2px] text-[10px]"
      style={{ paddingLeft, paddingRight: 'var(--spacing-3xl)' }}
    >
      <div className="flex-1" />
      <DeltaCell value={d.valueDelta} suffix="%" width="w-24" />
      <DeltaCell value={d.marginDelta} suffix="pp" width="w-24" />
      <DeltaCell value={d.marginAmountDelta} suffix="%" width="w-24" />
      <DeltaCell value={d.unitsDelta} suffix=" units" isAbsolute width="w-24" />
      <div className="w-20" />
      <div className="w-24" />
      <div className="w-24" />
    </div>
  );
}

function DeltaCell({ value, suffix, isAbsolute, width }: {
  value: number | null; suffix: string; isAbsolute?: boolean; width: string;
}) {
  if (value === null) return <div className={`${width} text-right text-[var(--color-text-faint)]`}>—</div>;
  const isPositive = value > 0;
  const color = isPositive ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]';
  const sign = isPositive ? '+' : '';
  const formatted = isAbsolute ? `${sign}${Math.round(value)}` : `${sign}${value.toFixed(1)}`;
  return <div className={`${width} text-right ${color}`}>{formatted}{suffix}</div>;
}
```

- [ ] **Step 4: Update ItemsGroupRow with new column placeholders**

In `ItemsGroupRow.tsx`, add 4 new cells after the existing 3 metric cells. These show "—" because aggregated values don't make sense for per-SKU fields:

```tsx
      <span role="gridcell" className="w-24 text-right text-[13px] text-[var(--color-text-faint)]">—</span>
      <span role="gridcell" className="w-20 text-right text-[13px] text-[var(--color-text-faint)]">—</span>
      <span role="gridcell" className="w-24 text-right text-[13px] text-[var(--color-text-faint)]">—</span>
      <span role="gridcell" className="w-24 text-right text-[13px] text-[var(--color-text-faint)]">—</span>
```

- [ ] **Step 5: Verify both TS builds pass**

Run: `cd client && npx tsc -b --noEmit && cd ../server && npx tsc --noEmit`

Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/right-panel/ItemsTable.tsx client/src/components/right-panel/ItemsProductRow.tsx client/src/components/right-panel/ItemsCompareRow.tsx client/src/components/right-panel/ItemsGroupRow.tsx
git commit -m "feat: enhanced Items table with units, freq, last order, trend arrows, compare sub-rows"
```

---

### Task 9: Design Polish — Chart Height, Text Sizes, Remove max-w

**Files:**
- Modify: `client/src/components/right-panel/YoYBarChart.tsx:15`
- Modify: `client/src/components/right-panel/KPICard.tsx`
- Modify: `client/src/components/right-panel/HeroRevenueCard.tsx`
- Modify: `client/src/components/right-panel/OrdersTable.tsx`
- Modify: `client/src/components/right-panel/ItemsTable.tsx`

- [ ] **Step 1: Increase hero chart height**

In `YoYBarChart.tsx`, change line 15:

```typescript
const CHART_HEIGHT = 180;
```

(was 120 — BAR_AREA_HEIGHT auto-adjusts since it's computed from CHART_HEIGHT)

- [ ] **Step 2: Bump KPI card detail text sizes**

In `KPICard.tsx`, find the sub-items section and change:
- Sub-item labels: `text-[9px]` → `text-[10px]`
- Sub-item values: `text-[12px]` → `text-[13px]`
- Sub-item suffixes: `text-[9px]` → `text-[10px]`

- [ ] **Step 3: Bump hero card prev year text sizes**

In `HeroRevenueCard.tsx`:
- Prev year labels (lines 58, 69): `text-[10px]` → `text-[11px]`
- YTD prev year value (line 61): `text-[16px]` → `text-[18px]`
- Full prev year value (line 72): `text-[14px]` → `text-[16px]`

- [ ] **Step 4: Remove max-w constraints from tables**

In `OrdersTable.tsx`, change:
```typescript
<table className="w-full max-w-[1100px] border-collapse">
```
to:
```typescript
<table className="w-full border-collapse">
```

In `ItemsTable.tsx`, change:
```typescript
<div className="min-w-[600px] max-w-[1100px]"
```
to:
```typescript
<div className="min-w-[600px]"
```

- [ ] **Step 5: Verify build**

Run: `cd client && npx tsc -b --noEmit`

Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/right-panel/YoYBarChart.tsx client/src/components/right-panel/KPICard.tsx client/src/components/right-panel/HeroRevenueCard.tsx client/src/components/right-panel/OrdersTable.tsx client/src/components/right-panel/ItemsTable.tsx
git commit -m "fix: design polish — taller chart, larger text, remove table max-width"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run all server tests**

Run: `cd server && npx vitest run`

Expected: All tests pass (existing + new). Zero failures.

- [ ] **Step 2: Run both TS builds**

Run: `cd client && npx tsc -b --noEmit && cd ../server && npx tsc --noEmit`

Expected: Clean build, zero errors.

- [ ] **Step 3: Run client build**

Run: `cd client && npx vite build`

Expected: Build succeeds, bundle < 500KB gzip.

- [ ] **Step 4: Check for any types**

Run: `grep -rn ": any\|as any" server/src/ client/src/`

Expected: Zero matches.

- [ ] **Step 5: Check file lengths**

Run: `find client/src server/src -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -10`

Expected: No file exceeds 200 lines.

- [ ] **Step 6: Visual verification with Claude Preview**

Start both dev servers and verify:
- Orders tab: "Items Summary" section visible below orders with SKU aggregation
- Items tab: 8 columns visible (Product, Value, Avg Margin %, Margin $, Units, Freq, Last $, Last Order)
- Items tab: Green ▲ / Red ▼ arrows visible next to metric values
- Items tab: Compare toggle in toolbar activates delta sub-rows
- Items toolbar order: Search → Filter → Sort → Group → Compare
- Hero chart: taller bars, more usable
- KPI cards: larger text in expanded details

- [ ] **Step 7: Commit and push**

```bash
git push origin main
```
