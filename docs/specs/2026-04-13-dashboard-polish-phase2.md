# Dashboard Polish Phase 2 — Orders Consolidated + Items Analytics + Design Fixes

**Date**: 2026-04-13
**Status**: Design
**Scope**: Backend (shared types, aggregation, API query) + Frontend (components, hooks, layout)

---

## 0. Architectural Constraints (MUST READ BEFORE IMPLEMENTING)

### Constraint A: `buildFlatItems` Signature Must Change
**Current**: `buildFlatItems(items: RawOrderItem[]): FlatItem[]` — receives pre-flattened items via `allItems = nonZeroOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? [])` (line 28 of data-aggregator.ts).

**Problem**: The `flatMap` strips order-level context (`ORDNAME`, `CURDATE`). Per-SKU fields `lastOrderDate`, `lastPrice`, and `purchaseFrequency` all require knowing WHICH ORDER each line item came from.

**Solution**: Change signature to `buildFlatItems(orders: RawOrder[], prevOrders: RawOrder[], period: string): FlatItem[]`. Iterate items inside the order loop (same pattern as `groupByProduct` in `dimension-grouper-items.ts`, lines 103-123).

### Constraint B: `ORDERITEM_SELECT_PREV` Must Expand
**Current**: Fetches only `PARTNAME, QPRICE, QPROFIT, Y_9952_5_ESH, Y_3021_5_ESH` for previous-year orders (server/src/config/constants.ts line 51).

**Problem**: Cannot compute `prevYearUnits` without `TQUANT`.

**Solution**: Add `TQUANT` to `ORDERITEM_SELECT_PREV`. This adds ~4 bytes per row — negligible impact on payload size. New value:
```
PARTNAME, QPRICE, QPROFIT, TQUANT, Y_9952_5_ESH, Y_3021_5_ESH
```

### Constraint C: Period Months Calculation
Per-SKU `purchaseFrequency` uses the same formula as KPI frequency: `orderIds.size / periodMonths`. The `periodMonths` value is: `Math.max(1, now.getUTCMonth() + 1)` for YTD, or `12` for a full year (from kpi-aggregator.ts lines 36-38). This must be passed into `buildFlatItems`.

### Constraint D: Priority API Compliance (READ-ONLY)
**No write operations.** This dashboard is read-only — zero POST/PUT/PATCH/DELETE to Priority.

The only API change is adding `TQUANT` to `ORDERITEM_SELECT_PREV` (line 51 of constants.ts). This adds one field to the `$expand=ORDERITEMS_SUBFORM($select=...)` nested select for previous-year queries. Per Priority API best practices:
- Nested `$select` inside `$expand` is already correctly used (priority-queries.ts line 104)
- Adding one 4-byte numeric field has negligible payload impact (~336KB across ~84K items)
- The `RawOrderItem` TypeScript interface already types `TQUANT: number` — no type change needed
- The `fetchOrders()` function automatically uses the right field set via `isCurrentPeriod` flag
- **No query construction changes** — only the constant string `ORDERITEM_SELECT_PREV` needs updating

**Gotcha:** `RawOrderItem` is a shared interface for both current and prev-year items. After adding TQUANT to PREV, the fields available on prev-year items will be: `PARTNAME, QPRICE, QPROFIT, TQUANT, Y_9952_5_ESH, Y_3021_5_ESH`. All other fields (PDES, TUNITNAME, PRICE, etc.) will be `undefined` at runtime on prev-year items despite TypeScript not flagging this. The `buildFlatItems` prev-year phase must only access these 6 fields.

### Constraint E: View Consolidated Edge Case
When using "View Consolidated" (multiple entities selected), the route passes `prevOrders: []` (dashboard.ts line 56). This means all prev-year comparison fields will be 0 and all trend arrows will be hidden. This is acceptable — document it as a known limitation.

---

## 1. Orders Tab — Consolidated Items Panel

### Purpose
When a user filters orders (Last 30 Days, 3 Months, etc.), show an aggregated SKU-level summary below the orders table. This answers "what did this customer buy in this period?" without expanding each order.

### Data Model
Client-side pure function (NO backend change). Port from Customer Service `consolidateItems()`.

```typescript
interface ConsolidatedOrderItem {
  sku: string;
  productName: string;
  totalQuantity: number;
  totalValue: number;      // sum of lineTotal across orders
  orderCount: number;       // unique orders containing this SKU
  lastPrice: number;        // unit price from most recent order
  unit: string;             // EA, cs, lb, etc.
}
```

