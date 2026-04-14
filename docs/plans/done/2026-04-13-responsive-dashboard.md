# Responsive Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard responsive and user-controllable across 13" and 27" screens — collapsible left panel, section resize handles, layout presets, hover peek, click-to-expand modals, and a responsive chart.

**Architecture:** Central `useDashboardLayout` hook manages all layout state (presets, panel collapse, resize ratios) and persists to localStorage. Section-boundary resize handles control the hero/KPI and KPI/charts splits. Cards get hover peek (400ms delay floating panel) and click-to-expand modals. Chart height is driven by ResizeObserver instead of a constant.

**Tech Stack:** React 19, Framer Motion (existing), Tailwind CSS v4 (existing), ResizeObserver API, localStorage

**Spec:** `docs/specs/2026-04-13-responsive-dashboard-design.md`

---

## File Map

### New Files (12 files, ~610 lines total)

| File | Lines | Responsibility |
|------|-------|---------------|
| `client/src/hooks/useDashboardLayout.ts` | ~80 | Central layout state + localStorage persistence + presets |
| `client/src/hooks/useResizablePanel.ts` | ~70 | Mouse/touch drag logic for section dividers |
| `client/src/hooks/useContainerSize.ts` | ~25 | ResizeObserver wrapper returning { width, height } |
| `client/src/hooks/useHoverPeek.ts` | ~50 | Hover delay timer + floating panel positioning |
| `client/src/components/shared/CardModal.tsx` | ~90 | Modal overlay: backdrop, animation, close, portal |
| `client/src/components/shared/ModalProvider.tsx` | ~35 | React context: openModal(content) / closeModal() |
| `client/src/components/shared/HoverPeek.tsx` | ~80 | Floating preview panel with arrow, portal |
| `client/src/components/shared/ExpandIcon.tsx` | ~20 | Tiny expand SVG icon, fades in on card hover |
| `client/src/components/left-panel/CollapsedPanel.tsx` | ~45 | Narrow 48px rail: expand button + dimension icon |
| `client/src/components/right-panel/LayoutPresetToggle.tsx` | ~50 | 3-segment pill: Compact / Balanced / Spacious |
| `client/src/components/right-panel/ResizeDivider.tsx` | ~35 | Invisible divider element, gold line on hover |
| `client/src/hooks/useCardNavigation.ts` | ~30 | Arrow key navigation between card grid cells |

### Modified Files (10 files)

| File | Changes |
|------|---------|
| `client/src/components/right-panel/KPICard.tsx` | Revert text sizes, add click→modal, hover→peek wrappers, expand icon |
| `client/src/components/right-panel/HeroRevenueCard.tsx` | Revert text sizes, responsive chart container, click→modal, hover→peek |
| `client/src/components/right-panel/YoYBarChart.tsx` | Accept `height` prop, remove `CHART_HEIGHT` constant |
| `client/src/components/right-panel/KPISection.tsx` | Horizontal resize divider between hero and KPI grid |
| `client/src/components/right-panel/RightPanel.tsx` | Vertical resize divider, wrap cards with modal/peek handlers |
| `client/src/components/right-panel/ChartsRow.tsx` | Click→modal + hover→peek on Product Mix and Best Sellers |
| `client/src/components/right-panel/DetailHeader.tsx` | Add LayoutPresetToggle + reset button |
| `client/src/layouts/DashboardLayout.tsx` | Collapsible left panel, useDashboardLayout integration |
| `client/src/components/right-panel/ProductMixCarousel.tsx` | Export expanded modal content variant |
| `client/src/components/right-panel/BestSellers.tsx` | Export expanded modal content variant |
| `client/src/App.tsx` | Wrap with ModalProvider |

---

## Task 1: Layout Types + useDashboardLayout Hook

**Files:**
- Create: `client/src/hooks/useDashboardLayout.ts`

- [ ] **Step 1: Create the useDashboardLayout hook**

```typescript
// FILE: client/src/hooks/useDashboardLayout.ts
// PURPOSE: Central layout state — presets, panel collapse, resize ratios, localStorage persistence
// USED BY: DashboardLayout.tsx, DetailHeader.tsx, KPISection.tsx, RightPanel.tsx
// EXPORTS: useDashboardLayout, DashboardLayoutState, LayoutPreset

import { useState, useCallback, useMemo } from 'react';

export type LayoutPreset = 'compact' | 'balanced' | 'spacious' | 'custom';

export interface DashboardLayoutState {
  preset: LayoutPreset;
  panelCollapsed: boolean;
  heroKpiRatio: [number, number];
  kpiChartsRatio: [number, number];
}

interface StoredLayout {
  version: number;
  preset: LayoutPreset;
  panelCollapsed: boolean;
  heroKpiRatio: [number, number];
  kpiChartsRatio: [number, number];
}

const STORAGE_KEY = 'sg-dashboard-layout';
const SCHEMA_VERSION = 1;

const PRESET_VALUES: Record<Exclude<LayoutPreset, 'custom'>, Pick<DashboardLayoutState, 'heroKpiRatio' | 'kpiChartsRatio'>> = {
  compact:  { heroKpiRatio: [2, 3], kpiChartsRatio: [6, 5] },
  balanced: { heroKpiRatio: [3, 2], kpiChartsRatio: [1, 1] },
  spacious: { heroKpiRatio: [3, 2], kpiChartsRatio: [5, 6] },
};

function detectDefaultPreset(): Exclude<LayoutPreset, 'custom'> {
  if (typeof window === 'undefined') return 'balanced';
  return window.innerWidth < 1280 ? 'compact' : 'balanced';
}

function loadFromStorage(): DashboardLayoutState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredLayout = JSON.parse(raw);
    if (parsed.version !== SCHEMA_VERSION) return null;
    return {
      preset: parsed.preset,
      panelCollapsed: parsed.panelCollapsed,
      heroKpiRatio: parsed.heroKpiRatio,
      kpiChartsRatio: parsed.kpiChartsRatio,
    };
  } catch {
    return null;
  }
}

function saveToStorage(state: DashboardLayoutState): void {
  const stored: StoredLayout = { version: SCHEMA_VERSION, ...state };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function buildDefaults(): DashboardLayoutState {
  const preset = detectDefaultPreset();
  return {
    preset,
    panelCollapsed: typeof window !== 'undefined' && window.innerWidth < 1280,
    ...PRESET_VALUES[preset],
  };
}

export function useDashboardLayout() {
  const [state, setState] = useState<DashboardLayoutState>(() => loadFromStorage() ?? buildDefaults());

  const persist = useCallback((next: DashboardLayoutState) => {
    setState(next);
    saveToStorage(next);
  }, []);

  const setPreset = useCallback((preset: Exclude<LayoutPreset, 'custom'>) => {
    persist({ ...state, preset, ...PRESET_VALUES[preset] });
  }, [state, persist]);

  const togglePanel = useCallback(() => {
    persist({ ...state, panelCollapsed: !state.panelCollapsed });
  }, [state, persist]);

  const setHeroKpiRatio = useCallback((ratio: [number, number]) => {
    persist({ ...state, heroKpiRatio: ratio, preset: 'custom' });
  }, [state, persist]);

  const setKpiChartsRatio = useCallback((ratio: [number, number]) => {
    persist({ ...state, kpiChartsRatio: ratio, preset: 'custom' });
  }, [state, persist]);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    const defaults = buildDefaults();
    setState(defaults);
    saveToStorage(defaults);
  }, []);

  /** WHY useMemo: Stable grid template string avoids re-renders when ratio hasn't changed */
  const heroKpiTemplate = useMemo(
    () => `${state.heroKpiRatio[0]}fr ${state.heroKpiRatio[1]}fr`,
    [state.heroKpiRatio],
  );

  return {
    layout: state,
    heroKpiTemplate,
    setPreset,
    togglePanel,
    setHeroKpiRatio,
    setKpiChartsRatio,
    reset,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors (hook exists but isn't imported yet — tree-shaking ignores it)

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useDashboardLayout.ts
git commit -m "feat: add useDashboardLayout hook — presets, persistence, panel state"
```

