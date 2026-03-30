// FILE: server/tests/routes/dashboard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// WHY: We mock the Priority client and cache to test route logic in isolation.
// Integration tests against the real API live in a separate test suite.

vi.mock('../../src/cache/redis-client', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}));

// Mock fetch for Priority client
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import request from 'supertest';
import { app } from '../../src/index';

// WHY: Each fetch() call consumes the Response body once. Dashboard route calls fetch 3+ times
// via Promise.all, so we must return a fresh Response per call (not a shared instance).
function emptyODataResponse() {
  return new Response(JSON.stringify({ value: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

describe('GET /api/sales/dashboard', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(() => Promise.resolve(emptyODataResponse()));
  });

  it('returns 200 with valid groupBy and period', async () => {
    const res = await request(app)
      .get('/api/sales/dashboard?groupBy=customer&period=ytd')
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.entities).toBeInstanceOf(Array);
    expect(res.body.data.kpis).toBeDefined();
    expect(res.body.meta.dimension).toBe('customer');
    expect(res.body.meta.period).toBe('ytd');
  });

  it('returns 400 for invalid groupBy', async () => {
    await request(app)
      .get('/api/sales/dashboard?groupBy=invalid')
      .expect(400);
  });

  it('defaults to customer + ytd when no params', async () => {
    const res = await request(app)
      .get('/api/sales/dashboard')
      .expect(200);

    expect(res.body.meta.dimension).toBe('customer');
    expect(res.body.meta.period).toBe('ytd');
  });
});

describe('GET /api/sales/contacts', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(() => Promise.resolve(emptyODataResponse()));
  });

  it('returns 200 with valid customerId', async () => {
    const res = await request(app)
      .get('/api/sales/contacts?customerId=C001')
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('returns 400 without customerId', async () => {
    await request(app)
      .get('/api/sales/contacts')
      .expect(400);
  });
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    expect(res.body.status).toBe('ok');
  });
});