### Aggregation Logic (Pure Function)
```typescript
function consolidateOrderItems(orders: OrderRow[]): ConsolidatedOrderItem[]
```
1. Take the currently-filtered `OrderRow[]` (after time filter applied by OrdersTab)
2. Sort orders by date descending (most recent first)
3. For each order, for each `order.items`:
   - Group by `item.sku`
   - Sum `item.quantity` → totalQuantity
   - Sum `item.lineTotal` → totalValue
   - Count unique order numbers → orderCount
   - On first encounter of each SKU (i.e., from the most recent order): capture `item.unitPrice` → lastPrice, `item.unit` → unit
4. Sort result by totalValue descending
5. Return `ConsolidatedOrderItem[]`

### Edge Cases
- Empty orders array → return `[]`
- Order with empty items array → skip silently
- Same SKU in same order counted once toward orderCount
- Zero-value items included (they represent real purchases)

### TDD Test Contract
```
consolidateOrderItems([]) → []
consolidateOrderItems with 1 order, 2 items → 2 consolidated items
consolidateOrderItems with 2 orders, same SKU → 1 item, quantity summed, orderCount=2
consolidateOrderItems captures lastPrice from most recent order (date sorting)
consolidateOrderItems sorts output by totalValue descending
consolidateOrderItems deduplicates same SKU within same order for orderCount
```

### UI Component: `OrdersConsolidatedItems`
- Rendered below `OrdersTable` inside `OrdersTab`
- Section header: "Items Summary" with count badge (same style as tab badges)
- Separator: thin gold-subtle border above
- Table columns: `# | Product | Qty | Value | Orders | Last Price`
- Rank badge (1-3 gold, 4+ muted) — same pattern as BestSellers `rankBadgeClasses()`
- SKU shown under product name, copyable via `CopyableId`
- Collapsible via a small chevron toggle (default: expanded)
- Smooth height animation via AnimatePresence (match OrderLineItems pattern)

### Responsive
- No max-w constraint — fills available width naturally
- On 13": columns compress naturally via fluid widths
- On 27": columns breathe but stay scannable

---

## 2. Items Tab — Enhanced Performance Analytics

### Backend Changes

#### 2a. New Fields on `FlatItem` (shared/types/dashboard.ts)

Add to existing `FlatItem` interface:
```typescript
// Performance metrics (computed from current period orders)
totalUnits: number;            // sum of TQUANT across all current-period orders
unitName: string;              // "cs", "lb", "ea" — from first occurrence, fallback "units"
lastPrice: number;             // PRICE from the most recent order containing this SKU
purchaseFrequency: number;     // unique orders containing this SKU / months in period
lastOrderDate: string | null;  // ISO date string of the most recent order, null if no orders

// Previous year comparison (computed from prevOrders)
prevYearValue: number;             // sum of QPRICE from prev year, 0 if none
prevYearMarginPercent: number;     // prevProfit/prevValue * 100, 0 if none
prevYearUnits: number;             // sum of TQUANT from prev year, 0 if none
```

#### 2b. Refactor `buildFlatItems()` (server/src/services/data-aggregator.ts)

**New signature**:
```typescript
function buildFlatItems(
  orders: RawOrder[],
  prevOrders: RawOrder[],
  period: string,
): FlatItem[]
```

**Call site change** in `aggregateOrders()`:
```typescript
// Before: const items = buildFlatItems(allItems);
// After:
const items = buildFlatItems(nonZeroOrders, prevOrders, period);
```

**Implementation pattern** (from `dimension-grouper-items.ts` groupByProduct):
```typescript
// Phase 1: Build current-period accumulator per SKU
interface SkuAccumulator {
  name: string;
  sku: string;
  value: number;
  profit: number;
  totalUnits: number;
  unitName: string;
  lastPrice: number;
  lastOrderDate: string;
  orderIds: Set<string>;      // for frequency + orderCount
  // category fields...
}

orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
  // group by PARTNAME, accumulate, track o.ORDNAME and o.CURDATE
}));

// Phase 2: Build prev-year lookup per SKU (lighter — only value, profit, units)
interface PrevYearLookup {
  value: number;
  profit: number;
  units: number;
}
const prevBySku = new Map<string, PrevYearLookup>();
prevOrders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
  // group by PARTNAME, accumulate QPRICE, QPROFIT, TQUANT
}));

// Phase 3: Merge and return FlatItem[]
const periodMonths = computePeriodMonths(period); // same logic as kpi-aggregator
```

#### 2c. Add `TQUANT` to `ORDERITEM_SELECT_PREV` (server/src/config/constants.ts)

```typescript
export const ORDERITEM_SELECT_PREV = [
  'PARTNAME', 'QPRICE', 'QPROFIT', 'TQUANT', 'Y_9952_5_ESH', 'Y_3021_5_ESH',
].join(',');
```

### TDD Test Contracts for buildFlatItems

