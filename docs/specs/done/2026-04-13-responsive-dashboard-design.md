# Responsive Dashboard — Resize, Modal, Peek, Presets

**Date:** 2026-04-13
**Status:** Draft
**Scope:** Right panel layout, all card components, left panel collapse, chart responsiveness

## Problem

On 13" screens (especially embedded in Airtable's iframe), KPI card sub-items ("This Quarter", "Last Month", "Best Month") are unreadable. The recent text-size bump (commit `94e4028`) didn't solve this because the root cause is **available space**, not font size. Users equally use 13" and 27" monitors and need the dashboard to work great on both.

## Solution Overview

Nine changes, grouped into three tiers:

**Tier 1 — Space Recovery:**
1. Revert text sizes to original compact values
2. Collapsible left panel (biggest single space win)
3. Responsive chart that fills available space

**Tier 2 — User Control:**
4. Section-boundary resize handles (hero|KPI split, KPI|charts split)
5. Layout presets (Compact / Balanced / Spacious)
6. Reset to defaults + localStorage persistence

**Tier 3 — Readability Escape Hatches:**
7. Hover peek on cards (lightweight preview)
8. Click-to-expand modal (full detail view)
9. 13" vs 27" responsive defaults

---

## 1. Revert Text Sizes

Undo `94e4028` polish commit text enlargements:

| File | Element | Current | Reverted |
|------|---------|---------|----------|
| `KPICard.tsx:107` | Sub-item labels | 10px | **9px** |
| `KPICard.tsx:108` | Sub-item values | 13px | **12px** |
| `KPICard.tsx:110` | Sub-item suffix | 10px | **9px** |
| `HeroRevenueCard.tsx:58` | Prev-year label | 11px | **10px** |
| `HeroRevenueCard.tsx:61` | Prev-year value (same period) | 18px | **16px** |
| `HeroRevenueCard.tsx:69` | Prev-year label (full year) | 11px | **10px** |
| `HeroRevenueCard.tsx:72` | Prev-year value (full year) | 16px | **14px** |
| `YoYBarChart.tsx:15` | CHART_HEIGHT constant | 180 | **removed** (replaced by dynamic) |

---

## 2. Collapsible Left Panel

### Behavior

- **Collapsed state:** Left panel shrinks from 280px to **48px**. Shows only:
  - A hamburger/expand icon button (centered, 32x32px)
  - The active dimension icon below it
  - Active entity name rotated vertically (truncated)
- **Expanded state:** Full 280px panel (current behavior)
- **Toggle:** Click the collapse/expand button, or press `[` keyboard shortcut
- **Auto-collapse:** On viewports < 1280px wide, auto-collapse on first load (if no persisted preference)
- **Persisted:** Collapse state saved in `localStorage` under `sg-dashboard-layout.panelCollapsed`

### Animation

- Width transition: 200ms ease-in-out via Framer Motion `layout` animation
- Content fades out (100ms) before width shrinks, fades in (100ms) after width expands
- Right panel flex-1 absorbs the freed space naturally

### Implementation

- Modify `DashboardLayout.tsx`: Replace fixed `w-[280px]` with dynamic width from layout state
- New: `CollapsedPanel.tsx` (~40 lines) — the narrow 48px rail with expand button
- The `LeftPanel` component stays unchanged — it's either rendered or not

---

## 3. Responsive Chart (Hero Bar Chart)

### Current Problem

`YoYBarChart` uses `CHART_HEIGHT = 180` (was 120 before polish commit). This is fixed regardless of available space, leaving dead whitespace on 27" screens and cramping 13" screens.

### Solution

- **Container:** Hero card chart area uses `flex-1 min-h-0` to fill remaining vertical space
- **`useContainerSize` hook:** ResizeObserver measures the chart container's actual pixel height
- **SVG:** `height` and `viewBox` height are driven by the measured container height
- **Bounds:** min 80px, max 400px. Below 80px, hide chart entirely and show expand hint
- **Bar scaling:** All bar positions recalculate from the dynamic height (current math already uses `BAR_AREA_HEIGHT` — just make it derived from props instead of a constant)

