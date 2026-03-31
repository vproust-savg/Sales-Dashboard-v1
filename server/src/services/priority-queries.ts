// FILE: server/src/services/priority-queries.ts
// PURPOSE: Build OData query parameters for each Priority entity the dashboard needs
// USED BY: server/src/routes/dashboard.ts, server/src/routes/contacts.ts
// EXPORTS: fetchOrders, fetchCustomers, fetchZones, fetchAgents, fetchVendors, fetchContacts

import { PriorityClient } from './priority-client.js';
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
  QPRICE: number;
  PRICE: number;
  PURCHASEPRICE: number;
  QPROFIT: number;
  PERCENT: number;
  Y_1159_5_ESH: string;  // Vendor code
  Y_1530_5_ESH: string;  // Vendor name
  Y_9952_5_ESH: string;  // Brand
  Y_3020_5_ESH: string;  // Family type code
  Y_3021_5_ESH: string;  // Family type name
  Y_17936_5_ESH: string; // Vendor part number
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
}

/** Fetch orders with expanded line items for a date range — spec Section 17.2 */
export async function fetchOrders(
  client: PriorityClient,
  startDate: string,
  endDate: string,
  isCurrentPeriod: boolean,
): Promise<RawOrder[]> {
  const statusExclude = EXCLUDED_STATUSES.map(s => `ORDSTATUSDES ne '${s}'`).join(' and ');
  const dateFilter = `CURDATE ge ${startDate} and CURDATE lt ${endDate} and ${statusExclude}`;
  const itemFields = isCurrentPeriod ? ORDERITEM_SELECT : ORDERITEM_SELECT_PREV;

  return client.fetchAllPages<RawOrder>('ORDERS', {
    select: isCurrentPeriod ? ORDER_SELECT : 'ORDNAME,CURDATE,TOTPRICE,CUSTNAME,AGENTCODE',
    filter: dateFilter,
    orderby: 'ORDNAME asc',
    expand: `ORDERITEMS_SUBFORM($select=${itemFields})`,
  });
}

/** Fetch all customers — spec Section 17.3 */
export async function fetchCustomers(client: PriorityClient): Promise<RawCustomer[]> {
  return client.fetchAllPages<RawCustomer>('CUSTOMERS', {
    select: CUSTOMER_SELECT,
    orderby: 'CUSTNAME asc',
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
    select: 'SUPNAME,SUPDES',
    orderby: 'SUPNAME asc',
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
