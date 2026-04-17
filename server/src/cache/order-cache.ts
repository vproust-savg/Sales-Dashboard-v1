// FILE: server/src/cache/order-cache.ts
// PURPOSE: Per-order Redis caching — write/read/delete with all-or-nothing semantics.
//   Replaces bulk array caching that exceeds Upstash's 10 MB limit.
// USED BY: server/src/routes/fetch-all.ts
// EXPORTS: writeOrders, readOrders, deleteOrderIndex, CachedOrders

import { redis } from './redis-client.js';
import { orderKey, orderIndexKey, orderMetaKey } from './cache-keys.js';
import { ORDER_PIPELINE_BATCH, CACHE_TTLS } from '../config/constants.js';
import type { RawOrder } from '../services/priority-queries.js';
import { buildReverseIndex, writeReverseIndex } from '../services/reverse-index.js';

/** WHY: 365 days — same as orders_raw TTL. Individual order keys are shared across periods. */
const ORDER_KEY_TTL = CACHE_TTLS.orders_raw;

/** Read result from readOrders — null means cache miss (index missing or corruption). */
export interface CachedOrders {
  orders: RawOrder[];
  meta: { lastFetchDate: string; orderCount: number; filterHash: string };
}

/** Write orders to Redis as individual keys + publish index/meta.
 *  All-or-nothing: if ANY pipeline batch fails, index/meta are NOT published.
 *  WHY: Partial index would produce permanently wrong KPIs (Codex finding #1). */
export async function writeOrders(
  orders: RawOrder[],
  period: string,
  filterHash: string,
  indexTtl: number,
): Promise<boolean> {
  if (orders.length === 0) {
    // WHY: Empty order set is valid (e.g., new agent with no sales). Still write index/meta.
    await redis.set(orderIndexKey(period, filterHash), JSON.stringify([]), { ex: indexTtl });
    await redis.set(orderMetaKey(period, filterHash), JSON.stringify({
      lastFetchDate: new Date().toISOString(),
      orderCount: 0,
      filterHash,
    }), { ex: indexTtl });
    return true;
  }

  // Phase 1: Write individual orders in pipeline batches
  let allBatchesSucceeded = true;
  for (let i = 0; i < orders.length; i += ORDER_PIPELINE_BATCH) {
    const batch = orders.slice(i, i + ORDER_PIPELINE_BATCH);
    try {
      const pipeline = redis.pipeline();
      for (const order of batch) {
        pipeline.set(orderKey(order.ORDNAME), JSON.stringify(order), { ex: ORDER_KEY_TTL });
      }
      await pipeline.exec();
    } catch (err) {
      console.error(`[order-cache] Pipeline batch ${i}-${i + batch.length} failed:`, err instanceof Error ? err.message : err);
      allBatchesSucceeded = false;
      break;
    }
  }

  // Phase 2: Only publish index + meta if ALL batches succeeded
  if (!allBatchesSucceeded) {
    console.warn(`[order-cache] Skipping index/meta publish — partial write for ${period}:${filterHash}`);
    return false;
  }

  const ordnames = orders.map(o => o.ORDNAME);
  await redis.set(orderIndexKey(period, filterHash), JSON.stringify(ordnames), { ex: indexTtl });
  await redis.set(orderMetaKey(period, filterHash), JSON.stringify({
    lastFetchDate: new Date().toISOString(),
    orderCount: orders.length,
    filterHash,
  }), { ex: indexTtl });

  // WHY filterHash === 'all': the reverse index maps dim+id → CUSTNAMEs across the FULL
  // universe. Writing it from a narrowed subset would silently produce an incomplete index
  // that misleads per-item resolvers. Only the universal 'all' write refreshes it.
  if (filterHash === 'all') {
    await writeReverseIndex(period, buildReverseIndex(orders), indexTtl);
  }

  console.log(`[order-cache] Wrote ${orders.length} orders in ${Math.ceil(orders.length / ORDER_PIPELINE_BATCH)} batches for ${period}:${filterHash}`);
  return true;
}

/** Read orders from per-order Redis keys via the index.
 *  Full-or-miss: if ANY indexed order key is missing, returns null (cache corruption).
 *  WHY: Partial data produces silently wrong KPIs (Codex finding #1). */
export async function readOrders(period: string, filterHash: string): Promise<CachedOrders | null> {
  // Read index
  const indexRaw = await redis.get(orderIndexKey(period, filterHash));
  if (indexRaw === null) return null;

  const ordnames: string[] = typeof indexRaw === 'string' ? JSON.parse(indexRaw) : indexRaw as string[];
  if (ordnames.length === 0) {
    // WHY: Empty index is valid (agent with no sales). Read meta for completeness.
    const metaRaw = await redis.get(orderMetaKey(period, filterHash));
    const meta = metaRaw
      ? (typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw) as CachedOrders['meta']
      : { lastFetchDate: new Date().toISOString(), orderCount: 0, filterHash };
    return { orders: [], meta };
  }

  // Read orders in MGET batches
  const allOrders: RawOrder[] = [];
  for (let i = 0; i < ordnames.length; i += ORDER_PIPELINE_BATCH) {
    const batchIds = ordnames.slice(i, i + ORDER_PIPELINE_BATCH);
    const keys = batchIds.map(id => orderKey(id));
    const results = await redis.mget<(string | null)[]>(...keys);

    // Validate completeness — any null = corruption
    const nullCount = results.filter(r => r === null).length;
    if (nullCount > 0) {
      console.warn(`[order-cache] ${nullCount}/${batchIds.length} orders missing in batch ${i}-${i + batchIds.length} for ${period}:${filterHash} — treating as cache miss`);
      return null;
    }

    for (const raw of results) {
      allOrders.push(typeof raw === 'string' ? JSON.parse(raw) as RawOrder : raw as unknown as RawOrder);
    }
  }

  // Read meta
  const metaRaw = await redis.get(orderMetaKey(period, filterHash));
  const meta = metaRaw
    ? (typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw) as CachedOrders['meta']
    : { lastFetchDate: new Date().toISOString(), orderCount: allOrders.length, filterHash };

  return { orders: allOrders, meta };
}

/** Delete index + meta for a period/filter scope. Individual order keys are NOT deleted
 *  (they're shared across scopes and expire via TTL). */
export async function deleteOrderIndex(period: string, filterHash: string): Promise<void> {
  await Promise.all([
    redis.del(orderIndexKey(period, filterHash)),
    redis.del(orderMetaKey(period, filterHash)),
  ]);
}