### Props Change

```typescript
// Before
export function YoYBarChart({ data }: YoYBarChartProps)

// After
export function YoYBarChart({ data, height }: YoYBarChartProps)
// height: number — pixel height from container, clamped to [80, 400]
```

---

## 4. Section-Boundary Resize Handles

### Layout Diagram

```
┌──────────────────────────────────────────────────┐
│  Detail Header                                    │
├────────────────────────┬┬────────────────────────┤
│                        ││  Orders   │ Avg Order  │
│   Hero Revenue Card    ◄► Margin %  │ Margin $   │
│                        ││ Frequency │ Last Order │
├────────────────────────┴┴────────────────────────┤
│                         ▲▼                        │
├─────────────┬────────────────────────────────────┤
│ Product Mix │         Best Sellers                │
└─────────────┴────────────────────────────────────┘
```

### Horizontal Handle (◄►)

- **Location:** Between hero card and KPI grid in `KPISection.tsx`
- **Controls:** The `grid-cols-[Xfr_Yfr]` ratio
- **Default:** `3fr:2fr` (or `2fr:3fr` on < 1280px viewport)
- **Bounds:** min 30% / max 70% for either side
- **Cursor:** `col-resize`

### Vertical Handle (▲▼)

- **Location:** Between KPI section and Charts row in `RightPanel.tsx`
- **Controls:** Relative height between the two sections
- **Default:** Equal weight (1:1)
- **Bounds:** min 200px for either section
- **Cursor:** `row-resize`

### Visual Style

- **Default:** Invisible — just a 6px gap (matches existing `gap-[var(--spacing-sm)]`)
- **Hover:** A 2px line appears in `var(--color-gold-muted)` centered in the gap
- **Dragging:** Line becomes `var(--color-gold-primary)`, 2px solid
- **No visible dots or grip indicators** — clean aesthetic

### `useResizablePanel` Hook

```typescript
interface UseResizablePanelOptions {
  direction: 'horizontal' | 'vertical';
  defaultRatio: [number, number];  // e.g. [3, 2]
  minPercent: number;              // e.g. 30
  maxPercent: number;              // e.g. 70
  storageKey: string;              // e.g. 'heroKpiRatio'
}

interface UseResizablePanelReturn {
  ratio: [number, number];
  dividerProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    style: React.CSSProperties;
    className: string;
  };
  reset: () => void;
}
```

- Mouse events: `mousedown` on divider → track `mousemove` → update ratio → `mouseup` saves to localStorage
- Touch support: `touchstart`/`touchmove`/`touchend` for iPad users
- Debounced localStorage write (200ms) to avoid thrashing during drag

---

## 5. Layout Presets

### Three Presets

| Preset | Hero:KPI | KPI:Charts Height | Card Padding | Ideal For |
|--------|----------|-------------------|-------------|-----------|
| **Compact** | 2fr:3fr | 1.2:1 | `--spacing-md` (8px) | 13" screens |
| **Balanced** | 3fr:2fr | 1:1 | `--spacing-lg` (12px) | Default |
| **Spacious** | 3fr:2fr | 1:1.2 | `--spacing-xl` (14px) | 27" screens, presentations |

### UI Location

In `DetailHeader.tsx`, between the period selector and export button. A 3-segment pill toggle matching the existing `PeriodSelector` style:

```
[ Compact | Balanced | Spacious ]
```

- Active segment: `bg-[var(--color-dark)]` text white (matches period selector active state)
- Inactive: transparent, `text-[var(--color-text-muted)]`
- Transitions: 150ms ease

### Behavior

- Selecting a preset applies its ratios immediately (300ms spring animation)
- The preset also sets the resize handle positions to match
- Manual drag of any resize handle clears the active preset indicator (shows as "Custom")
- Auto-selected on first visit: Compact if viewport < 1280px, Balanced otherwise
- Persisted in localStorage as `sg-dashboard-layout.preset`

