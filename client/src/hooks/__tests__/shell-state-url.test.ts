// FILE: client/src/hooks/__tests__/shell-state-url.test.ts
// PURPOSE: Tests for URL parsing/building pure functions
// USED BY: test runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { parseSearchParams, buildSearch, DEFAULT_STATE } from '../shell-state-url';

describe('parseSearchParams', () => {
  it('returns DEFAULT_STATE for empty params', () => {
    expect(parseSearchParams(new URLSearchParams(''))).toEqual(DEFAULT_STATE);
  });
  it('parses valid dimension', () => {
    expect(parseSearchParams(new URLSearchParams('dim=vendor')).activeDimension).toBe('vendor');
  });
  it('falls back to default for invalid dimension', () => {
    expect(parseSearchParams(new URLSearchParams('dim=invalid')).activeDimension).toBe('customer');
  });
  it('parses valid period', () => {
    expect(parseSearchParams(new URLSearchParams('period=2024')).activePeriod).toBe('2024');
  });
  it('falls back to default for empty period', () => {
    expect(parseSearchParams(new URLSearchParams('period=')).activePeriod).toBe('ytd');
  });
  it('parses entity ID', () => {
    expect(parseSearchParams(new URLSearchParams('entity=C7826')).activeEntityId).toBe('C7826');
  });
  it('returns null entity for missing param', () => {
    expect(parseSearchParams(new URLSearchParams('')).activeEntityId).toBeNull();
  });
  it('parses valid tab', () => {
    expect(parseSearchParams(new URLSearchParams('tab=items')).activeTab).toBe('items');
  });
  it('falls back to default for invalid tab', () => {
    expect(parseSearchParams(new URLSearchParams('tab=bogus')).activeTab).toBe('orders');
  });
  it('parses search term', () => {
    expect(parseSearchParams(new URLSearchParams('q=acme')).searchTerm).toBe('acme');
  });
  it('parses valid sort field and direction', () => {
    const state = parseSearchParams(new URLSearchParams('sort=revenue&dir=desc'));
    expect(state.sortField).toBe('revenue');
    expect(state.sortDirection).toBe('desc');
  });
  it('falls back to defaults for invalid sort', () => {
    const state = parseSearchParams(new URLSearchParams('sort=nonexistent&dir=sideways'));
    expect(state.sortField).toBe('id');
    expect(state.sortDirection).toBe('asc');
  });
  it('parses full valid URL', () => {
    const state = parseSearchParams(new URLSearchParams('dim=zone&period=2023&entity=Z100&tab=contacts&q=west&sort=orders&dir=desc'));
    expect(state).toEqual({
      activeDimension: 'zone', activePeriod: '2023', activeEntityId: 'Z100',
      activeTab: 'contacts', searchTerm: 'west', sortField: 'orders', sortDirection: 'desc',
    });
  });
});

describe('buildSearch', () => {
  it('returns empty string for DEFAULT_STATE', () => {
    expect(buildSearch(DEFAULT_STATE)).toBe('');
  });
  it('includes only non-default values', () => {
    expect(buildSearch({ ...DEFAULT_STATE, activeDimension: 'vendor' as const })).toBe('dim=vendor');
  });
  it('pairs sort field and direction together', () => {
    const result = buildSearch({ ...DEFAULT_STATE, sortField: 'revenue' as const, sortDirection: 'desc' as const });
    expect(result).toContain('sort=revenue');
    expect(result).toContain('dir=desc');
  });
  it('includes direction when only direction differs from default', () => {
    const result = buildSearch({ ...DEFAULT_STATE, sortDirection: 'desc' as const });
    expect(result).toContain('sort=id');
    expect(result).toContain('dir=desc');
  });
  it('builds full query string', () => {
    const result = buildSearch({
      activeDimension: 'brand' as const, activePeriod: '2025', activeEntityId: 'B42',
      activeTab: 'items' as const, searchTerm: 'cheese',
      sortField: 'marginPercent' as const, sortDirection: 'desc' as const,
    });
    expect(result).toContain('dim=brand');
    expect(result).toContain('period=2025');
    expect(result).toContain('entity=B42');
    expect(result).toContain('tab=items');
    expect(result).toContain('q=cheese');
    expect(result).toContain('sort=marginPercent');
    expect(result).toContain('dir=desc');
  });
});

describe('round-trip', () => {
  it('preserves valid URLs', () => {
    const original = 'dim=vendor&period=2024&entity=C7826&tab=items&q=acme&sort=revenue&dir=desc';
    const state = parseSearchParams(new URLSearchParams(original));
    const rebuilt = buildSearch(state);
    expect(parseSearchParams(new URLSearchParams(rebuilt))).toEqual(state);
  });
  it('round-trips DEFAULT_STATE through empty string', () => {
    const built = buildSearch(DEFAULT_STATE);
    expect(built).toBe('');
    expect(parseSearchParams(new URLSearchParams(built))).toEqual(DEFAULT_STATE);
  });
});
