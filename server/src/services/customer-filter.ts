// FILE: server/src/services/customer-filter.ts
// PURPOSE: Post-fetch filtering of orders by agent name, customer-level criteria (zone, customerType), and item-level criteria (brand, productFamily, countryOfOrigin, foodServiceRetail)
// USED BY: server/src/routes/fetch-all.ts.
//   filterOrdersByItemCriteria: foundation export — wired into fetch-all.ts in Task 4.5.
// EXPORTS: filterOrdersByAgent, filterOrdersByCustomerCriteria, filterOrdersByItemCriteria, ItemFilterCriteria

import type { RawOrder, RawCustomer } from './priority-queries.js';

/**
 * Filter orders by agent name(s). AGENTNAME is an ORDER-level field — filtered directly
 * on the order, unlike zone/customerType which require a customer lookup.
 * WHY: With the universal "all" cache, agent filtering is post-cache (not OData pre-fetch).
 * Returns all orders if no agentName is set.
 */
export function filterOrdersByAgent(
  orders: RawOrder[],
  agentName?: string,
): RawOrder[] {
  if (!agentName) return orders;
  const nameSet = new Set(agentName.split(',').map(n => n.trim().toLowerCase()));
  return orders.filter(o => nameSet.has((o.AGENTNAME ?? '').toLowerCase()));
}

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

export interface ItemFilterCriteria {
  brand?: string[];
  productFamily?: string[];
  countryOfOrigin?: string[];
  foodServiceRetail?: string[];
}

/** Filter orders to those where ANY item matches ALL supplied criteria fields.
 *  Within each criteria field: OR (multi-value). Across fields: AND.
 *  Empty criteria (or all arrays empty/undefined) → all orders pass through unchanged.
 *  WHY item-level: brand/family/country/fsr live on ORDERITEMS_SUBFORM custom fields, not on
 *  the order header. Filtering is post-fetch (universal "all" cache pattern). */
export function filterOrdersByItemCriteria(
  orders: RawOrder[],
  criteria: ItemFilterCriteria,
): RawOrder[] {
  // WHY case-exact (no .toLowerCase()): item custom fields (Y_9952_5_ESH brand, Y_2075_5_ESH
  // family, Y_5380_5_ESH country, Y_9967_5_ESH fsr) contain exact Priority codes — not
  // free-text names. Contrast with filterOrdersByCustomerCriteria above, which lowercases
  // for user-visible zone/type names. Do NOT add .toLowerCase() here.
  const brands    = criteria.brand?.length             ? new Set(criteria.brand)             : null;
  const families  = criteria.productFamily?.length     ? new Set(criteria.productFamily)     : null;
  const countries = criteria.countryOfOrigin?.length   ? new Set(criteria.countryOfOrigin)   : null;
  const fsr       = criteria.foodServiceRetail?.length ? new Set(criteria.foodServiceRetail) : null;
  if (!brands && !families && !countries && !fsr) return orders;

  return orders.filter(o =>
    (o.ORDERITEMS_SUBFORM ?? []).some(i =>
      (!brands    || brands.has(i.Y_9952_5_ESH ?? '')) &&
      (!families  || families.has(i.Y_2075_5_ESH ?? '')) &&
      (!countries || countries.has(i.Y_5380_5_ESH ?? '')) &&
      (!fsr       || fsr.has(i.Y_9967_5_ESH ?? ''))
    ),
  );
}
