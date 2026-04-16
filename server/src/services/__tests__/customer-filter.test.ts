import { describe, it, expect } from 'vitest';
import { filterOrdersByItemCriteria } from '../customer-filter.js';
import type { RawOrder } from '../priority-queries.js';

const baseItem = {
  PDES: '', PARTNAME: 'P1', TQUANT: 0, TUNITNAME: '', QPRICE: 0, PRICE: 0,
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
  TOTPRICE: items.reduce((s, i) => s + (i.QPRICE ?? 0), 0),
  CUSTNAME: custname,
  AGENTCODE: 'A',
  AGENTNAME: 'Alice',
  ORDERITEMS_SUBFORM: items.map(i => ({ ...baseItem, ...i })),
});

describe('filterOrdersByItemCriteria', () => {
  it('filters orders where any item matches brand', () => {
    const orders = [
      makeOrder('O1', 'C1', [{ Y_9952_5_ESH: 'ACETUM', QPRICE: 100 }]),
      makeOrder('O2', 'C1', [{ Y_9952_5_ESH: 'OTHER', QPRICE: 200 }]),
    ];
    const result = filterOrdersByItemCriteria(orders, { brand: ['ACETUM'] });
    expect(result.map(o => o.ORDNAME)).toEqual(['O1']);
  });

  it('AND across criteria fields, OR within each field', () => {
    const orders = [
      makeOrder('O1', 'C1', [{ Y_9952_5_ESH: 'A', Y_5380_5_ESH: 'Italy',  QPRICE: 100 }]),
      makeOrder('O2', 'C1', [{ Y_9952_5_ESH: 'A', Y_5380_5_ESH: 'France', QPRICE: 200 }]),
      makeOrder('O3', 'C1', [{ Y_9952_5_ESH: 'B', Y_5380_5_ESH: 'Italy',  QPRICE: 300 }]),
    ];
    const result = filterOrdersByItemCriteria(orders, { brand: ['A', 'B'], countryOfOrigin: ['Italy'] });
    // brand ∈ {A,B} AND country='Italy' → O1 and O3
    expect(result.map(o => o.ORDNAME).sort()).toEqual(['O1', 'O3']);
  });

  it('filters by productFamily (Y_2075_5_ESH)', () => {
    const orders = [
      makeOrder('O1', 'C1', [{ Y_2075_5_ESH: 'OLIVE_OIL', QPRICE: 100 }]),
      makeOrder('O2', 'C1', [{ Y_2075_5_ESH: 'VINEGAR',   QPRICE: 200 }]),
    ];
    const result = filterOrdersByItemCriteria(orders, { productFamily: ['OLIVE_OIL'] });
    expect(result.map(o => o.ORDNAME)).toEqual(['O1']);
  });

  it('filters by foodServiceRetail (Y_9967_5_ESH — "Y" = Retail)', () => {
    const orders = [
      makeOrder('O1', 'C1', [{ Y_9967_5_ESH: 'Y', QPRICE: 100 }]),  // Retail
      makeOrder('O2', 'C1', [{ Y_9967_5_ESH: '',  QPRICE: 200 }]),  // Food Service
    ];
    const result = filterOrdersByItemCriteria(orders, { foodServiceRetail: ['Y'] });
    expect(result.map(o => o.ORDNAME)).toEqual(['O1']);
  });

  it('returns all orders when criteria is empty', () => {
    const orders = [makeOrder('O1', 'C1', [{ QPRICE: 100 }])];
    expect(filterOrdersByItemCriteria(orders, {})).toEqual(orders);
  });

  it('returns all orders when all criteria arrays are empty/undefined', () => {
    const orders = [makeOrder('O1', 'C1', [{ QPRICE: 100 }])];
    expect(filterOrdersByItemCriteria(orders, { brand: [], productFamily: undefined })).toEqual(orders);
  });
});
