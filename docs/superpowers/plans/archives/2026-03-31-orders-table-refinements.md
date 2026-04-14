# Orders Table Refinements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filter zero-amount orders, add expandable rows with line item details, and display raw Priority ERP status names in the Orders tab.

**Architecture:** Server-side changes to `aggregateOrders()` filter $0 orders and pass line items through; shared types updated; frontend `OrdersTable` gains expand/collapse state with a new `OrderLineItems` sub-component. All three changes are layered bottom-up: types first, server logic, then UI.

**Tech Stack:** TypeScript strict, Vitest, React 19, Framer Motion 12, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-31-orders-table-refinements-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `shared/types/dashboard.ts` | Modify | Add `OrderLineItem`, update `OrderRow` (new `items` field, change `status` type) |
| `server/src/config/constants.ts` | Modify | Remove `ORDER_STATUS_MAP`, remove its import in aggregator |
| `server/src/services/data-aggregator.ts` | Modify | Filter zero-amount orders, map line items, pass raw status |
| `server/tests/services/data-aggregator.test.ts` | Modify | Fix factory, add 8 new tests, update 1 existing test |
| `client/src/components/right-panel/OrdersTable.tsx` | Modify | Add chevron column, expand state, AnimatePresence, new status badges |
| `client/src/components/right-panel/OrderLineItems.tsx` | Create | Sub-table for expanded order line items |

---

## Task 1: Fix test factory + update status test (TDD prep)

**Files:**
- Modify: `server/tests/services/data-aggregator.test.ts`

The existing `makeOrder()` factory uses wrong field names (`PARTDES` instead of `PDES`, `AGENTDES` instead of `AGENTNAME`, includes nonexistent `COST` field). Fix this first so all subsequent tests use correct shapes. Also add `makeItem()` factory.

- [ ] **Step 1: Update `makeOrder()` and add `makeItem()` factory**

Replace lines 6-28 of `server/tests/services/data-aggregator.test.ts`:

```ts
function makeItem(overrides: Partial<RawOrderItem> = {}): RawOrderItem {
  return {
    PDES: 'Widget A',
    PARTNAME: 'WGT-A',
    TQUANT: 100,
    TUNITNAME: 'ea',
    QPRICE: 5000,
    PRICE: 50,
    PURCHASEPRICE: 30,
    QPROFIT: 2000,
    PERCENT: 40,
    Y_1159_5_ESH: 'V01',
    Y_1530_5_ESH: 'Vendor One',
    Y_9952_5_ESH: 'BrandX',
    Y_3020_5_ESH: 'FAM1',
    Y_3021_5_ESH: 'Packaging',
    Y_17936_5_ESH: 'VP-001',
    Y_2075_5_ESH: 'Family A',
    Y_5380_5_ESH: 'USA',
    Y_9967_5_ESH: 'N',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    ORDNAME: 'ORD-001',
    CURDATE: '2026-02-15T00:00:00Z',
    ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000,
    CUSTNAME: 'C001',
    AGENTCODE: 'A01',
    AGENTNAME: 'Sarah M.',
    ORDERITEMS_SUBFORM: [makeItem()],
    ...overrides,
  };
}
```

Also add the `RawOrderItem` import on line 4:

```ts
import type { RawOrder, RawOrderItem } from '../../src/services/priority-queries';
```

- [ ] **Step 2: Update existing tests that use the old inline item pattern**

Replace all instances of `{ ...makeOrder().ORDERITEMS_SUBFORM[0], <overrides> }` with `makeItem({ <overrides> })`. These occur on lines 64, 65, 92, 93, 104, 147, 149, 161, 162, 171, 183-185, 204-206.

For example, change:
```ts
{ ...makeOrder().ORDERITEMS_SUBFORM[0], QPROFIT: 2000, QPRICE: 5000 },
```
To:
```ts
makeItem({ QPROFIT: 2000, QPRICE: 5000 }),
```

