# Plan C: Integration — Data Flow, State Management, Interactions, Deploy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Plan B frontend shell to the Plan A backend. Replace mock data with TanStack Query hooks. Add all interactive behaviors (dimension switching, search, filter, sort, multi-select, period switching). Add animation choreography. Deploy via Docker to Railway.

**Architecture:** TanStack Query v5 for server state. React state for UI state (active dimension, search, filters, sort, selected entities). Client-side filtering/sorting/searching on the cached dataset. Framer Motion orchestration for page load and data transitions. Dockerfile for Railway deployment.

**Tech Stack:** TanStack Query v5, Framer Motion, Zod, Docker

**Spec reference:** `docs/specs/2026-03-29-sales-dashboard-design.md` — Sections 5 (dimension switching), 6 (API strategy), 7 (interactions), 10.5 (consolidated aggregation), 12 (animations), 13 (acceptance criteria), 14 (responsive), 21 (page load orchestration)

**Depends on:** Plan A (running backend at :3001), Plan B (component shell with mock data)
**Produces:** Fully working dashboard deployed on Railway, embedded in Airtable via Omni

---

## File Structure

```
client/src/
  hooks/
    useDashboardData.ts         — TanStack Query: fetches dashboard payload from /api/sales/dashboard
    useContacts.ts              — TanStack Query: fetches contacts on demand per entity
    useDimension.ts             — React state: active dimension + switching logic
    usePeriod.ts                — React state: active period + year tabs
    useEntitySelection.ts       — React state: active entity + multi-select
    useSearch.ts                — React state: search term + debounced filtering
    useFilters.ts               — React state: filter conditions + evaluation
    useSort.ts                  — React state: sort field + direction
    useDashboardState.ts        — Combines all state hooks into one provider
  utils/
    calculations.ts             — KPI recalculation for filtered/selected entities
    aggregation.ts              — Consolidated view aggregation (spec Section 10.5)
    search.ts                   — Client-side entity name search
    filter-engine.ts            — Client-side filter condition evaluation
    sort-engine.ts              — Client-side sort with field accessors
    dimension-config.ts         — Per-dimension labels, metadata patterns, filter fields (spec Section 15)
  App.tsx                       — Updated: replaces mock data with hooks

Dockerfile                      — Multi-stage: build client + server, serve from Express
railway.json                    — Railway config
.dockerignore                   — Excludes node_modules, .env, .git
```

---

## Task 0: TanStack Query Setup

**Files:**
- Modify: `client/src/App.tsx`
- Create: `client/src/hooks/useDashboardData.ts`

- [ ] **Step 1: Update App.tsx to use QueryClientProvider**

```tsx
// FILE: client/src/App.tsx
// PURPOSE: Root component — TanStack Query provider + dashboard state
// USED BY: client/src/main.tsx
// EXPORTS: App

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from './layouts/DashboardLayout';
import { useDashboardState } from './hooks/useDashboardState';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutes — spec Section 6
      retry: 2,
      refetchOnWindowFocus: false,  // In iframe, window focus events are unreliable
    },
  },
});

function DashboardApp() {
  const state = useDashboardState();
  return <DashboardLayout {...state} />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardApp />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Write the dashboard data hook**

```typescript
// FILE: client/src/hooks/useDashboardData.ts
// PURPOSE: TanStack Query hook for fetching dashboard payload from backend
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useDashboardData

import { useQuery } from '@tanstack/react-query';
import type { DashboardPayload, Dimension, Period } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

interface UseDashboardDataOptions {
  groupBy: Dimension;
  period: Period;
}

