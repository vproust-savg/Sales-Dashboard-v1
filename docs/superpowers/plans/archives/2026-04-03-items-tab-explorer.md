# Items Tab Explorer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the read-only Items accordion with an interactive explorer supporting search, sort, filter, and multi-level dynamic grouping.

**Architecture:** Server sends flat SKU-aggregated items with all category fields. Client groups/sorts/filters dynamically via pure utility functions orchestrated by a `useReducer`-based hook. Flat table with inline collapsible group headers renders up to 3 nesting levels.

**Tech Stack:** TypeScript strict, React 19, Tailwind v4, Framer Motion, TanStack Query v5, Vitest

**Spec:** `docs/superpowers/specs/2026-04-03-items-tab-explorer-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `shared/types/dashboard.ts` | modify | Remove `ItemCategory`+`ItemProduct`, add `FlatItem` |
| `server/src/services/data-aggregator.ts` | modify | Replace `buildItemCategories` with `buildFlatItems` |
| `server/tests/services/data-aggregator.test.ts` | modify | Replace item category tests with flat item tests |
| `client/src/utils/items-search.ts` | create | Pure search: name + SKU substring match |
| `client/src/utils/items-filter.ts` | create | Pure filter: AND across fields, OR within field |
| `client/src/utils/items-grouping.ts` | create | Pure grouping: multi-level nesting + sort + aggregation |
| `client/src/hooks/useItemsExplorer.ts` | create | useReducer hook: search/sort/filter/group/expand state |
| `client/src/components/right-panel/ItemsProductRow.tsx` | create | Single product row (name, SKU, value, margins) |
| `client/src/components/right-panel/ItemsGroupRow.tsx` | create | Collapsible group header (chevron, label, badge, metrics) |
| `client/src/components/right-panel/ItemsTable.tsx` | create | Table wrapper + column headers + recursive rendering |
| `client/src/components/right-panel/ItemsToolbar.tsx` | create | Search + group-by dropdowns + sort + filter chips |
| `client/src/components/right-panel/ItemsExplorer.tsx` | create | Top-level Items tab component |
| `client/src/components/right-panel/TabsSection.tsx` | modify | Wire `ItemsExplorer`, update item count |
| `client/src/components/right-panel/RightPanel.tsx` | modify | Update `items` prop type |
| `client/src/hooks/useExport.ts` | modify | Rewrite items CSV loop for `FlatItem[]` |
| `client/src/layouts/DashboardLayout.tsx` | modify | Update `exportData.items` type |
| `client/src/components/right-panel/ItemsAccordion.tsx` | delete | Replaced by new components |

---

## Task 0: Shared Types — Replace ItemCategory with FlatItem

**Files:**
- Modify: `shared/types/dashboard.ts:137-197`

- [ ] **Step 1: Replace ItemCategory + ItemProduct with FlatItem**

In `shared/types/dashboard.ts`, replace lines 137-153 with:

```ts
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
}
```

- [ ] **Step 2: Update DashboardPayload.items type**

In the same file, change line 195:

```ts
// OLD:
items: ItemCategory[];
// NEW:
items: FlatItem[];
```

- [ ] **Step 3: Update EXPORTS comment at top of file (line 4)**

Remove `ItemCategory` from the exports comment. Add `FlatItem`:

```ts
// EXPORTS: DashboardPayload, EntityListItem, KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType, PRODUCT_MIX_LABELS, PRODUCT_MIX_ORDER, TopSellerItem, OrderLineItem, OrderRow, FlatItem, Contact
```

- [ ] **Step 4: Verify server compiles**

Run: `cd server && npx tsc --noEmit 2>&1 | head -20`

Expected: Errors in `data-aggregator.ts` (still imports `ItemCategory`) and possibly test file. This is expected — Task 1 fixes it.

- [ ] **Step 5: Commit**

```bash
git add shared/types/dashboard.ts
git commit -m "refactor: replace ItemCategory+ItemProduct with FlatItem in shared types"
```

---

## Task 1: Server — buildFlatItems with TDD

**Files:**
- Modify: `server/src/services/data-aggregator.ts:6,17,37,144-191`
- Modify: `server/tests/services/data-aggregator.test.ts`

- [ ] **Step 1: Write failing tests for buildFlatItems**

Add to `server/tests/services/data-aggregator.test.ts` after the existing test block (before the closing `});`). Note: `buildFlatItems` is not exported directly — we test it through `aggregateOrders` which calls it and returns `items`.

```ts
describe('buildFlatItems (via aggregateOrders.items)', () => {
  it('returns empty array for order with no items', () => {
    const orders = [makeOrder({ ORDERITEMS_SUBFORM: [] })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.items).toEqual([]);
  });

  it('maps single item with all category fields', () => {
    const orders = [makeOrder()];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.name).toBe('Widget A');
    expect(item.sku).toBe('WGT-A');
    expect(item.value).toBe(5000);
    expect(item.productType).toBe('Packaging');
    expect(item.productFamily).toBe('Family A');
    expect(item.brand).toBe('BrandX');
    expect(item.countryOfOrigin).toBe('USA');
    expect(item.foodServiceRetail).toBe('Food Service');
    expect(item.vendor).toBe('Vendor One');
  });

  it('aggregates same SKU across multiple items', () => {
    const orders = [
      makeOrder({
        ORDNAME: 'O1',
        ORDERITEMS_SUBFORM: [
          makeItem({ PARTNAME: 'WGT-A', QPRICE: 3000, QPROFIT: 1200 }),
          makeItem({ PARTNAME: 'WGT-A', QPRICE: 2000, QPROFIT: 800 }),
        ],
      }),
    ];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].value).toBe(5000);
    expect(result.items[0].marginAmount).toBe(2000);
  });

  it('defaults missing category fields to Other', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [makeItem({ Y_3021_5_ESH: '', Y_9952_5_ESH: '' })],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.items[0].productType).toBe('Other');
    expect(result.items[0].brand).toBe('Other');
  });

  it('maps Y_9967_5_ESH Y to Retail', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [makeItem({ Y_9967_5_ESH: 'Y' })],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.items[0].foodServiceRetail).toBe('Retail');
  });

  it('maps Y_9967_5_ESH non-Y to Food Service', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [makeItem({ Y_9967_5_ESH: 'N' })],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.items[0].foodServiceRetail).toBe('Food Service');
  });

  it('handles zero value without division error', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [makeItem({ QPRICE: 0, QPROFIT: 0 })],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.items[0].marginPercent).toBe(0);
    expect(Number.isFinite(result.items[0].marginPercent)).toBe(true);
  });

  it('produces distinct FlatItems per unique SKU', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        makeItem({ PARTNAME: 'A', PDES: 'Alpha' }),
        makeItem({ PARTNAME: 'B', PDES: 'Beta' }),
        makeItem({ PARTNAME: 'A', PDES: 'Alpha' }),
        makeItem({ PARTNAME: 'C', PDES: 'Charlie' }),
        makeItem({ PARTNAME: 'B', PDES: 'Beta' }),
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.items).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run --reporter=verbose 2>&1 | tail -20`

Expected: FAIL — `result.items[0].productType` is undefined (old `ItemCategory` shape has `.category` not `.productType`).

- [ ] **Step 3: Implement buildFlatItems**

In `data-aggregator.ts`:

1. Update import on line 6 — replace `ItemCategory` with `FlatItem`:

```ts
import type { KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType, TopSellerItem, OrderRow, FlatItem, SparklineData } from '@shared/types/dashboard';
```

2. Update `AggregateResult` interface (line 17):

```ts
items: FlatItem[];
```

3. Replace the entire `buildItemCategories` function (lines 144-190) with:

```ts
/** Items Tab Explorer — flat SKU-aggregated items with all category fields for client-side grouping */
function buildFlatItems(items: RawOrderItem[]): FlatItem[] {
  const bySku = new Map<string, { name: string; sku: string; value: number; profit: number; productType: string; productFamily: string; brand: string; countryOfOrigin: string; foodServiceRetail: string; vendor: string }>();

  items.forEach(item => {
    const existing = bySku.get(item.PARTNAME);
    if (existing) {
      existing.value += item.QPRICE;
      existing.profit += item.QPROFIT;
    } else {
      bySku.set(item.PARTNAME, {
        name: item.PDES,
        sku: item.PARTNAME,
        value: item.QPRICE,
        profit: item.QPROFIT,
        productType: item.Y_3021_5_ESH || 'Other',
        productFamily: item.Y_2075_5_ESH || 'Other',
        brand: item.Y_9952_5_ESH || 'Other',
        countryOfOrigin: item.Y_5380_5_ESH || 'Other',
        foodServiceRetail: item.Y_9967_5_ESH === 'Y' ? 'Retail' : 'Food Service',
        vendor: item.Y_1530_5_ESH || 'Other',
      });
    }
  });

  return [...bySku.values()].map(p => ({
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
  }));
}
```

4. Update the call site (line 37):

```ts
// OLD:
const items = buildItemCategories(allItems);
// NEW:
const items = buildFlatItems(allItems);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run --reporter=verbose 2>&1 | tail -30`

Expected: All new `buildFlatItems` tests PASS. Some existing tests that reference `items[0].category` or `items[0].products` may fail — those will be cleaned up in the next step.

- [ ] **Step 5: Clean up any old ItemCategory test assertions**

If any existing tests reference `result.items[0].category` or `result.items[0].products`, update them to use the new `FlatItem` shape (e.g., `result.items[0].productType`).

- [ ] **Step 6: Verify server compiles cleanly**

Run: `cd server && npx tsc --noEmit`

Expected: Zero errors.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/data-aggregator.ts server/tests/services/data-aggregator.test.ts
git commit -m "feat: replace buildItemCategories with buildFlatItems for Items Explorer"
```

