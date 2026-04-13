# Dashboard UX Improvements — Full Width, Text Sizing, Clipboard Fix, Orders Filter, Items Search

**Date:** 2026-04-13
**Status:** Draft
**Scope:** 5 independent UX improvements to the sales dashboard

---

## 1. Problem Statement

On a 27-inch monitor (~2560px wide), the dashboard looks undersized. The `max-w-[1440px]` constraint wastes ~1000px of horizontal space. Text is small for the screen real estate. Additionally, click-to-copy is broken in the Airtable iframe embed, the Orders tab lacks time-range filtering, and the Items search bar is too hidden.

## 2. Changes Overview

| # | Change | Scope | Complexity |
|---|--------|-------|------------|
| 1 | Remove max-width — full width layout | Layout | Small |
| 2 | Increase text sizes by 1-2px | Styling | Small |
| 3 | Iframe-safe clipboard fallback | Utility + component | Small |
| 4 | Orders time filter pills | New component + state | Medium |
| 5 | Items search expanded by default | Component tweak | Trivial |

---

## 3. Change 1: Full Width Layout

### Current State
- `DashboardLayout.tsx` line 158: `max-w-[1440px]` constrains the root container
- Same constraint on loading skeleton (line 98) and error state (line 116)
- Horizontal padding: `p-[var(--spacing-2xl)]` (16px)

### Target State
- Remove `max-w-[1440px]` from all three containers (main, loading, error)
- Keep `mx-auto` for centering (harmless without max-width)
- Increase horizontal padding to `px-[var(--spacing-3xl)]` (20px) so content doesn't hug edges
- Left panel stays `w-[280px]` fixed
- Right panel stays `min-w-0 flex-1` — takes all remaining space

### Files Changed
- `client/src/layouts/DashboardLayout.tsx` — 3 class string edits (main, loading, error containers)

---

## 4. Change 2: Text Size Increase

Subtle 1-2px increase across key elements. All changes are in Tailwind class strings — no design token changes.

### Size Map

| Element | File | Current | New |
|---------|------|---------|-----|
| KPI primary value | `KPICard.tsx` | 28px | 30px |
| KPI label | `KPICard.tsx` | 12px | 13px |
| KPI secondary values | `KPICard.tsx` | 12px | 13px |
| Tab labels | `TabsSection.tsx` | 14px | 15px |
| Table body text | `OrdersTable.tsx` | 13px | 14px |
| Table header text | `OrdersTable.tsx` | 11px | 12px |
| Items table body | `ItemsTable.tsx` | 13px | 14px |
| Items table header | `ItemsTable.tsx` | 11px | 12px |
| Chart titles | `ProductMixCarousel.tsx`, `BestSellers.tsx` | 14px | 15px |
| Best seller item text | `BestSellers.tsx` | 13px | 14px |
| Detail header entity name | `DetailHeader.tsx` | 20px | 22px |
| Detail header subtitle | `DetailHeader.tsx` | 13px | 14px |
| Contacts table body | `ContactsTable.tsx` | 13px | 14px |
| Contacts table header | `ContactsTable.tsx` | 11px | 12px |

### Files Changed
- `KPICard.tsx` — primary value, label, secondary values
- `TabsSection.tsx` — tab label size
- `OrdersTable.tsx` — header and body text
- `ItemsTable.tsx` — header and body text
- `ProductMixCarousel.tsx` — chart title
- `BestSellers.tsx` — chart title, item text
- `DetailHeader.tsx` — entity name, subtitle
- `ContactsTable.tsx` — header and body text

### Not Changed
- Left panel entity list text — already appropriately sized for 280px column
- Dimension toggle pills — already compact by design
- Toast text — already 13px, fine
- Search input text — stays 12px (constrained width)

---

## 5. Change 3: Iframe-Safe Clipboard

### Current State (Broken)
`CopyableId.tsx` line 21 calls `navigator.clipboard.writeText(value)` directly. This API requires the `clipboard-write` permission in the browser Permissions Policy. Inside the Airtable Omni iframe, this permission is not granted, so the call silently fails — nothing is copied, but the toast still shows "Copied."

### Target State
Port the proven `copyToClipboard()` utility from the Customer Service sister project (`/Users/victorproust/Documents/Work/SG Interface/Customer Service/client/src/utils/clipboard.ts`).

**New utility:** `client/src/utils/clipboard.ts`
- Try `navigator.clipboard.writeText()` first (works outside iframes)
- On failure, fall back to `document.execCommand('copy')` with a temporary offscreen `<textarea>`
- Returns `Promise<boolean>` indicating success/failure

**Update `CopyableId.tsx`:**
- Replace direct `navigator.clipboard.writeText(value)` with `copyToClipboard(value)`
- Only show toast on success (`if (success) showToast(...)`)
- Keep existing toast styling — gold/dark design system colors, no green "Copied!" text
- Keep existing clipboard SVG icon on hover (no lucide-react dependency)

### Files Changed
- `client/src/utils/clipboard.ts` — **new file** (port from Customer Service)
- `client/src/components/shared/CopyableId.tsx` — swap clipboard call

### Explicitly Not Changed
- `CopyToast.tsx` — toast context/provider unchanged, keeps existing styling
- No green checkmark or inline "Copied!" text — stays consistent with the dashboard's gold/dark palette

---

## 6. Change 4: Orders Time Filter Pills

### Behavior
The Orders tab gets a horizontal row of filter pills between the tab bar and the table. These filters are **independent** of the top-level YTD/year period selector — they always filter by absolute date ranges.

### Filter Options

