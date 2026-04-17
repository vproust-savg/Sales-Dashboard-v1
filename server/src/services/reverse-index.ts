// FILE: server/src/services/reverse-index.ts
// PURPOSE: Per-item dimension reverse index — maps dim+entityId → CUSTNAMEs that ordered it.
//   Built during warm-cache (or on writeOrders) so per-item narrow requests can resolve to a
//   CUSTNAME OR-chain, reusing the existing customer narrow-fetch path.
// USED BY: server/src/cache/order-cache.ts, server/src/services/warm-cache.ts,
//   server/src/services/resolve-customers-for-entity.ts
// EXPORTS: buildReverseIndex, writeReverseIndex, readReverseIndex, ReverseIndex

import { redis } from '../cache/redis-client.js';
import { cacheKey } from '../cache/cache-keys.js';
import type { RawOrder } from './priority-queries.js';

/** Per-dim map of entityId → Set<CUSTNAME> serialized as deduped string[]. WHY string[] rather
 *  than Set<>: JSON-serializable, Redis-friendly, and the resolver works with arrays anyway. */
export interface ReverseIndex {
  vendor:       Record<string, string[]>;
  brand:        Record<string, string[]>;
  product_type: Record<string, string[]>;
  product:      Record<string, string[]>;
}

/** Walk the order universe once, bucket each item's dim value into a Set<CUSTNAME>.
 *  WHY a single pass: orders × items is the only loop needed; downstream dims share data. */
export function buildReverseIndex(orders: RawOrder[]): ReverseIndex {
  const vendor       = new Map<string, Set<string>>();
  const brand        = new Map<string, Set<string>>();
  const product_type = new Map<string, Set<string>>();
  const product      = new Map<string, Set<string>>();

  for (const order of orders) {
    const cust = order.CUSTNAME;
    if (!cust) continue; // defensive — real data always has CUSTNAME
    for (const item of order.ORDERITEMS_SUBFORM ?? []) {
      addTo(vendor,       item.Y_1159_5_ESH, cust);
      addTo(brand,        item.Y_9952_5_ESH, cust);
      addTo(product_type, item.Y_3020_5_ESH, cust);
      addTo(product,      item.PARTNAME,     cust);
    }
  }

  return {
    vendor:       toRecord(vendor),
    brand:        toRecord(brand),
    product_type: toRecord(product_type),
    product:      toRecord(product),
  };
}

/** Persist the reverse index as a single JSON blob. WHY single blob: ~240 KB for YTD,
 *  well under Upstash's 10 MB per-value limit, and one atomic read/write is simpler than
 *  four keys plus an index. */
export async function writeReverseIndex(period: string, idx: ReverseIndex, ttl: number): Promise<void> {
  await redis.set(cacheKey('revidx', period), JSON.stringify(idx), { ex: ttl });
}

/** Read the reverse index; returns null on cache miss.
 *  WHY typeof check: Upstash client can return either a JSON string or a pre-parsed object
 *  depending on SDK version. Handle both. */
export async function readReverseIndex(period: string): Promise<ReverseIndex | null> {
  const raw = await redis.get(cacheKey('revidx', period));
  if (raw === null || raw === undefined) return null;
  return typeof raw === 'string' ? (JSON.parse(raw) as ReverseIndex) : (raw as ReverseIndex);
}

function addTo(bucket: Map<string, Set<string>>, key: string | null | undefined, cust: string): void {
  if (!key) return; // skip null/empty dim values
  let set = bucket.get(key);
  if (!set) {
    set = new Set<string>();
    bucket.set(key, set);
  }
  set.add(cust);
}

function toRecord(bucket: Map<string, Set<string>>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, set] of bucket) {
    out[key] = [...set];
  }
  return out;
}
