# Codex Commit Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four issues from the Codex commit review: dead hooks, KPISection bloat, orders default regression, missing URL state tests.

**Architecture:** Pure cleanup — no new features. Extract URL parsing into testable pure functions, data-drive the KPI card grid to eliminate repetition, relocate orphaned types, revert a behavioral regression.

**Tech Stack:** TypeScript, React 19, Vitest 4, Tailwind CSS v4

---

## Task 1: Extract URL parsing/building into testable module

The pure functions `parseSearch` and `buildSearch` in `useDashboardShellState.ts` need to be testable. Extract them to their own module first, then write tests against them (TDD: write the test file with failing imports first).

**Files:**
- Create: `client/src/hooks/shell-state-url.ts`
- Modify: `client/src/hooks/useDashboardShellState.ts`
- Create: `client/src/hooks/__tests__/shell-state-url.test.ts`

- [ ] **Step 1: Create the test file with failing imports**

```typescript
// client/src/hooks/__tests__/shell-state-url.test.ts
// FILE: client/src/hooks/__tests__/shell-state-url.test.ts
// PURPOSE: Tests for URL parsing/building pure functions
// USED BY: test runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { parseSearchParams, buildSearch, DEFAULT_STATE } from '../shell-state-url';

describe('parseSearchParams', () => {
  it('returns DEFAULT_STATE for empty params', () => {
    const params = new URLSearchParams('');
    expect(parseSearchParams(params)).toEqual(DEFAULT_STATE);
  });

  it('parses valid dimension', () => {
    const params = new URLSearchParams('dim=vendor');
    expect(parseSearchParams(params).activeDimension).toBe('vendor');
  });

  it('falls back to default for invalid dimension', () => {
    const params = new URLSearchParams('dim=invalid');
    expect(parseSearchParams(params).activeDimension).toBe('customer');
  });

  it('parses valid period', () => {
    const params = new URLSearchParams('period=2024');
    expect(parseSearchParams(params).activePeriod).toBe('2024');
  });

  it('falls back to default for empty period', () => {
    const params = new URLSearchParams('period=');
    expect(parseSearchParams(params).activePeriod).toBe('ytd');
  });

  it('parses entity ID', () => {
    const params = new URLSearchParams('entity=C7826');
    expect(parseSearchParams(params).activeEntityId).toBe('C7826');
  });

  it('returns null entity for missing param', () => {
    const params = new URLSearchParams('');
    expect(parseSearchParams(params).activeEntityId).toBeNull();
  });

  it('parses valid tab', () => {
    const params = new URLSearchParams('tab=items');
    expect(parseSearchParams(params).activeTab).toBe('items');
  });

  it('falls back to default for invalid tab', () => {
    const params = new URLSearchParams('tab=bogus');
    expect(parseSearchParams(params).activeTab).toBe('orders');
  });

  it('parses search term', () => {
    const params = new URLSearchParams('q=acme');
    expect(parseSearchParams(params).searchTerm).toBe('acme');
  });

  it('parses valid sort field and direction', () => {
    const params = new URLSearchParams('sort=revenue&dir=desc');
    const state = parseSearchParams(params);
    expect(state.sortField).toBe('revenue');
    expect(state.sortDirection).toBe('desc');
  });

  it('falls back to defaults for invalid sort', () => {
    const params = new URLSearchParams('sort=nonexistent&dir=sideways');
    const state = parseSearchParams(params);
    expect(state.sortField).toBe('id');
    expect(state.sortDirection).toBe('asc');
  });

  it('parses full valid URL', () => {
    const params = new URLSearchParams('dim=zone&period=2023&entity=Z100&tab=contacts&q=west&sort=orders&dir=desc');
    const state = parseSearchParams(params);
    expect(state).toEqual({
      activeDimension: 'zone',
      activePeriod: '2023',
      activeEntityId: 'Z100',
      activeTab: 'contacts',
      searchTerm: 'west',
      sortField: 'orders',
      sortDirection: 'desc',
    });
  });
});

describe('buildSearch', () => {
  it('returns empty string for DEFAULT_STATE', () => {
    expect(buildSearch(DEFAULT_STATE)).toBe('');
  });

  it('includes only non-default values', () => {
    const state = { ...DEFAULT_STATE, activeDimension: 'vendor' as const };
    expect(buildSearch(state)).toBe('dim=vendor');
  });

  it('pairs sort field and direction together', () => {
    const state = { ...DEFAULT_STATE, sortField: 'revenue' as const, sortDirection: 'desc' as const };
    const result = buildSearch(state);
    expect(result).toContain('sort=revenue');
    expect(result).toContain('dir=desc');
  });

  it('includes direction when only direction differs from default', () => {
    const state = { ...DEFAULT_STATE, sortDirection: 'desc' as const };
    const result = buildSearch(state);
    expect(result).toContain('sort=id');
    expect(result).toContain('dir=desc');
  });

  it('builds full query string', () => {
    const state = {
      activeDimension: 'brand' as const,
      activePeriod: '2025',
      activeEntityId: 'B42',
      activeTab: 'items' as const,
      searchTerm: 'cheese',
      sortField: 'marginPercent' as const,
      sortDirection: 'desc' as const,
    };
    const result = buildSearch(state);
    expect(result).toContain('dim=brand');
    expect(result).toContain('period=2025');
    expect(result).toContain('entity=B42');
    expect(result).toContain('tab=items');
    expect(result).toContain('q=cheese');
    expect(result).toContain('sort=marginPercent');
    expect(result).toContain('dir=desc');
  });
});

describe('round-trip', () => {
  it('buildSearch(parseSearchParams(url)) preserves valid URLs', () => {
    const original = 'dim=vendor&period=2024&entity=C7826&tab=items&sort=revenue&dir=desc';
    const state = parseSearchParams(new URLSearchParams(original));
    const rebuilt = buildSearch(state);
    // WHY: URLSearchParams may reorder keys, so compare parsed states
    expect(parseSearchParams(new URLSearchParams(rebuilt))).toEqual(state);
  });

  it('round-trips DEFAULT_STATE through empty string', () => {
    const built = buildSearch(DEFAULT_STATE);
    expect(built).toBe('');
    const parsed = parseSearchParams(new URLSearchParams(built));
    expect(parsed).toEqual(DEFAULT_STATE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/hooks/__tests__/shell-state-url.test.ts`