async function fetchDashboard(groupBy: Dimension, period: Period): Promise<ApiResponse<DashboardPayload>> {
  const params = new URLSearchParams({ groupBy, period });
  const response = await fetch(`/api/sales/dashboard?${params}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Network error' } }));
    throw new Error(error.error?.message ?? `HTTP ${response.status}`);
  }
  return response.json();
}

export function useDashboardData({ groupBy, period }: UseDashboardDataOptions) {
  return useQuery({
    queryKey: ['dashboard', groupBy, period],
    queryFn: () => fetchDashboard(groupBy, period),
    staleTime: period === 'ytd' ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000,  // YTD=5min, historical=24hr
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/App.tsx client/src/hooks/useDashboardData.ts
git commit -m "feat(client): add TanStack Query setup and dashboard data hook"
```

---

## Task 1: Contacts Hook

**File:** `client/src/hooks/useContacts.ts`

- [ ] **Step 1: Write contacts hook (on-demand per entity)**

```typescript
// FILE: client/src/hooks/useContacts.ts
// PURPOSE: TanStack Query hook for fetching contacts — only when Contacts tab is active
// USED BY: client/src/components/right-panel/TabsSection.tsx
// EXPORTS: useContacts

import { useQuery } from '@tanstack/react-query';
import type { Contact } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

async function fetchContacts(customerId: string): Promise<Contact[]> {
  const params = new URLSearchParams({ customerId });
  const response = await fetch(`/api/sales/contacts?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result: ApiResponse<Contact[]> = await response.json();
  return result.data;
}

export function useContacts(customerId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['contacts', customerId],
    queryFn: () => fetchContacts(customerId!),
    enabled: enabled && customerId !== null,
    staleTime: 30 * 60 * 1000,  // 30 minutes
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useContacts.ts
git commit -m "feat(client): add contacts hook with on-demand fetching"
```

---

## Task 2: UI State Hooks

**Files:**
- Create: `client/src/hooks/useDimension.ts`
- Create: `client/src/hooks/usePeriod.ts`
- Create: `client/src/hooks/useEntitySelection.ts`
- Create: `client/src/hooks/useSearch.ts`
- Create: `client/src/hooks/useFilters.ts`
- Create: `client/src/hooks/useSort.ts`

Each hook manages one slice of UI state. They're combined in `useDashboardState` (Task 3).

- [ ] **Step 1: Write useDimension.ts**

```typescript
// FILE: client/src/hooks/useDimension.ts
// PURPOSE: Active dimension state + switching logic (resets filters, search, selection — spec 13.1)
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useDimension

import { useState, useCallback } from 'react';
import type { Dimension } from '@shared/types/dashboard';

export function useDimension() {
  const [activeDimension, setActiveDimension] = useState<Dimension>('customer');

  const switchDimension = useCallback((dimension: Dimension) => {
    setActiveDimension(dimension);
    // Spec Section 13.1: switching dimensions resets filters, search, sort, selection
    // The parent hook (useDashboardState) handles resetting other state
  }, []);

  return { activeDimension, switchDimension };
}
```

- [ ] **Step 2: Write usePeriod.ts**

```typescript
// FILE: client/src/hooks/usePeriod.ts
// PURPOSE: Active period state (YTD, 2025, 2024, etc.)
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: usePeriod

import { useState, useCallback } from 'react';
import type { Period } from '@shared/types/dashboard';

export function usePeriod() {
  const [activePeriod, setActivePeriod] = useState<Period>('ytd');

  const switchPeriod = useCallback((period: Period) => {
    setActivePeriod(period);
  }, []);

  return { activePeriod, switchPeriod };
}
```

- [ ] **Step 3: Write useEntitySelection.ts**

```typescript
// FILE: client/src/hooks/useEntitySelection.ts
// PURPOSE: Active entity + multi-select state — spec Section 13.4
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useEntitySelection

import { useState, useCallback } from 'react';

export function useEntitySelection() {
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConsolidated, setIsConsolidated] = useState(false);

  const selectEntity = useCallback((id: string) => {
    setActiveEntityId(id);
    setIsConsolidated(false);
  }, []);

  const toggleCheckbox = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const viewConsolidated = useCallback(() => {
    setIsConsolidated(true);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsConsolidated(false);
  }, []);

  const resetSelection = useCallback(() => {
    setActiveEntityId(null);
    setSelectedIds(new Set());
    setIsConsolidated(false);
  }, []);

  return {
    activeEntityId, selectedIds: [...selectedIds], isConsolidated,
    selectEntity, toggleCheckbox, viewConsolidated, clearSelection, resetSelection,
  };
}
```

- [ ] **Step 4: Write useSearch.ts**

```typescript
// FILE: client/src/hooks/useSearch.ts
// PURPOSE: Search term with 300ms debounce — spec Section 13.2
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useSearch

import { useState, useMemo } from 'react';

export function useSearch() {
  const [searchTerm, setSearchTerm] = useState('');

  // Debounce is handled in the SearchBox component (controlled input with useEffect)
  // This hook stores the committed search term

  const reset = useMemo(() => () => setSearchTerm(''), []);

  return { searchTerm, setSearchTerm, resetSearch: reset };
}
```

- [ ] **Step 5: Write useFilters.ts**

```typescript
// FILE: client/src/hooks/useFilters.ts
// PURPOSE: Filter conditions state + evaluation — spec Section 13.3
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useFilters, FilterCondition

import { useState, useCallback } from 'react';

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string | number;
  conjunction: 'and' | 'or';
}

export function useFilters() {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addCondition = useCallback(() => {
    setConditions(prev => [...prev, {
      id: crypto.randomUUID(),
      field: '',
      operator: '',
      value: '',
      conjunction: 'and',
    }]);
  }, []);

  const updateCondition = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const removeCondition = useCallback((id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setConditions([]);
    setIsOpen(false);
  }, []);

  const togglePanel = useCallback(() => setIsOpen(prev => !prev), []);

  return {
    conditions, isOpen, activeCount: conditions.filter(c => c.field && c.value).length,
    addCondition, updateCondition, removeCondition, clearAll, togglePanel,
  };
}
```

- [ ] **Step 6: Write useSort.ts**

```typescript
// FILE: client/src/hooks/useSort.ts
// PURPOSE: Sort field + direction state — spec Section 15.4
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useSort

