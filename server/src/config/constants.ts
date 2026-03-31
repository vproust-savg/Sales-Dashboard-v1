// FILE: server/src/config/constants.ts
// PURPOSE: API limits, pagination, cache TTLs, field lists for Priority OData queries
// USED BY: server/src/services/priority-client.ts, server/src/services/priority-queries.ts, server/src/cache/cache-keys.ts
// EXPORTS: API_LIMITS, PAGE_SIZE, CACHE_TTLS, ORDER_SELECT, ORDERITEM_SELECT, CUSTOMER_SELECT, etc.

/** Priority API fair usage limits — spec Section 17.5 */
export const API_LIMITS = {
  CALLS_PER_MINUTE: 100,
  MAX_QUEUED: 15,
  REQUEST_TIMEOUT_MS: 170_000,  // 2m50s (under Priority's 3m hard limit)
  MAX_RETRIES: 3,
} as const;

/** Pagination — spec Section 17.4 */
export const PAGE_SIZE = 5000;
export const MAXAPILINES = 50_000;  // Current instance setting

/** Redis cache TTLs in seconds — spec Section 19.2 */
export const CACHE_TTLS = {
  orders_ytd: 15 * 60,       // 15 min
  orders_year: 24 * 60 * 60, // 24 hours
  customers: 60 * 60,        // 1 hour
  zones: 24 * 60 * 60,       // 24 hours
  agents: 60 * 60,           // 1 hour
  vendors: 24 * 60 * 60,     // 24 hours
  contacts: 30 * 60,              // 30 min
  years_available: 60 * 60,       // 1 hour
  entities_summary: 15 * 60,      // 15 min — lightweight left-panel list
  entity_detail: 10 * 60,         // 10 min — per-entity dashboard detail
} as const;

/** Priority ORDERS fields — spec Section 18.1 */
export const ORDER_SELECT = [
  'ORDNAME', 'CURDATE', 'ORDSTATUSDES', 'TOTPRICE',
  'CUSTNAME', 'AGENTCODE', 'AGENTNAME',
].join(',');

/** Priority ORDERITEMS_SUBFORM fields — spec Section 18.2 */
export const ORDERITEM_SELECT = [
  'PDES', 'PARTNAME', 'TQUANT', 'QPRICE', 'PRICE',
  'PURCHASEPRICE', 'QPROFIT', 'PERCENT',
  'Y_1159_5_ESH', 'Y_1530_5_ESH', 'Y_9952_5_ESH',
  'Y_3020_5_ESH', 'Y_3021_5_ESH', 'Y_17936_5_ESH',
].join(',');

/** Lighter set for previous-year queries (only what's needed for trends) */
export const ORDERITEM_SELECT_PREV = [
  'PARTNAME', 'QPRICE', 'QPROFIT', 'Y_9952_5_ESH', 'Y_3021_5_ESH',
].join(',');

/** Priority CUSTOMERS fields — spec Section 18.3 */
export const CUSTOMER_SELECT = [
  'CUSTNAME', 'CUSTDES', 'ZONECODE', 'ZONEDES',
  'AGENTCODE', 'AGENTNAME', 'CREATEDDATE', 'CTYPECODE', 'CTYPENAME',
].join(',');

/** Priority CUSTPERSONNEL_SUBFORM fields — spec Section 18.4 */
export const CONTACT_SELECT = [
  'NAME', 'POSITIONDES', 'PHONENUM', 'CELLPHONE', 'EMAIL', 'INACTIVE',
].join(',');

/** Order status mapping — spec Section 10.4 */
export const ORDER_STATUS_MAP: Record<string, 'Delivered' | 'Pending' | 'Processing'> = {
  Closed: 'Delivered',
  'Partially Filled': 'Pending',
  Open: 'Processing',
};

/** Statuses to exclude from dashboard — spec Section 10.4 */
export const EXCLUDED_STATUSES = ['Canceled'];
