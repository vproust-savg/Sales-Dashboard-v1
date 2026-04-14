# Hero Card + Layout Simplification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove HoverPeek overlays, make the hero chart full-width, and fix the "This Quarter" calculation to show the last complete quarter.

**Architecture:** Server-side quarter logic selects the most recent meaningful quarter (falling back when in month 1 of a new quarter). Client removes all HoverPeek hover tooltips and passes container width to the SVG chart. Three dead files are deleted.

**Tech Stack:** TypeScript strict, Vitest, React 19, Framer Motion, Tailwind CSS v4, custom SVG charting

**Spec:** `docs/specs/2026-04-13-hero-card-and-layout-simplification.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server/tests/services/kpi-aggregator.test.ts` | Create | TDD tests for quarter logic |
| `shared/types/dashboard.ts` | Modify | Add `quarterLabel` to KPIs + KPIMetricBreakdown |
| `server/src/services/kpi-aggregator.ts` | Modify | Smart quarter selection + label |
| `client/src/components/right-panel/HeroRevenueCard.tsx` | Modify | Remove peek, pass chart width, use quarterLabel |
| `client/src/components/right-panel/KPICard.tsx` | Modify | Remove peek + hover reveals |
| `client/src/components/right-panel/KPISection.tsx` | Modify | Remove peek props, use quarterLabel, overflow |
| `client/src/components/right-panel/ChartsRow.tsx` | Modify | Remove peek from both cards |
| `client/src/components/right-panel/YoYBarChart.tsx` | Modify | Dynamic width prop |
| `client/src/components/right-panel/RightPanel.tsx` | Modify | overflow-hidden on sections |
| `client/src/components/right-panel/kpi-modal-content.tsx` | Modify | Use quarterLabel instead of hardcoded "This Quarter" |
| `client/src/components/right-panel/kpi-peek-content.tsx` | Delete | No consumers after peek removal |
| `client/src/components/shared/HoverPeek.tsx` | Delete | No consumers after peek removal |
| `client/src/hooks/useHoverPeek.ts` | Delete | No consumers after peek removal |

---

## Task 1: TDD — Write failing quarter logic tests

**Files:**
- Create: `server/tests/services/kpi-aggregator.test.ts`

- [ ] **Step 1: Create test file with factory helpers and all 8 tests**