---

## Task 2: Revert Text Sizes

**Files:**
- Modify: `client/src/components/right-panel/KPICard.tsx:107-110`
- Modify: `client/src/components/right-panel/HeroRevenueCard.tsx:58-72`

- [ ] **Step 1: Revert KPICard sub-item text sizes**

In `KPICard.tsx`, revert three text sizes in the sub-items section:

```typescript
// Line 107: sub-item label — 10px back to 9px
<span className="text-[9px] font-normal text-[var(--color-text-muted)] whitespace-nowrap">{item.label}</span>

// Line 108: sub-item value — 13px back to 12px
<span className="text-[12px] font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">

// Line 110: sub-item suffix — 10px back to 9px
<span className="ml-0.5 text-[9px] font-normal text-[var(--color-text-muted)]">({item.suffix})</span>
```

- [ ] **Step 2: Revert HeroRevenueCard previous-year text sizes**

In `HeroRevenueCard.tsx`, revert four text sizes:

```typescript
// Line 58: prev year label (same period) — 11px back to 10px
<span className="text-[10px] font-normal text-[var(--color-text-faint)]">

// Line 61: prev year value (same period) — 18px back to 16px
<span className="text-[16px] font-semibold text-[var(--color-text-faint)]">

// Line 69: prev year label (full year) — 11px back to 10px
<span className="text-[10px] font-normal text-[var(--color-text-faint)]">

// Line 72: prev year value (full year) — 16px back to 14px
<span className="text-[14px] font-semibold text-[var(--color-text-faint)]">
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add client/src/components/right-panel/KPICard.tsx client/src/components/right-panel/HeroRevenueCard.tsx
git commit -m "fix: revert text sizes to original compact values (pre-94e4028)"
```

---

## Task 3: Responsive Chart

**Files:**
- Create: `client/src/hooks/useContainerSize.ts`
- Modify: `client/src/components/right-panel/YoYBarChart.tsx`
- Modify: `client/src/components/right-panel/HeroRevenueCard.tsx`

- [ ] **Step 1: Create useContainerSize hook**

```typescript
// FILE: client/src/hooks/useContainerSize.ts
// PURPOSE: ResizeObserver wrapper — returns { width, height } of a container element
// USED BY: HeroRevenueCard.tsx (chart container)
// EXPORTS: useContainerSize

import { useState, useEffect, useRef, type RefObject } from 'react';

interface ContainerSize {
  width: number;
  height: number;
}

export function useContainerSize(): [RefObject<HTMLDivElement | null>, ContainerSize] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
```

- [ ] **Step 2: Update YoYBarChart to accept height prop**

Replace the constant-based sizing with a `height` prop. In `YoYBarChart.tsx`:

Remove the constant:
```typescript
// DELETE these lines (15-19):
// const CHART_HEIGHT = 180;
// const Y_LABEL_WIDTH = 36;
// const X_LABEL_HEIGHT = 16;
// const LEGEND_HEIGHT = 20;
// const BAR_AREA_HEIGHT = CHART_HEIGHT - X_LABEL_HEIGHT - LEGEND_HEIGHT;
```

Update the props and add constants inside the component:
```typescript
interface YoYBarChartProps {
  data: MonthlyRevenue[];
  /** WHY: Dynamic height from container via ResizeObserver. Clamped externally to [80, 400]. */
  height?: number;
}

const Y_LABEL_WIDTH = 36;
const X_LABEL_HEIGHT = 16;
const LEGEND_HEIGHT = 20;
const BAR_RADIUS = 2;
const DEFAULT_HEIGHT = 120;

export function YoYBarChart({ data, height: rawHeight }: YoYBarChartProps) {
  const chartHeight = rawHeight ?? DEFAULT_HEIGHT;
  const barAreaHeight = chartHeight - X_LABEL_HEIGHT - LEGEND_HEIGHT;
```

Then replace every reference to `CHART_HEIGHT` with `chartHeight` and `BAR_AREA_HEIGHT` with `barAreaHeight` throughout the component. These are used at:
- SVG `height={chartHeight}` and `viewBox={...${chartHeight}...}` (line ~59)
- Grid line y calculation (line ~65)
- Bar y/height calculations (lines ~99-100)
- Hit area height (line ~113)
- Tooltip y calculation (line ~167)
- Legend transform (line ~192)

- [ ] **Step 3: Update HeroRevenueCard chart container**

In `HeroRevenueCard.tsx`, replace the static chart div with a flex-1 measured container:

Add import at top:
```typescript
import { useContainerSize } from '../../hooks/useContainerSize';
```

Inside the component, add:
```typescript
const [chartRef, chartSize] = useContainerSize();
/** WHY clamp: min 80px for usability, max 400px to prevent oversized chart on 27" */
const chartHeight = Math.max(80, Math.min(400, chartSize.height));
```

Replace the chart div (line ~82-84):
```typescript
{/* YoY bar chart — flex-1 fills remaining vertical space */}
<div ref={chartRef} className="mt-[var(--spacing-md)] flex-1 min-h-[80px]">
  {chartSize.height > 0 && <YoYBarChart data={monthlyRevenue} height={chartHeight} />}
</div>
```

WHY `chartSize.height > 0` guard: Prevents rendering with 0 height on first frame before ResizeObserver fires.

- [ ] **Step 4: Verify TypeScript compiles and bundle builds**

Run: `cd client && npx tsc -b --noEmit && npx vite build`
Expected: Both pass, no errors

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useContainerSize.ts client/src/components/right-panel/YoYBarChart.tsx client/src/components/right-panel/HeroRevenueCard.tsx
git commit -m "feat: responsive chart height via ResizeObserver, remove fixed CHART_HEIGHT"
```

---

## Task 4: Collapsible Left Panel

**Files:**
- Create: `client/src/components/left-panel/CollapsedPanel.tsx`
- Modify: `client/src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Create CollapsedPanel component**

