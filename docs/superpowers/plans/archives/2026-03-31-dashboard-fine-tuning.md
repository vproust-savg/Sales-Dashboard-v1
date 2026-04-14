# Dashboard Fine-Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance Best Sellers card (tooltip, zero-value filter, actual units) and add a 5-type Product Mix donut carousel.

**Architecture:** Backend computes all 5 product mixes in a single pass over the same `RawOrderItem[]` already fetched. Frontend wraps the existing `ProductMixDonut` in a new carousel component with left/right arrows. Best Sellers gets a shared `Tooltip` component, zero-value filtering on both server and client, and unit-of-measure from Priority's `TUNITNAME` field.

**Tech Stack:** TypeScript strict, React 19, Framer Motion, Tailwind CSS v4, Express, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `shared/types/dashboard.ts` | Modify | Add `unit` to TopSellerItem, add `ProductMixType`, change `productMix` → `productMixes` |
| `server/src/config/constants.ts` | Modify | Add 4 fields to `ORDERITEM_SELECT` |
| `server/src/services/priority-queries.ts` | Modify | Add 4 fields to `RawOrderItem` interface |
| `server/src/services/data-aggregator.ts` | Modify | Refactor product mix, add unit to top sellers, filter zero-value |
| `server/tests/services/data-aggregator.test.ts` | Modify | Add tests for new behaviors |
| `client/src/components/shared/Tooltip.tsx` | **Create** | Reusable hover tooltip component |
| `client/src/components/right-panel/TopTenBestSellers.tsx` | **Rename → `BestSellers.tsx`** | Tooltip, unit, zero-value filter, pagination (25 items, shift by 5) |
| `client/src/components/right-panel/ProductMixCarousel.tsx` | **Create** | Carousel wrapper with arrows + dots |
| `client/src/components/right-panel/ChartsRow.tsx` | Modify | Wire ProductMixCarousel |
| `client/src/components/right-panel/RightPanel.tsx` | Modify | Pass `productMixes` |
| `client/src/layouts/DashboardLayout.tsx` | Modify | Pass `productMixes` |
| `client/src/mock-data.ts` | Modify | Update mock shape |

---

### Task 1: Shared Types — Add `unit` to TopSellerItem and `ProductMixType`

**Files:**
- Modify: `shared/types/dashboard.ts`

- [ ] **Step 1: Add `unit` field to `TopSellerItem`**

In `shared/types/dashboard.ts`, add `unit: string` after the `units` field:

```typescript
export interface TopSellerItem {
  rank: number;
  name: string;
  sku: string;
  revenue: number;
  units: number;
  unit: string;           // Unit of measure from TUNITNAME (e.g., "cs", "ea", "lb")
}
```

- [ ] **Step 2: Add `ProductMixType` and change `DashboardPayload`**

Below the `ProductMixSegment` interface (after line 78), add:

```typescript
/** The 5 donut categorizations for the product mix carousel */
export type ProductMixType = 'productType' | 'productFamily' | 'brand' | 'countryOfOrigin' | 'foodServiceRetail';

/** Human-readable labels for each mix type — used by carousel UI */
export const PRODUCT_MIX_LABELS: Record<ProductMixType, string> = {
  productType: 'Product Type',
  productFamily: 'Product Family',
  brand: 'Brand',
  countryOfOrigin: 'Country of Origin',
  foodServiceRetail: 'FS vs Retail',
};

/** Ordered list of mix types for carousel navigation */
export const PRODUCT_MIX_ORDER: ProductMixType[] = [
  'productType', 'productFamily', 'brand', 'countryOfOrigin', 'foodServiceRetail',
];
```

In the `DashboardPayload` interface, change `productMix` to `productMixes`:

```typescript
// OLD:
productMix: ProductMixSegment[];
// NEW:
productMixes: Record<ProductMixType, ProductMixSegment[]>;
```

- [ ] **Step 3: Verify types compile**

Run: `cd shared && npx tsc --noEmit`

