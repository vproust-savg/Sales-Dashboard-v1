// FILE: server/src/services/__tests__/entity-list-builder.test.ts
// PURPOSE: Tests for buildEntityList — cold/warm cache paths for customer and item-based dims.
// USED BY: vitest test suite
// EXPORTS: (test file)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EntityListItem } from '@shared/types/dashboard';

// Mock the cache and priority layer before importing the module under test
vi.mock('../../cache/order-cache.js', () => ({
  readOrders: vi.fn(),
}));
vi.mock('../../cache/cache-layer.js', () => ({
  cachedFetch: vi.fn(),
}));
vi.mock('../priority-instance.js', () => ({
  priorityClient: {} as unknown,
}));
vi.mock('../priority-queries.js', () => ({
  fetchCustomers: vi.fn(),
  fetchZones: vi.fn(),
  fetchVendors: vi.fn(),
  fetchProductTypes: vi.fn(),
  fetchProducts: vi.fn(),
}));

import { buildEntityList } from '../entity-list-builder.js';
import { readOrders } from '../../cache/order-cache.js';
import { cachedFetch } from '../../cache/cache-layer.js';

const mkCustomer = (code: string, name: string) => ({
  CUSTNAME: code, CUSTDES: name, ZONECODE: 'Z1', ZONEDES: 'Zone 1',
  AGENTCODE: 'A1', AGENTNAME: 'Agent 1', CREATEDDATE: '', CTYPECODE: 'T', CTYPENAME: 'Retail',
});

const mkOrder = (custname: string) => ({
  ORDNAME: `O-${custname}`,
  CURDATE: '2026-01-15T00:00:00Z',
  ORDSTATUSDES: 'Open',
  TOTPRICE: 100,
  CUSTNAME: custname,
  AGENTCODE: 'A1',
  AGENTNAME: 'Agent 1',
  ORDERITEMS_SUBFORM: [],
});

const mkVendor = (code: string, name: string, country = '') => ({
  SUPNAME: code,
  SUPDES: name,
  COUNTRYNAME: country,
});

const mkProductType = (code: string, name: string) => ({
  FTCODE: code,
  FTNAME: name,
});

const mkProduct = (sku: string, name: string, brand: string | null = null) => ({
  PARTNAME: sku,
  PARTDES: name,
  FAMILYNAME: 'Family',
  SPEC4: brand,
  Y_5380_5_ESH: 'France',
  STATDES: 'In Use',
});

const mkOrderItem = (overrides: Partial<{
  PDES: string;
  PARTNAME: string;
  TQUANT: number;
  TUNITNAME: string;
  QPRICE: number;
  PRICE: number;
  PURCHASEPRICE: number;
  QPROFIT: number;
  PERCENT: number;
  Y_1159_5_ESH: string;
  Y_1530_5_ESH: string;
  Y_9952_5_ESH: string;
  Y_3020_5_ESH: string;
  Y_3021_5_ESH: string;
  Y_17936_5_ESH: string;
  Y_2075_5_ESH: string;
  Y_5380_5_ESH: string;
  Y_9967_5_ESH: string;
}> = {}) => ({
  PDES: 'Product One',
  PARTNAME: 'P1',
  TQUANT: 1,
  TUNITNAME: 'ea',
  QPRICE: 100,
  PRICE: 100,
  PURCHASEPRICE: 60,
  QPROFIT: 40,
  PERCENT: 40,
  Y_1159_5_ESH: 'V1',
  Y_1530_5_ESH: 'Vendor One',
  Y_9952_5_ESH: 'Brand One',
  Y_3020_5_ESH: 'FT1',
  Y_3021_5_ESH: 'Frozen',
  Y_17936_5_ESH: 'VP-1',
  Y_2075_5_ESH: 'Family',
  Y_5380_5_ESH: 'France',
  Y_9967_5_ESH: 'N',
  ...overrides,
});

const mkOrderWithItems = (custname: string, items: ReturnType<typeof mkOrderItem>[]) => ({
  ...mkOrder(custname),
  ORDNAME: `O-${custname}-${items.length}`,
  ORDERITEMS_SUBFORM: items,
});

function expectStubMetrics(entity: EntityListItem): void {
  expect(entity.revenue).toBeNull();
  expect(entity.orderCount).toBeNull();
  expect(entity.avgOrder).toBeNull();
  expect(entity.marginPercent).toBeNull();
  expect(entity.marginAmount).toBeNull();
  expect(entity.frequency).toBeNull();
  expect(entity.lastOrderDate).toBeNull();
  expect(entity.rep).toBeNull();
  expect(entity.zone).toBeNull();
  expect(entity.customerType).toBeNull();
  expect(entity.prevYearRevenue).toBeNull();
  expect(entity.prevYearRevenueFull).toBeNull();
  expect(entity.prevYearOrderCount).toBeNull();
  expect(entity.prevYearOrderCountFull).toBeNull();
  expect(entity.prevYearAvgOrder).toBeNull();
  expect(entity.prevYearAvgOrderFull).toBeNull();
  expect(entity.prevYearMarginPercent).toBeNull();
  expect(entity.prevYearMarginPercentFull).toBeNull();
  expect(entity.prevYearMarginAmount).toBeNull();
  expect(entity.prevYearMarginAmountFull).toBeNull();
  expect(entity.prevYearFrequency).toBeNull();
  expect(entity.prevYearFrequencyFull).toBeNull();
}