Expected: FAIL — `Cannot find module '../shell-state-url'`

- [ ] **Step 3: Create shell-state-url.ts with the extracted pure functions**

```typescript
// client/src/hooks/shell-state-url.ts
// FILE: client/src/hooks/shell-state-url.ts
// PURPOSE: Pure functions for parsing/building URL search params for dashboard shell state
// USED BY: useDashboardShellState.ts, shell-state-url.test.ts
// EXPORTS: parseSearchParams, buildSearch, DEFAULT_STATE

import type { Dimension, Period } from '@shared/types/dashboard';
import type { DetailTab } from '../components/right-panel/detail-tab-types';
import type { SortDirection, SortField } from './useSort';

export interface DashboardShellState {
  activeDimension: Dimension;
  activePeriod: Period;
  activeEntityId: string | null;
  activeTab: DetailTab;
  searchTerm: string;
  sortField: SortField;
  sortDirection: SortDirection;
}

export const DEFAULT_STATE: DashboardShellState = {
  activeDimension: 'customer',
  activePeriod: 'ytd',
  activeEntityId: null,
  activeTab: 'orders',
  searchTerm: '',
  sortField: 'id',
  sortDirection: 'asc',
};

const VALID_DIMENSIONS = new Set<Dimension>([
  'customer', 'zone', 'vendor', 'brand', 'product_type', 'product',
]);
const VALID_TABS = new Set<DetailTab>(['orders', 'items', 'contacts']);
const VALID_SORT_FIELDS = new Set<SortField>([
  'id', 'name', 'revenue', 'orders', 'avgOrder', 'marginPercent', 'frequency', 'lastOrder',
]);
const VALID_SORT_DIRECTIONS = new Set<SortDirection>(['asc', 'desc']);

/** WHY: Accepts URLSearchParams instead of reading window.location — testable without JSDOM */
export function parseSearchParams(params: URLSearchParams): DashboardShellState {
  const dim = params.get('dim');
  const period = params.get('period');
  const entity = params.get('entity');
  const tab = params.get('tab');
  const q = params.get('q');
  const sort = params.get('sort');
  const dir = params.get('dir');

  return {
    activeDimension: VALID_DIMENSIONS.has(dim as Dimension) ? dim as Dimension : DEFAULT_STATE.activeDimension,
    activePeriod: period && period.trim() ? period : DEFAULT_STATE.activePeriod,
    activeEntityId: entity && entity.trim() ? entity : null,
    activeTab: VALID_TABS.has(tab as DetailTab) ? tab as DetailTab : DEFAULT_STATE.activeTab,
    searchTerm: q ?? DEFAULT_STATE.searchTerm,
    sortField: VALID_SORT_FIELDS.has(sort as SortField) ? sort as SortField : DEFAULT_STATE.sortField,
    sortDirection: VALID_SORT_DIRECTIONS.has(dir as SortDirection) ? dir as SortDirection : DEFAULT_STATE.sortDirection,
  };
}

export function buildSearch(state: DashboardShellState): string {
  const params = new URLSearchParams();

  if (state.activeDimension !== DEFAULT_STATE.activeDimension) params.set('dim', state.activeDimension);
  if (state.activePeriod !== DEFAULT_STATE.activePeriod) params.set('period', state.activePeriod);
  if (state.activeEntityId) params.set('entity', state.activeEntityId);
  if (state.activeTab !== DEFAULT_STATE.activeTab) params.set('tab', state.activeTab);
  if (state.searchTerm) params.set('q', state.searchTerm);
  if (
    state.sortField !== DEFAULT_STATE.sortField
    || state.sortDirection !== DEFAULT_STATE.sortDirection
  ) {
    params.set('sort', state.sortField);
    params.set('dir', state.sortDirection);
  }

  return params.toString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/hooks/__tests__/shell-state-url.test.ts`