import { useState, useCallback } from 'react';

export type SortField = 'name' | 'revenue' | 'orders' | 'avgOrder' | 'marginPercent' | 'frequency' | 'outstanding' | 'lastOrder';
export type SortDirection = 'asc' | 'desc';

export function useSort() {
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const setSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDirection('desc');
      return field;
    });
  }, []);

  const resetSort = useCallback(() => {
    setSortField('revenue');
    setSortDirection('desc');
  }, []);

  return { sortField, sortDirection, setSort, resetSort };
}
```

- [ ] **Step 7: Commit**

```bash
git add client/src/hooks/
git commit -m "feat(client): add UI state hooks — dimension, period, selection, search, filters, sort"
```

---

## Task 3: Combined Dashboard State Hook

**File:** `client/src/hooks/useDashboardState.ts`

Combines all state hooks + data fetching. Handles dimension switch reset (spec Section 13.1).

- [ ] **Step 1: Write useDashboardState.ts**

```typescript
// FILE: client/src/hooks/useDashboardState.ts
// PURPOSE: Combines all state hooks + server data into one prop bundle for DashboardLayout
// USED BY: client/src/App.tsx
// EXPORTS: useDashboardState

import { useCallback, useMemo } from 'react';
import { useDashboardData } from './useDashboardData';
import { useContacts } from './useContacts';
import { useDimension } from './useDimension';
import { usePeriod } from './usePeriod';
import { useEntitySelection } from './useEntitySelection';
import { useSearch } from './useSearch';
import { useFilters } from './useFilters';
import { useSort } from './useSort';
import { filterEntities } from '../utils/filter-engine';
import { sortEntities } from '../utils/sort-engine';
import { searchEntities } from '../utils/search';
import type { Dimension } from '@shared/types/dashboard';