describe('buildEntityList — customer dim', () => {
  beforeEach(() => {
    vi.mocked(readOrders).mockReset();
    vi.mocked(cachedFetch).mockReset();
  });

  it('cold cache: returns all master customers as stubs with null metrics, enriched=false', async () => {
    vi.mocked(readOrders).mockResolvedValue(null);
    vi.mocked(cachedFetch).mockResolvedValue({
      data: [mkCustomer('C1', 'Disney Parks'), mkCustomer('C2', 'Disney Cruise')],
      cached: false,
      cachedAt: null,
    });

    const result = await buildEntityList('customer', 'ytd');
    expect(result.enriched).toBe(false);
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].id).toBe('C1');
    expect(result.entities[0].revenue).toBeNull();
    expect(result.entities[0].orderCount).toBeNull();
    expect(result.yearsAvailable).toEqual([]);
  });

  it('warm cache: merges master customers with orders-derived metrics, enriched=true', async () => {
    const customers = [mkCustomer('C1', 'Disney Parks'), mkCustomer('C2', 'Disney Cruise')];
    vi.mocked(readOrders).mockResolvedValue({
      orders: [mkOrder('C1'), mkOrder('C1')],  // C1 has orders, C2 does not
      meta: { lastFetchDate: '2026-04-16T00:00:00Z', orderCount: 2, filterHash: 'all' },
    });
    vi.mocked(cachedFetch).mockResolvedValue({ data: customers, cached: true, cachedAt: '2026-04-16T00:00:00Z' });

    const result = await buildEntityList('customer', 'ytd');
    expect(result.enriched).toBe(true);
    expect(result.entities).toHaveLength(2);

    // C1 should have enriched metrics
    const c1 = result.entities.find(e => e.id === 'C1');
    expect(c1?.revenue).toBe(200);  // 2 orders × $100
    expect(c1?.orderCount).toBe(2);

    // C2 should be a stub (no orders)
    const c2 = result.entities.find(e => e.id === 'C2');
    expect(c2?.revenue).toBeNull();
    expect(c2?.orderCount).toBeNull();
  });

  it('yearsAvailable derived from order dates', async () => {
    vi.mocked(readOrders).mockResolvedValue({
      orders: [
        { ...mkOrder('C1'), CURDATE: '2026-01-15T00:00:00Z' },
        { ...mkOrder('C1'), CURDATE: '2025-06-15T00:00:00Z' },
      ],
      meta: { lastFetchDate: '', orderCount: 2, filterHash: 'all' },
    });
    vi.mocked(cachedFetch).mockResolvedValue({ data: [mkCustomer('C1', 'C1')], cached: true, cachedAt: null });

    const result = await buildEntityList('customer', 'ytd');
    expect(result.yearsAvailable).toEqual(['2026', '2025']);
  });
});