- [ ] **Step 3: Run all existing tests to verify no regressions**

Run: `cd server && npx vitest run tests/services/data-aggregator.test.ts`

Expected: All 17 tests pass. The factory fix should not change any test behavior — it only corrects field names and removes phantom fields that were never accessed by the aggregator.

- [ ] **Step 4: Update the status test to expect raw Priority values**

Replace the test `'maps order statuses to dashboard labels'` with:

```ts
it('passes Priority ORDSTATUSDES through as status', () => {
  const orders = [
    makeOrder({ ORDNAME: 'O1', ORDSTATUSDES: 'Closed' }),
    makeOrder({ ORDNAME: 'O2', ORDSTATUSDES: 'Open' }),
    makeOrder({ ORDNAME: 'O3', ORDSTATUSDES: 'Partially Filled' }),
  ];
  const result = aggregateOrders(orders, [], 'ytd');
  expect(result.orders[0].status).toBe('Closed');
  expect(result.orders[1].status).toBe('Open');
  expect(result.orders[2].status).toBe('Partially Filled');
});
```

- [ ] **Step 5: Run to verify the status test fails (RED)**

Run: `cd server && npx vitest run tests/services/data-aggregator.test.ts`

Expected: FAIL — the test expects `'Closed'` but `buildOrderRows` returns `'Delivered'` (the mapped value). This confirms the test is correctly asserting the new behavior.

- [ ] **Step 6: Commit factory fix + passing tests only**

The status test from Step 4 will fail (expected — implementation comes in Task 3). Temporarily revert the status test before committing, then re-apply it in Task 3.

```bash
# Revert just the status test change (keep factory + makeItem fixes)
# Option: use git stash -p, or simply leave the old test text in place for now
# and replace it fresh in Task 3 Step 1.
cd server && git add tests/services/data-aggregator.test.ts
git commit -m "test: fix makeOrder factory field names, add makeItem helper

Corrects PARTDES→PDES, AGENTDES→AGENTNAME, removes phantom COST field.
Adds separate makeItem() factory for cleaner per-item overrides."
```

**Simpler approach:** Skip Step 4-5 here entirely. Write the status test in Task 3 alongside the implementation. The factory fix and makeItem refactor are the deliverables of this task.

---

## Task 2: Zero-amount filter (TDD — Batch A)

**Files:**
- Modify: `server/tests/services/data-aggregator.test.ts`
- Modify: `server/src/services/data-aggregator.ts`

- [ ] **Step 1: Write 3 failing tests (RED)**

Add to the `describe('aggregateOrders')` block:

```ts
it('excludes orders with TOTPRICE === 0 from orders array', () => {
  const orders = [
    makeOrder({ ORDNAME: 'O1', TOTPRICE: 5000 }),
    makeOrder({ ORDNAME: 'O2', TOTPRICE: 0 }),
    makeOrder({ ORDNAME: 'O3', TOTPRICE: 1000 }),
  ];
  const result = aggregateOrders(orders, [], 'ytd');
  expect(result.orders).toHaveLength(2);
  expect(result.orders.map(o => o.orderNumber)).not.toContain('O2');
});

it('excludes zero-amount orders from KPI order count', () => {
  const orders = [
    makeOrder({ ORDNAME: 'O1', TOTPRICE: 5000 }),
    makeOrder({ ORDNAME: 'O2', TOTPRICE: 0 }),
  ];
  const result = aggregateOrders(orders, [], 'ytd');
  expect(result.kpis.orders).toBe(1);
});

it('keeps orders with negative TOTPRICE (credit memos)', () => {
  const orders = [
    makeOrder({ ORDNAME: 'O1', TOTPRICE: -500 }),
  ];
  const result = aggregateOrders(orders, [], 'ytd');
  expect(result.orders).toHaveLength(1);
  expect(result.orders[0].orderNumber).toBe('O1');
});
```