export function useDashboardState() {
  const { activeDimension, switchDimension: rawSwitchDimension } = useDimension();
  const { activePeriod, switchPeriod } = usePeriod();
  const { activeEntityId, selectedIds, isConsolidated, selectEntity, toggleCheckbox, viewConsolidated, clearSelection, resetSelection } = useEntitySelection();
  const { searchTerm, setSearchTerm, resetSearch } = useSearch();
  const { conditions, isOpen: filterOpen, activeCount: filterCount, addCondition, updateCondition, removeCondition, clearAll: clearFilters, togglePanel: toggleFilterPanel } = useFilters();
  const { sortField, sortDirection, setSort, resetSort } = useSort();

  // Spec Section 13.1: dimension switch resets everything
  const switchDimension = useCallback((dim: Dimension) => {
    rawSwitchDimension(dim);
    resetSelection();
    resetSearch();
    clearFilters();
    resetSort();
  }, [rawSwitchDimension, resetSelection, resetSearch, clearFilters, resetSort]);

  // Fetch dashboard data
  const { data: response, isLoading, error } = useDashboardData({ groupBy: activeDimension, period: activePeriod });
  const dashboard = response?.data ?? null;
  const meta = response?.meta ?? null;

  // Fetch contacts on demand — useContacts returns a TanStack Query result object
  const contactsQuery = useContacts(activeEntityId, activeDimension === 'customer');

  // Apply client-side search, filter, sort — spec Section 6
  const processedEntities = useMemo(() => {
    if (!dashboard) return [];
    let entities = dashboard.entities;
    if (searchTerm) entities = searchEntities(entities, searchTerm);
    if (conditions.length > 0) entities = filterEntities(entities, conditions);
    entities = sortEntities(entities, sortField, sortDirection);
    return entities;
  }, [dashboard, searchTerm, conditions, sortField, sortDirection]);

  return {
    // Data
    dashboard: dashboard ? { ...dashboard, entities: processedEntities } : null,
    contacts: contactsQuery.data ?? [],
    isLoading,
    error: error?.message ?? null,
    meta,

    // State
    activeDimension,
    activePeriod,
    activeEntityId,
    selectedEntityIds: selectedIds,
    isConsolidated,
    searchTerm,
    filterConditions: conditions,
    filterOpen,
    filterCount,
    sortField,
    sortDirection,

    // Actions
    switchDimension,
    switchPeriod,
    selectEntity,
    toggleCheckbox,
    viewConsolidated,
    clearSelection,
    setSearchTerm,
    addCondition,
    updateCondition,
    removeCondition,
    clearFilters,
    toggleFilterPanel,
    setSort,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useDashboardState.ts
git commit -m "feat(client): add combined dashboard state hook with client-side filtering/sorting"
```

---

## Task 4: Client-Side Utils — Search, Filter, Sort

**Files:**
- Create: `client/src/utils/search.ts`
- Create: `client/src/utils/filter-engine.ts`
- Create: `client/src/utils/sort-engine.ts`
- Create: `client/src/utils/dimension-config.ts`

- [ ] **Step 1: Write search.ts — spec Section 13.2**

```typescript
// FILE: client/src/utils/search.ts
// PURPOSE: Client-side entity name search (case-insensitive, partial match)
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: searchEntities

import type { EntityListItem } from '@shared/types/dashboard';

export function searchEntities(entities: EntityListItem[], term: string): EntityListItem[] {
  const lower = term.toLowerCase().trim();
  if (!lower) return entities;
  return entities.filter(e => e.name.toLowerCase().includes(lower));
}
```

- [ ] **Step 2: Write filter-engine.ts — spec Section 13.3**

```typescript
// FILE: client/src/utils/filter-engine.ts
// PURPOSE: Client-side filter condition evaluation
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: filterEntities

import type { EntityListItem } from '@shared/types/dashboard';
import type { FilterCondition } from '../hooks/useFilters';

export function filterEntities(entities: EntityListItem[], conditions: FilterCondition[]): EntityListItem[] {
  const activeConditions = conditions.filter(c => c.field && c.operator && c.value !== '');
  if (activeConditions.length === 0) return entities;

  return entities.filter(entity => {
    return activeConditions.every(cond => evaluateCondition(entity, cond));
  });
}

function evaluateCondition(entity: EntityListItem, cond: FilterCondition): boolean {
  const fieldValue = getFieldValue(entity, cond.field);
  const condValue = typeof cond.value === 'string' ? parseFloat(cond.value) || cond.value : cond.value;

  switch (cond.operator) {
    case '>': return typeof fieldValue === 'number' && fieldValue > (condValue as number);
    case '<': return typeof fieldValue === 'number' && fieldValue < (condValue as number);
    case '>=': return typeof fieldValue === 'number' && fieldValue >= (condValue as number);
    case '<=': return typeof fieldValue === 'number' && fieldValue <= (condValue as number);
    case 'equals': return String(fieldValue).toLowerCase() === String(condValue).toLowerCase();
    case 'not equals': return String(fieldValue).toLowerCase() !== String(condValue).toLowerCase();
    default: return true;
  }
}

function getFieldValue(entity: EntityListItem, field: string): number | string {
  const map: Record<string, number | string> = {
    'Total Revenue': entity.revenue,
    'Orders': entity.orderCount,
    'Name': entity.name,
  };
  return map[field] ?? 0;
}
```

- [ ] **Step 3: Write sort-engine.ts — spec Section 15.4**

```typescript
// FILE: client/src/utils/sort-engine.ts
// PURPOSE: Client-side sort with field accessors
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: sortEntities

import type { EntityListItem } from '@shared/types/dashboard';
import type { SortField, SortDirection } from '../hooks/useSort';

export function sortEntities(
  entities: EntityListItem[],
  field: SortField,
  direction: SortDirection,
): EntityListItem[] {
  const getValue = (e: EntityListItem): number | string => {
    switch (field) {
      case 'name': return e.name.toLowerCase();
      case 'revenue': return e.revenue;
      case 'orders': return e.orderCount;
      default: return e.revenue;
    }
  };

  return [...entities].sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return direction === 'asc' ? cmp : -cmp;
  });
}
```

- [ ] **Step 4: Write dimension-config.ts — spec Section 15**

```typescript
// FILE: client/src/utils/dimension-config.ts
// PURPOSE: Per-dimension labels, search placeholders, filter fields — spec Section 15
// USED BY: client/src/components/left-panel/LeftPanel.tsx, SearchBox.tsx, FilterPanel.tsx
// EXPORTS: DIMENSION_CONFIG

import type { Dimension } from '@shared/types/dashboard';

interface DimensionConfig {
  label: string;
  pluralLabel: string;
  searchPlaceholder: string;
  allLabel: string;
  filterFields: string[];
}

