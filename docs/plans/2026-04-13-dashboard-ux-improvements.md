# Dashboard UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve dashboard usability on 27" screens — full width layout, larger text, iframe-safe clipboard, orders time filter, and expanded items search.

**Architecture:** Five independent frontend-only changes. No backend modifications. The orders filter introduces a thin orchestration layer (`OrdersTab`) between `TabsSection` and `OrdersTable`. Clipboard fix ports a proven utility from the Customer Service sister project.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, Framer Motion

**Spec:** `docs/specs/2026-04-13-dashboard-ux-improvements.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `client/src/utils/clipboard.ts` | Iframe-safe clipboard write with execCommand fallback |
| `client/src/utils/orders-filter.ts` | Pure function: filter OrderRow[] by time range |
| `client/src/components/right-panel/OrdersTab.tsx` | Orchestrates filter state + OrdersFilterBar + OrdersTable |
| `client/src/components/right-panel/OrdersFilterBar.tsx` | Horizontal pill row UI for time range selection |

### Modified Files
| File | Change |
|------|--------|
| `client/src/layouts/DashboardLayout.tsx` | Remove max-w-[1440px] from 3 containers |
| `client/src/components/right-panel/KPICard.tsx` | Bump label + value font sizes |
| `client/src/components/right-panel/DetailHeader.tsx` | Bump entity name + subtitle sizes |
| `client/src/components/right-panel/TabsSection.tsx` | Bump tab label size, swap OrdersTable for OrdersTab |
| `client/src/components/right-panel/OrdersTable.tsx` | Bump header + body font sizes |
| `client/src/components/right-panel/ItemsTable.tsx` | Bump header font sizes |
| `client/src/components/right-panel/ProductMixCarousel.tsx` | Bump chart title size |
| `client/src/components/right-panel/BestSellers.tsx` | Bump title + item text sizes |
| `client/src/components/right-panel/ContactsTable.tsx` | Bump header + body font sizes |
| `client/src/components/shared/CopyableId.tsx` | Use clipboard utility instead of navigator.clipboard |
| `client/src/components/right-panel/ItemsToolbar.tsx` | Start search expanded by default |

---

### Task 1: Full Width Layout

**Files:**
- Modify: `client/src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Remove max-width from main container**

In `DashboardLayout.tsx`, find the main container (line 158):

```tsx
className="mx-auto flex h-[calc(100vh-32px)] max-w-[1440px] gap-[var(--spacing-2xl)] p-[var(--spacing-2xl)] max-lg:h-auto max-lg:flex-col max-lg:overflow-y-auto"
```

Replace with:

```tsx
className="mx-auto flex h-[calc(100vh-32px)] gap-[var(--spacing-2xl)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] max-lg:h-auto max-lg:flex-col max-lg:overflow-y-auto"
```

Changes: removed `max-w-[1440px]`, changed `p-[var(--spacing-2xl)]` to `px-[var(--spacing-3xl)] py-[var(--spacing-2xl)]` for slightly larger horizontal padding (20px vs 16px).

- [ ] **Step 2: Remove max-width from loading skeleton container**

Same file, find the loading skeleton container (line 98):

```tsx
className="mx-auto flex h-[calc(100vh-32px)] max-w-[1440px] gap-[var(--spacing-2xl)] p-[var(--spacing-2xl)]"
```

Replace with:

```tsx
className="mx-auto flex h-[calc(100vh-32px)] gap-[var(--spacing-2xl)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)]"
```

- [ ] **Step 3: Remove max-width from error container**

Same file, find the error container (line 116):

```tsx
className="mx-auto flex h-[calc(100vh-32px)] max-w-[1440px] items-center justify-center p-[var(--spacing-2xl)]"
```

Replace with:

```tsx
className="mx-auto flex h-[calc(100vh-32px)] items-center justify-center px-[var(--spacing-3xl)] py-[var(--spacing-2xl)]"
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`

