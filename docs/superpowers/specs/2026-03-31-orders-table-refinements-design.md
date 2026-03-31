# Orders Table Refinements — Design Spec

**Date:** 2026-03-31
**Status:** Approved

## Overview

Three targeted improvements to the Orders tab:

1. **Zero-amount filter** — exclude $0 orders from the table and count badge
2. **Expandable rows** — click a row to reveal line item details
3. **Raw Priority status** — show Priority ERP status names directly instead of mapped labels

---

## 1. Zero-Amount Order Filter

### Rule
Any order where `TOTPRICE === 0` is excluded. Orders with negative totals (credit memos) are kept.

### Where
`buildOrderRows()` in `server/src/services/data-aggregator.ts`. Filter applied on the raw `RawOrder[]` input before `.map()`:

```ts
orders
  .filter(o => o.TOTPRICE !== 0)
  .map(o => ({ ... }))
```

### Impact on tab badge count
The Orders tab badge (e.g. "Orders 40") is derived from `orders.length` on the client. Filtering server-side means the count automatically reflects only non-zero orders. No client change needed.

### Impact on KPIs
The KPI aggregator (`computeKPIs`) operates independently on raw `RawOrder[]`. A $0 order contributes $0 to revenue/margin, but does increment the order count KPI. For consistency, apply the same `TOTPRICE !== 0` filter to the orders array passed into `computeKPIs` so the order count KPI also excludes $0 orders.

---

## 2. Expandable Order Rows

### New shared type

Add to `shared/types/dashboard.ts`:

```ts
/** One line item inside an expanded order row — spec Orders tab */
export interface OrderLineItem {
  productName: string;   // PDES
  sku: string;           // PARTNAME
  quantity: number;      // TQUANT
  unit: string;          // TUNITNAME (e.g. "cs", "ea", "lb")
  unitPrice: number;     // PRICE
  lineTotal: number;     // QPRICE
  marginPercent: number; // PERCENT
}
```

Update `OrderRow` to include line items:

```ts
export interface OrderRow {
  date: string;
  orderNumber: string;
  itemCount: number;
  amount: number;
  marginPercent: number;
  marginAmount: number;
  status: 'Open' | 'Closed' | 'Partially Filled';  // raw Priority value
  items: OrderLineItem[];                            // line item details
}
```

### Server: data-aggregator.ts

`buildOrderRows()` maps `ORDERITEMS_SUBFORM` into `OrderLineItem[]`, sorted by `QPRICE` descending (highest value first):

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

No new API calls — `ORDERITEMS_SUBFORM` is already fetched for every order.

### Client: OrdersTable.tsx

**Row interaction:**
- Click anywhere on a row to toggle expand/collapse
- Only one row expanded at a time — expanding a new row collapses the previous one
- Row state managed with `useState<string | null>(expandedOrderNumber)`

**Chevron indicator:**
- First column becomes a narrow (32px) chevron column
- SVG chevron: right-facing when collapsed, rotated 90° when expanded
- Animated with Framer Motion `motion.svg` rotate transition

**Animation:**
- Expanded content rendered in a `<tr>` immediately below the parent row
- Wrapped in Framer Motion `AnimatePresence`
- `motion.div` inside the `<td>` with `initial={{ height: 0, opacity: 0 }}` → `animate={{ height: 'auto', opacity: 1 }}`

**Sub-table layout:**
- Rendered inside a `<td colSpan={8}>` (7 original columns + 1 chevron column)
- Background: `var(--color-bg-page)` (warm beige) to visually nest
- Left padding: 48px (aligns content under Order # column)
- Text size: 12px body, 10px column headers

**Sub-table columns:**

| Column | Field | Format | Alignment |
|--------|-------|--------|-----------|
| Product | `productName` | Text | Left |
| SKU | `sku` | `CopyableId` | Left |
| Qty | `quantity` + `unit` | "7 cs" | Right |
| Unit Price | `unitPrice` | Currency | Right |
| Line Total | `lineTotal` | Currency | Right |
| Margin % | `marginPercent` | Percentage | Right |

**Empty line items:** If `items.length === 0`, show a single muted row: "No line item details available."

### Component split
`OrdersTable.tsx` will approach the 200-line limit once expanded rows are added. Split into:
- `OrdersTable.tsx` — table shell, header, row iteration, expand state
- `OrderLineItems.tsx` — sub-table rendered inside the expanded `<tr>`

---

## 3. Raw Priority Status Names

### Change
Remove the `ORDER_STATUS_MAP` constant from `server/src/config/constants.ts`. Pass `ORDSTATUSDES` directly through as the status value.

### Updated type
```ts
status: 'Open' | 'Closed' | 'Partially Filled';
```

### Server: data-aggregator.ts
```ts
// Before
status: (ORDER_STATUS_MAP[o.ORDSTATUSDES] ?? 'Processing') as OrderRow['status'],

// After
status: o.ORDSTATUSDES as OrderRow['status'],
```

`EXCLUDED_STATUSES = ['Canceled']` filter remains unchanged — it is applied before `buildOrderRows()` in the fetching layer, so `Canceled` orders never reach this function.

**Type narrowing note:** The `as OrderRow['status']` cast is safe here because the `EXCLUDED_STATUSES` filter already removes `Canceled`, and `buildOrderRows` only receives orders that passed that filter. If Priority adds a new status value in future, the fallback badge style (neutral gray) handles it gracefully on the client.

### Fallback for unknown statuses
If Priority returns an unexpected `ORDSTATUSDES` value, the badge renders with neutral styling: `bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)]`.

### Badge color mapping

| Status | Background | Text |
|--------|-----------|------|
| `Open` | `#dbeafe` | `var(--color-blue)` |
| `Closed` | `#dcfce7` | `var(--color-green)` |
| `Partially Filled` | `#fef9c3` | `var(--color-yellow)` |
| _(unknown)_ | `var(--color-gold-subtle)` | `var(--color-text-muted)` |

---

## Files Changed

| File | Change |
|------|--------|
| `shared/types/dashboard.ts` | Add `OrderLineItem`, update `OrderRow` (add `items`, change `status` type) |
| `server/src/services/data-aggregator.ts` | Filter zero-amount orders, map line items, remove status mapping |
| `server/src/config/constants.ts` | Remove `ORDER_STATUS_MAP` |
| `client/src/components/right-panel/OrdersTable.tsx` | Chevron column, expand state, `AnimatePresence`, updated status badges |
| `client/src/components/right-panel/OrderLineItems.tsx` | New — sub-table component for expanded line items |
| `server/src/services/__tests__/data-aggregator.test.ts` | Update tests for new filtering, status pass-through, and `items` field |

---

## Constraints

- No new API calls to Priority ERP — all line item data already fetched
- `OrderLineItems.tsx` must stay under 200 lines
- `OrdersTable.tsx` must stay under 200 lines after split
- Follow existing Framer Motion patterns from `ItemsAccordion.tsx`
- No `any` types introduced
