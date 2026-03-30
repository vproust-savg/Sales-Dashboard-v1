// FILE: server/src/middleware/error-handler.ts
// PURPOSE: Global Express error handler — maps PriorityApiError to API responses
// USED BY: server/src/index.ts
// EXPORTS: errorHandler

import { Request, Response, NextFunction } from 'express';
import { PriorityApiError } from '../services/priority-client.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(`[ERROR] ${err.name}: ${err.message}`);

  if (err instanceof PriorityApiError) {
    res.status(err.statusCode >= 500 ? 502 : err.statusCode).json({
      error: { code: `PRIORITY_${err.statusCode}`, message: err.message, retryable: err.retryable },
    });
    return;
  }

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', retryable: true },
  });
}
