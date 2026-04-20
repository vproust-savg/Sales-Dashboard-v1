// FILE: server/src/index.ts
// PURPOSE: Express server entry — mounts routes, applies middleware, starts listening
// USED BY: npm run dev, npm start, Dockerfile
// EXPORTS: app (for testing)

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { dashboardRouter } from './routes/dashboard.js';
import { entitiesRouter } from './routes/entities.js';
import { contactsRouter } from './routes/contacts.js';
import { filterOptionsRouter } from './routes/filter-options.js';
import { fetchAllRouter } from './routes/fetch-all.js';
import { cacheStatusRouter } from './routes/cache-status.js';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/error-handler.js';
import { warmEntityCache } from './services/warm-cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

// Middleware
app.use(express.json());

// WHY: Dashboard is iframe-embedded in Airtable; cross-origin requests may be needed.
// credentials: false because all Priority auth is server-to-server (no browser cookies).
const allowedOrigins = [
  'http://localhost:5173',
  process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : undefined,
].filter(Boolean) as string[];

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: false,
}));

// API routes
app.use('/api/sales', entitiesRouter);
app.use('/api/sales', dashboardRouter);
app.use('/api/sales', contactsRouter);
app.use('/api/sales', filterOptionsRouter);
app.use('/api/sales', fetchAllRouter);
app.use('/api/sales', cacheStatusRouter);
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

  // WHY: Warm cache runs in background after server starts accepting requests.
  // Failures are logged but don't crash the server.
  warmEntityCache().catch(err => {
    console.error('[warm-cache] Background warm failed:', err);
  });
});