Expected: Compilation errors in files that still reference old `productMix` — this is expected and will be fixed in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add shared/types/dashboard.ts
git commit -m "feat(types): add unit to TopSellerItem, add ProductMixType, rename productMix to productMixes"
```

---

### Task 2: Backend — Add New Priority Fields

**Files:**
- Modify: `server/src/config/constants.ts`
- Modify: `server/src/services/priority-queries.ts`

- [ ] **Step 1: Add fields to `ORDERITEM_SELECT`**

In `server/src/config/constants.ts`, update `ORDERITEM_SELECT` to include the 4 new fields:

```typescript
export const ORDERITEM_SELECT = [
  'PDES', 'PARTNAME', 'TQUANT', 'TUNITNAME', 'QPRICE', 'PRICE',
  'PURCHASEPRICE', 'QPROFIT', 'PERCENT',
  'Y_1159_5_ESH', 'Y_1530_5_ESH', 'Y_9952_5_ESH',
  'Y_3020_5_ESH', 'Y_3021_5_ESH', 'Y_17936_5_ESH',
  'Y_2075_5_ESH', 'Y_5380_5_ESH', 'Y_9967_5_ESH',
].join(',');
```

- [ ] **Step 2: Add fields to `RawOrderItem` interface**

In `server/src/services/priority-queries.ts`, add 4 new fields to `RawOrderItem`:

```typescript
export interface RawOrderItem {
  PDES: string;
  PARTNAME: string;
  TQUANT: number;
  TUNITNAME: string;      // Unit of measure (e.g., "cs", "ea", "lb")
  QPRICE: number;
  PRICE: number;
  PURCHASEPRICE: number;
  QPROFIT: number;
  PERCENT: number;
  Y_1159_5_ESH: string;   // Vendor code
  Y_1530_5_ESH: string;   // Vendor name
  Y_9952_5_ESH: string;   // Brand
  Y_3020_5_ESH: string;   // Family type code
  Y_3021_5_ESH: string;   // Family type name
  Y_17936_5_ESH: string;  // Vendor part number
  Y_2075_5_ESH: string;   // Product Family
  Y_5380_5_ESH: string;   // Country of Origin
  Y_9967_5_ESH: string;   // Food Service vs Retail (Y = Retail)
}
```

- [ ] **Step 3: Verify server compiles**

Run: `cd server && npx tsc --noEmit`

Expected: Compilation errors in `data-aggregator.ts` due to changed `DashboardPayload.productMix` → `productMixes` — this is expected and will be fixed in Task 3.

- [ ] **Step 4: Commit**

```bash
git add server/src/config/constants.ts server/src/services/priority-queries.ts
git commit -m "feat(backend): add TUNITNAME and 3 new custom fields to ORDERITEM_SELECT"
```

---

### Task 3: Backend — Refactor data-aggregator (product mixes + top sellers unit + zero-value filter)

**Files:**
- Modify: `server/src/services/data-aggregator.ts`

- [ ] **Step 1: Update imports and `AggregateResult` type**

In `server/src/services/data-aggregator.ts`, update the imports and result type:

```typescript
import type { KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType, TopSellerItem, OrderRow, ItemCategory, SparklineData } from '@shared/types/dashboard';
```

Change the `AggregateResult` interface:

```typescript
interface AggregateResult {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: ItemCategory[];
}
```

- [ ] **Step 2: Refactor `computeProductMix` to accept a field extractor**

Replace the existing `computeProductMix` function with a parameterized version:

```typescript
/** Spec Section 20.2 — Group items by a category field, max 7 segments */
function computeProductMix(
  items: RawOrderItem[],
  getCategory: (item: RawOrderItem) => string,
): ProductMixSegment[] {
  const byCategory = new Map<string, number>();
  items.forEach(item => {
    const cat = getCategory(item) || 'Other';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + item.QPRICE);
  });

  const total = items.reduce((sum, i) => sum + i.QPRICE, 0);
  const sorted = [...byCategory.entries()]
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([category, value]) => ({
      category,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0,
    }));

  if (sorted.length > 7) {
    const top6 = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    const otherValue = rest.reduce((sum, s) => sum + s.value, 0);
    top6.push({ category: 'Other', value: otherValue, percentage: total > 0 ? Math.round((otherValue / total) * 100) : 0 });
    return top6;
  }

  return sorted;
}
```

- [ ] **Step 3: Add `computeAllProductMixes` function**

Add this new function after `computeProductMix`:

```typescript
/** Compute all 5 product mix breakdowns in a single pass concept */
function computeAllProductMixes(items: RawOrderItem[]): Record<ProductMixType, ProductMixSegment[]> {
  return {
    productType: computeProductMix(items, i => i.Y_3021_5_ESH),
    productFamily: computeProductMix(items, i => i.Y_2075_5_ESH),
    brand: computeProductMix(items, i => i.Y_9952_5_ESH),
    countryOfOrigin: computeProductMix(items, i => i.Y_5380_5_ESH),
    foodServiceRetail: computeProductMix(items, i => i.Y_9967_5_ESH === 'Y' ? 'Retail' : 'Food Service'),
  };
}
```

- [ ] **Step 4: Update `computeTopSellers` — add unit + zero-value filter**

Replace the existing `computeTopSellers` function:

```typescript
/** Spec Section 22.5 — Top 10 by revenue, aggregated by SKU, with unit of measure */
function computeTopSellers(items: RawOrderItem[]): TopSellerItem[] {
  const bySku = new Map<string, { name: string; sku: string; revenue: number; units: number; unit: string }>();
  items.forEach(item => {
    const existing = bySku.get(item.PARTNAME);
    if (existing) {
      existing.revenue += item.QPRICE;
      existing.units += item.TQUANT;
    } else {
      bySku.set(item.PARTNAME, {
        name: item.PDES,
        sku: item.PARTNAME,
        revenue: item.QPRICE,
        units: item.TQUANT,
        unit: item.TUNITNAME || 'units',
      });
    }
  });

  return [...bySku.values()]
    .filter(item => item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 25)
    .map((item, i) => ({ ...item, rank: i + 1 }));
}
```

- [ ] **Step 5: Update `aggregateOrders` to use new functions**

In the `aggregateOrders` function body, replace `computeProductMix(allItems)` with `computeAllProductMixes(allItems)`:

```typescript
  const productMixes = computeAllProductMixes(allItems);
  // ...
  return { kpis, monthlyRevenue, productMixes, topSellers, sparklines, orders, items };
