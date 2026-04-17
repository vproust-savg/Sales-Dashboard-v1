// FILE: server/src/services/narrow-filter-decision.ts
// PURPOSE: Shared narrow-filter decision for cold-cache ORDERS fetches. Used by both the
//   single-entity dashboard route and the View-Consolidated fetch-all route so the three
//   paths (customer/zone direct, per-item via reverse index, universal fallback) are
//   implemented once and tested once.
// USED BY: server/src/routes/dashboard.ts, server/src/routes/fetch-all.ts
// EXPORTS: decideNarrowFilter, NarrowDecision

import { buildNarrowOrderFilter, custnameOrFilter } from './narrow-order-filter.js';
import { resolveCustomersForEntity } from './resolve-customers-for-entity.js';
import type { Dimension } from '@shared/types/dashboard';
import type { RawCustomer } from './priority-queries.js';

/** Result of the narrow-filter decision.
 *  - `narrowFilter` string → pass to fetchOrders as extraFilter (narrow path).
 *  - `narrowFilter` undefined → fall through to universal cache (or full fetch on cold).
 *  - `shortCircuitEmpty` true → caller MUST skip the Priority fetch entirely and return an
 *    empty-but-structured payload. The resolver proved zero matching orders exist — paying
 *    the 6-min cold cost to compute the same empty result is pure waste. */
export interface NarrowDecision {
  narrowFilter: string | undefined;
  shortCircuitEmpty: boolean;
}

/** Decide whether (and how) to narrow the Priority ORDERS fetch for a given request.
 *
 * Customer/zone: resolved via buildNarrowOrderFilter (direct CUSTNAME or zone→customer lookup).
 * Per-item (vendor/brand/product_type/product): resolved via the warm-cache reverse index
 *   (see services/resolve-customers-for-entity.ts + learnings/odata-any-lambda-support.md).
 *   The reverse index produces a discriminated CustomerResolution whose four branches map to:
 *     ok       → narrowFilter = CUSTNAME OR-chain from resolved custnames
 *     empty    → shortCircuitEmpty = true (skip the fetch)
 *     over-cap → narrowFilter = undefined (fall through to universal)
 *     no-index → narrowFilter = undefined (fall through to universal)
 */
export async function decideNarrowFilter(
  groupBy: Dimension,
  ids: string[],
  customers: RawCustomer[],
  period: string,
): Promise<NarrowDecision> {
  // Customer/zone: direct filter via the existing builder.
  let narrowFilter = buildNarrowOrderFilter(groupBy, ids, customers);

  const isPerItemDim = groupBy === 'vendor' || groupBy === 'brand'
    || groupBy === 'product_type' || groupBy === 'product';

  if (isPerItemDim && ids.length > 0) {
    const res = await resolveCustomersForEntity(groupBy, ids, period);
    if (res.kind === 'empty') {
      return { narrowFilter: undefined, shortCircuitEmpty: true };
    }
    if (res.kind === 'ok') {
      narrowFilter = custnameOrFilter(res.custnames);
    }
    // over-cap | no-index → narrowFilter stays undefined → universal path
  }

  return { narrowFilter, shortCircuitEmpty: false };
}