---

## 6. Hover Peek on Cards

### Trigger

- Mouse enters a card → 400ms delay → floating preview panel appears
- Mouse leaves card AND preview panel → 150ms fade out
- If mouse moves from card into preview panel, it stays open (connected hover area)
- On touch devices: no hover peek (modal is the primary path)

### Preview Panel

- **Position:** Adjacent to the card — to the right if space available, otherwise to the left. For the hero card, position below.
- **Size:** `w-[320px]` fixed width, height auto from content
- **Style:** `bg-[var(--color-bg-card)]` rounded-[var(--radius-3xl)]` shadow-[var(--shadow-dropdown)]`
- **Arrow:** 8px CSS triangle pointing toward the source card
- **Z-index:** `z-50` (above all cards, below modal)

### Content

Same as the card but at comfortable reading size:
- KPI value at 22px (same as card — already readable)
- Sub-items ALWAYS visible (no toggle needed in peek)
- Previous year values visible
- Trend text fully expanded (no hover-to-reveal)

The peek does NOT show the "extra detail" from the modal — it's just the card content at readable size with everything expanded.

### Implementation

- New: `HoverPeek.tsx` (~80 lines) — floating positioned panel with arrow
- New: `useHoverPeek` hook (~40 lines) — manages delay, positioning, connected hover area
- Each card wraps in a `<div onMouseEnter/onMouseLeave>` that feeds the hook
- Uses `React.createPortal` to render at document root (avoids overflow:hidden clipping)

---

## 7. Click-to-Expand Modal

### Trigger

- Click anywhere on a card → modal opens
- Does NOT conflict with hover peek (peek closes on click)
- The "Show details" toggle button is NOT a modal trigger (it still toggles sub-items)

### Modal Anatomy

