# Layout Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the resize/preset system, restore fixed right-panel layout, move panel collapse to URL state, and remove entity list cascade animation.

**Architecture:** Surgical removal — keep current files, delete 4 resize/preset files, simplify existing components in place. Panel collapse moves from localStorage to URL-backed shell state. Entity list items switch from motion.div to plain div for instant search results.

**Tech Stack:** React 19, TypeScript strict, Vitest, Framer Motion (retained for modals/sub-items only)

---

## File Map

**Delete (4 files, ~305 lines):**
- `client/src/hooks/useResizablePanel.ts` — drag resize logic
- `client/src/hooks/useDashboardLayout.ts` — preset state + localStorage
- `client/src/components/right-panel/LayoutPresetToggle.tsx` — Compact/Balanced/Spacious toggle
- `client/src/components/right-panel/ResizeDivider.tsx` — visual resize handle

**Modify (12 files):**
- `client/src/hooks/shell-state-url.ts` — add `panelCollapsed` to state
- `client/src/hooks/__tests__/shell-state-url.test.ts` — add collapsed tests
- `client/src/hooks/useDashboardShellState.ts` — add `togglePanel` callback
- `client/src/hooks/useDashboardState.ts` — pass through panel props
- `client/src/layouts/dashboard-layout-types.ts` — update props interface
- `client/src/layouts/DashboardLayout.tsx` — remove layout hook, use panel props
- `client/src/components/right-panel/RightPanel.tsx` — fixed vertical stack
- `client/src/components/right-panel/KPISection.tsx` — fixed grid, no resize
- `client/src/components/right-panel/DetailHeader.tsx` — remove preset controls
- `client/src/components/right-panel/HeroRevenueCard.tsx` — fixed chart height
- `client/src/components/left-panel/EntityListItem.tsx` — remove motion animation
- `client/src/components/left-panel/EntityList.tsx` — remove stagger logic

---

### Task 1: Add panelCollapsed to URL state + tests

**Files:**
- Modify: `client/src/hooks/shell-state-url.ts`
- Modify: `client/src/hooks/__tests__/shell-state-url.test.ts`
- Modify: `client/src/hooks/useDashboardShellState.ts`

- [ ] **Step 1: Write failing tests for panelCollapsed**

Add these tests to `client/src/hooks/__tests__/shell-state-url.test.ts`.

In the `parseSearchParams` describe block, add after the last `it`:

```typescript
  it('parses collapsed=1 as true', () => {
    expect(parseSearchParams(new URLSearchParams('collapsed=1')).panelCollapsed).toBe(true);
  });
  it('defaults panelCollapsed to false when param missing', () => {
    expect(parseSearchParams(new URLSearchParams('')).panelCollapsed).toBe(false);
  });
```

In the `buildSearch` describe block, add after the last `it`:

```typescript
  it('includes collapsed=1 when panelCollapsed is true', () => {
    expect(buildSearch({ ...DEFAULT_STATE, panelCollapsed: true })).toBe('collapsed=1');
  });
  it('omits collapsed when panelCollapsed is false', () => {
    expect(buildSearch({ ...DEFAULT_STATE, panelCollapsed: false })).toBe('');
  });
```

Update the existing round-trip test `'preserves valid URLs'` to include collapsed:

```typescript
  it('preserves valid URLs', () => {
    const original = 'dim=vendor&period=2024&entity=C7826&tab=items&q=acme&sort=revenue&dir=desc&collapsed=1';
    const state = parseSearchParams(new URLSearchParams(original));
    const rebuilt = buildSearch(state);
    expect(parseSearchParams(new URLSearchParams(rebuilt))).toEqual(state);
  });
```

Update the existing `parseSearchParams` test `'parses full valid URL'` to include collapsed:

```typescript
  it('parses full valid URL', () => {
    const state = parseSearchParams(new URLSearchParams('dim=zone&period=2023&entity=Z100&tab=contacts&q=west&sort=orders&dir=desc&collapsed=1'));
    expect(state).toEqual({
      activeDimension: 'zone', activePeriod: '2023', activeEntityId: 'Z100',
      activeTab: 'contacts', searchTerm: 'west', sortField: 'orders', sortDirection: 'desc',
      panelCollapsed: true,
    });
  });
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd client && npx vitest run src/hooks/__tests__/shell-state-url.test.ts`

