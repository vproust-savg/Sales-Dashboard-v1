# Items Table — Spacing, Sort & Frequency Color Coding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Bugs:** If you encounter a bug, use superpowers:systematic-debugging — do not guess at fixes.

**Goal:** Fix header collision between VALUE/AVG MARGIN %, make LAST ORDER sortable, and replace hardcoded day-threshold colors with frequency-relative color coding.

**Architecture:** Four files change in isolation — one utility (`items-grouping.ts`) and three components. No new files, no new props interfaces except adding a parameter to a module-private function. TypeScript type-checking serves as the test gate (no client-side unit test harness exists).

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4 utility classes, Framer Motion (not touched), existing design tokens (`--color-green`, `--color-yellow`, `--color-red`, `--color-text-muted`).

**Spec:** `docs/superpowers/specs/2026-04-14-items-table-spacing-design.md`

---

## File Map

| File | What Changes |
|------|-------------|
| `client/src/utils/items-grouping.ts` | Add `'lastOrderDate'` to `ItemSortField`; add null-safety to `sortFlatItems` |
| `client/src/components/right-panel/ItemsTable.tsx` | Avg Margin % `w-24`→`w-28`; Last Order `field: null`→`field: 'lastOrderDate'` |
| `client/src/components/right-panel/ItemsProductRow.tsx` | Avg Margin % body cell `w-24`→`w-28`; rewrite `formatLastOrder` with `purchaseFrequency` param |
| `client/src/components/right-panel/ItemsGroupRow.tsx` | Avg Margin % group-aggregate span `w-24`→`w-28` |

---

## Task 1 — Extend `ItemSortField` + null-safe `sortFlatItems`

**Files:**
- Modify: `client/src/utils/items-grouping.ts:10` (type union)
- Modify: `client/src/utils/items-grouping.ts:102-112` (`sortFlatItems` body)

- [ ] **Step 1.1 — Add `'lastOrderDate'` to `ItemSortField`**

  Open `client/src/utils/items-grouping.ts` line 10. Replace:
  ```ts
  export type ItemSortField = 'name' | 'value' | 'marginPercent' | 'marginAmount' | 'totalUnits' | 'purchaseFrequency' | 'lastPrice';
  ```
  With:
  ```ts
  export type ItemSortField = 'name' | 'value' | 'marginPercent' | 'marginAmount' | 'totalUnits' | 'purchaseFrequency' | 'lastPrice' | 'lastOrderDate';
  ```

- [ ] **Step 1.2 — Add null-safety to `sortFlatItems`**

  Replace the entire `sortFlatItems` function (lines 102–112) with:
  ```ts
  export function sortFlatItems(items: FlatItem[], field: ItemSortField, dir: 'asc' | 'desc'): FlatItem[] {
    return [...items].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      /** WHY: lastOrderDate is string | null — null vs string produces NaN without this guard.
       *  Nulls sort last regardless of direction so "no history" items sink to bottom. */
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const diff = (aVal as number) - (bVal as number);
      return dir === 'asc' ? diff : -diff;
    });
  }
  ```

- [ ] **Step 1.3 — Type-check**

  ```bash
  cd client && npx tsc -b --noEmit
  ```
  Expected: no errors. If errors appear, the `FlatItem` type may not have `lastOrderDate` — check `shared/types/dashboard.ts`. It should be `lastOrderDate: string | null` at approximately line 165.

- [ ] **Step 1.4 — Commit**

  ```bash
  git add client/src/utils/items-grouping.ts
  git commit -m "feat(items): add lastOrderDate to ItemSortField, null-safe sortFlatItems"
  ```

---

## Task 2 — Update `ItemsTable.tsx`: column widths + Last Order field

**Files:**
- Modify: `client/src/components/right-panel/ItemsTable.tsx:27` (Avg Margin % width)
- Modify: `client/src/components/right-panel/ItemsTable.tsx:32` (Last Order field)

- [ ] **Step 2.1 — Widen Avg Margin % header column**

  In `client/src/components/right-panel/ItemsTable.tsx`, line 27. Replace:
  ```ts
  { label: 'Avg Margin %', field: 'marginPercent', width: 'w-24' },
  ```
  With:
  ```ts
  { label: 'Avg Margin %', field: 'marginPercent', width: 'w-28' },
  ```

- [ ] **Step 2.2 — Make Last Order sortable**

  Line 32. Replace:
  ```ts
  { label: 'Last Order', field: null, width: 'w-24' },
  ```
  With:
  ```ts
  { label: 'Last Order', field: 'lastOrderDate', width: 'w-24' },
  ```
  The existing `SortArrow` component and `onToggleSort` handler need no changes — they already work for any non-null `field`.

- [ ] **Step 2.3 — Type-check**

  ```bash
  cd client && npx tsc -b --noEmit
  ```
  Expected: no errors.

- [ ] **Step 2.4 — Commit**

  ```bash
  git add client/src/components/right-panel/ItemsTable.tsx
  git commit -m "feat(items): widen avg margin % column, make last order sortable"
  ```

---