**New fields on current-period items:**
```
buildFlatItems computes totalUnits as sum of TQUANT per SKU
buildFlatItems captures unitName from first item occurrence per SKU
buildFlatItems defaults unitName to "units" when TUNITNAME is empty
buildFlatItems computes lastPrice from the order with the latest CURDATE
buildFlatItems computes lastOrderDate as the max CURDATE for each SKU
buildFlatItems computes purchaseFrequency as orderCount / periodMonths
buildFlatItems returns null lastOrderDate when SKU has no orders (edge case)
```

**Previous year comparison fields:**
```
buildFlatItems computes prevYearValue as sum of QPRICE from prevOrders per SKU
buildFlatItems computes prevYearMarginPercent as prevProfit/prevValue * 100
buildFlatItems computes prevYearUnits as sum of TQUANT from prevOrders per SKU
buildFlatItems returns 0 for prev year fields when SKU not in prevOrders (new product)
buildFlatItems returns 0 for prev year fields when prevOrders is [] (View Consolidated)
buildFlatItems handles SKU present in prev year but absent in current year (not in result)
```

**Edge cases:**
```
buildFlatItems handles orders with empty ORDERITEMS_SUBFORM
buildFlatItems handles prevOrders with missing TQUANT (field not fetched before migration)
buildFlatItems frequency is 0 when periodMonths is 0 (guard against division by zero)
```

### Frontend Changes

#### Table Columns (in order)
```
Product | Value | Avg Margin % | Margin $ | Units | Freq | Last $ | Last Order
```

- Rename: "Margin %" header → "Avg Margin %"
- New columns: Units (e.g. "54 cs"), Freq (e.g. "4.2/mo"), Last $ (unit price), Last Order (days-ago + dot)

#### Last Order Activity Indicator
Same thresholds as KPI section's `getActivityStatus()` (KPISection.tsx lines 25-31):
- ≤14 days: green dot — "Active"
- ≤45 days: gold dot — "Regular"
- ≤90 days: yellow dot — "Slowing"
- >90 days: red dot — "At risk"
- null: no dot, show "—"

Format function: reuse `formatDays()` from `shared/utils/formatting.ts`

#### Inline Trend Arrows (Always Visible on Main Row)
Every numeric metric cell (Value, Avg Margin %, Margin $, Units) shows a small
green ▲ or red ▼ arrow next to the value on the main line.

- Arrow logic: compare current period value vs previous year same period
- Green ▲ when current > prev year (improving)
- Red ▼ when current < prev year (declining)
- No arrow when prev year value is 0 (new SKU — no comparison baseline)
- Arrow is a tiny inline SVG (10px) right after the number, same row
- For margin %: compare absolute values (is margin better or worse?)

Small reusable component:
```typescript
function TrendArrow({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null; // new SKU, no comparison
  const isUp = current > previous;
  return <span className={`text-[10px] ml-0.5 ${isUp ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}`}>
    {isUp ? '▲' : '▼'}
  </span>;
}
```

Example main row:
```
Arancini 4.2lb   $8,654 ▲   54.1% ▲   $4,678 ▲   54 cs ▲   4.2/mo   $160   5d ●
Salmon 3.5lb     $5,096 ▼  -67.8% ▼  -$3,453 ▼   217 lb ▼  3.1/mo   $23   12d ●
```

#### Compare Toggle (Expanded Detail Sub-Row)
- New toolbar button: bar-chart icon with "Compare" label, toggle state
- When active: each item row gets a compact sub-row showing YoY deltas
- Delta format: `+23.4%` or `-15.2%` for Value, `+5.1pp` or `-8.3pp` for Margin, `+12` or `-30` for Units
- If no previous year data for a SKU: show "—" (em dash)
- Sub-row: single line, 10px text, muted color, slightly indented under the numeric columns
- The arrows on the main line stay visible — the sub-row adds precise numbers

Example with Compare ON:
```
Arancini 4.2lb   $8,654 ▲   54.1% ▲   $4,678 ▲   54 cs ▲   4.2/mo   $160   5d ●
                  +23.4%     +5.1pp     +32.0%     +12 units
Salmon 3.5lb     $5,096 ▼  -67.8% ▼  -$3,453 ▼   217 lb ▼  3.1/mo   $23   12d ●
                  -15.2%     -8.3pp     -45.1%     -30 units
```

#### Delta Computation Logic (Pure Function)
```typescript
function computeItemDeltas(item: FlatItem): {
  valueDelta: number | null;      // percent change
  marginDelta: number | null;     // percentage points change
  marginAmountDelta: number | null; // percent change
  unitsDelta: number | null;      // absolute change
}
```
- `valueDelta`: `(value - prevYearValue) / prevYearValue * 100` — null if prevYearValue === 0
- `marginDelta`: `marginPercent - prevYearMarginPercent` (pp change) — null if prevYearValue === 0
- `marginAmountDelta`: `(marginAmount - prevMarginAmount) / |prevMarginAmount| * 100` — null if prev === 0
- `unitsDelta`: `totalUnits - prevYearUnits` (absolute) — null if prevYearUnits === 0