```typescript
// FILE: server/tests/services/kpi-aggregator.test.ts
// PURPOSE: TDD tests for computeKPIs quarter logic — written before implementation
// USED BY: vitest
// EXPORTS: none

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeKPIs } from '../../src/services/kpi-aggregator';
import type { RawOrder, RawOrderItem } from '../../src/services/priority-queries';

function makeItem(overrides: Partial<RawOrderItem> = {}): RawOrderItem {
  return {
    PDES: 'Widget A', PARTNAME: 'WGT-A', TQUANT: 10, TUNITNAME: 'ea',
    QPRICE: 1000, PRICE: 100, PURCHASEPRICE: 60, QPROFIT: 400, PERCENT: 40,
    Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One', Y_9952_5_ESH: 'BrandX',
    Y_3020_5_ESH: 'FAM1', Y_3021_5_ESH: 'Packaging', Y_17936_5_ESH: 'VP-001',
    Y_2075_5_ESH: 'Family A', Y_5380_5_ESH: 'USA', Y_9967_5_ESH: 'N',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    ORDNAME: 'ORD-001', CURDATE: '2026-02-15T00:00:00Z', ORDSTATUSDES: 'Closed',
    TOTPRICE: 1000, CUSTNAME: 'C001', AGENTCODE: 'A01', AGENTNAME: 'Agent',
    ORDERITEMS_SUBFORM: [makeItem()],
    ...overrides,
  };
}

describe('computeKPIs quarter logic', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns Q2 with Apr+May data when now is May 15', () => {
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    const orders = [
      makeOrder({ ORDNAME: 'O1', CURDATE: '2026-01-10T00:00:00Z', TOTPRICE: 1000 }),
      makeOrder({ ORDNAME: 'O2', CURDATE: '2026-02-10T00:00:00Z', TOTPRICE: 2000 }),
      makeOrder({ ORDNAME: 'O3', CURDATE: '2026-03-10T00:00:00Z', TOTPRICE: 3000 }),
      makeOrder({ ORDNAME: 'O4', CURDATE: '2026-04-10T00:00:00Z', TOTPRICE: 4000 }),
      makeOrder({ ORDNAME: 'O5', CURDATE: '2026-05-10T00:00:00Z', TOTPRICE: 5000 }),
    ];
    const items = orders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
    const kpis = computeKPIs(orders, [], items, [], 'ytd');
    expect(kpis.quarterLabel).toBe('Q2');
    expect(kpis.thisQuarterRevenue).toBe(9000);
  });

  it('falls back to Q1 when now is April 13 (first month of Q2)', () => {
    vi.setSystemTime(new Date('2026-04-13T12:00:00Z'));
    const orders = [
      makeOrder({ ORDNAME: 'O1', CURDATE: '2026-01-10T00:00:00Z', TOTPRICE: 1000 }),
      makeOrder({ ORDNAME: 'O2', CURDATE: '2026-02-10T00:00:00Z', TOTPRICE: 2000 }),
      makeOrder({ ORDNAME: 'O3', CURDATE: '2026-03-10T00:00:00Z', TOTPRICE: 3000 }),
      makeOrder({ ORDNAME: 'O4', CURDATE: '2026-04-10T00:00:00Z', TOTPRICE: 500 }),
    ];
    const items = orders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
    const kpis = computeKPIs(orders, [], items, [], 'ytd');
    expect(kpis.quarterLabel).toBe('Q1');
    expect(kpis.thisQuarterRevenue).toBe(6000);
  });

  it('falls back to Q4 from prevOrders when now is January 5', () => {
    vi.setSystemTime(new Date('2026-01-05T12:00:00Z'));
    const orders = [
      makeOrder({ ORDNAME: 'O1', CURDATE: '2026-01-03T00:00:00Z', TOTPRICE: 500 }),
    ];
    const prevOrders = [
      makeOrder({ ORDNAME: 'P1', CURDATE: '2025-10-15T00:00:00Z', TOTPRICE: 1000 }),
      makeOrder({ ORDNAME: 'P2', CURDATE: '2025-11-15T00:00:00Z', TOTPRICE: 2000 }),
      makeOrder({ ORDNAME: 'P3', CURDATE: '2025-12-15T00:00:00Z', TOTPRICE: 3000 }),
    ];
    const items = orders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
    const prevItems = prevOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
    const kpis = computeKPIs(orders, prevOrders, items, prevItems, 'ytd');
    expect(kpis.quarterLabel).toBe('Q4');
    expect(kpis.thisQuarterRevenue).toBe(6000);
  });

  it('excludes orders on the first day of next quarter', () => {
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    const orders = [
      makeOrder({ ORDNAME: 'O1', CURDATE: '2026-03-31T00:00:00Z', TOTPRICE: 1000 }),
      makeOrder({ ORDNAME: 'O2', CURDATE: '2026-04-01T00:00:00Z', TOTPRICE: 2000 }),
      makeOrder({ ORDNAME: 'O3', CURDATE: '2026-06-30T00:00:00Z', TOTPRICE: 3000 }),
      makeOrder({ ORDNAME: 'O4', CURDATE: '2026-07-01T00:00:00Z', TOTPRICE: 500 }),
    ];
    const items = orders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
    const kpis = computeKPIs(orders, [], items, [], 'ytd');
    expect(kpis.thisQuarterRevenue).toBe(5000);
  });

  it('returns Q1 when now is February 15 (second month of Q1)', () => {
    vi.setSystemTime(new Date('2026-02-15T12:00:00Z'));
    const orders = [
      makeOrder({ ORDNAME: 'O1', CURDATE: '2026-01-10T00:00:00Z', TOTPRICE: 3000 }),
      makeOrder({ ORDNAME: 'O2', CURDATE: '2026-02-10T00:00:00Z', TOTPRICE: 2000 }),
    ];
    const items = orders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
    const kpis = computeKPIs(orders, [], items, [], 'ytd');
    expect(kpis.quarterLabel).toBe('Q1');
    expect(kpis.thisQuarterRevenue).toBe(5000);
  });

  it('propagates quarterLabel to all breakdown objects', () => {
    vi.setSystemTime(new Date('2026-04-13T12:00:00Z'));
    const orders = [
      makeOrder({ ORDNAME: 'O1', CURDATE: '2026-01-10T00:00:00Z', TOTPRICE: 1000 }),
    ];
    const items = orders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
    const kpis = computeKPIs(orders, [], items, [], 'ytd');
    expect(kpis.quarterLabel).toBe('Q1');
    expect(kpis.ordersBreakdown.quarterLabel).toBe('Q1');
    expect(kpis.avgOrderBreakdown.quarterLabel).toBe('Q1');
    expect(kpis.marginPercentBreakdown.quarterLabel).toBe('Q1');
    expect(kpis.marginAmountBreakdown.quarterLabel).toBe('Q1');
    expect(kpis.frequencyBreakdown.quarterLabel).toBe('Q1');
  });

  it('breakdown thisQuarter matches kpis.thisQuarterRevenue for order count', () => {
    vi.setSystemTime(new Date('2026-04-13T12:00:00Z'));
    const orders = [
      makeOrder({ ORDNAME: 'O1', CURDATE: '2026-01-10T00:00:00Z', TOTPRICE: 1000 }),
      makeOrder({ ORDNAME: 'O2', CURDATE: '2026-02-10T00:00:00Z', TOTPRICE: 2000 }),
      makeOrder({ ORDNAME: 'O3', CURDATE: '2026-03-10T00:00:00Z', TOTPRICE: 3000 }),
      makeOrder({ ORDNAME: 'O4', CURDATE: '2026-04-10T00:00:00Z', TOTPRICE: 500 }),
    ];
    const items = orders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
    const kpis = computeKPIs(orders, [], items, [], 'ytd');
    // Q1 has 3 orders (Jan, Feb, Mar) — Apr order is Q2
    expect(kpis.ordersBreakdown.thisQuarter).toBe(3);
  });

  it('returns 0 for thisQuarterRevenue when no orders in effective quarter', () => {
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    const orders = [
      makeOrder({ ORDNAME: 'O1', CURDATE: '2026-01-10T00:00:00Z', TOTPRICE: 1000 }),
    ];
    const items = orders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
    const kpis = computeKPIs(orders, [], items, [], 'ytd');
    expect(kpis.quarterLabel).toBe('Q2');
    expect(kpis.thisQuarterRevenue).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/services/kpi-aggregator.test.ts
```

