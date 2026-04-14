# Collapsed Panel Vertical Label — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Bugs:** If you encounter a bug, use superpowers:systematic-debugging — do not guess at fixes.

**Goal:** Replace the single-letter dimension badge (C/Z/V/B/T/P) in the collapsed left-panel rail with the full dimension name rendered as vertical text.

**Architecture:** One file changes — `CollapsedPanel.tsx`. The `DIMENSION_ICONS` letter map is deleted and replaced with a `flex-1` container holding a `<span>` using `writing-mode: vertical-rl` + `rotate(180deg)` to render the label top-to-bottom. The label text comes from `DIMENSION_CONFIG[activeDimension].label.toUpperCase()`, which is already imported inside the file.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, inline React style for `writing-mode` (no Tailwind utility for this property).

**Spec:** `docs/specs/2026-04-14-collapsed-panel-vertical-label-design.md`

---

## File Map

| File | What Changes |
|------|-------------|
| `client/src/components/left-panel/CollapsedPanel.tsx` | Delete `DIMENSION_ICONS`; add `DIMENSION_CONFIG` import; replace letter badge with vertical text label |

---

## Task 1 — Rewrite `CollapsedPanel.tsx`

**File:**
- Modify: `client/src/components/left-panel/CollapsedPanel.tsx`

- [ ] **Step 1.1 — Replace the file contents**

  Open `client/src/components/left-panel/CollapsedPanel.tsx` and replace the entire file with:

  ```tsx
  // FILE: client/src/components/left-panel/CollapsedPanel.tsx
  // PURPOSE: Narrow 48px rail shown when left panel is collapsed — expand button + vertical dimension label
  // USED BY: DashboardLayout.tsx
  // EXPORTS: CollapsedPanel

  import type { Dimension } from '@shared/types/dashboard';
  import { DIMENSION_CONFIG } from '../../utils/dimension-config';

  interface CollapsedPanelProps {
    activeDimension: Dimension;
    onExpand: () => void;
  }

  export function CollapsedPanel({ activeDimension, onExpand }: CollapsedPanelProps) {
    return (
      <div className="flex h-full w-[48px] shrink-0 flex-col items-center gap-[var(--spacing-lg)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
        {/* Expand button */}
        <button
          type="button"
          onClick={onExpand}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-base)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-gold-subtle)] hover:text-[var(--color-text-secondary)]"
          aria-label="Expand panel"
          title="Expand panel (or press [)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* WHY: writing-mode + rotate(180deg) renders the label top-to-bottom so it reads
         *  naturally along the left edge without overlapping the expand button */}
        <div className="flex flex-1 items-center justify-center">
          <span
            className="text-[11px] font-semibold tracking-[0.15em] text-[var(--color-text-muted)]"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {DIMENSION_CONFIG[activeDimension].label.toUpperCase()}
          </span>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 1.2 — Type-check**

  ```bash
  cd client && npx tsc -b --noEmit
  ```

  Expected: no errors. `activeDimension` is `Dimension`, which is the key type of `DIMENSION_CONFIG` — no new type exposure.

  If you see `Property 'writingMode' does not exist on type 'CSSProperties'` — this should not happen, `writingMode` is a valid React `CSSProperties` key. If it does appear, check that `@types/react` is installed (`cat client/package.json | grep @types/react`).

- [ ] **Step 1.3 — Commit**

  ```bash
  git add client/src/components/left-panel/CollapsedPanel.tsx
  git commit -m "feat(panel): replace letter badge with vertical dimension label"
  ```

---

## Task 2 — Final verification

- [ ] **Step 2.1 — Full pre-deploy check**

  ```bash
  cd client && npx tsc -b --noEmit && cd ../server && npx vitest run
  ```

  Expected: TypeScript clean, all server tests pass (no client-side test harness exists for UI components).

- [ ] **Step 2.2 — Push to main**

  ```bash
  git push origin main
  ```

- [ ] **Step 2.3 — Manual verification**

  1. Collapse the left panel — dimension name appears vertically below the `>` button, reads top-to-bottom
  2. Switch through all 6 dimensions — label updates: CUSTOMERS, ZONE, VENDORS, BRANDS, PROD. TYPE, PRODUCTS
  3. "PROD. TYPE" renders without overlap
  4. `>` expand button still works on click
  5. `[` keyboard shortcut still collapses/expands
  6. No visual overlap between expand button and label text
