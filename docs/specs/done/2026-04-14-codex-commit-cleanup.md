# Codex Commit Cleanup — fcb374c

**Date:** 2026-04-14
**Branch:** `codex/dashboard-ux-refactor`
**Commit:** `fcb374c` "Improve dashboard UX interactions"

## Context

Codex delivered a solid UX commit (URL-backed state, a11y improvements, HoverPeek removal, locale-aware formatting). During review, four issues were identified that need follow-up before merging to main. This spec addresses all four.

## Changes

### 1. Delete dead hooks + relocate sort types

**Problem:** Four hooks were replaced by `useDashboardShellState` but left on disk.

**Files to delete:**
- `client/src/hooks/useDimension.ts` (20 lines) — no importers
- `client/src/hooks/usePeriod.ts` (17 lines) — no importers
- `client/src/hooks/useSearch.ts` (17 lines) — no importers
- `client/src/hooks/useSort.ts` (57 lines) — hook unused, but types still imported

**Type relocation:** `SortField` and `SortDirection` from `useSort.ts` are imported by 4 files:
- `client/src/hooks/useDashboardShellState.ts`
- `client/src/layouts/dashboard-layout-types.ts`
- `client/src/utils/sort-engine.ts`
- `client/src/components/left-panel/LeftPanel.tsx`

**Action:** Create `client/src/hooks/sort-types.ts` (~15 lines) containing only the two type exports. Update all 4 importers to `from './sort-types'` (or `'../../hooks/sort-types'`). Then delete `useSort.ts`.

### 2. Data-driven KPISection refactor

**Problem:** `KPISection.tsx` is 309 lines. The 6 KPI cards (lines 94–286) follow an identical pattern: label, value, formatter, breakdown accessor, sub-items builder, modal content. Each card duplicates ~30 lines of near-identical JSX, and the modal content duplicates the card props again.

**Action:** Extract a `KPICardConfig` type and build the 5 standard cards (Orders, Avg. Order, Margin %, Margin $, Frequency) from a config array. The 6th card (Last Order) has a different shape (no breakdown, no sub-items, has `statusDot`) — keep it inline.

**Config shape:**
```typescript
interface KPICardConfig {
  label: string;
  cardIndex: number;  // for useCardNavigation
  getValue: (kpis: KPIs) => number;
  formatter: (n: number) => string;
  /** WHY: Avg Order, Margin %, Frequency have nullable KPI values — show em-dash when null */
  isNullable?: boolean;
  getBreakdown: (kpis: KPIs) => KPIBreakdown;
  /** WHY: Sub-items use the same formatter as the main value (e.g., formatInteger for Orders) */
  formatSubItem: (value: number) => string;
}
```

**Where the config lives:** Same file (`KPISection.tsx`). The config is a function of `kpis` so it can't be a module-level constant — build it inside the component as a `useMemo` array. This avoids a new file while cutting the JSX from ~190 lines to ~50 lines (map over configs).

**Key detail — deduplicating card + modal props:** Currently each card's `onExpand` callback manually re-builds the same props as a `<KPIModalContent>`. Instead, build a `buildCardProps(config, kpis, breakdown, labels)` helper that returns the shared prop object once. Pass it to both `<KPICard {...props}>` and `<KPIModalContent {...props}>`.

**Target:** KPISection.tsx under 200 lines after refactor.

### 3. Revert Orders tab default filter

**Problem:** Codex changed the default from `'last30'` to `null`, showing all orders on first load. For customers with thousands of orders, this is both slow and overwhelming.

**Action:** One-line change in `client/src/components/right-panel/OrdersTab.tsx`:
```typescript
// Before (Codex):
const [activeFilter, setActiveFilter] = useState<OrderTimeFilter | null>(null);

// After (revert):
const [activeFilter, setActiveFilter] = useState<OrderTimeFilter | null>('last30');
```

### 4. Add tests for URL state parsing/building

**Problem:** `useDashboardShellState.ts` (187 lines) has zero test coverage for its URL parsing and building logic.