Expected: TypeScript errors — `panelCollapsed` does not exist on `DashboardShellState`.

- [ ] **Step 3: Add panelCollapsed to shell-state-url.ts**

In `client/src/hooks/shell-state-url.ts`:

Add `panelCollapsed: boolean;` to the `DashboardShellState` interface (after `sortDirection`):

```typescript
export interface DashboardShellState {
  activeDimension: Dimension;
  activePeriod: Period;
  activeEntityId: string | null;
  activeTab: DetailTab;
  searchTerm: string;
  sortField: SortField;
  sortDirection: SortDirection;
  panelCollapsed: boolean;
}
```

Add `panelCollapsed: false,` to `DEFAULT_STATE` (after `sortDirection`):

```typescript
export const DEFAULT_STATE: DashboardShellState = {
  activeDimension: 'customer',
  activePeriod: 'ytd',
  activeEntityId: null,
  activeTab: 'orders',
  searchTerm: '',
  sortField: 'id',
  sortDirection: 'asc',
  panelCollapsed: false,
};
```

In `parseSearchParams`, read the `collapsed` param and add it to the return object. Add this line after `const dir = params.get('dir');`:

```typescript
  const collapsed = params.get('collapsed');
```

Add `panelCollapsed: collapsed === '1',` as the last property in the return object (after `sortDirection`).

In `buildSearch`, add this line after the sort block (before `return params.toString()`):

```typescript
  if (state.panelCollapsed) params.set('collapsed', '1');
```

- [ ] **Step 4: Run tests — expect all pass**

Run: `cd client && npx vitest run src/hooks/__tests__/shell-state-url.test.ts`

Expected: 24 tests pass (20 existing + 4 new).

- [ ] **Step 5: Add togglePanel to useDashboardShellState.ts**

In `client/src/hooks/useDashboardShellState.ts`, add a `togglePanel` callback after `resetSort`:

```typescript
  const togglePanel = useCallback(() => {
    updateState((prev) => ({ ...prev, panelCollapsed: !prev.panelCollapsed }), 'replace');
  }, [updateState]);
```

Add `togglePanel` to the return object:

```typescript
  return {
    ...state,
    switchDimension,
    switchPeriod,
    setActiveEntityId,
    setActiveTab,
    setSearchTerm,
    resetSearch,
    setSort,
    resetSort,
    togglePanel,
  };
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`

Expected: PASS (panelCollapsed is additive, no existing code breaks).

- [ ] **Step 7: Commit**

```bash
git add client/src/hooks/shell-state-url.ts client/src/hooks/__tests__/shell-state-url.test.ts client/src/hooks/useDashboardShellState.ts
git commit -m "feat: add panelCollapsed to URL-backed shell state"
```

---

### Task 2: Remove resize system + simplify components + wire panel collapse

This is one atomic task because removing resize props from component interfaces, updating DashboardLayout to use shell state for collapse, and updating the props threading must all happen together for TypeScript to compile.

**Files:**
- Modify: `client/src/components/right-panel/RightPanel.tsx`
- Modify: `client/src/components/right-panel/KPISection.tsx`
- Modify: `client/src/components/right-panel/DetailHeader.tsx`
- Modify: `client/src/components/right-panel/HeroRevenueCard.tsx`
- Modify: `client/src/layouts/dashboard-layout-types.ts`
- Modify: `client/src/layouts/DashboardLayout.tsx`
- Modify: `client/src/hooks/useDashboardState.ts`

- [ ] **Step 1: Rewrite RightPanel.tsx**

Replace the entire content of `client/src/components/right-panel/RightPanel.tsx` with:

```typescript
// FILE: client/src/components/right-panel/RightPanel.tsx
// PURPOSE: Right panel container — header, KPIs, charts, tabs with real data
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: RightPanel

import type {
  EntityListItem, KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType,
  TopSellerItem, SparklineData, OrderRow, FlatItem, Contact, Period,
} from '@shared/types/dashboard';
import type { DetailTab } from './detail-tab-types';
import { DetailHeader } from './DetailHeader';
import { KPISection } from './KPISection';
import { ChartsRow } from './ChartsRow';
import { TabsSection } from './TabsSection';

interface RightPanelProps {
  entity: EntityListItem | null;
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: FlatItem[];
  contacts: Contact[];
  yearsAvailable: string[];
  activePeriod: Period;
  activeTab: DetailTab;
  onPeriodChange: (period: Period) => void;
  onTabChange: (tab: DetailTab) => void;
  onExport: () => void;
}

export function RightPanel({
  entity, kpis, monthlyRevenue, productMixes, topSellers,
  sparklines, orders, items, contacts, yearsAvailable, activePeriod, activeTab,
  onPeriodChange, onTabChange, onExport,
}: RightPanelProps) {
  return (
    <>
      <DetailHeader
        entity={entity} activePeriod={activePeriod} yearsAvailable={yearsAvailable}
        onPeriodChange={onPeriodChange} onExport={onExport}
      />
      <section aria-label="KPI summary">
        <KPISection
          kpis={kpis} monthlyRevenue={monthlyRevenue} sparklines={sparklines}
          activePeriod={activePeriod}
        />
      </section>
      <section aria-label="Charts">
        <ChartsRow productMixes={productMixes} topSellers={topSellers} />
      </section>
      <TabsSection activeTab={activeTab} onTabChange={onTabChange} orders={orders} items={items} contacts={contacts} />
    </>
  );
}
```

- [ ] **Step 2: Simplify KPISection.tsx**

In `client/src/components/right-panel/KPISection.tsx`, make these changes:

Remove these two imports (lines 18-19):
```typescript
import { useResizablePanel } from '../../hooks/useResizablePanel';
import { ResizeDivider } from './ResizeDivider';
```

Replace the `KPISectionProps` interface (lines 24-33) with:

```typescript
interface KPISectionProps {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  sparklines: Record<string, SparklineData>;
  activePeriod: Period;
}
```

Replace the function signature and the hook calls at the top of the component (lines 139-155) with:

```typescript
export function KPISection({
  kpis,
  monthlyRevenue,
  sparklines: _sparklines,
  activePeriod,
}: KPISectionProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { openModal } = useModal();
  const { setCardRef, onCardFocus, onCardBlur } = useCardNavigation(7);
  const activity = getActivityStatus(kpis.lastOrderDays);
  const pLabel = activePeriod === 'ytd' ? '(YTD)' : `(${activePeriod})`;
  const prevYr = activePeriod === 'ytd' ? new Date().getFullYear() - 1 : parseInt(activePeriod, 10) - 1;
  const pyLabel = activePeriod === 'ytd' ? `YTD ${prevYr}` : `${prevYr}`;
  const pyFullLabel = `Full ${prevYr}`;
```

Replace the grid container div (line 166) with:

```typescript
      <div className="grid grid-cols-[3fr_2fr] gap-[var(--spacing-sm)] max-lg:grid-cols-1 max-lg:gap-[var(--spacing-base)]">
```

Remove the `ref={containerRef}` attribute from this div.

Remove the `ResizeDivider` line (line 177):
```typescript
        <ResizeDivider direction="horizontal" isDragging={isDragging} onMouseDown={handleMouseDown} onTouchStart={handleMouseDown} />
```

- [ ] **Step 3: Simplify DetailHeader.tsx**

Replace the entire content of `client/src/components/right-panel/DetailHeader.tsx` with:

```typescript
// FILE: client/src/components/right-panel/DetailHeader.tsx
// PURPOSE: Top card of right panel — entity name, subtitle, period selector, export
// USED BY: client/src/components/right-panel/RightPanel.tsx
// EXPORTS: DetailHeader

import type { EntityListItem, Period } from '@shared/types/dashboard';
import { CopyableId } from '../shared/CopyableId';
import { PeriodSelector } from './PeriodSelector';

interface DetailHeaderProps {
  entity: EntityListItem | null;
  activePeriod: Period;
  yearsAvailable: string[];
  onPeriodChange: (period: Period) => void;
  onExport: () => void;
}

export function DetailHeader({
  entity, activePeriod, yearsAvailable, onPeriodChange, onExport,
}: DetailHeaderProps) {
  const name = entity?.name ?? 'All Customers';
  const subtitle = entity?.meta1 ?? '';

  return (
    <header
      className="flex items-center justify-between rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-4xl)] py-[var(--spacing-xl)] shadow-[var(--shadow-card)]"
    >
      {/* Left side — entity info */}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-bold leading-[1.3] text-[var(--color-text-primary)]" title={name}>{name}</h1>
        {subtitle && (
          <p className="mt-[var(--spacing-2xs)] truncate text-[12px] text-[var(--color-text-muted)]" title={subtitle}>
            {entity?.id && <CopyableId value={entity.id} label="ID" className="inline text-[12px] text-[var(--color-text-muted)]" />}
            {entity?.zone && <> &middot; {entity.zone}</>}
            {entity?.customerType && <> &middot; {entity.customerType}</>}
            {entity?.rep && <> &middot; {entity.rep}</>}
          </p>
        )}
      </div>

      {/* Right side — period selector, export */}
      <div className="ml-[var(--spacing-lg)] flex shrink-0 items-center gap-[var(--spacing-lg)]">
        <PeriodSelector activePeriod={activePeriod} yearsAvailable={yearsAvailable} onChange={onPeriodChange} />
        <button
          type="button"
          onClick={onExport}
          className="cursor-pointer rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-md)] text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-gold-muted)]"
        >
          Export
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Fix HeroRevenueCard chart height**

In `client/src/components/right-panel/HeroRevenueCard.tsx`, change the chart container div (line 105) from:

```typescript
        <div ref={chartRef} className="mt-[var(--spacing-md)] flex-1 min-h-[80px]">
```

to:

```typescript
        <div ref={chartRef} className="mt-[var(--spacing-md)] h-[120px]">
```

- [ ] **Step 5: Update dashboard-layout-types.ts**

In `client/src/layouts/dashboard-layout-types.ts`:

Remove the import of `ApiResponse` type if it's only used by removed props. Check first — `meta` prop uses it, so keep it.

Remove these lines from the `DashboardLayoutProps` interface:

```typescript
  heroKpiRatio: [number, number];
  kpiChartsRatio: [number, number];
  heroKpiGridTemplate: string;
  onHeroKpiRatioChange: (ratio: [number, number]) => void;
  onKpiChartsRatioChange: (ratio: [number, number]) => void;
  activePreset: LayoutPreset;
  onPresetChange: (preset: Exclude<LayoutPreset, 'custom'>) => void;
  onResetLayout: () => void;
```

Wait — these props don't exist in dashboard-layout-types.ts. Let me re-read the file. Looking at the earlier read, `dashboard-layout-types.ts` has 54 lines and does NOT contain any of the layout props. The layout props are in `RightPanel`'s local interface and are passed through `DashboardLayout.tsx` directly from `useDashboardLayout()`.

So in `dashboard-layout-types.ts`, just add the two new panel props. Add these after `setSort`:

```typescript
  panelCollapsed: boolean;
  togglePanel: () => void;
```

- [ ] **Step 6: Update DashboardLayout.tsx**

In `client/src/layouts/DashboardLayout.tsx`:

Remove the import of `useDashboardLayout` (line 17):
```typescript
import { useDashboardLayout } from '../hooks/useDashboardLayout';
```

In the destructured props (line 23-36), add `panelCollapsed` and `togglePanel` to the destructuring. Add after the `setSort` line:

```typescript
    panelCollapsed,
    togglePanel,
```

Remove line 42 (the `useDashboardLayout` hook call):
```typescript
  const { layout, heroKpiGridTemplate, togglePanel, setHeroKpiRatio, setKpiChartsRatio, setPreset, reset } = useDashboardLayout();