export const DIMENSION_CONFIG: Record<Dimension, DimensionConfig> = {
  customer: {
    label: 'Customers', pluralLabel: 'CUSTOMERS',
    searchPlaceholder: 'Search customers...',
    allLabel: 'All Customers',
    filterFields: ['Rep', 'Customer Type', 'Zone', 'Last Order Date', 'Margin %', 'Margin $', 'Total Revenue', 'Average Order', 'Frequency', 'Outstanding'],
  },
  zone: {
    label: 'Zone', pluralLabel: 'ZONES',
    searchPlaceholder: 'Search zones...',
    allLabel: 'All Zones',
    filterFields: ['Rep', 'Last Order Date', 'Margin %', 'Margin $', 'Total Revenue', 'Average Order', 'Frequency', 'Outstanding'],
  },
  vendor: {
    label: 'Vendors', pluralLabel: 'VENDORS',
    searchPlaceholder: 'Search vendors...',
    allLabel: 'All Vendors',
    filterFields: ['Last Order Date', 'Margin %', 'Margin $', 'Total Revenue', 'Average Order', 'Frequency', 'Outstanding'],
  },
  brand: {
    label: 'Brands', pluralLabel: 'BRANDS',
    searchPlaceholder: 'Search brands...',
    allLabel: 'All Brands',
    filterFields: ['Last Order Date', 'Margin %', 'Margin $', 'Total Revenue', 'Average Order', 'Frequency', 'Outstanding'],
  },
  product_type: {
    label: 'Prod. Type', pluralLabel: 'PRODUCT TYPES',
    searchPlaceholder: 'Search product types...',
    allLabel: 'All Product Types',
    filterFields: ['Last Order Date', 'Margin %', 'Margin $', 'Total Revenue', 'Average Order', 'Frequency', 'Outstanding'],
  },
  product: {
    label: 'Products', pluralLabel: 'PRODUCTS',
    searchPlaceholder: 'Search products...',
    allLabel: 'All Products',
    filterFields: ['Last Order Date', 'Margin %', 'Margin $', 'Total Revenue', 'Average Order', 'Frequency', 'Outstanding'],
  },
};
```

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/
git commit -m "feat(client): add client-side search, filter, sort engines and dimension config"
```

---

## Task 5: Consolidated View Aggregation

**File:** `client/src/utils/aggregation.ts`

Implements spec Section 10.5 — aggregating KPIs across multiple selected entities.

- [ ] **Step 1: Write aggregation.ts**

```typescript
// FILE: client/src/utils/aggregation.ts
// PURPOSE: Aggregate KPIs + data across multiple selected entities for consolidated view
// USED BY: client/src/hooks/useDashboardState.ts (when isConsolidated=true)
// EXPORTS: aggregateForConsolidated

import type { DashboardPayload, EntityListItem } from '@shared/types/dashboard';

/** Spec Section 10.5: Consolidated aggregation rules */
export function aggregateForConsolidated(
  fullData: DashboardPayload,
  selectedIds: string[],
): Partial<DashboardPayload> {
  // Filter orders/items to only those belonging to selected entities
  // This is a client-side operation on the already-fetched data
  const selectedSet = new Set(selectedIds);
  const filteredEntities = fullData.entities.filter(e => selectedSet.has(e.id));

  const totalRevenue = filteredEntities.reduce((s, e) => s + e.revenue, 0);
  const totalOrders = filteredEntities.reduce((s, e) => s + e.orderCount, 0);

  return {
    entities: filteredEntities,
    kpis: {
      ...fullData.kpis,
      totalRevenue,
      orders: totalOrders,
      avgOrder: totalOrders > 0 ? totalRevenue / totalOrders : null,
      // Margin % = weighted by revenue, NOT simple average — spec Section 10.5
      // Full recalculation requires raw items; this is approximate from entity-level data
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/utils/aggregation.ts
git commit -m "feat(client): add consolidated view aggregation utility"
```

---

## Task 6: Wire Components to Real Data

**Files:**
- Modify: `client/src/App.tsx` — remove mock data import, use `useDashboardState`
- Modify: `client/src/layouts/DashboardLayout.tsx` — accept full action props
- Modify: All left-panel + right-panel components — wire callbacks

This task connects the Plan B component shell to real data. It involves updating every component's props to accept callbacks from the state hooks.

- [ ] **Step 1: Update DashboardLayout.tsx to pass all callbacks**

Add to the props interface: all `switchDimension`, `selectEntity`, `toggleCheckbox`, `setSearchTerm`, `setSort`, filter actions, `switchPeriod`, `viewConsolidated`, `clearSelection`.

Thread these through to child components.

- [ ] **Step 2: Update LeftPanel to wire DimensionToggles → switchDimension**

Connect `onDimensionChange` to `switchDimension` from state hook.

- [ ] **Step 3: Update SearchBox → setSearchTerm with 300ms debounce**

Add `useEffect` with `setTimeout(300ms)` for debounce. On clear (empty string), apply immediately (no debounce) — spec Section 13.2.

- [ ] **Step 4: Update EntityList → selectEntity + toggleCheckbox**

Connect list item click to `selectEntity`, checkbox to `toggleCheckbox`.

- [ ] **Step 5: Update SelectionBar → viewConsolidated + clearSelection**

Wire buttons to state actions.

- [ ] **Step 6: Update PeriodSelector → switchPeriod**

Connect tab clicks to `switchPeriod`.

- [ ] **Step 7: Update TabsSection → useContacts**

Call `useContacts(activeEntityId, activeTab === 'contacts')` for on-demand contact fetching.

