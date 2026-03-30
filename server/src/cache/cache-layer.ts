// FILE: server/src/cache/cache-layer.ts
// PURPOSE: Get-or-fetch pattern with Redis caching — spec Section 19.3
// USED BY: server/src/routes/dashboard.ts
// EXPORTS: cachedFetch

import { redis } from './redis-client.js';

interface CacheResult<T> {
  data: T;
  cached: boolean;
  cachedAt: string | null;
}

interface CacheEnvelope<T> {
  data: T;
  cachedAt: string;
}

/** Fetch from cache if available, otherwise call fetcher and cache the result */
export async function cachedFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<CacheResult<T>> {
  // Try cache first
  const raw = await redis.get(key);
  if (raw !== null) {
    const envelope: CacheEnvelope<T> = typeof raw === 'string' ? JSON.parse(raw) : raw as CacheEnvelope<T>;
    return { data: envelope.data, cached: true, cachedAt: envelope.cachedAt };
  }

  // Cache miss — fetch fresh data
  const data = await fetcher();
  const envelope: CacheEnvelope<T> = { data, cachedAt: new Date().toISOString() };
  await redis.set(key, JSON.stringify(envelope), { ex: ttlSeconds });

  return { data, cached: false, cachedAt: null };
}