```

Add the localStorage cleanup effect right after the `[` keyboard shortcut effect (after line 53):

```typescript
  /** WHY: One-time cleanup of stale layout localStorage from the removed resize/preset system */
  useEffect(() => {
    localStorage.removeItem('sg-dashboard-layout');
  }, []);
```

Replace `layout.panelCollapsed` with `panelCollapsed` on line 104:

```typescript
        {panelCollapsed ? (
```

Remove all layout props from the `<RightPanel>` JSX (lines 142-146). The RightPanel call should become:

```typescript
                  <RightPanel
                    entity={isAllActive ? null : activeEntity} kpis={displayDashboard.kpis}
                    monthlyRevenue={displayDashboard.monthlyRevenue} productMixes={displayDashboard.productMixes}
                    topSellers={displayDashboard.topSellers} sparklines={displayDashboard.sparklines}
                    orders={displayDashboard.orders} items={displayDashboard.items} contacts={contacts}
                    yearsAvailable={yearsAvailable} activePeriod={activePeriod} activeTab={activeTab}
                    onPeriodChange={switchPeriod} onTabChange={setActiveTab} onExport={exportCsv}
                  />
```

- [ ] **Step 7: Update useDashboardState.ts**

In `client/src/hooks/useDashboardState.ts`, add `panelCollapsed` and `togglePanel` to the destructuring of `useDashboardShellState()` (around line 21-37). Add after `resetSort,`:

```typescript
    panelCollapsed,
    togglePanel,
```

Add these to the return object (around line 133). In the `// State` section, add after `allDashboard,`:

```typescript
    panelCollapsed,

```

In the `// Actions` section, add after `abortFetch,`:

```typescript
    togglePanel,
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`

Expected: PASS. All consumers updated, no dangling references to deleted types/hooks (files still exist but are no longer imported).

- [ ] **Step 9: Run all tests**

Run: `cd client && npx vitest run`

Expected: All tests pass (including the 24 shell-state-url tests).

- [ ] **Step 10: Commit**

```bash
git add client/src/components/right-panel/RightPanel.tsx client/src/components/right-panel/KPISection.tsx client/src/components/right-panel/DetailHeader.tsx client/src/components/right-panel/HeroRevenueCard.tsx client/src/layouts/dashboard-layout-types.ts client/src/layouts/DashboardLayout.tsx client/src/hooks/useDashboardState.ts
git commit -m "refactor: remove resize system, restore fixed layout, wire panel collapse to URL state"
```

---

### Task 3: Delete dead resize/preset files

**Files:**
- Delete: `client/src/hooks/useResizablePanel.ts`
- Delete: `client/src/hooks/useDashboardLayout.ts`
- Delete: `client/src/components/right-panel/LayoutPresetToggle.tsx`
- Delete: `client/src/components/right-panel/ResizeDivider.tsx`

- [ ] **Step 1: Delete the 4 files**

```bash
rm client/src/hooks/useResizablePanel.ts
rm client/src/hooks/useDashboardLayout.ts
rm client/src/components/right-panel/LayoutPresetToggle.tsx
rm client/src/components/right-panel/ResizeDivider.tsx
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`

Expected: PASS. No file imports from the deleted files (all imports were removed in Task 2).

- [ ] **Step 3: Run dead code grep**

```bash
grep -rn "useResizablePanel\|useDashboardLayout\|LayoutPresetToggle\|ResizeDivider" client/src/
grep -rn "heroKpiRatio\|kpiChartsRatio\|heroKpiGridTemplate\|onHeroKpiRatioChange\|onKpiChartsRatioChange" client/src/
grep -rn "activePreset\|onPresetChange\|onResetLayout" client/src/
grep -rn "sg-dashboard-layout" client/src/
```

Expected: First 3 greps return 0 results. Last grep returns only the cleanup effect in `DashboardLayout.tsx`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete dead resize/preset files (useResizablePanel, useDashboardLayout, LayoutPresetToggle, ResizeDivider)"
```

---

### Task 4: Remove entity list cascade animation

**Files:**
- Modify: `client/src/components/left-panel/EntityListItem.tsx`
- Modify: `client/src/components/left-panel/EntityList.tsx`

- [ ] **Step 1: Simplify EntityListItem.tsx**

In `client/src/components/left-panel/EntityListItem.tsx`:

Remove the `motion` import (line 6):
```typescript
import { motion } from 'framer-motion';
```

Remove `animationDelay` from the interface (line 15):
```typescript
  animationDelay?: number;
```

Remove `animationDelay = 0` from the destructured props (line 18). Change to:
```typescript
export function EntityListItem({ entity, isActive, isSelected, onSelect, onCheck }: EntityListItemProps) {
```

Replace `<motion.div` (line 31) with `<div`. Remove the `initial`, `animate`, and `transition` props (lines 43-45):
```typescript
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay, duration: 0.2 }}
```

Replace `</motion.div>` (line 90) with `</div>`.

- [ ] **Step 2: Simplify EntityList.tsx**

In `client/src/components/left-panel/EntityList.tsx`:

Change the React import (line 6) — remove `useRef` and `useEffect`:
```typescript
import type { EntityListItem as EntityListItemType, EntityListLoadState, DashboardPayload } from '@shared/types/dashboard';
```

Wait — the React import is just for types used in the component. Let me check... Actually the import on line 6 is: `import { useRef, useEffect } from 'react';`. Remove this entire line since neither `useRef` nor `useEffect` is used after removing the animation logic.

Remove the `hasAnimated` ref and its effect (lines 52-53):
```typescript
  const hasAnimated = useRef(false);
  useEffect(() => { hasAnimated.current = true; }, []);
```

Remove the `animationDelay` prop from the `EntityListItem` usage (line 99):
```typescript
            animationDelay={hasAnimated.current ? 0 : index * 0.03}
```

- [ ] **Step 3: Verify TypeScript compiles and tests pass**

Run: `cd client && npx tsc -b --noEmit && npx vitest run`

Expected: PASS.

- [ ] **Step 4: Verify no animation remnants**

```bash
grep -rn "animationDelay" client/src/
```

Expected: 0 results.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/left-panel/EntityListItem.tsx client/src/components/left-panel/EntityList.tsx
git commit -m "fix: remove entity list cascade animation for instant search results"
```

---

### Task 5: Final verification

- [ ] **Step 1: Full pre-deploy verification**

```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
cd ../server && npx vitest run
cd ../client && npx vitest run
cd ../client && npx vite build
```

All must pass. Build must be <500KB gzip.

- [ ] **Step 2: Dead code checks**

```bash
grep -rn "useResizablePanel\|useDashboardLayout\|LayoutPresetToggle\|ResizeDivider" client/src/
grep -rn "heroKpiRatio\|kpiChartsRatio\|heroKpiGridTemplate\|onHeroKpiRatioChange\|onKpiChartsRatioChange" client/src/
grep -rn "activePreset\|onPresetChange\|onResetLayout" client/src/
grep -rn "sg-dashboard-layout" client/src/
grep -rn "animationDelay" client/src/
```

First 3 greps: 0 results. Fourth: only the cleanup effect in DashboardLayout. Fifth: 0 results.

- [ ] **Step 3: File line counts**

```bash
wc -l client/src/components/right-panel/RightPanel.tsx
wc -l client/src/components/right-panel/DetailHeader.tsx
wc -l client/src/components/right-panel/KPISection.tsx
wc -l client/src/components/left-panel/EntityListItem.tsx
```

Expected: RightPanel <55, DetailHeader <50, KPISection <250, EntityListItem <90.

- [ ] **Step 4: No `any` types**

```bash
grep -rn ": any\|as any" client/src/ server/src/
```

Expected: 0 results.

- [ ] **Step 5: Manual verification checklist**

Start both dev servers (`npm run dev` in `server/` and `client/`).

Verify in browser:
- [ ] Right panel renders with fixed grid layout (hero 3fr : KPI grid 2fr)
- [ ] No resize handles visible between sections
- [ ] No Compact/Balanced/Spacious toggle in header
- [ ] No reset layout button in header
- [ ] Period selector and Export button still in header
- [ ] Panel collapse via `[` key works
- [ ] URL shows `collapsed=1` when panel collapsed
- [ ] Refreshing with `collapsed=1` in URL starts with collapsed panel
- [ ] Refreshing without `collapsed` param starts with expanded panel
- [ ] KPI cards clickable — modals open
- [ ] Hero card clickable — modal opens
- [ ] Product Mix and Best Sellers clickable — modals open
- [ ] "Show details" / "Hide details" toggle works
- [ ] Tabs (Orders, Items, Contacts) switch correctly
- [ ] Search "Disney" — results appear instantly (no fade-in animation)
- [ ] Cards keyboard navigation (arrow keys) works
