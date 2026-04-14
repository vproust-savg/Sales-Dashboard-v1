# View Consolidated Fix

**Date:** 2026-04-14
**Status:** Draft
**Triggered by:** Systematic debugging session — "View Consolidated does not work" (tested with Disney customers)

## Context

"View Consolidated" fires correctly at every layer — the button becomes enabled, `isConsolidated` is set, the consolidated query executes, and `finalDashboard` is populated with the correct multi-entity payload. But the right panel never updates. Clicking the button appears to do nothing.

Root cause: `DashboardLayout.tsx` contains two independent "what to display" decisions that silently conflict. The one closer to the render wins — and it ignores the consolidated result every time.

### Why the override always fires

Running Load All calls `handleDialogConfirm`, which calls `selectEntity('__ALL__')`. This sets `activeEntityId = '__ALL__'`. The "View Consolidated" button is only enabled when `dataLoaded = true` — which requires Load All to complete. So **every user who can click the button already has `activeEntityId = '__ALL__'`**, guaranteeing the override fires.

### The conflict

```typescript
// useDashboardState.ts — correct: finalDashboard switches to consolidated data
const finalDashboard = useMemo(() => {
  if (isConsolidated && consolidatedDashboard) {
    return { ...consolidatedDashboard, entities: processedEntities };
  }
  // ...
}, [dashboard, consolidatedDashboard, isConsolidated, processedEntities]);

// DashboardLayout.tsx:100 — wrong: allDashboard always wins when activeEntityId='__ALL__'
const displayDashboard = activeEntityId === '__ALL__' && allDashboard ? allDashboard : dashboard;
```

`isConsolidated` is not in `DashboardLayoutProps` and is invisible to `DashboardLayout`. The layout has no way to defer to the consolidated result.

### Secondary issues

**`isConsolidatedLoading` dead code:** Computed in `useDashboardState:132` as
`consolidatedQuery.isLoading && isConsolidated` — never exported, never used by the layout. So during the consolidated fetch there is no loading state in the right panel.

**Wrong placeholder text during consolidated loading:** After the primary fix, clicking "View Consolidated" will trigger the consolidated query. While it loads, `displayDashboard = null` (because `detailQuery` is disabled for `__ALL__`). This causes the layout to show "Select a customer to view details" — the wrong message when the user has already selected customers.

---

## Scope

| File | Change |
|------|--------|
| `client/src/layouts/select-display-dashboard.ts` | **New** — pure function extracted from inline logic |
| `client/src/layouts/__tests__/select-display-dashboard.test.ts` | **New** — 7 unit tests (TDD: written before implementation) |
| `client/src/layouts/dashboard-layout-types.ts` | Add `isConsolidated: boolean` and `isConsolidatedLoading: boolean` |
| `client/src/hooks/useDashboardState.ts` | Export `isConsolidated` and `isConsolidatedLoading` |
| `client/src/layouts/DashboardLayout.tsx` | Use `selectDisplayDashboard`; fix placeholder text |

---

## Fix 1: Extract and test the display-selection logic

### Problem

The inline ternary in `DashboardLayout.tsx:100` cannot be tested in isolation:

```typescript
const displayDashboard = activeEntityId === '__ALL__' && allDashboard ? allDashboard : dashboard;
```

It has 3 inputs and must correctly prioritise consolidated mode over the `__ALL__` shortcut — a non-obvious invariant that must be covered by tests.

### Solution

#### Step 1 — Tests (written first, they fail until step 2 exists)

**New file:** `client/src/layouts/__tests__/select-display-dashboard.test.ts`

```typescript
// FILE: client/src/layouts/__tests__/select-display-dashboard.test.ts
// PURPOSE: Tests for the pure function that decides which dashboard to render
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
    expect(selectDisplayDashboard({ isConsolidated: true, activeEntityId: '__ALL__', allDashboard, dashboard: consolDashboard }))
      .toBe(consolDashboard);
  });

  it('returns allDashboard when activeEntityId=__ALL__ and allDashboard exists and not consolidated', () => {
    expect(selectDisplayDashboard({ isConsolidated: false, activeEntityId: '__ALL__', allDashboard, dashboard: singleDashboard }))
      .toBe(allDashboard);
  });

  it('returns dashboard when activeEntityId=__ALL__ but allDashboard is null', () => {
    expect(selectDisplayDashboard({ isConsolidated: false, activeEntityId: '__ALL__', allDashboard: null, dashboard: singleDashboard }))
      .toBe(singleDashboard);
  });

  it('returns dashboard when activeEntityId is a regular entity ID', () => {
    expect(selectDisplayDashboard({ isConsolidated: false, activeEntityId: 'C7826', allDashboard, dashboard: singleDashboard }))
      .toBe(singleDashboard);
  });

  it('returns null when no entity is selected and nothing is loaded', () => {
    expect(selectDisplayDashboard({ isConsolidated: false, activeEntityId: null, allDashboard: null, dashboard: null }))
      .toBeNull();
  });

  it('returns dashboard (consolidated) when isConsolidated=true and activeEntityId is a regular entity', () => {
    expect(selectDisplayDashboard({ isConsolidated: true, activeEntityId: 'C7826', allDashboard, dashboard: consolDashboard }))
      .toBe(consolDashboard);
  });

  it('returns null when isConsolidated=true but consolidated data is still loading (dashboard=null)', () => {
    expect(selectDisplayDashboard({ isConsolidated: true, activeEntityId: '__ALL__', allDashboard, dashboard: null }))
      .toBeNull();
  });
});
```

