// FILE: server/src/routes/health.ts
// PURPOSE: GET /api/health — liveness check for Railway
// USED BY: Railway health checks, monitoring
// EXPORTS: healthRouter

import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
