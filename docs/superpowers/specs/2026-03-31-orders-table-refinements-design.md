# Orders Table Refinements — Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Three targeted improvements to the Orders tab — zero-amount filter, expandable rows, raw Priority status names

---

## Overview

| Change | Files touched |
|--------|--------------|
| 1. Filter orders with `TOTPRICE === 0` | `data-aggregator.ts`, `data-aggregator.test.ts` |
| 2. Expandable rows with line item sub-table | `shared/types/dashboard.ts`, `data-aggregator.ts`, `OrdersTable.tsx` (split), new `OrderLineItems.tsx` |
| 3. Raw Priority status names | `shared/types/dashboard.ts`, `constants.ts`, `data-aggregator.ts`, `OrdersTable.tsx`, `data-aggregator.test.ts` |

---

## Current State (what exists today)

- `OrdersTable.tsx` renders a 7-column `<table>` (Date, Order #, Items, Amount, Margin %, Margin $, Status)
- Status is mapped server-side via `ORDER_STATUS_MAP`: `Closed→Delivered`, `Open→Processing`, `Partially Filled→Pending`
- Zero-amount orders are included
- Line items are fetched from Priority (all 19 fields via `ORDERITEM_SELECT`) but discarded after computing KPI aggregates — never passed to the client

---

## Change 1: Zero-Amount Order Filter

### Rule
Exclude any `RawOrder` where `TOTPRICE === 0`. Credit memos with negative totals are kept.

### Location
Filter in `aggregateOrders()` in `data-aggregator.ts`, **before** passing to both `buildOrderRows()` and `computeKPIs()`. This ensures both the orders table and the KPI order count are consistent.

```ts
// In aggregateOrders(), replace:
const allItems = currentOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);

// With:
const nonZeroOrders = currentOrders.filter(o => o.TOTPRICE !== 0);
const allItems = nonZeroOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
// ... then pass nonZeroOrders to computeKPIs and buildOrderRows
```

### Why not filter in buildOrderRows() only?
If filtered only in `buildOrderRows()`, the KPI order count would still count $0 orders, creating a mismatch between the badge number and the KPI "Orders" card. Filtering in `aggregateOrders()` keeps both in sync.

### Tab badge count
The "Orders 40" badge is rendered from `orders.length` in `TabsSection`. Filtering server-side means the count is accurate automatically — no client change needed.

---

## Change 2: Expandable Order Rows

### 2a. New shared type — `OrderLineItem`

Add to `shared/types/dashboard.ts`:

```ts
/** One line item inside an expanded order row */
export interface OrderLineItem {
  productName: string;   // PDES
  sku: string;           // PARTNAME
  quantity: number;      // TQUANT
  unit: string;          // TUNITNAME (e.g. "cs", "ea", "lb"), fallback "units"
  unitPrice: number;     // PRICE
  lineTotal: number;     // QPRICE
  marginPercent: number; // PERCENT (Priority-computed per-line margin %)
}
```

### 2b. Update `OrderRow`

```ts
export interface OrderRow {
  date: string;
  orderNumber: string;
  itemCount: number;
  amount: number;
  marginPercent: number;
  marginAmount: number;
  status: 'Open' | 'Closed' | 'Partially Filled';  // raw Priority value (see Change 3)
  items: OrderLineItem[];                            // line details for expanded view
}
```

### 2c. Server: `buildOrderRows()` maps line items

No additional Priority API calls. `ORDERITEMS_SUBFORM` is already fully fetched. Map it into `OrderLineItem[]`, sorted by `QPRICE` descending (highest value first):

```ts
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
```

**Note on `PERCENT`:** Priority computes this per-line. For line-item display this is correct. The order-level `marginPercent` is re-derived from `QPROFIT/QPRICE` sums (existing behavior, unchanged).

### 2d. Client: `OrdersTable.tsx` — expand state + row click

**State:** `useState<string | null>(null)` keyed on `orderNumber`.

```ts
const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

function toggleRow(orderNumber: string) {
  setExpandedOrder(prev => (prev === orderNumber ? null : orderNumber));
}
```

**Why `string | null` not `Set<string>`?** The spec requires exactly one row open at a time (accordion behavior). `ItemsAccordion` uses `Set<string>` for independent multi-expand. These are different interaction models.

**Row structure:** Add a leading chevron column (32px wide). Click handler on `<tr>` with `cursor-pointer`. The `<tr>` itself becomes a button-equivalent via `role="button"` and `onClick`.

**Chevron animation:** CSS only, matching `ItemsAccordion` exactly:

```tsx
<svg
  width="14" height="14" viewBox="0 0 14 14" fill="none"
  className={`shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
  aria-hidden="true"
>
  <path d="M5 3l4 4-4 4" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
</svg>
```

**Do NOT use Framer Motion `motion.svg` for chevron rotation** — the existing pattern uses CSS `rotate-90` via Tailwind.

**Expanded content placement:** A `<tr>` immediately below the parent row, containing a single `<td colSpan={8}>` (7 columns + 1 chevron column). This is required because `OrdersTable` is a real HTML `<table>` — divs cannot be children of `<tbody>`.

```tsx
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
```

**`initial={false}` is mandatory** — prevents entrance animation on initial render (rows appear already-collapsed, not animating in from height 0).

### 2e. New component: `OrderLineItems.tsx`

Renders the sub-table inside the expanded `<td>`. Separate file to keep both files under 200 lines.

**Layout:**
- Background: `var(--color-bg-page)` (warm beige) to visually nest under the white row
- Left padding: 48px (aligns content under Order # column, matching `ItemsAccordion`'s 44px indent pattern)
- Text size: 12px body, 10px column headers

**Sub-table columns (all in a `<table>` inside the `<td>`):**

| Column | Field | Format | Alignment |
|--------|-------|--------|-----------|
| Product | `productName` | Text, truncate | Left |
| SKU | `sku` | `CopyableId` | Left |
| Qty | `quantity` + `unit` | `"7 cs"` | Right |
| Unit Price | `unitPrice` | `formatCurrency()` | Right |
| Line Total | `lineTotal` | `formatCurrency()` | Right |
| Margin % | `marginPercent` | `formatPercent()` | Right |

**`CopyableId` and `stopPropagation`:** `CopyableId` already calls `e.stopPropagation()` internally. Clicking the SKU will copy to clipboard without toggling the parent row. No additional handler needed.

**Empty line items:** If `items.length === 0`, render a single muted row: "No line item details available."

---

## Change 3: Raw Priority Status Names

### Remove `ORDER_STATUS_MAP`

Delete from `server/src/config/constants.ts`:

```ts
// DELETE THIS ENTIRE CONSTANT:
export const ORDER_STATUS_MAP: Record<string, 'Delivered' | 'Pending' | 'Processing'> = {
  Closed: 'Delivered',
  'Partially Filled': 'Pending',
  Open: 'Processing',
};
```

`EXCLUDED_STATUSES = ['Canceled']` is kept — it is applied at the OData query layer in `fetchOrders()` and is unrelated to status display.

### Updated `OrderRow.status` type

```ts
status: 'Open' | 'Closed' | 'Partially Filled';
```

### Server: `buildOrderRows()` pass-through

```ts
// Before:
status: (ORDER_STATUS_MAP[o.ORDSTATUSDES] ?? 'Processing') as OrderRow['status'],

// After:
status: o.ORDSTATUSDES as OrderRow['status'],
```

**Type cast safety:** `EXCLUDED_STATUSES` is applied at the OData API level in `fetchOrders()` — it generates an OData `$filter` clause (`ORDSTATUSDES ne 'Canceled'`). Canceled orders never enter the cache, aggregator, or client. The `as` cast is safe for the three expected values. If Priority introduces a new status, the fallback badge style (neutral gray) handles it gracefully on the client.

### Client: Updated `STATUS_STYLES` in `OrdersTable.tsx`

```ts
const STATUS_STYLES: Record<string, string> = {
  'Open':             'bg-[#dbeafe] text-[var(--color-blue)]',
  'Closed':           'bg-[#dcfce7] text-[var(--color-green)]',
  'Partially Filled': 'bg-[#fef9c3] text-[var(--color-yellow)]',
};

// Fallback for any unexpected value:
const DEFAULT_STATUS_STYLE = 'bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)]';
```

The `STATUS_STYLES` type changes from `Record<OrderRow['status'], string>` to `Record<string, string>` to accommodate the fallback.

---

## Component Split

`OrdersTable.tsx` will exceed 200 lines with expandable rows. Split:

| File | Responsibility |
|------|---------------|
| `OrdersTable.tsx` | Table shell, `<thead>`, row iteration, expand state (`useState<string \| null>`), parent `<tr>` with chevron, `AnimatePresence` wrapper |
| `OrderLineItems.tsx` | Sub-table rendered inside `<td colSpan={8}>`, receives `items: OrderLineItem[]` |

Both files must stay under 200 lines.

---

## TDD Test Plan

All server tests use Vitest, live in `server/tests/services/data-aggregator.test.ts`, and go through `aggregateOrders()` (since `buildOrderRows()` is not exported). There are no client-side component tests in this project.

### Corrected `makeOrder()` factory

The existing factory has stale field names. **All new tests must use the corrected factory** (and the existing factory should be updated at the same time):

```ts
function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    ORDNAME: 'ORD-001',
    CURDATE: '2026-02-15T00:00:00Z',
    ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000,
    CUSTNAME: 'C001',
    AGENTCODE: 'A01',
    AGENTNAME: 'Sarah M.',          // was AGENTDES — wrong field name
    ORDERITEMS_SUBFORM: [makeItem()],
    ...overrides,
  };
}

