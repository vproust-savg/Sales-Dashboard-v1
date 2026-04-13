// FILE: server/src/services/customer-filter.ts
// PURPOSE: Post-fetch filtering of orders by customer-level criteria (zone, customerType)
// USED BY: server/src/routes/fetch-all.ts
// EXPORTS: filterOrdersByCustomerCriteria

import type { RawOrder, RawCustomer } from './priority-queries.js';

interface CustomerFilterCriteria {
  zone?: string;         // comma-separated zone names (ZONEDES)
  customerType?: string; // comma-separated customer type names (CTYPENAME)
}

/**
 * Filter orders to only those from customers matching zone/customerType criteria.
 * WHY: Zone and customerType are CUSTOMERS-level fields — can't be OData-filtered
 * on ORDERS. This post-fetch filter runs after the join.
 * Within a filter type, values are OR'd. Across types, AND'd.
 * Returns all orders if no criteria are set.
 */
export function filterOrdersByCustomerCriteria(
  orders: RawOrder[],
  customers: RawCustomer[],
  criteria: CustomerFilterCriteria,
): RawOrder[] {
  const { zone, customerType } = criteria;
  if (!zone && !customerType) return orders;

  const zoneSet = zone
    ? new Set(zone.split(',').map(z => z.trim().toLowerCase()))
    : null;
  const typeSet = customerType
    ? new Set(customerType.split(',').map(t => t.trim().toLowerCase()))
    : null;

  // WHY: Build customer lookup once, then filter orders. O(customers + orders) not O(customers * orders).
  const matchingCustomers = new Set<string>();
  for (const c of customers) {
    const zoneMatch = !zoneSet || zoneSet.has((c.ZONEDES ?? '').toLowerCase());
    const typeMatch = !typeSet || typeSet.has((c.CTYPENAME ?? '').toLowerCase());
    if (zoneMatch && typeMatch) {
      matchingCustomers.add(c.CUSTNAME);
    }
  }

  return orders.filter(o => matchingCustomers.has(o.CUSTNAME));
}
