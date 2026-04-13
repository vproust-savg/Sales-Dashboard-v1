# Selection-Driven First Load Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch from auto-selecting the first entity on load to waiting for the user to click — matching the Customer Service project pattern.

**Architecture:** Frontend-only change. Remove auto-select `useEffect` in `DashboardLayout`, strip revenue/meta2 from `EntityListItem`, add a `singularLabel` to `DIMENSION_CONFIG` for the dimension-aware empty state message.

**Tech Stack:** React 19, TypeScript, Framer Motion, Tailwind CSS v4

---

### Task 1: Add `singularLabel` to dimension config

**Files:**
- Modify: `client/src/utils/dimension-config.ts`

- [ ] **Step 1: Add `singularLabel` to the `DimensionConfig` interface**

```typescript
export interface DimensionConfig {
  label: string;
  singularLabel: string;
  pluralLabel: string;
  searchPlaceholder: string;
  allLabel: string;
  filterFields: string[];
}
```

- [ ] **Step 2: Add `singularLabel` values to each dimension entry**

```typescript
customer: {
  label: 'Customers',
  singularLabel: 'customer',
  // ... rest unchanged
},
zone: {
  label: 'Zone',
  singularLabel: 'zone',
  // ... rest unchanged
},
vendor: {
  label: 'Vendors',
  singularLabel: 'vendor',
  // ... rest unchanged
},
brand: {
  label: 'Brands',
  singularLabel: 'brand',
  // ... rest unchanged
},
product_type: {
  label: 'Prod. Type',
  singularLabel: 'product type',
  // ... rest unchanged
},
product: {
  label: 'Products',
  singularLabel: 'product',
  // ... rest unchanged
},
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors (all existing usages still satisfy the interface since we only added a field)

- [ ] **Step 4: Commit**

```bash
git add client/src/utils/dimension-config.ts
git commit -m "feat: add singularLabel to dimension config for empty state messages"
```

---

### Task 2: Strip revenue badge and meta2 from EntityListItem

**Files:**
- Modify: `client/src/components/left-panel/EntityListItem.tsx`

- [ ] **Step 1: Remove the `formatRevenue` helper function**

Delete lines 18-25 (the entire `formatRevenue` function):

```typescript
// DELETE THIS ENTIRE BLOCK:
/** WHY: separate formatter avoids importing a utility for a simple "$X,XXX" pattern */
function formatRevenue(value: number | null): string | null {
  if (value === null) return null;
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  }
  return `$${value.toLocaleString()}`;
}
```

- [ ] **Step 2: Remove the revenue badge from the name row**

In the entity content section, replace the `<div>` that contains both name and revenue (lines 92-106) with just the name:

```tsx
{/* Entity content — name, meta1 */}
<div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-2xs)]">
  <span className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
    {entity.name}
  </span>
  <span className="truncate text-[11px] text-[var(--color-text-muted)]">
    {entity.meta1}
  </span>
</div>
```

This removes:
- The `flex items-start justify-between` wrapper div around name + revenue
- The entire `formatRevenue(entity.revenue)` conditional `<motion.span>` block
- The `flex items-center justify-between` wrapper div around meta1 + meta2
- The entire `entity.meta2` conditional `<motion.span>` block

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors. The `entity` prop still has `revenue` and `meta2` fields — we're just not rendering them.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/left-panel/EntityListItem.tsx
git commit -m "feat: strip revenue badge and meta2 from entity list rows"
```

---

### Task 3: Remove auto-select and add dimension-aware empty state

**Files:**
- Modify: `client/src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Add import for `DIMENSION_CONFIG`**

Add to the imports section (after the existing component imports, before `useExport`):

```typescript
import { DIMENSION_CONFIG } from '../utils/dimension-config';
```

- [ ] **Step 2: Remove the auto-select `useEffect`**

Delete lines 75-77:

```typescript
// DELETE THIS ENTIRE BLOCK:
useEffect(() => {
  if (entities.length > 0 && !activeEntityId) selectEntity(entities[0].id);
}, [entities, activeEntityId, selectEntity]);
```

Also remove `useEffect` from the React import on line 6 if it's no longer used elsewhere in this file. Current import:

```typescript
import { useEffect, useState, useMemo } from 'react';
```

After removing the `useEffect` call, check if `useEffect` is used anywhere else in the file. It is not — so change to:

```typescript
import { useState, useMemo } from 'react';
```

- [ ] **Step 3: Make the empty state message dimension-aware**

Replace the placeholder text (lines 228-237):

```tsx
<motion.div
  key="placeholder"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  className="flex flex-1 items-center justify-center"
>
  <p className="text-[14px] text-[var(--color-text-muted)]">
    Select a customer to view details
  </p>
</motion.div>
```

With:

```tsx
<motion.div
  key="placeholder"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  className="flex flex-1 items-center justify-center"
>
  <p className="text-[14px] text-[var(--color-text-muted)]">
    Select a {DIMENSION_CONFIG[activeDimension].singularLabel} to view details
  </p>
</motion.div>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 5: Verify Vite build succeeds**

Run: `cd client && npx vite build`
Expected: Build completes with no errors, bundle size < 500KB gzip

- [ ] **Step 6: Commit**

```bash
git add client/src/layouts/DashboardLayout.tsx
git commit -m "feat: remove auto-select, add dimension-aware empty state"
```

---

### Task 4: Pre-deploy verification

- [ ] **Step 1: Client TypeScript build**

Run: `cd client && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 2: Server TypeScript build**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Server tests**

Run: `cd server && npx vitest run`
Expected: All tests pass (63 total, 61 pass — 2 formatDays tests have known test-code mismatch)

- [ ] **Step 4: Client bundle build**

Run: `cd client && npx vite build`
Expected: Build succeeds, bundle < 500KB gzip

- [ ] **Step 5: Check for `any` types**

Run: `grep -rn ": any\|as any" server/src/ client/src/`
Expected: No matches in changed files

- [ ] **Step 6: Verify no files exceed 200 lines**

Run: `wc -l client/src/layouts/DashboardLayout.tsx client/src/components/left-panel/EntityListItem.tsx client/src/utils/dimension-config.ts`
Expected: All files under 200 lines
