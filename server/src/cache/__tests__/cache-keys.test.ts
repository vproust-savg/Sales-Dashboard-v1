import { describe, it, expect } from 'vitest';
import { cacheKey, buildFilterHash, buildEntitySetHash } from '../cache-keys.js';

describe('cacheKey', () => {
  it('builds dashboard:product_types:all', () => {
    expect(cacheKey('product_types', 'all')).toBe('dashboard:product_types:all');
  });
  it('builds dashboard:products:all', () => {
    expect(cacheKey('products', 'all')).toBe('dashboard:products:all');
  });
});

describe('buildFilterHash extended', () => {
  it('includes item-level filter fields', () => {
    const hash = buildFilterHash({
      agentName: 'Alex',
      brand: 'ACETUM',
      countryOfOrigin: 'Italy',
    });
    expect(hash).toContain('agent=Alex');
    expect(hash).toContain('brand=ACETUM');
    expect(hash).toContain('country=Italy');
  });
  it('returns "all" when no fields set', () => {
    expect(buildFilterHash({})).toBe('all');
  });
  it('produces identical output regardless of object literal key order', () => {
    const a = buildFilterHash({ agentName: 'X', brand: 'Y' });
    const b = buildFilterHash({ brand: 'Y', agentName: 'X' });
    expect(a).toBe(b);
    expect(a).toBe('agent=X&brand=Y');
  });
});

describe('buildEntitySetHash', () => {
  it('is sort-invariant', () => {
    expect(buildEntitySetHash(['C1', 'A2', 'B3'])).toBe(buildEntitySetHash(['A2', 'B3', 'C1']));
  });
  it('returns "empty" for empty input', () => {
    expect(buildEntitySetHash([])).toBe('empty');
  });
});
