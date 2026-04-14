# View Consolidated Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix "View Consolidated" so clicking it updates the right panel with KPIs for only the selected entities, instead of silently doing nothing.

**Architecture:** Extract the display-selection logic into a tested pure function `selectDisplayDashboard`, thread `isConsolidated` and `isConsolidatedLoading` through the prop chain, and replace the hard-coded inline ternary in `DashboardLayout` with a call to that function. No changes to server routes, data hooks, or aggregation.

**Tech Stack:** React 19, TypeScript strict, Vitest (test runner), TanStack Query v5.

**Spec:** `docs/specs/2026-04-14-view-consolidated-fix.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `client/src/layouts/select-display-dashboard.ts` | Pure function: given `isConsolidated`, `activeEntityId`, `allDashboard`, `dashboard` → returns the correct payload to render |
| Create | `client/src/layouts/__tests__/select-display-dashboard.test.ts` | 7 unit tests (TDD: written before implementation) |
| Modify | `client/src/layouts/dashboard-layout-types.ts` | Add `isConsolidated: boolean` and `isConsolidatedLoading: boolean` to `DashboardLayoutProps` |
| Modify | `client/src/hooks/useDashboardState.ts` | Export `isConsolidated` and `isConsolidatedLoading` in the return object |
| Modify | `client/src/layouts/DashboardLayout.tsx` | Import and call `selectDisplayDashboard`; destructure new props; fix placeholder text |

---

## Task 1: Write Failing Tests for `selectDisplayDashboard`

**Files:**
- Create: `client/src/layouts/__tests__/select-display-dashboard.test.ts`

- [ ] **Step 1.1: Create the test file**

```typescript
// FILE: client/src/layouts/__tests__/select-display-dashboard.test.ts
// PURPOSE: Tests for the pure function that decides which dashboard payload to render
// USED BY: test runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { selectDisplayDashboard } from '../select-display-dashboard';
import type { DashboardPayload } from '@shared/types/dashboard';

const allDashboard = { entities: [] } as unknown as DashboardPayload;
const consolDashboard = { entities: [] } as unknown as DashboardPayload;
const singleDashboard = { entities: [] } as unknown as DashboardPayload;

describe('selectDisplayDashboard', () => {
  it('returns dashboard (consolidated payload) when isConsolidated=true, even with __ALL__ + allDashboard present', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: true, activeEntityId: '__ALL__', allDashboard, dashboard: consolDashboard })
    ).toBe(consolDashboard);
  });

  it('returns allDashboard when activeEntityId=__ALL__, allDashboard exists, and not consolidated', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: false, activeEntityId: '__ALL__', allDashboard, dashboard: singleDashboard })
    ).toBe(allDashboard);
  });

  it('returns dashboard when activeEntityId=__ALL__ but allDashboard is null', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: false, activeEntityId: '__ALL__', allDashboard: null, dashboard: singleDashboard })
    ).toBe(singleDashboard);
  });

  it('returns dashboard when activeEntityId is a regular entity ID', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: false, activeEntityId: 'C7826', allDashboard, dashboard: singleDashboard })
    ).toBe(singleDashboard);
  });

  it('returns null when no entity is selected and nothing is loaded', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: false, activeEntityId: null, allDashboard: null, dashboard: null })
    ).toBeNull();
  });

  it('returns dashboard (consolidated) when isConsolidated=true and activeEntityId is a regular entity', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: true, activeEntityId: 'C7826', allDashboard, dashboard: consolDashboard })
    ).toBe(consolDashboard);
  });

  it('returns null when isConsolidated=true but consolidated data is still loading (dashboard=null)', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: true, activeEntityId: '__ALL__', allDashboard, dashboard: null })
    ).toBeNull();
  });
});
```

- [ ] **Step 1.2: Run tests — confirm they fail with "Cannot find module"**

```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1/client"
npx vitest run src/layouts/__tests__/select-display-dashboard.test.ts
```

Expected output contains: `Error: Cannot find module '../select-display-dashboard'`

If the test *passes* instead of failing, the import resolved to an existing file — stop and investigate before continuing.

---

## Task 2: Implement `selectDisplayDashboard`

**Files:**
- Create: `client/src/layouts/select-display-dashboard.ts`

- [ ] **Step 2.1: Create the pure function**

```typescript
// FILE: client/src/layouts/select-display-dashboard.ts
// PURPOSE: Pure function — decides which dashboard payload the right panel renders
// USED BY: DashboardLayout.tsx
// EXPORTS: selectDisplayDashboard

