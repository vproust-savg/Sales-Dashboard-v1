# Collapsed Panel Vertical Label — Design Spec

**Date:** 2026-04-14
**Status:** Approved
**Scope:** `client/src/components/left-panel/CollapsedPanel.tsx` only

---

## Problem

The collapsed 48px rail currently shows a single letter (C, Z, V, B, T, P) in a dark rounded badge to indicate the active dimension. This is ambiguous — "B" could be Brands or Brand, "P" could be Products or Product Type — and visually heavy for a dormant panel.

---

## Solution

Replace the letter badge with the full dimension name rendered as vertical text (top-to-bottom), in a muted typographic style that signals "this panel is dormant."

---

## Visual Behaviour

**Collapsed rail (48px wide, full height):**

```
┌──────────┐
│    >     │  ← expand button (unchanged)
│          │
│    C     │  ← REMOVE this dark badge
│          │
│  C       │
│  U       │
│  S       │  ← ADD vertical text label
│  T       │
│  O       │
│  M       │
│  E       │
│  R       │
│  S       │
└──────────┘
```

**Expanded state:** unchanged — no modification to `LeftPanel.tsx`, `DashboardLayout.tsx`, or the collapse trigger button.

---

## Implementation

### File

**Modify only:** `client/src/components/left-panel/CollapsedPanel.tsx`

### Changes

1. **Remove** the `DIMENSION_ICONS` constant (the `Record<Dimension, string>` letter map).

2. **Add** an import of `DIMENSION_CONFIG` from `../../utils/dimension-config`.

3. **Replace** the dark badge `<div>` with a vertical text container:

```tsx
<div className="flex flex-1 items-center justify-center">
  <span
    className="text-[11px] font-semibold tracking-[0.15em] text-[var(--color-text-muted)]"
    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
  >
    {DIMENSION_CONFIG[activeDimension].label.toUpperCase()}
  </span>
</div>
```

### Label values (from `DIMENSION_CONFIG`)

| Dimension key  | `.label`     | Displayed as  |
|----------------|--------------|---------------|
| `customer`     | Customers    | CUSTOMERS     |
| `zone`         | Zone         | ZONE          |
| `vendor`       | Vendors      | VENDORS       |
| `brand`        | Brands       | BRANDS        |
| `product_type` | Prod. Type   | PROD. TYPE    |
| `product`      | Products     | PRODUCTS      |

The period in "PROD. TYPE" is retained — it is readable at 11px vertical and adding a dedicated `collapsedLabel` field would be over-engineering.

### Styling rationale

| Property | Value | Why |
|----------|-------|-----|
| `writing-mode` | `vertical-rl` | Flows text top-to-bottom in a vertical column |
| `transform` | `rotate(180deg)` | Corrects direction so text reads top-to-bottom (without it, reads bottom-to-top) |
| `text-[11px]` | 11px | Slightly larger than the previous 10px badge — more legible at full word length |
| `font-semibold` | 600 | Consistent with the dimension toggle pill labels |
| `tracking-[0.15em]` | 0.15em | Generous tracking improves readability of spaced vertical uppercase letters |
| `text-[var(--color-text-muted)]` | muted | Signals "dormant" — no dark background, no visual weight |

### No prop changes

`activeDimension: Dimension` is already passed to `CollapsedPanel`. `DIMENSION_CONFIG` is imported directly inside the file — no prop drilling, no changes to `DashboardLayout.tsx`.

---

## What Does NOT Change

- Expand button (`>` chevron, 32×32px) — position, style, behaviour unchanged
- Collapse button (hover `<` in expanded state) — unchanged
- `DashboardLayout.tsx` — no changes
- `LeftPanel.tsx` and all child components — no changes
- Keyboard shortcut `[` — unchanged

---

## Verification

```bash
cd client && npx tsc -b --noEmit
```

Expected: no TypeScript errors (type of `activeDimension` is already `Dimension`, which is the key type for `DIMENSION_CONFIG`).

**Manual check:**
1. Collapse the panel — dimension name appears vertically, reads top-to-bottom
2. Switch dimensions — label updates correctly for all 6 values
3. "PROD. TYPE" renders legibly
4. Expand button still works (click + `[` keyboard shortcut)
5. No text overlap with expand button or panel edges
