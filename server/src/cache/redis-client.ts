// FILE: server/src/cache/redis-client.ts
// PURPOSE: Upstash Redis connection singleton
// USED BY: server/src/cache/cache-layer.ts
// EXPORTS: redis

import { Redis } from '@upstash/redis';
import { env } from '../config/env.js';

// WHY: env vars are UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (not UPSTASH_REDIS_URL)
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});