```

- [ ] **Step 6: Verify server compiles**

Run: `cd server && npx tsc --noEmit`

Expected: PASS (server-side compiles clean now)

- [ ] **Step 7: Commit**

```bash
git add server/src/services/data-aggregator.ts
git commit -m "feat(aggregator): compute 5 product mixes, add unit to top sellers, filter zero-value items"
```

---

### Task 4: Backend Tests — Update for New Behaviors

**Files:**
- Modify: `server/tests/services/data-aggregator.test.ts`

- [ ] **Step 1: Update `makeOrder` helper with new fields**

In `server/tests/services/data-aggregator.test.ts`, update the `makeOrder` helper to include the new fields:

```typescript
function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    ORDNAME: 'ORD-001',
    CURDATE: '2026-02-15T00:00:00Z',
    ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000,
    CUSTNAME: 'C001',
    CUSTDES: 'Acme Corp',
    AGENTCODE: 'A01',
    AGENTDES: 'Sarah M.',
    ORDERITEMS_SUBFORM: [{
      PARTDES: 'Widget A', PARTNAME: 'WGT-A', TQUANT: 100, TUNITNAME: 'ea',
      QPRICE: 5000, PRICE: 50, PURCHASEPRICE: 30, COST: 30,
      QPROFIT: 2000, PERCENT: 0,
      Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One',
      Y_9952_5_ESH: 'BrandX', Y_3020_5_ESH: 'FAM1',
      Y_3021_5_ESH: 'Packaging', Y_17936_5_ESH: 'VP-001',
      Y_2075_5_ESH: 'Family A', Y_5380_5_ESH: 'USA',
      Y_9967_5_ESH: 'N',
    }],
    ...overrides,
  };
}
```

- [ ] **Step 2: Update existing top sellers test for 25-item limit**

Change the existing top sellers test (currently expects 10) to expect up to 25:

```typescript
  it('builds top 25 sellers ranked by revenue', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      ...makeOrder().ORDERITEMS_SUBFORM[0],
      PARTNAME: `SKU-${i}`,
      PARTDES: `Product ${i}`,
      QPRICE: (30 - i) * 1000,
      TQUANT: (30 - i) * 10,
    }));
    const orders = [makeOrder({ ORDERITEMS_SUBFORM: items })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.topSellers).toHaveLength(25);
    expect(result.topSellers[0].rank).toBe(1);
    expect(result.topSellers[0].revenue).toBe(30000);
    expect(result.topSellers[24].rank).toBe(25);
  });
