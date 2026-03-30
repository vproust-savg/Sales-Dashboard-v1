// FILE: server/src/config/env.ts
// PURPOSE: Zod-validated environment variables for Priority API + Redis + server
// USED BY: server/src/services/priority-client.ts, server/src/cache/redis-client.ts, server/src/index.ts
// EXPORTS: env

import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  // Priority ERP
  PRIORITY_BASE_URL: z.string().url(),
  PRIORITY_USERNAME: z.string().min(1),
  PRIORITY_PASSWORD: z.string().min(1),

  // Upstash Redis — WHY: env var names match @upstash/redis convention (REST_URL, REST_TOKEN)
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/** WHY try/catch — Zod throws on missing vars. Without this, Railway shows only
 *  "healthcheck failed" with zero diagnostic output because the process crashes
 *  before Express starts and the error goes to stderr which Railway deploy logs hide. */
function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`);
    console.error(`[env] Missing or invalid environment variables:\n${missing.join('\n')}`);
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
