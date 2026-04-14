# Items Table — Spacing, Last Order Sort & Frequency Color Coding

**Date:** 2026-04-14  
**Status:** Approved  
**Scope:** `ItemsTable`, `ItemsProductRow`, `ItemsGroupRow`, `items-grouping.ts`

---

## Problem

Three issues in the Items table (Products tab, right panel):

1. **"VALUE" and "AVG MARGIN %" headers visually collide.** The "AVG MARGIN %" label at uppercase 12px with `tracking-wide` fills its `w-24` (96px) column to the left edge, leaving zero gap between the two headers.
2. **"LAST ORDER" column is not sortable.** It has `field: null` — no click handler, no sort arrow.
3. **"LAST ORDER" color logic ignores purchase cadence.** Hardcoded thresholds (14d green / 45d gold / 90d yellow / else red) are meaningless without knowing how often a customer orders a product. A weekly item should flag red at ~2 weeks; a quarterly item shouldn't flag until ~6 months.

---

## Design

### 1. Column Spacing — `w-24` → `w-28` for Avg Margin %

Widen the `Avg Margin %` column from `w-24` (96px) to `w-28` (112px). This gives the header label room to breathe and eliminates the visual collision with the VALUE column.

Three files define the width of this column independently and must all be updated together for the header and body to stay aligned:

| File | Location | Change |
|------|----------|--------|
| `ItemsTable.tsx` | COLUMNS array, `Avg Margin %` entry | `w-24` → `w-28` |
| `ItemsProductRow.tsx` | `marginPercent` gridcell | `w-24` → `w-28` |
| `ItemsGroupRow.tsx` | Second metric span (margin %) | `w-24` → `w-28` |

Headers already have `whitespace-nowrap`; no other changes needed for single-line text.

---

### 2. Last Order Sortability

Add `'lastOrderDate'` to the sort system so users can click the Last Order header to sort ascending/descending.

**`ItemSortField` type** (`items-grouping.ts`): Add `'lastOrderDate'` to the union.

**`sortFlatItems`** (`items-grouping.ts`): Add null-first/null-last handling before the existing type check. `lastOrderDate` is `string | null` — without this, null vs string comparison produces NaN. Nulls sort last in both directions (items with no order history sink to the bottom regardless of sort direction). ISO date strings are lexicographically comparable, so no date parsing is needed.

**COLUMNS array** (`ItemsTable.tsx`): Change `Last Order` from `field: null` to `field: 'lastOrderDate'`. The existing `SortArrow` component and `onToggleSort` handler work without modification — they just need a non-null field.

**Group rows** (`ItemsGroupRow.tsx`): No change. `GROUP_SORTABLE_FIELDS` intentionally excludes item-only fields; groups already fall back to sorting by `value` when an unsortable field is active.

---

### 3. Frequency-Based Color Coding

Replace fixed-day color thresholds with thresholds derived from each product's actual purchase frequency.

**Formula:**
```
intervalDays = 30 / purchaseFrequency   (converts orders/month → days between orders)
```

| Condition | Color | Token |
|-----------|-------|-------|
| `days ≤ intervalDays` | Green | `var(--color-green)` |
| `intervalDays < days ≤ 2 × intervalDays` | Yellow | `var(--color-yellow)` |
| `days > 2 × intervalDays` | Red | `var(--color-red)` |
| `purchaseFrequency = 0` | Muted | `var(--color-text-muted)` |
| `lastOrderDate = null` | Muted | `var(--color-text-muted)` |

The gold color (`--color-gold-primary`) previously used for the 15–45 day range is retired; the new palette is green / yellow / red only.

**`formatLastOrder` signature change** (`ItemsProductRow.tsx`):
```tsx
// Before:
formatLastOrder(isoDate: string | null)

// After:
formatLastOrder(isoDate: string | null, purchaseFrequency: number)
```

Call site updates from `formatLastOrder(item.lastOrderDate)` to `formatLastOrder(item.lastOrderDate, item.purchaseFrequency)`.

The text format (Today / 1d / 5d / 2w / 3mo) is unchanged.

---

## Files Modified

| File | Changes |
|------|---------|
| `client/src/utils/items-grouping.ts` | Add `'lastOrderDate'` to `ItemSortField`; add null-safety to `sortFlatItems` |
| `client/src/components/right-panel/ItemsTable.tsx` | `w-24` → `w-28` for Avg Margin %; `field: 'lastOrderDate'` on Last Order column |
| `client/src/components/right-panel/ItemsProductRow.tsx` | `w-24` → `w-28` for margin % cell; rewrite `formatLastOrder` with frequency parameter |
| `client/src/components/right-panel/ItemsGroupRow.tsx` | `w-24` → `w-28` for margin % span |

---

## Verification

```bash
cd client && npx tsc -b --noEmit   # Must pass — ItemSortField union change touches multiple files
cd ../server && npx vitest run     # 107 tests must still pass (no server changes)
```

**Manual check (Disney Club 33, Products tab):**
- VALUE and AVG MARGIN % headers have visible whitespace between them
- LAST ORDER header shows sort arrow on hover; clicking cycles asc → desc → asc
- Items with no order history (`—`) sink to the bottom when sorting by Last Order
- Products with high purchase frequency (e.g. 4/mo → 7.5d interval) go yellow after ~8 days, red after ~15 days
- Products with low purchase frequency (e.g. 0.5/mo → 60d interval) stay green until ~60 days