Expected: All 16 tests PASS

- [ ] **Step 5: Update useDashboardShellState.ts to import from shell-state-url**

Replace the entire top section of `client/src/hooks/useDashboardShellState.ts`. The file should now import `parseSearchParams`, `buildSearch`, `DEFAULT_STATE`, and re-export `DashboardShellState` from `shell-state-url.ts`. Remove the duplicated type, constants, and functions. Keep `writeUrl` and the hook.

New contents:

```typescript
// FILE: client/src/hooks/useDashboardShellState.ts
// PURPOSE: URL-backed core shell state for the dashboard (dimension, period, entity, tab, search, sort)
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useDashboardShellState, DashboardShellState

import { useCallback, useEffect, useState } from 'react';
import type { Dimension, Period } from '@shared/types/dashboard';
import type { DetailTab } from '../components/right-panel/detail-tab-types';
import type { SortField } from './useSort';
import { parseSearchParams, buildSearch, DEFAULT_STATE } from './shell-state-url';
import type { DashboardShellState } from './shell-state-url';

export type { DashboardShellState };

type HistoryMode = 'push' | 'replace';

function parseSearch(): DashboardShellState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  return parseSearchParams(new URLSearchParams(window.location.search));
}

function writeUrl(nextState: DashboardShellState, mode: HistoryMode): void {
  if (typeof window === 'undefined') return;

  const nextSearch = buildSearch(nextState);
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl === currentUrl) return;
  window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', nextUrl);
}

export function useDashboardShellState() {
  const [state, setState] = useState<DashboardShellState>(() => parseSearch());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePopState = () => setState(parseSearch());
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const updateState = useCallback((
    updater: DashboardShellState | ((prev: DashboardShellState) => DashboardShellState),
    mode: HistoryMode,
  ) => {
    setState((prev) => {
      const next = typeof updater === 'function'
        ? (updater as (prev: DashboardShellState) => DashboardShellState)(prev)
        : updater;
      writeUrl(next, mode);
      return next;
    });
  }, []);

  const switchDimension = useCallback((dimension: Dimension) => {
    updateState((prev) => ({
      ...prev,
      activeDimension: dimension,
      activeEntityId: null,
      searchTerm: '',
      sortField: DEFAULT_STATE.sortField,
      sortDirection: DEFAULT_STATE.sortDirection,
    }), 'push');
  }, [updateState]);

  const switchPeriod = useCallback((period: Period) => {
    updateState((prev) => ({ ...prev, activePeriod: period }), 'push');
  }, [updateState]);

  const setActiveEntityId = useCallback((entityId: string | null) => {
    updateState((prev) => ({ ...prev, activeEntityId: entityId }), 'push');
  }, [updateState]);

  const setActiveTab = useCallback((tab: DetailTab) => {
    updateState((prev) => ({ ...prev, activeTab: tab }), 'push');
  }, [updateState]);

  const setSearchTerm = useCallback((searchTerm: string) => {
    updateState((prev) => ({ ...prev, searchTerm }), 'replace');
  }, [updateState]);

  const resetSearch = useCallback(() => {
    updateState((prev) => ({ ...prev, searchTerm: '' }), 'replace');
  }, [updateState]);

  const setSort = useCallback((field: SortField) => {
    updateState((prev) => {
      if (prev.sortField === field) {
        return {
          ...prev,
          sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        ...prev,
        sortField: field,
        sortDirection: 'desc',
      };
    }, 'replace');
  }, [updateState]);

  const resetSort = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      sortField: DEFAULT_STATE.sortField,
      sortDirection: DEFAULT_STATE.sortDirection,
    }), 'replace');
  }, [updateState]);

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
  };
}
```