#### Column Widths (Updated)
```
Product: flex-1 (name + SKU + category badges)
Value: w-24 (right-aligned, tabular-nums)
Avg Margin %: w-24 (right-aligned)
Margin $: w-24 (right-aligned, tabular-nums)
Units: w-24 (right-aligned, e.g. "54 cs")
Freq: w-20 (right-aligned, e.g. "4.2/mo")
Last $: w-24 (right-aligned, tabular-nums)
Last Order: w-24 (right-aligned, e.g. "5d" + colored dot)
```

### ItemsGroupRow Changes
When grouped, the group header row shows aggregated totals for Value, Margin %, Margin $.
- New columns (Units, Freq, Last $, Last Order): show "—" at group level (not meaningful as aggregates)
- Trend arrows: show at group level for Value, Margin %, Margin $ (aggregate prev-year data available through group rollup)
- Compare sub-row: NOT shown for group headers

---

## 3. Toolbar Icon Reorder

Current order in `ItemsToolbar.tsx`: `Search | Group | Sort | Filter`
New order: `Search | Filter | Sort | Group | Compare`

This matches the logical workflow: first narrow down what you see (filter), then arrange it (sort), then organize it (group), then analyze trends (compare).

Compare button: bar-chart SVG icon, toggles `showCompare` state. Active state uses same styling as other active toolbar buttons (gold badge count indicator pattern).

State management: Add `showCompare: boolean` to `useItemsExplorer` reducer. Dispatch via `toggleCompare()`.

---

## 4. Design Polish Fixes

### Hero Chart Height
- Increase `CHART_HEIGHT` from 120 to 180 in `YoYBarChart.tsx`
- Adjust `BAR_AREA_HEIGHT` = `CHART_HEIGHT - X_LABEL_HEIGHT - LEGEND_HEIGHT` (auto-computed)
- This gives bars ~50% more vertical space — much more usable

### Remove max-w Constraints on Tables
- Remove `max-w-[1100px]` from OrdersTable (added in phase 1 — wrong approach)
- Remove `max-w-[1100px]` from ItemsTable (same)
- Tables fill available width naturally; column widths handle scannability

### KPI Card Detail Text Sizes (Expanded State)
In `KPICard.tsx`, when `showDetails` is active:
- Sub-item labels: 9px → 10px
- Sub-item values: 12px → 13px
- Sub-item suffixes: 9px → 10px

### Hero Card Previous Year Values
In `HeroRevenueCard.tsx`:
- Prev year labels: 10px → 11px
- YTD prev year value: 16px → 18px
- Full prev year value: 14px → 16px

---

## 5. File Change Summary

### Shared Types (1 file)
- `shared/types/dashboard.ts` — add 8 new FlatItem fields

### Backend (2 files)
- `server/src/services/data-aggregator.ts` — refactor `buildFlatItems()` signature + implementation
- `server/src/config/constants.ts` — add TQUANT to `ORDERITEM_SELECT_PREV`

### Backend Tests (1 file)
- `server/tests/services/data-aggregator.test.ts` — add ~15 new tests for FlatItem fields

### Frontend — New Files (3 files)
- `client/src/utils/consolidate-order-items.ts` — pure consolidation function
- `client/src/components/right-panel/OrdersConsolidatedItems.tsx` — consolidated items section
- `client/src/components/right-panel/ItemsCompareRow.tsx` — YoY comparison sub-row component

### Frontend — New Shared Components (1 file)
- `client/src/components/shared/TrendArrow.tsx` — reusable ▲/▼ indicator

### Frontend — Modified Files (11 files)
- `client/src/components/right-panel/OrdersTab.tsx` — add consolidated items below table
- `client/src/components/right-panel/ItemsTable.tsx` — new column headers, wider column defs
- `client/src/components/right-panel/ItemsProductRow.tsx` — new cells, arrows, compare sub-row
- `client/src/components/right-panel/ItemsGroupRow.tsx` — new cells (dashes), wider columns
- `client/src/components/right-panel/ItemsToolbar.tsx` — reorder icons, add Compare toggle
- `client/src/components/right-panel/ItemsExplorer.tsx` — pass compare state + sorting for new fields
- `client/src/hooks/useItemsExplorer.ts` — add showCompare state + toggleCompare action
- `client/src/utils/items-grouping.ts` — add new fields to sort options
- `client/src/components/right-panel/YoYBarChart.tsx` — increase chart height to 180
- `client/src/components/right-panel/KPICard.tsx` — bump detail text sizes
- `client/src/components/right-panel/HeroRevenueCard.tsx` — bump prev year text sizes
- `client/src/components/right-panel/OrdersTable.tsx` — remove max-w-[1100px]

### Total: 4 new files + 14 modified files = 18 files touched