- [ ] **Step 8: Remove mock-data.ts import from App.tsx**

Delete or comment out the `MOCK_DASHBOARD` import. The dashboard now runs on real data.

- [ ] **Step 9: Commit**

```bash
git add client/src/
git commit -m "feat(client): wire all components to real backend data via TanStack Query hooks"
```

---

## Task 7: Animation Choreography — Page Load

**File:** Modify components to add Framer Motion orchestration

Implements spec Section 21.1 — the page load sequence.

- [ ] **Step 1: Add staggered entrance to EntityList items**

In `EntityList.tsx`, wrap items in Framer Motion `motion.div` with:
```tsx
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: index * 0.03 }}  // 30ms stagger per item
```

- [ ] **Step 2: Add KPI counter animation**

In `AnimatedNumber.tsx`, use Framer Motion `useSpring` + `useTransform`:
```tsx
const spring = useSpring(0, { stiffness: 100, damping: 20 });
// On value change: spring.set(newValue)
// Display: useTransform(spring, v => formatFn(Math.round(v)))
```

- [ ] **Step 3: Add chart bar grow animation**

In `YoYBarChart.tsx`, animate bars from `scaleY(0)` to `scaleY(1)` with `transform-origin: bottom`, staggered 30ms per month.

- [ ] **Step 4: Add donut ring draw animation**

In `ProductMixDonut.tsx`, animate `stroke-dasharray` from 0 to full circumference, 600ms ease-out.

- [ ] **Step 5: Add skeleton → content crossfade**

Wrap data-dependent sections in:
```tsx
<AnimatePresence mode="wait">
  {isLoading ? <Skeleton key="skeleton" /> : <Content key="content" />}
</AnimatePresence>
```

- [ ] **Step 6: Add selection bar slide animation**

Wrap `SelectionBar` in `AnimatePresence` with `initial={{ y: '100%' }}` → `animate={{ y: 0 }}`.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/
git commit -m "feat(client): add Framer Motion page load choreography and data transition animations"
```

---

## Task 8: Reduced Motion + Accessibility Final Pass

- [ ] **Step 1: Add `prefers-reduced-motion` media query**

In `index.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Verify all ARIA attributes from spec Section 9**

Check each component has correct `role`, `aria-label`, `aria-selected`, `aria-expanded`, etc.

- [ ] **Step 3: Verify keyboard navigation from spec Section 9.2**

Test: Tab through regions, arrow keys in dimension tabs and entity list, Enter to select, Space for checkboxes, Escape to close panels.

- [ ] **Step 4: Add screen reader announcements**

Add `aria-live="polite"` region for list count changes, filter applied, period changed, consolidated view.

- [ ] **Step 5: Commit**

```bash
git add client/src/
git commit -m "feat(client): add reduced motion support and accessibility final pass"
```

---

## Task 9: Export Functionality — Spec Section 16

**Files:**
- Create: `client/src/hooks/useExport.ts`
- Modify: `client/src/components/right-panel/DetailHeader.tsx` — wire Export button

- [ ] **Step 1: Write useExport hook**

```typescript
// FILE: client/src/hooks/useExport.ts
// PURPOSE: CSV export of current dashboard view — spec Section 16
// USED BY: client/src/components/right-panel/DetailHeader.tsx
// EXPORTS: useExport

import { useCallback, useState } from 'react';
import type { DashboardPayload } from '@shared/types/dashboard';
import { formatCurrency, formatPercent, formatDate } from '@shared/utils/formatting';

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportCSV = useCallback((
    dashboard: DashboardPayload,
    entityName: string,
    period: string,
  ) => {
    setIsExporting(true);
    try {
      const rows: string[] = [];

      // KPIs section
      rows.push('--- KPIs ---');
      rows.push('KPI,Value,Trend,Previous');
      rows.push(`Total Revenue,${formatCurrency(dashboard.kpis.totalRevenue)},${dashboard.kpis.revenueChangePercent?.toFixed(1) ?? ''}%,${formatCurrency(dashboard.kpis.prevYearRevenue)}`);
      rows.push(`Orders,${dashboard.kpis.orders},${dashboard.kpis.ordersChange > 0 ? '+' : ''}${dashboard.kpis.ordersChange},`);

      // Orders section
      rows.push('');
      rows.push('--- Orders ---');
      rows.push('Date,Order #,Items,Amount,Margin %,Margin $,Status');
      dashboard.orders.forEach(o => {
        rows.push(`${formatDate(o.date)},${o.orderNumber},${o.itemCount},${formatCurrency(o.amount)},${formatPercent(o.marginPercent)},${formatCurrency(o.marginAmount)},${o.status}`);
      });

      // Items section
      rows.push('');
      rows.push('--- Items ---');
      rows.push('Category,Product,SKU,Value,Margin %,Margin $');
      dashboard.items.forEach(cat => {
        cat.products.forEach(p => {
          rows.push(`${cat.category},${p.name},${p.sku},${formatCurrency(p.value)},${formatPercent(p.marginPercent)},${formatCurrency(p.marginAmount)}`);
        });
      });

      const csv = rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${entityName.replace(/[^a-zA-Z0-9]/g, '_')}_${period}_${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportCSV, isExporting };
}
```

