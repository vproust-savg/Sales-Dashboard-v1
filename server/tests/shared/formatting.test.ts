// FILE: server/tests/shared/formatting.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatPercentPoints,
  formatFrequency,
  formatDays,
  formatDate,
  formatDateShort,
} from '@shared/utils/formatting';

describe('formatCurrency', () => {
  it('formats >= $1K with no decimals', () => {
    expect(formatCurrency(240200)).toBe('$240,200');
    expect(formatCurrency(7506)).toBe('$7,506');
  });
  it('formats < $1K with 2 decimals', () => {
    expect(formatCurrency(0.85)).toBe('$0.85');
    expect(formatCurrency(999.99)).toBe('$999.99');
  });
  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });
  it('formats negative values', () => {
    expect(formatCurrency(-8100)).toBe('-$8,100');
  });
  it('formats with explicit + sign when showSign is true', () => {
    expect(formatCurrency(26400, { showSign: true })).toBe('+$26,400');
    expect(formatCurrency(-8100, { showSign: true })).toBe('-$8,100');
  });
});

describe('formatCurrencyCompact', () => {
  it('formats thousands as K', () => {
    expect(formatCurrencyCompact(30000)).toBe('$30K');
    expect(formatCurrencyCompact(15500)).toBe('$15.5K');
  });
  it('formats millions as M', () => {
    expect(formatCurrencyCompact(1200000)).toBe('$1.2M');
  });
  it('formats billions as B', () => {
    expect(formatCurrencyCompact(1234567890)).toBe('$1.2B');
  });
  it('formats small values normally', () => {
    expect(formatCurrencyCompact(500)).toBe('$500');
  });
});

describe('formatPercent', () => {
  it('formats with one decimal', () => {
    expect(formatPercent(18.4)).toBe('18.4%');
    expect(formatPercent(0)).toBe('0.0%');
  });
  it('formats with sign when requested', () => {
    expect(formatPercent(12.4, { showSign: true })).toBe('+12.4%');
    expect(formatPercent(-5.2, { showSign: true })).toBe('-5.2%');
  });
});

describe('formatPercentPoints', () => {
  it('formats with pp suffix', () => {
    expect(formatPercentPoints(1.8)).toBe('+1.8pp');
    expect(formatPercentPoints(-1.2)).toBe('-1.2pp');
  });
});

describe('formatFrequency', () => {
  it('formats with /mo suffix', () => {
    expect(formatFrequency(2.7)).toBe('2.7/mo');
  });
  it('handles null', () => {
    expect(formatFrequency(null)).toBe('\u2014'); // em dash
  });
});

describe('formatDays', () => {
  it('formats 0 as Today', () => {
    expect(formatDays(0)).toBe('Today');
  });
  it('formats 1 as singular', () => {
    expect(formatDays(1)).toBe('1 day ago');
  });
  it('formats plural', () => {
    expect(formatDays(4)).toBe('4 days ago');
  });
  it('handles null', () => {
    expect(formatDays(null)).toBe('No orders');
  });
});

describe('formatDate', () => {
  it('formats as MMM DD, YYYY', () => {
    expect(formatDate('2026-03-28T00:00:00Z')).toBe('Mar 28, 2026');
  });
});

describe('formatDateShort', () => {
  it('formats as MMM YYYY', () => {
    expect(formatDateShort('2021-01-15T00:00:00Z')).toBe('Jan 2021');
  });
});