```typescript
// FILE: client/src/components/left-panel/CollapsedPanel.tsx
// PURPOSE: Narrow 48px rail shown when left panel is collapsed — expand button + dimension icon
// USED BY: DashboardLayout.tsx
// EXPORTS: CollapsedPanel

import type { Dimension } from '@shared/types/dashboard';

interface CollapsedPanelProps {
  activeDimension: Dimension;
  onExpand: () => void;
}

/** WHY: Map dimensions to single-letter or short icon representations */
const DIMENSION_ICONS: Record<Dimension, string> = {
  customer: 'C',
  zone: 'Z',
  vendor: 'V',
  brand: 'B',
  product_type: 'T',
  product: 'P',
};

export function CollapsedPanel({ activeDimension, onExpand }: CollapsedPanelProps) {
  return (
    <div className="flex h-full w-[48px] shrink-0 flex-col items-center gap-[var(--spacing-lg)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
      {/* Expand button */}
      <button
        type="button"
        onClick={onExpand}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-base)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-gold-subtle)] hover:text-[var(--color-text-secondary)]"
        aria-label="Expand panel"
        title="Expand panel (or press [)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Active dimension indicator */}
      <div
        className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-dark)] text-[10px] font-bold text-white"
        title={activeDimension}
      >
        {DIMENSION_ICONS[activeDimension]}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate collapsible panel into DashboardLayout**

In `DashboardLayout.tsx`, add imports:
```typescript
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { CollapsedPanel } from '../components/left-panel/CollapsedPanel';
```

Inside `DashboardLayout` function, add the hook call (after existing hooks, before early returns):
```typescript
const { layout, togglePanel } = useDashboardLayout();
```

Add keyboard shortcut effect (after existing useEffect):
```typescript
useEffect(() => {
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === '[' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
      togglePanel();
    }
  };
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}, [togglePanel]);
```

Replace the left panel div (lines ~162-194) with conditional rendering:
```typescript
{layout.panelCollapsed ? (
  <CollapsedPanel activeDimension={activeDimension} onExpand={togglePanel} />
) : (
  <div className="flex w-[280px] shrink-0 flex-col gap-[var(--spacing-base)] max-lg:w-full">
    {/* Collapse button — top-right of panel */}
    <button
      type="button"
      onClick={togglePanel}
      className="absolute right-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-faint)] opacity-0 transition-all hover:bg-[var(--color-gold-subtle)] hover:text-[var(--color-text-muted)] group-hover/left:opacity-100"
      aria-label="Collapse panel"
      title="Collapse panel (or press [)"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M8 2L3 6l5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
    <LeftPanel ... />  {/* existing props unchanged */}
  </div>
)}
```

Wrap the left panel container div with `group/left relative` for the collapse button hover reveal:
```typescript
<div className="group/left relative flex w-[280px] shrink-0 flex-col gap-[var(--spacing-base)] max-lg:w-full">
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add client/src/components/left-panel/CollapsedPanel.tsx client/src/layouts/DashboardLayout.tsx
git commit -m "feat: collapsible left panel with keyboard shortcut and auto-collapse on small screens"
```

---

## Task 5: Resize Dividers

**Files:**
- Create: `client/src/hooks/useResizablePanel.ts`
- Create: `client/src/components/right-panel/ResizeDivider.tsx`

- [ ] **Step 1: Create useResizablePanel hook**

```typescript
// FILE: client/src/hooks/useResizablePanel.ts
// PURPOSE: Mouse/touch drag logic for section resize dividers
// USED BY: KPISection.tsx (horizontal), RightPanel.tsx (vertical)
// EXPORTS: useResizablePanel

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseResizablePanelOptions {
  direction: 'horizontal' | 'vertical';
  defaultRatio: [number, number];
  minPercent?: number;
  maxPercent?: number;
  onRatioChange: (ratio: [number, number]) => void;
}

export function useResizablePanel({
  direction,
  defaultRatio,
  minPercent = 30,
  maxPercent = 70,
  onRatioChange,
}: UseResizablePanelOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ pos: 0, ratio: defaultRatio });

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const clientPos = 'touches' in e
      ? (direction === 'horizontal' ? e.touches[0].clientX : e.touches[0].clientY)
      : (direction === 'horizontal' ? e.clientX : e.clientY);

    startRef.current = { pos: clientPos, ratio: [...defaultRatio] as [number, number] };
    setIsDragging(true);
  }, [direction, defaultRatio]);

  useEffect(() => {
    if (!isDragging) return;

    const container = containerRef.current;
    if (!container) return;

    const totalSize = direction === 'horizontal' ? container.offsetWidth : container.offsetHeight;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientPos = 'touches' in e
        ? (direction === 'horizontal' ? e.touches[0].clientX : e.touches[0].clientY)
        : (direction === 'horizontal' ? e.clientX : e.clientY);

      const delta = clientPos - startRef.current.pos;
      const deltaPercent = (delta / totalSize) * 100;
      const [a, b] = startRef.current.ratio;
      const totalParts = a + b;
      const originalPercent = (a / totalParts) * 100;
      const newPercent = Math.max(minPercent, Math.min(maxPercent, originalPercent + deltaPercent));
      /** WHY round to integers: Fractional fr values cause subpixel rendering jitter */
      const newA = Math.round(newPercent);
      const newB = 100 - newA;
      onRatioChange([newA, newB]);
    };

    const handleUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, direction, minPercent, maxPercent, onRatioChange]);

  return { containerRef, isDragging, handleMouseDown };
}
```

- [ ] **Step 2: Create ResizeDivider component**

```typescript
// FILE: client/src/components/right-panel/ResizeDivider.tsx
// PURPOSE: Invisible divider element with gold line on hover, drag cursor
// USED BY: KPISection.tsx, RightPanel.tsx
// EXPORTS: ResizeDivider

