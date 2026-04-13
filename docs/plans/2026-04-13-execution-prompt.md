# Execution Prompt — Responsive Dashboard

> Copy everything below this line into a new Claude Code conversation.

---

Use `/executing-plans` to implement the plan at `docs/plans/2026-04-13-responsive-dashboard.md` (13 tasks).

## Context

This adds responsive layout features to the Sales Dashboard: collapsible left panel, section-boundary resize handles, layout presets (Compact/Balanced/Spacious), hover peek on cards, click-to-expand modals, responsive chart sizing, keyboard card navigation, and localStorage persistence with reset.

**Spec:** `docs/specs/2026-04-13-responsive-dashboard-design.md`
**Plan:** `docs/plans/2026-04-13-responsive-dashboard.md`
**Design system:** Use `/design-sg-interface` for all styling decisions. Never hardcode hex colors — use `var(--color-*)` tokens.

## Execution rules

- Follow the plan task-by-task, step-by-step. Do NOT skip steps or batch multiple tasks.
- Run `cd client && npx tsc -b --noEmit` after EVERY task before committing. TypeScript errors kill the Railway Docker build.
- Every new file MUST have the intent block: `// FILE:`, `// PURPOSE:`, `// USED BY:`, `// EXPORTS:`.
- Every file MUST stay under 200 lines. If a file approaches 200 lines during implementation, split immediately — do not defer.
- Use `/simplify` after completing Tasks 9, 11, and 13 (the largest integration tasks) to check for reuse and quality issues.
- Use `/verification-before-completion` after Task 13 before claiming done.
- Match existing patterns EXACTLY. Before creating any new component, read a similar existing component first (e.g., read `PeriodSelector.tsx` before building `LayoutPresetToggle.tsx`).
- Commit after every task with a descriptive message. One concern per commit.

## Key gotchas from CLAUDE.md

- Tailwind v4 uses `@theme` in CSS, NOT `tailwind.config.js`
- Dynamic Tailwind classes like `` `col-span-${n}` `` don't work — use mapping objects or `style` prop
- CSS Grid equal-height: Don't use `items-start` (prevents stretch). Don't use ResizeObserver + `flex-1` inside grid cells (infinite expansion)
- Framer Motion: CSS `prefers-reduced-motion` does NOT suppress Framer animations — `<MotionConfig reducedMotion="user">` is already at app root
- Never wrap ARIA child roles in plain `div`/`motion.div` — apply motion props directly on semantic elements
- Express 5 catch-all: `/{*path}` (not `path="*"` which is React Router)
- `$expand` URL encoding: Do NOT use `searchParams.set()` — build URL with raw concatenation
- Docker `__dirname`: compiled output is at `server/dist/server/src/index.js`

## Pre-deploy verification (run after Task 13)

```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
cd ../server && npx vitest run
cd ../client && npx vite build
grep -rn ": any\|as any" client/src/
```

All must pass. Bundle must stay under 500KB gzip. Zero `any` types.

## Task overview (13 tasks)

1. `useDashboardLayout` hook — central state + localStorage
2. Revert text sizes (undo commit 94e4028 enlargements)
3. Responsive chart — `useContainerSize` + dynamic `YoYBarChart` height
4. Collapsible left panel — `CollapsedPanel` + `DashboardLayout` changes
5. Resize dividers — `useResizablePanel` + `ResizeDivider`
6. Integrate resize into KPISection + RightPanel
7. Layout presets + reset button in DetailHeader
8. Modal system — `ModalProvider` + `CardModal` + `ExpandIcon` + App.tsx
9. KPI + Hero card modal content
10. Charts row modal content (ProductMix + BestSellers expanded views)
11. Hover peek system — `useHoverPeek` + `HoverPeek` + card integration
12. Responsive defaults + final wiring + CSS responsive overrides
13. Keyboard card navigation — `useCardNavigation` + KPISection integration

Start with Task 1. Read the full plan first, then execute.
