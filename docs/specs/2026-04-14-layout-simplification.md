# Layout Simplification — Remove Resize System, Restore Fixed Layout

## Goal

Remove the resize/preset system from the right panel and restore a fixed vertical layout. Panel collapse moves to URL-backed state. Remove the entity list cascade animation so search results appear instantly. All non-layout behavioral improvements (a11y, URL state, controlled tabs, modals) are preserved.

## Motivation

The resize system (drag handles, Compact/Balanced/Spacious presets, persisted ratios) adds ~305 lines of code and threads ratio props through 4 component layers. In practice, users rarely adjust layout ratios — the fixed pre-resize layout worked well. Removing this machinery simplifies the codebase and eliminates a class of layout bugs (subpixel jitter, stale localStorage, ratio constraints).

## Approach

Surgical removal: keep current files, delete the 4 resize/preset files, simplify existing components in place. No git rollback — preserves all Codex improvements.

---

## 1. Files to Delete

| File | Lines | Reason |
|------|-------|--------|
| `client/src/hooks/useResizablePanel.ts` | 80 | Mouse/touch drag resize — no longer needed |
| `client/src/hooks/useDashboardLayout.ts` | 130 | Preset state, ratios, localStorage — replaced by URL state for collapse, fixed CSS for geometry |
| `client/src/components/right-panel/LayoutPresetToggle.tsx` | 53 | Compact/Balanced/Spacious toggle UI |
| `client/src/components/right-panel/ResizeDivider.tsx` | 42 | Visual resize handle |

**Total removed:** ~305 lines across 4 files.

## 2. URL State: Add Panel Collapse

Panel collapse state moves from localStorage (`sg-dashboard-layout`) to the existing URL-backed shell state system.

### `client/src/hooks/shell-state-url.ts`

- Add `panelCollapsed: boolean` to `DashboardShellState` interface
- Default: `false` (always expanded on first visit — no viewport detection)
- URL param: `collapsed=1` when collapsed, omitted when expanded (default)
- `parseSearchParams`: read `collapsed` param, parse as boolean
- `buildSearch`: include `collapsed=1` only when true

### `client/src/hooks/useDashboardShellState.ts`

- Add `togglePanel()` callback: flips `panelCollapsed`, uses `'replace'` history mode (no back-button pollution)
- Export `panelCollapsed` and `togglePanel` alongside existing state

### `client/src/hooks/__tests__/shell-state-url.test.ts`

- Add tests: parse `collapsed=1` → true, missing param → false, round-trip preservation

## 3. Right Panel: Fixed Vertical Stack

### `client/src/components/right-panel/RightPanel.tsx` (83 → ~45 lines)

**Remove:**
- `useResizablePanel` hook call
- `ResizeDivider` component between KPI and Charts
- All ratio props: `heroKpiGridTemplate`, `heroKpiRatio`, `kpiChartsRatio`, `onHeroKpiRatioChange`, `onKpiChartsRatioChange`
- `activePreset`, `onPresetChange`, `onResetLayout` props
- Dynamic `style={{ flex: ... }}` on sections

**Result:** Simple vertical stack with natural heights:
```
DetailHeader
KPISection
ChartsRow
TabsSection
```

Each section renders at its natural content height. The right panel scrolls vertically if content exceeds viewport.

### `client/src/components/right-panel/KPISection.tsx` (259 lines, minor changes)

**Remove:**
- `useResizablePanel` hook call for horizontal resize
- `ResizeDivider` between hero and KPI grid
- `heroKpiGridTemplate`, `heroKpiRatio`, `onHeroKpiRatioChange` props

**Replace with:** Fixed CSS Grid — `grid-cols-[3fr_2fr]` (hero card left: 3 parts, KPI grid right: 2 parts). Same ratio as pre-resize layout.

Hero chart height: fixed `h-[120px]` instead of container-driven sizing.

### `client/src/components/right-panel/DetailHeader.tsx` (76 → ~50 lines)

**Remove:**
- `LayoutPresetToggle` component and its import
- Reset layout button
- All preset/reset props

**Keep:** Entity name, metadata, period selector, export button. Top-right area becomes: period selector + export only.

## 4. Props Cleanup

### `client/src/layouts/dashboard-layout-types.ts`

Remove from `DashboardLayoutProps`:
- `heroKpiRatio`
- `kpiChartsRatio`
- `heroKpiGridTemplate`
- `onHeroKpiRatioChange`
- `onKpiChartsRatioChange`
- `activePreset`
- `onPresetChange`
- `onResetLayout`