| Pill Label | Filter Logic |
|-----------|-------------|
| Last 30 Days | `order.date >= (today - 30 days)` |
| 3 Months | `order.date >= (today - 90 days)` |
| 6 Months | `order.date >= (today - 180 days)` |
| 2026 | `order.date` is in year 2026 |
| 2025 | `order.date` is in year 2025 |

**Default selection:** None — show all orders (same as current behavior). No pill is active by default. Clicking a pill activates it; clicking the active pill deselects it (back to "all").

### UI Design

**Pill row container:**
- Sits between the tab bar border and the table header
- Horizontal flex row with `gap-2`, padded `px-[var(--spacing-3xl)] py-[var(--spacing-base)]`
- Light bottom border: `border-b border-[var(--color-gold-subtle)]`

**Pill styling:**
- Inactive: `border border-[var(--color-gold-subtle)] text-[var(--color-text-muted)] bg-transparent rounded-full px-3 py-1 text-[12px]`
- Hover: `hover:border-[var(--color-gold-primary)] hover:text-[var(--color-text-secondary)]`
- Active: `bg-[var(--color-dark)] text-white border-transparent rounded-full px-3 py-1 text-[12px] font-semibold`
- Transition: `transition-all duration-150`

**Count display:**
- When a filter is active, show filtered count: `"Showing {n} of {total} orders"` aligned right in the pill row
- Text style: `text-[11px] text-[var(--color-text-muted)]`

### Data Flow

```
TabsSection
  └─ OrdersTab (new wrapper)
       ├─ OrdersFilterBar (new — pill row + state)
       └─ OrdersTable (existing — receives filtered orders)
```

**State lives in `OrdersTab`:**
- `activeFilter: OrderTimeFilter | null` where `OrderTimeFilter = 'last30' | '3months' | '6months' | '2026' | '2025'`
- Filter function takes `orders: OrderRow[]` + `activeFilter` → returns filtered `OrderRow[]`
- Filtered orders passed down to `OrdersTable`

### Architecture Decision: Where to Put the Filter

The filter is purely client-side (the `orders[]` array already contains all order data for the selected entity/period). No API calls, no backend changes. The filtering utility is a simple date comparison function.

**New files:**
- `client/src/components/right-panel/OrdersTab.tsx` — wrapper orchestrating filter state + OrdersFilterBar + OrdersTable
- `client/src/components/right-panel/OrdersFilterBar.tsx` — pill row UI
- `client/src/utils/orders-filter.ts` — filter logic (pure function, testable)

**Modified files:**
- `client/src/components/right-panel/TabsSection.tsx` — replace `<OrdersTable orders={orders} />` with `<OrdersTab orders={orders} />`

### Edge Cases
- **Zero results:** When filter produces 0 orders, show existing EmptyState: "No orders for this period."
- **Filter memory:** Filter resets when switching entities (new orders array). This is correct — each entity starts fresh.
- **Year pills:** Hardcode 2025 and 2026 for now. When more years of data accumulate, these can be made dynamic.

---

## 7. Change 5: Items Search Expanded by Default

### Current State
`ItemsToolbar.tsx` line 104: `ExpandableSearch` initializes with `expanded = !!searchTerm` — defaults to collapsed (28px icon only). Users must click the tiny magnifying glass to reveal the search input.

### Target State
- Initialize `expanded = true` always
- Increase expanded width: 180px → 220px
- Show placeholder: `"Search items..."` (more descriptive than current `"Search..."`)
- **Still collapses on blur if empty** — preserves the clean toolbar when user deliberately clicks away
- On re-mount (tab switch), starts expanded again

### Files Changed
- `client/src/components/right-panel/ItemsToolbar.tsx` — `ExpandableSearch` component only

---

## 8. Files Summary

### New Files (4)
| File | Purpose | Lines (est.) |
|------|---------|-------------|
| `client/src/utils/clipboard.ts` | Iframe-safe clipboard utility | ~35 |
| `client/src/components/right-panel/OrdersTab.tsx` | Orders filter state + composition | ~45 |
| `client/src/components/right-panel/OrdersFilterBar.tsx` | Filter pill row UI | ~70 |
| `client/src/utils/orders-filter.ts` | Date filtering logic | ~40 |

### Modified Files (11)
| File | Change |
|------|--------|
| `DashboardLayout.tsx` | Remove max-width (3 spots) |
| `KPICard.tsx` | Bump font sizes |
| `TabsSection.tsx` | Tab label size + swap OrdersTable → OrdersTab |
| `OrdersTable.tsx` | Bump font sizes |
| `ItemsTable.tsx` | Bump font sizes |
| `ProductMixCarousel.tsx` | Chart title size |
| `BestSellers.tsx` | Title + item text size |
| `DetailHeader.tsx` | Entity name + subtitle size |
| `ContactsTable.tsx` | Header + body text size |
| `CopyableId.tsx` | Use clipboard utility |
| `ItemsToolbar.tsx` | Search expanded by default |

### No Backend Changes
All 5 changes are frontend-only. No API modifications, no cache changes, no Priority ERP queries affected.

---

## 9. Testing Plan

| Change | How to Verify |
|--------|--------------|
| Full width | Open in Airtable on 27" screen — dashboard should fill available width with no wasted space |
| Text sizes | Visual comparison — text should be noticeably but subtly larger |
| Clipboard | Click any order number or ID in the Airtable embed — value should copy to clipboard. Verify with Cmd+V in a text editor |
| Orders filter | Click each pill — table should filter correctly. Click active pill to deselect. Switch entities — filter should reset |
| Items search | Switch to Items tab — search input should be visible immediately with placeholder text |

**Pre-deploy checklist (unchanged):**
```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
cd ../server && npx vitest run
cd ../client && npx vite build
```
