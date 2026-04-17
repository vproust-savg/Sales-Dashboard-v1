// FILE: server/src/services/__tests__/narrow-order-filter.test.ts
// PURPOSE: Unit tests for buildNarrowOrderFilter and the exported custnameOrFilter helper
//   used by the per-item narrow path (vendor/brand/product_type/product).

import { describe, it, expect } from 'vitest';
import { buildNarrowOrderFilter, custnameOrFilter } from '../narrow-order-filter.js';
import type { RawCustomer } from '../priority-queries.js';

const makeCustomer = (CUSTNAME: string, ZONECODE: string): RawCustomer => ({
  CUSTNAME, CUSTDES: '', ZONECODE, ZONEDES: '',
  AGENTCODE: '', AGENTNAME: '', CREATEDDATE: '',
  CTYPECODE: '', CTYPENAME: '',
});

describe('buildNarrowOrderFilter', () => {
  it('returns undefined for empty ids', () => {
    expect(buildNarrowOrderFilter('customer', [], [])).toBeUndefined();
  });

  it('builds a CUSTNAME OR-chain for customer dim', () => {
    expect(buildNarrowOrderFilter('customer', ['C1', 'C2'], []))
      .toBe("CUSTNAME eq 'C1' or CUSTNAME eq 'C2'");
  });

  it('returns undefined for per-item dims (resolver handles these — see routes)', () => {
    expect(buildNarrowOrderFilter('vendor', ['V1'], [])).toBeUndefined();
    expect(buildNarrowOrderFilter('brand', ['B1'], [])).toBeUndefined();
    expect(buildNarrowOrderFilter('product_type', ['01'], [])).toBeUndefined();
    expect(buildNarrowOrderFilter('product', ['P1'], [])).toBeUndefined();
  });

  it('resolves zone dim via customer lookup', () => {
    const customers = [makeCustomer('C1', 'Z1'), makeCustomer('C2', 'Z1'), makeCustomer('C3', 'Z2')];
    expect(buildNarrowOrderFilter('zone', ['Z1'], customers))
      .toBe("CUSTNAME eq 'C1' or CUSTNAME eq 'C2'");
  });
});

describe('custnameOrFilter (exported for per-item narrow path)', () => {
  it('builds a CUSTNAME OR-chain from a list', () => {
    expect(custnameOrFilter(['C1', 'C2', 'C3']))
      .toBe("CUSTNAME eq 'C1' or CUSTNAME eq 'C2' or CUSTNAME eq 'C3'");
  });

  it("escapes single quotes by doubling (OData convention)", () => {
    expect(custnameOrFilter(["O'Brien"]))
      .toBe("CUSTNAME eq 'O''Brien'");
  });

  it('produces a single term for a 1-element list', () => {
    expect(custnameOrFilter(['C1'])).toBe("CUSTNAME eq 'C1'");
  });
});
