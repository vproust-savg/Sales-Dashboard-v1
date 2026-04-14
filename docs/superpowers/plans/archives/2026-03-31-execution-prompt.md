# Execution Prompt — Dashboard Fine-Tuning

Paste everything below the line into a new Claude Code session.

---

## Task

Implement the dashboard fine-tuning spec. Two features:
1. **Best Sellers enhancements** — rename to "Best Sellers", expand to 25 items with pagination (shift by 5), custom hover tooltip, filter zero-value items, show actual unit of measure (cs, ea, lb)
2. **Product Mix carousel** — 5 donut chart types with left/right arrow navigation

## Files to Read First

Read these two files before doing anything:
- **Spec:** `docs/superpowers/specs/2026-03-31-dashboard-fine-tuning.md`
- **Plan:** `docs/superpowers/plans/2026-03-31-dashboard-fine-tuning.md`

The plan has 9 tasks with exact code for every step. Follow it task-by-task.

## Execution

Use `/executing-plans` to work through the plan. The plan file is at `docs/superpowers/plans/2026-03-31-dashboard-fine-tuning.md`.

After each frontend component is created or modified (Tasks 5, 6, 7, 8), use `/frontend-design` to visually verify the result matches the spec styling (warm gold palette, dark tooltip, carousel arrows/dots).

## Key Context

- **Priority ERP is READ-ONLY.** Never write to it.
- `TUNITNAME` is the Priority field for unit of measure (MaxLength 3, e.g., "cs", "ea", "lb"). It's on ORDERITEMS but wasn't fetched until now.
- `Y_2075_5_ESH` = Product Family, `Y_5380_5_ESH` = Country of Origin, `Y_9967_5_ESH` = Food Service vs Retail (`'Y'` = Retail, anything else = Food Service). `Y_9952_5_ESH` (Brand) is already fetched.
- The `productMix` field in `DashboardPayload` is being renamed to `productMixes` (plural, `Record<ProductMixType, ProductMixSegment[]>`). This rename propagates through: `data-aggregator.ts` → `dashboard.ts` route (via spread) → `DashboardLayout.tsx` → `RightPanel.tsx` → `ChartsRow.tsx`.
- `ProductMixDonut.tsx` stays UNCHANGED — the new `ProductMixCarousel.tsx` wraps it.
- Test customer: `C7826`

## Verification Gates

After Task 4: `cd server && npx vitest run` — all tests pass
After Task 8: `cd client && npx tsc -b --noEmit` — no type errors
After Task 9: full pre-deploy checklist:
```bash
cd server && npx tsc --noEmit
cd ../client && npx tsc -b --noEmit
cd ../server && npx vitest run
cd ../client && npx vite build
```

## Do NOT

- Modify `ProductMixDonut.tsx` — the carousel wraps it, doesn't replace it
- Add fields to `ORDERITEM_SELECT_PREV` — the new fields are only needed for current-period queries
- Create a separate API endpoint for product mixes — all 5 are computed in a single pass in `data-aggregator.ts`
- Use an icon library for chevron arrows — use inline SVG as shown in the plan
- Show zero-value segments in donut charts — `computeProductMix` filters out segments where `value <= 0` before sorting
- Keep the old name "Top 10 Best Sellers" or old file name `TopTenBestSellers.tsx` — it's renamed to `BestSellers.tsx` / "Best Sellers"
- Slice top sellers to 10 — it's now 25 with pagination (shift by 5, showing 10 at a time)