Expected: FAIL — `quarterLabel` property does not exist on KPIs type. Multiple test failures.

- [ ] **Step 3: Commit failing tests**

```bash
git add server/tests/services/kpi-aggregator.test.ts
git commit -m "test: add failing TDD tests for quarter logic (red phase)"
```

---

## Task 2: Add `quarterLabel` to shared types

**Files:**
- Modify: `shared/types/dashboard.ts:27-34` (KPIMetricBreakdown)
- Modify: `shared/types/dashboard.ts:37-65` (KPIs)

- [ ] **Step 1: Add `quarterLabel` to `KPIMetricBreakdown`**

In `shared/types/dashboard.ts`, after `thisQuarter: number;` (line 30), add:

```typescript
  quarterLabel: string;  // e.g. "Q1", "Q2" — dynamic based on effective quarter
```

- [ ] **Step 2: Add `quarterLabel` to `KPIs`**

In `shared/types/dashboard.ts`, after `thisQuarterRevenue: number;` (line 43), add:

```typescript
  quarterLabel: string;  // e.g. "Q1" — which quarter thisQuarterRevenue refers to
```

- [ ] **Step 3: Run `tsc` to see what breaks**

```bash
cd server && npx tsc --noEmit 2>&1 | head -30
```

Expected: Errors in `kpi-aggregator.ts` where return objects are missing `quarterLabel`.

- [ ] **Step 4: Commit**

```bash
git add shared/types/dashboard.ts
git commit -m "feat: add quarterLabel to KPIs and KPIMetricBreakdown types"
```

---

## Task 3: Implement smart quarter selection in kpi-aggregator

**Files:**
- Modify: `server/src/services/kpi-aggregator.ts:40-49` (quarter calculation)
- Modify: `server/src/services/kpi-aggregator.ts:126-131` (breakdown calls)
- Modify: `server/src/services/kpi-aggregator.ts:132-161` (return object)
- Modify: `server/src/services/kpi-aggregator.ts:206-224` (buildBreakdown)
- Modify: `server/src/services/kpi-aggregator.ts:227-250` (buildAvgOrderBreakdown)
- Modify: `server/src/services/kpi-aggregator.ts:253-276` (buildMarginPctBreakdown)
- Modify: `server/src/services/kpi-aggregator.ts:279-298` (buildFrequencyBreakdown)

- [ ] **Step 1: Replace quarter calculation block (lines 40-49)**

