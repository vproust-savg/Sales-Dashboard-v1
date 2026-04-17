// FILE: server/src/services/narrow-order-filter.ts
// PURPOSE: Build an OData `$filter` clause that narrows Priority ORDERS fetches to a subset
//   of entities, so cold-cache single-entity / subset-of-entities loads don't pull the full
//   YTD orders set (~22K rows, 6+ min, Priority timeouts).
// USED BY: server/src/routes/dashboard.ts, server/src/routes/fetch-all.ts
// EXPORTS: buildNarrowOrderFilter

import type { Dimension } from '@shared/types/dashboard';
import type { RawCustomer } from './priority-queries.js';

/**
 * Build an OData `$filter` clause that narrows Priority ORDERS to the requested entities.
 * Supports dimensions where ORDERS has a filterable field (directly or via CUSTOMERS lookup):
 *  - customer → direct CUSTNAME filter (OR-chained for multi-select)
 *  - zone     → look up CUSTNAMEs whose ZONECODE is in `ids`, then OR-chain
 *
 * Returns `undefined` for:
 *  - empty id list (no narrowing requested)
 *  - per-item dimensions (vendor/brand/product_type/product) — their discriminator fields
 *    live on ORDERITEMS_SUBFORM and cannot be filtered at the ORDERS level in Priority's
 *    OData surface. Callers fall back to the universal-cache path.
 *  - zone lookup that matches zero customers (empty filter clause would be invalid OData)
 *
 * Single quotes are OData-escaped (`'` → `''`) so entity IDs containing quotes cannot
 * break out of the filter literal.
 */
export function buildNarrowOrderFilter(
  dimension: Dimension,
  ids: string[],
  customers: RawCustomer[],
): string | undefined {
  if (ids.length === 0) return undefined;

  if (dimension === 'customer') {
    return custnameOrFilter(ids);
  }

  if (dimension === 'zone') {
    const zoneSet = new Set(ids);
    const custIds = customers.filter(c => zoneSet.has(c.ZONECODE)).map(c => c.CUSTNAME);
    // WHY empty check: zone lookup can legitimately return zero customers (e.g., unknown
    // ZONECODE). An empty filter clause would be syntactically invalid; fall through to
    // the universal cache path instead.
    if (custIds.length === 0) return undefined;
    return custnameOrFilter(custIds);
  }

  // Per-item dims (vendor/brand/product_type/product): no ORDERS-level filter available.
  return undefined;
}

/** OR-chain a list of CUSTNAMEs into an OData filter, with single-quote escaping. */
function custnameOrFilter(ids: string[]): string {
  return ids.map(id => `CUSTNAME eq '${id.replace(/'/g, "''")}'`).join(' or ');
}
