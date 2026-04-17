// FILE: server/src/services/resolve-customers-for-entity.ts
// PURPOSE: For per-item dimensions (vendor/brand/product_type/product), resolve the
//   selected entity ids to the set of CUSTNAMEs that ever ordered them, so the route
//   layer can narrow the ORDERS fetch using the existing CUSTNAME OR-chain path.
//   Priority's OData does not support any() or standalone ORDERITEMS — see
//   learnings/odata-any-lambda-support.md — so the reverse index is the only path.
// USED BY: server/src/routes/dashboard.ts, server/src/routes/fetch-all.ts
// EXPORTS: resolveCustomersForEntity, CustomerResolution, MAX_CUSTNAMES_PER_NARROW

import { readReverseIndex } from './reverse-index.js';
import type { ReverseIndex } from './reverse-index.js';

/** Per-item dimensions — the four whose discriminator fields live on ORDERITEMS_SUBFORM. */
export type PerItemDim = 'vendor' | 'brand' | 'product_type' | 'product';

/** Discriminated result so callers can branch without re-inspecting arrays.
 *  - ok      → narrow via CUSTNAME OR-chain
 *  - empty   → short-circuit with an empty response (don't pay the 6-min cold cost)
 *  - over-cap→ too many customers to put on one URL; fall through to universal
 *  - no-index→ warm-cache hasn't populated the index yet; fall through to universal */
export type CustomerResolution =
  | { kind: 'ok';       custnames: string[] }
  | { kind: 'empty' }
  | { kind: 'over-cap'; count: number }
  | { kind: 'no-index' };

/** WHY 500: the resulting OR-chain is ~50KB; Priority tolerates long URLs but we haven't
 *  stress-tested >500 terms. Over-cap falls through to the universal path, which is the
 *  pre-existing behavior for per-item dims — no regression for extreme cases. */
export const MAX_CUSTNAMES_PER_NARROW = 500;

export async function resolveCustomersForEntity(
  dim: PerItemDim,
  ids: string[],
  period: string,
): Promise<CustomerResolution> {
  if (ids.length === 0) return { kind: 'empty' };

  const idx = await readReverseIndex(period);
  if (!idx) return { kind: 'no-index' };

  const bucket = bucketForDim(idx, dim);
  const union = new Set<string>();
  for (const id of ids) {
    const custs = bucket[id];
    if (custs) for (const c of custs) union.add(c);
  }

  if (union.size === 0) return { kind: 'empty' };
  if (union.size > MAX_CUSTNAMES_PER_NARROW) return { kind: 'over-cap', count: union.size };
  return { kind: 'ok', custnames: [...union] };
}

function bucketForDim(idx: ReverseIndex, dim: PerItemDim): Record<string, string[]> {
  switch (dim) {
    case 'vendor':       return idx.vendor;
    case 'brand':        return idx.brand;
    case 'product_type': return idx.product_type;
    case 'product':      return idx.product;
  }
}