Replace:
```typescript
  // Quarter calculations — WHY: UTC consistency with monthly revenue (lines 93-94)
  const currentQuarter = Math.floor(now.getUTCMonth() / 3);
  const qStart = new Date(Date.UTC(now.getUTCFullYear(), currentQuarter * 3, 1));
  const prevQStart = new Date(Date.UTC(now.getUTCFullYear(), (currentQuarter - 1) * 3, 1));
  const thisQuarterRevenue = orders
    .filter(o => new Date(o.CURDATE) >= qStart)
    .reduce((sum, o) => sum + o.TOTPRICE, 0);
  const lastQuarterRevenue = orders
    .filter(o => { const d = new Date(o.CURDATE); return d >= prevQStart && d < qStart; })
    .reduce((sum, o) => sum + o.TOTPRICE, 0);
```

With:
```typescript
  // Quarter calculations — WHY: When in the first month of a quarter (month%3===0),
  // fall back to the previous completed quarter for meaningful data.
  // January falls back to Q4 of previous year (uses prevOrders).
  const calendarQuarter = Math.floor(now.getUTCMonth() / 3); // 0=Q1..3=Q4
  const monthInQuarter = now.getUTCMonth() % 3; // 0=first, 1=second, 2=third
  const effectiveQuarter = monthInQuarter === 0
    ? (calendarQuarter - 1 + 4) % 4  // wrap Q1-1 → Q4
    : calendarQuarter;
  const effectiveYear = (monthInQuarter === 0 && calendarQuarter === 0)
    ? now.getUTCFullYear() - 1  // January → Q4 of previous year
    : now.getUTCFullYear();
  const quarterLabel = `Q${effectiveQuarter + 1}`;
  const qStart = new Date(Date.UTC(effectiveYear, effectiveQuarter * 3, 1));
  const qEnd = new Date(Date.UTC(effectiveYear, effectiveQuarter * 3 + 3, 1));
  // WHY: January Q4 fallback requires filtering prevOrders, not orders
  const quarterSource = effectiveYear < now.getUTCFullYear() ? prevOrders : orders;
  const thisQuarterRevenue = quarterSource
    .filter(o => { const d = new Date(o.CURDATE); return d >= qStart && d < qEnd; })
    .reduce((sum, o) => sum + o.TOTPRICE, 0);
  // Last quarter = one before the effective quarter
  const prevEffQ = (effectiveQuarter - 1 + 4) % 4;
  const prevEffYear = effectiveQuarter === 0 ? effectiveYear - 1 : effectiveYear;
  const prevQStart = new Date(Date.UTC(prevEffYear, prevEffQ * 3, 1));
  const prevQEnd = new Date(Date.UTC(prevEffYear, prevEffQ * 3 + 3, 1));
  const lastQSource = prevEffYear < now.getUTCFullYear() ? prevOrders : orders;
  const lastQuarterRevenue = lastQSource
    .filter(o => { const d = new Date(o.CURDATE); return d >= prevQStart && d < prevQEnd; })
    .reduce((sum, o) => sum + o.TOTPRICE, 0);
```

- [ ] **Step 2: Update breakdown calls to pass `effectiveQuarter` and `quarterLabel`**

Replace each `buildBreakdown` call (lines 126-130) — change `currentQuarter` arg to `effectiveQuarter` and add `quarterLabel` arg. Each helper needs the same two new args.

Replace line 126:
```typescript
  const ordersBreakdown = buildBreakdown(monthOrderCounts, prevOrderCount, prevFullOrderCount, effectiveQuarter, prevMonthIdx, quarterLabel);
```

Replace line 127:
```typescript
  const avgOrderBreakdown = buildAvgOrderBreakdown(monthRevenues, monthOrderCounts, prevSamePeriodRevenue, prevOrderCount, prevFullRevenue, prevFullOrderCount, effectiveQuarter, prevMonthIdx, quarterLabel);
```

Replace line 128:
```typescript
  const marginPercentBreakdown = buildMarginPctBreakdown(monthProfit, monthItemRevenue, prevSamePeriodProfit, prevSamePeriodItemRev, prevFullProfit, prevFullItemRev, effectiveQuarter, prevMonthIdx, quarterLabel);
```

Replace line 129:
```typescript
  const marginAmountBreakdown = buildBreakdown(monthProfit, prevSamePeriodProfit, prevFullProfit, effectiveQuarter, prevMonthIdx, quarterLabel);
```

Replace line 130:
```typescript
  const frequencyBreakdown = buildFrequencyBreakdown(monthOrderCounts, prevOrderCount, prevFullOrderCount, monthsInPeriod, effectiveQuarter, prevMonthIdx, quarterLabel);
```

- [ ] **Step 3: Add `quarterLabel` to the return object (line ~138)**