import type { DashboardPayload } from '@shared/types/dashboard';

interface SelectDisplayDashboardArgs {
  isConsolidated: boolean;
  activeEntityId: string | null;
  allDashboard: DashboardPayload | null;
  dashboard: DashboardPayload | null;
}

/**
 * WHY: Two independent display-selection systems must be reconciled:
 *   1. isConsolidated=true  → show finalDashboard (the consolidated selection)
 *   2. activeEntityId=__ALL__ → show allDashboard (the full load-all data)
 * Consolidated mode must win — otherwise View Consolidated appears to do nothing.
 */
export function selectDisplayDashboard({
  isConsolidated,
  activeEntityId,
  allDashboard,
  dashboard,
}: SelectDisplayDashboardArgs): DashboardPayload | null {
  if (!isConsolidated && activeEntityId === '__ALL__' && allDashboard) {
    return allDashboard;
  }
  return dashboard;
}
```

- [ ] **Step 2.2: Run tests — confirm all 7 pass**

```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1/client"
npx vitest run src/layouts/__tests__/select-display-dashboard.test.ts
```

Expected output: `✓ select-display-dashboard > ...` × 7, all green. Zero failures.

- [ ] **Step 2.3: Commit**

```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1"
git add client/src/layouts/select-display-dashboard.ts client/src/layouts/__tests__/select-display-dashboard.test.ts
git commit -m "feat: extract selectDisplayDashboard pure function with 7 unit tests"
```

---

## Task 3: Extend `DashboardLayoutProps`

**Files:**
- Modify: `client/src/layouts/dashboard-layout-types.ts`

- [ ] **Step 3.1: Add the two new boolean fields**

Open `client/src/layouts/dashboard-layout-types.ts`. Find the line `dataLoaded: boolean;` and add two fields directly after it:

```typescript
  dataLoaded: boolean;
  isConsolidated: boolean;
  isConsolidatedLoading: boolean;
```

The surrounding context (for reference):
```typescript
export interface DashboardLayoutProps {
  // ...
  sortField: SortField;
  sortDirection: SortDirection;
  dataLoaded: boolean;
  isConsolidated: boolean;        // ← add this
  isConsolidatedLoading: boolean; // ← add this
  fetchAllLoadState: EntityListLoadState;
  // ...
}
```

- [ ] **Step 3.2: Run TypeScript — expect errors because the new fields are not yet provided**

```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1/client"
npx tsc -b --noEmit 2>&1 | head -30
```

Expected: errors like `Property 'isConsolidated' is missing in type ...` in `useDashboardState.ts` or `App.tsx`. This is correct — the chain is broken until Task 4 provides the values.

---

## Task 4: Export `isConsolidated` and `isConsolidatedLoading` from `useDashboardState`

**Files:**
- Modify: `client/src/hooks/useDashboardState.ts`

Both values are already computed in this file:
- `isConsolidated` — line 41 (destructured from `useEntitySelection`)
- `isConsolidatedLoading` — line 132 (`consolidatedQuery.isLoading && isConsolidated`)

They just need to be added to the return object.

- [ ] **Step 4.1: Add both fields to the return object**

Find the return statement in `useDashboardState` (around line 135). It currently returns `selectedEntityIds: selectedIds` — add the two new fields nearby:

```typescript
  return {
    // Data
    dashboard: finalDashboard,
    // ...existing fields...
    selectedEntityIds: selectedIds,
    isConsolidated,          // ← add
    isConsolidatedLoading,   // ← add
    // ...rest of existing fields...
  };
```

- [ ] **Step 4.2: Run TypeScript — errors should now only be in `DashboardLayout.tsx`**

```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1/client"
npx tsc -b --noEmit 2>&1 | head -30
```

Expected: remaining errors are in `DashboardLayout.tsx` about the unused new props (TypeScript will complain the props exist but aren't destructured). Zero errors elsewhere.

---

## Task 5: Wire `selectDisplayDashboard` into `DashboardLayout` and fix placeholder

**Files:**
- Modify: `client/src/layouts/DashboardLayout.tsx`

- [ ] **Step 5.1: Add the import for `selectDisplayDashboard`**

Find the existing import block in `DashboardLayout.tsx`. Add:

```typescript
import { selectDisplayDashboard } from './select-display-dashboard';
```

- [ ] **Step 5.2: Destructure `isConsolidated` and `isConsolidatedLoading` from props**

Find the large destructuring of `props` at the top of `DashboardLayout` (around line 23). Add the two new fields alongside `dataLoaded`:

```typescript
    sortField, sortDirection, dataLoaded, fetchAllLoadState, fetchAllProgress, allDashboard,
    isConsolidated, isConsolidatedLoading,
