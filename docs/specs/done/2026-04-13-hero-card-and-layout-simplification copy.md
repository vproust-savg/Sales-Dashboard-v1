

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