---

## Task 2: Client — Update useExport + RightPanel + DashboardLayout

**Files:**
- Modify: `client/src/hooks/useExport.ts:7-8,14-20,61-75`
- Modify: `client/src/components/right-panel/RightPanel.tsx:8,23`
- Modify: `client/src/layouts/DashboardLayout.tsx:79-82`

- [ ] **Step 1: Update useExport imports and ExportData interface**

In `client/src/hooks/useExport.ts`:

Replace line 8 import:
```ts
// OLD:
  KPIs, OrderRow, ItemCategory, Period,
// NEW:
  KPIs, OrderRow, FlatItem, Period,
```

Replace `items` type in `ExportData` interface (line 19):
```ts
// OLD:
items: ItemCategory[];
// NEW:
items: FlatItem[];
```

- [ ] **Step 2: Rewrite items CSV section**

Replace lines 61-75 in `useExport.ts`:

```ts
  // --- Items Section ---
  lines.push('=== Items ===');
  lines.push('Product,SKU,Product Type,Brand,Value,Margin %,Margin $');
  for (const item of data.items) {
    lines.push([
      escapeCsv(item.name),
      escapeCsv(item.sku),
      escapeCsv(item.productType),
      escapeCsv(item.brand),
      escapeCsv(formatCurrency(item.value)),
      formatPercent(item.marginPercent),
      escapeCsv(formatCurrency(item.marginAmount)),
    ].join(','));
  }
```

- [ ] **Step 3: Update RightPanel.tsx**

In `client/src/components/right-panel/RightPanel.tsx`:

Replace `ItemCategory` with `FlatItem` in import (line 8):
```ts
// OLD:
  TopSellerItem, SparklineData, OrderRow, ItemCategory, Contact, Period,
// NEW:
  TopSellerItem, SparklineData, OrderRow, FlatItem, Contact, Period,
```

Replace `items` type in interface (line 23):
```ts
// OLD:
items: ItemCategory[];
// NEW:
items: FlatItem[];
```

- [ ] **Step 4: Verify client compiles**

Run: `cd client && npx tsc -b --noEmit 2>&1 | head -20`

Expected: Errors only in `TabsSection.tsx` (still imports `ItemCategory`) and `ItemsAccordion.tsx` (will be deleted). These are fixed in later tasks.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useExport.ts client/src/components/right-panel/RightPanel.tsx
git commit -m "refactor: update useExport and RightPanel for FlatItem type"
```

---

## Task 3: Client Utilities — items-search.ts with TDD

**Files:**
- Create: `client/src/utils/items-search.ts`
- Create: `client/src/utils/__tests__/items-search.test.ts`

- [ ] **Step 1: Write failing tests**

Create `client/src/utils/__tests__/items-search.test.ts`:

```ts
// FILE: client/src/utils/__tests__/items-search.test.ts
// PURPOSE: Tests for item search (name + SKU substring match)
// USED BY: test runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { searchItems } from '../items-search';
import type { FlatItem } from '@shared/types/dashboard';

const ITEMS: FlatItem[] = [
  { name: 'MITICA Parmigiano Reggiano', sku: '10914', value: 500, marginPercent: 22, marginAmount: 110, productType: 'Culinary', productFamily: 'Cheese', brand: 'Mitica', countryOfOrigin: 'Italy', foodServiceRetail: 'Food Service', vendor: 'Vendor A' },
  { name: 'TEA FORTE Green Mango', sku: '11829', value: 71, marginPercent: 36, marginAmount: 26, productType: 'Beverages', productFamily: 'Tea', brand: 'Tea Forte', countryOfOrigin: 'USA', foodServiceRetail: 'Retail', vendor: 'Vendor B' },
  { name: 'DGF Apricot in Liqueur', sku: '10334', value: 126, marginPercent: 28, marginAmount: 35, productType: 'Pastry', productFamily: 'Fruits', brand: 'DGF', countryOfOrigin: 'France', foodServiceRetail: 'Food Service', vendor: 'Vendor C' },
];