Expected: clean exit, no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/layouts/DashboardLayout.tsx
git commit -m "feat: remove max-width constraint for full-width layout on large screens"
```

---

### Task 2: Text Size Increase

**Files:**
- Modify: `client/src/components/right-panel/KPICard.tsx`
- Modify: `client/src/components/right-panel/DetailHeader.tsx`
- Modify: `client/src/components/right-panel/TabsSection.tsx`
- Modify: `client/src/components/right-panel/OrdersTable.tsx`
- Modify: `client/src/components/right-panel/ItemsTable.tsx`
- Modify: `client/src/components/right-panel/ProductMixCarousel.tsx`
- Modify: `client/src/components/right-panel/BestSellers.tsx`
- Modify: `client/src/components/right-panel/ContactsTable.tsx`

- [ ] **Step 1: Bump KPICard sizes**

In `KPICard.tsx`:

Line 46 — KPI label: change `text-[10px]` to `text-[11px]`
```tsx
<span className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-muted)]">
```

Line 49 — KPI primary value: change `text-[17px]` to `text-[19px]`
```tsx
<span className="mt-[var(--spacing-2xs)] text-[19px] font-bold text-[var(--color-text-primary)]">
```

- [ ] **Step 2: Bump DetailHeader sizes**

In `DetailHeader.tsx`:

Line 32 — Entity name: change `text-[20px]` to `text-[22px]`
```tsx
className="truncate text-[22px] font-bold leading-[1.3] text-[var(--color-text-primary)]"
```

Line 39 — Subtitle: change `text-[11px]` to `text-[12px]` (both the `<p>` and the `CopyableId` inside)
```tsx
className="mt-[var(--spacing-2xs)] truncate text-[12px] text-[var(--color-text-muted)]"
```

Line 42 — CopyableId within subtitle: change `text-[11px]` to `text-[12px]`
```tsx
<CopyableId value={entity.id} label="ID" className="inline text-[12px] text-[var(--color-text-muted)]" />
```

- [ ] **Step 3: Bump TabsSection tab label size**

In `TabsSection.tsx`, line 83 — tab button text: change `text-[14px]` to `text-[15px]`

```tsx
className={`relative flex items-center gap-1.5 py-3 text-[15px] transition-colors duration-200 outline-none ${
```

- [ ] **Step 4: Bump OrdersTable sizes**

In `OrdersTable.tsx`:

Line 57 — Table headers: change `text-[11px]` to `text-[12px]`
```tsx
className={`px-[var(--spacing-3xl)] py-[var(--spacing-lg)] text-left text-[12px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide whitespace-nowrap ${
```

Lines 113, 116, 119, 122, 125, 128 — All table body `text-[13px]` to `text-[14px]`. There are 6 `<td>` elements in the OrderRowGroup function. Change each `text-[13px]` to `text-[14px]`.

Line 132 — Status badge: change `text-[11px]` to `text-[12px]`
```tsx
<span className={`inline-block px-2 py-0.5 rounded-full text-[12px] font-semibold whitespace-nowrap ${STATUS_STYLES[order.status] ?? DEFAULT_STATUS_STYLE}`}>
```

- [ ] **Step 5: Bump ItemsTable header size**

In `ItemsTable.tsx`, line 48 — column headers: change `text-[11px]` to `text-[12px]`

```tsx
className={`${col.width} text-${col.field === 'name' ? 'left' : 'right'} text-[12px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide hover:text-[var(--color-text-secondary)] transition-colors`}
```

- [ ] **Step 6: Bump ProductMixCarousel title size**

In `ProductMixCarousel.tsx`, line 78 — chart title: change `text-[14px]` to `text-[15px]`

```tsx
className="text-[15px] font-semibold text-[var(--color-text-primary)]"
```

- [ ] **Step 7: Bump BestSellers sizes**

In `BestSellers.tsx`:

Line 35 — Seller name: change `text-[13px]` to `text-[14px]`
```tsx
<p className="truncate text-[14px] font-medium leading-tight text-[var(--color-text-primary)]">
```

Line 84 — Chart title: change `text-[14px]` to `text-[15px]`
```tsx
<h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
```

- [ ] **Step 8: Bump ContactsTable sizes**

In `ContactsTable.tsx`:

Line 39 — Table headers: change `text-[11px]` to `text-[12px]`
```tsx
className={`${col.width} px-[var(--spacing-3xl)] py-[var(--spacing-lg)] text-left text-[12px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide`}
```

Lines 52, 55, 58, 61 — All body `text-[13px]` to `text-[14px]`. Change each `<td>` from `text-[13px]` to `text-[14px]`.

- [ ] **Step 9: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`

Expected: clean exit, no errors.

- [ ] **Step 10: Commit**

```bash
git add client/src/components/right-panel/KPICard.tsx \
       client/src/components/right-panel/DetailHeader.tsx \
       client/src/components/right-panel/TabsSection.tsx \
       client/src/components/right-panel/OrdersTable.tsx \
       client/src/components/right-panel/ItemsTable.tsx \
       client/src/components/right-panel/ProductMixCarousel.tsx \
       client/src/components/right-panel/BestSellers.tsx \
       client/src/components/right-panel/ContactsTable.tsx
git commit -m "feat: increase text sizes by 1-2px for better readability on large screens"
```

---

### Task 3: Iframe-Safe Clipboard

**Files:**
- Create: `client/src/utils/clipboard.ts`
- Modify: `client/src/components/shared/CopyableId.tsx`

- [ ] **Step 1: Create clipboard utility**

Create `client/src/utils/clipboard.ts`:

```typescript
// FILE: client/src/utils/clipboard.ts
// PURPOSE: Copy text to clipboard with iframe-safe fallback
// USED BY: CopyableId.tsx
// EXPORTS: copyToClipboard

// WHY: navigator.clipboard.writeText() requires the iframe to have
// allow="clipboard-write" permission. In the Airtable Omni iframe,
// we don't control this attribute, so the Clipboard API silently fails.
// The execCommand fallback is deprecated but works in all major browsers
// and doesn't require iframe permissions.

export async function copyToClipboard(text: string): Promise<boolean> {
  // WHY: Try modern Clipboard API first (works outside iframes or with permission)
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through to execCommand fallback
  }

  // WHY: Fallback for Airtable iframe — no permission needed
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // WHY: Position offscreen to avoid visual flash
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Update CopyableId to use the utility**

In `CopyableId.tsx`, replace the entire file content with:

```typescript
// FILE: client/src/components/shared/CopyableId.tsx
// PURPOSE: Inline click-to-copy button for IDs, SKUs, order numbers — copies to clipboard + triggers toast
// USED BY: DetailHeader, BestSellers, ItemsAccordion, OrdersTable
// EXPORTS: CopyableId

import { useCallback } from 'react';
import { useCopyToast } from './CopyToast';
import { copyToClipboard } from '../../utils/clipboard';

interface CopyableIdProps {
  value: string;
  /** Toast message prefix, e.g. "SKU" -> "Copied SKU" */
  label?: string;
  className?: string;
}

export function CopyableId({ value, label, className = '' }: CopyableIdProps) {
  const { showToast } = useCopyToast();

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(value);
    if (success) {
      showToast(`Copied ${label ?? value}`);
    }
  }, [value, label, showToast]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`group/copy inline-flex items-center gap-1 cursor-pointer rounded-[var(--radius-sm)] px-1 -mx-1 transition-all duration-150 hover:text-[var(--color-gold-primary)] hover:bg-[var(--color-gold-hover)] ${className}`}
      title={`Click to copy: ${value}`}
    >
      {value}
      {/* WHY: Clipboard icon appears on hover to signal copy affordance */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        className="shrink-0 opacity-0 transition-opacity duration-150 group-hover/copy:opacity-100"
        aria-hidden="true"
      >
        <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );
}
```

Key changes from current:
- Import `copyToClipboard` from utils
- `handleCopy` is now `async`, calls `copyToClipboard(value)` instead of `navigator.clipboard.writeText(value)`
- Only shows toast on success (`if (success)`)
- Removed the `.then()` chain, using `await` instead

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`

Expected: clean exit, no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/utils/clipboard.ts client/src/components/shared/CopyableId.tsx
git commit -m "fix: add iframe-safe clipboard fallback for Airtable embed"
```

---

### Task 4: Orders Time Filter Pills

**Files:**
- Create: `client/src/utils/orders-filter.ts`
- Create: `client/src/components/right-panel/OrdersFilterBar.tsx`
- Create: `client/src/components/right-panel/OrdersTab.tsx`
- Modify: `client/src/components/right-panel/TabsSection.tsx`

- [ ] **Step 1: Create orders filter utility**

Create `client/src/utils/orders-filter.ts`:

```typescript
// FILE: client/src/utils/orders-filter.ts
// PURPOSE: Filter OrderRow[] by time range — pure function, no side effects
// USED BY: OrdersTab.tsx
// EXPORTS: filterOrdersByTimeRange, OrderTimeFilter, ORDER_FILTER_OPTIONS

import type { OrderRow } from '@shared/types/dashboard';

export type OrderTimeFilter = 'last30' | '3months' | '6months' | '2026' | '2025';

export interface OrderFilterOption {
  key: OrderTimeFilter;
  label: string;
}

export const ORDER_FILTER_OPTIONS: OrderFilterOption[] = [
  { key: 'last30', label: 'Last 30 Days' },
  { key: '3months', label: '3 Months' },
  { key: '6months', label: '6 Months' },
  { key: '2026', label: '2026' },
  { key: '2025', label: '2025' },
];

/** WHY pure function: easy to test, no React dependency */
export function filterOrdersByTimeRange(
  orders: OrderRow[],
  filter: OrderTimeFilter | null,
): OrderRow[] {
  if (!filter) return orders;

  const now = new Date();

  switch (filter) {
    case 'last30': {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);
      return orders.filter(o => new Date(o.date) >= cutoff);
    }
    case '3months': {
      const cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - 3);
      return orders.filter(o => new Date(o.date) >= cutoff);
    }
    case '6months': {
      const cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - 6);
      return orders.filter(o => new Date(o.date) >= cutoff);
    }
    case '2026':
      return orders.filter(o => o.date.startsWith('2026'));
    case '2025':
      return orders.filter(o => o.date.startsWith('2025'));
  }
}
```

- [ ] **Step 2: Create OrdersFilterBar component**

Create `client/src/components/right-panel/OrdersFilterBar.tsx`:

```typescript
// FILE: client/src/components/right-panel/OrdersFilterBar.tsx
// PURPOSE: Horizontal pill row for filtering orders by time range
// USED BY: OrdersTab.tsx
// EXPORTS: OrdersFilterBar