- [ ] **Step 2: Wire Export button in DetailHeader**

Connect the Export button's `onClick` to `exportCSV(dashboard, entity.name, activePeriod)`. Show spinner during `isExporting`.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useExport.ts
git commit -m "feat(client): add CSV export functionality"
```

---

## Task 10: Responsive Layout — Spec Section 14

**Files:**
- Modify: `client/src/styles/index.css` — add responsive breakpoints
- Modify: `client/src/layouts/DashboardLayout.tsx` — responsive classes

- [ ] **Step 1: Add responsive breakpoints to DashboardLayout**

```tsx
// In DashboardLayout.tsx, update the main container:
<div className="mx-auto flex h-[calc(100vh-32px)] max-w-[1440px] gap-[var(--spacing-2xl)] p-[var(--spacing-2xl)]
  max-lg:flex-col max-lg:h-auto max-lg:overflow-y-auto
">
  {/* Left panel — 280px on desktop, full width on narrow */}
  <div className="flex w-[280px] shrink-0 flex-col gap-[var(--spacing-base)]
    max-lg:w-full max-lg:flex-row max-lg:flex-wrap max-lg:gap-[var(--spacing-md)]
  ">
    {/* On narrow screens, dim toggles and search go side by side */}
  </div>

  {/* Right panel — flex:1 on desktop, full width below */}
  <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-base)] overflow-y-auto pr-[var(--spacing-xs)]
    max-lg:pr-0
  ">
  </div>
</div>
```

- [ ] **Step 2: Add responsive KPI grid**

On screens < 1024px, KPI section becomes single column:
```tsx
// In KPISection.tsx:
className="grid grid-cols-2 gap-[var(--spacing-base)] max-lg:grid-cols-1"
```

Charts stack vertically:
```tsx
// In ChartsRow.tsx:
className="grid grid-cols-[3fr_5fr] gap-[var(--spacing-lg)] max-lg:grid-cols-1"
```

- [ ] **Step 3: Commit**

```bash
git add client/src/layouts/ client/src/components/
git commit -m "feat(client): add responsive breakpoints for compact and narrow viewports"
```

---

## Task 11: Dockerfile + Railway Deploy Config

**Files:**
- Create: `Dockerfile`
- Create: `railway.json`
- Create: `.dockerignore`

- [ ] **Step 1: Write Dockerfile (multi-stage build)**

```dockerfile
# FILE: Dockerfile
# PURPOSE: Multi-stage build — builds client + server, serves from Express in production
# USED BY: Railway auto-deploy

# Stage 1: Build client
FROM node:22-alpine AS client-build
WORKDIR /app
COPY shared/ shared/
COPY client/package*.json client/
RUN cd client && npm ci
COPY client/ client/
RUN cd client && npm run build

# Stage 2: Build server
FROM node:22-alpine AS server-build
WORKDIR /app
COPY shared/ shared/
COPY server/package*.json server/
RUN cd server && npm ci
COPY server/ server/
RUN cd server && npm run build

# Stage 3: Production
FROM node:22-alpine
WORKDIR /app
COPY --from=server-build /app/server/dist server/dist/
COPY --from=server-build /app/server/package*.json server/
COPY --from=server-build /app/server/node_modules server/node_modules/
COPY --from=client-build /app/client/dist client/dist/
COPY shared/ shared/

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
```

- [ ] **Step 2: Write railway.json**

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node server/dist/index.js",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

- [ ] **Step 3: Write .dockerignore**

```
node_modules
.git
.env
.env.*
*.md
docs
tools
learnings
.claude
.superpowers
```

- [ ] **Step 4: Test Docker build locally**

Run: `docker build -t sales-dashboard .`
Expected: Build completes. Image created.

Run: `docker run -p 3001:3001 --env-file server/.env sales-dashboard`
Expected: Server starts, `localhost:3001` serves the dashboard

- [ ] **Step 5: Commit**

```bash
git add Dockerfile railway.json .dockerignore
git commit -m "feat: add Dockerfile + Railway config for production deployment"
```

---

## Task 12: Pre-Deploy Verification

- [ ] **Step 1: TypeScript check (both projects)**

Run: `cd client && npx tsc -b --noEmit && cd ../server && npx tsc --noEmit`
Expected: 0 errors in both

- [ ] **Step 2: Server tests**

Run: `cd server && npx vitest run`
Expected: All 45 tests PASS

- [ ] **Step 3: Full dev smoke test**

Run both dev servers:
- Terminal 1: `cd server && npm run dev`
- Terminal 2: `cd client && npm run dev`

Open `localhost:5173` and verify:
- Dashboard loads with real Priority ERP data
- Dimension switching works (all 6 dimensions)
- Search filters the list (300ms debounce)
- Period tabs switch data
- Entity selection loads detail view
- Multi-select + "View Consolidated" works
- Contacts tab loads on demand
- Animations play on transitions

- [ ] **Step 4: Airtable embed test**

Deploy to Railway. In Airtable Interface page, update the Omni block URL to the Railway domain. Verify:
- [ ] Dashboard fits within Omni block without horizontal scrollbar
- [ ] Vertical scroll works
- [ ] No CORS errors in console
- [ ] Hover states work
- [ ] Font rendering is consistent

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: Plan C complete — fully integrated dashboard ready for Railway deploy"
```