- [ ] **Step 2: Run to verify failures (RED)**

Run: `cd server && npx vitest run tests/services/data-aggregator.test.ts`

Expected: First 2 tests FAIL (zero-amount orders are currently included). Third test should PASS (negative orders are already included). If the third passes, that's fine — it's a regression guard.

- [ ] **Step 3: Implement zero-amount filter (GREEN)**

In `server/src/services/data-aggregator.ts`, modify `aggregateOrders()`. Replace lines 26-33:

```ts
export function aggregateOrders(
  currentOrders: RawOrder[],
  prevOrders: RawOrder[],
  period: string,
): AggregateResult {
  /** WHY: $0 orders are noise — no revenue, no margin contribution. Filter before all downstream
   * consumers so both order rows and KPI counts are consistent. Negative totals (credit memos) kept. */
  const nonZeroOrders = currentOrders.filter(o => o.TOTPRICE !== 0);
  const allItems = nonZeroOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
  const prevItems = prevOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);

  const kpis = computeKPIs(nonZeroOrders, prevOrders, allItems, prevItems, period);
  const monthlyRevenue = computeMonthlyRevenue(nonZeroOrders, prevOrders);
  const productMixes = computeAllProductMixes(allItems);
  const topSellers = computeTopSellers(allItems);
  const sparklines = computeSparklines(nonZeroOrders);
  const orders = buildOrderRows(nonZeroOrders);
  const items = buildItemCategories(allItems);

  return { kpis, monthlyRevenue, productMixes, topSellers, sparklines, orders, items };
}
```

- [ ] **Step 4: Run tests (GREEN)**

Run: `cd server && npx vitest run tests/services/data-aggregator.test.ts`

Expected: All tests pass (including the 3 new ones). The existing `'computes order count'` test still passes because its orders have `TOTPRICE: 10000`.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/data-aggregator.ts server/tests/services/data-aggregator.test.ts
git commit -m "feat: filter zero-amount orders from dashboard

Orders with TOTPRICE === 0 excluded from both the orders table and
KPI counts. Credit memos (negative totals) are kept."
```

---

## Task 3: Raw Priority status + remove ORDER_STATUS_MAP (TDD — Batch C)

**Files:**
- Modify: `shared/types/dashboard.ts`
- Modify: `server/src/config/constants.ts`
- Modify: `server/src/services/data-aggregator.ts`

- [ ] **Step 1: The failing status test from Task 1 Step 4 is already written**

If not yet added, add it now (see Task 1 Step 4). Verify it fails.

Run: `cd server && npx vitest run tests/services/data-aggregator.test.ts -t "passes Priority ORDSTATUSDES through"`

Expected: FAIL — expects `'Closed'` but gets `'Delivered'`.

- [ ] **Step 2: Update `OrderRow.status` type in shared types (GREEN prep)**

In `shared/types/dashboard.ts`, change line 122:

```ts
// Before:
status: 'Delivered' | 'Pending' | 'Processing';

// After:
status: 'Open' | 'Closed' | 'Partially Filled';
```

- [ ] **Step 3: Remove `ORDER_STATUS_MAP` from constants**

In `server/src/config/constants.ts`, delete lines 63-68:

```ts
// DELETE:
export const ORDER_STATUS_MAP: Record<string, 'Delivered' | 'Pending' | 'Processing'> = {
  Closed: 'Delivered',
  'Partially Filled': 'Pending',
  Open: 'Processing',
};
```

- [ ] **Step 4: Remove the import in data-aggregator.ts**

In `server/src/services/data-aggregator.ts`, change line 8:

```ts
// Before:
import { ORDER_STATUS_MAP } from '../config/constants.js';

// After: (delete this line entirely)
```

- [ ] **Step 5: Update `buildOrderRows()` to pass status through**

In `server/src/services/data-aggregator.ts`, in `buildOrderRows()`, change line 119:

```ts
// Before:
status: (ORDER_STATUS_MAP[o.ORDSTATUSDES] ?? 'Processing') as OrderRow['status'],

