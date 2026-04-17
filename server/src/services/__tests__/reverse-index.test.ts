// FILE: server/src/services/__tests__/reverse-index.test.ts
// PURPOSE: Unit tests for the per-item dimension reverse-index service.
//   buildReverseIndex is a pure function; writeReverseIndex/readReverseIndex exercise Redis I/O.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../cache/redis-client.js', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

import { buildReverseIndex, writeReverseIndex, readReverseIndex } from '../reverse-index.js';
import { redis } from '../../cache/redis-client.js';
import type { RawOrder } from '../priority-queries.js';

const baseItem = {
  PDES: '', PARTNAME: '', TQUANT: 0, TUNITNAME: '', QPRICE: 0, PRICE: 0,
  PURCHASEPRICE: 0, QPROFIT: 0, PERCENT: 0,
  Y_1159_5_ESH: '', Y_1530_5_ESH: '', Y_9952_5_ESH: '',
  Y_3020_5_ESH: '', Y_3021_5_ESH: '', Y_17936_5_ESH: '',
  Y_2075_5_ESH: '', Y_5380_5_ESH: '', Y_9967_5_ESH: '',
};

type ItemOverrides = Partial<typeof baseItem>;

const makeOrder = (ordname: string, custname: string, items: ItemOverrides[]): RawOrder => ({
  ORDNAME: ordname,
  CURDATE: '2026-01-01T00:00:00Z',
  ORDSTATUSDES: 'Open',
  TOTPRICE: 0,
  CUSTNAME: custname,
  AGENTCODE: 'A',
  AGENTNAME: 'Alice',
  ORDERITEMS_SUBFORM: items.map(i => ({ ...baseItem, ...i })),
});

describe('buildReverseIndex', () => {
  it('returns four empty maps for zero orders', () => {
    const idx = buildReverseIndex([]);
    expect(idx).toEqual({ vendor: {}, brand: {}, product_type: {}, product: {} });
  });

  it('maps each dim field to the set of CUSTNAMEs that ordered it', () => {
    const orders = [
      makeOrder('O1', 'C1', [
        { Y_1159_5_ESH: 'V1', Y_9952_5_ESH: 'B1', Y_3020_5_ESH: '01', PARTNAME: 'P1' },
      ]),
      makeOrder('O2', 'C2', [
        { Y_1159_5_ESH: 'V1', Y_9952_5_ESH: 'B2', Y_3020_5_ESH: '02', PARTNAME: 'P1' },
      ]),
      makeOrder('O3', 'C1', [
        // Same customer orders V1 twice — should appear only once in the set
        { Y_1159_5_ESH: 'V1', Y_9952_5_ESH: 'B1', Y_3020_5_ESH: '01', PARTNAME: 'P2' },
      ]),
    ];

    const idx = buildReverseIndex(orders);

    expect(idx.vendor['V1']?.sort()).toEqual(['C1', 'C2']);
    expect(idx.brand['B1']?.sort()).toEqual(['C1']);
    expect(idx.brand['B2']?.sort()).toEqual(['C2']);
    expect(idx.product_type['01']?.sort()).toEqual(['C1']);
    expect(idx.product_type['02']?.sort()).toEqual(['C2']);
    expect(idx.product['P1']?.sort()).toEqual(['C1', 'C2']);
    expect(idx.product['P2']?.sort()).toEqual(['C1']);
  });

  it('skips items where the per-dim field is empty or missing', () => {
    const orders = [
      makeOrder('O1', 'C1', [
        // Only brand is set; vendor/product_type are empty strings
        { Y_9952_5_ESH: 'B1', PARTNAME: 'P1' },
      ]),
    ];
    const idx = buildReverseIndex(orders);
    expect(Object.keys(idx.vendor)).toEqual([]);
    expect(idx.brand['B1']).toEqual(['C1']);
    expect(Object.keys(idx.product_type)).toEqual([]);
    expect(idx.product['P1']).toEqual(['C1']);
  });

  it('skips orders with no CUSTNAME (defensive)', () => {
    const orders = [
      makeOrder('O1', '', [{ Y_1159_5_ESH: 'V1' }]),
    ];
    const idx = buildReverseIndex(orders);
    expect(Object.keys(idx.vendor)).toEqual([]);
  });
});

describe('writeReverseIndex / readReverseIndex', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('writes a single JSON blob under cacheKey("revidx", period) with the given TTL', async () => {
    const idx = buildReverseIndex([
      makeOrder('O1', 'C1', [{ Y_1159_5_ESH: 'V1' }]),
    ]);

    await writeReverseIndex('ytd', idx, 3600);

    expect(redis.set).toHaveBeenCalledTimes(1);
    const [key, value, opts] = vi.mocked(redis.set).mock.calls[0]!;
    expect(key).toBe('dashboard:revidx:ytd');
    expect(JSON.parse(value as string)).toEqual(idx);
    expect(opts).toEqual({ ex: 3600 });
  });

  it('reads the JSON blob back and returns the structured index', async () => {
    const idx = { vendor: { V1: ['C1'] }, brand: {}, product_type: {}, product: {} };
    vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(idx));

    const out = await readReverseIndex('ytd');

    expect(redis.get).toHaveBeenCalledWith('dashboard:revidx:ytd');
    expect(out).toEqual(idx);
  });

  it('returns null when the key is missing', async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    const out = await readReverseIndex('ytd');
    expect(out).toBeNull();
  });

  it('accepts already-deserialized object from Upstash client (not just JSON string)', async () => {
    // WHY: Upstash's @upstash/redis sometimes returns pre-parsed objects depending on SDK version.
    const idx = { vendor: { V1: ['C1'] }, brand: {}, product_type: {}, product: {} };
    vi.mocked(redis.get).mockResolvedValueOnce(idx as unknown as string);
    const out = await readReverseIndex('ytd');
    expect(out).toEqual(idx);
  });
});
