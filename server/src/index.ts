// FILE: server/src/index.ts
// PURPOSE: Express server entry — mounts routes, applies middleware, starts listening
// USED BY: npm run dev, npm start, Dockerfile
// EXPORTS: app (for testing)

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { dashboardRouter } from './routes/dashboard.js';
import { contactsRouter } from './routes/contacts.js';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/error-handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

// Middleware
app.use(express.json());

// API routes
app.use('/api/sales', dashboardRouter);
app.use('/api/sales', contactsRouter);
app.use('/api', healthRouter);

// In production, serve the React client
if (env.NODE_ENV === 'production') {
  // WHY: rootDir=".." in tsconfig means compiled output lands at server/dist/server/src/index.js
  // __dirname at runtime = /app/server/dist/server/src/ — need 4 levels up to reach /app/
  const clientDist = path.join(__dirname, '../../../../client/dist');
  app.use(express.static(clientDist));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(env.PORT, () => {
  console.log(`[server] listening on port ${env.PORT} (${env.NODE_ENV})`);
});