// After:
status: o.ORDSTATUSDES as OrderRow['status'],
```

- [ ] **Step 6: Run tests (GREEN)**

Run: `cd server && npx vitest run tests/services/data-aggregator.test.ts`

Expected: All tests pass. The updated status test now sees `'Closed'`, `'Open'`, `'Partially Filled'`.

- [ ] **Step 7: Verify no stale references to ORDER_STATUS_MAP**

Run: `grep -rn "ORDER_STATUS_MAP" server/src/ shared/`

Expected: Zero matches.

- [ ] **Step 8: Commit**

```bash
git add shared/types/dashboard.ts server/src/config/constants.ts server/src/services/data-aggregator.ts server/tests/services/data-aggregator.test.ts
git commit -m "feat: show raw Priority status names (Open/Closed/Partially Filled)

Remove ORDER_STATUS_MAP. Pass ORDSTATUSDES through directly instead of
mapping to Delivered/Pending/Processing."
```

---

## Task 4: Add `OrderLineItem` type + server line item mapping (TDD — Batch B)

**Files:**
- Modify: `shared/types/dashboard.ts`
- Modify: `server/src/services/data-aggregator.ts`
- Modify: `server/tests/services/data-aggregator.test.ts`

- [ ] **Step 1: Write 5 failing tests (RED)**

Add to `describe('aggregateOrders')`:

```ts
it('includes line items array on each order row', () => {
  const orders = [makeOrder({
    ORDNAME: 'O1',
    ORDERITEMS_SUBFORM: [
      makeItem({ PARTNAME: 'SKU-A', QPRICE: 3000 }),
      makeItem({ PARTNAME: 'SKU-B', QPRICE: 1000 }),
    ],
  })];
  const result = aggregateOrders(orders, [], 'ytd');
  expect(result.orders[0].items).toHaveLength(2);
});

it('maps line item fields to OrderLineItem shape', () => {
  const orders = [makeOrder({
    ORDERITEMS_SUBFORM: [
      makeItem({
        PDES: 'Olive Oil 1L',
        PARTNAME: 'OIL-1L',
        TQUANT: 24,
        TUNITNAME: 'cs',
        PRICE: 60,
        QPRICE: 1440,
        PERCENT: 28.33,
      }),
    ],
  })];
  const result = aggregateOrders(orders, [], 'ytd');
  const item = result.orders[0].items[0];
  expect(item.productName).toBe('Olive Oil 1L');
  expect(item.sku).toBe('OIL-1L');
  expect(item.quantity).toBe(24);
  expect(item.unit).toBe('cs');
  expect(item.unitPrice).toBe(60);
  expect(item.lineTotal).toBe(1440);
  expect(item.marginPercent).toBeCloseTo(28.33);
});

it('sorts line items by lineTotal descending', () => {
  const orders = [makeOrder({
    ORDERITEMS_SUBFORM: [
      makeItem({ PARTNAME: 'SKU-A', QPRICE: 500 }),
      makeItem({ PARTNAME: 'SKU-B', QPRICE: 2000 }),
      makeItem({ PARTNAME: 'SKU-C', QPRICE: 800 }),
    ],
  })];
  const result = aggregateOrders(orders, [], 'ytd');
  const skus = result.orders[0].items.map(i => i.sku);
  expect(skus).toEqual(['SKU-B', 'SKU-C', 'SKU-A']);
});

it('defaults unit to "units" when TUNITNAME is empty on line item', () => {
  const orders = [makeOrder({
    ORDERITEMS_SUBFORM: [makeItem({ TUNITNAME: '' })],
  })];
  const result = aggregateOrders(orders, [], 'ytd');
  expect(result.orders[0].items[0].unit).toBe('units');
});