- [ ] **Step 6: Verify TypeScript compiles and tests still pass**

Run: `cd client && npx tsc -b --noEmit && npx vitest run src/hooks/__tests__/shell-state-url.test.ts`
Expected: No TS errors, all 16 tests PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/hooks/shell-state-url.ts client/src/hooks/__tests__/shell-state-url.test.ts client/src/hooks/useDashboardShellState.ts
git commit -m "refactor: extract URL parsing into testable module with 16 tests"
```

---

## Task 2: Relocate sort types + delete dead hooks

Move `SortField` and `SortDirection` types to their own file, update all 4 importers, then delete the 4 orphaned hooks.

**Files:**
- Create: `client/src/hooks/sort-types.ts`
- Delete: `client/src/hooks/useDimension.ts`
- Delete: `client/src/hooks/usePeriod.ts`
- Delete: `client/src/hooks/useSearch.ts`
- Delete: `client/src/hooks/useSort.ts`
- Modify: `client/src/hooks/shell-state-url.ts` (import path)
- Modify: `client/src/hooks/useDashboardShellState.ts` (import path)
- Modify: `client/src/layouts/dashboard-layout-types.ts` (import path)
- Modify: `client/src/utils/sort-engine.ts` (import path)
- Modify: `client/src/components/left-panel/LeftPanel.tsx` (import path)

- [ ] **Step 1: Create sort-types.ts**

```typescript
// client/src/hooks/sort-types.ts
// FILE: client/src/hooks/sort-types.ts
// PURPOSE: Sort field + direction types shared across hooks, utils, and components
// USED BY: useDashboardShellState.ts, shell-state-url.ts, sort-engine.ts, LeftPanel.tsx, dashboard-layout-types.ts
// EXPORTS: SortField, SortDirection

export type SortField =
  | 'id'
  | 'name'
  | 'revenue'
  | 'orders'
  | 'avgOrder'
  | 'marginPercent'
  | 'frequency'
  | 'lastOrder';

