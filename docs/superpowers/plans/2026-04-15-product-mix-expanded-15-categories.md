# Product Mix Expanded View — 15-Category Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the product mix cap from 7 to 15 categories in the expanded modal, and replace the single-column layout with a side-by-side donut + 2-column legend layout.

**Architecture:** Three isolated changes: (1) server cap in `data-aggregator.ts`, (2) new props + extended palette in `ProductMixDonut.tsx`, (3) new side-by-side layout in `ProductMixCarousel.tsx`. The compact carousel card is untouched. No API shape changes.

**Tech Stack:** TypeScript strict · React 19 · Tailwind CSS v4 · Vitest (server tests only — client changes verified by `tsc -b --noEmit`)

---

### Task 1: Server — raise product mix cap from 7 to 15

**Files:**
- Create: `server/src/services/__tests__/data-aggregator-product-mix.test.ts`
- Modify: `server/src/services/data-aggregator.ts:67,88-94`

- [ ] **Step 1: Write the failing test**

Create `server/src/services/__tests__/data-aggregator-product-mix.test.ts`:

```typescript
// FILE: server/src/services/__tests__/data-aggregator-product-mix.test.ts
// PURPOSE: Tests for computeProductMix cap — max 15 segments, Other grouping
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { aggregateOrders } from '../data-aggregator.js';
import type { RawOrder, RawOrderItem } from '../priority-queries.js';

function makeItem(category: string, value: number): RawOrderItem {
  return {
    PARTNAME: `SKU-${category}`,
    PDES: category,
    QPRICE: value,
    QPROFIT: value * 0.2,
    TQUANT: 1,
    TUNITNAME: 'units',
    PRICE: value,
    PERCENT: 20,
    Y_3021_5_ESH: category,
    Y_2075_5_ESH: '',
    Y_9952_5_ESH: '',
    Y_5380_5_ESH: '',
    Y_9967_5_ESH: '',
    Y_1530_5_ESH: '',
    Y_1159_5_ESH: '',
    Y_3020_5_ESH: '',
  } as RawOrderItem;
}

function makeOrder(items: RawOrderItem[]): RawOrder {
  const total = items.reduce((s, i) => s + i.QPRICE, 0);
  return {
    ORDNAME: 'ORD-MIX',
    CURDATE: '2026-01-15T00:00:00Z',
    ORDSTATUSDES: 'Closed',
    TOTPRICE: total,
    CUSTNAME: 'C1',
    AGENTCODE: 'A1',
    AGENTNAME: 'Agent 1',
    ORDERITEMS_SUBFORM: items,
  } as RawOrder;
}

describe('computeProductMix via aggregateOrders', () => {
  it('returns all segments when there are exactly 15 categories', () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      makeItem(`Cat${i + 1}`, 100),
    );
    const result = aggregateOrders([makeOrder(items)], [], 'ytd');
    expect(result.productMixes.productType).toHaveLength(15);
    expect(result.productMixes.productType.every(s => s.category !== 'Other')).toBe(true);
  });

  it('caps at 15 segments and creates Other when there are 16 categories', () => {
    const items = Array.from({ length: 16 }, (_, i) =>
      makeItem(`Cat${i + 1}`, 100),
    );
    const result = aggregateOrders([makeOrder(items)], [], 'ytd');
    expect(result.productMixes.productType).toHaveLength(15);
    const other = result.productMixes.productType.find(s => s.category === 'Other');
    expect(other).toBeDefined();
  });

  it('Other sums the values of all categories beyond the top 14', () => {
    const items = Array.from({ length: 16 }, (_, i) =>
      makeItem(`Cat${i + 1}`, 100),
    );
    const result = aggregateOrders([makeOrder(items)], [], 'ytd');
    const other = result.productMixes.productType.find(s => s.category === 'Other');
    // 16 categories × $100 each — top 14 named, Other = 2 × $100 = $200
    expect(other?.value).toBe(200);
  });

  it('returns fewer than 15 segments without Other when data has fewer categories', () => {
    const items = [
      makeItem('Bread', 500),
      makeItem('Dairy', 300),
    ];
    const result = aggregateOrders([makeOrder(items)], [], 'ytd');
    expect(result.productMixes.productType).toHaveLength(2);
    expect(result.productMixes.productType.every(s => s.category !== 'Other')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd server && npx vitest run src/services/__tests__/data-aggregator-product-mix.test.ts
```