#### Step 2 — Implementation

**New file:** `client/src/layouts/select-display-dashboard.ts`

```typescript
// FILE: client/src/layouts/select-display-dashboard.ts
// PURPOSE: Pure function — decides which dashboard payload the right panel renders
// USED BY: DashboardLayout.tsx
// EXPORTS: selectDisplayDashboard

import type { DashboardPayload } from '@shared/types/dashboard';

interface Args {
  isConsolidated: boolean;
  activeEntityId: string | null;
  allDashboard: DashboardPayload | null;
  dashboard: DashboardPayload | null;
}

/**
 * WHY: Two independent display-selection systems must be reconciled:
 *   1. isConsolidated=true  → show finalDashboard (the consolidated selection)
 *   2. activeEntityId=__ALL__ → show allDashboard (the full load-all data)
 * Consolidated mode must win — otherwise View Consolidated does nothing.
 */
export function selectDisplayDashboard({ isConsolidated, activeEntityId, allDashboard, dashboard }: Args): DashboardPayload | null {
  if (!isConsolidated && activeEntityId === '__ALL__' && allDashboard) {
    return allDashboard;
  }
  return dashboard;
}
```

---

## Fix 2: Expose `isConsolidated` and `isConsolidatedLoading` through the prop chain

### Problem

`isConsolidated` and `isConsolidatedLoading` are computed in `useDashboardState` but absent from `DashboardLayoutProps`, making them invisible to the layout component.

### Solution

**`client/src/layouts/dashboard-layout-types.ts`** — add after `dataLoaded: boolean;`:
```typescript
isConsolidated: boolean;
isConsolidatedLoading: boolean;
```

**`client/src/hooks/useDashboardState.ts`** — add to the return object:
```typescript
isConsolidated,          // already computed at line 41
isConsolidatedLoading,   // already computed at line 132
```

---

## Fix 3: Wire `selectDisplayDashboard` into DashboardLayout

**`client/src/layouts/DashboardLayout.tsx`**

```typescript
// Add import at top:
import { selectDisplayDashboard } from './select-display-dashboard';

// Add to destructuring from props:
isConsolidated, isConsolidatedLoading,

// Replace line 100:
// BEFORE:
const displayDashboard = activeEntityId === '__ALL__' && allDashboard ? allDashboard : dashboard;
// AFTER:
const displayDashboard = selectDisplayDashboard({ isConsolidated, activeEntityId, allDashboard, dashboard });

// Replace placeholder text (line 151):
// BEFORE:
<p className="text-[14px] text-[var(--color-text-muted)]">Select a {DIMENSION_CONFIG[activeDimension].singularLabel} to view details</p>
// AFTER:
<p className="text-[14px] text-[var(--color-text-muted)]">
  {isConsolidatedLoading
    ? 'Loading consolidated view\u2026'
    : `Select a ${DIMENSION_CONFIG[activeDimension].singularLabel} to view details`}
</p>
```

---

## Acceptance Criteria

1. Clicking "View Consolidated" (after Load All + checking entities) causes the right panel to update with KPIs for only the selected entities — revenue and order count are lower than the all-entity total
2. While the consolidated query is in flight, the right panel shows "Loading consolidated view…" instead of "Select a customer to view details"
3. Clearing selection and clicking "All Customers" still shows the full `allDashboard` (regression)
4. All 7 unit tests in `select-display-dashboard.test.ts` pass
5. `npx tsc -b --noEmit` reports 0 errors
6. `npx vitest run` (server) still passes all 107 tests
7. `npx vite build` succeeds under 500 KB gzip

## Manual Test Script (Disney customers)

1. Start both dev servers
2. In entity list: search "disney" (or use the dimension that contains Disney entities)
3. Run Load All — wait for completion — right panel shows all-entity aggregate
4. Check 2–3 Disney entities using circular checkboxes
5. "View Consolidated" button becomes enabled → click it
6. Right panel briefly shows "Loading consolidated view…"
7. Right panel updates: KPIs reflect only Disney entities (lower revenue than the all-entity total)
8. Network tab: `GET /api/sales/dashboard?entityIds=DISNEY1,DISNEY2&groupBy=customer&period=ytd` → 200
9. Click "Clear" → SelectionBar disappears → right panel keeps showing previous state
10. Click "All Customers" row → right panel shows all-entity aggregate again ✓