```

- [ ] **Step 3: Update existing productMix test to use `productMixes.productType`**

Change the existing test at line 87:

```typescript
  it('builds product mix from Y_3021_5_ESH (family type name)', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_3021_5_ESH: 'Packaging', QPRICE: 6000 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_3021_5_ESH: 'Equipment', QPRICE: 4000 },
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.productMixes.productType).toHaveLength(2);
    expect(result.productMixes.productType[0].category).toBe('Packaging');
    expect(result.productMixes.productType[0].percentage).toBe(60);
  });
```

- [ ] **Step 3: Add test for Food Service vs Retail mix**

Add after the existing product mix test:

```typescript
  it('builds Food Service vs Retail mix from Y_9967_5_ESH', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_9967_5_ESH: 'Y', QPRICE: 7000 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_9967_5_ESH: 'N', QPRICE: 3000 },
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.productMixes.foodServiceRetail).toHaveLength(2);
    expect(result.productMixes.foodServiceRetail[0].category).toBe('Retail');
    expect(result.productMixes.foodServiceRetail[0].percentage).toBe(70);
    expect(result.productMixes.foodServiceRetail[1].category).toBe('Food Service');
  });
```

- [ ] **Step 4: Add test for top sellers unit field**

Add after the top sellers test:

```typescript
  it('includes unit of measure from TUNITNAME in top sellers', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        { ...makeOrder().ORDERITEMS_SUBFORM[0], PARTNAME: 'SKU-A', TUNITNAME: 'cs', QPRICE: 5000 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], PARTNAME: 'SKU-B', TUNITNAME: 'lb', QPRICE: 3000 },
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.topSellers[0].unit).toBe('cs');
    expect(result.topSellers[1].unit).toBe('lb');
  });

  it('defaults unit to "units" when TUNITNAME is empty', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        { ...makeOrder().ORDERITEMS_SUBFORM[0], TUNITNAME: '' },
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.topSellers[0].unit).toBe('units');
  });
```

- [ ] **Step 5: Add test for zero-value filtering**

```typescript
  it('excludes zero-revenue items from top sellers', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        { ...makeOrder().ORDERITEMS_SUBFORM[0], PARTNAME: 'SKU-A', QPRICE: 5000 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], PARTNAME: 'SKU-B', QPRICE: 0 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], PARTNAME: 'SKU-C', QPRICE: -100 },
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.topSellers).toHaveLength(1);
    expect(result.topSellers[0].sku).toBe('SKU-A');
  });
```

- [ ] **Step 6: Add test for all 5 mixes being present**

```typescript
  it('returns all 5 product mix types', () => {
    const orders = [makeOrder()];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(Object.keys(result.productMixes)).toEqual([
      'productType', 'productFamily', 'brand', 'countryOfOrigin', 'foodServiceRetail',
    ]);
  });
```

- [ ] **Step 7: Add test for zero-value segment filtering in product mix**

```typescript
  it('excludes zero-value segments from product mix', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_3021_5_ESH: 'Packaging', QPRICE: 5000 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_3021_5_ESH: 'Equipment', QPRICE: 0 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_3021_5_ESH: 'Consumables', QPRICE: -100 },
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.productMixes.productType).toHaveLength(1);
    expect(result.productMixes.productType[0].category).toBe('Packaging');
  });
```

- [ ] **Step 8: Run tests**

Run: `cd server && npx vitest run`

Expected: All tests pass (existing + new)

- [ ] **Step 9: Commit**

```bash
git add server/tests/services/data-aggregator.test.ts
git commit -m "test(aggregator): add tests for product mixes, unit field, zero-value filter"
```

---

### Task 5: Frontend — Create Tooltip Component

**Files:**
- Create: `client/src/components/shared/Tooltip.tsx`

- [ ] **Step 1: Create the Tooltip component**

Create `client/src/components/shared/Tooltip.tsx`:

```typescript
// FILE: client/src/components/shared/Tooltip.tsx
// PURPOSE: Reusable hover tooltip — dark background, positioned below trigger element
// USED BY: client/src/components/right-panel/BestSellers.tsx
// EXPORTS: Tooltip