describe('searchItems', () => {
  it('returns all items for empty search', () => {
    expect(searchItems(ITEMS, '')).toEqual(ITEMS);
  });

  it('matches product name case-insensitively', () => {
    const result = searchItems(ITEMS, 'mitica');
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('10914');
  });

  it('matches SKU', () => {
    const result = searchItems(ITEMS, '10334');
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain('DGF');
  });

  it('returns empty array when nothing matches', () => {
    expect(searchItems(ITEMS, 'zzzzz')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/utils/__tests__/items-search.test.ts --reporter=verbose 2>&1`

Expected: FAIL — `searchItems` not found.

- [ ] **Step 3: Implement searchItems**

Create `client/src/utils/items-search.ts`:

```ts
// FILE: client/src/utils/items-search.ts
// PURPOSE: Filter flat items by name or SKU substring match (case-insensitive)
// USED BY: client/src/hooks/useItemsExplorer.ts
// EXPORTS: searchItems

import type { FlatItem } from '@shared/types/dashboard';

export function searchItems(items: FlatItem[], term: string): FlatItem[] {
  if (!term) return items;
  const lower = term.toLowerCase();
  return items.filter(
    item => item.name.toLowerCase().includes(lower) || item.sku.toLowerCase().includes(lower),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/utils/__tests__/items-search.test.ts --reporter=verbose 2>&1`

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/items-search.ts client/src/utils/__tests__/items-search.test.ts
git commit -m "feat: add items search utility with TDD"
```

---

## Task 4: Client Utilities — items-filter.ts with TDD

**Files:**
- Create: `client/src/utils/items-filter.ts`
- Create: `client/src/utils/__tests__/items-filter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `client/src/utils/__tests__/items-filter.test.ts`:

```ts
// FILE: client/src/utils/__tests__/items-filter.test.ts
// PURPOSE: Tests for item chip filter (AND across fields, OR within field)
// USED BY: test runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { filterItems } from '../items-filter';
import type { FlatItem } from '@shared/types/dashboard';

const ITEMS: FlatItem[] = [
  { name: 'Product A', sku: 'A1', value: 500, marginPercent: 22, marginAmount: 110, productType: 'Culinary', productFamily: 'Cheese', brand: 'Mitica', countryOfOrigin: 'Italy', foodServiceRetail: 'Food Service', vendor: 'V1' },
  { name: 'Product B', sku: 'B1', value: 300, marginPercent: 30, marginAmount: 90, productType: 'Culinary', productFamily: 'Tea', brand: 'DGF', countryOfOrigin: 'France', foodServiceRetail: 'Retail', vendor: 'V2' },
  { name: 'Product C', sku: 'C1', value: 200, marginPercent: 40, marginAmount: 80, productType: 'Beverages', productFamily: 'Tea', brand: 'Mitica', countryOfOrigin: 'Italy', foodServiceRetail: 'Food Service', vendor: 'V1' },
];

describe('filterItems', () => {
  it('returns all items with empty filters', () => {
    expect(filterItems(ITEMS, {})).toEqual(ITEMS);
  });

  it('filters by single field single value', () => {
    const result = filterItems(ITEMS, { productType: ['Culinary'] });
    expect(result).toHaveLength(2);
    expect(result.every(i => i.productType === 'Culinary')).toBe(true);
  });

  it('OR within same field', () => {
    const result = filterItems(ITEMS, { brand: ['Mitica', 'DGF'] });
    expect(result).toHaveLength(3);
  });

  it('AND across different fields', () => {
    const result = filterItems(ITEMS, { productType: ['Culinary'], brand: ['Mitica'] });
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('A1');
  });

  it('ignores fields with empty arrays', () => {
    const result = filterItems(ITEMS, { productType: [], brand: ['Mitica'] });
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/utils/__tests__/items-filter.test.ts --reporter=verbose 2>&1`

Expected: FAIL — `filterItems` not found.

- [ ] **Step 3: Implement filterItems**

Create `client/src/utils/items-filter.ts`:

```ts
// FILE: client/src/utils/items-filter.ts
// PURPOSE: Filter flat items by category chip selections (AND across fields, OR within field)
// USED BY: client/src/hooks/useItemsExplorer.ts
// EXPORTS: filterItems, type ItemFilters

import type { FlatItem } from '@shared/types/dashboard';

/** WHY client-only type — UI concern for grouping/filtering, not an API contract */
export type ItemDimensionKey =
  | 'productType'
  | 'productFamily'
  | 'brand'
  | 'countryOfOrigin'
  | 'foodServiceRetail'
  | 'vendor';

export type ItemFilters = Partial<Record<ItemDimensionKey, string[]>>;

export function filterItems(items: FlatItem[], filters: ItemFilters): FlatItem[] {
  const activeEntries = Object.entries(filters).filter(
    ([, values]) => values && values.length > 0,
  ) as [ItemDimensionKey, string[]][];

  if (activeEntries.length === 0) return items;

  return items.filter(item =>
    activeEntries.every(([field, values]) => values.includes(item[field])),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/utils/__tests__/items-filter.test.ts --reporter=verbose 2>&1`

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/items-filter.ts client/src/utils/__tests__/items-filter.test.ts
git commit -m "feat: add items filter utility with TDD"
```

---

## Task 5: Client Utilities — items-grouping.ts with TDD

**Files:**
- Create: `client/src/utils/items-grouping.ts`
- Create: `client/src/utils/__tests__/items-grouping.test.ts`

- [ ] **Step 1: Write failing tests**

Create `client/src/utils/__tests__/items-grouping.test.ts`:

```ts
// FILE: client/src/utils/__tests__/items-grouping.test.ts
// PURPOSE: Tests for multi-level item grouping, sorting, and aggregation
// USED BY: test runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { groupItems } from '../items-grouping';
import type { FlatItem } from '@shared/types/dashboard';

const ITEMS: FlatItem[] = [
  { name: 'A', sku: 'A1', value: 500, marginPercent: 22, marginAmount: 110, productType: 'Culinary', productFamily: 'Cheese', brand: 'Mitica', countryOfOrigin: 'Italy', foodServiceRetail: 'Food Service', vendor: 'V1' },
  { name: 'B', sku: 'B1', value: 300, marginPercent: 30, marginAmount: 90, productType: 'Culinary', productFamily: 'Tea', brand: 'DGF', countryOfOrigin: 'France', foodServiceRetail: 'Retail', vendor: 'V2' },
  { name: 'C', sku: 'C1', value: 200, marginPercent: 40, marginAmount: 80, productType: 'Beverages', productFamily: 'Tea', brand: 'Mitica', countryOfOrigin: 'Italy', foodServiceRetail: 'Food Service', vendor: 'V1' },
  { name: 'D', sku: 'D1', value: 100, marginPercent: 50, marginAmount: 50, productType: 'Beverages', productFamily: 'Juice', brand: 'Other', countryOfOrigin: 'USA', foodServiceRetail: 'Food Service', vendor: 'V3' },
];

describe('groupItems', () => {
  it('returns empty array with zero levels', () => {
    expect(groupItems(ITEMS, [], 'value', 'desc')).toEqual([]);
  });

  it('groups by one level', () => {
    const groups = groupItems(ITEMS, ['productType'], 'value', 'desc');
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('Culinary');
    expect(groups[1].label).toBe('Beverages');
  });

  it('groups by two levels', () => {
    const groups = groupItems(ITEMS, ['productType', 'brand'], 'value', 'desc');
    expect(groups[0].label).toBe('Culinary');
    expect(groups[0].children).toHaveLength(2); // Mitica, DGF
  });

  it('groups by three levels', () => {
    const groups = groupItems(ITEMS, ['productType', 'brand', 'countryOfOrigin'], 'value', 'desc');
    const culinary = groups[0];
    expect(culinary.children.length).toBeGreaterThan(0);
    const mitica = culinary.children.find(c => c.label === 'Mitica');
    expect(mitica?.children).toHaveLength(1); // Italy
    expect(mitica?.children[0].items).toHaveLength(1);
  });

  it('computes group value as sum of children', () => {
    const groups = groupItems(ITEMS, ['productType'], 'value', 'desc');
    const culinary = groups.find(g => g.label === 'Culinary')!;
    expect(culinary.totals.value).toBe(800); // 500 + 300
  });

  it('computes group margin as weighted average', () => {
    const groups = groupItems(ITEMS, ['productType'], 'value', 'desc');
    const culinary = groups.find(g => g.label === 'Culinary')!;
    // Weighted: (110 + 90) / (500 + 300) * 100 = 25%
    expect(culinary.totals.marginPercent).toBe(25);
  });

  it('counts leaf items correctly', () => {
    const groups = groupItems(ITEMS, ['productType'], 'value', 'desc');
    const culinary = groups.find(g => g.label === 'Culinary')!;
    expect(culinary.totals.itemCount).toBe(2);
  });

  it('sorts groups by sort field descending', () => {
    const groups = groupItems(ITEMS, ['productType'], 'value', 'desc');
    expect(groups[0].label).toBe('Culinary'); // 800 > 300
    expect(groups[1].label).toBe('Beverages');
  });

  it('sorts products within deepest group', () => {
    const groups = groupItems(ITEMS, ['productType'], 'value', 'desc');
    const culinary = groups.find(g => g.label === 'Culinary')!;
    expect(culinary.items[0].value).toBe(500);
    expect(culinary.items[1].value).toBe(300);
  });

  it('builds composite keys with pipe separator', () => {
    const groups = groupItems(ITEMS, ['productType', 'brand'], 'value', 'desc');
    const culinary = groups[0];
    expect(culinary.key).toBe('Culinary');
    expect(culinary.children[0].key).toContain('|');
  });

  it('sorts Other group last regardless of sort direction', () => {
    const items: FlatItem[] = [
      { ...ITEMS[0], productType: 'Other', value: 9999 },
      { ...ITEMS[1], productType: 'Culinary', value: 100 },
    ];
    const groups = groupItems(items, ['productType'], 'value', 'desc');
    expect(groups[groups.length - 1].label).toBe('Other');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/utils/__tests__/items-grouping.test.ts --reporter=verbose 2>&1`

Expected: FAIL — `groupItems` not found.

- [ ] **Step 3: Implement groupItems**

Create `client/src/utils/items-grouping.ts`:

```ts
// FILE: client/src/utils/items-grouping.ts
// PURPOSE: Multi-level grouping, sorting, and aggregation for FlatItem arrays
// USED BY: client/src/hooks/useItemsExplorer.ts
// EXPORTS: groupItems, GroupNode, ItemSortField

import type { FlatItem } from '@shared/types/dashboard';
import type { ItemDimensionKey } from './items-filter';

/** WHY client-only type — sort field is a UI concern, not an API contract */
export type ItemSortField = 'name' | 'value' | 'marginPercent' | 'marginAmount';

export interface GroupNode {
  key: string;
  label: string;
  items: FlatItem[];
  children: GroupNode[];
  totals: {
    value: number;
    marginPercent: number;
    marginAmount: number;
    itemCount: number;
  };
}

export function groupItems(
  items: FlatItem[],
  levels: ItemDimensionKey[],
  sortField: ItemSortField,
  sortDirection: 'asc' | 'desc',
): GroupNode[] {
  if (levels.length === 0) return [];
  return buildLevel(items, levels, 0, '', sortField, sortDirection);
}

function buildLevel(
  items: FlatItem[],
  levels: ItemDimensionKey[],
  depth: number,
  parentKey: string,
  sortField: ItemSortField,
  sortDirection: 'asc' | 'desc',
): GroupNode[] {
  const field = levels[depth];
  const groups = new Map<string, FlatItem[]>();

  items.forEach(item => {
    const label = item[field] || 'Other';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  });

  const isDeepest = depth === levels.length - 1;

  const nodes: GroupNode[] = [...groups.entries()].map(([label, groupItems]) => {
    const key = parentKey ? `${parentKey}|${label}` : label;
    const children = isDeepest
      ? []
      : buildLevel(groupItems, levels, depth + 1, key, sortField, sortDirection);
    const sortedItems = isDeepest ? sortFlatItems(groupItems, sortField, sortDirection) : groupItems;

    const totalValue = groupItems.reduce((s, i) => s + i.value, 0);
    const totalMarginAmount = groupItems.reduce((s, i) => s + i.marginAmount, 0);

    return {
      key,
      label,
      items: isDeepest ? sortedItems : groupItems,
      children,
      totals: {
        value: totalValue,
        marginPercent: totalValue > 0 ? (totalMarginAmount / totalValue) * 100 : 0,
        marginAmount: totalMarginAmount,
        itemCount: groupItems.length,
      },
    };
  });

  return sortGroups(nodes, sortField, sortDirection);
}

function sortGroups(nodes: GroupNode[], field: ItemSortField, dir: 'asc' | 'desc'): GroupNode[] {
  return [...nodes].sort((a, b) => {
    /** WHY: "Other" always sorts last regardless of field/direction */
    if (a.label === 'Other') return 1;
    if (b.label === 'Other') return -1;

    const aVal = field === 'name' ? a.label : a.totals[field];
    const bVal = field === 'name' ? b.label : b.totals[field];

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const diff = (aVal as number) - (bVal as number);
    return dir === 'asc' ? diff : -diff;
  });
}

export function sortFlatItems(items: FlatItem[], field: ItemSortField, dir: 'asc' | 'desc'): FlatItem[] {
  return [...items].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const diff = (aVal as number) - (bVal as number);
    return dir === 'asc' ? diff : -diff;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/utils/__tests__/items-grouping.test.ts --reporter=verbose 2>&1`

Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/items-grouping.ts client/src/utils/__tests__/items-grouping.test.ts
git commit -m "feat: add items grouping utility with TDD (multi-level, sort, aggregate)"
```

---

## Task 6: Client Hook — useItemsExplorer

**Files:**
- Create: `client/src/hooks/useItemsExplorer.ts`

- [ ] **Step 1: Create the hook**

Create `client/src/hooks/useItemsExplorer.ts`:

```ts
// FILE: client/src/hooks/useItemsExplorer.ts
// PURPOSE: useReducer-based state for Items tab (search, sort, filter, group, expand)
// USED BY: client/src/components/right-panel/ItemsExplorer.tsx
// EXPORTS: useItemsExplorer

import { useReducer, useMemo, useEffect, useCallback } from 'react';
import type { FlatItem } from '@shared/types/dashboard';
import { searchItems } from '../utils/items-search';
import { filterItems } from '../utils/items-filter';
import type { ItemDimensionKey, ItemFilters } from '../utils/items-filter';
import { groupItems, sortFlatItems } from '../utils/items-grouping';
import type { GroupNode, ItemSortField } from '../utils/items-grouping';

interface State {
  searchTerm: string;
  groupLevels: ItemDimensionKey[];
  sortField: ItemSortField;
  sortDirection: 'asc' | 'desc';
  filters: ItemFilters;
  expandedGroups: Set<string>;
}

type Action =
  | { type: 'setSearch'; term: string }
  | { type: 'setGroupLevels'; levels: ItemDimensionKey[] }
  | { type: 'toggleSort'; field: ItemSortField }
  | { type: 'setFilter'; field: ItemDimensionKey; values: string[] }
  | { type: 'clearAllFilters' }
  | { type: 'toggleGroup'; key: string }
  | { type: 'reset' };

const INITIAL: State = {
  searchTerm: '',
  groupLevels: ['productType'],
  sortField: 'value',
  sortDirection: 'desc',
  filters: {},
  expandedGroups: new Set(),
};

/** WHY useReducer: 6 interdependent state atoms — avoids stale closure bugs (same as useSort) */
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setSearch':
      return { ...state, searchTerm: action.term };
    case 'setGroupLevels':
      return { ...state, groupLevels: action.levels, expandedGroups: new Set() };
    case 'toggleSort':
      if (state.sortField === action.field) {
        return { ...state, sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc' };
      }
      return { ...state, sortField: action.field, sortDirection: 'desc' };
    case 'setFilter': {
      const filters = { ...state.filters };
      if (action.values.length === 0) {
        delete filters[action.field];
      } else {
        filters[action.field] = action.values;
      }
      return { ...state, filters };
    }
    case 'clearAllFilters':
      return { ...state, filters: {} };
    case 'toggleGroup': {
      const next = new Set(state.expandedGroups);
      if (next.has(action.key)) next.delete(action.key);
      else next.add(action.key);
      return { ...state, expandedGroups: next };
    }
    case 'reset':
      return INITIAL;
  }
}

export function useItemsExplorer(items: FlatItem[]) {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  /** WHY: Reset all state when items change (entity switch) */
  const itemsRef = items;
  useEffect(() => {
    dispatch({ type: 'reset' });
  }, [itemsRef]);

  const filteredItems = useMemo(() => {
    let result = filterItems(items, state.filters);
    if (state.searchTerm) result = searchItems(result, state.searchTerm);
    return result;
  }, [items, state.filters, state.searchTerm]);

  const groups = useMemo(
    () => groupItems(filteredItems, state.groupLevels, state.sortField, state.sortDirection),
    [filteredItems, state.groupLevels, state.sortField, state.sortDirection],
  );

  const sortedFlatItems = useMemo(
    () => sortFlatItems(filteredItems, state.sortField, state.sortDirection),
    [filteredItems, state.sortField, state.sortDirection],
  );

  const setSearch = useCallback((term: string) => dispatch({ type: 'setSearch', term }), []);
  const setGroupLevels = useCallback((levels: ItemDimensionKey[]) => dispatch({ type: 'setGroupLevels', levels }), []);
  const toggleSort = useCallback((field: ItemSortField) => dispatch({ type: 'toggleSort', field }), []);
  const setFilter = useCallback((field: ItemDimensionKey, values: string[]) => dispatch({ type: 'setFilter', field, values }), []);
  const clearAllFilters = useCallback(() => dispatch({ type: 'clearAllFilters' }), []);
  const toggleGroup = useCallback((key: string) => dispatch({ type: 'toggleGroup', key }), []);

  return {
    ...state,
    filteredItems,
    groups,
    sortedFlatItems,
    totalCount: items.length,
    filteredCount: filteredItems.length,
    setSearch,
    setGroupLevels,
    toggleSort,
    setFilter,
    clearAllFilters,
    toggleGroup,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd client && npx tsc -b --noEmit 2>&1 | head -10`

Expected: Only errors from `TabsSection.tsx` / `ItemsAccordion.tsx` (not yet updated).

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useItemsExplorer.ts
git commit -m "feat: add useItemsExplorer hook (useReducer state for Items tab)"
```

---

## Task 7: Client Components — ItemsProductRow + ItemsGroupRow

**Files:**
- Create: `client/src/components/right-panel/ItemsProductRow.tsx`
- Create: `client/src/components/right-panel/ItemsGroupRow.tsx`

- [ ] **Step 1: Create ItemsProductRow**

Create `client/src/components/right-panel/ItemsProductRow.tsx`:

```tsx
// FILE: client/src/components/right-panel/ItemsProductRow.tsx
// PURPOSE: Single product row in Items table (name, SKU, value, margins)
// USED BY: ItemsTable.tsx
// EXPORTS: ItemsProductRow

import type { FlatItem } from '@shared/types/dashboard';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';
import { CopyableId } from '../shared/CopyableId';

interface ItemsProductRowProps {
  item: FlatItem;
  depth: number;
}

export function ItemsProductRow({ item, depth }: ItemsProductRowProps) {
  /** WHY: depth * 24px + 24px base = indentation under deepest group level */
  const paddingLeft = `${depth * 24 + 24}px`;

  return (
    <div
      role="row"
      aria-level={depth + 1}
      className="flex items-center border-b border-[var(--color-bg-page)] py-[var(--spacing-md)] hover:bg-[var(--color-gold-hover)] transition-colors duration-150"
      style={{ paddingLeft, paddingRight: 'var(--spacing-3xl)' }}
    >
      <div role="gridcell" className="flex-1 min-w-0">
        <span className="block text-[13px] text-[var(--color-text-primary)] truncate">
          {item.name}
        </span>
        <CopyableId value={item.sku} label="SKU" className="block text-[11px] text-[var(--color-text-faint)]" />
      </div>
      <div role="gridcell" className="w-24 text-right text-[13px] tabular-nums text-[var(--color-text-primary)]">
        {formatCurrency(item.value)}
      </div>
      <div role="gridcell" className="w-20 text-right text-[13px] tabular-nums text-[var(--color-text-muted)]">
        {formatPercent(item.marginPercent)}
      </div>
      <div role="gridcell" className="w-24 text-right text-[13px] tabular-nums text-[var(--color-text-muted)]">
        {formatCurrency(item.marginAmount)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ItemsGroupRow**

Create `client/src/components/right-panel/ItemsGroupRow.tsx`:

```tsx
// FILE: client/src/components/right-panel/ItemsGroupRow.tsx
// PURPOSE: Collapsible group header row (chevron, label, badge, aggregated metrics)
// USED BY: ItemsTable.tsx
// EXPORTS: ItemsGroupRow

import type { GroupNode } from '../../utils/items-grouping';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';

interface ItemsGroupRowProps {
  group: GroupNode;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ItemsGroupRow({ group, depth, isExpanded, onToggle }: ItemsGroupRowProps) {
  const paddingLeft = `${depth * 24}px`;

  return (
    <button
      type="button"
      role="row"
      aria-expanded={isExpanded}
      aria-level={depth + 1}
      onClick={onToggle}
      className="flex w-full items-center bg-[var(--color-gold-hover)] border-b border-[var(--color-gold-subtle)] py-[var(--spacing-base)] hover:bg-[var(--color-gold-subtle)] transition-colors duration-150"
      style={{ paddingLeft: `calc(${paddingLeft} + var(--spacing-3xl))`, paddingRight: 'var(--spacing-3xl)' }}
    >
      <svg
        width="14" height="14" viewBox="0 0 14 14" fill="none"
        className={`mr-2 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        aria-hidden="true"
      >
        <path d="M5 3l4 4-4 4" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <span className="flex-1 text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
        {group.label}
      </span>

      <span className="mx-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-gold-subtle)] px-1 text-[9px] font-semibold text-[var(--color-text-muted)]">
        {group.totals.itemCount}
      </span>

      <span role="gridcell" className="w-24 text-right text-[13px] tabular-nums text-[var(--color-text-primary)]">
        {formatCurrency(group.totals.value)}
      </span>
      <span role="gridcell" className="w-20 text-right text-[13px] tabular-nums text-[var(--color-text-secondary)]">
        {formatPercent(group.totals.marginPercent)}
      </span>
      <span role="gridcell" className="w-24 text-right text-[13px] tabular-nums text-[var(--color-text-secondary)]">
        {formatCurrency(group.totals.marginAmount)}
      </span>
    </button>
  );
}
```

- [ ] **Step 3: Verify both compile**

Run: `cd client && npx tsc -b --noEmit 2>&1 | grep -c 'error'`

Expected: Only errors from files not yet updated (TabsSection, ItemsAccordion).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/right-panel/ItemsProductRow.tsx client/src/components/right-panel/ItemsGroupRow.tsx
git commit -m "feat: add ItemsProductRow and ItemsGroupRow components"
```

---

## Task 8: Client Components — ItemsTable

**Files:**
- Create: `client/src/components/right-panel/ItemsTable.tsx`

- [ ] **Step 1: Create ItemsTable**

Create `client/src/components/right-panel/ItemsTable.tsx`:

```tsx
// FILE: client/src/components/right-panel/ItemsTable.tsx
// PURPOSE: Table with column headers + recursive group rendering or flat list
// USED BY: ItemsExplorer.tsx
// EXPORTS: ItemsTable

import { motion, AnimatePresence } from 'framer-motion';
import type { FlatItem } from '@shared/types/dashboard';
import type { GroupNode, ItemSortField } from '../../utils/items-grouping';
import { ItemsGroupRow } from './ItemsGroupRow';
import { ItemsProductRow } from './ItemsProductRow';

interface ItemsTableProps {
  groups: GroupNode[];
  flatItems: FlatItem[];
  isGrouped: boolean;
  sortField: ItemSortField;
  sortDirection: 'asc' | 'desc';
  expandedGroups: Set<string>;
  onToggleSort: (field: ItemSortField) => void;
  onToggleGroup: (key: string) => void;
}

const COLUMNS: { label: string; field: ItemSortField | null; width: string }[] = [
  { label: 'Product', field: 'name', width: 'flex-1' },
  { label: 'Value', field: 'value', width: 'w-24' },
  { label: 'Margin %', field: 'marginPercent', width: 'w-20' },
  { label: 'Margin $', field: 'marginAmount', width: 'w-24' },
];

function SortArrow({ field, sortField, sortDirection }: { field: ItemSortField; sortField: ItemSortField; sortDirection: string }) {
  if (field !== sortField) return null;
  return <span className="ml-1 text-[9px]">{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>;
}

export function ItemsTable({ groups, flatItems, isGrouped, sortField, sortDirection, expandedGroups, onToggleSort, onToggleGroup }: ItemsTableProps) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]" role={isGrouped ? 'treegrid' : 'table'} aria-label="Items explorer">
        {/* Column headers */}
        <div className="flex items-center border-b border-[var(--color-gold-subtle)] px-[var(--spacing-3xl)] py-[var(--spacing-lg)]" role="row">
          {COLUMNS.map(col => (
            <button
              key={col.label}
              type="button"
              role="columnheader"
              aria-sort={col.field === sortField ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
              onClick={col.field ? () => onToggleSort(col.field!) : undefined}
              className={`${col.width} text-${col.field === 'name' ? 'left' : 'right'} text-[11px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide hover:text-[var(--color-text-secondary)] transition-colors`}
            >
              {col.label}
              {col.field && <SortArrow field={col.field} sortField={sortField} sortDirection={sortDirection} />}
            </button>
          ))}
        </div>

        {/* Content: grouped or flat */}
        {isGrouped
          ? groups.map(group => (
            <GroupSection key={group.key} group={group} depth={0} expandedGroups={expandedGroups} onToggleGroup={onToggleGroup} />
          ))
          : flatItems.map(item => (
            <ItemsProductRow key={item.sku} item={item} depth={0} />
          ))
        }
      </div>
    </div>
  );
}

function GroupSection({ group, depth, expandedGroups, onToggleGroup }: {
  group: GroupNode; depth: number; expandedGroups: Set<string>; onToggleGroup: (key: string) => void;
}) {
  const isExpanded = expandedGroups.has(group.key);
  const hasChildren = group.children.length > 0;

  return (
    <div>
      <ItemsGroupRow group={group} depth={depth} isExpanded={isExpanded} onToggle={() => onToggleGroup(group.key)} />
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {hasChildren
              ? group.children.map(child => (
                <GroupSection key={child.key} group={child} depth={depth + 1} expandedGroups={expandedGroups} onToggleGroup={onToggleGroup} />
              ))
              : group.items.map(item => (
                <ItemsProductRow key={item.sku} item={item} depth={depth + 1} />
              ))
            }
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd client && npx tsc -b --noEmit 2>&1 | grep 'ItemsTable'`

Expected: No errors referencing ItemsTable.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/right-panel/ItemsTable.tsx
git commit -m "feat: add ItemsTable with recursive group rendering"
```

---

## Task 9: Client Components — ItemsToolbar

**Files:**
- Create: `client/src/components/right-panel/ItemsToolbar.tsx`

- [ ] **Step 1: Create ItemsToolbar**

Create `client/src/components/right-panel/ItemsToolbar.tsx`. This is the most complex UI component — search input, group-by dropdowns, sort control, filter chips. Due to the 200-line limit, use compact but clear code:

```tsx
// FILE: client/src/components/right-panel/ItemsToolbar.tsx
// PURPOSE: Search + group-by dropdowns + sort dropdown + filter chips for Items tab
// USED BY: ItemsExplorer.tsx
// EXPORTS: ItemsToolbar

import { useState, useRef, useEffect } from 'react';
import type { ItemDimensionKey, ItemFilters } from '../../utils/items-filter';
import type { ItemSortField } from '../../utils/items-grouping';
import type { FlatItem } from '@shared/types/dashboard';

interface ItemsToolbarProps {
  searchTerm: string;
  onSearch: (term: string) => void;
  groupLevels: ItemDimensionKey[];
  onGroupLevelsChange: (levels: ItemDimensionKey[]) => void;
  sortField: ItemSortField;
  sortDirection: 'asc' | 'desc';
  onToggleSort: (field: ItemSortField) => void;
  filters: ItemFilters;
  onSetFilter: (field: ItemDimensionKey, values: string[]) => void;
  onClearAllFilters: () => void;
  items: FlatItem[];
  totalCount: number;
  filteredCount: number;
}

const DIMENSION_LABELS: Record<ItemDimensionKey, string> = {
  productType: 'Product Type',
  productFamily: 'Product Family',
  brand: 'Brand',
  countryOfOrigin: 'Country of Origin',
  foodServiceRetail: 'FS/Retail',
  vendor: 'Vendor',
};

const SORT_LABELS: Record<ItemSortField, string> = {
  name: 'Name', value: 'Value', marginPercent: 'Margin %', marginAmount: 'Margin $',
};

const FILTER_FIELDS: ItemDimensionKey[] = ['productType', 'productFamily', 'brand', 'countryOfOrigin', 'foodServiceRetail'];

export function ItemsToolbar({
  searchTerm, onSearch, groupLevels, onGroupLevelsChange,
  sortField, sortDirection, onToggleSort,
  filters, onSetFilter, onClearAllFilters,
  items, totalCount, filteredCount,
}: ItemsToolbarProps) {
  const [localSearch, setLocalSearch] = useState(searchTerm);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  /** WHY: Sync external reset (entity change) → local input */
  useEffect(() => { setLocalSearch(searchTerm); }, [searchTerm]);

  function handleSearchChange(value: string) {
    setLocalSearch(value);
    clearTimeout(timerRef.current);
    if (!value) { onSearch(''); return; }
    timerRef.current = setTimeout(() => onSearch(value), 200);
  }

  const hasActiveFilters = Object.values(filters).some(v => v && v.length > 0);
  const isFiltered = totalCount !== filteredCount;

  return (
    <div className="sticky top-0 z-10 bg-[var(--color-bg-card)] border-b border-[var(--color-gold-subtle)] px-[var(--spacing-3xl)] py-[var(--spacing-base)] space-y-2">
      {/* Row 1: Search + Group By */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-[220px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={localSearch}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search items..."
            className="w-full h-[32px] rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] border border-[var(--color-gold-subtle)] pl-8 pr-7 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-gold-primary)]"
          />
          {localSearch && (
            <button type="button" onClick={() => handleSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Clear search">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l6 6M9 3l-6 6" /></svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]">
          <span>Group:</span>
          {groupLevels.map((level, i) => (
            <GroupDropdown
              key={i}
              value={level}
              excluded={groupLevels.filter((_, j) => j !== i)}
              onChange={val => {
                const next = [...groupLevels];
                if (val === 'none') { onGroupLevelsChange(next.slice(0, i)); }
                else { next[i] = val as ItemDimensionKey; onGroupLevelsChange(next); }
              }}
              onRemove={i > 0 ? () => onGroupLevelsChange(groupLevels.filter((_, j) => j !== i)) : undefined}
            />
          ))}
          {groupLevels.length < 3 && groupLevels.length > 0 && (
            <button type="button" onClick={() => onGroupLevelsChange([...groupLevels, getNextAvailable(groupLevels)])} className="px-2 py-0.5 rounded border border-dashed border-[var(--color-gold-subtle)] text-[11px] text-[var(--color-text-muted)] hover:border-[var(--color-gold-primary)]">
              + Level
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Sort + Filter Chips + Count */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-[12px] text-[var(--color-text-muted)]">
          <span>Sort:</span>
          <select
            value={sortField}
            onChange={e => onToggleSort(e.target.value as ItemSortField)}
            className="bg-transparent border border-[var(--color-gold-subtle)] rounded px-1.5 py-0.5 text-[12px] text-[var(--color-text-primary)] outline-none"
          >
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button type="button" onClick={() => onToggleSort(sortField)} className="text-[11px] px-1 hover:text-[var(--color-text-primary)]">
            {sortDirection === 'asc' ? '\u2191' : '\u2193'}
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
          {FILTER_FIELDS.map(field => (
            <FilterChip key={field} field={field} items={items} activeValues={filters[field] ?? []} onChange={values => onSetFilter(field, values)} />
          ))}
          {hasActiveFilters && (
            <button type="button" onClick={onClearAllFilters} className="text-[11px] text-[var(--color-gold-primary)] hover:underline whitespace-nowrap">
              Clear all
            </button>
          )}
        </div>

        {isFiltered && (
          <span className="text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
            {filteredCount} of {totalCount}
          </span>
        )}
      </div>
    </div>
  );
}

/* --- Sub-components --- */

function GroupDropdown({ value, excluded, onChange, onRemove }: {
  value: ItemDimensionKey; excluded: ItemDimensionKey[]; onChange: (val: string) => void; onRemove?: () => void;
}) {
  const options = Object.entries(DIMENSION_LABELS).filter(([k]) => !excluded.includes(k as ItemDimensionKey));
  return (
    <div className="flex items-center gap-0.5">
      <select value={value} onChange={e => onChange(e.target.value)} className="bg-transparent border border-[var(--color-gold-subtle)] rounded px-1.5 py-0.5 text-[12px] text-[var(--color-text-primary)] outline-none">
        {options.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        <option value="none">None</option>
      </select>
      {onRemove && (
        <button type="button" onClick={onRemove} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Remove level">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l6 6M9 3l-6 6" /></svg>
        </button>
      )}
    </div>
  );
}

function FilterChip({ field, items, activeValues, onChange }: {
  field: ItemDimensionKey; items: FlatItem[]; activeValues: string[]; onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const distinctValues = [...new Set(items.map(i => i[field]))].filter(Boolean).sort();
  const isActive = activeValues.length > 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={`px-2 py-0.5 rounded-full text-[11px] border whitespace-nowrap transition-colors ${isActive ? 'border-[var(--color-gold-primary)] text-[var(--color-gold-primary)] bg-[var(--color-gold-hover)]' : 'border-[var(--color-gold-subtle)] text-[var(--color-text-muted)]'}`}>
        {DIMENSION_LABELS[field]}{isActive && ` (${activeValues.length})`}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-20 bg-[var(--color-bg-card)] border border-[var(--color-gold-subtle)] rounded-lg shadow-lg p-2 min-w-[160px] max-h-[200px] overflow-y-auto">
          {distinctValues.map(val => (
            <label key={val} className="flex items-center gap-2 px-2 py-1 text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-gold-hover)] rounded cursor-pointer">
              <input type="checkbox" checked={activeValues.includes(val)} onChange={() => {
                const next = activeValues.includes(val) ? activeValues.filter(v => v !== val) : [...activeValues, val];
                onChange(next);
              }} className="accent-[var(--color-gold-primary)]" />
              {val}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function getNextAvailable(used: ItemDimensionKey[]): ItemDimensionKey {
  const all: ItemDimensionKey[] = ['productType', 'productFamily', 'brand', 'countryOfOrigin', 'foodServiceRetail', 'vendor'];
  return all.find(k => !used.includes(k)) ?? 'productType';
}
```

Note: This file is ~180 lines. If it exceeds 200 lines after formatting, split `FilterChip` into its own file.

- [ ] **Step 2: Verify it compiles**

Run: `cd client && npx tsc -b --noEmit 2>&1 | grep 'ItemsToolbar'`

Expected: No errors referencing ItemsToolbar.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/right-panel/ItemsToolbar.tsx
git commit -m "feat: add ItemsToolbar (search, group-by, sort, filter chips)"
```

---

## Task 10: Client Components — ItemsExplorer + Wire into TabsSection

**Files:**
- Create: `client/src/components/right-panel/ItemsExplorer.tsx`
- Modify: `client/src/components/right-panel/TabsSection.tsx`
- Delete: `client/src/components/right-panel/ItemsAccordion.tsx`

- [ ] **Step 1: Create ItemsExplorer**

Create `client/src/components/right-panel/ItemsExplorer.tsx`:

```tsx
// FILE: client/src/components/right-panel/ItemsExplorer.tsx
// PURPOSE: Top-level Items tab component — orchestrates toolbar + table
// USED BY: TabsSection.tsx
// EXPORTS: ItemsExplorer

import type { FlatItem } from '@shared/types/dashboard';
import { useItemsExplorer } from '../../hooks/useItemsExplorer';
import { ItemsToolbar } from './ItemsToolbar';
import { ItemsTable } from './ItemsTable';
import { EmptyState } from '../shared/EmptyState';

interface ItemsExplorerProps {
  items: FlatItem[];
}

export function ItemsExplorer({ items }: ItemsExplorerProps) {
  const explorer = useItemsExplorer(items);
  const isGrouped = explorer.groupLevels.length > 0;

  if (items.length === 0) {
    return (
      <EmptyState
        title="No items for this period."
        description="Product categories will appear here when available."
      />
    );
  }

  const hasResults = explorer.filteredCount > 0;

  return (
    <div>
      <ItemsToolbar
        searchTerm={explorer.searchTerm}
        onSearch={explorer.setSearch}
        groupLevels={explorer.groupLevels}
        onGroupLevelsChange={explorer.setGroupLevels}
        sortField={explorer.sortField}
        sortDirection={explorer.sortDirection}
        onToggleSort={explorer.toggleSort}
        filters={explorer.filters}
        onSetFilter={explorer.setFilter}
        onClearAllFilters={explorer.clearAllFilters}
        items={items}
        totalCount={explorer.totalCount}
        filteredCount={explorer.filteredCount}
      />

      {hasResults ? (
        <ItemsTable
          groups={explorer.groups}
          flatItems={explorer.sortedFlatItems}
          isGrouped={isGrouped}
          sortField={explorer.sortField}
          sortDirection={explorer.sortDirection}
          expandedGroups={explorer.expandedGroups}
          onToggleSort={explorer.toggleSort}
          onToggleGroup={explorer.toggleGroup}
        />
      ) : (
        <EmptyState
          title={explorer.searchTerm ? 'No items match your search.' : 'No items match your filters.'}
          description={explorer.searchTerm ? 'Try a different search term.' : 'Adjust or clear your filters.'}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update TabsSection**

In `client/src/components/right-panel/TabsSection.tsx`:

Replace imports (lines 7-9):
```ts
// OLD:
import type { OrderRow, ItemCategory, Contact } from '@shared/types/dashboard';
import { OrdersTable } from './OrdersTable';
import { ItemsAccordion } from './ItemsAccordion';
// NEW:
import type { OrderRow, FlatItem, Contact } from '@shared/types/dashboard';
import { OrdersTable } from './OrdersTable';
import { ItemsExplorer } from './ItemsExplorer';
```

Replace `items` type in interface (line 14):
```ts
// OLD:
items: ItemCategory[];
// NEW:
items: FlatItem[];
```

Replace item count calculation (line 32):
```ts
// OLD:
{ key: 'items', label: 'Items', count: items.reduce((sum, cat) => sum + cat.itemCount, 0) },
// NEW:
{ key: 'items', label: 'Items', count: items.length },
```

Replace Items tab rendering (line 122):
```tsx
// OLD:
{activeTab === 'items' && <ItemsAccordion items={items} />}
// NEW:
{activeTab === 'items' && <ItemsExplorer items={items} />}
```

- [ ] **Step 3: Delete ItemsAccordion.tsx**

```bash
rm client/src/components/right-panel/ItemsAccordion.tsx
```

- [ ] **Step 4: Verify full client compiles**

Run: `cd client && npx tsc -b --noEmit`

Expected: Zero TypeScript errors.

- [ ] **Step 5: Verify full server compiles**

Run: `cd server && npx tsc --noEmit`

Expected: Zero TypeScript errors.

- [ ] **Step 6: Run all server tests**

Run: `cd server && npx vitest run --reporter=verbose 2>&1 | tail -10`

Expected: All tests pass (including new buildFlatItems tests).

- [ ] **Step 7: Build client bundle**

Run: `cd client && npx vite build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Items Tab Explorer — complete implementation with search, sort, filter, multi-level grouping"
```

---

## Task 11: Manual Verification

- [ ] **Step 1: Start dev servers**

```bash
cd server && npm run dev &
cd client && npm run dev &
```

- [ ] **Step 2: Visual check in browser**

Open `http://localhost:5173`. Select Bay Cities (6 orders, 29 items). Click Items tab. Verify:
- Toolbar appears with search, group-by (defaulting to Product Type), sort, filter chips
- Items are grouped by Product Type (Culinary, Pastry, Beverages) — same as before
- Clicking a group expands to show products
- Search filters products by name/SKU
- Filter chips show distinct values and narrow results
- Group-by dropdown switches grouping dimension
- Adding a second group level creates nested groups
- Sort dropdown and column headers both control sort order

- [ ] **Step 3: Run pre-deploy checklist**

```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
cd ../server && npx vitest run
cd ../client && npx vite build
```

All must pass.

- [ ] **Step 4: Verify no `any` types**

```bash
grep -rn ": any\|as any" server/src/ client/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Expected: Zero matches in new files.

---

## Review Checkpoints

**After Task 1:** Server compiles, all tests pass. `aggregateOrders` returns `FlatItem[]` shape.

**After Task 5:** All 3 client utility test suites pass (search: 4, filter: 5, grouping: 11 = 20 tests).

**After Task 10:** Full build succeeds. Zero TypeScript errors. All server tests pass. Client bundle builds.
