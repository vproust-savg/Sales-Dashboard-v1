import { describe, it, expect } from 'vitest';
import { searchEntities } from '../search';
import type { EntityListItem } from '../../../../shared/types/dashboard';

const make = (id: string, name: string): EntityListItem => ({
  id, name, revenue: null, orderCount: null, avgOrder: null,
  marginPercent: null, marginAmount: null, frequency: null,
  lastOrderDate: null, prevYearRevenue: null, prevYearRevenueFull: null,
  prevYearOrderCount: null, prevYearOrderCountFull: null,
  prevYearAvgOrder: null, prevYearAvgOrderFull: null,
  prevYearMarginPercent: null, prevYearMarginPercentFull: null,
  prevYearMarginAmount: null, prevYearMarginAmountFull: null,
  prevYearFrequency: null, prevYearFrequencyFull: null,
} as EntityListItem);

describe('searchEntities', () => {
  const rows = [
    make('C7826', 'Altamira Foods'),
    make('C1234', 'Ami Group'),
    make('V0099', 'Acme Ingredients'),
  ];

  it('matches on name substring', () => {
    expect(searchEntities(rows, 'altamira').map(r => r.id)).toEqual(['C7826']);
  });

  it('matches on id substring', () => {
    expect(searchEntities(rows, 'C78').map(r => r.id)).toEqual(['C7826']);
  });

  it('is case-insensitive', () => {
    expect(searchEntities(rows, 'C78').length).toBe(1);
    expect(searchEntities(rows, 'c78').length).toBe(1);
  });

  it('returns all rows when query empty', () => {
    expect(searchEntities(rows, '').length).toBe(3);
    expect(searchEntities(rows, '   ').length).toBe(3);
  });

  it('matches both name and id when query appears in both', () => {
    const ambiguous = [make('acme1', 'Other Name'), make('id1', 'Acme Foods')];
    expect(searchEntities(ambiguous, 'acme').length).toBe(2);
  });
});
