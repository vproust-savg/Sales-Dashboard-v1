// FILE: server/src/routes/__tests__/export.best-sellers.test.ts
// PURPOSE: Verify POST /api/sales/export/best-sellers returns a valid .xlsx
// USED BY: vitest

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';

function makeRow(rank: number) {
  return {
    rank,
    name: `Product ${rank}`,
    sku: `SKU-${rank}`,
    revenue: 1000 - rank,
    units: 10 + rank,
    unit: 'cs',
  };
}

function makeBody(topN: 20 | 50 | 100, rowCount: number) {
  return {
    rows: Array.from({ length: rowCount }, (_, i) => makeRow(i + 1)),
    context: {
      entityType: 'customer',
      entityLabel: 'Customer C7826 — Acme Foods',
      dateRangeLabel: 'Jan 1 2025 – Mar 31 2025',
      topN,
    },
  };
}

describe('POST /api/sales/export/best-sellers', () => {
  it('returns 200 with xlsx content-type for a valid 20-row body', async () => {
    const res = await request(app)
      .post('/api/sales/export/best-sellers')
      .send(makeBody(20, 20));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.byteLength).toBeGreaterThan(0);
  });
});