describe('buildEntityList — item-based dims', () => {
  beforeEach(() => {
    vi.mocked(readOrders).mockReset();
    vi.mocked(cachedFetch).mockReset();
  });

  it('cold cache: returns vendor master-data stubs with null metrics', async () => {
    vi.mocked(readOrders).mockResolvedValue(null);
    vi.mocked(cachedFetch).mockResolvedValueOnce({
      data: [mkVendor('V1', 'Vendor One'), mkVendor('V2', 'Vendor Two')],
      cached: true,
      cachedAt: '2026-04-16T00:00:00Z',
    });

    const result = await buildEntityList('vendor', 'ytd');
    expect(result.enriched).toBe(false);
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].id).toBe('V1');
    expect(result.entities[0].name).toBe('Vendor One');
    expectStubMetrics(result.entities[0]);
    expect(result.entities[1].id).toBe('V2');
    expect(result.entities[1].name).toBe('Vendor Two');
    expectStubMetrics(result.entities[1]);
  });

  it('vendor meta1 joins SUPNAME and COUNTRYNAME with middle dot', async () => {
    vi.mocked(readOrders).mockResolvedValue(null);
    vi.mocked(cachedFetch).mockResolvedValueOnce({
      data: [mkVendor('V1', 'Vendor One', 'France'), mkVendor('V2', 'Vendor Two')],
      cached: true,
      cachedAt: '2026-04-16T00:00:00Z',
    });

    const result = await buildEntityList('vendor', 'ytd');
    expect(result.entities[0].meta1).toBe('V1 \u00B7 France');
    // WHY: empty COUNTRYNAME collapses via filter(Boolean) — show SUPNAME alone.
    expect(result.entities[1].meta1).toBe('V2');
  });

  it('warm cache: vendor row keeps SUPPLIERS name + meta1, inherits orders metrics', async () => {
    vi.mocked(readOrders).mockResolvedValue({
      orders: [
        mkOrderWithItems('C1', [
          mkOrderItem({
            Y_1159_5_ESH: 'V1',
            Y_1530_5_ESH: 'Old Vendor Name From Order',
          }),
        ]),
      ],
      meta: { lastFetchDate: '2026-04-16T00:00:00Z', orderCount: 1, filterHash: 'all' },
    });
    vi.mocked(cachedFetch).mockResolvedValueOnce({
      data: [mkVendor('V1', 'Vendor One', 'France')],
      cached: true,
      cachedAt: '2026-04-16T00:00:00Z',
    });

    const result = await buildEntityList('vendor', 'ytd');
    expect(result.enriched).toBe(true);
    const v1 = result.entities.find(entity => entity.id === 'V1');
    expect(v1?.name).toBe('Vendor One');
    expect(v1?.meta1).toBe('V1 \u00B7 France');
    expect(v1?.revenue).toBe(100);
    expect(v1?.orderCount).toBe(1);
  });

  it('cold cache: returns product-type master-data stubs with null metrics', async () => {
    vi.mocked(readOrders).mockResolvedValue(null);
    vi.mocked(cachedFetch).mockResolvedValueOnce({
      data: [mkProductType('FT1', 'Frozen'), mkProductType('FT2', 'Produce')],
      cached: true,
      cachedAt: '2026-04-16T00:00:00Z',
    });

    const result = await buildEntityList('product_type', 'ytd');
    expect(result.enriched).toBe(false);
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].id).toBe('FT1');
    expect(result.entities[0].name).toBe('Frozen');
    expectStubMetrics(result.entities[0]);
    expect(result.entities[1].id).toBe('FT2');
    expect(result.entities[1].name).toBe('Produce');
    expectStubMetrics(result.entities[1]);
  });

  it('cold cache: returns product master-data stubs with null metrics', async () => {
    vi.mocked(readOrders).mockResolvedValue(null);
    vi.mocked(cachedFetch).mockResolvedValueOnce({
      data: [mkProduct('P1', 'Product One', 'Brand One'), mkProduct('P2', 'Product Two', 'Brand Two')],
      cached: true,
      cachedAt: '2026-04-16T00:00:00Z',
    });

    const result = await buildEntityList('product', 'ytd');
    expect(result.enriched).toBe(false);
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].id).toBe('P1');
    expect(result.entities[0].name).toBe('Product One');
    expectStubMetrics(result.entities[0]);
    expect(result.entities[1].id).toBe('P2');
    expect(result.entities[1].name).toBe('Product Two');
    expectStubMetrics(result.entities[1]);
  });

  it('cold cache: returns brand master-data stubs with null metrics', async () => {
    vi.mocked(readOrders).mockResolvedValue(null);
    vi.mocked(cachedFetch).mockResolvedValueOnce({
      data: [
        mkProduct('P1', 'Product One', 'Brand One'),
        mkProduct('P2', 'Product Two', 'Brand Two'),
        mkProduct('P3', 'Product Three', null),
      ],
      cached: true,
      cachedAt: '2026-04-16T00:00:00Z',
    });

    const result = await buildEntityList('brand', 'ytd');
    expect(result.enriched).toBe(false);
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].id).toBe('Brand One');
    expect(result.entities[0].name).toBe('Brand One');
    expectStubMetrics(result.entities[0]);
    expect(result.entities[1].id).toBe('Brand Two');
    expect(result.entities[1].name).toBe('Brand Two');
    expectStubMetrics(result.entities[1]);
  });

  it('warm cache: unions orders-derived brands with master SPEC4 stubs', async () => {
    vi.mocked(readOrders).mockResolvedValue({
      orders: [
        mkOrderWithItems('C1', [mkOrderItem({ PARTNAME: 'P1', PDES: 'Product One', Y_9952_5_ESH: 'Brand One' })]),
      ],
      meta: { lastFetchDate: '2026-04-16T00:00:00Z', orderCount: 1, filterHash: 'all' },
    });
    vi.mocked(cachedFetch).mockResolvedValueOnce({
      data: [
        mkProduct('P1', 'Product One', 'Brand One'),
        mkProduct('P2', 'Product Two', 'Brand Zero'),
        mkProduct('P3', 'Product Three', null),
      ],
      cached: true,
      cachedAt: '2026-04-16T00:00:00Z',
    });

    const result = await buildEntityList('brand', 'ytd');
    expect(result.enriched).toBe(true);
    expect(result.entities).toHaveLength(2);

    const brandOne = result.entities.find(entity => entity.id === 'Brand One');
    expect(brandOne?.name).toBe('Brand One');
    expect(brandOne?.revenue).toBe(100);
    expect(brandOne?.orderCount).toBe(1);

    const brandZero = result.entities.find(entity => entity.id === 'Brand Zero');
    expect(brandZero).toBeDefined();
    expect(brandZero?.name).toBe('Brand Zero');
    expectStubMetrics(brandZero as EntityListItem);
  });
});
