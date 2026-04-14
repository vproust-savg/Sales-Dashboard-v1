# CSS Grid Equal-Height Cards

## The Problem

When a grid has cards of different content heights (e.g., a hero card spanning 2 rows vs. a 3x2 grid of smaller cards), adding `items-start` to the grid prevents columns from stretching to equal height. The hero card shrinks to its content height while the KPI grid column is taller.

## The Trap: ResizeObserver + flex-1

First instinct was to make the chart inside the hero card grow dynamically with `flex-1` + a `ResizeObserver` to update the SVG viewBox. This caused the chart to fill the **entire viewport** — the flex container had no height constraint, so `flex-1` expanded infinitely.

**Why it failed:** In a CSS Grid cell without explicit height, `flex-1` resolves against the content height, not the grid cell height. The ResizeObserver fires, grows the chart, which triggers another resize — creating a feedback loop.

## The Fix: `stretch` + `h-full` + `justify-between`

1. **Remove `items-start` from the grid.** CSS Grid's default `align-items: stretch` makes both columns the same height.
2. **Add `h-full` to the card.** The card now fills the grid cell's full stretched height.
3. **Add `justify-between` to the card's flex column.** Content at top (header + chart), expandable sub-items at bottom. Extra height becomes the gap between them.
4. **Keep chart at fixed height (120px).** No dynamic resizing needed — the spacing absorbs the difference.

```
Grid (no items-start = stretch by default)
├── Column 1: Hero card (h-full flex-col justify-between)
│   ├── <div> header + chart (fixed 120px)
│   └── <div> sub-items (pushed to bottom)
├── Column 2: 3x2 KPI grid
```

## Key Insight

The chart doesn't need to grow. The *spacing* between chart and sub-items absorbs the height difference. This is cheaper, safer, and avoids all ResizeObserver complexity.

## Animation Bonus

With `justify-between`, expanding/collapsing sub-items via Framer Motion `AnimatePresence` smoothly redistributes the gap — sub-items grow up from bottom, gap shrinks. No layout shifts on header or chart.

## Mobile Fallback

On `max-lg:grid-cols-1`, the grid stacks to a single column. `h-full` resolves to content height (no stretching target), so the card just wraps its content naturally. No special handling needed.

## Variant: Chart Needs to Fill Available Height

The `justify-between` approach works when extra height can silently become gap. But when you
need the chart itself to actually fill the remaining space (dead white space is visible and
looks wrong), measure the card height explicitly with `useContainerSize`:

```tsx
const [cardSizeRef, cardSizeState] = useContainerSize(); // measures the card div
const [chartRef, chartSize] = useContainerSize();        // measures chart container width

// Overhead = padding-top(16) + header-row(79) + chart-margin-top(14) + subitems-hint(21) + padding-bottom(16)
const CHART_OVERHEAD_PX = 146;
const chartHeight = Math.max(80, Math.min(400,
  cardSizeState.height > 0 ? cardSizeState.height - CHART_OVERHEAD_PX : 120
));
```

The card structure stays the same (`h-full flex-col justify-between`), but the chart gets an
explicit pixel height instead of `flex-1`:

```tsx
<div ref={mergedCardRef} className="relative flex h-full flex-col justify-between ...">
  <div>  {/* top section — plain div, no flex-1 */}
    <div ...>{/* header row */}</div>
    <div ref={chartRef} style={{ height: chartHeight }}>
      {chartSize.width > 0 && <YoYBarChart width={chartSize.width} height={chartHeight} />}
    </div>
  </div>
  <AnimatePresence>{/* sub-items / hint */}</AnimatePresence>
</div>
```

**Combined ref for grid nav + ResizeObserver on the same element:**
```tsx
const mergedCardRef = useCallback((el: HTMLDivElement | null) => {
  (cardSizeRef as { current: HTMLDivElement | null }).current = el;
  cardRef?.(el); // keyboard nav ref from parent
}, [cardRef, cardSizeRef]);
```

WHY: `useContainerSize` returns a `RefObject`, not a callback ref, so it can't be spread
with another callback ref. Casting `.current` is safe — `useContainerSize` only reads
`.current` inside the ResizeObserver callback.

Also note: always pass `width={chartSize.width}` to `<YoYBarChart>` — without it the SVG
letterboxes at 400px due to `preserveAspectRatio="xMinYMin meet"` default behavior.

## Discovered

2026-03-31 — after two failed attempts with ResizeObserver and flex-1 approaches
2026-04-14 — chart-fills-height variant added after discovering dead white space in hero card
