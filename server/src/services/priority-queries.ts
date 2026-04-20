// FILE: server/src/services/priority-queries.ts
// PURPOSE: Build OData query parameters for each Priority entity the dashboard needs
// USED BY: server/src/routes/dashboard.ts, server/src/routes/contacts.ts, server/src/services/warm-cache.ts
// EXPORTS: fetchOrders, fetchCustomers, fetchZones, fetchAgents, fetchVendors, fetchContacts, fetchProductTypes, fetchProducts, fetchCustomerTypes
//
// SIGNAL CONVENTION: fetchers called from fetch-all.ts (where AbortController cascades client
//   cancel) accept `signal?: AbortSignal` — currently fetchOrders, fetchCustomers,
//   fetchProductTypes, fetchProducts. fetchZones/fetchAgents/fetchVendors are warm-cache-only
//   and intentionally omit it. If a fetcher starts being used from fetch-all, add the param.

import { PriorityClient } from './priority-client.js';
import type { RawProductType, RawProduct } from '@shared/types/dashboard';
import {
  ORDER_SELECT, ORDERITEM_SELECT, ORDERITEM_SELECT_PREV,
  CUSTOMER_SELECT, CONTACT_SELECT,
  EXCLUDED_STATUSES,
} from '../config/constants.js';

/** Raw order from Priority with expanded ORDERITEMS */
export interface RawOrder {
  ORDNAME: string;
  CURDATE: string;
  ORDSTATUSDES: string;
  TOTPRICE: number;
  CUSTNAME: string;
  AGENTCODE: string;
  AGENTNAME: string;
  ORDERITEMS_SUBFORM: RawOrderItem[];
}

export interface RawOrderItem {
  PDES: string;
  PARTNAME: string;
  TQUANT: number;
  TUNITNAME: string;      // Unit of measure (e.g., "cs", "ea", "lb")
  QPRICE: number;
  PRICE: number;
  PURCHASEPRICE: number;
  QPROFIT: number;
  PERCENT: number;
  Y_1159_5_ESH: string;   // Vendor code
  Y_1530_5_ESH: string;   // Vendor name
  Y_9952_5_ESH: string;   // Brand
  Y_3020_5_ESH: string;   // Family type code
  Y_3021_5_ESH: string;   // Family type name
  Y_17936_5_ESH: string;  // Vendor part number
  Y_2075_5_ESH: string;   // Product Family
  Y_5380_5_ESH: string;   // Country of Origin
  Y_9967_5_ESH: string;   // Food Service vs Retail (Y = Retail)
}

export interface RawCustomer {
  CUSTNAME: string;
  CUSTDES: string;
  ZONECODE: string;
  ZONEDES: string;
  AGENTCODE: string;
  AGENTNAME: string;
  CREATEDDATE: string;
  CTYPECODE: string;
  CTYPENAME: string;
}

export interface RawContact {
  NAME: string;
  POSITIONDES: string;
  PHONENUM: string;
  CELLPHONE: string;
  EMAIL: string;
  INACTIVE: string;
}

export interface RawZone {
  DISTRLINECODE: string;
  DISTRLINEDES: string;
  ZONECODE: string;
  ZONEDES: string;
}

export interface RawAgent {
  AGENTCODE: string;
  AGENTNAME: string;
  INACTIVE: string;
}

export interface RawVendor {
  SUPNAME: string;
  SUPDES: string;
  COUNTRYNAME: string;
}

export interface RawCustomerType {
  CTYPECODE: string;
  CTYPENAME: string;
}

/** Fetch orders with expanded line items for a date range — spec Section 17.2 */
export async function fetchOrders(
  client: PriorityClient,
  startDate: string,
  endDate: string,
  isCurrentPeriod: boolean,
  extraFilter?: string,
  onProgress?: (rowsFetched: number, estimatedTotal: number) => void,
  signal?: AbortSignal,
): Promise<RawOrder[]> {
  const statusExclude = EXCLUDED_STATUSES.map(s => `ORDSTATUSDES ne '${s}'`).join(' and ');
  // WHY: extraFilter lets callers narrow by entity (e.g., CUSTNAME eq 'C7826') without
  // duplicating the entire query construction logic.
  // WHY wrap in parens: OData's `and` binds tighter than `or`. An OR-chain extraFilter
  // like `CUSTNAME eq 'A' or CUSTNAME eq 'B'` would otherwise associate as
  // `(dateFilter and CUSTNAME eq 'A') or CUSTNAME eq 'B'` — the second disjunct would
  // escape the date filter and pull the customer's entire historical order set. Wrapping
  // the whole clause in parens keeps `extraFilter` an atomic sub-expression.
  const dateFilter = `CURDATE ge ${startDate} and CURDATE lt ${endDate} and ${statusExclude}`
    + (extraFilter ? ` and (${extraFilter})` : '');
  const itemFields = isCurrentPeriod ? ORDERITEM_SELECT : ORDERITEM_SELECT_PREV;

  return client.fetchAllPages<RawOrder>('ORDERS', {
    // WHY: Prev-year needs AGENTNAME for in-memory agent filtering (universal "all" cache).
    select: isCurrentPeriod ? ORDER_SELECT : 'ORDNAME,CURDATE,TOTPRICE,CUSTNAME,AGENTCODE,AGENTNAME',
    filter: dateFilter,
    orderby: 'ORDNAME asc',
    expand: `ORDERITEMS_SUBFORM($select=${itemFields})`,
    // WHY: onProgress keeps the SSE connection alive during long pagination fetches.
    // Without it, Railway's nginx proxy closes idle SSE connections after ~60s.
    onProgress,
    signal,
  });
}