## Task 3 — Update `ItemsProductRow.tsx`: body cell width + frequency color coding

**Files:**
- Modify: `client/src/components/right-panel/ItemsProductRow.tsx:18-27` (`formatLastOrder`)
- Modify: `client/src/components/right-panel/ItemsProductRow.tsx:32` (call site)
- Modify: `client/src/components/right-panel/ItemsProductRow.tsx:52` (body cell width)

- [ ] **Step 3.1 — Rewrite `formatLastOrder` with frequency parameter**

  Replace lines 18–27 (the entire `formatLastOrder` function) with:
  ```tsx
  /** WHY: color reflects how overdue the order is relative to the customer's actual purchase
   *  cadence, not arbitrary fixed-day thresholds. intervalDays = 30 / freq converts
   *  orders/month to the expected gap between orders in days. */
  function formatLastOrder(isoDate: string | null, purchaseFrequency: number): { text: string; color: string } {
    if (!isoDate) return { text: '\u2014', color: 'var(--color-text-muted)' };
    const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
    const text = days <= 0 ? 'Today' : days === 1 ? '1d' : days < 7 ? `${days}d` : days < 30 ? `${Math.floor(days / 7)}w` : `${Math.floor(days / 30)}mo`;
    if (purchaseFrequency <= 0) return { text, color: 'var(--color-text-muted)' };
    const intervalDays = 30 / purchaseFrequency;
    const color = days <= intervalDays
      ? 'var(--color-green)'
      : days <= 2 * intervalDays
        ? 'var(--color-yellow)'
        : 'var(--color-red)';
    return { text, color };
  }
  ```

- [ ] **Step 3.2 — Update call site to pass `purchaseFrequency`**

  Line 32. Replace:
  ```tsx
  const lastOrder = formatLastOrder(item.lastOrderDate);
  ```
  With:
  ```tsx
  const lastOrder = formatLastOrder(item.lastOrderDate, item.purchaseFrequency);
  ```

- [ ] **Step 3.3 — Widen Avg Margin % body cell**

  Line 52. Replace:
  ```tsx
  <div role="gridcell" className="w-24 text-right text-[14px] tabular-nums text-[var(--color-text-muted)]">
  ```
  With:
  ```tsx
  <div role="gridcell" className="w-28 text-right text-[14px] tabular-nums text-[var(--color-text-muted)]">
  ```

- [ ] **Step 3.4 — Type-check**

  ```bash
  cd client && npx tsc -b --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3.5 — Commit**

  ```bash
  git add client/src/components/right-panel/ItemsProductRow.tsx
  git commit -m "feat(items): freq-based last order colors, widen avg margin % cell"
  ```

---

## Task 4 — Update `ItemsGroupRow.tsx`: group aggregate cell width

**Files:**
- Modify: `client/src/components/right-panel/ItemsGroupRow.tsx:51`

- [ ] **Step 4.1 — Widen margin % span in group row**

  Line 51 of `client/src/components/right-panel/ItemsGroupRow.tsx`. Replace:
  ```tsx
  <span role="gridcell" className="w-24 text-right text-[14px] tabular-nums text-[var(--color-text-secondary)]">
  ```
  With:
  ```tsx
  <span role="gridcell" className="w-28 text-right text-[14px] tabular-nums text-[var(--color-text-secondary)]">
  ```

- [ ] **Step 4.2 — Type-check**

  ```bash
  cd client && npx tsc -b --noEmit
  ```
  Expected: no errors.

- [ ] **Step 4.3 — Run server tests** (confirms no regressions in shared types)

  ```bash
  cd server && npx vitest run
  ```
  Expected: all 107 tests pass.

- [ ] **Step 4.4 — Commit**

  ```bash
  git add client/src/components/right-panel/ItemsGroupRow.tsx
  git commit -m "feat(items): widen avg margin % group cell to match header"
  ```

---

## Task 5 — Final verification + push

- [ ] **Step 5.1 — Full pre-deploy check**

  ```bash
  cd client && npx tsc -b --noEmit && cd ../server && npx vitest run
  ```
  Expected: TypeScript clean, 107 tests pass.

- [ ] **Step 5.2 — Push to main**

  ```bash
  git push origin main
  ```

- [ ] **Step 5.3 — Manual verification in Airtable (Disney Club 33 → Products tab)**

  1. VALUE and AVG MARGIN % headers have clear whitespace between them — no more collision
  2. LAST ORDER header shows a sort arrow on hover; clicking cycles `desc → asc → desc`
  3. Sorting by LAST ORDER: items with `—` (null dates) sink to the bottom
  4. Color dots: find a high-frequency product (FREQ ≥ 3/mo) — it should go yellow after its interval, red after 2× interval. Find a low-frequency product (FREQ ≤ 0.5/mo) — it stays green much longer.

---

## Quick Reference — Color Logic

```
intervalDays = 30 / purchaseFrequency

days ≤ intervalDays              → green   (on time)
intervalDays < days ≤ 2×interval → yellow  (overdue 1×–2×)
days > 2×interval                → red     (overdue >2×)
freq = 0 or date = null          → muted   (no data)
```