Expected: tests 1 and 4 pass (≤15 categories already work), tests 2 and 3 fail because the current cap is 7 not 15.

- [ ] **Step 3: Update the server cap in `data-aggregator.ts`**

In `server/src/services/data-aggregator.ts`, make two edits:

**Edit 1** — update the comment at line 67:
```typescript
// Before:
/** Spec Section 20.2 — Group items by a category field, max 7 segments */

// After:
/** Spec Section 20.2 — Group items by a category field, max 15 segments in expanded view */
```

**Edit 2** — replace the cap block at lines 88-94:
```typescript
// Before:
  if (sorted.length > 7) {
    const top6 = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    const otherValue = rest.reduce((sum, s) => sum + s.value, 0);
    top6.push({ category: 'Other', value: otherValue, percentage: total > 0 ? Math.round((otherValue / total) * 100) : 0 });
    return top6;
  }

// After:
  if (sorted.length > 15) {
    const top14 = sorted.slice(0, 14);
    const rest = sorted.slice(14);
    const otherValue = rest.reduce((sum, s) => sum + s.value, 0);
    top14.push({ category: 'Other', value: otherValue, percentage: total > 0 ? Math.round((otherValue / total) * 100) : 0 });
    return top14;
  }
```

- [ ] **Step 4: Run all server tests to verify they pass**

```bash
cd server && npx vitest run
```

Expected: all tests pass (previously 63, now 67 — 4 new ones added).

- [ ] **Step 5: Commit**

```bash
cd server && git add src/services/__tests__/data-aggregator-product-mix.test.ts src/services/data-aggregator.ts
git commit -m "feat: raise product mix segment cap from 7 to 15 (top 14 + Other)"
```

---

### Task 2: Client — add `showLegend`/`maxSegments` props and extend color palette in ProductMixDonut

**Files:**
- Modify: `client/src/components/right-panel/ProductMixDonut.tsx`

- [ ] **Step 1: Replace the entire file with the updated version**

`client/src/components/right-panel/ProductMixDonut.tsx`:

```typescript
// FILE: client/src/components/right-panel/ProductMixDonut.tsx
// PURPOSE: SVG donut chart with center text and optional color legend for product mix
// USED BY: client/src/components/right-panel/ChartsRow.tsx, ProductMixCarousel.tsx
// EXPORTS: ProductMixDonut, SEGMENT_COLORS

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ProductMixSegment } from '@shared/types/dashboard';
import { formatCurrencyCompact } from '@shared/utils/formatting';

interface ProductMixDonutProps {
  data: ProductMixSegment[];
  /** When false, renders the SVG donut only — no legend below. Default: true */
  showLegend?: boolean;
  /** How many segments to display from data. Default: 7 (compact card). Use 15 for expanded view. */
  maxSegments?: number;
}

/** WHY exported: ProductMixCarousel's 2-column legend must use the same colors by index */
/** WHY these specific colors: spec Section 20.2 warm-palette, extended to 15 for expanded view */
export const SEGMENT_COLORS = [
  '#b8a88a', // gold-primary
  '#d4c5a9', // gold-light
  '#8B7355', // darker warm brown
  '#C4A882', // light warm tan
  '#e8e0d0', // gold-muted
  '#A09070', // medium brown
  '#f0ece5', // gold-subtle
  // Extended palette for expanded view (categories 8–15)
  '#7A6248', // deep warm brown
  '#E2D4BC', // pale wheat
  '#5E4E38', // espresso
  '#BFAA8E', // warm khaki
  '#917B5E', // warm taupe
  '#D8CAAF', // sand
  '#4A3C2A', // very dark brown
  '#F0EBE0', // pale cream
];

const CENTER_X = 60;
const CENTER_Y = 60;
const OUTER_R = 54;
const INNER_R = 36;
/** WHY stroke approach: uses stroke-based ring (radius = midpoint, stroke-width = thickness) */
const MID_R = (OUTER_R + INNER_R) / 2;
const STROKE_W = OUTER_R - INNER_R;
const CIRCUMFERENCE = 2 * Math.PI * MID_R;
/** WHY 2px gap: spec requires visible gap between segments */
const GAP_PX = 2;

export function ProductMixDonut({ data, showLegend = true, maxSegments = 7 }: ProductMixDonutProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const segments = data.slice(0, maxSegments);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const totalCount = segments.length;

  /** WHY cumulative offset: each segment starts where the previous one ended */
  let cumulativeOffset = 0;
  const arcs = segments.map((seg, i) => {
    const fraction = seg.value / total;
    const dashLen = fraction * CIRCUMFERENCE - GAP_PX;
    const gapLen = CIRCUMFERENCE - dashLen;
    const offset = -cumulativeOffset + CIRCUMFERENCE * 0.25;
    cumulativeOffset += fraction * CIRCUMFERENCE;
    return { seg, i, dashLen, gapLen, offset, color: SEGMENT_COLORS[i] };
  });

  const centerLabel = hoveredIdx !== null ? segments[hoveredIdx].category : 'Total';
  const centerValue = hoveredIdx !== null
    ? formatCurrencyCompact(segments[hoveredIdx].value)
    : String(totalCount);

  return (
    <div className="flex flex-col items-center gap-[var(--spacing-lg)]">
      {/* SVG donut — spec: 160x160px, viewBox 0 0 120 120 */}
      <svg
        width="160"
        height="160"
        viewBox="0 0 120 120"
        className="cursor-pointer"
        role="img"
        aria-label="Product mix donut chart"
      >
        {/* WHY motion.circle: ring draws from 0 to full dashLen, 600ms ease-out per spec 21.1 */}
        {arcs.map(({ i, dashLen, gapLen, offset, color }) => (
          <motion.circle
            key={i}
            cx={CENTER_X}
            cy={CENTER_Y}
            r={MID_R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE_W}
            strokeLinecap="round"
            strokeDashoffset={offset}
            initial={{ strokeDasharray: `0 ${CIRCUMFERENCE}` }}
            animate={{ strokeDasharray: `${Math.max(dashLen, 0)} ${gapLen}` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.06 }}
            style={{
              opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.5 : 1,
              transform: hoveredIdx === i ? 'scale(1.04)' : 'scale(1)',
              transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
              transition: 'opacity 200ms, transform 200ms',
            }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          />
        ))}
        {/* Center text */}
        <text
          x={CENTER_X}
          y={CENTER_Y - 5}
          textAnchor="middle"
          fill="#999"
          fontSize="10"
          fontWeight="400"
        >
          {centerLabel}
        </text>
        <text
          x={CENTER_X}
          y={CENTER_Y + 10}
          textAnchor="middle"
          fill="#1a1a1a"
          fontSize="17"
          fontWeight="700"
        >
          {centerValue}
        </text>
      </svg>

      {/* Legend — hidden in expanded modal (2-column legend rendered by parent instead) */}
      {showLegend && (
        <div className="flex flex-col gap-[var(--spacing-xs)]">
          {segments.map((seg, i) => (
            <div
              key={seg.category}
              className="flex items-center gap-[var(--spacing-md)] text-[13px] text-[var(--color-text-secondary)]"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: SEGMENT_COLORS[i] }}
              />
              <span className="font-medium">{seg.percentage}%</span>
              <span>{seg.category}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript is clean**

```bash
cd client && npx tsc -b --noEmit
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
cd client && git add src/components/right-panel/ProductMixDonut.tsx
git commit -m "feat: add showLegend/maxSegments props to ProductMixDonut, extend color palette to 15"
```

---

### Task 3: Client — replace ProductMixExpanded with side-by-side layout

**Files:**
- Modify: `client/src/components/right-panel/ProductMixCarousel.tsx`

- [ ] **Step 1: Replace the entire file with the updated version**

`client/src/components/right-panel/ProductMixCarousel.tsx`:

```typescript
// FILE: client/src/components/right-panel/ProductMixCarousel.tsx
// PURPOSE: Left/right carousel wrapping ProductMixDonut — cycles through 5 mix types
// USED BY: client/src/components/right-panel/ChartsRow.tsx
// EXPORTS: ProductMixCarousel, ProductMixExpanded

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProductMixSegment, ProductMixType } from '@shared/types/dashboard';
import { PRODUCT_MIX_LABELS, PRODUCT_MIX_ORDER } from '@shared/types/dashboard';
import { formatCurrencyCompact } from '@shared/utils/formatting';
import { ProductMixDonut, SEGMENT_COLORS } from './ProductMixDonut';

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