import { useState, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), 200);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 z-50 mt-1 whitespace-nowrap rounded-[var(--radius-base)] bg-[var(--color-dark)] px-[10px] py-[6px] text-[12px] text-white shadow-[var(--shadow-card)]"
            role="tooltip"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify client compiles**

Run: `cd client && npx tsc -b --noEmit`

Expected: Errors from other files referencing old `productMix` — Tooltip itself compiles clean.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/shared/Tooltip.tsx
git commit -m "feat(ui): add reusable Tooltip component with Framer Motion"
```

---

### Task 6: Frontend — Rename TopTenBestSellers → BestSellers with Pagination

**Files:**
- Rename: `client/src/components/right-panel/TopTenBestSellers.tsx` → `BestSellers.tsx`

- [ ] **Step 1: Delete old file and create BestSellers.tsx**

Delete `client/src/components/right-panel/TopTenBestSellers.tsx` and create `client/src/components/right-panel/BestSellers.tsx` with the full content below.

WHY split into two files: `BestSellers.tsx` handles pagination state + header with arrows. `SellerRow` is an internal component. The file stays under 200 lines because pagination adds ~30 lines.

```typescript
// FILE: client/src/components/right-panel/BestSellers.tsx
// PURPOSE: Paginated two-column ranked list of best-selling products (up to 25)
// USED BY: client/src/components/right-panel/ChartsRow.tsx
// EXPORTS: BestSellers

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TopSellerItem } from '@shared/types/dashboard';
import { formatCurrency } from '@shared/utils/formatting';
import { CopyableId } from '../shared/CopyableId';
import { Tooltip } from '../shared/Tooltip';

interface BestSellersProps {
  data: TopSellerItem[];
}

/** WHY gold vs neutral: spec says top 3 get gold badges, 4+ get neutral */
function rankBadgeClasses(rank: number): string {
  if (rank <= 3) {
    return 'bg-[var(--color-gold-primary)] text-white';
  }
  return 'bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)]';
}

