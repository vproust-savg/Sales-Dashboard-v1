// FILE: server/src/routes/cache-status.ts
// PURPOSE: GET /api/sales/cache-status — returns Redis cache metadata only, no Priority calls
// USED BY: client/hooks/useCacheStatus.ts (iframe-reload resilience)
// EXPORTS: cacheStatusRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { redis } from '../cache/redis-client.js';
import type { CacheStatus } from '@shared/types/dashboard';

const querySchema = z.object({
  period: z.string().default('ytd'),
});

export const cacheStatusRouter = Router();

/** WHY: Lightweight health check used by the client on mount (after Airtable iframe reload).
 * Returns whether raw orders are cached, without triggering any Priority API call. */
cacheStatusRouter.get('/cache-status', validateQuery(querySchema), async (_req, res, next) => {
  try {
    const { period } = res.locals.query as z.infer<typeof querySchema>;

    // WHY: Scan meta keys to discover which filter hashes have cached data for this period.
    const pattern = `orders:meta:${period}:*`;
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      const empty: CacheStatus = { raw: false, lastFetchDate: null, rowCount: 0, filterHashes: [] };
      return res.json(empty);
    }

    const entries = await Promise.all(keys.map(async (key) => {
      const raw = await redis.get(key);
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      // WHY: Key format is orders:meta:{period}:{filterHash} — filterHash starts at index 3
      const filterHash = key.split(':').slice(3).join(':');
      // WHY: New meta format stores {lastFetchDate, orderCount, filterHash} directly — no envelope wrapper.
      const data = parsed as { lastFetchDate: string; orderCount: number };
      return { filterHash, data };
    }));

    const valid = entries.filter((e): e is NonNullable<typeof e> => e !== null);
    if (valid.length === 0) {
      const empty: CacheStatus = { raw: false, lastFetchDate: null, rowCount: 0, filterHashes: [] };
      return res.json(empty);
    }

    // Sort by lastFetchDate descending, newest first
    valid.sort((a, b) => (b.data.lastFetchDate || '').localeCompare(a.data.lastFetchDate || ''));
    const newest = valid[0];

    const status: CacheStatus = {
      raw: true,
      lastFetchDate: newest.data.lastFetchDate,
      rowCount: newest.data.orderCount,
      filterHashes: valid.map(v => v.filterHash),
    };
    res.json(status);
  } catch (err) {
    next(err);
  }
});