it('returns empty items array when order has no ORDERITEMS_SUBFORM', () => {
  const orders = [makeOrder({ ORDERITEMS_SUBFORM: [] })];
  const result = aggregateOrders(orders, [], 'ytd');
  expect(result.orders[0].items).toEqual([]);
});
```

- [ ] **Step 2: Run to verify failures (RED)**

Run: `cd server && npx vitest run tests/services/data-aggregator.test.ts`

Expected: All 5 new tests FAIL — `result.orders[0].items` is `undefined` because `OrderRow` doesn't have an `items` field yet.

- [ ] **Step 3: Add `OrderLineItem` type to shared types**

In `shared/types/dashboard.ts`, add before the `OrderRow` interface (around line 114):

```ts
/** One line item inside an expanded order row */
export interface OrderLineItem {
  productName: string;   // PDES
  sku: string;           // PARTNAME
  quantity: number;      // TQUANT
  unit: string;          // TUNITNAME, fallback "units"
  unitPrice: number;     // PRICE
  lineTotal: number;     // QPRICE
  marginPercent: number; // PERCENT
}
```

Update `OrderRow` to include `items`:

```ts
export interface OrderRow {
  date: string;
  orderNumber: string;
  itemCount: number;
  amount: number;
  marginPercent: number;
  marginAmount: number;
  status: 'Open' | 'Closed' | 'Partially Filled';
  items: OrderLineItem[];
}
```

Update the `EXPORTS` comment at line 4 to include `OrderLineItem`.

- [ ] **Step 4: Map line items in `buildOrderRows()` (GREEN)**

In `server/src/services/data-aggregator.ts`, add the `OrderLineItem` import at line 6:

```ts
import type { KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType, TopSellerItem, OrderRow, OrderLineItem, ItemCategory, SparklineData } from '@shared/types/dashboard';
```

Update the `buildOrderRows()` function to include line items. The return in `.map()` becomes:

```ts
function buildOrderRows(orders: RawOrder[]): OrderRow[] {
  return orders
    .map(o => ({
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
    }));
    // WHY: Client-side OrdersTable handles sorting — users can change direction
}
```

- [ ] **Step 5: Run tests (GREEN)**

Run: `cd server && npx vitest run tests/services/data-aggregator.test.ts`

Expected: All tests pass (the original 17 + the 3 from Task 2 + the updated status test + these 5 = 25 total in this file).

- [ ] **Step 6: Run full server test suite**

Run: `cd server && npx vitest run`

Expected: All server tests pass (63+ total).

- [ ] **Step 7: Run TypeScript checks**

Run: `cd server && npx tsc --noEmit && cd ../client && npx tsc -b --noEmit`

Expected: Zero errors. The client will error if `OrdersTable` still references `'Delivered' | 'Pending' | 'Processing'` — that's expected and will be fixed in Task 5.

**Note:** If the client TS check fails, that's fine — the frontend hasn't been updated yet. Just verify the server TS check passes.

- [ ] **Step 8: Commit**

```bash
git add shared/types/dashboard.ts server/src/services/data-aggregator.ts server/tests/services/data-aggregator.test.ts
git commit -m "feat: pass order line items to client in OrderRow.items

