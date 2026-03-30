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

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
