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
    const pattern = `dashboard:orders_raw_meta:${period}:*`;
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      const empty: CacheStatus = { raw: false, lastFetchDate: null, rowCount: 0, filterHashes: [] };
      return res.json(empty);
    }

    // WHY: Load the most recently cached meta envelope. Multiple filter hashes may exist;
    // we report the newest one plus list all available filter hashes.
    const envelopes = await Promise.all(keys.map(async (key) => {
      const raw = await redis.get(key);
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const filterHash = key.split(':').slice(3).join(':');
      return { filterHash, envelope: parsed as { data: { lastFetchDate: string; rowCount: number } } };
    }));

    const valid = envelopes.filter((e): e is NonNullable<typeof e> => e !== null);
    if (valid.length === 0) {
      const empty: CacheStatus = { raw: false, lastFetchDate: null, rowCount: 0, filterHashes: [] };
      return res.json(empty);
    }

    // Sort by lastFetchDate descending, newest first
    valid.sort((a, b) => (b.envelope.data.lastFetchDate || '').localeCompare(a.envelope.data.lastFetchDate || ''));
    const newest = valid[0];

    const status: CacheStatus = {
      raw: true,
      lastFetchDate: newest.envelope.data.lastFetchDate,
      rowCount: newest.envelope.data.rowCount,
      filterHashes: valid.map(v => v.filterHash),
    };
    res.json(status);
  } catch (err) {
    next(err);
  }
});