```
┌──────────────────────────────────────────────────┐
│                     Backdrop                      │
│  ┌──────────────────────────────────────────────┐│
│  │ ╳ close                          Card Label  ││
│  │                                              ││
│  │  ┌────────────────────────────────────────┐  ││
│  │  │                                        │  ││
│  │  │   Card content at large, comfortable   │  ││
│  │  │   size with all sub-items visible      │  ││
│  │  │                                        │  ││
│  │  └────────────────────────────────────────┘  ││
│  │                                              ││
│  │  ── Extra Detail Section ──────────────────  ││
│  │                                              ││
│  │  Additional context not shown in compact     ││
│  │  card view (trend sparkline, historical      ││
│  │  breakdown, larger chart, etc.)              ││
│  │                                              ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

### Styling

- **Backdrop:** `rgba(0,0,0,0.3)` with `backdrop-filter: blur(4px)`
- **Panel:** `max-w-[640px] w-[90vw]` centered, `bg-[var(--color-bg-card)]` `rounded-[var(--radius-3xl)]`
- **Padding:** `var(--spacing-4xl)` all sides
- **Shadow:** `var(--shadow-dropdown)`
- **Close:** Top-right X button + Escape key + backdrop click

### Animation

- Entry: `scale: 0.96 → 1, opacity: 0 → 1` (200ms easeOut)
- Exit: `scale: 1 → 0.96, opacity: 1 → 0` (150ms easeIn)
- Backdrop: `opacity: 0 → 1` (200ms)

### Modal Content Per Card Type

**Hero Revenue Modal:**
- Revenue value at 36px (hero size)
- Full-width bar chart at 300px height
- Sub-items always visible below chart
- Previous year comparison table (all 3 sub-items side by side with prev year)

**KPI Card Modals (Orders, Avg Order, Margin %, Margin $, Frequency):**
- Card label as modal title
- Value at 30px bold
- YoY change prominently displayed
- Sub-items in a clean 3-column layout with labels and values
- Previous year comparison: current vs prev year side-by-side for each sub-item
- *Future enhancement:* trend sparkline (not in this iteration)

**Last Order Modal:**
- Days since last order at 30px
- Activity status with colored dot and label
- Last order date (if available from data)

**Product Mix Modal:**
- Donut chart at 280px diameter
- Full segment legend with percentages and values (no truncation)

**Best Sellers Modal:**
- Full list up to 20 items (no pagination)
- Single-column layout for easy scanning
- Each item: rank, name, SKU, revenue, units

### Implementation

- New: `CardModal.tsx` (~90 lines) — shared modal shell with backdrop, animation, close
- New: `ModalProvider.tsx` (~30 lines) — React context for opening/closing modals
- Each card type provides a `renderModalContent()` function passed as children to `CardModal`

---

## 8. 13" vs 27" Responsive Defaults

### Viewport Breakpoints

| Breakpoint | Typical Setup | Default Preset | Panel |
|------------|--------------|----------------|-------|
| < 1024px | Mobile/tablet | N/A (stacks vertically, existing `max-lg`) | Full width |
| 1024-1279px | 13" in Airtable iframe | **Compact** | Auto-collapsed |
| 1280-1599px | 13" fullscreen or 15" | **Balanced** | Open |
| >= 1600px | 27" monitor | **Balanced** | Open |

### Responsive Adjustments (CSS only, no JS)

**< 1280px (compact territory):**
- Card horizontal padding: `--spacing-md` instead of `--spacing-lg`
- KPI label font: stays 10px but drops uppercase tracking from 0.5px to 0.3px
- Sub-items gap: `--spacing-md` instead of `--spacing-lg`
- Chart sub-items gap: `--spacing-2xl` instead of `--spacing-3xl`

**>= 1600px (spacious territory):**
- Section gaps: `--spacing-lg` instead of `--spacing-base`
- Hero card padding: `--spacing-4xl` instead of `--spacing-3xl`

### First-Visit Logic

1. Check localStorage for saved preferences
2. If no saved state: detect viewport width, apply appropriate preset and panel state
3. If saved state exists: restore it regardless of viewport

---

## 9. Reset + Persistence

### localStorage Schema

Key: `sg-dashboard-layout`

```json
{
  "version": 1,
  "preset": "balanced",
  "panelCollapsed": false,
  "heroKpiRatio": [3, 2],
  "kpiChartsRatio": [1, 1],
  "customized": false
}
```

- `version`: Schema version for safe migration
- `preset`: `"compact"` | `"balanced"` | `"spacious"` | `"custom"`
- `panelCollapsed`: Left panel collapse state
- `heroKpiRatio`: Horizontal split between hero and KPI grid
- `kpiChartsRatio`: Vertical split between KPI section and charts row
- `customized`: `true` when user has manually dragged a resize handle (clears active preset to "custom")

### Reset Button

- **Location:** In `DetailHeader.tsx`, left of the preset toggle. A small icon-only button.
- **Icon:** Rotate-counterclockwise (↺) arrow, 16x16px
- **Style:** Same as export button but icon-only: `bg-[var(--color-gold-subtle)]` rounded, 32x32px
- **Click behavior:**
  1. Clear `sg-dashboard-layout` from localStorage
  2. Re-detect viewport width
  3. Apply viewport-appropriate defaults (Compact if < 1280px, Balanced otherwise)
  4. Expand left panel if viewport >= 1280px
  5. Animate all transitions (300ms spring)
- **No confirmation dialog** — reset is non-destructive and easily re-customized

### `useDashboardLayout` Hook

Central hook that manages all layout state:

```typescript
interface DashboardLayout {
  preset: 'compact' | 'balanced' | 'spacious' | 'custom';
  panelCollapsed: boolean;
  heroKpiRatio: [number, number];
  kpiChartsRatio: [number, number];
}