function makeItem(overrides: Partial<RawOrderItem> = {}): RawOrderItem {
  return {
    PDES: 'Widget A',               // was PARTDES — wrong field name
    PARTNAME: 'WGT-A',
    TQUANT: 100,
    TUNITNAME: 'ea',
    QPRICE: 5000,
    PRICE: 50,
    PURCHASEPRICE: 30,
    QPROFIT: 2000,
    PERCENT: 40,                    // was 0, and COST field removed (not in RawOrderItem)
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
```

**Why a separate `makeItem()`?** The current pattern of `{ ...makeOrder().ORDERITEMS_SUBFORM[0], overrides }` is verbose and inherits the drift problem. A dedicated factory makes per-item overrides cleaner and type-safe.

### Test sequence (Red → Green → Refactor order)

Write tests in this order. Each test must fail before writing the implementation.

---

#### Batch A — Zero-amount filter (Change 1)

**Test A1:** `excludes orders with TOTPRICE === 0 from orders array`
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
```

**Test A2:** `excludes zero-amount orders from KPI order count`
```ts
it('excludes zero-amount orders from KPI order count', () => {
  const orders = [
    makeOrder({ ORDNAME: 'O1', TOTPRICE: 5000 }),
    makeOrder({ ORDNAME: 'O2', TOTPRICE: 0 }),
  ];
  const result = aggregateOrders(orders, [], 'ytd');
  expect(result.kpis.orders).toBe(1);
});
```

**Test A3:** `keeps orders with negative TOTPRICE (credit memos)`
```ts
it('keeps orders with negative TOTPRICE (credit memos)', () => {
  const orders = [
    makeOrder({ ORDNAME: 'O1', TOTPRICE: -500 }),
  ];
  const result = aggregateOrders(orders, [], 'ytd');
  expect(result.orders).toHaveLength(1);
  expect(result.orders[0].orderNumber).toBe('O1');
});
```

---

#### Batch B — Line items in OrderRow (Change 2)

**Test B1:** `includes line items array on each order row`
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
```

**Test B2:** `maps line item fields to OrderLineItem shape`
```ts
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
```

**Test B3:** `sorts line items by lineTotal descending`
```ts
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
```

**Test B4:** `defaults unit to "units" when TUNITNAME is empty`
```ts
it('defaults unit to "units" when TUNITNAME is empty on line item', () => {
  const orders = [makeOrder({
    ORDERITEMS_SUBFORM: [makeItem({ TUNITNAME: '' })],
  })];
  const result = aggregateOrders(orders, [], 'ytd');
  expect(result.orders[0].items[0].unit).toBe('units');
});
```

**Test B5:** `returns empty items array when order has no subform`
```ts
it('returns empty items array when order has no ORDERITEMS_SUBFORM', () => {
  const orders = [makeOrder({ ORDERITEMS_SUBFORM: [] })];
  const result = aggregateOrders(orders, [], 'ytd');
  expect(result.orders[0].items).toEqual([]);
});
```

---

#### Batch C — Raw Priority status names (Change 3)

**Test C1 (updates existing test):** Replace `'maps order statuses to dashboard labels'` with `'passes Priority ORDSTATUSDES through as status'`
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

---

### Test run checkpoints

After each batch, run:
```bash
cd server && npx vitest run tests/services/data-aggregator.test.ts
```
All prior tests must remain green. The total test count will increase from 17 → 25 in `data-aggregator.test.ts` (8 new tests, 1 test updated).

---

## Pre-deploy checklist

After implementation, all of these must pass before merging:

```bash
cd server && npx vitest run                    # All server tests (target: 63+ passing)
cd client && npx tsc -b --noEmit               # Client TypeScript (zero errors)
cd server && npx tsc --noEmit                  # Server TypeScript (zero errors)
cd client && npx vite build                    # Bundle check (<500KB gzip)
grep -rn ": any\|as any" server/src/ client/src/   # No any types
```

TypeScript will catch `ORDER_STATUS_MAP` removal — any reference to it will error. Grep for `ORDER_STATUS_MAP` before committing to confirm it's fully removed.

---

## Constraints

- No new Priority ERP API calls — all line item data already fetched via `ORDERITEMS_SUBFORM`
- `OrderLineItems.tsx` must stay under 200 lines
- `OrdersTable.tsx` must stay under 200 lines
- Chevron rotation: CSS `rotate-90` via Tailwind — do NOT use Framer Motion rotation for this
- `AnimatePresence initial={false}` — prevents entrance animation on mount
- Follow `ItemsAccordion.tsx` for the exact `height: 0 → auto` + `overflow-hidden` pattern
- No `any` types (`noUnusedLocals: true` is enforced — unused variables kill the Railway Docker build)
- `EXCLUDED_STATUSES` stays as-is — it filters at the OData API query level, not in the aggregator