function SellerRow({ item }: { item: TopSellerItem }) {
  return (
    <div className="flex items-center gap-[var(--spacing-md)] border-b border-[#f5f1eb] py-[7px]">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[10px] font-semibold ${rankBadgeClasses(item.rank)}`}
      >
        {item.rank}
      </span>
      <div className="min-w-0 flex-1">
        <Tooltip content={item.name}>
          <p className="truncate text-[13px] font-medium leading-tight text-[var(--color-text-primary)]">
            {item.name}
          </p>
        </Tooltip>
        <CopyableId value={item.sku} label="SKU" className="block truncate text-[10px] text-[var(--color-text-faint)]" />
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          {formatCurrency(item.revenue)}
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)]">
          {item.units.toLocaleString('en-US')} {item.unit}
        </p>
      </div>
    </div>
  );
}

/** WHY page size 5: each arrow click shifts by 5 items, two columns show 10 at a time */
const PAGE_STEP = 5;
const VISIBLE_COUNT = 10;

export function BestSellers({ data }: BestSellersProps) {
  const [startIdx, setStartIdx] = useState(0);
  const [direction, setDirection] = useState(0);
  const filtered = data.filter(item => item.revenue > 0);
  const total = filtered.length;
  const maxStart = Math.max(0, total - VISIBLE_COUNT);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setStartIdx(prev => Math.max(0, prev - PAGE_STEP));
  }, []);

  const goNext = useCallback(() => {
    setDirection(1);
    setStartIdx(prev => Math.min(maxStart, prev + PAGE_STEP));
  }, [maxStart]);

  const visible = filtered.slice(startIdx, startIdx + VISIBLE_COUNT);
  const leftColumn = visible.slice(0, 5);
  const rightColumn = visible.slice(5, 10);
  const isFirst = startIdx === 0;
  const isLast = startIdx >= maxStart;

  return (
    <div className="flex flex-col">
      {/* Header with title + pagination arrows */}
      <div className="mb-[var(--spacing-lg)] flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          Best Sellers
        </h2>
        {total > VISIBLE_COUNT && (
          <div className="flex items-center gap-[var(--spacing-sm)]">
            <button
              type="button"
              onClick={goPrev}
              disabled={isFirst}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold-primary)] disabled:cursor-default disabled:opacity-30"
              aria-label="Previous sellers"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {startIdx + 1}-{Math.min(startIdx + VISIBLE_COUNT, total)} of {total}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={isLast}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold-primary)] disabled:cursor-default disabled:opacity-30"
              aria-label="Next sellers"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Two-column grid with slide animation */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={startIdx}
          initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-2 gap-[var(--spacing-4xl)]"
        >
          <div className="border-r border-[var(--color-gold-subtle)] pr-[var(--spacing-4xl)]">
            {leftColumn.map(item => (
              <SellerRow key={item.rank} item={item} />
            ))}
          </div>
          <div>
            {rightColumn.map(item => (
              <SellerRow key={item.rank} item={item} />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git rm client/src/components/right-panel/TopTenBestSellers.tsx
git add client/src/components/right-panel/BestSellers.tsx
git commit -m "feat(best-sellers): rename to BestSellers, add pagination (25 items, shift by 5), tooltip, unit, zero-value filter"
```

---

### Task 7: Frontend — Create ProductMixCarousel

**Files:**
- Create: `client/src/components/right-panel/ProductMixCarousel.tsx`

- [ ] **Step 1: Create the carousel component**

Create `client/src/components/right-panel/ProductMixCarousel.tsx`:

```typescript
// FILE: client/src/components/right-panel/ProductMixCarousel.tsx
// PURPOSE: Left/right carousel wrapping ProductMixDonut — cycles through 5 mix types
// USED BY: client/src/components/right-panel/ChartsRow.tsx
// EXPORTS: ProductMixCarousel

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProductMixSegment, ProductMixType } from '@shared/types/dashboard';
import { PRODUCT_MIX_LABELS, PRODUCT_MIX_ORDER } from '@shared/types/dashboard';
import { ProductMixDonut } from './ProductMixDonut';

interface ProductMixCarouselProps {
  mixes: Record<ProductMixType, ProductMixSegment[]>;
}

/** WHY inline SVG: avoids icon library dependency for two simple chevrons */
function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProductMixCarousel({ mixes }: ProductMixCarouselProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [direction, setDirection] = useState(0);
  const count = PRODUCT_MIX_ORDER.length;

  const goTo = useCallback((next: number, dir: number) => {
    setDirection(dir);
    setActiveIdx(next);
  }, []);

  const goPrev = useCallback(() => {
    goTo((activeIdx - 1 + count) % count, -1);
  }, [activeIdx, count, goTo]);

  const goNext = useCallback(() => {
    goTo((activeIdx + 1) % count, 1);
  }, [activeIdx, count, goTo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
  }, [goPrev, goNext]);

  const activeMixType = PRODUCT_MIX_ORDER[activeIdx];
  const activeData = mixes[activeMixType];

  return (
    <div
      className="flex flex-col"
      role="tablist"
      aria-label="Product mix chart types"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header with arrows */}
      <div className="mb-[var(--spacing-lg)] flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold-primary)]"
          aria-label="Previous chart type"
        >
          <ChevronLeft />
        </button>
        <h2
          className="text-[14px] font-semibold text-[var(--color-text-primary)]"
          role="tab"
          aria-selected="true"
        >
          Product Mix — {PRODUCT_MIX_LABELS[activeMixType]}
        </h2>
        <button
          type="button"
          onClick={goNext}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold-primary)]"
          aria-label="Next chart type"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Donut with slide animation */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={activeMixType}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
            transition={{ duration: 0.2 }}
          >
            <ProductMixDonut data={activeData} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="mt-[var(--spacing-lg)] flex items-center justify-center gap-[var(--spacing-sm)]">
        {PRODUCT_MIX_ORDER.map((mixType, i) => (
          <button
            key={mixType}
            type="button"
            onClick={() => goTo(i, i > activeIdx ? 1 : -1)}
            className={`h-[6px] w-[6px] cursor-pointer rounded-full transition-colors ${
              i === activeIdx
                ? 'bg-[var(--color-gold-primary)]'
                : 'bg-[var(--color-gold-subtle)]'
            }`}
            role="tab"
            aria-selected={i === activeIdx}
            aria-label={PRODUCT_MIX_LABELS[mixType]}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/right-panel/ProductMixCarousel.tsx
git commit -m "feat(ui): add ProductMixCarousel with left/right arrows and dot indicators"
```

---

### Task 8: Frontend — Wire Carousel into ChartsRow, RightPanel, DashboardLayout

**Files:**
- Modify: `client/src/components/right-panel/ChartsRow.tsx`
- Modify: `client/src/components/right-panel/RightPanel.tsx`
- Modify: `client/src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Update ChartsRow**

Replace the full content of `client/src/components/right-panel/ChartsRow.tsx`:

```typescript
// FILE: client/src/components/right-panel/ChartsRow.tsx
// PURPOSE: CSS Grid row containing Product Mix carousel (3fr) and Top 10 list (5fr)
// USED BY: client/src/components/right-panel/RightPanel.tsx
// EXPORTS: ChartsRow

import type { ProductMixSegment, ProductMixType, TopSellerItem } from '@shared/types/dashboard';
import { ProductMixCarousel } from './ProductMixCarousel';
import { BestSellers } from './BestSellers';

interface ChartsRowProps {
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
}

export function ChartsRow({ productMixes, topSellers }: ChartsRowProps) {
  return (
    <div className="grid grid-cols-[3fr_5fr] gap-[var(--spacing-lg)] max-lg:grid-cols-1">
      {/* Product Mix carousel card */}
      <div className="flex flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
        <ProductMixCarousel mixes={productMixes} />
      </div>

      {/* Best Sellers card — title + arrows are inside BestSellers component */}
      <div className="flex flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
        <BestSellers data={topSellers} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update RightPanel**

In `client/src/components/right-panel/RightPanel.tsx`:

Update the import to include `ProductMixType`:

```typescript
import type {
  EntityListItem, KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType,
  TopSellerItem, SparklineData, OrderRow, ItemCategory, Contact, Period,
} from '@shared/types/dashboard';
```

In the `RightPanelProps` interface, change `productMix` to `productMixes`:

```typescript
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
```

Update the destructured props:

```typescript
  entity, kpis, monthlyRevenue, productMixes, topSellers,
```

Update the ChartsRow usage:

```typescript
      <ChartsRow productMixes={productMixes} topSellers={topSellers} />
```

- [ ] **Step 3: Update DashboardLayout**

In `client/src/layouts/DashboardLayout.tsx`, change line 170 from:

```typescript
                  productMix={dashboard.productMix}
```

to:

```typescript
                  productMixes={dashboard.productMixes}
```

- [ ] **Step 4: Update mock data**

In `client/src/mock-data.ts`, replace the `productMix` field (lines 46-52) with `productMixes`:

```typescript
  productMixes: {
    productType: [
      { category: 'Packaging', value: 91200, percentage: 38 },
      { category: 'Raw Materials', value: 60000, percentage: 25 },
      { category: 'Equipment', value: 36000, percentage: 15 },
      { category: 'Consumables', value: 31200, percentage: 13 },
      { category: 'Other', value: 21600, percentage: 9 },
    ],
    productFamily: [
      { category: 'Family A', value: 100000, percentage: 42 },
      { category: 'Family B', value: 80000, percentage: 33 },
      { category: 'Family C', value: 60200, percentage: 25 },
    ],
    brand: [
      { category: 'BrandX', value: 120000, percentage: 50 },
      { category: 'BrandY', value: 72000, percentage: 30 },
      { category: 'BrandZ', value: 48200, percentage: 20 },
    ],
    countryOfOrigin: [
      { category: 'USA', value: 144000, percentage: 60 },
      { category: 'France', value: 72000, percentage: 30 },
      { category: 'Other', value: 24200, percentage: 10 },
    ],
    foodServiceRetail: [
      { category: 'Food Service', value: 168000, percentage: 70 },
      { category: 'Retail', value: 72200, percentage: 30 },
    ],
  },
```

Also update the mock `topSellers` to include `unit` field and expand to 15+ items (to test pagination). For example:

```typescript
  topSellers: [
    { rank: 1, name: 'Kraft Mailer Box 300x200', sku: 'PKG-KM-300', revenue: 42800, units: 1240, unit: 'cs' },
    { rank: 2, name: 'PE Film Roll 500mm', sku: 'RAW-PE-500', revenue: 38200, units: 860, unit: 'ea' },
    { rank: 3, name: 'Corrugated Sheet A4', sku: 'PKG-CS-A4', revenue: 31500, units: 2100, unit: 'ea' },
    { rank: 4, name: 'Adhesive Tape Industrial', sku: 'CON-AT-IND', revenue: 24600, units: 3400, unit: 'ea' },
    { rank: 5, name: 'Bubble Wrap Roll 1200mm', sku: 'PKG-BW-1200', revenue: 18900, units: 520, unit: 'ea' },
    { rank: 6, name: 'Stretch Wrap 450mm', sku: 'PKG-SW-450', revenue: 16400, units: 780, unit: 'ea' },
    { rank: 7, name: 'Foam Insert Custom', sku: 'PKG-FI-CST', revenue: 14200, units: 640, unit: 'ea' },
    { rank: 8, name: 'Packing Peanuts 50L', sku: 'CON-PP-50L', revenue: 11800, units: 1960, unit: 'lb' },
    { rank: 9, name: 'Label Roll Thermal A6', sku: 'CON-LR-A6', revenue: 9600, units: 4200, unit: 'ea' },
    { rank: 10, name: 'Void Fill Paper Roll', sku: 'PKG-VF-ROL', revenue: 8300, units: 310, unit: 'ea' },
    { rank: 11, name: 'Cardboard Corner Protectors', sku: 'PKG-CP-100', revenue: 7200, units: 5600, unit: 'ea' },
    { rank: 12, name: 'Poly Bag 200x300', sku: 'PKG-PB-200', revenue: 6100, units: 8200, unit: 'ea' },
    { rank: 13, name: 'Kraft Paper Roll 900mm', sku: 'RAW-KP-900', revenue: 5400, units: 180, unit: 'ea' },
    { rank: 14, name: 'Sealing Tape Clear 48mm', sku: 'CON-ST-48C', revenue: 4800, units: 2400, unit: 'ea' },
    { rank: 15, name: 'Edge Board Protector 1m', sku: 'PKG-EB-100', revenue: 4200, units: 1100, unit: 'ea' },
  ],
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/right-panel/ChartsRow.tsx client/src/components/right-panel/RightPanel.tsx client/src/layouts/DashboardLayout.tsx client/src/mock-data.ts
git commit -m "feat(frontend): wire ProductMixCarousel through ChartsRow, RightPanel, DashboardLayout"
```

---

### Task 9: Full Verification

- [ ] **Step 1: Server type check**

Run: `cd server && npx tsc --noEmit`

Expected: PASS — no type errors

- [ ] **Step 2: Client type check**

Run: `cd client && npx tsc -b --noEmit`

Expected: PASS — no type errors

- [ ] **Step 3: Server tests**

Run: `cd server && npx vitest run`

Expected: All tests pass (original + 5 new tests)

- [ ] **Step 4: Client build**

Run: `cd client && npx vite build`

Expected: Build succeeds, bundle under 500KB gzip

- [ ] **Step 5: Manual testing with dev servers**

Start both servers (`npm run dev` in `server/` and `client/`), select customer C7826.

Verify:
- **Best Sellers**: Hover shows styled dark tooltip with full product name. No $0 items visible. Units show actual unit (e.g., "1,240 cs" instead of "1,240 units").
- **Product Mix**: Left/right arrows cycle through 5 donut types. Dot indicators highlight active. Title updates (e.g., "Product Mix — Brand"). Slide animation is smooth.
- **Keyboard**: Focus the carousel, use left/right arrow keys to cycle.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: verify all type checks, tests, and build pass"
```