interface ResizeDividerProps {
  direction: 'horizontal' | 'vertical';
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

export function ResizeDivider({ direction, isDragging, onMouseDown, onTouchStart }: ResizeDividerProps) {
  const isHorizontal = direction === 'horizontal';

  return (
    <div
      role="separator"
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      className={`group/divider relative shrink-0 ${
        isHorizontal
          ? 'w-[6px] cursor-col-resize'
          : 'h-[6px] cursor-row-resize'
      }`}
    >
      {/* WHY: Visible line only on hover/drag — invisible by default for clean aesthetic */}
      <div
        className={`absolute transition-colors duration-150 ${
          isHorizontal
            ? 'left-[2px] top-0 h-full w-[2px]'
            : 'left-0 top-[2px] h-[2px] w-full'
        } ${
          isDragging
            ? 'bg-[var(--color-gold-primary)]'
            : 'bg-transparent group-hover/divider:bg-[var(--color-gold-muted)]'
        }`}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useResizablePanel.ts client/src/components/right-panel/ResizeDivider.tsx
git commit -m "feat: add useResizablePanel hook and ResizeDivider component"
```

---

## Task 6: Integrate Resize Handles into Layout

**Files:**
- Modify: `client/src/components/right-panel/KPISection.tsx`
- Modify: `client/src/components/right-panel/RightPanel.tsx`

- [ ] **Step 1: Add horizontal resize to KPISection**

In `KPISection.tsx`, add new props and integrate the resize divider.

Add to props interface:
```typescript
interface KPISectionProps {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  sparklines: Record<string, SparklineData>;
  activePeriod: Period;
  /** WHY: Grid template from useDashboardLayout — e.g. "3fr 2fr" */
  heroKpiTemplate: string;
  onHeroKpiRatioChange: (ratio: [number, number]) => void;
  heroKpiRatio: [number, number];
}
```

Add imports:
```typescript
import { useResizablePanel } from '../../hooks/useResizablePanel';
import { ResizeDivider } from './ResizeDivider';
```

Inside the component, add the resize hook:
```typescript
const { containerRef, isDragging, handleMouseDown } = useResizablePanel({
  direction: 'horizontal',
  defaultRatio: heroKpiRatio,
  minPercent: 30,
  maxPercent: 70,
  onRatioChange: onHeroKpiRatioChange,
});
```

Replace the grid div (line ~55) with:
```typescript
<div
  ref={containerRef}
  className="flex gap-0 max-lg:flex-col max-lg:gap-[var(--spacing-base)]"
  style={{ display: 'grid', gridTemplateColumns: `${heroKpiTemplate.split(' ')[0]} 6px ${heroKpiTemplate.split(' ')[1]}` }}
>
  <HeroRevenueCard kpis={kpis} monthlyRevenue={monthlyRevenue} activePeriod={activePeriod} showDetails={showDetails} />
  <ResizeDivider direction="horizontal" isDragging={isDragging} onMouseDown={handleMouseDown} onTouchStart={handleMouseDown} />
  <div className="grid grid-cols-2 grid-rows-3 gap-[var(--spacing-sm)]">
    {/* ... existing 6 KPI cards unchanged ... */}
  </div>
</div>
```

WHY `style` prop for grid template: The ratio is dynamic from drag — Tailwind arbitrary values can't use JS variables. The style prop is the correct escape hatch here.

- [ ] **Step 2: Add vertical resize to RightPanel**

In `RightPanel.tsx`, add props for the vertical resize:

```typescript
interface RightPanelProps {
  /* ... existing props ... */
  heroKpiTemplate: string;
  heroKpiRatio: [number, number];
  kpiChartsRatio: [number, number];
  onHeroKpiRatioChange: (ratio: [number, number]) => void;
  onKpiChartsRatioChange: (ratio: [number, number]) => void;
}
```

Add imports and resize hook:
```typescript
import { useResizablePanel } from '../../hooks/useResizablePanel';
import { ResizeDivider } from './ResizeDivider';
```

```typescript
const { containerRef: vertRef, isDragging: vertDragging, handleMouseDown: vertMouseDown } = useResizablePanel({
  direction: 'vertical',
  defaultRatio: kpiChartsRatio,
  minPercent: 25,
  maxPercent: 75,
  onRatioChange: onKpiChartsRatioChange,
});
```

Wrap the KPISection + ChartsRow in a grid container with the vertical divider between them:
```typescript
<DetailHeader ... />
<div ref={vertRef} className="flex flex-1 flex-col gap-0 min-h-0">
  <div style={{ flex: `${kpiChartsRatio[0]} 1 0%` }} className="min-h-[200px]">
    <KPISection
      kpis={kpis} monthlyRevenue={monthlyRevenue} sparklines={sparklines}
      activePeriod={activePeriod} heroKpiTemplate={heroKpiTemplate}
      heroKpiRatio={heroKpiRatio} onHeroKpiRatioChange={onHeroKpiRatioChange}
    />
  </div>
  <ResizeDivider direction="vertical" isDragging={vertDragging} onMouseDown={vertMouseDown} onTouchStart={vertMouseDown} />
  <div style={{ flex: `${kpiChartsRatio[1]} 1 0%` }} className="min-h-[200px]">
    <ChartsRow productMixes={productMixes} topSellers={topSellers} />
  </div>
</div>
<TabsSection orders={orders} items={items} contacts={contacts} />
```

- [ ] **Step 3: Wire layout props through DashboardLayout**

In `DashboardLayout.tsx`, pass layout props from `useDashboardLayout` down to `RightPanel`:

```typescript
const { layout, heroKpiTemplate, setHeroKpiRatio, setKpiChartsRatio, togglePanel, reset, setPreset } = useDashboardLayout();
```

Add to the RightPanel call:
```typescript
<RightPanel
  /* ... existing props ... */
  heroKpiTemplate={heroKpiTemplate}
  heroKpiRatio={layout.heroKpiRatio}
  kpiChartsRatio={layout.kpiChartsRatio}
  onHeroKpiRatioChange={setHeroKpiRatio}
  onKpiChartsRatioChange={setKpiChartsRatio}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add client/src/components/right-panel/KPISection.tsx client/src/components/right-panel/RightPanel.tsx client/src/layouts/DashboardLayout.tsx
git commit -m "feat: integrate section-boundary resize handles into KPI and charts layout"
```

---

## Task 7: Layout Presets + Reset Button

**Files:**
- Create: `client/src/components/right-panel/LayoutPresetToggle.tsx`
- Modify: `client/src/components/right-panel/DetailHeader.tsx`

- [ ] **Step 1: Create LayoutPresetToggle**

```typescript
// FILE: client/src/components/right-panel/LayoutPresetToggle.tsx
// PURPOSE: 3-segment pill toggle: Compact / Balanced / Spacious — matches PeriodSelector style
// USED BY: DetailHeader.tsx
// EXPORTS: LayoutPresetToggle

import { motion } from 'framer-motion';
import type { LayoutPreset } from '../../hooks/useDashboardLayout';

interface LayoutPresetToggleProps {
  activePreset: LayoutPreset;
  onPresetChange: (preset: Exclude<LayoutPreset, 'custom'>) => void;
}

const PRESETS: { key: Exclude<LayoutPreset, 'custom'>; label: string }[] = [
  { key: 'compact', label: 'Compact' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'spacious', label: 'Spacious' },
];

export function LayoutPresetToggle({ activePreset, onPresetChange }: LayoutPresetToggleProps) {
  return (
    <div
      className="flex gap-[var(--spacing-2xs)] rounded-[var(--radius-lg)] bg-[var(--color-bg-page)] p-[3px]"
      role="radiogroup"
      aria-label="Layout density"
    >
      {PRESETS.map(({ key, label }) => {
        const isActive = activePreset === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onPresetChange(key)}
            className="relative cursor-pointer rounded-[var(--radius-base)] px-[var(--spacing-lg)] py-[var(--spacing-xs)] text-[11px] font-medium transition-colors"
            style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
          >
            {isActive && (
              <motion.span
                layoutId="preset-active-pill"
                className="absolute inset-0 rounded-[var(--radius-base)] bg-[var(--color-bg-card)]"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add preset toggle and reset button to DetailHeader**

In `DetailHeader.tsx`, add new props:
```typescript
import type { LayoutPreset } from '../../hooks/useDashboardLayout';
import { LayoutPresetToggle } from './LayoutPresetToggle';

interface DetailHeaderProps {
  entity: EntityListItem | null;
  activePeriod: Period;
  yearsAvailable: string[];
  onPeriodChange: (period: Period) => void;
  onExport: () => void;
  activePreset: LayoutPreset;
  onPresetChange: (preset: Exclude<LayoutPreset, 'custom'>) => void;
  onResetLayout: () => void;
}
```

In the right-side div (line ~51), add the reset button and preset toggle before the period selector:
```typescript
<div className="ml-[var(--spacing-lg)] flex shrink-0 items-center gap-[var(--spacing-lg)]">
  {/* Reset layout button */}
  <button
    type="button"
    onClick={onResetLayout}
    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-gold-muted)] hover:text-[var(--color-text-secondary)]"
    aria-label="Reset layout to defaults"
    title="Reset layout"
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1.5 2.5v3.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.1 8.5a5 5 0 104.9-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </button>

  <LayoutPresetToggle activePreset={activePreset} onPresetChange={onPresetChange} />

  <PeriodSelector ... />
  <button ... >Export</button>
</div>
```

- [ ] **Step 3: Wire props through RightPanel and DashboardLayout**

In `RightPanel.tsx`, add and pass through the new props:
```typescript
interface RightPanelProps {
  /* ... existing + resize props ... */
  activePreset: LayoutPreset;
  onPresetChange: (preset: Exclude<LayoutPreset, 'custom'>) => void;
  onResetLayout: () => void;
}
```

Pass to DetailHeader:
```typescript
<DetailHeader
  entity={entity} activePeriod={activePeriod} yearsAvailable={yearsAvailable}
  onPeriodChange={onPeriodChange} onExport={onExport}
  activePreset={activePreset} onPresetChange={onPresetChange} onResetLayout={onResetLayout}
/>
```

In `DashboardLayout.tsx`, pass from the hook:
```typescript
<RightPanel
  /* ... existing + resize props ... */
  activePreset={layout.preset}
  onPresetChange={setPreset}
  onResetLayout={reset}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add client/src/components/right-panel/LayoutPresetToggle.tsx client/src/components/right-panel/DetailHeader.tsx client/src/components/right-panel/RightPanel.tsx client/src/layouts/DashboardLayout.tsx
git commit -m "feat: add layout preset toggle (Compact/Balanced/Spacious) and reset button"
```

---

## Task 8: Modal System

**Files:**
- Create: `client/src/components/shared/ModalProvider.tsx`
- Create: `client/src/components/shared/CardModal.tsx`
- Create: `client/src/components/shared/ExpandIcon.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create ModalProvider context**

```typescript
// FILE: client/src/components/shared/ModalProvider.tsx
// PURPOSE: React context for opening/closing card expansion modals
// USED BY: App.tsx (provider), any card component (consumer via useModal)
// EXPORTS: ModalProvider, useModal

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ModalState {
  isOpen: boolean;
  content: ReactNode | null;
  title: string;
}

interface ModalContextValue {
  openModal: (title: string, content: ReactNode) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModalState>({ isOpen: false, content: null, title: '' });

  const openModal = useCallback((title: string, content: ReactNode) => {
    setState({ isOpen: true, content, title });
  }, []);

  const closeModal = useCallback(() => {
    setState({ isOpen: false, content: null, title: '' });
  }, []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      {state.isOpen && <CardModalOverlay title={state.title} onClose={closeModal}>{state.content}</CardModalOverlay>}
    </ModalContext.Provider>
  );
}

/** WHY inline: Keeps ModalProvider self-contained. CardModal is only rendered by the provider. */
function CardModalOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // Imported lazily to avoid circular deps — CardModal is in same shared/ dir
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return <>{children && <CardModalInner title={title} onClose={onClose}>{children}</CardModalInner>}</>;
}

// Placeholder — replaced in Step 2 when CardModal is created
function CardModalInner({ title: _title, onClose: _onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <>{children}</>;
}
```

Actually, this approach creates a circular dependency issue. Let me restructure: ModalProvider handles state, CardModal is a separate component rendered BY the provider.

Let me redo this properly:

```typescript
// FILE: client/src/components/shared/ModalProvider.tsx
// PURPOSE: React context for opening/closing card expansion modals
// USED BY: App.tsx (provider), any card (consumer via useModal), CardModal (renders content)
// EXPORTS: ModalProvider, useModal

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CardModal } from './CardModal';

interface ModalContextValue {
  openModal: (title: string, content: ReactNode) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<{ title: string; content: ReactNode } | null>(null);

  const openModal = useCallback((title: string, content: ReactNode) => {
    setModal({ title, content });
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      <CardModal isOpen={modal !== null} title={modal?.title ?? ''} onClose={closeModal}>
        {modal?.content}
      </CardModal>
    </ModalContext.Provider>
  );
}
```

- [ ] **Step 2: Create CardModal component**

```typescript
// FILE: client/src/components/shared/CardModal.tsx
// PURPOSE: Modal overlay — backdrop blur, centered panel, close on Escape/backdrop, animation
// USED BY: ModalProvider.tsx
// EXPORTS: CardModal

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface CardModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function CardModal({ isOpen, title, onClose, children }: CardModalProps) {
  /** WHY: Escape key closes modal — standard accessibility pattern */
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  /** WHY: Prevent body scroll when modal is open */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-[var(--spacing-4xl)]"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[4px]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 max-h-[85vh] w-[90vw] max-w-[640px] overflow-y-auto rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-4xl)] shadow-[var(--shadow-dropdown)]"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-[var(--spacing-2xl)] top-[var(--spacing-2xl)] flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-base)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-gold-subtle)] hover:text-[var(--color-text-primary)]"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            {/* Title */}
            {title && (
              <h2 className="mb-[var(--spacing-2xl)] text-[14px] font-semibold uppercase tracking-[0.5px] text-[var(--color-text-muted)]">
                {title}
              </h2>
            )}

            {/* Content */}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
```

- [ ] **Step 3: Create ExpandIcon component**

```typescript
// FILE: client/src/components/shared/ExpandIcon.tsx
// PURPOSE: Tiny expand icon that fades in on card hover — signals click-to-expand
// USED BY: KPICard.tsx, HeroRevenueCard.tsx, ChartsRow.tsx
// EXPORTS: ExpandIcon

export function ExpandIcon() {
  return (
    <div className="absolute right-[var(--spacing-md)] top-[var(--spacing-md)] flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-gold-subtle)] text-[var(--color-text-faint)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M1 9L9 1M9 1H4M9 1v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Add ModalProvider to App.tsx**

In `App.tsx`, add import and wrap:
```typescript
import { ModalProvider } from './components/shared/ModalProvider';
```

Insert ModalProvider inside the provider stack, after CopyToastProvider:
```typescript
<CopyToastProvider>
  <ModalProvider>
    <DashboardApp />
  </ModalProvider>
</CopyToastProvider>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add client/src/components/shared/ModalProvider.tsx client/src/components/shared/CardModal.tsx client/src/components/shared/ExpandIcon.tsx client/src/App.tsx
git commit -m "feat: add modal system — ModalProvider, CardModal, ExpandIcon"
```

---

## Task 9: KPI + Hero Card Modal Content

**Files:**
- Modify: `client/src/components/right-panel/KPICard.tsx`
- Modify: `client/src/components/right-panel/HeroRevenueCard.tsx`
- Modify: `client/src/components/right-panel/KPISection.tsx`

- [ ] **Step 1: Make KPICard clickable and define expanded content**

In `KPICard.tsx`, add imports:
```typescript
import { ExpandIcon } from '../shared/ExpandIcon';
```

Add `onExpand` callback prop:
```typescript
interface KPICardProps {
  /* ... existing props ... */
  onExpand?: () => void;
}
```

Wrap the outer div with group class and click handler:
```typescript
<div
  className="group relative cursor-pointer flex flex-col justify-between rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] px-[var(--spacing-lg)] py-[var(--spacing-sm)] shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
  onClick={onExpand}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === 'Enter' && onExpand) onExpand(); }}
  aria-label={`Expand ${label} details`}
>
  <ExpandIcon />
  {/* ... rest of card content unchanged ... */}
</div>
```

WHY `group` replaces `group/kpi`: The expand icon uses `group-hover:opacity-100`. The existing `group-hover/kpi:opacity-100` on the period label and trend text needs to be updated to `group-hover:opacity-100` as well (lines ~47 and ~58).

- [ ] **Step 2: Wire KPICard onExpand in KPISection**

In `KPISection.tsx`, import `useModal`:
```typescript
import { useModal } from '../shared/ModalProvider';
```

Inside the component:
```typescript
const { openModal } = useModal();
```

Create a helper to build expanded KPI content:
```typescript
function KPIModalContent({ label, value, changePercent, subItems, prevYearValue, prevYearFullValue, prevYearLabel, prevYearFullLabel }: {
  label: string; value: string; changePercent?: number | null;
  subItems?: KPISubItem[]; prevYearValue?: string; prevYearFullValue?: string;
  prevYearLabel?: string; prevYearFullLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      <div>
        <span className="tabular-nums text-[30px] font-bold text-[var(--color-text-primary)]">{value}</span>
        {changePercent != null && (
          <span className="ml-[var(--spacing-md)] text-[14px] font-medium" style={{ color: changePercent >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}% vs same period last year
          </span>
        )}
      </div>
      {prevYearValue && (
        <div className="flex gap-[var(--spacing-4xl)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
          <div className="flex flex-col">
            <span className="text-[11px] text-[var(--color-text-muted)]">{prevYearLabel}</span>
            <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">{prevYearValue}</span>
          </div>
          {prevYearFullValue && (
            <div className="flex flex-col">
              <span className="text-[11px] text-[var(--color-text-muted)]">{prevYearFullLabel}</span>
              <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">{prevYearFullValue}</span>
            </div>
          )}
        </div>
      )}
      {subItems && subItems.length > 0 && (
        <div className="flex gap-[var(--spacing-4xl)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
          {subItems.map((item) => (
            <div key={item.label} className="flex flex-col">
              <span className="text-[11px] text-[var(--color-text-muted)]">{item.label}</span>
              <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">
                {item.value}
                {item.suffix && <span className="ml-1 text-[11px] font-normal text-[var(--color-text-muted)]">({item.suffix})</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

WHY separate function: Keeps KPISection under 200 lines. This function is defined outside the component (pure, no hooks).

Then for each `<KPICard>` instance, add the `onExpand` prop. Example for Orders (repeat pattern for all 5 KPI cards that have sub-items):
```typescript
<KPICard
  /* ... existing props ... */
  onExpand={() => openModal('Orders', (
    <KPIModalContent
      label="Orders" value={Math.round(kpis.orders).toLocaleString('en-US')}
      changePercent={yoyChange(kpis.orders, ob.prevYear)}
      prevYearValue={Math.round(ob.prevYear).toLocaleString('en-US')}
      prevYearFullValue={Math.round(ob.prevYearFull).toLocaleString('en-US')}
      prevYearLabel={pyLabel} prevYearFullLabel={pyFullLabel}
      subItems={[
        { label: 'This Quarter', value: Math.round(ob.thisQuarter).toLocaleString('en-US') },
        { label: 'Last Month', value: Math.round(ob.lastMonth).toLocaleString('en-US'), suffix: ob.lastMonthName },
        { label: 'Best Month', value: Math.round(ob.bestMonth.value).toLocaleString('en-US'), suffix: ob.bestMonth.name },
      ]}
    />
  ))}
/>
```

Do the same for Avg Order, Margin %, Margin $, Frequency. Last Order card gets a simpler modal without sub-items.

- [ ] **Step 3: Make HeroRevenueCard clickable with expanded modal**

In `HeroRevenueCard.tsx`, add imports:
```typescript
import { ExpandIcon } from '../shared/ExpandIcon';
```

Add `onExpand` prop:
```typescript
interface HeroRevenueCardProps {
  /* ... existing props ... */
  onExpand?: () => void;
}
```

Add `group` class, click handler, and expand icon to the outer div:
```typescript
<div
  className="group relative cursor-pointer flex h-full flex-col justify-between rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]"
  onClick={onExpand}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === 'Enter' && onExpand) onExpand(); }}
  aria-label="Expand revenue details"
>
  <ExpandIcon />
  {/* ... rest unchanged ... */}
</div>
```

Update existing `group-hover/hero:opacity-100` references to `group-hover:opacity-100`.

Wire the onExpand in KPISection:
```typescript
<HeroRevenueCard
  kpis={kpis} monthlyRevenue={monthlyRevenue} activePeriod={activePeriod} showDetails={showDetails}
  onExpand={() => openModal('Total Revenue', (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      <div className="flex items-end justify-between">
        <span className="tabular-nums text-[36px] font-[800] leading-tight tracking-[-1px] text-[var(--color-text-primary)]">
          {formatCurrency(Math.round(kpis.totalRevenue))}
        </span>
        {kpis.revenueChangePercent !== null && (
          <span className="text-[14px] font-medium" style={{ color: kpis.revenueChangePercent >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
            {formatPercent(kpis.revenueChangePercent, { showSign: true })} vs last year
          </span>
        )}
      </div>
      <div className="h-[300px]">
        <YoYBarChart data={monthlyRevenue} height={300} />
      </div>
      <div className="flex gap-[var(--spacing-4xl)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
        <div className="flex flex-col">
          <span className="text-[11px] text-[var(--color-text-muted)]">This Quarter</span>
          <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">{formatCurrency(kpis.thisQuarterRevenue)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-[var(--color-text-muted)]">Last Month</span>
          <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">{formatCurrency(kpis.lastMonthRevenue)} <span className="text-[11px] text-[var(--color-text-muted)]">({kpis.lastMonthName})</span></span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-[var(--color-text-muted)]">Best Month</span>
          <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">{formatCurrency(kpis.bestMonth.amount)} <span className="text-[11px] text-[var(--color-text-muted)]">({kpis.bestMonth.name})</span></span>
        </div>
      </div>
    </div>
  ))}
/>
```

NOTE: If KPISection exceeds 200 lines with all the modal content wiring, extract the modal content builders into a separate file: `client/src/components/right-panel/kpi-modal-content.tsx` (~80 lines).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add client/src/components/right-panel/KPICard.tsx client/src/components/right-panel/HeroRevenueCard.tsx client/src/components/right-panel/KPISection.tsx
git commit -m "feat: click-to-expand modals for KPI cards and hero revenue card"
```

---

## Task 10: Charts Row Modal Content

**Files:**
- Modify: `client/src/components/right-panel/ChartsRow.tsx`
- Modify: `client/src/components/right-panel/ProductMixCarousel.tsx`
- Modify: `client/src/components/right-panel/BestSellers.tsx`

- [ ] **Step 1: Add expanded content export to ProductMixCarousel**

In `ProductMixCarousel.tsx`, export a new function for modal content. Add at the bottom of the file:

```typescript
/** WHY: Separate export for modal — shows larger donut with full legend, no carousel needed */
export function ProductMixExpanded({ mixes }: ProductMixCarouselProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const types = PRODUCT_MIX_ORDER;
  const activeType = types[activeIdx];
  const segments = mixes[activeType] ?? [];

  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      {/* Type selector tabs */}
      <div className="flex gap-[var(--spacing-md)]">
        {types.map((type, i) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveIdx(i)}
            className={`cursor-pointer rounded-[var(--radius-base)] px-[var(--spacing-lg)] py-[var(--spacing-xs)] text-[12px] font-medium transition-colors ${
              i === activeIdx
                ? 'bg-[var(--color-dark)] text-white'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-gold-subtle)]'
            }`}
          >
            {PRODUCT_MIX_LABELS[type]}
          </button>
        ))}
      </div>
      {/* Donut at larger size + full legend */}
      <div className="flex items-center gap-[var(--spacing-4xl)]">
        <DonutChart segments={segments} size={220} />
        <div className="flex flex-col gap-[var(--spacing-md)]">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-[var(--spacing-md)]">
              <div className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: seg.color }} />
              <span className="text-[13px] text-[var(--color-text-primary)]">{seg.label}</span>
              <span className="ml-auto text-[13px] font-semibold tabular-nums text-[var(--color-text-secondary)]">{seg.percent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

NOTE: This requires `DonutChart` and `PRODUCT_MIX_ORDER`/`PRODUCT_MIX_LABELS` to be accessible. Check if DonutChart is a local sub-component or imported. If it's local to ProductMixCarousel, extract it to be reusable or inline the SVG in the expanded view. Adapt as needed based on the actual DonutChart implementation.

- [ ] **Step 2: Add expanded content export to BestSellers**

In `BestSellers.tsx`, export a new function:

```typescript
/** WHY: Modal shows full unpaginated list — up to 20 items in single column for easy scanning */
export function BestSellersExpanded({ data }: BestSellersProps) {
  const items = data.slice(0, 20);
  return (
    <div className="flex flex-col gap-[var(--spacing-xs)]">
      {items.map((item, i) => (
        <div
          key={item.sku}
          className="flex items-center gap-[var(--spacing-md)] border-b border-[#f5f1eb] py-[var(--spacing-md)]"
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)] text-[11px] font-bold ${
              i < 3
                ? 'bg-[var(--color-gold-primary)] text-white'
                : 'bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)]'
            }`}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{item.name}</div>
            <div className="text-[10px] text-[var(--color-text-faint)]">{item.sku}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[13px] font-semibold tabular-nums text-[var(--color-text-primary)]">{item.revenueFormatted}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{item.units} units</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

NOTE: Adapt `item.revenueFormatted` and `item.units` to match the actual `TopSellerItem` type fields. Check `shared/types/dashboard.ts` for the exact field names and adjust.

- [ ] **Step 3: Wire click-to-expand in ChartsRow**

In `ChartsRow.tsx`, add imports:
```typescript
import { useModal } from '../shared/ModalProvider';
import { ExpandIcon } from '../shared/ExpandIcon';
import { ProductMixExpanded } from './ProductMixCarousel';
import { BestSellersExpanded } from './BestSellers';
```

Add modal hook:
```typescript
const { openModal } = useModal();
```

Wrap each card div with click handler and expand icon:
```typescript
<div
  className="group relative flex cursor-pointer flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
  onClick={() => openModal('Product Mix', <ProductMixExpanded mixes={productMixes} />)}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === 'Enter') openModal('Product Mix', <ProductMixExpanded mixes={productMixes} />); }}
>
  <ExpandIcon />
  <ProductMixCarousel mixes={productMixes} />
</div>
```

Same pattern for Best Sellers card:
```typescript
onClick={() => openModal('Best Sellers', <BestSellersExpanded data={topSellers} />)}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add client/src/components/right-panel/ChartsRow.tsx client/src/components/right-panel/ProductMixCarousel.tsx client/src/components/right-panel/BestSellers.tsx
git commit -m "feat: click-to-expand modals for Product Mix and Best Sellers cards"
```

---

## Task 11: Hover Peek System

**Files:**
- Create: `client/src/hooks/useHoverPeek.ts`
- Create: `client/src/components/shared/HoverPeek.tsx`
- Modify: `client/src/components/right-panel/KPICard.tsx`
- Modify: `client/src/components/right-panel/HeroRevenueCard.tsx`
- Modify: `client/src/components/right-panel/ChartsRow.tsx`

- [ ] **Step 1: Create useHoverPeek hook**

```typescript
// FILE: client/src/hooks/useHoverPeek.ts
// PURPOSE: Hover delay timer + floating panel positioning for card peek previews
// USED BY: KPICard, HeroRevenueCard, ChartsRow cards
// EXPORTS: useHoverPeek

import { useState, useCallback, useRef, useEffect } from 'react';

interface PeekPosition {
  top: number;
  left: number;
  arrowSide: 'left' | 'right' | 'top';
}

interface UseHoverPeekReturn {
  isVisible: boolean;
  position: PeekPosition | null;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  /** WHY: Call on peek panel mouse enter/leave to keep peek open when cursor moves to it */
  onPeekMouseEnter: () => void;
  onPeekMouseLeave: () => void;
}

const PEEK_DELAY = 400;
const PEEK_WIDTH = 320;
const PEEK_MARGIN = 12;

export function useHoverPeek(): UseHoverPeekReturn {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<PeekPosition | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOverRef = useRef({ trigger: false, peek: false });

  const calculatePosition = useCallback((): PeekPosition | null => {
    const el = triggerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;

    /** WHY: Prefer right side, fall back to left, fall back to below */
    if (rect.right + PEEK_MARGIN + PEEK_WIDTH < vw) {
      return { top: rect.top, left: rect.right + PEEK_MARGIN, arrowSide: 'left' };
    } else if (rect.left - PEEK_MARGIN - PEEK_WIDTH > 0) {
      return { top: rect.top, left: rect.left - PEEK_MARGIN - PEEK_WIDTH, arrowSide: 'right' };
    }
    return { top: rect.bottom + PEEK_MARGIN, left: rect.left, arrowSide: 'top' };
  }, []);

  const startClose = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (!isOverRef.current.trigger && !isOverRef.current.peek) {
        setIsVisible(false);
      }
    }, 150);
  }, []);

  const onMouseEnter = useCallback(() => {
    isOverRef.current.trigger = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setPosition(calculatePosition());
      setIsVisible(true);
    }, PEEK_DELAY);
  }, [calculatePosition]);

