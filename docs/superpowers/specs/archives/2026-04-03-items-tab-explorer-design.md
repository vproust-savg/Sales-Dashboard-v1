# Items Tab Explorer — Design Spec

**Date:** 2026-04-03
**Status:** Draft (Strengthened)
**Scope:** Enhanced Items tab with search, sort, filter, and multi-level dynamic grouping

---

## 1. Overview

Transform the Items tab from a read-only Product Type accordion into an interactive explorer. Users can search products, sort by any metric, filter by category fields, and dynamically group by up to 3 nested dimensions.

**What changes:**
- Server sends flat enriched items instead of pre-grouped categories
- New toolbar inside the Items tab with search, group-by, sort, and filter controls
- Flat table with inline collapsible group headers replaces the accordion
- Up to 3-level nested grouping with dynamic dimension selection

**What does NOT change:**
- Product Mix carousel (separate component, separate data path)
- Best Sellers list
- Orders and Contacts tabs
- API route shape (`/api/dashboard/:dimension/:id`)
- Redis cache structure (key shapes unchanged — only the serialized payload changes)

---

## 2. Data Architecture

### 2.1 Server: Flat Items

Replace `buildItemCategories()` in `data-aggregator.ts` with `buildFlatItems()`.

Each raw order item is aggregated by SKU (same product across multiple orders becomes one row with summed metrics), then enriched with all category fields:

```ts
interface FlatItem {
  name: string;            // PDES — product description
  sku: string;             // PARTNAME — product SKU
  value: number;           // QPRICE — total revenue (aggregated by SKU)
  marginPercent: number;   // computed: (profit / value) * 100
  marginAmount: number;    // QPROFIT — total profit (aggregated)
  // Category fields for grouping & filtering:
  productType: string;     // Y_3021_5_ESH — default grouping dimension
  productFamily: string;   // Y_2075_5_ESH
  brand: string;           // Y_9952_5_ESH
  countryOfOrigin: string; // Y_5380_5_ESH
  foodServiceRetail: string; // "Food Service" | "Retail" (mapped from Y_9967_5_ESH)
  vendor: string;          // Y_1530_5_ESH
}
```

**Design decision — no quantity column:** The same SKU can appear across orders with different units (e.g., 10 lb + 5 cs). Rather than show misleading mixed-unit sums, quantity and unit are omitted entirely. Value and margin are the meaningful metrics.

Empty category values default to `"Other"` on the server.

### 2.2 Shared Types

- Remove `ItemCategory` and `ItemProduct` interfaces from `shared/types/dashboard.ts`
- Add `FlatItem` interface to `shared/types/dashboard.ts`
- Update `DashboardPayload.items` from `ItemCategory[]` to `FlatItem[]`

### 2.3 Item Count

Tab badge count changes from `items.reduce((s, c) => s + c.itemCount, 0)` to `items.length`.

**Filtered count badge:** When items search/filter is active, the badge shows `"12/29"` format (filtered count / total count). Since `useItemsExplorer` is instantiated inside `ItemsExplorer` (deeper than `TabsSection`), the filtered count must flow upward. Solution: `TabsSection` passes the total `items.length` into `ItemsExplorer`, and `ItemsExplorer` renders its own filtered count badge overlay via a callback or by rendering the count inline within the tab panel header area. Simplest approach: the "12/29" filtered indicator appears in the `ItemsToolbar` (e.g., "Showing 12 of 29 items") rather than modifying the tab badge itself — this avoids the state-lifting complexity entirely.

### 2.4 Callers of `aggregateOrders`

Both server paths that produce `DashboardPayload` call `aggregateOrders()`:
- `/api/sales/dashboard` route (`server/src/routes/dashboard.ts`)
- `/api/sales/fetch-all` SSE route (`server/src/routes/fetch-all.ts`)

Both will automatically get the new `FlatItem[]` shape since they call `aggregateOrders` → `buildFlatItems`. No route-level changes needed. The SSE route stores the full `DashboardPayload` in Redis — cached payloads will refresh naturally on next fetch.

