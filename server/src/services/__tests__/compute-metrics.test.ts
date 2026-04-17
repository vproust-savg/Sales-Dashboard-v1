import { describe, it, expect } from 'vitest';
import { computeMetrics } from '../prev-year-metrics.js';

describe('computeMetrics', () => {
  it('computes all six metrics for a set of order items', () => {
    const items = [
      { orderId: 'O1', amount: 100, cost: 60 },
      { orderId: 'O1', amount: 200, cost: 150 },
      { orderId: 'O2', amount: 300, cost: 200 },
    ];
    const windowMonths = 1;
    const result = computeMetrics(items, windowMonths);
    expect(result.revenue).toBe(600);
    expect(result.orderCount).toBe(2); // distinct orders
    expect(result.avgOrder).toBe(300);
    expect(result.marginAmount).toBe(190); // 600 - 410
    expect(result.marginPercent).toBeCloseTo(31.666, 2);
    expect(result.frequency).toBeCloseTo(2 / 1, 5);
  });

  it('returns null metrics when items empty', () => {
    const result = computeMetrics([], 1);
    expect(result.revenue).toBeNull();
    expect(result.orderCount).toBeNull();
    expect(result.avgOrder).toBeNull();
    expect(result.marginAmount).toBeNull();
    expect(result.marginPercent).toBeNull();
    expect(result.frequency).toBeNull();
  });

  // WHY: This test guards the unit-mismatch bug (Codex post-deploy finding).
  // Current-period frequency = orderCount / periodMonths (e.g. 2 orders / 12 months = 0.167/mo).
  // computeMetrics MUST use the same unit — windowMonths, not windowDays.
  // 12-month window, 2 orders → 2/12 ≈ 0.167 (not 2/30 ≈ 0.067 which the old day-based code produced).
  it('frequency uses months as the unit — matching current-period formula (Codex fix)', () => {
    const items = [
      { orderId: 'O1', amount: 500, cost: 300 },
      { orderId: 'O2', amount: 500, cost: 300 },
    ];
    const windowMonths = 12;
    const result = computeMetrics(items, windowMonths);
    // 2 orders / 12 months = 0.1667 orders/month
    expect(result.frequency).toBeCloseTo(2 / 12, 5);
    // Must NOT be day-based (2/365 ≈ 0.00548 or 2/107 ≈ 0.0187)
    expect(result.frequency!).toBeGreaterThan(0.1);
  });
});