interface UseDashboardLayoutReturn {
  layout: DashboardLayout;
  setPreset: (preset: 'compact' | 'balanced' | 'spacious') => void;
  togglePanel: () => void;
  setHeroKpiRatio: (ratio: [number, number]) => void;
  setKpiChartsRatio: (ratio: [number, number]) => void;
  reset: () => void;
}
```

---

## New Files

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `client/src/hooks/useDashboardLayout.ts` | ~80 | Central layout state + localStorage persistence |
| `client/src/hooks/useResizablePanel.ts` | ~70 | Drag-to-resize logic for section dividers |
| `client/src/hooks/useContainerSize.ts` | ~25 | ResizeObserver wrapper for chart |
| `client/src/hooks/useHoverPeek.ts` | ~50 | Hover delay + positioning logic |
| `client/src/components/shared/CardModal.tsx` | ~90 | Modal overlay shell with animation |
| `client/src/components/shared/ModalProvider.tsx` | ~35 | React context for modal state |
| `client/src/components/shared/HoverPeek.tsx` | ~80 | Floating preview panel with arrow |
| `client/src/components/shared/ExpandIcon.tsx` | ~20 | Tiny expand icon for card hover |
| `client/src/components/left-panel/CollapsedPanel.tsx` | ~45 | Narrow 48px rail when panel collapsed |
| `client/src/components/right-panel/LayoutPresetToggle.tsx` | ~50 | 3-segment preset picker |
| `client/src/components/right-panel/ResizeDivider.tsx` | ~35 | Visual divider element with hover line |

**Total new code:** ~580 lines across 11 files (avg 53 lines each — well under 200-line limit)

## Modified Files

| File | Changes |
|------|---------|
| `KPICard.tsx` | Revert text sizes, add click→modal, hover→peek, expand icon |
| `HeroRevenueCard.tsx` | Revert text sizes, add modal support, pass chart height |
| `YoYBarChart.tsx` | Accept `height` prop, remove `CHART_HEIGHT` constant |
| `KPISection.tsx` | Integrate horizontal resize divider, receive layout from hook |
| `RightPanel.tsx` | Integrate vertical resize divider, wrap in ModalProvider |
| `ChartsRow.tsx` | Add click→modal on Product Mix and Best Sellers cards |
| `DetailHeader.tsx` | Add preset toggle + reset button |
| `DashboardLayout.tsx` | Collapsible left panel, `useDashboardLayout` integration |
| `ProductMixCarousel.tsx` | Add `renderModalContent` for expanded donut |
| `BestSellers.tsx` | Add `renderModalContent` for full unpaginated list |

## 10. Keyboard Navigation Between Cards

Inspired by Grok code review — low-effort, high accessibility value.

### Behavior

- **Arrow keys** move a visible focus ring between the 7 KPI-section cards (hero + 6 KPIs) and 2 chart cards
- **Enter** on a focused card opens its modal
- **Space** on a focused card triggers the hover peek (positioned as if hovering)
- **Tab** moves focus into the card's interactive children (if any), **Shift+Tab** moves back out
- Focus ring style: `outline: 2px solid var(--color-gold-primary); outline-offset: 2px` (already defined globally for `*:focus-visible`)

### Implementation

- Add `tabIndex={0}` to each card wrapper (already done for modal click handlers)
- Add a `useCardNavigation` hook (~30 lines) in KPISection that tracks focused card index and handles arrow key events
- Navigation order: Hero → Orders → Avg Order → Margin % → Margin $ → Frequency → Last Order (left-to-right, top-to-bottom)
- Wrap in `role="grid"` with `role="gridcell"` on each card for screen reader semantics

### New file

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `client/src/hooks/useCardNavigation.ts` | ~30 | Arrow key navigation between card grid cells |

---

## Not In Scope

- Drag-to-reorder cards (not needed — layout is intentionally designed)
- Dark mode
- Mobile-specific touch gestures beyond basic touch resize support
- Trend sparklines in KPI modals (future enhancement)
- Cross-filtering from modals (clicking chart month → filter tables; future enhancement)
- Named custom preset saves (3 built-in presets + custom resize is sufficient for now)