After `thisQuarterRevenue,` add:
```typescript
    quarterLabel,
```

- [ ] **Step 4: Update `buildBreakdown` helper to accept and return `quarterLabel`**

Change the signature (line 206):
```typescript
function buildBreakdown(
  monthlyValues: number[], prevYearTotal: number, prevYearFullTotal: number,
  effectiveQuarter: number, prevMonthIdx: number, quarterLabel: string,
): KPIMetricBreakdown {
```

Change the `qStartMonth` line (line 210):
```typescript
  const qStartMonth = effectiveQuarter * 3;
```

Add `quarterLabel` to the return object (after `thisQuarter,` line 219):
```typescript
    quarterLabel,
```

- [ ] **Step 5: Update `buildAvgOrderBreakdown` similarly**

Change signature (line 227) — add `quarterLabel: string` as last param.
Change `qStart` (line 232) to `effectiveQuarter * 3`.
Add `quarterLabel,` to return object (after `thisQuarter:` line 245).

- [ ] **Step 6: Update `buildMarginPctBreakdown` similarly**

Change signature (line 253) — add `quarterLabel: string` as last param.
Change `qStart` (line 258) to `effectiveQuarter * 3`.
Add `quarterLabel,` to return object (after `thisQuarter:` line 271).

- [ ] **Step 7: Update `buildFrequencyBreakdown` similarly**

Change signature (line 279) — add `quarterLabel: string` as last param.
Change `qStart` (line 283) to `effectiveQuarter * 3`.
Add `quarterLabel,` to return object (after `thisQuarter:` line 293).

- [ ] **Step 8: Run tests — verify GREEN**

```bash
cd server && npx vitest run tests/services/kpi-aggregator.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 9: Run full server test suite**

```bash
cd server && npx vitest run
```

Expected: All existing tests still pass + 8 new tests pass.

- [ ] **Step 10: Commit**

```bash
git add shared/types/dashboard.ts server/src/services/kpi-aggregator.ts server/tests/services/kpi-aggregator.test.ts
git commit -m "feat: smart quarter selection — falls back to previous complete quarter

When in the first month of a quarter (e.g., April for Q2), shows the
previous complete quarter (Q1) instead of 13 days of partial data.
January falls back to Q4 of the previous year using prevOrders."
```

---

## Task 4: Remove HoverPeek from HeroRevenueCard

**Files:**
- Modify: `client/src/components/right-panel/HeroRevenueCard.tsx`

- [ ] **Step 1: Remove peek imports and prop**

Remove these lines entirely:
```typescript
import { type ReactNode } from 'react';
```
```typescript
import { useHoverPeek } from '../../hooks/useHoverPeek';
import { HoverPeek } from '../shared/HoverPeek';
```

Remove from interface:
```typescript
  peekContent?: ReactNode;
```

- [ ] **Step 2: Remove peek hook and simplify handlers**

Remove:
```typescript
  const peek = useHoverPeek();
```

Change the opening `<div` attributes. Replace:
```typescript
      ref={(el) => { peek.triggerRef.current = el; cardRef?.(el); }}
      onMouseEnter={peek.onMouseEnter}
      onMouseLeave={peek.onMouseLeave}
```
With:
```typescript
      ref={cardRef}
```

Change onClick. Replace:
```typescript
      onClick={() => { peek.onMouseLeave(); onExpand?.(); }}
```
With:
```typescript
      onClick={onExpand}