```

- [ ] **Step 5.3: Replace the `displayDashboard` computation**

Find line 100 (the inline ternary). Replace it:

```typescript
// BEFORE:
const displayDashboard = activeEntityId === '__ALL__' && allDashboard ? allDashboard : dashboard;

// AFTER:
const displayDashboard = selectDisplayDashboard({ isConsolidated, activeEntityId, allDashboard, dashboard });
```

- [ ] **Step 5.4: Fix the placeholder text**

Find the placeholder `<motion.div key="placeholder" ...>` (around line 150). Replace the inner `<p>` tag:

```tsx
// BEFORE:
<p className="text-[14px] text-[var(--color-text-muted)]">Select a {DIMENSION_CONFIG[activeDimension].singularLabel} to view details</p>

// AFTER:
<p className="text-[14px] text-[var(--color-text-muted)]">
  {isConsolidatedLoading
    ? 'Loading consolidated view\u2026'
    : `Select a ${DIMENSION_CONFIG[activeDimension].singularLabel} to view details`}
</p>
```

- [ ] **Step 5.5: Run TypeScript — must be 0 errors**

```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1/client"
npx tsc -b --noEmit
```

Expected: no output, exit code 0. If any errors appear, read them and fix before continuing.

- [ ] **Step 5.6: Run client unit tests**

```bash
npx vitest run src/layouts/__tests__/select-display-dashboard.test.ts
```

Expected: 7/7 pass.

- [ ] **Step 5.7: Run server tests — must still pass**

```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1/server"
npx vitest run
```

Expected: 107 tests pass, 0 failures.

- [ ] **Step 5.8: Run client build**

```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1/client"
npx vite build
```

Expected: build succeeds, gzip total under 500 KB.

- [ ] **Step 5.9: Commit**

```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1"
git add \
  client/src/layouts/dashboard-layout-types.ts \
  client/src/hooks/useDashboardState.ts \
  client/src/layouts/DashboardLayout.tsx
git commit -m "fix: use selectDisplayDashboard in DashboardLayout — View Consolidated now renders consolidated data"
```

---

## Task 6: Manual End-to-End Verification

> This task cannot be automated — it requires the dev server and a browser.

- [ ] **Step 6.1: Start both dev servers** (two terminals)

```bash
# Terminal 1
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1/server"
npm run dev

# Terminal 2
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1/client"
npm run dev
```

- [ ] **Step 6.2: Run Load All**

1. Open `http://localhost:5173` in a browser
2. In the entity list, click the "All Customers" counter/button to open the Load All dialog
3. Confirm without filters
4. Wait for the progress bar to finish — right panel shows the all-entity aggregate (total revenue, total orders, etc.)

- [ ] **Step 6.3: Check Disney entities**

1. In the search box, type a name that matches Disney customers in the data (e.g. "disney")
2. Use the circular checkboxes to select 2–3 Disney entities
3. The SelectionBar slides up at the bottom of the list showing "N selected"
4. "View Consolidated" button should be active (not grayed out)

- [ ] **Step 6.4: Click "View Consolidated" and verify the result**

1. Click "View Consolidated"
2. **While loading:** right panel should show "Loading consolidated view…" (not "Select a customer")
3. **After load:** right panel should update — revenue and order count are lower than the all-entity total from step 6.2
4. Open the browser Network tab and confirm: a request was made to `/api/sales/dashboard?entityIds=...&groupBy=customer&period=ytd` and returned HTTP 200

- [ ] **Step 6.5: Regression check — All Customers still works**

1. Click "Clear" in the SelectionBar
2. Click the "All Customers" row in the entity list
3. Right panel must show the all-entity aggregate again (same as before View Consolidated was clicked)

---

## Definition of Done

- [ ] 7 unit tests in `select-display-dashboard.test.ts` pass
- [ ] `npx tsc -b --noEmit` → 0 errors
- [ ] Server `npx vitest run` → 107/107 pass
- [ ] `npx vite build` → succeeds under 500 KB gzip
- [ ] Manual test: clicking "View Consolidated" updates the right panel with filtered KPIs
- [ ] Manual test: "All Customers" still shows `allDashboard` after clearing (regression)
