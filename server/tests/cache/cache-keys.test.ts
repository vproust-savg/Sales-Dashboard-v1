// FILE: server/tests/cache/cache-keys.test.ts
// PURPOSE: Tests for cache key construction and filter-aware qualifiers
// USED BY: CI / vitest
// EXPORTS: none (test file)

import { describe, it, expect } from 'vitest';
import { cacheKey, buildFilterQualifier } from '../../src/cache/cache-keys';

describe('buildFilterQualifier', () => {
  it('combines groupBy and filterHash with colon separator', () => {
    const result = buildFilterQualifier('customer', 'agent=Sarah');
    expect(result).toBe('customer:agent=Sarah');
  });

  it('produces the unfiltered qualifier when hash is "all"', () => {
    const result = buildFilterQualifier('customer', 'all');
    expect(result).toBe('customer:all');
  });

  it('works with non-customer dimensions', () => {
    const result = buildFilterQualifier('zone', 'zone=North&type=Retail');
    expect(result).toBe('zone:zone=North&type=Retail');
  });
});

describe('cacheKey with buildFilterQualifier', () => {
  it('builds filter-aware entities_full key', () => {
    const key = cacheKey('entities_full', 'ytd', buildFilterQualifier('customer', 'agent=Sarah'));
    expect(key).toBe('dashboard:entities_full:ytd:customer:agent=Sarah');
  });

  it('builds unfiltered entities_full key', () => {
    const key = cacheKey('entities_full', 'ytd', buildFilterQualifier('customer', 'all'));
    expect(key).toBe('dashboard:entities_full:ytd:customer:all');
  });

  it('filtered and unfiltered keys are different', () => {
    const filtered = cacheKey('entities_full', 'ytd', buildFilterQualifier('customer', 'agent=Sarah'));
    const unfiltered = cacheKey('entities_full', 'ytd', buildFilterQualifier('customer', 'all'));
    expect(filtered).not.toBe(unfiltered);
  });
});