---

## Plan C Summary

| Task | What | Key Spec Sections |
|------|------|-------------------|
| 0 | TanStack Query setup + dashboard data hook | 6 |
| 1 | Contacts hook (on-demand) | 17.3 |
| 2 | UI state hooks (dimension, period, selection, search, filters, sort) | 13.1-13.5 |
| 3 | Combined dashboard state hook | 5, 7 |
| 4 | Client-side utils (search, filter, sort, dimension config) | 13.2, 13.3, 15 |
| 5 | Consolidated view aggregation | 10.5 |
| 6 | Wire components to real data | All |
| 7 | Animation choreography (page load, transitions) | 12, 21 |
| 8 | Reduced motion + accessibility final pass | 9, 12.3 |
| 9 | CSV export functionality | 16 |
| 10 | Responsive layout breakpoints | 14 |
| 11 | Dockerfile + Railway deploy config | — |
| 12 | Pre-deploy verification | 25.3 |

**Total: 13 tasks, ~40 steps, 14 new files + modifications to Plan B components**

---

## Cross-Plan Dependency Graph

```
Plan A (Backend)          Plan B (Frontend Shell)
  │                         │
  │ shared/types/           │ shared/types/
  │ (dashboard.ts)          │ (dashboard.ts)
  │                         │
  ▼                         ▼
  API at :3001              UI at :5173 (mock data)
       │                         │
       └────────┬────────────────┘
                │
                ▼
          Plan C (Integration)
                │
                ▼
          Working dashboard
          deployed on Railway
```

**Execution order:** Plans A and B can run in parallel (both depend only on `shared/types/`). Plan C must run after both A and B are complete.

---

## Parallelization Map

Plan C has less parallelism than A and B because tasks build on each other (hooks depend on utils, wiring depends on hooks). However, there are two independent parallel tracks.

```
Sequential prerequisites:
  Task 0 (TanStack Query setup) → Task 1 (contacts hook)

After Task 1, two tracks can run in parallel:
  ┌─ Agent 1 (State + Utils): Task 2 (UI state hooks) → Task 3 (combined state) → Task 4 (search/filter/sort utils)
  └─ Agent 2 (Standalone):    Task 5 (consolidated aggregation) + Task 9 (export hook)

After both agents complete:
  Task 6 (wire components) → Task 7 (animations) → Task 8 (a11y pass) → Task 10 (responsive)

Deploy track (can start after Task 6):
  Task 11 (Dockerfile) → Task 12 (verification)
```

**Why Agent 2 is independent:** `aggregation.ts` and `useExport.ts` only import from `shared/types/` and `shared/utils/` — they don't depend on the state hooks Agent 1 is building.

### Cross-Plan Parallel Dispatch

The biggest parallelization win is at the **plan level**:

```
                   Task 1: shared/types/dashboard.ts
                              │
              ┌────────────────┼────────────────┐
              ▼                                  ▼
    Plan A (Backend)                  Plan B (Frontend Shell)
    13 tasks, 5 agents max           20 tasks, 5 agents max
              │                                  │
              └────────────────┬─────────────────┘
                               ▼
                    Plan C (Integration)
                    13 tasks, 2 agents max
```

**To dispatch Plans A and B in parallel:**

```
Agent A: "Execute Plan A (docs/plans/2026-03-30-plan-a-backend.md) using
subagent-driven-development. Only write to server/ and shared/ directories.
Use the parallelization map in the plan to dispatch sub-agents concurrently."

Agent B: "Execute Plan B (docs/plans/2026-03-30-plan-b-frontend-shell.md) using
subagent-driven-development. Only write to client/ directory. shared/types/
is read-only (created by Agent A). Use the parallelization map in the plan
to dispatch sub-agents concurrently."
```

**Constraint enforcement:** Agent A owns `server/` + `shared/`. Agent B owns `client/`. No file conflicts possible.
