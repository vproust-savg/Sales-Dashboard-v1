// FILE: server/src/routes/export.ts
// PURPOSE: Export endpoints — currently just best-sellers .xlsx
// USED BY: server/src/index.ts
// EXPORTS: exportRouter

import { Router } from 'express';
import { z } from 'zod';
import { buildBestSellersWorkbook } from '../services/best-sellers-workbook.js';

const topSellerRowSchema = z.object({
  rank: z.number().int().nonnegative(),
  name: z.string(),
  sku: z.string(),
  revenue: z.number(),
  units: z.number(),
  unit: z.string(),
});

const bestSellersExportSchema = z.object({
  rows: z.array(topSellerRowSchema).max(100),
  context: z.object({
    entityType: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']),
    entityLabel: z.string().min(1),
    dateRangeLabel: z.string().min(1),
    topN: z.union([z.literal(20), z.literal(50), z.literal(100)]),
  }),
});

export const exportRouter = Router();

/** WHY POST not GET: request carries a list of rows (~100) + context that may exceed
 *  query-string length, and POST is the conventional verb for "produce a file". */
exportRouter.post('/export/best-sellers', async (req, res, next) => {
  try {
    const parsed = bestSellersExportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
      return;
    }

    const wb = buildBestSellersWorkbook(parsed.data);
    const filename = buildFilename(parsed.data.context);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

/** Build a deterministic filename: best-sellers-{slug}-{topN}-{YYYYMMDD}.xlsx
 *  Slug: combine entityType + entityLabel, lowercase, alphanumerics + dashes only,
 *  collapse runs of dashes, trim. Keeps multi-customer / multi-entity selections
 *  distinguishable while staying file-system-safe. */
function buildFilename(context: { entityType: string; entityLabel: string; topN: number }): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  // WHY trim AFTER slice: if the normalized slug exceeds 80 chars and char 80 falls
  // mid-dash-run, slicing first then trimming removes any trailing dash the cut
  // introduced (e.g., "...long-name-" -> "...long-name").
  const slug = (`${context.entityType}-${context.entityLabel}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80)
    .replace(/^-+|-+$/g, '')) || 'export';
  return `best-sellers-${slug}-${context.topN}-${date}.xlsx`;
}
