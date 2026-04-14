# Hero Card + Layout Simplification

**Date:** 2026-04-13
**Status:** Draft
**Scope:** Remove HoverPeek, fix hero chart responsiveness, fix "This Quarter" calculation
**Supersedes:** Tier 3.7 (hover peek) from `2026-04-13-responsive-dashboard-design.md`

---

## Problem

The right panel has several UX issues observed on the live Airtable embed (tested with Disney's Carthay Circle Restaurant, C7686):

1. **HoverPeek tooltips overlap content** — Floating z-50 portals (e.g. "TOP 5 BEST SELLERS" list) cover other cards when hovering. These portals render via `createPortal` to `document.body` and stack on top of the dashboard grid.

2. **Hero card chart is not full-width** — The YoY bar chart SVG uses a hardcoded `viewBox="0 0 400 h"` with `preserveAspectRatio="xMinYMin meet"`. When the hero card container is wider than the 400:height aspect ratio allows, the chart is letterboxed on the right side instead of filling the available width.

3. **"This Quarter" shows near-empty data** — On April 13, the quarter calculation yields Q2 (April 1 start). With only 13 days of data, "This Quarter" shows ~$394 — technically correct but misleading. Users expect a meaningful quarter comparison.

4. **Excessive hover interactions add complexity** — Every card has three hover behaviors: peek tooltip (400ms delay), opacity transitions ("vs same period last year" text), and hover lift (`-translate-y-px`). This adds visual noise without proportional value.

---

## Solution

Five changes, executed in dependency order:

### 1. Remove ALL HoverPeek hover interactions

Remove the floating tooltip system from every card. Keep click-to-expand modals (which provide the same information in a better format).

**Cards affected (7 total):**
- HeroRevenueCard (1)
- KPICard x6 (Orders, Avg Order, Margin %, Margin $, Frequency, Last Order)
- ChartsRow Product Mix (1)
- ChartsRow Best Sellers (1)

**Also remove:**
- "vs same period last year" hover-reveal text on KPICard and HeroRevenueCard
- Hover-reveal on KPICard `periodLabel` (show it always instead)

**Keep:**
- Click-to-expand modal on all cards
- ExpandIcon indicator on all cards
- "Show details" / "Hide details" toggle for sub-items
- Hover lift effect on cards (subtle, not disruptive)

**Files to modify:**

| File | Changes |
|------|---------|
| `client/src/components/right-panel/HeroRevenueCard.tsx` | Remove `useHoverPeek`, `HoverPeek` imports and usage. Remove `peekContent` prop. Simplify ref to `ref={cardRef}`. Remove peek mouse handlers. Remove "vs same period" hover span. Remove `<HoverPeek>` render. Remove outer fragment. |
| `client/src/components/right-panel/KPICard.tsx` | Same pattern. Also remove hover-reveal on `periodLabel` — show it directly. Remove `peekContent` prop and `ReactNode` type import. |
| `client/src/components/right-panel/ChartsRow.tsx` | Remove both `useHoverPeek()` instances. Remove peek refs/handlers from both card wrappers. Remove both `<HoverPeek>` render blocks. Remove peek-only variables (`firstMixType`, `firstMixSegments`, `top5Sellers`). Remove now-unused imports (`formatCurrency`, `PRODUCT_MIX_LABELS`, `PRODUCT_MIX_ORDER`). |
| `client/src/components/right-panel/KPISection.tsx` | Remove `KPIPeekContent`, `HeroPeekContent` import. Remove all `peekContent={...}` props from HeroRevenueCard and 6 KPICard instances. |

---

### 2. Make YoY bar chart full-width and responsive

**Root cause:** `YoYBarChart.tsx` uses `viewBox="0 0 400 ${chartHeight}"` — the 400 is a hardcoded SVG-unit width. The `useContainerSize()` hook in HeroRevenueCard already tracks the container's pixel width via ResizeObserver, but only passes `height` to the chart.

**Fix:**

| File | Changes |
|------|---------|
| `client/src/components/right-panel/YoYBarChart.tsx` | Add `width?: number` prop. Create `const chartWidth = width ?? 400`. Replace all hardcoded `400` references with `chartWidth`: viewBox, grid line x2, groupWidth calculation, tooltip groupWidth. |
| `client/src/components/right-panel/HeroRevenueCard.tsx` | Pass `width={chartSize.width}` to `<YoYBarChart>`. The value is already available from `useContainerSize()` — just not being used. |

**Hardcoded `400` instances to replace (all in YoYBarChart.tsx):**
- Line 62: `viewBox` — `0 0 ${chartWidth} ${chartHeight}`
- Line 75: grid line `x2` — `chartWidth`
- Line 96: groupWidth — `(chartWidth - Y_LABEL_WIDTH) / 12`
- Line 167: tooltip groupWidth — same formula

---

### 3. Fix "This Quarter" calculation

**Root cause:** `kpi-aggregator.ts` lines 41-46:
```
currentQuarter = Math.floor(now.getUTCMonth() / 3)  // April (3) → 1
qStart = Date.UTC(2026, 3, 1)  // April 1
thisQuarterRevenue = orders.filter(o >= qStart).reduce(sum)
```

On April 13, `currentQuarter = 1` → Q2 (Apr-Jun). The filter sums only April orders so far → $394.64.
But Q1 (Jan-Mar) is the most recent meaningful quarter. The user expects to see the sum of January + February + March, not 13 days of April.

**Fix:** When in the first month of a quarter (`month % 3 === 0`), fall back to the previous completed quarter. Add `quarterLabel` to the data contract so the UI shows "Q1" or "Q2" dynamically.

**Edge case — January (Q1 first month):** Falling back from Q1 to Q4 means Oct/Nov/Dec of the previous year. That data lives in `prevOrders`, not `orders`. The implementation must select the correct source array based on whether the effective quarter is in the current or previous year.

```
effectiveYear < currentYear → filter prevOrders
effectiveYear === currentYear → filter orders
```

| File | Changes |
|------|---------|
| `shared/types/dashboard.ts` | Add `quarterLabel: string` to `KPIs` interface. Add `quarterLabel: string` to `KPIMetricBreakdown` interface. |
| `server/src/services/kpi-aggregator.ts` | In `computeKPIs()`: compute `monthInQuarter = now.getUTCMonth() % 3`. If `=== 0`, use previous quarter. Compute `effectiveQuarter` (0-3), `effectiveYear`, bounded `qStart`/`qEnd`, and `quarterLabel`. Select `orders` or `prevOrders` based on `effectiveYear`. Filter with `>= qStart && < qEnd`. Pass `effectiveQuarter` and `quarterLabel` to all `buildBreakdown*` helpers. Update helpers to accept and return `quarterLabel`. |
| `client/src/components/right-panel/HeroRevenueCard.tsx` | Change `<SubItem label="This Quarter"` to `<SubItem label={kpis.quarterLabel}` |
| `client/src/components/right-panel/KPISection.tsx` | Change all `{ label: 'This Quarter', ... }` sub-items to use breakdown's `quarterLabel` (e.g. `ob.quarterLabel`, `ab.quarterLabel`, etc.) |

**Quarter selection logic:**

| Current month | month % 3 | Effective quarter | Source array | Label |
|---|---|---|---|---|
| Jan (0) | 0 | Q4 prev year | `prevOrders` | "Q4" |
| Feb (1) | 1 | Q1 current | `orders` | "Q1" |
| Mar (2) | 2 | Q1 current | `orders` | "Q1" |
| Apr (3) | 0 | Q1 current | `orders` | "Q1" |
| May (4) | 1 | Q2 current | `orders` | "Q2" |
| Jun (5) | 2 | Q2 current | `orders` | "Q2" |
| Jul (6) | 0 | Q2 current | `orders` | "Q2" |
| Oct (9) | 0 | Q3 current | `orders` | "Q3" |
| Nov (10) | 1 | Q4 current | `orders` | "Q4" |

**Expected result for April 13, 2026:**
- `effectiveQuarter = 0` (Q1: Jan-Mar), `effectiveYear = 2026`
- `quarterLabel = "Q1"`
- `thisQuarterRevenue = sum(Jan) + sum(Feb) + sum(Mar)` from `orders`
- Sub-item shows: "Q1  $5,468" (approximate, for Disney's Carthay Circle)

---

### 4. Overflow containment

After removing HoverPeek (the primary overlap source), add defensive overflow containment:

| File | Changes |
|------|---------|
| `client/src/components/right-panel/RightPanel.tsx` | Add `overflow-hidden` to KPI and Charts flex sections (lines 65, 73) |
| `client/src/components/right-panel/KPISection.tsx` | Add `overflow-hidden` to the 2x3 KPI grid container (line 76) |

**No responsive changes needed.** Existing constraints handle 13" and 27":
- `max-lg:` breakpoint (1024px) stacks to single column
- `fr` units in grid expand proportionally
- `overflow-y-auto` on right panel enables scrolling
- `min-h-[200px]` prevents sections from collapsing
- Chart height clamped to [80, 400]px

---

### 5. Dead code cleanup

After Step 1 is complete, delete files with zero remaining consumers:

| File to delete | Previous consumers |
|---|---|
| `client/src/components/right-panel/kpi-peek-content.tsx` | KPISection.tsx (removed in Step 1) |
| `client/src/components/shared/HoverPeek.tsx` | HeroRevenueCard, KPICard, ChartsRow (removed in Step 1) |
| `client/src/hooks/useHoverPeek.ts` | HeroRevenueCard, KPICard, ChartsRow (removed in Step 1) |

**Verify with grep before each deletion** — ensure no imports remain.

---

## TDD Test Specifications

Tests MUST be written before implementation. Follow red-green-refactor: write the failing test, verify it fails, implement minimal code to pass.

### New test file: `server/tests/services/kpi-aggregator.test.ts`

Uses the existing `makeOrder()` / `makeItem()` factory pattern from `data-aggregator.test.ts`. Tests call `computeKPIs()` directly (not through `aggregateOrders()`) to isolate quarter logic.

**Fixture helper needed:** A `withFakeDate(date, fn)` wrapper that mocks `new Date()` to control "now" in tests, since `computeKPIs` uses `const now = new Date()` internally.

#### Test 1: Mid-quarter returns current quarter
```
describe('computeKPIs quarter logic')
  it('returns Q2 with Apr+May data when now is May 15')
    // Fake date: May 15, 2026
    // Orders: Jan $1000, Feb $2000, Mar $3000, Apr $4000, May $5000
    // Expected: quarterLabel = "Q2", thisQuarterRevenue = $9000 (Apr + May)
```

#### Test 2: First month of quarter falls back to previous quarter
```
  it('falls back to Q1 when now is April 13 (first month of Q2)')
    // Fake date: April 13, 2026
    // Orders: Jan $1000, Feb $2000, Mar $3000, Apr $500
    // Expected: quarterLabel = "Q1", thisQuarterRevenue = $6000 (Jan+Feb+Mar)
```

#### Test 3: January falls back to Q4 of previous year
```
  it('falls back to Q4 from prevOrders when now is January 5')
    // Fake date: January 5, 2026
    // orders: [Jan $500]
    // prevOrders: [Oct $1000, Nov $2000, Dec $3000]
    // Expected: quarterLabel = "Q4", thisQuarterRevenue = $6000 (Oct+Nov+Dec from prevOrders)
```

#### Test 4: Quarter boundary is exclusive
```
  it('excludes orders on the first day of next quarter')
    // Fake date: May 15, 2026
    // Orders: Mar 31 $1000 (Q1), Apr 1 $2000 (Q2), Jun 30 $3000 (Q2), Jul 1 $500 (Q3)
    // Expected: thisQuarterRevenue = $5000 (Apr + Jun only, not Mar or Jul)
```

#### Test 5: Second month of Q1 shows Q1
```
  it('returns Q1 when now is February 15 (second month)')
    // Fake date: February 15, 2026
    // Orders: Jan $3000, Feb $2000
    // Expected: quarterLabel = "Q1", thisQuarterRevenue = $5000 (Jan + Feb)
```

#### Test 6: Breakdown helpers carry quarterLabel
```
  it('propagates quarterLabel to all breakdown objects')
    // Fake date: April 13, 2026
    // Expected: kpis.quarterLabel === "Q1"
    //           kpis.ordersBreakdown.quarterLabel === "Q1"
    //           kpis.avgOrderBreakdown.quarterLabel === "Q1"
    //           kpis.marginPercentBreakdown.quarterLabel === "Q1"
    //           kpis.marginAmountBreakdown.quarterLabel === "Q1"
    //           kpis.frequencyBreakdown.quarterLabel === "Q1"
```

#### Test 7: Breakdown thisQuarter uses correct quarter
```
  it('breakdown thisQuarter matches kpis.thisQuarterRevenue')
    // Fake date: April 13, 2026
    // Orders in Jan, Feb, Mar with known revenue
    // Expected: ordersBreakdown.thisQuarter = count of Q1 orders
    //           (buildBreakdown slices monthlyValues with effectiveQuarter, not currentQuarter)
```

#### Test 8: Empty quarter returns zero
```
  it('returns 0 for thisQuarterRevenue when no orders in effective quarter')
    // Fake date: May 15, 2026 → Q2
    // Orders: Jan $1000 only (nothing in Q2)
    // Expected: quarterLabel = "Q2", thisQuarterRevenue = 0
```

### Existing test updates: `server/tests/services/data-aggregator.test.ts`

No changes needed — `aggregateOrders` tests don't directly test quarter values. The new `kpi-aggregator.test.ts` covers this.

### Design alternatives considered (via brainstorming)

Three approaches were evaluated for "This Quarter":

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **A: Fall back to previous completed quarter** | Shows meaningful data, no partial sums | January edge case requires cross-year logic | **Selected** — most useful for business decisions |
| **B: Always show current quarter (label "Q2 so far")** | Simplest implementation | $394.64 for 13 days is not actionable data | Rejected — value too low to be useful |
| **C: Rolling last 90 days** | Always shows recent data | Doesn't align with fiscal quarter thinking | Rejected — users think in quarters, not rolling windows |

---

## Verification

### Build checks (all must pass):
```bash
cd client && npx tsc -b --noEmit        # Client TypeScript
cd ../server && npx tsc --noEmit         # Server TypeScript
cd ../server && npx vitest run           # Server tests
cd ../client && npx vite build           # Bundle (must be <500KB gzip)
```

### TDD checks (must pass before any visual verification):
```bash
cd server && npx vitest run tests/services/kpi-aggregator.test.ts
```
- [ ] All 8 quarter logic tests pass (Tests 1-8 from TDD section)
- [ ] Each test was verified RED (failing) before implementation
- [ ] No mocks of Date — use `vi.useFakeTimers()` / `vi.setSystemTime()`

### Visual checks (on Airtable embed with Disney's Club 33):
- [ ] No hover peek tooltips appear on any card
- [ ] Click-to-expand modals still work on all cards
- [ ] ExpandIcon visible on all cards
- [ ] "Show details" / "Hide details" toggle works
- [ ] Bar chart fills full hero card width
- [ ] Resizing browser window causes chart to reflow
- [ ] Quarter label shows "Q1" with Jan+Feb+Mar totals
- [ ] No container overlap at any viewport size
- [ ] Works on 13" viewport (~1280x800)
- [ ] Works on 27" viewport (~2560x1440)
- [ ] Period label always visible on KPI cards (not hover-gated)

---

## Files Summary

### Created (1):
| File | Step |
|------|------|
| `server/tests/services/kpi-aggregator.test.ts` | 3 (TDD — written first) |

### Modified (8):
| File | Step |
|------|------|
| `shared/types/dashboard.ts` | 3 |
| `server/src/services/kpi-aggregator.ts` | 3 |
| `client/src/components/right-panel/HeroRevenueCard.tsx` | 1, 2, 3 |
| `client/src/components/right-panel/KPICard.tsx` | 1 |
| `client/src/components/right-panel/KPISection.tsx` | 1, 3, 4 |
| `client/src/components/right-panel/ChartsRow.tsx` | 1 |
| `client/src/components/right-panel/YoYBarChart.tsx` | 2 |
| `client/src/components/right-panel/RightPanel.tsx` | 4 |

### Deleted (3):
| File | Step |
|------|------|
| `client/src/components/right-panel/kpi-peek-content.tsx` | 5 |
| `client/src/components/shared/HoverPeek.tsx` | 5 |
| `client/src/hooks/useHoverPeek.ts` | 5 |
