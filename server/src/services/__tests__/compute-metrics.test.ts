import { describe, it, expect } from 'vitest';
import { computeMetrics } from '../prev-year-metrics.js';

describe('computeMetrics', () => {
  it('computes all six metrics for a set of order items', () => {
    const items = [
      { orderId: 'O1', amount: 100, cost: 60 },
      { orderId: 'O1', amount: 200, cost: 150 },
      { orderId: 'O2', amount: 300, cost: 200 },
    ];
    const windowDays = 30;
    const result = computeMetrics(items, windowDays);
    expect(result.revenue).toBe(600);
    expect(result.orderCount).toBe(2); // distinct orders
    expect(result.avgOrder).toBe(300);
    expect(result.marginAmount).toBe(190); // 600 - 410
    expect(result.marginPercent).toBeCloseTo(31.666, 2);
    expect(result.frequency).toBeCloseTo(2 / 30, 5);
  });

  it('returns null metrics when items empty', () => {
    const result = computeMetrics([], 30);
    expect(result.revenue).toBeNull();
    expect(result.orderCount).toBeNull();
    expect(result.avgOrder).toBeNull();
    expect(result.marginAmount).toBeNull();
    expect(result.marginPercent).toBeNull();
    expect(result.frequency).toBeNull();
  });
});
