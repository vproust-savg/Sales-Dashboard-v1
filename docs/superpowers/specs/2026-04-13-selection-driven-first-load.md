# Selection-Driven First Load Strategy

**Date:** 2026-04-13
**Status:** Approved
**Approach:** Frontend-only (Approach A)

## Problem

The Sales Dashboard currently auto-selects the first entity on load, which immediately triggers a heavy Stage 2 detail fetch. This means:
- Users wait for both Stage 1 (entity list) and Stage 2 (full dashboard) before interacting
- The left panel shows sales-order details (revenue badges, order counts) that clutter the entity list
- No opportunity to browse the entity list before committing to a selection

## Goal

Adopt the Customer Service project's "selection-driven" pattern: load the entity list fast, let the user browse and choose, then fetch detail data on demand.

## Design

### 1. Left Panel — Lightweight Rows (Always)

Entity rows display **only**:
- **Line 1:** Entity name (13px semibold)
- **Line 2:** `meta1` subtitle (11px muted) — zone + sales rep for customers, dimension-appropriate meta for others

**Permanently removed from entity rows:**
- Revenue badge (`formatRevenue` + `<motion.span>`)
- `meta2` display (order count)

This applies to **all 6 dimensions** (customers, zones, vendors, brands, product types, products). Each dimension keeps its existing `meta1` content — only revenue and `meta2` are stripped.

### 2. Remove Auto-Select

**Delete** the `useEffect` in `DashboardLayout.tsx` (lines 75-77):
```tsx
// REMOVE THIS:
useEffect(() => {
  if (entities.length > 0 && !activeEntityId) selectEntity(entities[0].id);
}, [entities, activeEntityId, selectEntity]);
```

`activeEntityId` starts as `null` in `useEntitySelection` and stays `null` until the user clicks an entity. The Stage 2 detail query is already gated on `enabled: entityId !== null` — no additional changes needed.

### 3. Right Panel Empty State

The existing placeholder in `DashboardLayout.tsx` (lines 228-237) becomes dimension-aware:

| Dimension | Message |
|-----------|---------|
| customer | "Select a customer to view details" |
| zone | "Select a zone to view details" |
| vendor | "Select a vendor to view details" |
| brand | "Select a brand to view details" |
| productType | "Select a product type to view details" |
| product | "Select a product to view details" |

Simple mapping from `activeDimension` to display label. Existing styling and positioning unchanged.

### 4. Loading Modal — No Change Needed

- Stage 1 ("Loading customers...") still shows during initial entity list fetch
- Stage 2 ("Loading dashboard data...") fires only when user clicks an entity
- The existing `loadingStage` logic in `useDashboardState.ts` handles this correctly without modification

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| `client/src/layouts/DashboardLayout.tsx` | Remove auto-select `useEffect`; make empty state dimension-aware | ~10 lines changed |
| `client/src/components/left-panel/EntityListItem.tsx` | Remove `formatRevenue()`, revenue badge, `meta2` display | ~20 lines removed |

**Total:** 2 files, ~20 lines removed, ~5 lines modified. No backend changes. No new files.

## What "Done" Looks Like

1. App loads → left panel shows all entities with name + meta1 only
2. Right panel shows "Select a [dimension] to view details"
3. No Stage 2 fetch fires until user clicks an entity
4. After clicking, LoadingModal shows "Loading dashboard data...", then right panel renders
5. Left panel rows remain lightweight (no revenue/meta2) even after selection
6. All 6 dimensions follow this pattern
7. `npx tsc -b --noEmit` passes (client)
8. `npx vite build` succeeds