Map ORDERITEMS_SUBFORM fields to OrderLineItem[], sorted by lineTotal
descending. No new API calls — data already fetched."
```

---

## Task 5: Update `OrdersTable.tsx` — status badges, chevron, expand state

**Files:**
- Modify: `client/src/components/right-panel/OrdersTable.tsx`

**Reference patterns:**
- Chevron SVG + CSS rotation: `client/src/components/right-panel/ItemsAccordion.tsx:94-103`
- AnimatePresence + height animation: `ItemsAccordion.tsx:126-164`
- CopyableId with stopPropagation: `client/src/components/shared/CopyableId.tsx:19-24`

- [ ] **Step 1: Rewrite `OrdersTable.tsx`**

Replace the entire file content. The new version adds:
- `useState<string | null>(null)` for expand state
- A leading chevron column (32px)
- Click handler on `<tr>` to toggle expand
- Updated `STATUS_STYLES` with raw Priority status names + fallback
- `AnimatePresence initial={false}` for expanded row
- Import of the new `OrderLineItems` component (created in Task 6)

```tsx
// FILE: client/src/components/right-panel/OrdersTable.tsx
// PURPOSE: Orders data table with expandable rows showing line item details
// USED BY: TabsSection (Orders tab)
// EXPORTS: OrdersTable

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OrderRow } from '@shared/types/dashboard';
import { formatCurrency, formatPercent, formatDate } from '@shared/utils/formatting';
import { CopyableId } from '../shared/CopyableId';
import { EmptyState } from '../shared/EmptyState';
import { OrderLineItems } from './OrderLineItems';

interface OrdersTableProps {
  orders: OrderRow[];
}

const COLUMNS = ['', 'Date', 'Order #', 'Items', 'Amount', 'Margin %', 'Margin $', 'Status'] as const;

/** WHY: Raw Priority status names — spec Section 10.4 */
const STATUS_STYLES: Record<string, string> = {
  Open: 'bg-[#dbeafe] text-[var(--color-blue)]',
  Closed: 'bg-[#dcfce7] text-[var(--color-green)]',
  'Partially Filled': 'bg-[#fef9c3] text-[var(--color-yellow)]',
};
const DEFAULT_STATUS_STYLE = 'bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)]';

