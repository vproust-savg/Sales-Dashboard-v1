# Product Mix Expanded View — 15-Category Cap with Side-by-Side Layout

**Date:** 2026-04-15
**Status:** Approved

## Problem

The Product Mix expanded modal is hard-capped at 7 segments (top 6 named categories + "Other"). In practice, many mix types (Brand, Product Type, Product Family) have far more than 6 meaningful categories. A large share of revenue collapses into "Other", obscuring actionable data.

## Goal

In the expanded modal view, show up to 15 categories (top 14 + "Other" only if there are more than 15). The compact card view stays at 7 segments (unchanged). All 5 mix types are affected: Product Type, Product Family, Brand, Country of Origin, Food Service/Retail.

## Layout: Side-by-side (donut left, 2-column legend right)

The `ProductMixExpanded` component switches from a single-column stacked layout to a horizontal flex layout:

- **Left:** Donut chart (SVG only, no legend)
- **Right:** 2-column legend grid — items flow top-to-bottom, left column first (rank 1–8 left, 9–15 right). "Other" always last. Each row: colored dot · category name · percentage · formatted currency value.

The compact card (`ProductMixCarousel` carousel mode) is unchanged — it continues to use the existing layout with the built-in donut legend.

## What Changes

### 1. `server/src/services/data-aggregator.ts`

- Raise the server-side cap from 7 to 15.
- New rule: if `sorted.length > 15`, keep top 14 named categories and bucket the rest into "Other".
- If `sorted.length ≤ 15`, return all (no "Other" created).
- The server always returns up to 15 items. The compact client view slices to 7 client-side (no server change needed for compact behavior).

### 2. `client/src/components/right-panel/ProductMixDonut.tsx`

- Add optional `showLegend` prop (type `boolean`, default `true`) — backward-compatible, no callers need to update unless opting out.
- When `showLegend={false}`, skip rendering the legend section; render SVG donut only.
- Extend the color palette from 7 to 15 distinct colors. The 8 new colors follow the same muted/desaturated tone as the existing palette. "Other" retains its muted gray.

### 3. `client/src/components/right-panel/ProductMixCarousel.tsx`

- In `ProductMixExpanded`, replace the current single-column (centered donut + legend below) with:
  ```
  <div flex flex-row gap>
    <ProductMixDonut showLegend={false} />   ← left column
    <2-column legend grid>                   ← right column
  </div>
  ```
- The legend grid renders all items from the data array (up to 15) — no additional client-side slicing.
- Legend item: colored dot + category name (truncated with ellipsis if long) + percentage + `formatCurrencyValue(value)`.
- Colors must match the donut palette by index.

## Out of Scope

- Compact card view: no changes (stays at 7 segments).
- Consolidated per-customer mode (`PerCustomerChartTable`): no changes — this is a table-based view, unrelated.
- Consolidated aggregated mode: inherits the new layout automatically via `ProductMixExpanded` — no extra work.
- API endpoint contract: unchanged. The payload grows slightly (up to 15 items vs. 7) but the response shape is identical.

## Verification

- All 5 mix types in the expanded modal show up to 15 categories.
- "Other" only appears when there are more than 15 distinct categories.
- Compact card continues to show at most 7 segments.
- `npx tsc -b --noEmit` passes clean.
- No `any` types introduced.
- No file exceeds 300 lines.
