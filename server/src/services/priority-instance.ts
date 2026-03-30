// FILE: server/src/services/priority-instance.ts
// PURPOSE: Module-scoped PriorityClient singleton — rate limiter state shared across all requests
// USED BY: server/src/routes/dashboard.ts, server/src/routes/contacts.ts
// EXPORTS: priorityClient

import { PriorityClient } from './priority-client.js';
import { env } from '../config/env.js';

// WHY: Creating one instance per request (the old pattern) gave each request its own
// requestTimestamps array, defeating rate limiting. A singleton shares the array.
export const priorityClient = new PriorityClient({
  baseUrl: env.PRIORITY_BASE_URL,
  username: env.PRIORITY_USERNAME,
  password: env.PRIORITY_PASSWORD,
});