```

- [ ] **Step 3: Remove "vs same period" hover-reveal text**

Remove lines 76-78 (the span that reveals on hover). Replace the entire `{changePercent !== null && (` block:
```typescript
          {changePercent !== null && (
              <span className="text-[12px] font-medium" style={{ color: trendColor }}>
                {formatPercent(changePercent, { showSign: true })}
                <span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  {' '}vs same period last year
                </span>
              </span>
            )}
```
With:
```typescript
          {changePercent !== null && (
              <span className="text-[12px] font-medium" style={{ color: trendColor }}>
                {formatPercent(changePercent, { showSign: true })} vs last year
              </span>
            )}
```

- [ ] **Step 4: Remove HoverPeek render and outer fragment**

Remove the entire block after `</div>`:
```typescript
    {peekContent && (
      <HoverPeek isVisible={peek.isVisible} position={peek.position} onMouseEnter={peek.onPeekMouseEnter} onMouseLeave={peek.onPeekMouseLeave}>
        {peekContent}
      </HoverPeek>
    )}
```

Remove the outer fragment wrapper — change `<>` (line 40) to nothing and `</>` (line 152) to nothing. The component now returns a single `<div>`.

- [ ] **Step 5: Use dynamic quarterLabel**

Replace line 128:
```typescript
              <SubItem label="This Quarter" value={kpis.thisQuarterRevenue} />
```
With:
```typescript
              <SubItem label={kpis.quarterLabel} value={kpis.thisQuarterRevenue} />
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd client && npx tsc -b --noEmit 2>&1 | head -20
```

Expected: Errors about `peekContent` prop being passed from KPISection (will fix in Task 7).

- [ ] **Step 7: Commit**

```bash
git add client/src/components/right-panel/HeroRevenueCard.tsx
git commit -m "refactor: remove HoverPeek from HeroRevenueCard, use dynamic quarterLabel"
```

---

## Task 5: Remove HoverPeek from KPICard

**Files:**
- Modify: `client/src/components/right-panel/KPICard.tsx`

- [ ] **Step 1: Remove peek imports, prop, and hook**

Remove:
```typescript
import { type ReactNode } from 'react';
```
```typescript
import { useHoverPeek } from '../../hooks/useHoverPeek';
import { HoverPeek } from '../shared/HoverPeek';
```

Remove from interface:
```typescript
  peekContent?: ReactNode;
```

Remove from destructured props:
```typescript
  peekContent,
```
(just delete that word from the destructuring on line 47)

Remove:
```typescript
  const peek = useHoverPeek();
```

- [ ] **Step 2: Simplify ref and handlers**

Replace:
```typescript
      ref={(el) => { peek.triggerRef.current = el; cardRef?.(el); }}
      onMouseEnter={peek.onMouseEnter}
      onMouseLeave={peek.onMouseLeave}
```
With:
```typescript
      ref={cardRef}
```

Replace:
```typescript
      onClick={() => { peek.onMouseLeave(); onExpand?.(); }}
```
With:
```typescript
      onClick={onExpand}
```

- [ ] **Step 3: Show periodLabel always (remove hover-reveal)**

Replace line 72:
```typescript
            {label}{periodLabel && <span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"> {periodLabel}</span>}
```
With:
```typescript
            {label} {periodLabel}
```

- [ ] **Step 4: Remove "vs same period" hover-reveal**

Replace lines 82-85:
```typescript
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
              <span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {' '}vs same period last year
              </span>
```
With:
```typescript
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}% vs last year
```

- [ ] **Step 5: Remove HoverPeek render and fragment**

Remove:
```typescript
    {peekContent && (
      <HoverPeek isVisible={peek.isVisible} position={peek.position} onMouseEnter={peek.onPeekMouseEnter} onMouseLeave={peek.onPeekMouseLeave}>
        {peekContent}
      </HoverPeek>
    )}
```

Remove outer `<>` and `</>` fragment wrapper. Component returns a single `<div>`.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/right-panel/KPICard.tsx
git commit -m "refactor: remove HoverPeek from KPICard, show periodLabel always"
```

---

## Task 6: Remove HoverPeek from ChartsRow

**Files:**
- Modify: `client/src/components/right-panel/ChartsRow.tsx`

- [ ] **Step 1: Remove peek imports and unused data imports**

Remove:
```typescript
import { formatCurrency } from '@shared/utils/formatting';
import { PRODUCT_MIX_LABELS, PRODUCT_MIX_ORDER } from '@shared/types/dashboard';
```
```typescript
import { useHoverPeek } from '../../hooks/useHoverPeek';
import { HoverPeek } from '../shared/HoverPeek';
```

- [ ] **Step 2: Remove peek hooks and peek-only variables**

Remove:
```typescript
  const mixPeek = useHoverPeek();
  const sellersPeek = useHoverPeek();

  /** WHY: Show first mix type in peek — simple summary without carousel */
  const firstMixType = PRODUCT_MIX_ORDER[0];
  const firstMixSegments = productMixes[firstMixType] ?? [];
  const top5Sellers = topSellers.filter(s => s.revenue > 0).slice(0, 5);
```

- [ ] **Step 3: Simplify Product Mix card wrapper**

Replace lines 34-46:
```typescript
      <div
        ref={mixPeek.triggerRef}
        onMouseEnter={mixPeek.onMouseEnter}
        onMouseLeave={mixPeek.onMouseLeave}
        className="group relative flex cursor-pointer flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        onClick={() => { mixPeek.onMouseLeave(); openModal('Product Mix', <ProductMixExpanded mixes={productMixes} />); }}
```
With:
```typescript
      <div
        className="group relative flex cursor-pointer flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        onClick={() => openModal('Product Mix', <ProductMixExpanded mixes={productMixes} />)}
```

Remove the entire Product Mix `<HoverPeek>` block (lines 47-57).

- [ ] **Step 4: Simplify Best Sellers card wrapper**

Same pattern — remove `ref`, `onMouseEnter`, `onMouseLeave` from the div. Simplify `onClick`. Remove the Best Sellers `<HoverPeek>` block (lines 73-83).

Replace:
```typescript
        onClick={() => { sellersPeek.onMouseLeave(); openModal('Best Sellers', <BestSellersExpanded data={topSellers} />); }}
```
With:
```typescript
        onClick={() => openModal('Best Sellers', <BestSellersExpanded data={topSellers} />)}
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/right-panel/ChartsRow.tsx
git commit -m "refactor: remove HoverPeek from ChartsRow cards"
```

---

## Task 7: Remove peek props from KPISection + use quarterLabel

**Files:**
- Modify: `client/src/components/right-panel/KPISection.tsx`

- [ ] **Step 1: Remove peek content import**

Remove:
```typescript
import { KPIPeekContent, HeroPeekContent } from './kpi-peek-content';
```

- [ ] **Step 2: Remove `peekContent` prop from HeroRevenueCard (line 74)**

The long `peekContent={<HeroPeekContent ...>}` prop — delete it entirely from the HeroRevenueCard JSX.

- [ ] **Step 3: Remove all `peekContent` props from 6 KPICard instances**

Delete every `peekContent={<KPIPeekContent ...>}` prop from each KPICard: Orders (line 91), Avg. Order (line 109), Margin % (line 127), Margin $ (line 145), Frequency (line 163), Last Order (line 173).

- [ ] **Step 4: Replace "This Quarter" labels with dynamic quarterLabel**

In every `subItems` array and every modal's `subItems`, replace `{ label: 'This Quarter', ...}` with the breakdown's `quarterLabel`:

- Orders sub-items (line 86): `{ label: ob.quarterLabel, value: ... }`
- Orders modal sub-items (line 90): `{ label: ob.quarterLabel, value: ... }`
- Avg. Order sub-items (line 104): `{ label: ab.quarterLabel, value: ... }`
- Avg. Order modal (line 108): `{ label: ab.quarterLabel, value: ... }`
- Margin % sub-items (line 122): `{ label: mpb.quarterLabel, value: ... }`
- Margin % modal (line 126): `{ label: mpb.quarterLabel, value: ... }`
- Margin $ sub-items (line 140): `{ label: mab.quarterLabel, value: ... }`
- Margin $ modal (line 144): `{ label: mab.quarterLabel, value: ... }`
- Frequency sub-items (line 158): `{ label: fb.quarterLabel, value: ... }`
- Frequency modal (line 162): `{ label: fb.quarterLabel, value: ... }`

- [ ] **Step 5: Add `overflow-hidden` to KPI grid**

On line 76, change:
```typescript
        <div className="grid grid-cols-2 grid-rows-3 gap-[var(--spacing-sm)]">
```
To:
```typescript
        <div className="grid grid-cols-2 grid-rows-3 gap-[var(--spacing-sm)] overflow-hidden">
```

- [ ] **Step 6: Commit**

```bash
git add client/src/components/right-panel/KPISection.tsx
git commit -m "refactor: remove peek props from KPISection, use dynamic quarterLabel"
```

---

## Task 8: Update kpi-modal-content to use quarterLabel

**Files:**
- Modify: `client/src/components/right-panel/kpi-modal-content.tsx:86`

- [ ] **Step 1: Change hardcoded "This Quarter" in HeroRevenueModalContent**

The `HeroRevenueModalContent` component receives `kpis` as a prop. Replace line 86:
```typescript
          <span className="text-[11px] text-[var(--color-text-muted)]">This Quarter</span>
```
With:
```typescript
          <span className="text-[11px] text-[var(--color-text-muted)]">{kpis.quarterLabel}</span>
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/right-panel/kpi-modal-content.tsx
git commit -m "refactor: use dynamic quarterLabel in hero revenue modal"
```

---

## Task 9: Make YoY bar chart full-width

**Files:**
- Modify: `client/src/components/right-panel/YoYBarChart.tsx`
- Modify: `client/src/components/right-panel/HeroRevenueCard.tsx`

- [ ] **Step 1: Add `width` prop to YoYBarChart**

In the interface (line 11-14), add `width`:
```typescript
interface YoYBarChartProps {
  data: MonthlyRevenue[];
  height?: number;
  width?: number;
}
```

In the function (line 26), destructure it:
```typescript
export function YoYBarChart({ data, height: rawHeight, width }: YoYBarChartProps) {
```

Add after `chartHeight` (line 27):
```typescript
  const chartWidth = width && width > 0 ? width : 400;
```

- [ ] **Step 2: Replace all hardcoded `400` with `chartWidth`**

Line 62 — viewBox:
```typescript
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
```

Line 74-75 — grid line x2:
```typescript
                x2={chartWidth}
```

Line 96 — groupWidth:
```typescript
          const groupWidth = (chartWidth - Y_LABEL_WIDTH) / 12;
```

Line 167 — tooltip groupWidth:
```typescript
          const groupWidth = (chartWidth - Y_LABEL_WIDTH) / 12;
```

- [ ] **Step 3: Pass width from HeroRevenueCard**

In `HeroRevenueCard.tsx`, change line 112:
```typescript
          {chartSize.height > 0 && <YoYBarChart data={monthlyRevenue} height={chartHeight} />}
```
To:
```typescript
          {chartSize.height > 0 && <YoYBarChart data={monthlyRevenue} height={chartHeight} width={chartSize.width} />}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd client && npx tsc -b --noEmit
```

Expected: Clean.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/right-panel/YoYBarChart.tsx client/src/components/right-panel/HeroRevenueCard.tsx
git commit -m "feat: make YoY bar chart responsive to container width"
```

---

## Task 10: Add overflow containment to RightPanel

**Files:**
- Modify: `client/src/components/right-panel/RightPanel.tsx:65,73`

- [ ] **Step 1: Add `overflow-hidden` to KPI section div**

Line 65, change:
```typescript
        <div style={{ flex: `${kpiChartsRatio[0]} 1 0%` }} className="min-h-[200px]">
```
To:
```typescript
        <div style={{ flex: `${kpiChartsRatio[0]} 1 0%` }} className="min-h-[200px] overflow-hidden">
```

- [ ] **Step 2: Add `overflow-hidden` to Charts section div**

Line 73, change:
```typescript
        <div style={{ flex: `${kpiChartsRatio[1]} 1 0%` }} className="min-h-[200px]">
```
To:
```typescript
        <div style={{ flex: `${kpiChartsRatio[1]} 1 0%` }} className="min-h-[200px] overflow-hidden">
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/right-panel/RightPanel.tsx
git commit -m "fix: add overflow containment to KPI and Charts sections"
```

---

## Task 11: Delete dead code

**Files:**
- Delete: `client/src/components/right-panel/kpi-peek-content.tsx`
- Delete: `client/src/components/shared/HoverPeek.tsx`
- Delete: `client/src/hooks/useHoverPeek.ts`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -rn "kpi-peek-content\|HoverPeek\|useHoverPeek" client/src/ --include="*.tsx" --include="*.ts"
```

Expected: Zero results (all consumers removed in Tasks 4-7).

- [ ] **Step 2: Delete the three files**

```bash
rm client/src/components/right-panel/kpi-peek-content.tsx
rm client/src/components/shared/HoverPeek.tsx
rm client/src/hooks/useHoverPeek.ts
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete dead HoverPeek files (3 files removed)"
```

---

## Task 12: Full verification

- [ ] **Step 1: TypeScript compilation**

```bash
cd client && npx tsc -b --noEmit && echo "Client TS OK"
cd ../server && npx tsc --noEmit && echo "Server TS OK"
```

- [ ] **Step 2: Server tests**

```bash
cd server && npx vitest run
```

Expected: All tests pass (existing + 8 new quarter tests).

- [ ] **Step 3: Client build**

```bash
cd client && npx vite build
```

Expected: Clean build, bundle < 500KB gzip.

- [ ] **Step 4: Visual verification on Airtable embed**

Start both dev servers:
```bash
cd server && npm run dev &
cd client && npm run dev &
```

Open https://airtable.com/appjwOgR4HsXeGIda/pagLryv6BSV06bBdy and select Disney's Club 33.

Verify:
- No hover peek tooltips on any card
- Click-to-expand modals work on all cards
- Bar chart fills full hero card width
- Quarter label shows "Q1" with Jan+Feb+Mar totals
- Period label visible on all KPI cards
- No container overlap
- "Show details" toggle works

- [ ] **Step 5: Final commit if any fixes needed**