  const onMouseLeave = useCallback(() => {
    isOverRef.current.trigger = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    startClose();
  }, [startClose]);

  const onPeekMouseEnter = useCallback(() => {
    isOverRef.current.peek = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const onPeekMouseLeave = useCallback(() => {
    isOverRef.current.peek = false;
    startClose();
  }, [startClose]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return { isVisible, position, triggerRef, onMouseEnter, onMouseLeave, onPeekMouseEnter, onPeekMouseLeave };
}
```

- [ ] **Step 2: Create HoverPeek component**

```typescript
// FILE: client/src/components/shared/HoverPeek.tsx
// PURPOSE: Floating preview panel with arrow, rendered via portal
// USED BY: KPICard, HeroRevenueCard, ChartsRow cards
// EXPORTS: HoverPeek

import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface HoverPeekProps {
  isVisible: boolean;
  position: { top: number; left: number; arrowSide: 'left' | 'right' | 'top' } | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  children: ReactNode;
}

export function HoverPeek({ isVisible, position, onMouseEnter, onMouseLeave, children }: HoverPeekProps) {
  return createPortal(
    <AnimatePresence>
      {isVisible && position && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="fixed z-50 w-[320px] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-dropdown)]"
          style={{ top: position.top, left: position.left }}
        >
          {/* Arrow indicator */}
          {position.arrowSide === 'left' && (
            <div
              className="absolute -left-[6px] top-[20px] h-3 w-3 rotate-45 bg-[var(--color-bg-card)]"
              style={{ boxShadow: '-2px 2px 4px rgba(0,0,0,0.06)' }}
            />
          )}
          {position.arrowSide === 'right' && (
            <div
              className="absolute -right-[6px] top-[20px] h-3 w-3 rotate-45 bg-[var(--color-bg-card)]"
              style={{ boxShadow: '2px -2px 4px rgba(0,0,0,0.06)' }}
            />
          )}
          {position.arrowSide === 'top' && (
            <div
              className="absolute -top-[6px] left-[20px] h-3 w-3 rotate-45 bg-[var(--color-bg-card)]"
              style={{ boxShadow: '-2px -2px 4px rgba(0,0,0,0.06)' }}
            />
          )}
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
```

- [ ] **Step 3: Integrate hover peek on KPICard**

In `KPICard.tsx`, add imports:
```typescript
import { useHoverPeek } from '../../hooks/useHoverPeek';
import { HoverPeek } from '../shared/HoverPeek';
```

Inside the component:
```typescript
const peek = useHoverPeek();
```

Wrap the outer div with the ref and hover handlers. The existing `onClick` opens the modal, the hover handlers control the peek:
```typescript
<div
  ref={peek.triggerRef}
  onMouseEnter={peek.onMouseEnter}
  onMouseLeave={peek.onMouseLeave}
  className="group relative cursor-pointer ..."
  onClick={() => { peek.onMouseLeave(); onExpand?.(); }}
  /* ... rest of props ... */
>
  <ExpandIcon />
  {/* ... card content ... */}
</div>

{/* Peek: shows card content at comfortable size with sub-items always visible */}
<HoverPeek isVisible={peek.isVisible} position={peek.position} onMouseEnter={peek.onPeekMouseEnter} onMouseLeave={peek.onPeekMouseLeave}>
  <div className="flex flex-col gap-[var(--spacing-lg)]">
    <span className="text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-muted)]">{label} {periodLabel}</span>
    <span className="tabular-nums text-[22px] font-bold text-[var(--color-text-primary)]">{formatter(value)}</span>
    {changePercent != null && (
      <span className="text-[12px] font-medium" style={{ color: changePercent >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
        {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}% vs same period last year
      </span>
    )}
    {hasSubItems && (
      <div className="flex gap-[var(--spacing-lg)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
        {subItems!.map((item) => (
          <div key={item.label} className="flex flex-col">
            <span className="text-[10px] text-[var(--color-text-muted)]">{item.label}</span>
            <span className="text-[14px] font-semibold text-[var(--color-text-secondary)]">{item.value}{item.suffix && <span className="ml-0.5 text-[10px] text-[var(--color-text-muted)]">({item.suffix})</span>}</span>
          </div>
        ))}
      </div>
    )}
  </div>
</HoverPeek>
```

WHY `onClick` calls `peek.onMouseLeave()` first: Dismisses the peek before opening the modal — prevents both being visible simultaneously.

- [ ] **Step 4: Integrate hover peek on HeroRevenueCard and ChartsRow cards**

Apply the same pattern:
- `HeroRevenueCard.tsx`: Peek shows revenue value + trend + sub-items at comfortable size (no chart in peek — that's for the modal)
- `ChartsRow.tsx`: Wrap each card div with `useHoverPeek`. Peek for Product Mix shows current donut at small size + segment list. Peek for Best Sellers shows top 5 items.

For ChartsRow, since each card needs its own peek instance, call the hook twice:
```typescript
const mixPeek = useHoverPeek();
const sellersPeek = useHoverPeek();
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 6: Check file sizes — split if any exceed 200 lines**

Run: `wc -l client/src/components/right-panel/KPICard.tsx client/src/components/right-panel/KPISection.tsx`

If KPICard exceeds 200 lines (likely with peek content), extract the peek content JSX into a `KPICardPeekContent` function in the same file or a separate `kpi-peek-content.tsx`.

If KPISection exceeds 200 lines (likely with modal content builders), extract `KPIModalContent` into `client/src/components/right-panel/kpi-modal-content.tsx`.

- [ ] **Step 7: Commit**

```bash
git add client/src/hooks/useHoverPeek.ts client/src/components/shared/HoverPeek.tsx client/src/components/right-panel/KPICard.tsx client/src/components/right-panel/HeroRevenueCard.tsx client/src/components/right-panel/ChartsRow.tsx
git commit -m "feat: hover peek on all cards — 400ms delay floating preview panel"
```

---

## Task 12: Responsive Defaults + Final Wiring

**Files:**
- Modify: `client/src/hooks/useDashboardLayout.ts` (add responsive padding logic)
- Modify: `client/src/styles/index.css` (add responsive CSS custom properties)
- Modify: `client/src/layouts/DashboardLayout.tsx` (final integration pass)

- [ ] **Step 1: Add responsive CSS custom property overrides**

In `client/src/styles/index.css`, add at the end of the file (after existing `@theme` block and global styles):

```css
/* WHY: Responsive spacing overrides for 13" vs 27" screens */
@media (max-width: 1279px) {
  :root {
    --spacing-card-px: var(--spacing-md);
    --spacing-card-gap: var(--spacing-md);
  }
}
@media (min-width: 1280px) and (max-width: 1599px) {
  :root {
    --spacing-card-px: var(--spacing-lg);
    --spacing-card-gap: var(--spacing-lg);
  }
}
@media (min-width: 1600px) {
  :root {
    --spacing-card-px: var(--spacing-xl);
    --spacing-card-gap: var(--spacing-lg);
  }
}
```

These are consumed by card components that need responsive padding. Cards that currently hardcode `px-[var(--spacing-lg)]` can optionally switch to `px-[var(--spacing-card-px)]` for viewport-aware sizing. This is an optional polish step — cards will work fine with their current fixed padding.

- [ ] **Step 2: Ensure DashboardLayout passes all layout props correctly**

Final integration check in `DashboardLayout.tsx`. The component should now:

1. Call `useDashboardLayout()` and destructure all values
2. Pass `layout.preset`, `setPreset`, `reset` to RightPanel → DetailHeader
3. Pass `heroKpiTemplate`, `layout.heroKpiRatio`, `setHeroKpiRatio` to RightPanel → KPISection
4. Pass `layout.kpiChartsRatio`, `setKpiChartsRatio` to RightPanel (vertical resize)
5. Conditionally render `CollapsedPanel` vs full `LeftPanel` based on `layout.panelCollapsed`
6. Register `[` keyboard shortcut for panel toggle

Verify by reading through the component and confirming every layout value flows end-to-end.

- [ ] **Step 3: Full verification**

Run all checks:
```bash
cd client && npx tsc -b --noEmit   # TypeScript
cd ../server && npx tsc --noEmit   # Server TypeScript
cd ../server && npx vitest run     # Server tests
cd ../client && npx vite build     # Client bundle
```

All must pass. Check bundle size is still under 500KB gzip.

Also run the code quality checks from CLAUDE.md:
```bash
grep -rn ": any\|as any" client/src/   # Should find zero
wc -l client/src/components/right-panel/*.tsx client/src/components/shared/*.tsx client/src/hooks/*.ts  # All under 200 lines
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: responsive defaults, viewport-aware spacing, final layout wiring"
```

---

## Task 13: Keyboard Navigation Between Cards

**Files:**
- Create: `client/src/hooks/useCardNavigation.ts`
- Modify: `client/src/components/right-panel/KPISection.tsx`

Inspired by Grok code review — low-effort, high accessibility value.

- [ ] **Step 1: Create useCardNavigation hook**

```typescript
// FILE: client/src/hooks/useCardNavigation.ts
// PURPOSE: Arrow key navigation between KPI card grid cells
// USED BY: KPISection.tsx
// EXPORTS: useCardNavigation

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * WHY: KPI section has a 2-column grid (hero occupies left column, 6 cards in right 2x3 grid).
 * Navigation order: Hero(0) → Orders(1) → AvgOrder(2) → Margin%(3) → Margin$(4) → Frequency(5) → LastOrder(6)
 * Arrow keys move through this flat index. Enter opens modal, Space triggers peek.
 */
export function useCardNavigation(cardCount: number) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const setCardRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    cardRefs.current[index] = el;
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (focusedIndex === null) return;
    /** WHY: Don't capture keys when user is typing in search/filter inputs */
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    let next = focusedIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      next = Math.min(focusedIndex + 1, cardCount - 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      next = Math.max(focusedIndex - 1, 0);
    }

    if (next !== focusedIndex) {
      setFocusedIndex(next);
      cardRefs.current[next]?.focus();
    }
  }, [focusedIndex, cardCount]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const onCardFocus = useCallback((index: number) => () => setFocusedIndex(index), []);
  const onCardBlur = useCallback(() => setFocusedIndex(null), []);

  return { focusedIndex, setCardRef, onCardFocus, onCardBlur };
}
```

- [ ] **Step 2: Integrate into KPISection**

In `KPISection.tsx`, add:
```typescript
import { useCardNavigation } from '../../hooks/useCardNavigation';
```

Inside the component:
```typescript
const { setCardRef, onCardFocus, onCardBlur } = useCardNavigation(7);
```

Add `role="grid"` to the KPI section container, and pass `ref={setCardRef(i)}`, `onFocus={onCardFocus(i)}`, `onBlur={onCardBlur}`, `role="gridcell"` to each card wrapper. The hero card is index 0, then Orders=1, AvgOrder=2, etc.

Each card already has `tabIndex={0}` from Task 9. The `onKeyDown` for Enter (modal) is also already wired. Add Space for peek:
```typescript
onKeyDown={(e) => {
  if (e.key === 'Enter' && onExpand) onExpand();
  // Space triggers peek (if useHoverPeek is available)
  if (e.key === ' ') { e.preventDefault(); /* trigger peek programmatically */ }
}}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useCardNavigation.ts client/src/components/right-panel/KPISection.tsx
git commit -m "feat: keyboard navigation between KPI cards — arrow keys, Enter, Space"
```

---

## Post-Implementation Verification

After all 13 tasks are complete, verify the full feature set:

1. **Start dev servers:** `cd server && npm run dev` and `cd client && npm run dev`
2. **Open in browser at two widths:**
   - 1280px wide (simulating 13" screen)
   - 1920px wide (simulating 27" screen)
3. **Test each feature:**
   - [ ] Left panel collapses/expands (click button and `[` key)
   - [ ] Preset toggle switches between Compact/Balanced/Spacious
   - [ ] Horizontal resize handle between hero and KPI cards works
   - [ ] Vertical resize handle between KPI section and charts works
   - [ ] Reset button restores default layout
   - [ ] Hover over any KPI card → peek appears after 400ms
   - [ ] Click any card → modal opens with enlarged content
   - [ ] Escape closes modal, backdrop click closes modal
   - [ ] Chart height adapts when resizing sections
   - [ ] Refresh page → layout preferences persisted
   - [ ] Text sizes match original (pre-94e4028) compact values
   - [ ] Arrow keys navigate focus between KPI cards, Enter opens modal
   - [ ] Hero card modal chart retains hover tooltips (existing interactivity preserved)
4. **Test in Airtable iframe:** Open the Airtable page and verify the dashboard works correctly inside the Omni embed