export type SortDirection = 'asc' | 'desc';
```

- [ ] **Step 2: Update all 5 importers**

In each file, change the import path from `'./useSort'` or `'../../hooks/useSort'` to `'./sort-types'` or `'../../hooks/sort-types'`:

`client/src/hooks/shell-state-url.ts` line 9:
```typescript
// Before:
import type { SortDirection, SortField } from './useSort';
// After:
import type { SortDirection, SortField } from './sort-types';
```

`client/src/hooks/useDashboardShellState.ts` line 9 (after Task 1):
```typescript
// Before:
import type { SortField } from './useSort';
// After:
import type { SortField } from './sort-types';
```

`client/src/layouts/dashboard-layout-types.ts` line 8:
```typescript
// Before:
import type { SortField, SortDirection } from '../hooks/useSort';
// After:
import type { SortField, SortDirection } from '../hooks/sort-types';
```

`client/src/utils/sort-engine.ts` line 7:
```typescript
// Before:
import type { SortField, SortDirection } from '../hooks/useSort';
// After:
import type { SortField, SortDirection } from '../hooks/sort-types';
```

`client/src/components/left-panel/LeftPanel.tsx` line 9:
```typescript
// Before:
import type { SortField, SortDirection } from '../../hooks/useSort';
// After:
import type { SortField, SortDirection } from '../../hooks/sort-types';
```

- [ ] **Step 3: Delete the 4 dead hook files**

```bash
rm client/src/hooks/useDimension.ts client/src/hooks/usePeriod.ts client/src/hooks/useSearch.ts client/src/hooks/useSort.ts
```

- [ ] **Step 4: Verify no stale imports + TypeScript compiles + all tests pass**

```bash
# Must return no results (no stale imports)
grep -rn "from.*useDimension\|from.*usePeriod\|from.*useSearch\b" client/src/

# Must return no results (useSort hook gone, sort-types used instead)
grep -rn "from.*useSort" client/src/

# Must compile clean
cd client && npx tsc -b --noEmit

# All tests pass
cd client && npx vitest run
```

Expected: grep returns nothing, tsc succeeds, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/sort-types.ts client/src/hooks/shell-state-url.ts client/src/hooks/useDashboardShellState.ts client/src/layouts/dashboard-layout-types.ts client/src/utils/sort-engine.ts client/src/components/left-panel/LeftPanel.tsx
git rm client/src/hooks/useDimension.ts client/src/hooks/usePeriod.ts client/src/hooks/useSearch.ts client/src/hooks/useSort.ts
git commit -m "refactor: delete dead hooks, relocate sort types to sort-types.ts"
```

---

## Task 3: Data-driven KPISection refactor

Replace the 5 repetitive KPI card blocks with a config-driven map. Keep the Last Order card inline (different shape). Deduplicate card + modal props.

**Files:**
- Modify: `client/src/components/right-panel/KPISection.tsx`

- [ ] **Step 1: Rewrite KPISection.tsx with data-driven config**

The key insight: each of the 5 standard cards has the same structure:
1. A `label` string
2. A `value` extracted from `kpis` (may be nullable)
3. A `formatter` function
4. A `breakdown` accessor (from `kpis`)
5. A `formatSubItem` for breakdown values
6. A `cardIndex` for keyboard navigation

The `subItems` array and `onExpand` modal props are *identical* to the card props — extract a helper to build them once.

Replace the full file content:

```typescript
// FILE: client/src/components/right-panel/KPISection.tsx
// PURPOSE: CSS Grid layout — hero revenue card (left) + 2x3 KPI card grid (right)
// USED BY: RightPanel.tsx
// EXPORTS: KPISection

import { useState, useMemo } from 'react';
import type { KPIs, KPIMetricBreakdown, MonthlyRevenue, SparklineData, Period } from '@shared/types/dashboard';
import {
  formatCurrency,
  formatDays,
  formatFrequency,
  formatInteger,
  formatPercent,
} from '@shared/utils/formatting';
import { HeroRevenueCard } from './HeroRevenueCard';
import { KPICard } from './KPICard';
import type { KPISubItem } from './KPICard';
import { useResizablePanel } from '../../hooks/useResizablePanel';
import { ResizeDivider } from './ResizeDivider';
import { useModal } from '../shared/ModalProvider';
import { KPIModalContent, HeroRevenueModalContent } from './kpi-modal-content';
import { useCardNavigation } from '../../hooks/useCardNavigation';

interface KPISectionProps {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  sparklines: Record<string, SparklineData>;
  activePeriod: Period;
  heroKpiGridTemplate: string;
  onHeroKpiRatioChange: (ratio: [number, number]) => void;
  heroKpiRatio: [number, number];
}

const EM_DASH = '\u2014';

/** WHY activity status here: spec 10.3 defines dot color thresholds by days since last order */
function getActivityStatus(days: number | null): { color: string; label: string } {
  if (days === null) return { color: 'var(--color-text-muted)', label: 'No orders' };
  if (days <= 14) return { color: 'var(--color-green)', label: 'Active buyer' };
  if (days <= 45) return { color: 'var(--color-gold-primary)', label: 'Regular' };
  if (days <= 90) return { color: 'var(--color-yellow)', label: 'Slowing' };
  return { color: 'var(--color-red)', label: 'At risk' };
}

/** WHY: YoY percent change — null when no prev year data to avoid division by zero */
function yoyChange(current: number, prevYear: number): number | null {
  return prevYear > 0 ? ((current - prevYear) / prevYear) * 100 : null;
}

interface KPICardConfig {
  label: string;
  cardIndex: number;
  getValue: (kpis: KPIs) => number;
  /** WHY: Cards with nullable KPI values (avgOrder, marginPercent, frequency) show em-dash when null */
  isNullable: boolean;
  getRawValue: (kpis: KPIs) => number | null;
  formatter: (n: number) => string;
  getBreakdown: (kpis: KPIs) => KPIMetricBreakdown;
  formatSubItem: (value: number) => string;
}

/** WHY: Build sub-items array from breakdown — shared between card and modal */
function buildSubItems(bd: KPIMetricBreakdown, fmt: (n: number) => string): KPISubItem[] {
  return [
    { label: 'This Quarter', value: fmt(bd.thisQuarter) },
    { label: 'Last Month', value: fmt(bd.lastMonth), suffix: bd.lastMonthName },
    { label: 'Best Month', value: fmt(bd.bestMonth.value), suffix: bd.bestMonth.name },
  ];
}

/** WHY: Nullable formatters show em-dash for zero/null values in prev-year and sub-item slots */
function nullableFmt(value: number, fmt: (n: number) => string): string {
  return value > 0 ? fmt(value) : EM_DASH;
}

const KPI_CONFIGS: KPICardConfig[] = [
  {
    label: 'Orders', cardIndex: 1,
    getValue: (k) => k.orders, isNullable: false, getRawValue: (k) => k.orders,
    formatter: formatInteger, getBreakdown: (k) => k.ordersBreakdown,
    formatSubItem: (n) => formatInteger(n),
  },
  {
    label: 'Avg. Order', cardIndex: 2,
    getValue: (k) => k.avgOrder ?? 0, isNullable: true, getRawValue: (k) => k.avgOrder,
    formatter: (n) => formatCurrency(Math.round(n)), getBreakdown: (k) => k.avgOrderBreakdown,
    formatSubItem: (n) => n > 0 ? formatCurrency(Math.round(n)) : EM_DASH,
  },
  {
    label: 'Margin %', cardIndex: 3,
    getValue: (k) => k.marginPercent ?? 0, isNullable: true, getRawValue: (k) => k.marginPercent,
    formatter: (n) => formatPercent(n), getBreakdown: (k) => k.marginPercentBreakdown,
    formatSubItem: (n) => n > 0 ? formatPercent(n) : EM_DASH,
  },
  {
    label: 'Margin $', cardIndex: 4,
    getValue: (k) => k.marginAmount, isNullable: false, getRawValue: (k) => k.marginAmount,
    formatter: (n) => formatCurrency(Math.round(n)), getBreakdown: (k) => k.marginAmountBreakdown,
    formatSubItem: (n) => formatCurrency(Math.round(n)),
  },
  {
    label: 'Frequency', cardIndex: 5,
    getValue: (k) => k.frequency ?? 0, isNullable: true, getRawValue: (k) => k.frequency,
    formatter: (n) => formatFrequency(n), getBreakdown: (k) => k.frequencyBreakdown,
    formatSubItem: (n) => formatInteger(n),
  },
];

export function KPISection({
  kpis, monthlyRevenue, sparklines: _sparklines, activePeriod,
  heroKpiGridTemplate, onHeroKpiRatioChange, heroKpiRatio,
}: KPISectionProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { containerRef, isDragging, handleMouseDown } = useResizablePanel({
    direction: 'horizontal', defaultRatio: heroKpiRatio,
    minPercent: 30, maxPercent: 70, onRatioChange: onHeroKpiRatioChange,
  });
  const { openModal } = useModal();
  const { setCardRef, onCardFocus, onCardBlur } = useCardNavigation(7);
  const activity = getActivityStatus(kpis.lastOrderDays);
  const pLabel = activePeriod === 'ytd' ? '(YTD)' : `(${activePeriod})`;
  const prevYr = activePeriod === 'ytd' ? new Date().getFullYear() - 1 : parseInt(activePeriod, 10) - 1;
  const pyLabel = activePeriod === 'ytd' ? `YTD ${prevYr}` : `${prevYr}`;
  const pyFullLabel = `Full ${prevYr}`;

  return (
    <div className="flex flex-col gap-[var(--spacing-sm)]" role="grid" aria-label="KPI cards">
      <div ref={containerRef} className="grid gap-0 max-lg:grid-cols-1 max-lg:gap-[var(--spacing-base)]" style={{ gridTemplateColumns: heroKpiGridTemplate }}>
        <HeroRevenueCard
          kpis={kpis} monthlyRevenue={monthlyRevenue} activePeriod={activePeriod}
          showDetails={showDetails}
          onExpand={() => openModal('Total Revenue', <HeroRevenueModalContent kpis={kpis} monthlyRevenue={monthlyRevenue} />)}
          cardRef={setCardRef(0)} onCardFocus={onCardFocus(0)} onCardBlur={onCardBlur}
        />
        <ResizeDivider direction="horizontal" isDragging={isDragging} onMouseDown={handleMouseDown} onTouchStart={handleMouseDown} />
        <div className="grid grid-cols-2 grid-rows-3 gap-[var(--spacing-sm)] overflow-hidden">
          {KPI_CONFIGS.map((cfg) => {
            const bd = cfg.getBreakdown(kpis);
            const rawValue = cfg.getRawValue(kpis);
            const displayFormatter = cfg.isNullable
              ? (n: number) => rawValue === null ? EM_DASH : cfg.formatter(n)
              : cfg.formatter;
            const prevYearValue = cfg.isNullable ? nullableFmt(bd.prevYear, cfg.formatter) : cfg.formatter(bd.prevYear);
            const prevYearFullValue = cfg.isNullable ? nullableFmt(bd.prevYearFull, cfg.formatter) : cfg.formatter(bd.prevYearFull);
            const subItems = buildSubItems(bd, cfg.formatSubItem);
            const modalValue = cfg.isNullable && rawValue === null ? EM_DASH : cfg.formatter(cfg.getValue(kpis));
            const changePercent = yoyChange(cfg.getValue(kpis), bd.prevYear);

            return (
              <KPICard
                key={cfg.label}
                label={cfg.label} periodLabel={pLabel}
                value={cfg.getValue(kpis)} formatter={displayFormatter}
                prevYearValue={prevYearValue} prevYearFullValue={prevYearFullValue}
                prevYearLabel={pyLabel} prevYearFullLabel={pyFullLabel}
                changePercent={changePercent} expanded={showDetails} subItems={subItems}
                onExpand={() => openModal(cfg.label, (
                  <KPIModalContent
                    value={modalValue} changePercent={changePercent}
                    prevYearValue={prevYearValue} prevYearFullValue={prevYearFullValue}
                    prevYearLabel={pyLabel} prevYearFullLabel={pyFullLabel}
                    subItems={subItems}
                  />
                ))}
                cardRef={setCardRef(cfg.cardIndex)}
                onCardFocus={onCardFocus(cfg.cardIndex)} onCardBlur={onCardBlur}
              />
            );
          })}

          <KPICard
            label="Last Order" periodLabel=""
            value={kpis.lastOrderDays ?? 0}
            formatter={(n) => kpis.lastOrderDays === null ? 'No orders' : formatDays(Math.round(n))}
            statusDot={activity}
            onExpand={() => openModal('Last Order', (
              <KPIModalContent value={kpis.lastOrderDays === null ? 'No orders' : formatDays(Math.round(kpis.lastOrderDays))} />
            ))}
            cardRef={setCardRef(6)} onCardFocus={onCardFocus(6)} onCardBlur={onCardBlur}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((prev) => !prev)}
        className="mx-auto flex cursor-pointer items-center gap-[var(--spacing-xs)] rounded-full bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-xs)] text-[10px] font-medium text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[var(--color-gold-muted)] hover:text-[var(--color-text-secondary)]"
      >
        {showDetails ? 'Hide details' : 'Show details'}
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Count lines and verify under 300**

Run: `wc -l client/src/components/right-panel/KPISection.tsx`
Expected: ~195 lines (under 200, well under 300 limit)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add client/src/components/right-panel/KPISection.tsx
git commit -m "refactor: data-driven KPI card configs, KPISection 309→~195 lines"
```

