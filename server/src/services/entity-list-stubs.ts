// FILE: server/src/services/entity-list-stubs.ts
// PURPOSE: Centralize left-panel master-data stub builders for cold-cache and zero-order rows
// USED BY: server/src/services/entity-list-builder.ts
// EXPORTS: customerStub, zoneStub, vendorStub, productTypeStub, productStub, brandStub, brandMasters

import type { EntityListItem, RawProduct, RawProductType } from '@shared/types/dashboard';
import type { RawCustomer, RawZone, RawVendor } from './priority-queries.js';

export function customerStub(customer: RawCustomer): EntityListItem {
  return {
    id: customer.CUSTNAME,
    name: customer.CUSTDES,
    meta1: [customer.ZONEDES, customer.AGENTNAME].filter(Boolean).join(' \u00B7 '),
    ...NULL_METRIC_FIELDS,
    rep: customer.AGENTNAME || null,
    zone: customer.ZONEDES || null,
    customerType: customer.CTYPENAME || null,
  };
}

export function zoneStub(zone: RawZone): EntityListItem {
  return {
    id: zone.ZONECODE,
    name: zone.ZONEDES || zone.ZONECODE,
    meta1: '',
    ...NULL_METRIC_FIELDS,
    rep: null,
    zone: null,
    customerType: null,
  };
}

export function vendorStub(vendor: RawVendor): EntityListItem {
  return {
    id: vendor.SUPNAME,
    name: vendor.SUPDES,
    meta1: '',
    ...NULL_METRIC_FIELDS,
    rep: null,
    zone: null,
    customerType: null,
  };
}

export function productTypeStub(productType: RawProductType): EntityListItem {
  return {
    id: productType.FTCODE,
    name: productType.FTNAME,
    meta1: productType.FTCODE,
    ...NULL_METRIC_FIELDS,
    rep: null,
    zone: null,
    customerType: null,
  };
}

export function productStub(product: RawProduct): EntityListItem {
  return {
    id: product.PARTNAME,
    name: product.PARTDES,
    meta1: '',
    ...NULL_METRIC_FIELDS,
    rep: null,
    zone: null,
    customerType: null,
  };
}

export function brandStub(brand: string): EntityListItem {
  return {
    id: brand,
    name: brand,
    meta1: '',
    ...NULL_METRIC_FIELDS,
    rep: null,
    zone: null,
    customerType: null,
  };
}

export function brandMasters(products: RawProduct[]): string[] {
  return [...new Set(
    products
      .map(product => product.SPEC4?.trim())
      .filter((brand): brand is string => Boolean(brand)),
  )].sort((a, b) => a.localeCompare(b));
}

const NULL_METRIC_FIELDS: Pick<
  EntityListItem,
  | 'meta2'
  | 'revenue'
  | 'orderCount'
  | 'avgOrder'
  | 'marginPercent'
  | 'marginAmount'
  | 'frequency'
  | 'lastOrderDate'
  | 'prevYearRevenue'
  | 'prevYearRevenueFull'
  | 'prevYearOrderCount'
  | 'prevYearOrderCountFull'
  | 'prevYearAvgOrder'
  | 'prevYearAvgOrderFull'
  | 'prevYearMarginPercent'
  | 'prevYearMarginPercentFull'
  | 'prevYearMarginAmount'
  | 'prevYearMarginAmountFull'
  | 'prevYearFrequency'
  | 'prevYearFrequencyFull'
> = {
  meta2: null,
  revenue: null,
  orderCount: null,
  avgOrder: null,
  marginPercent: null,
  marginAmount: null,
  frequency: null,
  lastOrderDate: null,
  prevYearRevenue: null,
  prevYearRevenueFull: null,
  prevYearOrderCount: null,
  prevYearOrderCountFull: null,
  prevYearAvgOrder: null,
  prevYearAvgOrderFull: null,
  prevYearMarginPercent: null,
  prevYearMarginPercentFull: null,
  prevYearMarginAmount: null,
  prevYearMarginAmountFull: null,
  prevYearFrequency: null,
  prevYearFrequencyFull: null,
};