/** WHY: Separate export for modal — donut left + 2-column legend right, up to 15 categories */
export function ProductMixExpanded({ mixes }: ProductMixCarouselProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const types = PRODUCT_MIX_ORDER;
  const activeType = types[activeIdx];
  const segments = mixes[activeType] ?? [];

  /** WHY ceil: left column gets the extra item when count is odd */
  const half = Math.ceil(segments.length / 2);
  const col1 = segments.slice(0, half);
  const col2 = segments.slice(half);

  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      {/* Tab bar */}
      <div className="flex gap-[var(--spacing-md)]">
        {types.map((type, i) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveIdx(i)}
            className={`cursor-pointer rounded-[var(--radius-base)] px-[var(--spacing-lg)] py-[var(--spacing-xs)] text-[12px] font-medium transition-colors ${
              i === activeIdx ? 'bg-[var(--color-dark)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-gold-subtle)]'
            }`}
          >
            {PRODUCT_MIX_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Side-by-side: donut left, 2-column legend right */}
      <div className="flex items-start gap-[var(--spacing-3xl)]">
        {/* Donut without legend — legend rendered below in 2 columns */}
        <ProductMixDonut data={segments} showLegend={false} maxSegments={15} />

        {/* 2-column legend grid */}
        <div className="flex flex-1 gap-[var(--spacing-xl)]">
          {[col1, col2].map((col, colIdx) => (
            <div key={colIdx} className="flex flex-1 flex-col gap-[var(--spacing-sm)]">
              {col.map((seg, rowIdx) => {
                const globalIdx = colIdx === 0 ? rowIdx : half + rowIdx;
                return (
                  <div
                    key={seg.category}
                    className="flex items-center gap-[var(--spacing-sm)] text-[12px]"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: SEGMENT_COLORS[globalIdx] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[var(--color-text-secondary)]">
                      {seg.category}
                    </span>
                    <span className="ml-1 font-semibold text-[var(--color-text-primary)]">
                      {seg.percentage}%
                    </span>
                    <span className="ml-1 whitespace-nowrap text-[var(--color-text-muted)]">
                      {formatCurrencyCompact(seg.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
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
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold-primary)]"
          aria-label="Previous chart type"
        >
          <ChevronLeft />
        </button>
        <h2
          className="text-[15px] font-semibold text-[var(--color-text-primary)]"
          role="tab"
          aria-selected="true"
        >
          Product Mix — {PRODUCT_MIX_LABELS[activeMixType]}
        </h2>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold-primary)]"
          aria-label="Next chart type"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Donut with slide animation — compact view keeps default maxSegments=7 */}
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
            onClick={(e) => { e.stopPropagation(); goTo(i, i > activeIdx ? 1 : -1); }}
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

- [ ] **Step 2: Verify TypeScript is clean**

```bash
cd client && npx tsc -b --noEmit
```

Expected: no output (clean).

- [ ] **Step 3: Verify server tests still pass**

```bash
cd server && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd client && git add src/components/right-panel/ProductMixCarousel.tsx
git commit -m "feat: ProductMixExpanded — side-by-side donut + 2-column legend, up to 15 categories"
```