import type { OrderTimeFilter } from '../../utils/orders-filter';
import { ORDER_FILTER_OPTIONS } from '../../utils/orders-filter';

interface OrdersFilterBarProps {
  activeFilter: OrderTimeFilter | null;
  onFilterChange: (filter: OrderTimeFilter | null) => void;
  filteredCount: number;
  totalCount: number;
}

export function OrdersFilterBar({
  activeFilter,
  onFilterChange,
  filteredCount,
  totalCount,
}: OrdersFilterBarProps) {
  const isFiltered = activeFilter !== null;

  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-gold-subtle)] px-[var(--spacing-3xl)] py-[var(--spacing-base)]">
      {ORDER_FILTER_OPTIONS.map((option) => {
        const isActive = activeFilter === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onFilterChange(isActive ? null : option.key)}
            className={`rounded-full px-3 py-1 text-[12px] transition-all duration-150 cursor-pointer ${
              isActive
                ? 'bg-[var(--color-dark)] text-white font-semibold border border-transparent'
                : 'border border-[var(--color-gold-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-gold-primary)] hover:text-[var(--color-text-secondary)]'
            }`}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}

      <div className="flex-1" />

      {isFiltered && (
        <span className="text-[11px] text-[var(--color-text-muted)]">
          Showing {filteredCount} of {totalCount}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create OrdersTab orchestrator**

Create `client/src/components/right-panel/OrdersTab.tsx`:

```typescript
// FILE: client/src/components/right-panel/OrdersTab.tsx
// PURPOSE: Orchestrates orders time filter state + OrdersFilterBar + OrdersTable
// USED BY: TabsSection.tsx
// EXPORTS: OrdersTab

import { useState, useMemo } from 'react';
import type { OrderRow } from '@shared/types/dashboard';
import type { OrderTimeFilter } from '../../utils/orders-filter';
import { filterOrdersByTimeRange } from '../../utils/orders-filter';
import { OrdersFilterBar } from './OrdersFilterBar';
import { OrdersTable } from './OrdersTable';

interface OrdersTabProps {
  orders: OrderRow[];
}

export function OrdersTab({ orders }: OrdersTabProps) {
  const [activeFilter, setActiveFilter] = useState<OrderTimeFilter | null>(null);

  const filteredOrders = useMemo(
    () => filterOrdersByTimeRange(orders, activeFilter),
    [orders, activeFilter],
  );

  return (
    <>
      <OrdersFilterBar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        filteredCount={filteredOrders.length}
        totalCount={orders.length}
      />
      <OrdersTable orders={filteredOrders} />
    </>
  );
}
```

- [ ] **Step 4: Wire OrdersTab into TabsSection**

In `TabsSection.tsx`:

Add import at the top (after existing imports, line 9 area):
```typescript
import { OrdersTab } from './OrdersTab';
```

Remove the existing `OrdersTable` import (line 8):
```typescript
// DELETE this line:
import { OrdersTable } from './OrdersTable';
```

Replace the Orders tab panel rendering (line 121):

Old:
```tsx
{activeTab === 'orders' && <OrdersTable orders={orders} />}
```

New:
```tsx
{activeTab === 'orders' && <OrdersTab orders={orders} />}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`

Expected: clean exit, no errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/utils/orders-filter.ts \
       client/src/components/right-panel/OrdersFilterBar.tsx \
       client/src/components/right-panel/OrdersTab.tsx \
       client/src/components/right-panel/TabsSection.tsx
git commit -m "feat: add time range filter pills to Orders tab"
```

---

### Task 5: Items Search Expanded by Default

**Files:**
- Modify: `client/src/components/right-panel/ItemsToolbar.tsx`

- [ ] **Step 1: Update ExpandableSearch initial state and width**

In `ItemsToolbar.tsx`, find the `ExpandableSearch` function (line 103). Make three changes:

**Change 1** — Line 104, initial expanded state. Change:
```tsx
const [expanded, setExpanded] = useState(!!searchTerm);
```
To:
```tsx
const [expanded, setExpanded] = useState(true);
```

**Change 2** — Line 128, animated width. Change:
```tsx
animate={{ width: expanded ? 180 : 28 }}
```
To:
```tsx
animate={{ width: expanded ? 220 : 28 }}
```

**Change 3** — Line 140, placeholder text. Change:
```tsx
placeholder="Search..."
```
To:
```tsx
placeholder="Search items..."
```

**Change 4** — Line 109, sync effect. Change:
```tsx
useEffect(() => { setLocal(searchTerm); if (!searchTerm) setExpanded(false); }, [searchTerm]);
```
To:
```tsx
useEffect(() => { setLocal(searchTerm); }, [searchTerm]);
```

This removes the auto-collapse when searchTerm is cleared externally, keeping the search always visible. It still collapses on blur via `handleBlur` (line 124) when the user clicks away with empty input.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`

Expected: clean exit, no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/right-panel/ItemsToolbar.tsx
git commit -m "feat: expand items search bar by default for better discoverability"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run full TypeScript check (client)**

Run: `cd client && npx tsc -b --noEmit`

Expected: clean exit, no errors.

- [ ] **Step 2: Run full TypeScript check (server)**

Run: `cd server && npx tsc --noEmit`

Expected: clean exit, no errors (server unchanged but verify no shared type breakage).

- [ ] **Step 3: Run server tests**

Run: `cd server && npx vitest run`

Expected: 63 tests, 61 pass (2 known formatDays test-code mismatches).

- [ ] **Step 4: Build client bundle**

Run: `cd client && npx vite build`

Expected: successful build, bundle size < 500KB gzip.

- [ ] **Step 5: Check for any types**

Run: `grep -rn ": any\|as any" client/src/utils/clipboard.ts client/src/utils/orders-filter.ts client/src/components/right-panel/OrdersTab.tsx client/src/components/right-panel/OrdersFilterBar.tsx`

Expected: no matches.

- [ ] **Step 6: Check file lengths**

Run: `wc -l client/src/utils/clipboard.ts client/src/utils/orders-filter.ts client/src/components/right-panel/OrdersTab.tsx client/src/components/right-panel/OrdersFilterBar.tsx`

Expected: all under 200 lines.
