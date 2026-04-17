// FILE: server/src/services/__tests__/resolve-customers-for-entity.test.ts
// PURPOSE: Verify the per-item → CUSTNAME resolver. The resolver reads the reverse index
//   and returns a discriminated CustomerResolution the routes can act on without ambiguity.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../reverse-index.js', () => ({
  readReverseIndex: vi.fn(),
}));

import { resolveCustomersForEntity, MAX_CUSTNAMES_PER_NARROW } from '../resolve-customers-for-entity.js';
import { readReverseIndex } from '../reverse-index.js';
import type { ReverseIndex } from '../reverse-index.js';

const emptyIndex: ReverseIndex = { vendor: {}, brand: {}, product_type: {}, product: {} };

describe('resolveCustomersForEntity', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns kind: no-index when reverse index is absent', async () => {
    vi.mocked(readReverseIndex).mockResolvedValueOnce(null);
    const res = await resolveCustomersForEntity('vendor', ['V1'], 'ytd');
    expect(res).toEqual({ kind: 'no-index' });
  });

  it('returns kind: ok with customer list for a known vendor id', async () => {
    const idx: ReverseIndex = { ...emptyIndex, vendor: { V1: ['C1', 'C2'] } };
    vi.mocked(readReverseIndex).mockResolvedValueOnce(idx);

    const res = await resolveCustomersForEntity('vendor', ['V1'], 'ytd');

    expect(res).toEqual({ kind: 'ok', custnames: ['C1', 'C2'] });
  });

  it('returns kind: empty when none of the requested ids are in the index', async () => {
    const idx: ReverseIndex = { ...emptyIndex, vendor: { V1: ['C1'] } };
    vi.mocked(readReverseIndex).mockResolvedValueOnce(idx);

    const res = await resolveCustomersForEntity('vendor', ['V_NOT_REAL'], 'ytd');

    expect(res).toEqual({ kind: 'empty' });
  });

  it('returns kind: empty when requested ids resolve to an empty customer set', async () => {
    // WHY: defensive — a Redis serialization could leave an empty array behind.
    const idx: ReverseIndex = { ...emptyIndex, vendor: { V1: [] } };
    vi.mocked(readReverseIndex).mockResolvedValueOnce(idx);
    const res = await resolveCustomersForEntity('vendor', ['V1'], 'ytd');
    expect(res).toEqual({ kind: 'empty' });
  });

  it('unions customer sets across multiple ids and dedupes', async () => {
    const idx: ReverseIndex = {
      ...emptyIndex,
      brand: { B1: ['C1', 'C2'], B2: ['C2', 'C3'] },
    };
    vi.mocked(readReverseIndex).mockResolvedValueOnce(idx);

    const res = await resolveCustomersForEntity('brand', ['B1', 'B2'], 'ytd');

    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') {
      expect(res.custnames.sort()).toEqual(['C1', 'C2', 'C3']);
    }
  });

  it('returns kind: over-cap when union size exceeds MAX_CUSTNAMES_PER_NARROW', async () => {
    const bigCustomers = Array.from({ length: MAX_CUSTNAMES_PER_NARROW + 1 }, (_, i) => `C${i}`);
    const idx: ReverseIndex = { ...emptyIndex, product: { P1: bigCustomers } };
    vi.mocked(readReverseIndex).mockResolvedValueOnce(idx);

    const res = await resolveCustomersForEntity('product', ['P1'], 'ytd');

    expect(res).toEqual({ kind: 'over-cap', count: MAX_CUSTNAMES_PER_NARROW + 1 });
  });

  it('returns kind: empty for an empty ids input (defensive — upstream should filter)', async () => {
    vi.mocked(readReverseIndex).mockResolvedValueOnce(emptyIndex);
    const res = await resolveCustomersForEntity('vendor', [], 'ytd');
    expect(res).toEqual({ kind: 'empty' });
  });
});