**Approach:** The pure functions `parseSearch()` and `buildSearch()` are currently private (module-scoped). Extract them into a separate testable module:

**New file:** `client/src/hooks/shell-state-url.ts` (~60 lines)
- Exports: `parseSearch`, `buildSearch`, `DEFAULT_STATE`
- Exports: validation sets (`VALID_DIMENSIONS`, `VALID_TABS`, etc.) for use in tests
- Pure functions, no React hooks, no `window` side effects in `buildSearch`

**Modified file:** `client/src/hooks/useDashboardShellState.ts`
- Imports `parseSearch`, `buildSearch`, `DEFAULT_STATE` from `./shell-state-url`
- `writeUrl()` stays here (it touches `window.history`)

**Test file:** `client/src/hooks/__tests__/shell-state-url.test.ts`

**Test cases:**

| Category | Test |
|----------|------|
| Parse defaults | Empty search string → DEFAULT_STATE |
| Parse valid | `?dim=vendor&period=2024&entity=C7826&tab=items` → correct state |
| Parse invalid dimension | `?dim=invalid` → falls back to `'customer'` |
| Parse invalid tab | `?tab=bogus` → falls back to `'orders'` |
| Parse invalid sort | `?sort=nonexistent&dir=sideways` → falls back to `id`/`asc` |
| Parse partial | `?dim=zone` → zone dimension, all other fields default |
| Build minimal | DEFAULT_STATE → empty string (no params for defaults) |
| Build full | All non-default values → correct query string |
| Build sort pairing | Custom sort field → both `sort` and `dir` appear |
| Round-trip | buildSearch(parseSearch(url)) === url for valid URLs |
| Round-trip defaults | parseSearch('') then buildSearch → empty string |

## Files touched

| Action | File | Lines |
|--------|------|-------|
| Delete | `client/src/hooks/useDimension.ts` | -20 |
| Delete | `client/src/hooks/usePeriod.ts` | -17 |
| Delete | `client/src/hooks/useSearch.ts` | -17 |
| Delete | `client/src/hooks/useSort.ts` | -57 |
| Create | `client/src/hooks/sort-types.ts` | +15 |
| Create | `client/src/hooks/shell-state-url.ts` | +60 |
| Create | `client/src/hooks/__tests__/shell-state-url.test.ts` | +80 |
| Modify | `client/src/hooks/useDashboardShellState.ts` | ~-40 (extract pure functions) |
| Modify | `client/src/components/right-panel/KPISection.tsx` | ~-100 (data-driven) |
| Modify | `client/src/components/right-panel/OrdersTab.tsx` | 1 line |
| Modify | `client/src/hooks/useDashboardShellState.ts` | update import |
| Modify | `client/src/layouts/dashboard-layout-types.ts` | update import |
| Modify | `client/src/utils/sort-engine.ts` | update import |
| Modify | `client/src/components/left-panel/LeftPanel.tsx` | update import |

**Net:** -3 files deleted, +3 files created, 6 files modified. ~100 fewer lines of production code, +80 lines of tests.

## Verification

```bash
# TypeScript builds
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit

# Server tests (existing)
cd ../server && npx vitest run

# Client tests (new + existing)
cd ../client && npx vitest run

# Confirm dead hooks deleted
ls client/src/hooks/useDimension.ts client/src/hooks/usePeriod.ts client/src/hooks/useSearch.ts client/src/hooks/useSort.ts 2>&1 | grep "No such file"

# Confirm no stale imports
grep -rn "from.*useDimension\|from.*usePeriod\|from.*useSearch" client/src/

# Confirm sort type imports updated
grep -rn "from.*sort-types" client/src/

# Bundle size check
cd client && npx vite build

# File size check
wc -l client/src/components/right-panel/KPISection.tsx  # must be <300
```

## Out of scope

- The commit bundles 7 concerns into one commit. We won't rewrite git history.
- `useDashboardShellState` hook-level integration tests (testing `popstate`, `pushState` calls) — would require JSDOM mocking of `window.history`. The pure-function tests cover the critical logic.
- Further decomposition of `useDashboardShellState.ts` (187 lines, under limit).