/** Fetch all customers — spec Section 17.3 */
export async function fetchCustomers(client: PriorityClient, signal?: AbortSignal): Promise<RawCustomer[]> {
  return client.fetchAllPages<RawCustomer>('CUSTOMERS', {
    select: CUSTOMER_SELECT,
    orderby: 'CUSTNAME asc',
    signal,
  });
}

/** Fetch zones (distribution lines) — spec Section 17.3 */
export async function fetchZones(client: PriorityClient): Promise<RawZone[]> {
  return client.fetchAllPages<RawZone>('DISTRLINES', {
    select: 'DISTRLINECODE,DISTRLINEDES,ZONECODE,ZONEDES',
    orderby: 'DISTRLINECODE asc',
  });
}

/** Fetch active sales reps — spec Section 17.3 */
export async function fetchAgents(client: PriorityClient): Promise<RawAgent[]> {
  return client.fetchAllPages<RawAgent>('AGENTS', {
    select: 'AGENTCODE,AGENTNAME,INACTIVE',
    filter: "INACTIVE ne 'Y'",
    orderby: 'AGENTCODE asc',
  });
}

/** Fetch vendors — spec Section 17.3 */
export async function fetchVendors(client: PriorityClient): Promise<RawVendor[]> {
  return client.fetchAllPages<RawVendor>('SUPPLIERS', {
    select: 'SUPNAME,SUPDES,COUNTRYNAME',
    orderby: 'SUPNAME asc',
  });
}

/** Fetch customer group master list — used to populate the Customer Type filter dropdown. */
export async function fetchCustomerTypes(client: PriorityClient): Promise<RawCustomerType[]> {
  return client.fetchAllPages<RawCustomerType>('CTYPE', {
    select: 'CTYPECODE,CTYPENAME',
    orderby: 'CTYPECODE asc',
  });
}

/** Fetch contacts for a single customer — spec Section 17.3 */
export async function fetchContacts(
  client: PriorityClient,
  customerCode: string,
): Promise<RawContact[]> {
  const escaped = customerCode.replace(/'/g, "''");
  const results = await client.fetchEntity<{ CUSTPERSONNEL_SUBFORM: RawContact[] }>(
    'CUSTOMERS',
    {
      select: 'CUSTNAME',
      filter: `CUSTNAME eq '${escaped}'`,
      top: 1,
      expand: `CUSTPERSONNEL_SUBFORM($select=${CONTACT_SELECT})`,
    },
  );
  if (results.length === 0) return [];
  return (results[0].CUSTPERSONNEL_SUBFORM ?? []).filter(c => c.INACTIVE !== 'Y');
}

/** Fetch distinct product-type (family-type) pairs from FAMILY_LOG.
 *  WHY: FTCODE/FTNAME matches order items' Y_3020_5_ESH/Y_3021_5_ESH for the Product Type dim.
 *  FAMILY_LOG has many part families grouped under few product types — dedupe by FTCODE. */
export async function fetchProductTypes(client: PriorityClient, signal?: AbortSignal): Promise<RawProductType[]> {
  const rows = await client.fetchAllPages<{ FTCODE: string | null; FTNAME: string | null }>('FAMILY_LOG', {
    select: 'FTCODE,FTNAME',
    orderby: 'FTCODE asc',
    signal,
  });
  const seen = new Map<string, RawProductType>();
  // WHY drop rows with empty FTNAME: Priority returns '' for unconfigured product types.
  // The dashboard uses FTNAME as the display name; a product type with no name would show as
  // blank in the UI and would not help users identify it. FTCODE-only fallback was considered
  // and rejected (codes like "01"/"02" are not human-meaningful).
  for (const r of rows) {
    if (r.FTCODE && r.FTNAME && !seen.has(r.FTCODE)) {
      seen.set(r.FTCODE, { FTCODE: r.FTCODE, FTNAME: r.FTNAME });
    }
  }
  return [...seen.values()];
}

/** Fetch all in-use products from LOGPART.
 *  WHY: PARTNAME matches order items' PARTNAME field for the Product dim.
 *  STATDES='In Use' filter excludes discontinued/archived parts at the API level.
 *  WHY SPEC4 (not Y_9952_5_ESH): on LOGPART the brand lives in SPEC4 (Priority's custom string
 *  slot); Y_9952_5_ESH is the same brand value but only exists on ORDERITEMS_SUBFORM. Verified
 *  live that SPEC4 and Y_9952_5_ESH return identical strings for the same PARTNAME, so this
 *  master can drive a brand filter dropdown that joins cleanly with order-item brand. */
export async function fetchProducts(client: PriorityClient, signal?: AbortSignal): Promise<RawProduct[]> {
  return client.fetchAllPages<RawProduct>('LOGPART', {
    select: 'PARTNAME,PARTDES,FAMILYNAME,SPEC4,Y_5380_5_ESH,STATDES',
    filter: "STATDES eq 'In Use' and PARTNAME ne '000'",
    orderby: 'PARTNAME asc',
    signal,
  });
}