Add to `DashboardLayoutProps`:
- `panelCollapsed: boolean`
- `togglePanel: () => void`

### `client/src/layouts/DashboardLayout.tsx`

- Remove `useDashboardLayout()` hook call and all its destructured values
- Panel collapse now comes via props: `panelCollapsed` and `togglePanel` (threaded from shell state through App.tsx)
- Keep `[` keyboard shortcut — wire to `togglePanel()` prop
- Remove layout-related prop passing to `RightPanel`

### `client/src/hooks/useDashboardState.ts`

- Pass through `panelCollapsed` and `togglePanel` from the internal `useDashboardShellState()` call to the return value

### `client/src/App.tsx` (or wherever DashboardLayout is rendered)

- Thread `panelCollapsed` and `togglePanel` from `useDashboardState()` into `DashboardLayout` props

## 5. localStorage Cleanup

Add a one-time cleanup in `DashboardLayout.tsx` (or an effect in the shell state hook):

```typescript
// One-time cleanup: remove stale layout localStorage from resize era
useEffect(() => {
  localStorage.removeItem('sg-dashboard-layout');
}, []);
```

This runs once on mount and clears the old key so returning users don't have stale data. Can be removed in a future cleanup pass.

## 6. Remove Entity List Cascade Animation

The entity list uses `motion.div` with `initial={{ opacity: 0, y: 8 }}` on every `EntityListItem` mount. When search results change (e.g., typing "Disney"), React unmounts old items and mounts new ones — each fades in from invisible over 200ms. This makes results feel sluggish even though the data is ready instantly.

### `client/src/components/left-panel/EntityListItem.tsx`

- Replace `motion.div` with plain `div`
- Remove `initial`, `animate`, `transition` props
- Remove `animationDelay` prop from interface and destructuring
- Remove `import { motion } from 'framer-motion'`

### `client/src/components/left-panel/EntityList.tsx`

- Remove `hasAnimated` ref and its `useEffect`
- Remove `animationDelay` prop from `EntityListItem` usage (line 99)
- Remove `useRef, useEffect` from import if no longer needed (keep `useRef` if used elsewhere)

**Result:** Search results appear instantly — no fade, no slide, no delay.

## 7. Preserved Behaviors (No Changes)


These systems are NOT touched by this refactor:

- **Card modals:** KPI, hero, Product Mix, Best Sellers click-to-expand via `ModalProvider`/`CardModal`
- **Controlled tabs:** `activeTab`/`onTabChange` API unchanged
- **Period popover:** PeriodSelector with "More" dropdown
- **Order disclosure:** Accordion in OrdersTable
- **Card keyboard nav:** `useCardNavigation` with arrow keys
- **Tab keyboard nav:** Arrow left/right in TabsSection
- **URL-backed state:** dimension, period, entity, tab, search, sort (plus new `collapsed`)
- **Left rail:** `CollapsedPanel.tsx`, expand button, dimension indicator
- **a11y:** All ARIA roles, labels, keyboard handlers
- **Charts row:** Fixed `grid-cols-[3fr_5fr]` (Product Mix : Best Sellers)
- **Animations:** Framer Motion on modals, sub-items, tab transitions (entity list animation removed per Section 6)

## 8. Verification

```bash
# TypeScript
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit

# Tests
cd ../server && npx vitest run
cd ../client && npx vitest run

# Build
cd ../client && npx vite build

# Dead code check — these should return 0 results:
grep -rn "useResizablePanel\|useDashboardLayout\|LayoutPresetToggle\|ResizeDivider" client/src/
grep -rn "heroKpiRatio\|kpiChartsRatio\|heroKpiGridTemplate\|onHeroKpiRatioChange\|onKpiChartsRatioChange" client/src/
grep -rn "activePreset\|onPresetChange\|onResetLayout" client/src/
grep -rn "sg-dashboard-layout" client/src/  # should only be in the cleanup effect
grep -rn "animationDelay" client/src/  # should return 0 results

# File limits
wc -l client/src/components/right-panel/RightPanel.tsx    # must be <80
wc -l client/src/components/right-panel/DetailHeader.tsx   # must be <70
wc -l client/src/components/right-panel/KPISection.tsx     # must be <260
```

Manual verification: start dev servers, confirm layout renders with fixed grid, panel collapse works via `[` key, URL reflects `collapsed=1`, modals open on card click, all tabs work.