---

## Task 4: Revert Orders tab default filter

One-line change to restore `'last30'` as the default.

**Files:**
- Modify: `client/src/components/right-panel/OrdersTab.tsx:18`

- [ ] **Step 1: Revert the default**

In `client/src/components/right-panel/OrdersTab.tsx`, line 18:

```typescript
// Before:
const [activeFilter, setActiveFilter] = useState<OrderTimeFilter | null>(null);

// After:
/** WHY: Pre-select "Last 30 Days" so users see recent orders immediately */
const [activeFilter, setActiveFilter] = useState<OrderTimeFilter | null>('last30');
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/right-panel/OrdersTab.tsx
git commit -m "fix: revert Orders tab default filter to 'last30'"
```

---

## Task 5: Final verification

Run the full pre-deploy verification suite.

- [ ] **Step 1: Full verification**

```bash
cd client && npx tsc -b --noEmit          # Client TS build
cd ../server && npx tsc --noEmit           # Server TS build
cd ../server && npx vitest run             # Server tests
cd ../client && npx vitest run             # Client tests (new + existing)
cd ../client && npx vite build             # Bundle check

# Dead hooks gone
ls client/src/hooks/useDimension.ts client/src/hooks/usePeriod.ts client/src/hooks/useSearch.ts client/src/hooks/useSort.ts 2>&1

# No stale imports
grep -rn "from.*useDimension\|from.*usePeriod\|from.*useSearch\b" client/src/
grep -rn "from.*useSort\b" client/src/

# Sort types properly imported
grep -rn "from.*sort-types" client/src/

# KPISection line count
wc -l client/src/components/right-panel/KPISection.tsx
```

Expected:
- Both tsc commands: 0 errors
- Server tests: all pass
- Client tests: all pass (16 new URL tests + 3 existing util test suites)
- Vite build: success, <500KB gzip
- Dead hook files: "No such file or directory"
- Stale imports: no results
- sort-types: 5 results (shell-state-url, useDashboardShellState, dashboard-layout-types, sort-engine, LeftPanel)
- KPISection: ~195 lines

- [ ] **Step 2: Commit any fixups if needed, then done**
