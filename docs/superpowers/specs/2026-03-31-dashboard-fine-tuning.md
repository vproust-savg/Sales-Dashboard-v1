# Dashboard Fine-Tuning Spec — Best Sellers & Product Mix Carousel

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Frontend + Backend + Shared Types

## Overview

Two areas of enhancement to the sales dashboard right panel:
1. **Best Sellers card** — custom tooltip, zero-value filtering, actual unit of measure
2. **Product Mix donut** — carousel with 5 different categorization views

---

## Feature 1: Best Sellers Enhancements

### 1A. Custom Styled Tooltip on Hover

Product names are truncated in the two-column layout. Show the full name in a custom tooltip on hover.

**Behavior:**
- Hovering a seller row shows a tooltip below the product name
- Tooltip displays the full untruncated product name
- Appears after 200ms delay, fades out on mouse leave
- Framer Motion: fade-in 150ms, fade-out 100ms

**Styling:**
- Background: `var(--color-dark)` (#2c2a26)
- Text: white, 12px
- Padding: 6px 10px
- Border-radius: `var(--radius-base)` (8px)
- Shadow: `var(--shadow-card)`
- Positioned below the name, left-aligned
- Z-index above other rows

**Implementation:**
- New shared component: `client/src/components/shared/Tooltip.tsx`
- Accepts `content: string`, `children: ReactNode`
- Uses `useState` for visibility + `onMouseEnter`/`onMouseLeave`
- Applied in `SellerRow` around the product name `<p>` tag
- Remove native `title` attribute (replaced by custom tooltip)

### 1B. Filter Zero-Value Items

Items with $0 revenue should not appear in the best sellers list.

**Server-side** (`data-aggregator.ts` → `computeTopSellers`):
- After aggregating by SKU, filter out entries where `revenue <= 0`
- Apply filter before sorting and slicing top 10

**Client-side** (`TopTenBestSellers.tsx`):
- Guard: `data.filter(item => item.revenue > 0)` before rendering

### 1C. Actual Unit of Measure

Replace hardcoded "units" text with the actual unit from Priority ERP.

**Priority field:** `TUNITNAME` (Edm.String, MaxLength 3) — e.g., "cs", "ea", "lb"

**Backend changes:**
- `server/src/config/constants.ts`: Add `TUNITNAME` to `ORDERITEM_SELECT`
- `server/src/services/priority-queries.ts`: Add `TUNITNAME: string` to `RawOrderItem`
- `server/src/services/data-aggregator.ts` → `computeTopSellers()`: Capture unit from first occurrence of each SKU

**Shared type change:**
- `shared/types/dashboard.ts` → `TopSellerItem`: Add `unit: string` field

**Fallback:** If `TUNITNAME` is empty/null for a product, default to `"units"` in `computeTopSellers()`.

**Frontend change:**
- `BestSellers.tsx`: `{item.units.toLocaleString('en-US')} {item.unit}` instead of `"units"`

### 1D. Rename + Pagination (Up to 25 Items)

Rename "Top 10 Best Sellers" to **"Best Sellers"**. Show up to 25 items instead of 10, paginated in groups of 5.

**Backend:**
- `computeTopSellers()`: Change `.slice(0, 10)` → `.slice(0, 25)`

**Frontend — Rename:**
- Rename file `TopTenBestSellers.tsx` → `BestSellers.tsx`
- Rename component `TopTenBestSellers` → `BestSellers`
- Card title in `ChartsRow.tsx`: "Best Sellers"

**Frontend — Pagination:**
- Arrows (chevron left/right) positioned top-right of the card header, inline with the "Best Sellers" title
- Two columns of 5 rows each = 10 items visible at a time
- Each arrow click shifts the visible window by 5 items:
  - View 1: ranks 1-10 (default)
  - View 2: ranks 6-15
  - View 3: ranks 11-20
  - View 4: ranks 16-25
- Left arrow disabled on first view, right arrow disabled on last view
- Arrow styling: same as Product Mix carousel arrows (24x24px, `var(--color-text-muted)` idle → `var(--color-gold-primary)` hover, disabled = `opacity: 0.3`)
- Framer Motion slide transition (200ms, direction-aware) when paginating
- Show current page indicator as text: "1-10 of 25" between the arrows

---

## Feature 2: Product Mix Carousel

### 2A. Backend — Compute All 5 Mixes

All fields are on `ORDERITEMS_SUBFORM`. Compute all 5 in a single pass over `RawOrderItem[]`.

**New Priority fields to fetch (add to `ORDERITEM_SELECT`):**

| Field | Description | Already fetched? |
|-------|-------------|-----------------|
| `Y_3021_5_ESH` | Product Type name | Yes |
| `Y_2075_5_ESH` | Product Family | **No — add** |
| `Y_9952_5_ESH` | Brand | Yes |
| `Y_5380_5_ESH` | Country of Origin | **No — add** |
| `Y_9967_5_ESH` | Food Service vs Retail | **No — add** |

**RawOrderItem additions:**
```typescript
Y_2075_5_ESH: string;   // Product Family
Y_5380_5_ESH: string;   // Country of Origin
Y_9967_5_ESH: string;   // Food Service vs Retail (Y = Retail)
```

**Data aggregation** (`data-aggregator.ts`):
- Refactor `computeProductMix(items, field)` to accept a field extractor
- New `computeAllProductMixes(items)` → returns object with all 5 mixes
- Food Service vs Retail: map field value `'Y'` → `"Retail"`, anything else → `"Food Service"`
- Each mix uses the same 7-segment-max + "Other" bucket logic
- **Filter zero-value segments:** Exclude any segment where `value <= 0` before sorting/slicing. A donut should never show a 0% wedge.

### 2B. Shared Types

```typescript
// New type for the 5 donut categorizations
export type ProductMixType = 'productType' | 'productFamily' | 'brand' | 'countryOfOrigin' | 'foodServiceRetail';

// Labels for carousel display
export const PRODUCT_MIX_LABELS: Record<ProductMixType, string> = {
  productType: 'Product Type',
  productFamily: 'Product Family',
  brand: 'Brand',
  countryOfOrigin: 'Country of Origin',
  foodServiceRetail: 'FS vs Retail',
};

// DashboardPayload change (no backward-compat alias — we control both client and server):
// OLD: productMix: ProductMixSegment[];
// NEW: productMixes: Record<ProductMixType, ProductMixSegment[]>;
```

### 2C. Frontend — Carousel Component

**New file:** `client/src/components/right-panel/ProductMixCarousel.tsx`

**Layout:**
```
┌─────────────────────────────────────┐
│  ◀  Product Mix — Product Type  ▶   │  ← Title with arrows
│                                     │
│          [Donut Chart]              │  ← Existing ProductMixDonut
│                                     │
│          [Legend]                    │
│                                     │
│          ● ○ ○ ○ ○                  │  ← Dot indicators
└─────────────────────────────────────┘
```

**Behavior:**
- Left/right arrow buttons cycle through the 5 donut types
- Wraps around: clicking right on last goes to first, and vice versa
- Dot indicators show position (filled dot = active)
- Card title updates: "Product Mix — Brand", "Product Mix — Country of Origin", etc.
- Framer Motion `AnimatePresence` for slide transition (200ms, direction-aware)

**Arrow styling:**
- 24x24px clickable area
- Color: `var(--color-text-muted)` idle → `var(--color-gold-primary)` on hover
- Simple chevron icons (inline SVG, no icon library)

**Dot indicators:**
- 6px circles, `var(--color-gold-subtle)` inactive, `var(--color-gold-primary)` active
- Centered below the legend, 8px gap between dots

**Keyboard accessibility:**
- Arrow keys (left/right) cycle through donut types when carousel is focused
- `role="tablist"` on carousel, `role="tab"` on dot indicators
- `aria-label` on arrows: "Previous chart type" / "Next chart type"

**Carousel order (default = index 0):**
1. Product Type (`Y_3021_5_ESH`) — default
2. Product Family (`Y_2075_5_ESH`)
3. Brand (`Y_9952_5_ESH`)
4. Country of Origin (`Y_5380_5_ESH`)
5. Food Service vs Retail (`Y_9967_5_ESH`)

**Integration:**
- `ChartsRow.tsx`: Change props from `productMix: ProductMixSegment[]` to `productMixes: Record<ProductMixType, ProductMixSegment[]>`
- Replace `<ProductMixDonut data={productMix} />` with `<ProductMixCarousel mixes={productMixes} />`
- `ProductMixDonut` stays unchanged — the carousel wraps it and passes the active mix's data

---

## Files to Modify

| File | Change |
|------|--------|
| `server/src/config/constants.ts` | Add `TUNITNAME`, `Y_2075_5_ESH`, `Y_5380_5_ESH`, `Y_9967_5_ESH` to `ORDERITEM_SELECT` |
| `server/src/services/priority-queries.ts` | Add 4 fields to `RawOrderItem` interface |
| `server/src/services/data-aggregator.ts` | Refactor `computeProductMix`, add `computeAllProductMixes`, add unit to `computeTopSellers`, filter zero-value |
| `shared/types/dashboard.ts` | Add `unit: string` to `TopSellerItem`, add `ProductMixType`, change `productMix` → `productMixes` |
| `client/src/components/shared/Tooltip.tsx` | **NEW** — Reusable tooltip component |
| `client/src/components/right-panel/TopTenBestSellers.tsx` | Use Tooltip, show `item.unit` instead of "units", filter zero-value |
| `client/src/components/right-panel/ProductMixCarousel.tsx` | **NEW** — Carousel wrapper with arrows + dots |
| `client/src/components/right-panel/ChartsRow.tsx` | Update props/imports for ProductMixCarousel |
| `client/src/components/right-panel/RightPanel.tsx` | Pass `productMixes` instead of `productMix` |
| `client/src/hooks/useDashboardData.ts` | Update to handle new payload shape |

---

## Verification

1. `cd server && npx tsc --noEmit` — no server type errors
2. `cd client && npx tsc -b --noEmit` — no client type errors
3. `cd server && npx vitest run` — all tests pass
4. Start both dev servers, select customer C7826:
   - **Best Sellers**: hover shows styled tooltip with full name, no $0 items, units show "cs"/"ea"/"lb"
   - **Product Mix**: arrow buttons cycle through 5 donut types, dot indicators update, slide animation works
5. Switch to non-customer dimension (zone) — carousel still works
6. `cd client && npx vite build` — bundle builds under 500KB gzip