### 2.5 Prop Cascade (Full Path)

The `items` field flows through this chain — all must update their type annotations:

```
server: aggregateOrders() returns { items: FlatItem[] }
  → DashboardPayload.items (shared/types/dashboard.ts)
  → ApiResponse<DashboardPayload> (route response)
  → useDashboardDetail → dashboard.items (client hook)
  → useDashboardState → finalDashboard.items
  → DashboardLayout props → RightPanel props → TabsSection props
  → ItemsExplorer component
```

Files that reference `ItemCategory` or `ItemProduct` and need updating:
- `shared/types/dashboard.ts` — type definitions
- `server/src/services/data-aggregator.ts` — `buildFlatItems` replaces `buildItemCategories`
- `client/src/components/right-panel/TabsSection.tsx` — import + props + item count
- `client/src/components/right-panel/RightPanel.tsx` — passes items to TabsSection
- `client/src/layouts/DashboardLayout.tsx` — passes items into `exportData` for `useExport`
- `client/src/hooks/useExport.ts` — **CRITICAL**: imports `ItemCategory`, iterates `cat.products` to build CSV. Must rewrite the items export loop to iterate `FlatItem[]` instead. Failure to update this file causes a TypeScript compile error that kills the Railway Docker build.
- `client/src/utils/aggregation.ts` — verify consolidated view does not touch `items` fields (it doesn't — only aggregates KPIs and entity lists)

---

## 3. Toolbar Layout

A compact two-row control bar sits between the tab headers and the table, inside the Items tab area. **The toolbar is `sticky top-0 z-10 bg-card`** so it stays visible when scrolling through many items.

```
┌─────────────────────────────────────────────────────────────┐
│ Orders 6    Items 29    Contacts 2                          │
├─────────────────────────────────────────────────────────────┤
│ 🔍 Search items...       Group: [Product Type ▾] [+ ▾]     │
│ Sort: [Value ▾ ↓]       [Product Type ▾] [Brand ▾] [···]   │
├─────────────────────────────────────────────────────────────┤
│ PRODUCT                 VALUE         MARGIN %   MARGIN $   │
│ ▼ Culinary (19)         $2,673        27.6%      $738.81    │
│   MITICA Parmigiano...  $1,133        25.2%      $285.50    │
```

**Sticky behavior:** The tab panel's scroll container (`flex-1 overflow-y-auto` in TabsSection) scrolls the table beneath the sticky toolbar. This means `ItemsToolbar` gets `sticky top-0 z-10 bg-[var(--color-bg-card)]` so it pins to the top of the scroll area.

### 3.1 Row 1 — Search + Group By

**Search input (left):**
- Same styling as left panel SearchBox (magnifying glass icon, muted placeholder)
- Placeholder: "Search items..."
- Clear button (×) appears when text is entered
- Debounced at 200ms (same pattern: local state + setTimeout, ref-based onChange)

**Group-by selectors (right):**
- Label: "Group:"
- Up to 3 dropdown selectors
- First defaults to "Product Type"
- Second/third show as `[+ Add level]` button until activated
- Dropdown options: Product Type, Product Family, Brand, Country of Origin, FS/Retail, Vendor, None
- Selecting "None" on level 1 removes all grouping → flat table
- Selecting "None" on level 2 or 3 truncates the array at that position (removes that level and all levels below it)
- Each dropdown has an × to remove that level (shifts higher levels down)
- A dimension used at one level is excluded from the other level dropdowns

### 3.2 Row 2 — Sort + Filter Chips

**Sort control (left):**
- Dropdown showing current sort field + direction arrow (↑ asc / ↓ desc)
- Sort fields: Name, Value, Margin %, Margin $
- Default: Value descending
- Click the same field toggles direction; click a new field defaults to descending
- Column headers in the table also trigger sort — **they dispatch the same `sortField`/`sortDirection` state** as the dropdown (single source of truth)

**Filter chips (right):**
- One chip per category field: Product Type, Product Family, Brand, Country of Origin, FS/Retail
- Resting state: field name in muted text
- Click → dropdown with checkboxes listing distinct values from the current data
- Multi-select: check multiple values per field
- Active chip: shows count badge (e.g., "Brand (3)") with `gold-primary` accent
- "Clear all" link appears when any filter is active

**Note:** These filter chips are independent from the left panel's FilterPanel/useFilters. The left panel filters operate on the entity list; these chips operate on the items within a single entity's dashboard. Different state, different hook.

### 3.3 Design Tokens

All controls use existing palette:
- `gold-subtle` borders on inputs and chips
- `gold-primary` active/accent states
- `text-muted` labels
- `bg-card` backgrounds
- 13px font size (matching right panel)
- `spacing-base` / `spacing-lg` padding (matching existing toolbar patterns)

---

## 4. Table Structure

### 4.1 Columns

| Column | Width | Alignment | Content |
|--------|-------|-----------|---------|
| Product/Group | flex (remaining) | left | Name or group label + count badge |
| Value | 96px (`w-24`) | right | Dollar amount |
| Margin % | 80px (`w-20`) | right | Percentage |
| Margin $ | 96px (`w-24`) | right | Dollar amount |

Column headers are clickable to trigger sorting (visual indicator: arrow on active sort column). Clicking a column header dispatches to the same `sortField`/`sortDirection` state as the toolbar sort dropdown.

**Note:** Quantity column intentionally omitted — see Section 2.1 design decision.

### 4.2 Group Header Rows

- Subtle `bg-[var(--color-gold-hover)]` background to distinguish from product rows
- Content: chevron (▶ collapsed / ▼ expanded) + category name + count badge + aggregated Value/Margin%/Margin$
- Click anywhere on the row to expand/collapse
- All groups start **collapsed** by default
- Nesting indentation: Level 1 = 0px, Level 2 = 24px, Level 3 = 48px
- Group margin % is **weighted average**: `(totalMarginAmount / totalValue) * 100`

### 4.3 Product Rows

- Indented based on nesting depth (deepest level + 24px padding-left)
- Primary line: product name (13px, `text-primary`)
- Secondary line: SKU using existing `CopyableId` component (11px, `text-muted`)
- `CopyableId` must call `e.stopPropagation()` (existing pattern) to prevent triggering parent group row toggle

### 4.4 Flat Mode (No Grouping)

When group-by is set to "None":
- No group headers, just a flat sortable table of all products
- All products visible at top level
- Column header sorting is the primary interaction

### 4.5 Three-Level Nesting Example

```
▶ Culinary (19)                          $2,673   27.6%   $738.81
  ▶ Mitica (4)                           $1,400   25.0%   $350.00
    ▶ Italy (3)                            $900   24.0%   $216.00
      MITICA Parmigiano Reggiano           $500   22.0%   $110.00
        10914
      MITICA Burrata                       $250   28.0%   $70.00
        10234
      MITICA Prosciutto                    $150   24.0%   $36.00
        10567
    ▶ Spain (1)                            $500   26.8%   $134.00
      MITICA Manchego Curado               $500   26.8%   $134.00
        10890
```

### 4.6 Horizontal Scrolling

Same pattern as OrdersTable / ContactsTable:
- `min-w-[600px]` on the table element
- Outer wrapper has `overflow-x-auto`
- Scrollbar uses existing global 4px gold styles

### 4.7 ARIA Semantics

The table uses `role="treegrid"` to express the hierarchical grouping:
- Table container: `role="treegrid"` with `aria-label="Items explorer"`
- Group header rows: `role="row"` with `aria-expanded`, `aria-level={depth}`, `aria-setsize`, `aria-posinset`
- Product rows: `role="row"` with `aria-level={maxDepth + 1}`
- Cells: `role="gridcell"`
- Column headers: `role="columnheader"` with `aria-sort` on the active sort column

When grouping is "None" (flat mode), use `role="table"` instead of `role="treegrid"`.

---

## 5. Search Behavior

- Filters products by name or SKU (case-insensitive substring match)
- Groups with zero matching products are hidden entirely
- Group counts and aggregated metrics update to reflect only matching products
- Debounced at 200ms
- Clear button (×) resets search
- Empty state: "No items match your search" centered message with clear action

---

## 6. Filter Behavior

- **Logic:** AND across fields, OR within a field
  - Example: Brand = (Mitica OR DGF) AND Product Type = Culinary
- Filtered items update group counts and aggregated metrics
- If a grouping field is also filtered (e.g., grouped by Brand, filtered to Brand=Mitica), only the matching group(s) appear
- Filter dropdown values are derived from the current flat items (before filtering, so all options remain visible)
- Filtered count indicator appears in `ItemsToolbar`: "Showing 12 of 29 items" (avoids state-lifting complexity to the tab badge — see Section 2.3)

---

## 7. Sort Behavior

- Sorts at every level simultaneously:
  - Group headers at each nesting level sorted by selected metric
  - Products within the deepest group also sorted by selected metric
- Default: Value descending (highest value first)
- Sort direction toggles when clicking the same field
- Column headers dispatch to the **same** `sortField`/`sortDirection` state as the toolbar dropdown — single source of truth, no separate "column sort" state

---

## 8. State Management

### 8.1 State Ownership

`useItemsExplorer` is **tab-local state** — it lives inside the Items tab component, NOT in `useDashboardState`. This is intentional:
- `useDashboardState` manages dashboard-wide state (dimension, period, entity selection, left-panel search/filter/sort)
- `useItemsExplorer` manages Items-tab-specific state (items search, items filter, items sort, grouping, expand)
- These are independent state systems operating on different data (entity list vs. item list)

The hook is instantiated by `ItemsExplorer` (the top-level Items tab component rendered by `TabsSection`). It receives `items: FlatItem[]` as input and returns the processed/grouped result plus all action dispatchers.

**Reset trigger:** The hook accepts `activeEntityId` (or the `items` array ref) as a dependency. When the selected entity changes, the items array changes, triggering a reset of all state to defaults via a `useEffect`.

### 8.2 Hook: `useItemsExplorer`

Uses `useReducer` (following the `useSort` pattern) to manage interdependent state atoms and avoid stale closures:

```ts
/** WHY client-only types — these are UI concerns (grouping/sort), not API contracts.
 * Defined in useItemsExplorer.ts or items-grouping.ts, NOT in shared/types/. */
type ItemDimensionKey =
  | 'productType'
  | 'productFamily'
  | 'brand'
  | 'countryOfOrigin'
  | 'foodServiceRetail'
  | 'vendor';

type ItemSortField = 'name' | 'value' | 'marginPercent' | 'marginAmount';

interface ItemsExplorerState {
  searchTerm: string;
  groupLevels: ItemDimensionKey[];              // 0-3 entries
  sortField: ItemSortField;
  sortDirection: 'asc' | 'desc';
  filters: Partial<Record<ItemDimensionKey, string[]>>;  // field → selected values; absent key = no filter
  expandedGroups: Set<string>;                           // composite keys: "Culinary|Mitica|Italy"
}
```

**Why `Partial<Record<K, string[]>>` instead of `Map<K, Set<V>>`:** Maps and Sets create referential equality issues — every `new Map()` is a new reference, breaking `useMemo` dependency checks. A `Partial<Record>` is serializable, TypeScript-friendly with `{}` as default (no need to pre-initialize all 6 keys), and follows the project's existing patterns. The `filterItems()` utility treats absent keys and empty arrays identically (no filter).

**Why `useReducer`:** The hook has 6 interdependent state atoms. `useReducer` eliminates stale closure bugs (same rationale as `useSort`'s WHY comment) and provides a single dispatch function for compound actions like "change group level → clear expanded groups".

**Default state:**
- `searchTerm: ""`
- `groupLevels: ['productType']` — matches current default behavior
- `sortField: 'value'`, `sortDirection: 'desc'`
- `filters: {}` (empty record — no active filters)
- `expandedGroups: new Set()`

**Reducer actions:**
- `setSearch(term)` — updates searchTerm
- `setGroupLevels(levels)` — updates groupLevels, clears expandedGroups (keys change)
- `toggleSort(field)` — same field → flip direction; new field → default desc
- `setFilter(field, values)` — sets filter for one field; empty array clears it
- `clearAllFilters()` — resets all filters to empty
- `toggleGroup(key)` — adds/removes composite key from expandedGroups
- `reset` — returns to default state (triggered by entity change)

### 8.3 Processing Pipeline

Order matters — runs inside a `useMemo` in the hook:

1. **Filter** — apply chip filters (AND across fields, OR within field)
2. **Search** — substring match on name + SKU
3. **Group** — nest by selected dimensions (level 1 → 2 → 3)
4. **Sort** — sort groups and products at every level
5. **Aggregate** — compute group totals from filtered/searched products within each group

Steps 3-5 all happen inside `groupItems()` — aggregation is a sub-step of grouping (each `GroupNode` computes its `totals` from its children during tree construction, not as a separate downstream pass). Steps 1-2 produce a filtered `FlatItem[]` that feeds into `groupItems()`.

### 8.4 Grouping Utility: `groupItems()`

Pure function in `client/src/utils/items-grouping.ts`:

```ts
interface GroupNode {
  key: string;           // composite key for expand state: "Culinary|Mitica|Italy"
  label: string;         // display label: "Italy"
  items: FlatItem[];     // leaf products (only on deepest groups)
  children: GroupNode[]; // sub-groups (empty on deepest level)
  totals: {
    value: number;
    marginPercent: number;  // weighted average: (marginAmount / value) * 100
    marginAmount: number;
    itemCount: number;      // count of leaf FlatItem products
  };
}

function groupItems(
  items: FlatItem[],
  levels: ItemDimensionKey[],
  sortField: ItemSortField,
  sortDirection: 'asc' | 'desc',
): GroupNode[];
```

**Returns:**
- With 0 levels → empty array (caller detects this and renders flat mode)
- With 1+ levels → array of `GroupNode` trees, sorted recursively

**Flat mode contract:** `useItemsExplorer` returns both `groups: GroupNode[]` (output of `groupItems()`) and `filteredItems: FlatItem[]` (output of steps 1-2, sorted). `ItemsTable` receives both. When `groups.length === 0 && groupLevels.length === 0`, it renders a flat `<table>` of `filteredItems`. When `groups.length > 0`, it renders the treegrid. This avoids ambiguity about what to render when `groupItems()` returns `[]`.

Memoized via `useMemo` keyed on: items array ref + groupLevels + sortField + sortDirection + filters + searchTerm.

---

## 9. Component Split

All new/modified files stay under 200 lines per project rules.

| File | Type | Purpose |
|------|------|---------|
| `client/src/components/right-panel/ItemsExplorer.tsx` | new | Top-level Items tab component (instantiates useItemsExplorer, renders toolbar + table) |
| `client/src/components/right-panel/ItemsToolbar.tsx` | new | Search + group-by dropdowns + sort + filter chips |
| `client/src/components/right-panel/ItemsTable.tsx` | new | Table wrapper + column headers + recursive group rendering |
| `client/src/components/right-panel/ItemsGroupRow.tsx` | new | Single group header row (chevron, label, badge, metrics) |
| `client/src/components/right-panel/ItemsProductRow.tsx` | new | Single product row (name, SKU, metrics) |
| `client/src/hooks/useItemsExplorer.ts` | new | useReducer-based state hook for search/group/sort/filter/expand |
| `client/src/utils/items-grouping.ts` | new | Pure grouping + aggregation utility |
| `client/src/utils/items-search.ts` | new | Pure search function for items (name + SKU match) |
| `client/src/utils/items-filter.ts` | new | Pure filter function for items (chip filter logic) |
| `client/src/components/right-panel/ItemsAccordion.tsx` | **delete** | Replaced by the new components |
| `server/src/services/data-aggregator.ts` | modify | `buildItemCategories()` → `buildFlatItems()` |
| `shared/types/dashboard.ts` | modify | Remove `ItemCategory`+`ItemProduct`, add `FlatItem` (server-client contract) |
| `client/src/components/right-panel/TabsSection.tsx` | modify | Import change, item count calculation, render `ItemsExplorer` instead of `ItemsAccordion` |
| `client/src/components/right-panel/RightPanel.tsx` | modify | Update items prop type annotation |
| `client/src/hooks/useExport.ts` | modify | **CRITICAL** — rewrite items CSV export from `ItemCategory` nested loop to `FlatItem[]` flat iteration |
| `client/src/layouts/DashboardLayout.tsx` | modify | Update `exportData.items` type (passes items to useExport) |
| `server/tests/services/data-aggregator.test.ts` | modify | Update tests: `buildItemCategories` → `buildFlatItems` |

---

## 10. Edge Cases

- **Empty items:** Show existing EmptyState: "No items for this period."
- **Search with no results:** "No items match your search" + clear button
- **Filter with no results:** "No items match your filters" + clear all link
- **Search + filter with no results:** "No items match your search and filters" + clear all link
- **All category values identical:** Group has one entry containing all products
- **Missing category values:** Server defaults to "Other" — groups labeled "Other" appear last (sorted after all named groups)
- **Switching group levels resets expand state:** Since group keys change, `expandedGroups` is cleared when `groupLevels` changes
- **Entity change:** Full state reset (search, filters, sort revert to defaults, group reverts to Product Type)
- **Consolidated view:** `aggregateForConsolidated()` in `client/src/utils/aggregation.ts` does not touch the `items` field — it only aggregates KPIs and entity lists. The `items` array on the consolidated `DashboardPayload` comes from the last-fetched entity's detail. This is acceptable — consolidated items are not meaningful (different entities have different products).
- **Filter chip dropdown overflow:** On narrow viewports, dropdown menus should align to the right edge of the chip and not overflow the viewport. Use `right-0` positioning on the dropdown.

---

## 11. What Does NOT Change

- Product Mix carousel (separate `computeAllProductMixes` code path)
- Best Sellers component
- Orders tab / OrdersTable
- Contacts tab / ContactsTable
- Left panel search/filter/sort (entirely separate state — `useSearch`, `useFilters`, `useSort` in `useDashboardState`)
- API route shape or Redis cache key structure
- Design token palette
- No new API endpoints
- No new npm dependencies

---

## 12. TDD Test Plan

Tests are written BEFORE implementation following the Red-Green-Refactor cycle. Each test case validates one specific behavior.

### 12.1 Server: `buildFlatItems()` (8 tests)

**File:** `server/tests/services/data-aggregator.test.ts` (extend existing test file)

| # | Test Name | Behavior |
|---|-----------|----------|
| 1 | `returns empty array for empty input` | `buildFlatItems([])` → `[]` |
| 2 | `maps single item with all category fields` | One RawOrderItem → FlatItem with name, sku, value, marginPercent, marginAmount, productType, productFamily, brand, countryOfOrigin, foodServiceRetail, vendor |
| 3 | `aggregates same SKU across multiple items` | Two items with same PARTNAME → one FlatItem with summed value/marginAmount |
| 4 | `defaults missing category fields to Other` | Item with empty `Y_3021_5_ESH` → `productType: 'Other'` |
| 5 | `maps Y_9967_5_ESH Y to Retail` | `Y_9967_5_ESH: 'Y'` → `foodServiceRetail: 'Retail'` |
| 6 | `maps Y_9967_5_ESH non-Y to Food Service` | `Y_9967_5_ESH: 'N'` → `foodServiceRetail: 'Food Service'` |
| 7 | `handles zero value without division error` | Item with `QPRICE: 0` → `marginPercent: 0` (not NaN/Infinity) |
| 8 | `produces distinct FlatItems per unique SKU` | 5 items across 3 SKUs → 3 FlatItems |

### 12.2 Client: `groupItems()` (11 tests)

**File:** `client/src/utils/__tests__/items-grouping.test.ts` (new)

| # | Test Name | Behavior |
|---|-----------|----------|
| 1 | `returns empty array with zero levels` | `groupItems(items, [], ...)` → `[]` |
| 2 | `groups by one level` | `groupItems(items, ['productType'], ...)` → GroupNodes keyed by productType |
| 3 | `groups by two levels` | Level 1 groups contain level 2 children |
| 4 | `groups by three levels` | Three-level nesting with leaf items at deepest level |
| 5 | `computes group value as sum of children` | Group `totals.value` = sum of child items' `value` |
| 6 | `computes group margin as weighted average` | Group `totals.marginPercent` = `(totalMarginAmount / totalValue) * 100` |
| 7 | `counts leaf items correctly` | Group `totals.itemCount` = number of leaf FlatItem products in subtree |
| 8 | `sorts groups by sort field descending` | `sortField: 'value', sortDirection: 'desc'` → highest-value group first |
| 9 | `sorts products within deepest group` | Products sorted by same field/direction as groups |
| 10 | `builds composite keys with pipe separator` | Level 3 key = `"Culinary\|Mitica\|Italy"` |
| 11 | `sorts Other group last regardless of sort direction` | Groups labeled "Other" always appear after all named groups |

### 12.3 Client: Item Search (4 tests)

**File:** `client/src/utils/__tests__/items-search.test.ts` (new)

| # | Test Name | Behavior |
|---|-----------|----------|
| 1 | `returns all items for empty search` | `searchItems(items, '')` → `items` (unchanged) |
| 2 | `matches product name case-insensitively` | `searchItems(items, 'mitica')` → items with "MITICA" in name |
| 3 | `matches SKU` | `searchItems(items, '10914')` → items with SKU "10914" |
| 4 | `returns empty array when nothing matches` | `searchItems(items, 'zzz')` → `[]` |

### 12.4 Client: Item Filter (5 tests)

**File:** `client/src/utils/__tests__/items-filter.test.ts` (new)

| # | Test Name | Behavior |
|---|-----------|----------|
| 1 | `returns all items with empty filters` | `filterItems(items, {})` → `items` (unchanged) |
| 2 | `filters by single field single value` | `{ productType: ['Culinary'] }` → only Culinary items |
| 3 | `OR within same field` | `{ brand: ['Mitica', 'DGF'] }` → items with brand Mitica OR DGF |
| 4 | `AND across different fields` | `{ productType: ['Culinary'], brand: ['Mitica'] }` → items matching BOTH |
| 5 | `combined with search` | Filter then search (or vice versa) → intersection of both |

### 12.5 Client: Item Sort (4 tests)

**File:** `client/src/utils/__tests__/items-grouping.test.ts` (inline in grouping tests — sort logic lives inside `groupItems()`, no separate `sortItems()` export)

| # | Test Name | Behavior |
|---|-----------|----------|
| 1 | `sorts by value descending` | Default sort → highest value first |
| 2 | `sorts by name ascending` | Alphabetical A-Z |
| 3 | `sorts by marginPercent descending` | Highest margin first |
| 4 | `handles equal values stably` | Items with same value maintain relative order |

### 12.6 Hook: `useItemsExplorer` Reset (2 tests)

**File:** `client/src/hooks/__tests__/useItemsExplorer.test.ts` (new — uses `renderHook` from `@testing-library/react`)

| # | Test Name | Behavior |
|---|-----------|----------|
| 1 | `resets all state when items array changes` | Change `items` prop → searchTerm, filters, sort, expandedGroups all revert to defaults |
| 2 | `defaults groupLevels to productType` | Initial render → `groupLevels: ['productType']` |

### 12.7 Server Test Updates

The existing `data-aggregator.test.ts` has tests for `buildItemCategories` that must be replaced:
- Remove tests that reference `ItemCategory` or `ItemProduct` shapes
- Replace with the 8 `buildFlatItems` tests above
- Ensure `aggregateOrders` integration tests still pass with the new `items: FlatItem[]` shape
