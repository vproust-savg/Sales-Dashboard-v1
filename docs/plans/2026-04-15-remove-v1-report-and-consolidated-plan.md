# Remove v1 Report & View Consolidated Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the broken v1 "Report" (`AllEntityEntry` / `__ALL__`) and v1 "View Consolidated" (`SelectionBar` dark button) code paths, then rename the surviving v2 surface to drop the `2` suffix, resulting in a single, unambiguous "Report" + "View Consolidated" implementation.

**Architecture:** Two commits on a feature branch (`chore/remove-v1`). Commit 1 is a pure deletion that keeps the v2 surface untouched but with its `2` suffix intact. Commit 2 is a pure rename (`git mv` + identifier-aware find/replace) with no semantic changes. Each commit must independently pass `tsc` + `vitest run` + `vite build` before it can be pushed. Merge the PR with "Rebase and merge" or a standard merge commit — NOT "Squash and merge" — so each commit survives on `main` as an independently revertable unit.

**Tech Stack:** React 19 + TypeScript strict (client); Express + TypeScript strict + Zod + Upstash Redis (server); Vitest.

**Spec:** `docs/specs/2026-04-15-remove-v1-report-and-consolidated-design.md`

---

## File Structure

### Files to delete (commit 1)

| Path | Reason |
|------|--------|
| `client/src/components/left-panel/AllEntityEntry.tsx` | v1 pinned "Load All" row |
| `client/src/components/shared/FetchAllDialog.tsx` | v1 filter modal (superseded by `Report2FilterModal`) |
| `client/src/components/right-panel/FetchAllProgress.tsx` | v1 inline progress card (superseded by `Report2ProgressModal`) |
| `client/src/hooks/useFetchAll.ts` | v1 SSE hook (v2's `useReport2` calls the same endpoint) |
| `client/src/layouts/select-display-dashboard.ts` | v1 display selector (no longer needed once `__ALL__` and `isConsolidated` are gone) |
| `client/src/layouts/__tests__/select-display-dashboard.test.ts` | Companion test — dies with its module |

### Files to modify — remove v1 references (commit 1)

| Path | Responsibility after the change |
|------|---------------------------------|
| `client/src/hooks/useEntitySelection.ts` | Only owns multi-select (`selectedIds`) + active entity ID. No `isConsolidated` / `viewConsolidated`. |
| `client/src/hooks/useDashboardData.ts` | Exports only `useEntities` + `useDashboardDetail`. No `useConsolidatedDashboard`. Drops the `__ALL__` guard in `useDashboardDetail`. |
| `client/src/hooks/useDashboardState.ts` | Drops all v1 fetch/consolidated plumbing. `finalDashboard` reduces to `dashboard` directly. |
| `client/src/components/left-panel/SelectionBar.tsx` | Only renders the v2 `ViewConsolidated2Button` and the Clear link. Drops `dataLoaded` + `onViewConsolidated`. |
| `client/src/components/left-panel/EntityList.tsx` | No `<AllEntityEntry>` render. Drops 6 v1 props. |
| `client/src/components/left-panel/LeftPanel.tsx` | Drops 7 v1 props from its interface and their pass-through to `EntityList`. |
| `client/src/layouts/DashboardLayout.tsx` | No v1 dialog state, handlers, destructures, or `selectDisplayDashboard` call. |
| `client/src/layouts/dashboard-layout-types.ts` | Drops 10 v1 fields from `DashboardLayoutProps`. |
| `shared/types/dashboard.ts` | Removes `EntityListLoadState` (v1-only). Keeps `FetchAllFilters` + `SSEProgressEvent` (v2 uses both). |

### Files to rename with `git mv` (commit 2)

| Before | After |
|--------|-------|
| `client/src/hooks/useReport2.ts` | `client/src/hooks/useReport.ts` |
| `client/src/hooks/useConsolidated2.ts` | `client/src/hooks/useConsolidated.ts` |
| `client/src/components/left-panel/Report2Button.tsx` | `client/src/components/left-panel/ReportButton.tsx` |
| `client/src/components/left-panel/ViewConsolidated2Button.tsx` | `client/src/components/left-panel/ViewConsolidatedButton.tsx` |
| `client/src/components/shared/Report2FilterModal.tsx` | `client/src/components/shared/ReportFilterModal.tsx` |
| `client/src/components/shared/Report2ProgressModal.tsx` | `client/src/components/shared/ReportProgressModal.tsx` |
| `client/src/components/shared/Consolidated2ConfirmModal.tsx` | `client/src/components/shared/ConsolidatedConfirmModal.tsx` |

### Files to modify — identifier / label / cache key rename (commit 2)

| Path | Change |
|------|--------|
| All files importing the renamed modules | Update import paths and imported identifier names. |
| `client/src/hooks/useDashboardState.ts` | `report2` → `report`, `consolidated2` → `consolidated` in internal vars and return object. |
| `client/src/layouts/DashboardLayout.tsx` | `'report2'`/`'consolidated2'` literals → `'report'`/`'consolidated'`. Handler and prop renames. |
| `client/src/layouts/dashboard-layout-types.ts` | `report2`/`consolidated2` field renames. |
| `client/src/components/left-panel/LeftPanel.tsx`, `EntityList.tsx`, `SelectionBar.tsx` | `onReport2Click`, `onViewConsolidated2`, `report2State`, `report2Payload`, `activeView` literals — all renamed. |
| `client/src/components/shared/ReportFilterModal.tsx` | `aria-label="Report 2 filters"` → `aria-label="Report filters"`. |
| `server/src/cache/cache-keys.ts` | `CacheEntity` literal `'report2_payload'` → `'report_payload'`. |
| `server/src/config/constants.ts` | `report2_payload` TTL key → `report_payload`. |
| `server/src/routes/fetch-all.ts`, `server/src/routes/dashboard.ts` | Any reference to `'report2_payload'` via the `cacheKey(...)` helper — update through the renamed literal. |

---

## Phase 0 — Safety setup

### Task 0.1: Verify baseline and create safety anchors

**Goal:** Start from a known-green `main` and establish a revert anchor before any code changes.

- [ ] **Step 1: Confirm working directory is the repo root**

Run:
```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1"
pwd
```
Expected: the path above.

- [ ] **Step 2: Confirm the branch is clean and on `main`**

Run:
```bash
git status
git branch --show-current
```
Expected: "nothing to commit, working tree clean" and branch `main`. If not clean, stop and ask the user whether to stash or commit the unrelated work before proceeding.

- [ ] **Step 3: Fast-forward `main` to origin**

Run:
```bash
git pull --ff-only origin main
```
Expected: "Already up to date." or a fast-forward result. No merge commits.

- [ ] **Step 4: Run the full pre-deploy verification suite**

Run each command and capture its exit code:
```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
cd ../server && npx vitest run
cd ../client && npx vite build
```
Expected: every command exits 0. `vitest run` reports 121 tests passed. `vite build` reports bundle size under 500 KB gzip. If any fails, STOP — fix before starting the removal; do not remove from a broken base.

- [ ] **Step 5: Tag the current HEAD as the revert anchor**

Run:
```bash
cd ..
git tag pre-v1-removal
git push origin pre-v1-removal
```
Expected: "To github.com/…" with "new tag" line.

- [ ] **Step 6: Create and check out the feature branch**

Run:
```bash
git checkout -b chore/remove-v1
```
Expected: "Switched to a new branch 'chore/remove-v1'".

---

## Phase 1 — Commit 1: Delete v1 View Consolidated button path

### Task 1.1: Delete the v1 "View Consolidated" button from `SelectionBar`

**Files:**
- Modify: `client/src/components/left-panel/SelectionBar.tsx`

- [ ] **Step 1: Remove the v1 button JSX and its two props**

Replace the entire contents of `client/src/components/left-panel/SelectionBar.tsx` with:

```tsx
// FILE: client/src/components/left-panel/SelectionBar.tsx
// PURPOSE: Slide-up bar at bottom of entity list showing selected count + "View Consolidated"
// USED BY: client/src/components/left-panel/LeftPanel.tsx
// EXPORTS: SelectionBar

import { AnimatePresence, motion } from 'framer-motion';
import { ViewConsolidated2Button } from './ViewConsolidated2Button';

interface SelectionBarProps {
  selectedCount: number;
  onViewConsolidated2: () => void;
  onClear: () => void;
}

export function SelectionBar({ selectedCount, onViewConsolidated2, onClear }: SelectionBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 57, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 57, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="
            sticky bottom-0 z-10
            flex h-[57px] items-center justify-between
            border-t border-[var(--color-gold-muted)]
            bg-[var(--color-bg-page)] px-[var(--spacing-2xl)] py-[var(--spacing-base)]
            backdrop-blur-[8px]
          "
        >
          {/* Left — selected count with checkbox icon */}
          <div className="flex items-center gap-[var(--spacing-sm)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="12" height="12" rx="3" stroke="var(--color-gold-primary)" strokeWidth="1.5" />
              <path d="M4 7L6 9L10 5" stroke="var(--color-gold-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
              {selectedCount} selected
            </span>
          </div>

          {/* Right — Clear link + v2 View Consolidated button */}
          <div className="flex items-center gap-[var(--spacing-md)]">
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-[var(--color-text-muted)] underline transition-colors duration-100 hover:text-[var(--color-text-secondary)]"
            >
              Clear
            </button>
            <ViewConsolidated2Button onClick={onViewConsolidated2} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify TypeScript reports the expected cascade of errors**

Run: `cd client && npx tsc -b --noEmit`

Expected: errors in `EntityList.tsx` (still passes `dataLoaded` and `onViewConsolidated` to `SelectionBar`). This is expected — we'll fix it in the next task. Do NOT commit yet.

### Task 1.2: Remove the `onViewConsolidated` + `dataLoaded` prop thread from `EntityList` → `LeftPanel` → `DashboardLayout`

**Files:**
- Modify: `client/src/components/left-panel/EntityList.tsx`
- Modify: `client/src/components/left-panel/LeftPanel.tsx`
- Modify: `client/src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: In `EntityList.tsx`, remove the v1 button props and the pass-through to `SelectionBar`**

Change the `SelectionBar` call site (around line 128) from:

```tsx
<SelectionBar
  selectedCount={selectedCount}
  dataLoaded={dataLoaded}
  onViewConsolidated={onViewConsolidated}
  onViewConsolidated2={onViewConsolidated2}
  onClear={onClearSelection}
/>
```

to:

```tsx
<SelectionBar
  selectedCount={selectedCount}
  onViewConsolidated2={onViewConsolidated2}
  onClear={onClearSelection}
/>
```

Then remove `onViewConsolidated: () => void;` from the `EntityListProps` interface and remove `onViewConsolidated` from the destructured parameters. Keep `dataLoaded` on `EntityListProps` — it's still used at line 71 for the header count.

- [ ] **Step 2: In `LeftPanel.tsx`, remove the `onViewConsolidated` prop from the interface, the destructure, and the pass-through to `EntityList`**

Remove the line `onViewConsolidated: () => void;` from `LeftPanelProps`. Remove `onViewConsolidated` from the destructured parameters. Remove the `onViewConsolidated={onViewConsolidated}` line from the `<EntityList ... />` call.

- [ ] **Step 3: In `DashboardLayout.tsx`, stop passing `onViewConsolidated` to `<LeftPanel>`**

Find the `<LeftPanel ... />` JSX (around line 184) and delete the line `onViewConsolidated={viewConsolidated}`. Leave the `viewConsolidated` destructure in place for now — we'll remove it in Task 1.4.

- [ ] **Step 4: Verify TypeScript**

Run: `cd client && npx tsc -b --noEmit`

Expected: the prop-chain errors are gone. There may still be "unused variable" warnings around `viewConsolidated` in `DashboardLayout.tsx` — those resolve when we remove the destructure in Task 1.4. If `tsc` reports errors other than unused-variable warnings, STOP and review.

### Task 1.3: Remove `useConsolidatedDashboard` from `useDashboardData.ts`

**Files:**
- Modify: `client/src/hooks/useDashboardData.ts`

- [ ] **Step 1: Delete the consolidated section**

In `useDashboardData.ts`, delete everything from the comment `// --- Stage 3: Consolidated data for multi-select ---` (around line 85) through the closing `}` of the `useConsolidatedDashboard` export. Also delete the `fetchConsolidatedDashboard` helper above it.

- [ ] **Step 2: Remove the `__ALL__` guard from `useDashboardDetail`**

The `enabled` line of `useDashboardDetail` currently reads:

```ts
enabled: entityId !== null && entityId !== '__ALL__',
```

Simplify to:

```ts
enabled: entityId !== null,
```

Leave the existing `// WHY: Only fetch when an entity is selected` comment above the line untouched — it is still accurate.

- [ ] **Step 3: Update the intent block at the top of the file**

Change the `EXPORTS:` line from:

```
// EXPORTS: useEntities, useDashboardDetail, useConsolidatedDashboard
```

to:

```
// EXPORTS: useEntities, useDashboardDetail
```

- [ ] **Step 4: Verify TypeScript**

Run: `cd client && npx tsc -b --noEmit`

Expected: new errors in `useDashboardState.ts` (still imports `useConsolidatedDashboard`). We fix that next.

### Task 1.4: Strip v1 state from `useDashboardState.ts`

**Files:**
- Modify: `client/src/hooks/useDashboardState.ts`

- [ ] **Step 1: Remove imports for v1-only hooks**

Find the import block near the top. Change:

```ts
import { useEntities, useDashboardDetail, useConsolidatedDashboard } from './useDashboardData';
```

to:

```ts
import { useEntities, useDashboardDetail } from './useDashboardData';
```

Then delete the `useFetchAll` import line:

```ts
import { useFetchAll } from './useFetchAll';
```

- [ ] **Step 2: Remove the `useFetchAll` call and its destructure**

Delete the entire block:

```ts
const {
  loadState: fetchAllLoadState, progress: fetchAllProgress,
  allDashboard, error: fetchAllError,
  startFetchAll, abortFetch,
} = useFetchAll(activeDimension, activePeriod);
const dataLoaded = fetchAllLoadState === 'loaded';
```

- [ ] **Step 3: Remove the `abortFetch` call inside `switchDimension`**

In the `switchDimension` useCallback (spec Section 13.1), delete the `abortFetch();` line inside the body, and remove `abortFetch` from the dependency array. Do the same for the second useEffect that also calls `abortFetch()`.

After this step, `switchDimension` looks like:

```ts
const switchDimension = useCallback((dim: Dimension) => {
  setShellDimension(dim);
  clearSelection();
  resetSearch();
  clearFilters();
  resetSort();
  report2.reset();
  consolidated2.reset();
}, [setShellDimension, clearSelection, resetSearch, clearFilters, resetSort, report2, consolidated2]);
```

And the follow-up `useEffect` becomes:

```ts
useEffect(() => {
  if (prevDimensionRef.current === activeDimension) return;
  prevDimensionRef.current = activeDimension;
  clearSelection();
  clearFilters();
}, [activeDimension, clearSelection, clearFilters]);
```

- [ ] **Step 4: Remove `isConsolidated` / `viewConsolidated` from the `useEntitySelection` destructure**

Change:

```ts
const {
  activeEntityId, selectedIds, isConsolidated,
  selectEntity, toggleCheckbox, viewConsolidated, clearSelection,
} = useEntitySelection({ activeEntityId: shellActiveEntityId, onActiveEntityChange: setActiveEntityId });
```

to:

```ts
const {
  activeEntityId, selectedIds,
  selectEntity, toggleCheckbox, clearSelection,
} = useEntitySelection({ activeEntityId: shellActiveEntityId, onActiveEntityChange: setActiveEntityId });
```

- [ ] **Step 5: Remove the Stage 3 consolidated query**

Delete the entire Stage-3 block:

```ts
// --- Stage 3: Consolidated data for multi-select (on-demand) ---
const consolidatedQuery = useConsolidatedDashboard({
  entityIds: selectedIds,
  groupBy: activeDimension,
  period: activePeriod,
  enabled: isConsolidated && selectedIds.length > 0,
});
const consolidatedDashboard = consolidatedQuery.data?.data ?? null;
```

- [ ] **Step 6: Simplify `finalDashboard`**

Change:

```ts
const finalDashboard = useMemo(() => {
  if (isConsolidated && consolidatedDashboard) {
    return { ...consolidatedDashboard, entities: processedEntities };
  }
  if (!dashboard) return null;
  return { ...dashboard, entities: processedEntities };
}, [dashboard, consolidatedDashboard, isConsolidated, processedEntities]);
```

to:

```ts
const finalDashboard = useMemo(() => {
  if (!dashboard) return null;
  return { ...dashboard, entities: processedEntities };
}, [dashboard, processedEntities]);
```

- [ ] **Step 7: Remove the `isConsolidatedLoading` local**

Delete the line:

```ts
const isConsolidatedLoading = consolidatedQuery.isLoading && isConsolidated;
```

- [ ] **Step 8: Strip v1 fields from the return object**

In the final `return { ... }` block, delete these fields (they currently appear under the `// State` and `// Actions` comments):

- `isConsolidated` (around line 181)
- `dataLoaded` (around line 188)
- `fetchAllLoadState` (around line 189)
- `fetchAllProgress` (around line 190)
- `allDashboard` (around line 191)
- `isConsolidatedLoading` (around line 169 — it appears in the data block)
- `viewConsolidated` (around line 203)
- `startFetchAll` (around line 212)
- `abortFetch` (around line 213)

Also remove the error-message fallback chain `?? fetchAllError` since `fetchAllError` no longer exists. The `error` field simplifies to:

```ts
error: entitiesQuery.error?.message ?? detailQuery.error?.message ?? null,
```

- [ ] **Step 9: Verify TypeScript**

Run: `cd client && npx tsc -b --noEmit`

Expected: new errors in `DashboardLayout.tsx` (still destructures v1 fields) and `dashboard-layout-types.ts` (still lists them). We fix them next.

### Task 1.5: Remove v1 `viewConsolidated` / `isConsolidated` / `isConsolidatedLoading` references from `DashboardLayout.tsx` and its types

**Files:**
- Modify: `client/src/layouts/dashboard-layout-types.ts`
- Modify: `client/src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Remove v1 view-consolidated fields from `DashboardLayoutProps`**

In `client/src/layouts/dashboard-layout-types.ts`, delete these lines from the `DashboardLayoutProps` interface:

```ts
isConsolidated: boolean;
isConsolidatedLoading: boolean;
viewConsolidated: () => void;
```

- [ ] **Step 2: Remove the same fields from `DashboardLayout.tsx` destructure**

At the top of `DashboardLayout`, find the big destructure block (starts around line 28). Delete `isConsolidated`, `isConsolidatedLoading`, and `viewConsolidated` from the list.

- [ ] **Step 3: Remove the `isConsolidatedLoading` conditional in the placeholder**

Around line 278 of `DashboardLayout.tsx`, the placeholder `<p>` currently reads:

```tsx
<p className="text-[14px] text-[var(--color-text-muted)]">
  {isConsolidatedLoading
    ? 'Loading consolidated view\u2026'
    : `Select a ${DIMENSION_CONFIG[activeDimension].singularLabel} to view details`}
</p>
```

Simplify to:

```tsx
<p className="text-[14px] text-[var(--color-text-muted)]">
  Select a {DIMENSION_CONFIG[activeDimension].singularLabel} to view details
</p>
```

- [ ] **Step 4: Verify TypeScript**

Run: `cd client && npx tsc -b --noEmit`

Expected: errors around `selectDisplayDashboard` (still invoked, still imported). Fixed in Task 1.6.

### Task 1.6: Remove the v1 `useEntitySelection` internals

**Files:**
- Modify: `client/src/hooks/useEntitySelection.ts`

- [ ] **Step 1: Rewrite the file to only manage multi-select + active entity**

Replace the entire contents of `client/src/hooks/useEntitySelection.ts` with:

```ts
// FILE: client/src/hooks/useEntitySelection.ts
// PURPOSE: Active entity + multi-select state — spec Section 13.4
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useEntitySelection

import { useState, useCallback, useMemo } from 'react';

interface UseEntitySelectionOptions {
  activeEntityId: string | null;
  onActiveEntityChange: (id: string | null) => void;
}

export function useEntitySelection({ activeEntityId, onActiveEntityChange }: UseEntitySelectionOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /** Click an entity row to view its details */
  const selectEntity = useCallback((id: string) => {
    onActiveEntityChange(id);
  }, [onActiveEntityChange]);

  /** Toggle the circular checkbox for multi-select */
  const toggleCheckbox = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /** Uncheck all entities */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /** Full reset: clears active entity and unchecks all */
  const resetSelection = useCallback(() => {
    onActiveEntityChange(null);
    setSelectedIds(new Set());
  }, [onActiveEntityChange]);

  // WHY: Without useMemo, [...selectedIds] creates a new array on every render,
  // defeating React.memo on every downstream component that receives this prop.
  const selectedIdsArray = useMemo(() => [...selectedIds], [selectedIds]);

  return {
    activeEntityId,
    selectedIds: selectedIdsArray,
    selectEntity,
    toggleCheckbox,
    clearSelection,
    resetSelection,
  };
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd client && npx tsc -b --noEmit`

Expected: `DashboardLayout.tsx` still imports `selectDisplayDashboard` (removed in Task 2) — errors remain on that import. Move on.

---

## Phase 2 — Commit 1: Delete v1 Report / Load All path

### Task 2.1: Delete the v1 handlers and dialog renders from `DashboardLayout.tsx`

**Files:**
- Modify: `client/src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Remove `selectDisplayDashboard` import and the `import` lines for the two v1 components**

Delete these three imports from the top of the file:

```ts
import { FetchAllDialog } from '../components/shared/FetchAllDialog';
import { FetchAllProgress } from '../components/right-panel/FetchAllProgress';
import { selectDisplayDashboard } from './select-display-dashboard';
```

- [ ] **Step 2: Remove v1 fields from the destructure**

From the `const { ... } = props;` block, delete:

- `dataLoaded`
- `fetchAllLoadState`
- `fetchAllProgress`
- `allDashboard`
- `startFetchAll`
- `abortFetch` (if present — should have been removed in Task 1.4; grep to confirm)

- [ ] **Step 3: Remove v1 dialog state and handlers**

Delete:

```ts
const [dialogOpen, setDialogOpen] = useState(false);
const [dialogRefresh, setDialogRefresh] = useState(false);
const entitiesWithOrders = useMemo(
  () => allEntities.filter(e => e.revenue !== null && e.revenue > 0).length,
  [allEntities],
);
```

And delete these handler functions:

```ts
const handleAllClick = () => { ... };
const handleRefresh = () => { setDialogRefresh(true); setDialogOpen(true); };
const handleDialogConfirm = (filters: FetchAllFilters) => { ... };
```

- [ ] **Step 4: Remove `isAllActive` local and simplify the `displayDashboard` line**

Delete:

```ts
const displayDashboard = selectDisplayDashboard({ isConsolidated, activeEntityId, allDashboard, dashboard });
const isAllActive = activeEntityId === '__ALL__';
```

Replace every use of `displayDashboard` in the JSX below with `dashboard` directly. Also remove every reference to `isAllActive` — the expressions `isAllActive ? null : activeEntity` become `activeEntity`.

- [ ] **Step 5: Remove the `<FetchAllDialog>` and `<FetchAllProgress>` renders and the retry-error banner**

Delete:

```tsx
<FetchAllDialog isOpen={dialogOpen} dimension={activeDimension} entities={allEntities} isRefresh={dialogRefresh} onConfirm={handleDialogConfirm} onCancel={() => setDialogOpen(false)} />
```

Delete:

```tsx
{fetchAllLoadState === 'error' && error && (
  <div role="alert" ...>
    ...
    <button ... onClick={() => { setDialogRefresh(false); setDialogOpen(true); }} ...>Retry</button>
  </div>
)}
```

Delete:

```tsx
{fetchAllLoadState === 'loading' ? (
  <FetchAllProgress progress={fetchAllProgress} />
) : activeView !== 'single' && consolidatedPayload ? (
```

The ternary is restructured — the `fetchAllLoadState === 'loading'` branch goes away; the condition becomes `activeView !== 'single' && consolidatedPayload ? ... : ...`.

- [ ] **Step 6: Remove v1 props from the `<LeftPanel>` JSX**

Delete these lines from the `<LeftPanel ... />` call:

```tsx
fetchAllLoadState={fetchAllLoadState}
allDashboard={allDashboard}
entitiesWithOrders={entitiesWithOrders}
onAllClick={handleAllClick}
onRefresh={handleRefresh}
dataLoaded={dataLoaded}
```

- [ ] **Step 7: Verify TypeScript**

Run: `cd client && npx tsc -b --noEmit`

Expected: errors in `LeftPanel.tsx` (still expects those props) and `dashboard-layout-types.ts` (still lists them). Fixed next.

### Task 2.2: Remove v1 props from `LeftPanel.tsx` and `EntityList.tsx`

**Files:**
- Modify: `client/src/components/left-panel/LeftPanel.tsx`
- Modify: `client/src/components/left-panel/EntityList.tsx`

- [ ] **Step 1: In `LeftPanel.tsx`, remove v1 props from the interface and destructure**

In `LeftPanelProps`, delete:

```ts
fetchAllLoadState: EntityListLoadState;
allDashboard: DashboardPayload | null;
entitiesWithOrders: number;
onAllClick: () => void;
onRefresh: () => void;
```

Also remove `EntityListLoadState` and `DashboardPayload` from the `@shared/types/dashboard` import if no longer referenced (grep the file).

From the destructured parameters, remove `fetchAllLoadState, allDashboard, entitiesWithOrders, onAllClick, onRefresh`.

From the `<EntityList ... />` call, remove:

```tsx
fetchAllLoadState={fetchAllLoadState}
allDashboard={allDashboard}
entitiesWithOrders={entitiesWithOrders}
onAllClick={onAllClick}
onRefresh={onRefresh}
```

- [ ] **Step 2: In `EntityList.tsx`, remove the `<AllEntityEntry>` render and its props**

Delete the block:

```tsx
<AllEntityEntry
  label={allLabel}
  loadState={fetchAllLoadState}
  isActive={activeId === '__ALL__'}
  aggregateData={allDashboard}
  entitiesWithOrders={entitiesWithOrders}
  onClick={onAllClick}
  onRefresh={onRefresh}
/>
```

Remove the import:

```tsx
import { AllEntityEntry } from './AllEntityEntry';
```

Remove these fields from `EntityListProps`:

```ts
allLabel: string;
fetchAllLoadState: EntityListLoadState;
allDashboard: DashboardPayload | null;
entitiesWithOrders: number;
onAllClick: () => void;
onRefresh: () => void;
```

Remove the same names from the destructured parameters. Also remove `EntityListLoadState` and `DashboardPayload` from the `@shared/types/dashboard` import if no longer referenced.

- [ ] **Step 3: Verify TypeScript**

Run: `cd client && npx tsc -b --noEmit`

Expected: errors in `dashboard-layout-types.ts` remain (still has v1 fetch fields). Fixed next.

### Task 2.3: Remove v1 fetch fields from `DashboardLayoutProps`

**Files:**
- Modify: `client/src/layouts/dashboard-layout-types.ts`

- [ ] **Step 1: Strip v1 fetch fields from the interface**

From `DashboardLayoutProps`, delete:

```ts
dataLoaded: boolean;
fetchAllLoadState: EntityListLoadState;
fetchAllProgress: SSEProgressEvent | null;
allDashboard: DashboardPayload | null;
startFetchAll: (filters: FetchAllFilters, forceRefresh?: boolean) => void;
abortFetch: () => void;
```

- [ ] **Step 2: Prune unused imports**

Remove `EntityListLoadState` from the import list. Check whether `SSEProgressEvent` and `FetchAllFilters` are still used anywhere in this file — they are NOT (all consumers were v1). Remove both from the import. The import becomes:

```ts
import type { DashboardPayload, EntityListItem, Contact, Dimension, Period, CacheStatus } from '@shared/types/dashboard';
```

- [ ] **Step 3: Verify TypeScript**

Run: `cd client && npx tsc -b --noEmit`

Expected: NO errors. The client compiles cleanly.

---

## Phase 3 — Commit 1: Delete orphaned files and finalize

### Task 3.1: Delete the now-orphaned v1 files

**Files:**
- Delete: `client/src/components/left-panel/AllEntityEntry.tsx`
- Delete: `client/src/components/shared/FetchAllDialog.tsx`
- Delete: `client/src/components/right-panel/FetchAllProgress.tsx`
- Delete: `client/src/hooks/useFetchAll.ts`
- Delete: `client/src/layouts/select-display-dashboard.ts`
- Delete: `client/src/layouts/__tests__/select-display-dashboard.test.ts`

- [ ] **Step 1: Remove the files using `git rm`**

Run:
```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1"
git rm client/src/components/left-panel/AllEntityEntry.tsx
git rm client/src/components/shared/FetchAllDialog.tsx
git rm client/src/components/right-panel/FetchAllProgress.tsx
git rm client/src/hooks/useFetchAll.ts
git rm client/src/layouts/select-display-dashboard.ts
git rm client/src/layouts/__tests__/select-display-dashboard.test.ts
```

Expected: six `rm` lines in git output.

- [ ] **Step 2: If the `__tests__` directory is now empty, remove it too**

Run:
```bash
ls client/src/layouts/__tests__/
```
If the directory is empty, run:
```bash
rmdir client/src/layouts/__tests__/
```

- [ ] **Step 3: Verify TypeScript and grep guardrails**

Run:
```bash
cd client && npx tsc -b --noEmit
```
Expected: zero errors.

Run these grep guardrails (from project root):
```bash
grep -rn "AllEntityEntry\|useFetchAll\|FetchAllDialog\|FetchAllProgress\|selectDisplayDashboard" client/src/ server/src/ shared/
grep -rn "__ALL__\|isConsolidated\|viewConsolidated\|useConsolidatedDashboard" client/src/
```
Expected: every grep returns ZERO matches. If any match survives, STOP and remove the surviving reference before continuing.

### Task 3.2: Remove the `EntityListLoadState` type

**Files:**
- Modify: `shared/types/dashboard.ts`

- [ ] **Step 1: Confirm no remaining consumers**

Run:
```bash
grep -rn "EntityListLoadState" client/src/ server/src/ shared/
```
Expected: only the declaration at `shared/types/dashboard.ts:191`. If there are any other hits, they are leftovers — remove them first.

- [ ] **Step 2: Delete the type declaration**

In `shared/types/dashboard.ts`, delete line 191:

```ts
export type EntityListLoadState = 'not-loaded' | 'loading' | 'loaded' | 'error';
```

Also delete any leading comment line that describes only this type. Keep `FetchAllFilters` and `SSEProgressEvent` — both are still used by `useReport2`.

- [ ] **Step 3: Verify**

Run:
```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
```
Expected: zero errors on both.

### Task 3.3: Run the full verification suite

- [ ] **Step 1: Type check (both sides)**

Run:
```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
```
Expected: both exit 0.

- [ ] **Step 2: Server tests**

Run:
```bash
cd server && npx vitest run
```
Expected: 121 tests pass (or whatever the current count is — should match baseline from Phase 0). If the count dropped, a test file was accidentally deleted — investigate before proceeding.

- [ ] **Step 3: Client bundle build**

Run:
```bash
cd ../client && npx vite build
```
Expected: exits 0. Bundle gzip size stays under 500 KB. Note the size delta vs baseline — you should see a small reduction (v1 code removed).

- [ ] **Step 4: Grep guardrails (final)**

Run:
```bash
cd ..
grep -rn "AllEntityEntry\|useFetchAll\|FetchAllDialog\|FetchAllProgress\|selectDisplayDashboard\|__ALL__\|isConsolidated\|viewConsolidated\|useConsolidatedDashboard\|EntityListLoadState" client/src/ server/src/ shared/
```
Expected: ZERO matches across the whole codebase.

### Task 3.4: Commit 1

- [ ] **Step 1: Review the staged changes**

Run:
```bash
git status
git diff --stat HEAD
```
Expected: 6 files deleted, ~8-10 files modified, no server files touched except potentially none.

- [ ] **Step 2: Commit**

Run:
```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: remove v1 Report and View Consolidated

Removes the broken v1 "Load All" / AllEntityEntry button and its
associated FetchAllDialog, FetchAllProgress, useFetchAll hook, and
__ALL__ pseudo-entity plumbing. Removes the v1 "View Consolidated"
dark button from SelectionBar and its isConsolidated / viewConsolidated
state, useConsolidatedDashboard query, and selectDisplayDashboard
selector. All v2 surfaces (useReport2, useConsolidated2, Report2Button,
etc.) remain untouched and continue to serve every consolidated flow.

Shared endpoints (/api/sales/fetch-all and /api/sales/dashboard) are
unchanged — v2 uses both. The EntityListLoadState type is removed;
FetchAllFilters and SSEProgressEvent are preserved for useReport2.

Per spec: docs/specs/2026-04-15-remove-v1-report-and-consolidated-design.md

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Confirm the commit landed on the branch**

Run:
```bash
git log --oneline -3
```
Expected: top commit is "chore: remove v1 Report and View Consolidated".

---

## Phase 4 — Commit 2: Rename files with `git mv`

### Task 4.1: Rename the seven v2 files

- [ ] **Step 1: Rename hook files**

Run:
```bash
git mv client/src/hooks/useReport2.ts client/src/hooks/useReport.ts
git mv client/src/hooks/useConsolidated2.ts client/src/hooks/useConsolidated.ts
```

- [ ] **Step 2: Rename left-panel component files**

Run:
```bash
git mv client/src/components/left-panel/Report2Button.tsx client/src/components/left-panel/ReportButton.tsx
git mv client/src/components/left-panel/ViewConsolidated2Button.tsx client/src/components/left-panel/ViewConsolidatedButton.tsx
```

- [ ] **Step 3: Rename shared modal files**

Run:
```bash
git mv client/src/components/shared/Report2FilterModal.tsx client/src/components/shared/ReportFilterModal.tsx
git mv client/src/components/shared/Report2ProgressModal.tsx client/src/components/shared/ReportProgressModal.tsx
git mv client/src/components/shared/Consolidated2ConfirmModal.tsx client/src/components/shared/ConsolidatedConfirmModal.tsx
```

- [ ] **Step 4: Verify the renames are staged**

Run:
```bash
git status
```
Expected: 7 `renamed:` lines (one per file). If any appear as delete+create instead of rename, `git` didn't detect the rename — that's OK for `tsc` but makes history harder to follow. It usually means the file contents changed too much to be auto-detected; fine here because we're about to update contents anyway.

- [ ] **Step 5: Verify TypeScript — expect massive breakage**

Run: `cd client && npx tsc -b --noEmit`

Expected: MANY "Cannot find module './useReport2'" style errors across the codebase. This is expected — all import paths still reference the old names. Fixed in the next task.

---

## Phase 5 — Commit 2: Rename identifiers and update imports

### Task 5.1: Update exports inside each renamed file

**Files:**
- Modify: `client/src/hooks/useReport.ts`
- Modify: `client/src/hooks/useConsolidated.ts`
- Modify: `client/src/components/left-panel/ReportButton.tsx`
- Modify: `client/src/components/left-panel/ViewConsolidatedButton.tsx`
- Modify: `client/src/components/shared/ReportFilterModal.tsx`
- Modify: `client/src/components/shared/ReportProgressModal.tsx`
- Modify: `client/src/components/shared/ConsolidatedConfirmModal.tsx`

- [ ] **Step 1: Rename the identifiers inside `useReport.ts`**

Inside the file, replace every occurrence of:
- `useReport2` → `useReport`
- `Report2State` → `ReportState`
- `UseReport2Return` → `UseReportReturn`
- `Report2Payload` → `ReportPayload` (if such a type exists — otherwise skip)

Update the intent block at the top:
- `// FILE: client/src/hooks/useReport2.ts` → `// FILE: client/src/hooks/useReport.ts`
- `// EXPORTS: useReport2, Report2State, UseReport2Return` → `// EXPORTS: useReport, ReportState, UseReportReturn`

- [ ] **Step 2: Rename the identifiers inside `useConsolidated.ts`**

Replace:
- `useConsolidated2` → `useConsolidated`
- `Consolidated2State` → `ConsolidatedState`
- `UseConsolidated2Return` → `UseConsolidatedReturn`

Update the intent block similarly.

- [ ] **Step 3: Rename identifiers in the four UI component files**

For each of `ReportButton.tsx`, `ViewConsolidatedButton.tsx`, `ReportFilterModal.tsx`, `ReportProgressModal.tsx`, `ConsolidatedConfirmModal.tsx`:
- Component function name: drop the `2` (`Report2Button` → `ReportButton`, etc.)
- Inner component names: `Report2FilterModalContent` → `ReportFilterModalContent`
- All import paths that reference `useReport2` / `useConsolidated2` → `useReport` / `useConsolidated`
- All imported type names that had a `2` — update to match what the hook files now export
- Update the intent block (FILE, EXPORTS lines)

- [ ] **Step 4: Update the `aria-label` in `ReportFilterModal.tsx`**

Change:
```tsx
aria-label="Report 2 filters"
```
to:
```tsx
aria-label="Report filters"
```

- [ ] **Step 5: Verify TypeScript reports only import-path errors now**

Run: `cd client && npx tsc -b --noEmit`

Expected: the errors about "Cannot find module" persist, but errors inside the renamed files themselves (e.g., `Report2Button is not defined`) should be gone. We fix the import paths in Task 5.2.

### Task 5.2: Update every import path and identifier at every call site

**Files (partial list — confirm with grep before starting):**
- Modify: `client/src/hooks/useDashboardState.ts`
- Modify: `client/src/layouts/DashboardLayout.tsx`
- Modify: `client/src/layouts/dashboard-layout-types.ts`
- Modify: `client/src/components/left-panel/LeftPanel.tsx`
- Modify: `client/src/components/left-panel/EntityList.tsx`
- Modify: `client/src/components/left-panel/SelectionBar.tsx`
- Any other file that imports from the renamed modules

- [ ] **Step 1: Find every consumer**

Run:
```bash
grep -rln "useReport2\|useConsolidated2\|Report2Button\|ViewConsolidated2Button\|Report2FilterModal\|Report2ProgressModal\|Consolidated2ConfirmModal\|Report2State\|UseReport2Return\|Consolidated2State\|UseConsolidated2Return" client/src/
```
Expected: a list of files to edit. Capture this list — you will visit each one.

- [ ] **Step 2: In every consumer, update identifier-aware patterns**

Prefer your editor's "Rename Symbol" refactor for each identifier. If using a scripted approach, use word-boundary-anchored regex to avoid accidental matches inside comments or strings:

```bash
# Example with sed (run one pattern at a time per file, then review diff):
#   sed -i '' -E 's/\buseReport2\b/useReport/g' <file>
```

Required renames (every occurrence):

| Old identifier | New identifier |
|---|---|
| `useReport2` | `useReport` |
| `useConsolidated2` | `useConsolidated` |
| `Report2Button` | `ReportButton` |
| `ViewConsolidated2Button` | `ViewConsolidatedButton` |
| `Report2FilterModal` | `ReportFilterModal` |
| `Report2ProgressModal` | `ReportProgressModal` |
| `Consolidated2ConfirmModal` | `ConsolidatedConfirmModal` |
| `Report2State` | `ReportState` |
| `UseReport2Return` | `UseReportReturn` |
| `Consolidated2State` | `ConsolidatedState` |
| `UseConsolidated2Return` | `UseConsolidatedReturn` |
| `report2State` (prop name) | `reportState` |
| `report2Payload` (prop name) | `reportPayload` |
| `onReport2Click` (prop name) | `onReportClick` |
| `onViewConsolidated2` (prop name) | `onViewConsolidatedClick` |
| `handleReport2Click` (local var) | `handleReportClick` |
| `handleReport2Start` (local var) | `handleReportStart` |
| `handleViewConsolidated2Click` (local var) | `handleViewConsolidatedClick` |
| `handleConsolidated2Start` (local var) | `handleConsolidatedStart` |
| `handleGoToReport2` (local var) | `handleGoToReport` |
| `onGoToReport2` (prop name) | `onGoToReport` |
| `report2` (field in useDashboardState return and local vars) | `report` |
| `consolidated2` (field in useDashboardState return and local vars) | `consolidated` |

Also update the literal union:
```ts
activeView: 'single' | 'report2' | 'consolidated2'
```
to:
```ts
activeView: 'single' | 'report' | 'consolidated'
```

And update every place those string literals are compared (e.g., `activeView === 'report2'` → `activeView === 'report'`).

- [ ] **Step 3: Update import paths**

In every consumer, update the import source strings:

| Old import path | New import path |
|---|---|
| `from '../../hooks/useReport2'` / `'./useReport2'` | `from '../../hooks/useReport'` / `'./useReport'` |
| `from '../../hooks/useConsolidated2'` / `'./useConsolidated2'` | `from '../../hooks/useConsolidated'` / `'./useConsolidated'` |
| `from './Report2Button'` | `from './ReportButton'` |
| `from './ViewConsolidated2Button'` | `from './ViewConsolidatedButton'` |
| `from '../components/shared/Report2FilterModal'` | `from '../components/shared/ReportFilterModal'` |
| `from '../components/shared/Report2ProgressModal'` | `from '../components/shared/ReportProgressModal'` |
| `from '../components/shared/Consolidated2ConfirmModal'` | `from '../components/shared/ConsolidatedConfirmModal'` |

- [ ] **Step 4: Update UI labels in left-panel buttons**

In `ReportButton.tsx` find the visible button text `Report 2` (and any aria-label that still reads `Report 2`) and change it to `Report`. Same for `ViewConsolidatedButton.tsx`: `View Consolidated 2` → `View Consolidated`.

- [ ] **Step 5: Update the intent blocks in the modified files**

For each modified file, check the `// FILE:` / `// USED BY:` / `// EXPORTS:` header block. Update any reference to a renamed module or identifier so the block matches reality.

- [ ] **Step 6: Verify TypeScript**

Run: `cd client && npx tsc -b --noEmit`

Expected: zero errors. If errors remain, re-run the grep from Step 1 and fix any missed spots.

---

## Phase 6 — Commit 2: Rename the Redis cache key and TTL entry

### Task 6.1: Rename the server-side `report2_payload` cache key to `report_payload`

**Files:**
- Modify: `server/src/cache/cache-keys.ts`
- Modify: `server/src/config/constants.ts`
- Modify: `server/src/routes/fetch-all.ts`
- Modify: `server/src/routes/dashboard.ts`

- [ ] **Step 1: Rename the `CacheEntity` literal**

In `server/src/cache/cache-keys.ts`, change:

```ts
type CacheEntity = 'orders_ytd' | 'orders_year' | 'customers' | 'zones' | 'agents' | 'vendors' | 'contacts' | 'years_available' | 'entities_summary' | 'entity_detail' | 'entities_full' | 'orders_raw' | 'orders_raw_meta' | 'report2_payload';
```

to:

```ts
type CacheEntity = 'orders_ytd' | 'orders_year' | 'customers' | 'zones' | 'agents' | 'vendors' | 'contacts' | 'years_available' | 'entities_summary' | 'entity_detail' | 'entities_full' | 'orders_raw' | 'orders_raw_meta' | 'report_payload';
```

- [ ] **Step 2: Rename the TTL entry in `constants.ts`**

In `server/src/config/constants.ts`, find the `CACHE_TTLS` object. Rename the key `report2_payload` → `report_payload`. Leave the value unchanged.

- [ ] **Step 3: Find every caller and update the string literal**

Run:
```bash
grep -rn "report2_payload" server/src/
```

For each hit, change the string literal `'report2_payload'` → `'report_payload'`. These should all be inside `cacheKey('report2_payload', ...)` calls.

- [ ] **Step 4: Verify server TypeScript**

Run: `cd server && npx tsc --noEmit`

Expected: zero errors.

- [ ] **Step 5: Run server tests**

Run: `cd server && npx vitest run`

Expected: all 121 tests pass. If any test hardcoded `report2_payload` in a fixture, it'll fail here — update the fixture to match.

---

## Phase 7 — Commit 2: Verify and commit

### Task 7.1: Run the full verification suite

- [ ] **Step 1: Type check both sides**

Run:
```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
```
Expected: both exit 0.

- [ ] **Step 2: Run server tests**

Run:
```bash
cd server && npx vitest run
```
Expected: 121 tests pass.

- [ ] **Step 3: Build the client bundle**

Run:
```bash
cd ../client && npx vite build
```
Expected: exits 0. Bundle size under 500 KB gzip.

- [ ] **Step 4: Grep guardrails (commit 2)**

Run from repo root:
```bash
cd ..
grep -rn "Report2\|Consolidated2" client/src/ server/src/ shared/
grep -rn "\breport2\b\|\bconsolidated2\b" client/src/ server/src/ shared/
grep -rn "report2_payload" server/src/
grep -rn ": any\|as any" server/src/ client/src/
```
Expected: ZERO matches for each. (The `\b` anchors protect against false positives inside longer words. The last grep is the CLAUDE.md "no `any` types" quality gate — any violation here is a regression introduced during the rename.)

### Task 7.2: Commit 2

- [ ] **Step 1: Review the staged rename + rewrite**

Run:
```bash
git status
git diff --stat HEAD
```
Expected: 7 `renamed:` lines + several modified files. No new files, no deletions.

- [ ] **Step 2: Commit**

Run:
```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: rename Report 2 / Consolidated 2 to Report / Consolidated

With the v1 implementations removed, the "2" suffix is no longer
meaningful. Renames the surviving v2 surface:

  useReport2             → useReport
  useConsolidated2       → useConsolidated
  Report2Button          → ReportButton
  ViewConsolidated2Button → ViewConsolidatedButton
  Report2FilterModal     → ReportFilterModal
  Report2ProgressModal   → ReportProgressModal
  Consolidated2ConfirmModal → ConsolidatedConfirmModal

UI labels drop the "2" ("Report 2" → "Report", "View Consolidated 2"
→ "View Consolidated"). The Redis cache key `report2_payload` is
renamed to `report_payload`; existing entries orphan and re-warm per
their 1-hour TTL.

File renames use `git mv` to preserve history. No functional changes.

Per spec: docs/specs/2026-04-15-remove-v1-report-and-consolidated-design.md

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Confirm two-commit history on the branch**

Run:
```bash
git log --oneline -5
```
Expected: top two commits are the rename and the removal; both sit on `chore/remove-v1`.

---

## Phase 8 — Push, open PR, and deploy

### Task 8.1: Push the branch and open a PR

- [ ] **Step 1: Push the branch**

Run:
```bash
git push -u origin chore/remove-v1
```
Expected: a "Create a pull request for 'chore/remove-v1'" URL appears in the output.

- [ ] **Step 2: Open a PR**

Run:
```bash
gh pr create --title "Remove v1 Report / View Consolidated; rename v2 to default" --body "$(cat <<'EOF'
## Summary

- **Commit 1** deletes the broken v1 "Load All" (`AllEntityEntry`) and v1 "View Consolidated" (`SelectionBar` dark button) code paths end-to-end: 6 files deleted, ~9 files surgically modified, 1 shared type removed. No server files touched — all endpoints are shared with v2.
- **Commit 2** renames the surviving v2 surface to drop the `2` suffix: 7 `git mv` file renames, identifier updates at every call site, UI labels, and one Redis cache-key rename (`report2_payload` → `report_payload`). No functional changes.

## Merge strategy (REQUIRED)

⚠️ Merge with **"Rebase and merge"** or a standard merge commit — **NOT "Squash and merge."** The two commits must survive on `main` as independently revertable units. Squashing defeats the revert plan in the spec.

## Revert anchors

- Tag: `pre-v1-removal` (pushed to origin before any code change)
- Commit 1 SHA: (delete) — revertable to roll back the deletion while keeping the rename
- Commit 2 SHA: (rename) — revertable to roll back the rename while keeping the deletion

## Test plan

- [ ] `cd client && npx tsc -b --noEmit` — clean
- [ ] `cd server && npx tsc --noEmit` — clean
- [ ] `cd server && npx vitest run` — 121 passed
- [ ] `cd client && npx vite build` — bundle < 500 KB gzip
- [ ] Manual on Railway preview: left panel has no pinned "Load All" row; SelectionBar has only ONE "View Consolidated" button labeled exactly "View Consolidated"; click Report → filter modal opens → dropdowns empty → Start → progress → consolidated view; click Report again from loaded state → dropdowns still empty (regression guard for F1 from `docs/specs/2026-04-14-surgical-fixes.md`); Alexandra → 70-rep scenario passes.

Spec: `docs/specs/2026-04-15-remove-v1-report-and-consolidated-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: the PR URL is printed. Share it with the user.

### Task 8.2: After user merges the PR, verify Railway deploy

- [ ] **Step 1: Wait for the user's confirmation that the PR is merged**

Do not run this task until the user confirms the merge has happened with the correct strategy ("Rebase and merge" or standard merge commit — NOT squash).

- [ ] **Step 2: Pull the merged main**

Run:
```bash
git checkout main
git pull --ff-only origin main
git log --oneline -5
```
Expected: both the delete commit and the rename commit appear on `main` as separate commits (no squash).

- [ ] **Step 3: Monitor the Railway deploy**

Tell the user to watch the Railway deploy dashboard for the `sales-dashboard-production-dbff.up.railway.app` service. The Dockerfile-based build takes ~3 minutes. If the build fails (typically a `tsc` failure missed during local checks), Railway keeps the previous image live.

- [ ] **Step 4: Manual smoke test on the production URL**

Open `https://sales-dashboard-production-dbff.up.railway.app` and walk through:

1. **Left panel structure:** no pinned "Load All" row. Entity list starts with the search/filter controls, then entities.
2. **Report button:** visible, labeled "Report" (no "2"). Click → filter modal opens → all three dropdowns read "All" → pick a filter → Start → progress modal → consolidated view renders with `ConsolidatedHeader`.
3. **Report re-open cleanliness:** click Report a second time → all three dropdowns must read "All" again. This is the F1 regression guard from the prior surgical-fixes spec.
4. **Selection bar:** check 2+ entities → ONE "View Consolidated" button appears (labeled exactly "View Consolidated"). Click → confirmation modal → Start → consolidated view.
5. **Alexandra → 70-rep scenario (full regression guard):** run Report with Sales Rep "Alexandra Gasia" → verify header shows "Report: 1 Customer" → click Report → modal is empty → pick a rep with ~70 customers → Start → verify header shows the new rep's count and name.
6. **Cross-dimension cache reuse:** with a Report loaded for `customer`, switch to `vendor` → re-aggregation <1 s.
7. **Airtable Omni embed:** open the dashboard via the Airtable Interface page → identical behavior.

If any step fails, the rollback options are in the spec's Revertability section; apply the fastest appropriate path.

---

## Summary of produced commits

1. `chore: remove v1 Report and View Consolidated` — 6 deletions, ~9 surgical modifications, 1 shared-type removal.
2. `refactor: rename Report 2 / Consolidated 2 to Report / Consolidated` — 7 file renames, identifier and label updates, 1 cache-key rename.

Total files touched: ~25. Net line-count delta: negative (deletions > rename-side churn).

If Phase 0 through Phase 8 all pass their verification gates, the dashboard ships with a single, unambiguous Report + View Consolidated surface — and the pre-v1-removal tag plus two revertable commits give a clean rollback path for every failure mode.