export function OrdersTable({ orders }: OrdersTableProps) {
  /** WHY: string | null not Set — only one row open at a time (accordion behavior) */
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders for this period."
        description="Orders will appear here when available."
      />
    );
  }

  function toggleRow(orderNumber: string) {
    setExpandedOrder(prev => (prev === orderNumber ? null : orderNumber));
  }

  const sorted = [...orders].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--color-gold-subtle)]">
            {COLUMNS.map((col, i) => (
              <th
                key={col || 'chevron'}
                className={`px-[var(--spacing-3xl)] py-[var(--spacing-lg)] text-left text-[11px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide whitespace-nowrap ${
                  i === 0 ? 'w-8 px-0 pl-[var(--spacing-3xl)]' : ''
                }`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((order) => {
            const isExpanded = expandedOrder === order.orderNumber;
            return (
              <OrderRowGroup
                key={order.orderNumber}
                order={order}
                isExpanded={isExpanded}
                onToggle={() => toggleRow(order.orderNumber)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --- Single order row + expandable detail --- */

interface OrderRowGroupProps {
  order: OrderRow;
  isExpanded: boolean;
  onToggle: () => void;
}

function OrderRowGroup({ order, isExpanded, onToggle }: OrderRowGroupProps) {
  return (
    <>
      <tr
        className="border-b border-[var(--color-bg-page)] cursor-pointer hover:bg-[var(--color-gold-hover)] transition-colors duration-150"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        aria-expanded={isExpanded}
      >
        {/* Chevron — CSS rotation, matching ItemsAccordion pattern */}
        <td className="w-8 px-0 pl-[var(--spacing-3xl)] py-[var(--spacing-base)]">
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none"
            className={`shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            aria-hidden="true"
          >
            <path d="M5 3l4 4-4 4" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </td>
        <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-primary)] whitespace-nowrap">
          {formatDate(order.date)}
        </td>
        <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] font-medium text-[var(--color-text-primary)]">
          <CopyableId value={order.orderNumber} label="Order #" />
        </td>
        <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-secondary)] text-center">
          {order.itemCount}
        </td>
        <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-primary)] tabular-nums">
          {formatCurrency(order.amount)}
        </td>
        <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-secondary)] tabular-nums">
          {formatPercent(order.marginPercent)}
        </td>
        <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-secondary)] tabular-nums">
          {formatCurrency(order.marginAmount)}
        </td>
        <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)]">
          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLES[order.status] ?? DEFAULT_STATUS_STYLE}`}>
            {order.status}
          </span>
        </td>
      </tr>

      {/* Expanded line items — AnimatePresence with initial={false} to prevent mount animation */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <tr key={`${order.orderNumber}-detail`}>
            <td colSpan={8} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <OrderLineItems items={order.items} />
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2: Verify line count**

Run: `wc -l client/src/components/right-panel/OrdersTable.tsx`

Expected: Under 200 lines.

- [ ] **Step 3: Run client TypeScript check**

Run: `cd client && npx tsc -b --noEmit`

Expected: Will error because `OrderLineItems` doesn't exist yet. That's Task 6.

---

## Task 6: Create `OrderLineItems.tsx` sub-component

**Files:**
- Create: `client/src/components/right-panel/OrderLineItems.tsx`

**Reference:** `client/src/components/right-panel/ItemsAccordion.tsx:136-161` (product row styling)

- [ ] **Step 1: Create the component**

Create `client/src/components/right-panel/OrderLineItems.tsx`:

```tsx
// FILE: client/src/components/right-panel/OrderLineItems.tsx
// PURPOSE: Sub-table showing line item details for an expanded order row
// USED BY: OrdersTable (expanded row)
// EXPORTS: OrderLineItems

import type { OrderLineItem } from '@shared/types/dashboard';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';
import { CopyableId } from '../shared/CopyableId';

interface OrderLineItemsProps {
  items: OrderLineItem[];
}

const COLUMNS = ['Product', 'SKU', 'Qty', 'Unit Price', 'Line Total', 'Margin %'] as const;

export function OrderLineItems({ items }: OrderLineItemsProps) {
  if (items.length === 0) {
    return (
      <div className="bg-[var(--color-bg-page)] py-[var(--spacing-base)]" style={{ paddingLeft: '48px' }}>
        <span className="text-[12px] text-[var(--color-text-muted)]">
          No line item details available.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-bg-page)]">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {COLUMNS.map((col, i) => (
              <th
                key={col}
                className={`py-[var(--spacing-sm)] text-[10px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide ${
                  i <= 1 ? 'text-left' : 'text-right'
                } ${i === 0 ? 'pl-[48px] pr-[var(--spacing-base)]' : 'px-[var(--spacing-base)]'}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.sku}
              className="border-t border-[var(--color-gold-subtle)]/50"
            >
              <td className="pl-[48px] pr-[var(--spacing-base)] py-[var(--spacing-sm)] text-[12px] text-[var(--color-text-secondary)] truncate max-w-[200px]">
                {item.productName}
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-sm)] text-[12px]">
                <CopyableId value={item.sku} label="SKU" className="text-[var(--color-text-faint)]" />
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-sm)] text-[12px] text-[var(--color-text-secondary)] tabular-nums text-right">
                {item.quantity} {item.unit}
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-sm)] text-[12px] text-[var(--color-text-secondary)] tabular-nums text-right">
                {formatCurrency(item.unitPrice)}
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-sm)] text-[12px] text-[var(--color-text-primary)] tabular-nums text-right">
                {formatCurrency(item.lineTotal)}
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-sm)] text-[12px] text-[var(--color-text-secondary)] tabular-nums text-right pr-[var(--spacing-3xl)]">
                {formatPercent(item.marginPercent)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verify line count**

Run: `wc -l client/src/components/right-panel/OrderLineItems.tsx`

Expected: Under 200 lines (~85 lines).

- [ ] **Step 3: Run client TypeScript check**

Run: `cd client && npx tsc -b --noEmit`

Expected: Zero errors. Both `OrdersTable.tsx` and `OrderLineItems.tsx` compile.

- [ ] **Step 4: Run full TypeScript + no-any check**

Run: `cd server && npx tsc --noEmit && cd ../client && npx tsc -b --noEmit && grep -rn ": any\|as any" server/src/ client/src/`

Expected: Zero TS errors, zero `any` matches.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/right-panel/OrdersTable.tsx client/src/components/right-panel/OrderLineItems.tsx
git commit -m "feat: expandable order rows with line item sub-table

Click a row to see product name, SKU, qty, unit price, line total,
and margin % for each line item. Only one row expanded at a time."
```

---

## Task 7: Visual verification with browser

**Files:** None (read-only verification)

Start both dev servers and verify all three changes visually using browser tools.

- [ ] **Step 1: Start dev servers**

Run in two terminals:
- `cd server && npm run dev` (Express on :3001)
- `cd client && npm run dev` (Vite on :5173)

Or use Claude Preview if available: configure `.claude/launch.json` and use `preview_start`.

- [ ] **Step 2: Navigate to the dashboard**

Open `http://localhost:5173` in the browser. Select a customer (e.g., test customer `C7826`) to load the Orders tab.

- [ ] **Step 3: Verify zero-amount filter**

Take a screenshot of the Orders tab. Confirm:
- No orders with $0.00 in the Amount column
- The Orders badge count matches the visible row count
- Negative amounts (credit memos) are still visible if any exist

- [ ] **Step 4: Verify raw Priority status badges**

Take a screenshot focusing on the Status column. Confirm:
- Badges show "Open" (blue), "Closed" (green), or "Partially Filled" (yellow)
- No badges show "Delivered", "Pending", or "Processing" (old mapped names)

- [ ] **Step 5: Verify expandable rows — click to expand**

Click on any order row. Take a screenshot. Confirm:
- Chevron rotates 90 degrees smoothly (CSS transition)
- A sub-table appears below the row with beige background
- Sub-table shows 6 columns: Product, SKU, Qty, Unit Price, Line Total, Margin %
- Items are sorted by Line Total descending
- Animation is smooth (height slides open, 200ms)

- [ ] **Step 6: Verify single-expand accordion behavior**

With one row expanded, click a different row. Take a screenshot. Confirm:
- The first row collapses
- The second row expands
- Only one row is expanded at a time

- [ ] **Step 7: Verify CopyableId on SKU**

Hover over a SKU in the expanded sub-table. Take a screenshot. Confirm:
- Clipboard icon appears on hover
- Clicking the SKU does NOT collapse the row (stopPropagation works)

- [ ] **Step 8: Verify empty line items edge case**

If any order has zero items, confirm it shows "No line item details available."

---

## Task 8: Pre-deploy checks + final commit

**Files:** None new

- [ ] **Step 1: Run full server test suite**

Run: `cd server && npx vitest run`

Expected: All tests pass (63+ total, 25 in data-aggregator.test.ts).

- [ ] **Step 2: Run client TypeScript check**

Run: `cd client && npx tsc -b --noEmit`

Expected: Zero errors.

- [ ] **Step 3: Run server TypeScript check**

Run: `cd server && npx tsc --noEmit`

Expected: Zero errors.

- [ ] **Step 4: Run client build**

Run: `cd client && npx vite build`

Expected: Build succeeds, bundle under 500KB gzip.

- [ ] **Step 5: Check for any types**

Run: `grep -rn ": any\|as any" server/src/ client/src/`

Expected: Zero matches (the `as OrderRow['status']` cast is not `as any`).

- [ ] **Step 6: Verify ORDER_STATUS_MAP is fully removed**

Run: `grep -rn "ORDER_STATUS_MAP" server/ client/ shared/`

Expected: Zero matches outside of test files and the spec doc.

- [ ] **Step 7: Check file line counts**

Run:
```bash
wc -l client/src/components/right-panel/OrdersTable.tsx
wc -l client/src/components/right-panel/OrderLineItems.tsx
```

Expected: Both under 200 lines.
