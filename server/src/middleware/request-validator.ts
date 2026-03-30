// FILE: server/src/middleware/request-validator.ts
// PURPOSE: Zod validation middleware for Express request query params
// USED BY: server/src/routes/dashboard.ts, server/src/routes/contacts.ts
// EXPORTS: validateQuery

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

// WHY: Express 5 made req.query read-only (getter). Store parsed result in res.locals.query.
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      res.locals.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: err.errors.map(e => e.message).join(', '), retryable: false },
        });
        return;
      }
      next(err);
    }
  };
}
