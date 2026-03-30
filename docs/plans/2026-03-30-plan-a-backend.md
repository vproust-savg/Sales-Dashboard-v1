# Plan A: Backend — Express + Priority ERP + Redis Cache

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Express backend that fetches sales data from Priority ERP's OData API, aggregates it into dashboard-ready payloads, and caches results in Upstash Redis.

**Architecture:** Express server with 3 API routes. A Priority OData client handles authentication, pagination (including MAXAPILINES cursor), rate limiting, and both error response formats. A data aggregation layer transforms raw orders + items into KPIs, monthly breakdowns, product mix, and rankings. Redis sits between Express and Priority — cache-first with per-entity TTLs and stale-while-revalidate.

**Tech Stack:** Express 5, TypeScript strict, Zod validation, Upstash Redis (`@upstash/redis`), Vitest for testing

**Spec reference:** `docs/specs/2026-03-29-sales-dashboard-design.md` — Sections 10 (formulas), 17 (OData queries), 18 (field mapping), 19 (caching)

**Depends on:** Plan 0 (shared foundation — creates shared/types and shared/utils)
**Produces:** Working API at `localhost:3001` that the frontend (Plan B+C) consumes

> **Tasks 1-2 moved to Plan 0.** Shared types (`dashboard.ts`, `api-responses.ts`) and shared utils (`formatting.ts`) are now created by `docs/plans/2026-03-30-plan-0-shared-foundation.md` before this plan starts. **Skip Tasks 1-2** — they are already complete. Start at Task 0 (server scaffolding), then proceed to Task 3.

---

## File Structure

```
shared/
  types/
    dashboard.ts          — KPI, entity list, chart, table types shared between server + client
    api-responses.ts      — API response envelope: { data, meta, error }
  utils/
    formatting.ts         — Currency, percentage, date formatting (used by both server aggregation + client display)

server/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts              — Express server entry, mounts routes, starts listening
    config/
      env.ts              — Zod-validated env vars (PRIORITY_*, REDIS_*, PORT)
      constants.ts        — API limits, page sizes, TTLs, field lists
    services/
      priority-client.ts  — HTTP client: auth, headers, pagination, rate limiting, error parsing
      priority-queries.ts — OData URL builders for each entity (orders, customers, zones, agents, vendors)
      data-aggregator.ts  — Raw orders → dashboard payload (KPIs, monthly, product mix, top 10, tables)
      dimension-grouper.ts — Groups aggregated data by dimension (customer/zone/vendor/brand/prodtype/product)
    cache/
      redis-client.ts     — Upstash Redis connection singleton
      cache-keys.ts       — Key schema + TTL map
      cache-layer.ts      — get-or-fetch pattern with stale-while-revalidate
    routes/
      dashboard.ts        — GET /api/sales/dashboard?groupBy=customer&period=ytd
      contacts.ts         — GET /api/sales/contacts?customerId=C00001
      health.ts           — GET /api/health
    middleware/
      error-handler.ts    — Express error middleware (both Priority error formats)
      request-validator.ts — Zod middleware for query params
  tests/
    services/
      priority-client.test.ts
      data-aggregator.test.ts
      dimension-grouper.test.ts
    cache/
      cache-layer.test.ts
    routes/
      dashboard.test.ts
      contacts.test.ts
```

**File size rule (from CLAUDE.md):** Every file under 200 lines. Split at 250.

**Intent block rule:** Every file starts with `// FILE: ... PURPOSE: ... USED BY: ... EXPORTS: ...`

---

## Task 0: Project Scaffolding

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`

- [ ] **Step 1: Initialize server package.json**

```json
{
  "name": "sales-dashboard-server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "express": "^5.1.0",
    "zod": "^3.24.0",
    "@upstash/redis": "^1.34.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src/**/*", "../shared/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create server/vitest.config.ts**

```typescript
// FILE: server/vitest.config.ts
// PURPOSE: Vitest configuration for backend tests
// USED BY: `npm test` command
// EXPORTS: Vitest config

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `cd server && npm install`
Expected: `node_modules/` created, `package-lock.json` generated, 0 errors

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/tsconfig.json server/vitest.config.ts server/package-lock.json
git commit -m "chore(server): scaffold Express backend with TypeScript + Vitest"
```

---

## Task 1: Shared Types — Dashboard Data Shapes

**Files:**
- Create: `shared/types/dashboard.ts`
- Create: `shared/types/api-responses.ts`

- [ ] **Step 1: Write shared/types/dashboard.ts**

These types are the contract between server and client. Every field maps to a spec section.

```typescript
// FILE: shared/types/dashboard.ts
// PURPOSE: Shared types for dashboard data exchanged between server and client
// USED BY: server/services/data-aggregator.ts, client/hooks/useDashboardData.ts
// EXPORTS: DashboardPayload, EntityListItem, KPIs, MonthlyRevenue, ProductMixSegment, TopSellerItem, OrderRow, ItemCategory, Contact

/** One entity in the left-panel list (customer, zone, vendor, brand, product type, or product) */
export interface EntityListItem {
  id: string;
  name: string;
  meta1: string;        // Line 2 left (e.g., zone + rep, or SKU + brand)
  meta2: string;        // Line 2 right (e.g., "22 orders")
  revenue: number;      // For sort + display
  orderCount: number;   // For sort + display
}

/** KPI values for the right panel — spec Section 10.1 */
export interface KPIs {
  totalRevenue: number;
  prevYearRevenue: number;
  revenueChangePercent: number | null;  // null when no prev year
  revenueChangeAmount: number;
  thisQuarterRevenue: number;
  lastQuarterRevenue: number;
  bestMonth: { name: string; amount: number };
  orders: number;
  ordersChange: number;          // vs prev quarter
  avgOrder: number | null;       // null when 0 orders
  marginPercent: number | null;
  marginAmount: number;
  marginChangepp: number | null; // percentage points vs prev year
  frequency: number | null;      // orders/month, null when 0 months
  frequencyChange: number | null;
  lastOrderDays: number | null;  // null when no orders
  fillRate: number | null;       // 0-100, null when no items ordered
  fillRateChangepp: number | null;
}

/** One month in the YoY bar chart — spec Section 20.1 */
export interface MonthlyRevenue {
  month: string;           // "Jan", "Feb", etc.
  monthIndex: number;      // 0-11
  currentYear: number;     // Revenue this period
  previousYear: number;    // Revenue prev period
}

/** One segment in the Product Mix donut — spec Section 20.2 */
export interface ProductMixSegment {
  category: string;
  value: number;
  percentage: number;
}

/** One item in the Top 10 Best Sellers — spec Section 22.5 */
export interface TopSellerItem {
  rank: number;
  name: string;
  sku: string;
  revenue: number;
  units: number;
}

/** KPI sparkline data — spec Section 20.3 */
export interface SparklineData {
  values: number[];  // 6 monthly values, most recent last
}

/** One order row in the Orders tab — spec Section 13.6 */
export interface OrderRow {
  date: string;           // ISO date
  orderNumber: string;
  itemCount: number;
  amount: number;
  marginPercent: number;
  marginAmount: number;
  status: 'Delivered' | 'Pending' | 'Processing';
}

/** Category + products for the Items tab accordion — spec Section 4.4 */
export interface ItemCategory {
  category: string;
  totalValue: number;
  marginPercent: number;
  marginAmount: number;
  itemCount: number;
  products: ItemProduct[];
}

export interface ItemProduct {
  name: string;
  sku: string;
  value: number;
  marginPercent: number;
  marginAmount: number;
}

/** Contact in the Contacts tab — spec Section 18.4 */
export interface Contact {
  fullName: string;
  position: string;
  phone: string;
  email: string;
}

/** Available dimensions — spec Section 5 */
export type Dimension = 'customer' | 'zone' | 'vendor' | 'brand' | 'product_type' | 'product';

/** Period selection */
export type Period = 'ytd' | string;  // 'ytd' or a year like '2025'

/** The full dashboard payload returned by GET /api/sales/dashboard */
export interface DashboardPayload {
  entities: EntityListItem[];
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMix: ProductMixSegment[];
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: ItemCategory[];
  yearsAvailable: string[];
}
```

- [ ] **Step 2: Write shared/types/api-responses.ts**

```typescript
// FILE: shared/types/api-responses.ts
// PURPOSE: API response envelope types for all endpoints
// USED BY: server/routes/*.ts, client/hooks/*.ts
// EXPORTS: ApiResponse, ApiError

export interface ApiResponse<T> {
  data: T;
  meta: {
    cached: boolean;
    cachedAt: string | null;  // ISO timestamp when cached
    period: string;
    dimension: string;
    entityCount: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd server && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add shared/types/dashboard.ts shared/types/api-responses.ts
git commit -m "feat(shared): add dashboard data types and API response envelope"
```

---

## Task 2: Shared Utils — Number Formatting

**Files:**
- Create: `shared/utils/formatting.ts`
- Create: `server/tests/shared/formatting.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// FILE: server/tests/shared/formatting.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatPercentPoints,
  formatFrequency,
  formatDays,
  formatDate,
  formatDateShort,
} from '@shared/utils/formatting';

describe('formatCurrency', () => {
  it('formats >= $1K with no decimals', () => {
    expect(formatCurrency(240200)).toBe('$240,200');
    expect(formatCurrency(7506)).toBe('$7,506');
  });
  it('formats < $1K with 2 decimals', () => {
    expect(formatCurrency(0.85)).toBe('$0.85');
    expect(formatCurrency(999.99)).toBe('$999.99');
  });
  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });
  it('formats negative values', () => {
    expect(formatCurrency(-8100)).toBe('-$8,100');
  });
  it('formats with explicit + sign when showSign is true', () => {
    expect(formatCurrency(26400, { showSign: true })).toBe('+$26,400');
    expect(formatCurrency(-8100, { showSign: true })).toBe('-$8,100');
  });
});

describe('formatCurrencyCompact', () => {
  it('formats thousands as K', () => {
    expect(formatCurrencyCompact(30000)).toBe('$30K');
    expect(formatCurrencyCompact(15500)).toBe('$15.5K');
  });
  it('formats millions as M', () => {
    expect(formatCurrencyCompact(1200000)).toBe('$1.2M');
  });
  it('formats billions as B', () => {
    expect(formatCurrencyCompact(1234567890)).toBe('$1.2B');
  });
  it('formats small values normally', () => {
    expect(formatCurrencyCompact(500)).toBe('$500');
  });
});

describe('formatPercent', () => {
  it('formats with one decimal', () => {
    expect(formatPercent(18.4)).toBe('18.4%');
    expect(formatPercent(0)).toBe('0.0%');
  });
  it('formats with sign when requested', () => {
    expect(formatPercent(12.4, { showSign: true })).toBe('+12.4%');
    expect(formatPercent(-5.2, { showSign: true })).toBe('-5.2%');
  });
});

describe('formatPercentPoints', () => {
  it('formats with pp suffix', () => {
    expect(formatPercentPoints(1.8)).toBe('+1.8pp');
    expect(formatPercentPoints(-1.2)).toBe('-1.2pp');
  });
});

describe('formatFrequency', () => {
  it('formats with /mo suffix', () => {
    expect(formatFrequency(2.7)).toBe('2.7/mo');
  });
  it('handles null', () => {
    expect(formatFrequency(null)).toBe('\u2014'); // em dash
  });
});

describe('formatDays', () => {
  it('formats 0 as Today', () => {
    expect(formatDays(0)).toBe('Today');
  });
  it('formats 1 as singular', () => {
    expect(formatDays(1)).toBe('1 day');
  });
  it('formats plural', () => {
    expect(formatDays(4)).toBe('4 days');
  });
  it('handles null', () => {
    expect(formatDays(null)).toBe('No orders');
  });
});

describe('formatDate', () => {
  it('formats as MMM DD, YYYY', () => {
    expect(formatDate('2026-03-28T00:00:00Z')).toBe('Mar 28, 2026');
  });
});

describe('formatDateShort', () => {
  it('formats as MMM YYYY', () => {
    expect(formatDateShort('2021-01-15T00:00:00Z')).toBe('Jan 2021');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run tests/shared/formatting.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// FILE: shared/utils/formatting.ts
// PURPOSE: Number, currency, date formatting shared between server + client
// USED BY: server/services/data-aggregator.ts, client/components/**
// EXPORTS: formatCurrency, formatCurrencyCompact, formatPercent, formatPercentPoints, formatFrequency, formatDays, formatDate, formatDateShort

interface FormatOptions {
  showSign?: boolean;
}

const EM_DASH = '\u2014';

export function formatCurrency(value: number, opts?: FormatOptions): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : opts?.showSign && value > 0 ? '+' : '';
  if (abs === 0) return '$0';
  if (abs < 1000) return `${sign}$${abs.toFixed(2)}`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return k % 1 === 0 ? `$${k}K` : `$${k.toFixed(1)}K`;
  }
  return `$${abs}`;
}

export function formatPercent(value: number, opts?: FormatOptions): string {
  const sign = opts?.showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatPercentPoints(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}pp`;
}

export function formatFrequency(value: number | null): string {
  if (value === null) return EM_DASH;
  return `${value.toFixed(1)}/mo`;
}

export function formatDays(value: number | null): string {
  if (value === null) return 'No orders';
  if (value === 0) return 'Today';
  if (value === 1) return '1 day';
  return `${value} days`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run tests/shared/formatting.test.ts`
Expected: All 16 tests PASS

- [ ] **Step 5: Commit**

```bash
git add shared/utils/formatting.ts server/tests/shared/formatting.test.ts
git commit -m "feat(shared): add currency, percent, date formatting utilities with tests"
```

---

## Task 3: Server Config — Environment Variables

**Files:**
- Create: `server/src/config/env.ts`
- Create: `server/src/config/constants.ts`
- Create: `server/.env.example`

- [ ] **Step 1: Write server/src/config/env.ts**

```typescript
// FILE: server/src/config/env.ts
// PURPOSE: Zod-validated environment variables for Priority API + Redis + server
// USED BY: server/src/services/priority-client.ts, server/src/cache/redis-client.ts, server/src/index.ts
// EXPORTS: env

import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  // Priority ERP
  PRIORITY_BASE_URL: z.string().url(),         // e.g., https://us.priority-connect.online/odata/Priority/tabc.ini/mycompany
  PRIORITY_USERNAME: z.string().min(1),
  PRIORITY_PASSWORD: z.string().min(1),

  // Upstash Redis
  UPSTASH_REDIS_URL: z.string().url(),
  UPSTASH_REDIS_TOKEN: z.string().min(1),

  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
```

- [ ] **Step 2: Write server/src/config/constants.ts**

```typescript
// FILE: server/src/config/constants.ts
// PURPOSE: API limits, pagination, cache TTLs, field lists for Priority OData queries
// USED BY: server/src/services/priority-client.ts, server/src/services/priority-queries.ts, server/src/cache/cache-keys.ts
// EXPORTS: API_LIMITS, PAGE_SIZE, CACHE_TTLS, ORDER_FIELDS, ORDERITEM_FIELDS, CUSTOMER_FIELDS, etc.

/** Priority API fair usage limits — spec Section 17.5 */
export const API_LIMITS = {
  CALLS_PER_MINUTE: 100,
  MAX_QUEUED: 15,
  REQUEST_TIMEOUT_MS: 170_000,  // 2m50s (under Priority's 3m hard limit)
  MAX_RETRIES: 3,
} as const;

/** Pagination — spec Section 17.4 */
export const PAGE_SIZE = 5000;
export const MAXAPILINES = 50_000;  // Current instance setting

/** Redis cache TTLs in seconds — spec Section 19.2 */
export const CACHE_TTLS = {
  orders_ytd: 15 * 60,       // 15 min
  orders_year: 24 * 60 * 60, // 24 hours
  customers: 60 * 60,        // 1 hour
  zones: 24 * 60 * 60,       // 24 hours
  agents: 60 * 60,           // 1 hour
  vendors: 24 * 60 * 60,     // 24 hours
  contacts: 30 * 60,         // 30 min
  years_available: 60 * 60,  // 1 hour
} as const;

/** Priority ORDERS fields — spec Section 18.1 */
export const ORDER_SELECT = [
  'ORDNAME', 'CURDATE', 'ORDSTATUSDES', 'TOTPRICE',
  'CUSTNAME', 'CUSTDES', 'AGENTCODE', 'AGENTDES',
].join(',');

/** Priority ORDERITEMS_SUBFORM fields — spec Section 18.2 */
export const ORDERITEM_SELECT = [
  'PARTDES', 'PARTNAME', 'TQUANT', 'QPRICE', 'PRICE',
  'PURCHASEPRICE', 'COST', 'QPROFIT', 'PERCENT',
  'Y_1159_5_ESH', 'Y_1530_5_ESH', 'Y_9952_5_ESH',
  'Y_3020_5_ESH', 'Y_3021_5_ESH', 'Y_17936_5_ESH',
].join(',');

/** Lighter set for previous-year queries (only what's needed for trends) */
export const ORDERITEM_SELECT_PREV = [
  'PARTNAME', 'QPRICE', 'QPROFIT', 'Y_9952_5_ESH', 'Y_3021_5_ESH',
].join(',');

/** Priority CUSTOMERS fields — spec Section 18.3 */
export const CUSTOMER_SELECT = [
  'CUSTNAME', 'CUSTDES', 'ZONECODE', 'ZONEDES',
  'AGENTCODE', 'AGENTDES', 'CREATEDDATE', 'CTYPECODE', 'CTYPEDES',
].join(',');

/** Priority CUSTPERSONNEL_SUBFORM fields — spec Section 18.4 */
export const CONTACT_SELECT = [
  'NAME', 'POSITIONDES', 'PHONENUM', 'CELLPHONE', 'EMAIL', 'INACTIVE',
].join(',');

/** Order status mapping — spec Section 10.4 */
export const ORDER_STATUS_MAP: Record<string, 'Delivered' | 'Pending' | 'Processing'> = {
  Closed: 'Delivered',
  'Partially Filled': 'Pending',
  Open: 'Processing',
};

/** Statuses to exclude from dashboard — spec Section 10.4 */
export const EXCLUDED_STATUSES = ['Canceled'];
```

- [ ] **Step 3: Write .env.example**

```
# Priority ERP
PRIORITY_BASE_URL=https://us.priority-connect.online/odata/Priority/tabc.ini/mycompany
PRIORITY_USERNAME=your_username
PRIORITY_PASSWORD=your_password

# Upstash Redis
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your_token

# Server
PORT=3001
NODE_ENV=development
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd server && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add server/src/config/env.ts server/src/config/constants.ts server/.env.example
git commit -m "feat(server): add Zod-validated env config and Priority API constants"
```

---

## Task 4: Priority OData Client — HTTP Layer

**Files:**
- Create: `server/src/services/priority-client.ts`
- Create: `server/tests/services/priority-client.test.ts`

This is the most critical file. It handles:
- HTTP Basic Auth with required headers (`IEEE754Compatible: true`)
- Rate limiting (100 calls/min shared)
- Cursor-based pagination for MAXAPILINES
- Both Priority error response formats
- URL encoding trap (no `searchParams.set` for `$expand`)

- [ ] **Step 1: Write failing tests for the Priority client**

```typescript
// FILE: server/tests/services/priority-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriorityClient, PriorityApiError } from '../../src/services/priority-client';

// WHY: We mock fetch to avoid hitting the real Priority API in tests.
// Tests verify URL construction, header inclusion, pagination, and error parsing.
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeClient() {
  return new PriorityClient({
    baseUrl: 'https://test.priority.com/odata/Priority/test.ini/co',
    username: 'user',
    password: 'pass',
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('PriorityClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('headers', () => {
    it('includes IEEE754Compatible and Basic Auth on every request', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));
      const client = makeClient();
      await client.fetchEntity('ORDERS', { select: 'ORDNAME', top: 10 });

      const [url, init] = mockFetch.mock.calls[0];
      expect(init.headers['IEEE754Compatible']).toBe('true');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers['Prefer']).toBe('odata.maxpagesize=49900');
      expect(init.headers['Authorization']).toMatch(/^Basic /);
    });
  });

  describe('URL construction', () => {
    it('builds correct OData URL with $select, $filter, $top, $skip', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));
      const client = makeClient();
      await client.fetchEntity('ORDERS', {
        select: 'ORDNAME,CURDATE',
        filter: "CURDATE ge 2026-01-01T00:00:00Z",
        top: 500,
        skip: 0,
        orderby: 'ORDNAME asc',
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/ORDERS?');
      expect(url).toContain('$select=ORDNAME,CURDATE');
      expect(url).toContain('$filter=CURDATE%20ge%202026-01-01T00:00:00Z');
      expect(url).toContain('$top=500');
      expect(url).toContain('$skip=0');
      expect(url).toContain('$orderby=ORDNAME%20asc');
    });

    it('appends $expand as raw string (not form-encoded)', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));
      const client = makeClient();
      await client.fetchEntity('ORDERS', {
        select: 'ORDNAME',
        top: 10,
        expand: 'ORDERITEMS_SUBFORM($select=PARTNAME,QPRICE)',
      });

      const url = mockFetch.mock.calls[0][0] as string;
      // WHY: URL.searchParams.set() would encode ( ) $ = which breaks Priority's OData parser
      expect(url).toContain('$expand=ORDERITEMS_SUBFORM($select=PARTNAME,QPRICE)');
      expect(url).not.toContain('%28');  // No encoded parens
      expect(url).not.toContain('%29');
    });
  });

  describe('error parsing', () => {
    it('parses OData standard error format', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(
        { error: { code: '404', message: 'Entity not found' } },
        404
      ));
      const client = makeClient();
      await expect(client.fetchEntity('ORDERS', { select: 'ORDNAME', top: 1 }))
        .rejects.toThrow(PriorityApiError);
    });

    it('parses Priority InterfaceErrors format', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(
        { FORM: { InterfaceErrors: { text: 'Line 1- error here' } } },
        400
      ));
      const client = makeClient();
      await expect(client.fetchEntity('ORDERS', { select: 'ORDNAME', top: 1 }))
        .rejects.toThrow('Line 1- error here');
    });
  });

  describe('pagination', () => {
    it('fetches all pages when data spans multiple pages', async () => {
      // Page 1: 3 records (simulating pageSize=3)
      mockFetch.mockResolvedValueOnce(jsonResponse({
        value: [{ ORDNAME: 'A' }, { ORDNAME: 'B' }, { ORDNAME: 'C' }],
      }));
      // Page 2: 1 record (last page)
      mockFetch.mockResolvedValueOnce(jsonResponse({
        value: [{ ORDNAME: 'D' }],
      }));

      const client = makeClient();
      const results = await client.fetchAllPages('ORDERS', {
        select: 'ORDNAME',
        orderby: 'ORDNAME asc',
        pageSize: 3,
      });

      expect(results).toHaveLength(4);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run tests/services/priority-client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the Priority client implementation**

```typescript
// FILE: server/src/services/priority-client.ts
// PURPOSE: HTTP client for Priority ERP OData API with auth, rate limiting, pagination, error parsing
// USED BY: server/src/services/priority-queries.ts
// EXPORTS: PriorityClient, PriorityApiError

import { API_LIMITS, PAGE_SIZE } from '../config/constants.js';

interface FetchOptions {
  select: string;
  filter?: string;
  top?: number;
  skip?: number;
  orderby?: string;
  expand?: string;
}

interface PaginateOptions {
  select: string;
  filter?: string;
  orderby: string;
  expand?: string;
  pageSize?: number;
  cursorField?: string;
}

interface ClientConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export class PriorityApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public retryable: boolean,
  ) {
    super(message);
    this.name = 'PriorityApiError';
  }
}

export class PriorityClient {
  private baseUrl: string;
  private authHeader: string;
  private requestTimestamps: number[] = [];

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl;
    this.authHeader = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');
  }

  /** Fetch a single page from a Priority entity */
  async fetchEntity<T = Record<string, unknown>>(
    entity: string,
    opts: FetchOptions,
  ): Promise<T[]> {
    await this.throttle();
    const url = this.buildUrl(entity, opts);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'IEEE754Compatible': 'true',
        'Prefer': 'odata.maxpagesize=49900',
        'Authorization': this.authHeader,
      },
      signal: AbortSignal.timeout(API_LIMITS.REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = this.extractError(body, response);
      const retryable = response.status === 429 || response.status >= 500;
      throw new PriorityApiError(message, response.status, retryable);
    }

    const body = await response.json();
    return body.value ?? [];
  }

  /** Fetch all pages with cursor-based pagination for MAXAPILINES — spec Section 17.4 */
  async fetchAllPages<T extends Record<string, unknown>>(
    entity: string,
    opts: PaginateOptions,
  ): Promise<T[]> {
    const pageSize = opts.pageSize ?? PAGE_SIZE;
    const cursorField = opts.cursorField ?? this.guessCursorField(entity);
    const allRecords: T[] = [];
    let cursorValue: string | null = null;

    // Outer loop: MAXAPILINES query contexts
    while (true) {
      const batch: T[] = [];
      let skip = 0;

      // Inner loop: $top/$skip pages within each context
      while (true) {
        const filter = this.buildCursorFilter(opts.filter, cursorField, cursorValue);
        const records = await this.fetchEntity<T>(entity, {
          select: opts.select,
          filter,
          top: pageSize,
          skip,
          orderby: opts.orderby,
          expand: opts.expand,
        });

        if (records.length === 0) break;
        batch.push(...records);
        if (records.length < pageSize) break;
        skip += pageSize;
      }

      allRecords.push(...batch);

      // If batch hit MAXAPILINES, continue with cursor from last record
      if (batch.length > 0 && batch.length % pageSize === 0 && batch.length >= pageSize) {
        const lastRecord = batch[batch.length - 1];
        const lastValue = lastRecord[cursorField];
        if (typeof lastValue === 'string') {
          cursorValue = lastValue.trim();
        } else {
          break; // Can't cursor on non-string field
        }
      } else {
        break; // Got all records
      }
    }

    return allRecords;
  }

  /** Build OData URL — spec Section 17.8 (URL encoding trap) */
  private buildUrl(entity: string, opts: FetchOptions): string {
    const params: string[] = [];
    if (opts.select) params.push(`$select=${opts.select}`);
    if (opts.filter) params.push(`$filter=${encodeURIComponent(opts.filter)}`);
    if (opts.top !== undefined) params.push(`$top=${opts.top}`);
    if (opts.skip !== undefined) params.push(`$skip=${opts.skip}`);
    if (opts.orderby) params.push(`$orderby=${encodeURIComponent(opts.orderby)}`);

    let url = `${this.baseUrl}/${entity}`;
    if (params.length > 0) url += '?' + params.join('&');

    // WHY: $expand contains nested OData syntax with ( ) $ = characters.
    // URL.searchParams.set() would form-encode these, breaking Priority's parser.
    // Append raw instead — these chars are valid per RFC 3986.
    if (opts.expand) {
      url += (params.length > 0 ? '&' : '?') + `$expand=${opts.expand}`;
    }

    return url;
  }

  /** Parse both Priority error formats — spec Section 17.7 */
  private extractError(body: unknown, response: Response): string {
    if (body && typeof body === 'object') {
      const obj = body as Record<string, unknown>;
      // Format 1: OData standard
      if (obj.error && typeof obj.error === 'object') {
        return (obj.error as Record<string, string>).message ?? `HTTP ${response.status}`;
      }
      // Format 2: Priority InterfaceErrors
      if (obj.FORM && typeof obj.FORM === 'object') {
        const form = obj.FORM as Record<string, unknown>;
        if (form.InterfaceErrors && typeof form.InterfaceErrors === 'object') {
          return (form.InterfaceErrors as Record<string, string>).text ?? `HTTP ${response.status}`;
        }
      }
    }
    return `HTTP ${response.status}: ${response.statusText}`;
  }

  /** Rate limiting — 100 calls/min — spec Section 17.5 */
  private async throttle(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 60_000);

    if (this.requestTimestamps.length >= API_LIMITS.CALLS_PER_MINUTE) {
      const oldest = this.requestTimestamps[0];
      const waitMs = 60_000 - (now - oldest) + 100;
      if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
    }

    this.requestTimestamps.push(Date.now());
  }

  /** Combine base filter with cursor filter using AND */
  private buildCursorFilter(baseFilter: string | undefined, cursorField: string, cursorValue: string | null): string | undefined {
    if (!cursorValue) return baseFilter;
    const escaped = cursorValue.replace(/'/g, "''"); // OData single-quote escape
    const cursorClause = `${cursorField} gt '${escaped}'`;
    return baseFilter ? `${baseFilter} and ${cursorClause}` : cursorClause;
  }

  /** Default cursor field per entity */
  private guessCursorField(entity: string): string {
    const map: Record<string, string> = {
      ORDERS: 'ORDNAME',
      CUSTOMERS: 'CUSTNAME',
      SUPPLIERS: 'SUPNAME',
      DISTRLINES: 'DISTRLINECODE',
      AGENTS: 'AGENTCODE',
    };
    return map[entity] ?? 'ROWID';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run tests/services/priority-client.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/priority-client.ts server/tests/services/priority-client.test.ts
git commit -m "feat(server): add Priority OData client with pagination, rate limiting, error parsing"
```

---

## Task 5: Priority Queries — OData URL Builders

**Files:**
- Create: `server/src/services/priority-queries.ts`

- [ ] **Step 1: Write Priority query builders**

```typescript
// FILE: server/src/services/priority-queries.ts
// PURPOSE: Build OData query parameters for each Priority entity the dashboard needs
// USED BY: server/src/routes/dashboard.ts, server/src/routes/contacts.ts
// EXPORTS: fetchOrders, fetchCustomers, fetchZones, fetchAgents, fetchVendors, fetchContacts

import { PriorityClient } from './priority-client.js';
import {
  ORDER_SELECT, ORDERITEM_SELECT, ORDERITEM_SELECT_PREV,
  CUSTOMER_SELECT, CONTACT_SELECT,
  EXCLUDED_STATUSES,
} from '../config/constants.js';

/** Raw order from Priority with expanded ORDERITEMS */
export interface RawOrder {
  ORDNAME: string;
  CURDATE: string;
  ORDSTATUSDES: string;
  TOTPRICE: number;
  CUSTNAME: string;
  CUSTDES: string;
  AGENTCODE: string;
  AGENTDES: string;
  ORDERITEMS_SUBFORM: RawOrderItem[];
}

export interface RawOrderItem {
  PARTDES: string;
  PARTNAME: string;
  TQUANT: number;
  QPRICE: number;
  PRICE: number;
  PURCHASEPRICE: number;
  COST: number;
  QPROFIT: number;
  PERCENT: number;
  Y_1159_5_ESH: string;  // Vendor code
  Y_1530_5_ESH: string;  // Vendor name
  Y_9952_5_ESH: string;  // Brand
  Y_3020_5_ESH: string;  // Family type code
  Y_3021_5_ESH: string;  // Family type name
  Y_17936_5_ESH: string; // Vendor part number
}

export interface RawCustomer {
  CUSTNAME: string;
  CUSTDES: string;
  ZONECODE: string;
  ZONEDES: string;
  AGENTCODE: string;
  AGENTDES: string;
  CREATEDDATE: string;
  CTYPECODE: string;
  CTYPEDES: string;
}

export interface RawContact {
  NAME: string;
  POSITIONDES: string;
  PHONENUM: string;
  CELLPHONE: string;
  EMAIL: string;
  INACTIVE: string;
}

export interface RawZone {
  DISTRLINECODE: string;
  DISTRLINEDES: string;
  ZONECODE: string;
  ZONEDES: string;
}

export interface RawAgent {
  AGENTCODE: string;
  AGENTNAME: string;
  INACTIVE: string;
}

export interface RawVendor {
  SUPNAME: string;
  SUPDES: string;
}

/** Fetch orders with expanded line items for a date range — spec Section 17.2 */
export async function fetchOrders(
  client: PriorityClient,
  startDate: string,
  endDate: string,
  isCurrentPeriod: boolean,
): Promise<RawOrder[]> {
  const statusExclude = EXCLUDED_STATUSES.map(s => `ORDSTATUSDES ne '${s}'`).join(' and ');
  const dateFilter = `CURDATE ge ${startDate} and CURDATE lt ${endDate} and ${statusExclude}`;
  const itemFields = isCurrentPeriod ? ORDERITEM_SELECT : ORDERITEM_SELECT_PREV;

  return client.fetchAllPages<RawOrder>('ORDERS', {
    select: isCurrentPeriod ? ORDER_SELECT : 'ORDNAME,CURDATE,TOTPRICE,CUSTNAME,AGENTCODE',
    filter: dateFilter,
    orderby: 'ORDNAME asc',
    expand: `ORDERITEMS_SUBFORM($select=${itemFields})`,
  });
}

/** Fetch all customers — spec Section 17.3 */
export async function fetchCustomers(client: PriorityClient): Promise<RawCustomer[]> {
  return client.fetchAllPages<RawCustomer>('CUSTOMERS', {
    select: CUSTOMER_SELECT,
    orderby: 'CUSTNAME asc',
  });
}

/** Fetch zones (distribution lines) — spec Section 17.3 */
export async function fetchZones(client: PriorityClient): Promise<RawZone[]> {
  return client.fetchAllPages<RawZone>('DISTRLINES', {
    select: 'DISTRLINECODE,DISTRLINEDES,ZONECODE,ZONEDES',
    orderby: 'DISTRLINECODE asc',
  });
}

/** Fetch active sales reps — spec Section 17.3 */
export async function fetchAgents(client: PriorityClient): Promise<RawAgent[]> {
  return client.fetchAllPages<RawAgent>('AGENTS', {
    select: 'AGENTCODE,AGENTNAME,INACTIVE',
    filter: "INACTIVE ne 'Y'",
    orderby: 'AGENTCODE asc',
  });
}

/** Fetch vendors — spec Section 17.3 */
export async function fetchVendors(client: PriorityClient): Promise<RawVendor[]> {
  return client.fetchAllPages<RawVendor>('SUPPLIERS', {
    select: 'SUPNAME,SUPDES',
    orderby: 'SUPNAME asc',
  });
}

/** Fetch contacts for a single customer — spec Section 17.3 */
export async function fetchContacts(
  client: PriorityClient,
  customerCode: string,
): Promise<RawContact[]> {
  const escaped = customerCode.replace(/'/g, "''");
  const results = await client.fetchEntity<{ CUSTPERSONNEL_SUBFORM: RawContact[] }>(
    'CUSTOMERS',
    {
      select: 'CUSTNAME',
      filter: `CUSTNAME eq '${escaped}'`,
      top: 1,
      expand: `CUSTPERSONNEL_SUBFORM($select=${CONTACT_SELECT})`,
    },
  );
  if (results.length === 0) return [];
  return (results[0].CUSTPERSONNEL_SUBFORM ?? []).filter(c => c.INACTIVE !== 'Y');
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd server && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add server/src/services/priority-queries.ts
git commit -m "feat(server): add Priority OData query builders for all dashboard entities"
```

---

## Task 6: Data Aggregator — Raw Orders to Dashboard Payload

**Files:**
- Create: `server/src/services/data-aggregator.ts`
- Create: `server/tests/services/data-aggregator.test.ts`

This is the core business logic. It takes raw Priority data and produces the dashboard payload.

- [ ] **Step 1: Write failing tests for the data aggregator**

```typescript
// FILE: server/tests/services/data-aggregator.test.ts
import { describe, it, expect } from 'vitest';
import { aggregateOrders } from '../../src/services/data-aggregator';
import type { RawOrder } from '../../src/services/priority-queries';

function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    ORDNAME: 'ORD-001',
    CURDATE: '2026-02-15T00:00:00Z',
    ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000,
    CUSTNAME: 'C001',
    CUSTDES: 'Acme Corp',
    AGENTCODE: 'A01',
    AGENTDES: 'Sarah M.',
    ORDERITEMS_SUBFORM: [{
      PARTDES: 'Widget A', PARTNAME: 'WGT-A', TQUANT: 100,
      QPRICE: 5000, PRICE: 50, PURCHASEPRICE: 30, COST: 30,
      QPROFIT: 2000, PERCENT: 0,
      Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One',
      Y_9952_5_ESH: 'BrandX', Y_3020_5_ESH: 'FAM1',
      Y_3021_5_ESH: 'Packaging', Y_17936_5_ESH: 'VP-001',
    }],
    ...overrides,
  };
}

describe('aggregateOrders', () => {
  it('computes total revenue as SUM of TOTPRICE', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', TOTPRICE: 10000 }),
      makeOrder({ ORDNAME: 'O2', TOTPRICE: 5000 }),
    ];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.kpis.totalRevenue).toBe(15000);
  });

  it('computes order count', () => {
    const orders = [makeOrder({ ORDNAME: 'O1' }), makeOrder({ ORDNAME: 'O2' })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.kpis.orders).toBe(2);
  });

  it('computes avgOrder as revenue / orders', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', TOTPRICE: 10000 }),
      makeOrder({ ORDNAME: 'O2', TOTPRICE: 5000 }),
    ];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.kpis.avgOrder).toBe(7500);
  });

  it('returns null avgOrder when 0 orders', () => {
    const result = aggregateOrders([], [], 'ytd');
    expect(result.kpis.avgOrder).toBeNull();
  });

  it('computes margin from SUM of QPROFIT', () => {
    const orders = [makeOrder({
      ORDNAME: 'O1',
      ORDERITEMS_SUBFORM: [
        { ...makeOrder().ORDERITEMS_SUBFORM[0], QPROFIT: 2000, QPRICE: 5000 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], QPROFIT: 1000, QPRICE: 3000 },
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.kpis.marginAmount).toBe(3000);
    expect(result.kpis.marginPercent).toBeCloseTo(37.5); // 3000/8000 * 100
  });

  it('builds monthly revenue array with 12 months', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', CURDATE: '2026-01-15T00:00:00Z', TOTPRICE: 1000 }),
      makeOrder({ ORDNAME: 'O2', CURDATE: '2026-01-20T00:00:00Z', TOTPRICE: 2000 }),
      makeOrder({ ORDNAME: 'O3', CURDATE: '2026-03-10T00:00:00Z', TOTPRICE: 3000 }),
    ];
    const prevOrders = [
      makeOrder({ ORDNAME: 'P1', CURDATE: '2025-01-15T00:00:00Z', TOTPRICE: 800 }),
    ];
    const result = aggregateOrders(orders, prevOrders, 'ytd');
    expect(result.monthlyRevenue).toHaveLength(12);
    expect(result.monthlyRevenue[0].currentYear).toBe(3000); // Jan
    expect(result.monthlyRevenue[0].previousYear).toBe(800);
    expect(result.monthlyRevenue[2].currentYear).toBe(3000); // Mar
  });

  it('builds product mix from Y_3021_5_ESH (family type name)', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_3021_5_ESH: 'Packaging', QPRICE: 6000 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_3021_5_ESH: 'Equipment', QPRICE: 4000 },
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.productMix).toHaveLength(2);
    expect(result.productMix[0].category).toBe('Packaging');
    expect(result.productMix[0].percentage).toBe(60);
  });

  it('builds top 10 sellers ranked by revenue', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      ...makeOrder().ORDERITEMS_SUBFORM[0],
      PARTNAME: `SKU-${i}`,
      PARTDES: `Product ${i}`,
      QPRICE: (15 - i) * 1000,
      TQUANT: (15 - i) * 10,
    }));
    const orders = [makeOrder({ ORDERITEMS_SUBFORM: items })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.topSellers).toHaveLength(10);
    expect(result.topSellers[0].rank).toBe(1);
    expect(result.topSellers[0].revenue).toBe(15000);
    expect(result.topSellers[9].rank).toBe(10);
  });

  it('computes YoY revenue change percent', () => {
    const orders = [makeOrder({ TOTPRICE: 24000 })];
    const prevOrders = [makeOrder({ TOTPRICE: 20000 })];
    const result = aggregateOrders(orders, prevOrders, 'ytd');
    expect(result.kpis.revenueChangePercent).toBeCloseTo(20); // (24000-20000)/20000 * 100
    expect(result.kpis.revenueChangeAmount).toBe(4000);
  });

  it('returns null revenueChangePercent when prev year is 0', () => {
    const orders = [makeOrder({ TOTPRICE: 10000 })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.kpis.revenueChangePercent).toBeNull();
  });

  it('maps order statuses to dashboard labels', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', ORDSTATUSDES: 'Closed' }),
      makeOrder({ ORDNAME: 'O2', ORDSTATUSDES: 'Open' }),
      makeOrder({ ORDNAME: 'O3', ORDSTATUSDES: 'Partially Filled' }),
    ];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.orders[0].status).toBe('Delivered');
    expect(result.orders[1].status).toBe('Processing');
    expect(result.orders[2].status).toBe('Pending');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run tests/services/data-aggregator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the data aggregator implementation**

```typescript
// FILE: server/src/services/data-aggregator.ts
// PURPOSE: Transform raw Priority orders into dashboard-ready payload (KPIs, charts, tables)
// USED BY: server/src/routes/dashboard.ts
// EXPORTS: aggregateOrders

import type { KPIs, MonthlyRevenue, ProductMixSegment, TopSellerItem, OrderRow, ItemCategory, SparklineData } from '@shared/types/dashboard';
import type { RawOrder, RawOrderItem } from './priority-queries.js';
import { ORDER_STATUS_MAP } from '../config/constants.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface AggregateResult {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMix: ProductMixSegment[];
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: ItemCategory[];
}

export function aggregateOrders(
  currentOrders: RawOrder[],
  prevOrders: RawOrder[],
  period: string,
): AggregateResult {
  const allItems = currentOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);
  const prevItems = prevOrders.flatMap(o => o.ORDERITEMS_SUBFORM ?? []);

  const kpis = computeKPIs(currentOrders, prevOrders, allItems, prevItems, period);
  const monthlyRevenue = computeMonthlyRevenue(currentOrders, prevOrders);
  const productMix = computeProductMix(allItems);
  const topSellers = computeTopSellers(allItems);
  const sparklines = computeSparklines(currentOrders);
  const orders = buildOrderRows(currentOrders);
  const items = buildItemCategories(allItems);

  return { kpis, monthlyRevenue, productMix, topSellers, sparklines, orders, items };
}

/** Spec Section 10.1 — KPI formulas */
function computeKPIs(
  orders: RawOrder[],
  prevOrders: RawOrder[],
  items: RawOrderItem[],
  prevItems: RawOrderItem[],
  period: string,
): KPIs {
  const totalRevenue = orders.reduce((sum, o) => sum + o.TOTPRICE, 0);
  const prevRevenue = prevOrders.reduce((sum, o) => sum + o.TOTPRICE, 0);
  const orderCount = orders.length;

  const totalItemRevenue = items.reduce((sum, i) => sum + i.QPRICE, 0);
  const totalProfit = items.reduce((sum, i) => sum + i.QPROFIT, 0);

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthsInPeriod = period === 'ytd'
    ? Math.max(1, now.getMonth() + 1)
    : 12;

  // Quarter calculations
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const qStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
  const prevQStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
  const thisQuarterRevenue = orders
    .filter(o => new Date(o.CURDATE) >= qStart)
    .reduce((sum, o) => sum + o.TOTPRICE, 0);
  const lastQuarterRevenue = orders
    .filter(o => { const d = new Date(o.CURDATE); return d >= prevQStart && d < qStart; })
    .reduce((sum, o) => sum + o.TOTPRICE, 0);

  // Best month
  const monthRevenues = new Array(12).fill(0);
  orders.forEach(o => { monthRevenues[new Date(o.CURDATE).getUTCMonth()] += o.TOTPRICE; });
  const bestMonthIdx = monthRevenues.indexOf(Math.max(...monthRevenues));

  // Last order
  const dates = orders.map(o => new Date(o.CURDATE).getTime());
  const lastOrderDate = dates.length > 0 ? Math.max(...dates) : null;
  const lastOrderDays = lastOrderDate !== null
    ? Math.floor((now.getTime() - lastOrderDate) / (1000 * 60 * 60 * 24))
    : null;

  // YoY change — spec Section 10.2
  const revenueChangePercent = prevRevenue > 0
    ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
    : null;

  // Prev margin for pp change
  const prevItemRevenue = prevItems.reduce((sum, i) => sum + i.QPRICE, 0);
  const prevProfit = prevItems.reduce((sum, i) => sum + i.QPROFIT, 0);
  const prevMarginPct = prevItemRevenue > 0 ? (prevProfit / prevItemRevenue) * 100 : null;
  const currentMarginPct = totalItemRevenue > 0 ? (totalProfit / totalItemRevenue) * 100 : null;

  return {
    totalRevenue,
    prevYearRevenue: prevRevenue,
    revenueChangePercent,
    revenueChangeAmount: totalRevenue - prevRevenue,
    thisQuarterRevenue,
    lastQuarterRevenue,
    bestMonth: { name: MONTH_NAMES[bestMonthIdx] ?? 'N/A', amount: monthRevenues[bestMonthIdx] ?? 0 },
    orders: orderCount,
    ordersChange: orderCount - prevOrders.length,
    avgOrder: orderCount > 0 ? totalRevenue / orderCount : null,
    marginPercent: currentMarginPct,
    marginAmount: totalProfit,
    marginChangepp: currentMarginPct !== null && prevMarginPct !== null
      ? currentMarginPct - prevMarginPct : null,
    frequency: orderCount > 0 ? orderCount / monthsInPeriod : null,
    frequencyChange: null, // Computed on client from avg across all entities
    lastOrderDays,
    fillRate: null, // Requires delivered qty data not yet mapped
    fillRateChangepp: null,
  };
}

/** Spec Section 20.1 — 12 months, current vs previous year */
function computeMonthlyRevenue(current: RawOrder[], prev: RawOrder[]): MonthlyRevenue[] {
  const currentByMonth = new Array(12).fill(0);
  const prevByMonth = new Array(12).fill(0);

  current.forEach(o => { currentByMonth[new Date(o.CURDATE).getUTCMonth()] += o.TOTPRICE; });
  prev.forEach(o => { prevByMonth[new Date(o.CURDATE).getUTCMonth()] += o.TOTPRICE; });

  return MONTH_NAMES.map((name, i) => ({
    month: name,
    monthIndex: i,
    currentYear: currentByMonth[i],
    previousYear: prevByMonth[i],
  }));
}

/** Spec Section 20.2 — Group by family type, max 7 segments */
function computeProductMix(items: RawOrderItem[]): ProductMixSegment[] {
  const byCategory = new Map<string, number>();
  items.forEach(item => {
    const cat = item.Y_3021_5_ESH || 'Other';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + item.QPRICE);
  });

  const total = items.reduce((sum, i) => sum + i.QPRICE, 0);
  const sorted = [...byCategory.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([category, value]) => ({
      category,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0,
    }));

  // Collapse 7+ into "Other"
  if (sorted.length > 7) {
    const top6 = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    const otherValue = rest.reduce((sum, s) => sum + s.value, 0);
    top6.push({ category: 'Other', value: otherValue, percentage: total > 0 ? Math.round((otherValue / total) * 100) : 0 });
    return top6;
  }

  return sorted;
}

/** Spec Section 22.5 — Top 10 by revenue, aggregated by SKU */
function computeTopSellers(items: RawOrderItem[]): TopSellerItem[] {
  const bySku = new Map<string, { name: string; sku: string; revenue: number; units: number }>();
  items.forEach(item => {
    const existing = bySku.get(item.PARTNAME);
    if (existing) {
      existing.revenue += item.QPRICE;
      existing.units += item.TQUANT;
    } else {
      bySku.set(item.PARTNAME, {
        name: item.PARTDES,
        sku: item.PARTNAME,
        revenue: item.QPRICE,
        units: item.TQUANT,
      });
    }
  });

  return [...bySku.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((item, i) => ({ ...item, rank: i + 1 }));
}

/** Spec Section 20.3 — last 6 months of revenue for sparklines */
function computeSparklines(orders: RawOrder[]): Record<string, SparklineData> {
  const now = new Date();
  const months: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.getFullYear() * 12 + d.getMonth());
  }

  const revenueByMonth = new Map<number, number>();
  const ordersByMonth = new Map<number, number>();
  orders.forEach(o => {
    const d = new Date(o.CURDATE);
    const key = d.getUTCFullYear() * 12 + d.getUTCMonth();
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + o.TOTPRICE);
    ordersByMonth.set(key, (ordersByMonth.get(key) ?? 0) + 1);
  });

  return {
    revenue: { values: months.map(m => revenueByMonth.get(m) ?? 0) },
    orders: { values: months.map(m => ordersByMonth.get(m) ?? 0) },
  };
}

/** Spec Section 10.4 + 13.6 — Order table rows */
function buildOrderRows(orders: RawOrder[]): OrderRow[] {
  return orders
    .map(o => ({
      date: o.CURDATE,
      orderNumber: o.ORDNAME,
      itemCount: o.ORDERITEMS_SUBFORM?.length ?? 0,
      amount: o.TOTPRICE,
      marginPercent: computeOrderMarginPct(o),
      marginAmount: (o.ORDERITEMS_SUBFORM ?? []).reduce((s, i) => s + i.QPROFIT, 0),
      status: (ORDER_STATUS_MAP[o.ORDSTATUSDES] ?? 'Processing') as OrderRow['status'],
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function computeOrderMarginPct(order: RawOrder): number {
  const items = order.ORDERITEMS_SUBFORM ?? [];
  const revenue = items.reduce((s, i) => s + i.QPRICE, 0);
  const profit = items.reduce((s, i) => s + i.QPROFIT, 0);
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}

/** Spec Section 4.4 — Items grouped by category (Y_3021_5_ESH) */
function buildItemCategories(items: RawOrderItem[]): ItemCategory[] {
  const byCategory = new Map<string, RawOrderItem[]>();
  items.forEach(item => {
    const cat = item.Y_3021_5_ESH || 'Other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(item);
  });

  return [...byCategory.entries()]
    .map(([category, catItems]) => {
      const totalValue = catItems.reduce((s, i) => s + i.QPRICE, 0);
      const totalProfit = catItems.reduce((s, i) => s + i.QPROFIT, 0);

      // Aggregate by SKU within category
      const bySku = new Map<string, { name: string; sku: string; value: number; profit: number }>();
      catItems.forEach(item => {
        const existing = bySku.get(item.PARTNAME);
        if (existing) {
          existing.value += item.QPRICE;
          existing.profit += item.QPROFIT;
        } else {
          bySku.set(item.PARTNAME, { name: item.PARTDES, sku: item.PARTNAME, value: item.QPRICE, profit: item.QPROFIT });
        }
      });

      const products = [...bySku.values()]
        .sort((a, b) => b.value - a.value)
        .map(p => ({
          name: p.name,
          sku: p.sku,
          value: p.value,
          marginPercent: p.value > 0 ? (p.profit / p.value) * 100 : 0,
          marginAmount: p.profit,
        }));

      return {
        category,
        totalValue,
        marginPercent: totalValue > 0 ? (totalProfit / totalValue) * 100 : 0,
        marginAmount: totalProfit,
        itemCount: products.length,
        products,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run tests/services/data-aggregator.test.ts`
Expected: All 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/data-aggregator.ts server/tests/services/data-aggregator.test.ts
git commit -m "feat(server): add data aggregator — raw Priority orders to dashboard KPIs, charts, tables"
```

---

## Task 7: Dimension Grouper

**Files:**
- Create: `server/src/services/dimension-grouper.ts`
- Create: `server/tests/services/dimension-grouper.test.ts`

Groups the aggregated dashboard data by the active dimension (customer, zone, vendor, brand, product_type, product). Each dimension produces a different entity list with different metadata.

- [ ] **Step 1: Write failing tests**

```typescript
// FILE: server/tests/services/dimension-grouper.test.ts
import { describe, it, expect } from 'vitest';
import { groupByDimension } from '../../src/services/dimension-grouper';
import type { RawOrder, RawCustomer } from '../../src/services/priority-queries';

const orders: RawOrder[] = [
  {
    ORDNAME: 'O1', CURDATE: '2026-02-01T00:00:00Z', ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000, CUSTNAME: 'C001', CUSTDES: 'Acme Corp',
    AGENTCODE: 'A01', AGENTDES: 'Sarah M.',
    ORDERITEMS_SUBFORM: [{
      PARTDES: 'Widget', PARTNAME: 'WGT-A', TQUANT: 100,
      QPRICE: 5000, PRICE: 50, PURCHASEPRICE: 30, COST: 30,
      QPROFIT: 2000, PERCENT: 0,
      Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One',
      Y_9952_5_ESH: 'BrandX', Y_3020_5_ESH: 'FAM1',
      Y_3021_5_ESH: 'Packaging', Y_17936_5_ESH: 'VP-001',
    }],
  },
  {
    ORDNAME: 'O2', CURDATE: '2026-02-15T00:00:00Z', ORDSTATUSDES: 'Open',
    TOTPRICE: 5000, CUSTNAME: 'C002', CUSTDES: 'Beta Inc',
    AGENTCODE: 'A01', AGENTDES: 'Sarah M.',
    ORDERITEMS_SUBFORM: [{
      PARTDES: 'Gadget', PARTNAME: 'GDG-B', TQUANT: 50,
      QPRICE: 2500, PRICE: 50, PURCHASEPRICE: 25, COST: 25,
      QPROFIT: 1250, PERCENT: 0,
      Y_1159_5_ESH: 'V02', Y_1530_5_ESH: 'Vendor Two',
      Y_9952_5_ESH: 'BrandX', Y_3020_5_ESH: 'FAM2',
      Y_3021_5_ESH: 'Equipment', Y_17936_5_ESH: 'VP-002',
    }],
  },
];

const customers: RawCustomer[] = [
  { CUSTNAME: 'C001', CUSTDES: 'Acme Corp', ZONECODE: 'Z1', ZONEDES: 'North',
    AGENTCODE: 'A01', AGENTDES: 'Sarah M.', CREATEDDATE: '2021-01-15T00:00:00Z',
    CTYPECODE: 'RT', CTYPEDES: 'Retail' },
  { CUSTNAME: 'C002', CUSTDES: 'Beta Inc', ZONECODE: 'Z2', ZONEDES: 'South',
    AGENTCODE: 'A01', AGENTDES: 'Sarah M.', CREATEDDATE: '2022-06-01T00:00:00Z',
    CTYPECODE: 'WH', CTYPEDES: 'Wholesale' },
];

describe('groupByDimension', () => {
  it('groups by customer — one entity per CUSTNAME', () => {
    const entities = groupByDimension('customer', orders, customers);
    expect(entities).toHaveLength(2);
    expect(entities[0].id).toBe('C001');
    expect(entities[0].name).toBe('Acme Corp');
  });

  it('groups by vendor — one entity per Y_1159_5_ESH', () => {
    const entities = groupByDimension('vendor', orders, customers);
    expect(entities).toHaveLength(2);
    expect(entities.find(e => e.id === 'V01')?.name).toBe('Vendor One');
  });

  it('groups by brand — one entity per Y_9952_5_ESH', () => {
    const entities = groupByDimension('brand', orders, customers);
    expect(entities).toHaveLength(1); // Both orders have BrandX
    expect(entities[0].name).toBe('BrandX');
    expect(entities[0].revenue).toBe(15000);
  });

  it('sorts by revenue descending by default', () => {
    const entities = groupByDimension('customer', orders, customers);
    expect(entities[0].revenue).toBeGreaterThanOrEqual(entities[1].revenue);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run tests/services/dimension-grouper.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the dimension grouper**

```typescript
// FILE: server/src/services/dimension-grouper.ts
// PURPOSE: Group orders into entity lists by dimension (customer, zone, vendor, brand, product_type, product)
// USED BY: server/src/routes/dashboard.ts
// EXPORTS: groupByDimension

import type { EntityListItem, Dimension } from '@shared/types/dashboard';
import type { RawOrder, RawCustomer } from './priority-queries.js';

export function groupByDimension(
  dimension: Dimension,
  orders: RawOrder[],
  customers: RawCustomer[],
): EntityListItem[] {
  const groupers: Record<Dimension, () => EntityListItem[]> = {
    customer: () => groupByCustomer(orders, customers),
    zone: () => groupByZone(orders, customers),
    vendor: () => groupByVendor(orders),
    brand: () => groupByBrand(orders),
    product_type: () => groupByProductType(orders),
    product: () => groupByProduct(orders),
  };

  return (groupers[dimension] ?? groupers.customer)()
    .sort((a, b) => b.revenue - a.revenue);
}

function groupByCustomer(orders: RawOrder[], customers: RawCustomer[]): EntityListItem[] {
  const custMap = new Map(customers.map(c => [c.CUSTNAME, c]));
  const groups = new Map<string, { revenue: number; orderCount: number }>();

  orders.forEach(o => {
    const g = groups.get(o.CUSTNAME) ?? { revenue: 0, orderCount: 0 };
    g.revenue += o.TOTPRICE;
    g.orderCount += 1;
    groups.set(o.CUSTNAME, g);
  });

  return [...groups.entries()].map(([id, g]) => {
    const cust = custMap.get(id);
    return {
      id,
      name: cust?.CUSTDES ?? id,
      meta1: [cust?.ZONEDES, cust?.AGENTDES].filter(Boolean).join(' \u00B7 '),
      meta2: `${g.orderCount} orders`,
      revenue: g.revenue,
      orderCount: g.orderCount,
    };
  });
}

function groupByZone(orders: RawOrder[], customers: RawCustomer[]): EntityListItem[] {
  const custZone = new Map(customers.map(c => [c.CUSTNAME, { zone: c.ZONECODE, zoneName: c.ZONEDES }]));
  const groups = new Map<string, { name: string; revenue: number; orderCount: number; customerIds: Set<string> }>();

  orders.forEach(o => {
    const z = custZone.get(o.CUSTNAME);
    const zoneId = z?.zone ?? 'UNKNOWN';
    const g = groups.get(zoneId) ?? { name: z?.zoneName ?? zoneId, revenue: 0, orderCount: 0, customerIds: new Set() };
    g.revenue += o.TOTPRICE;
    g.orderCount += 1;
    g.customerIds.add(o.CUSTNAME);
    groups.set(zoneId, g);
  });

  return [...groups.entries()].map(([id, g]) => ({
    id, name: g.name,
    meta1: `${g.customerIds.size} customers`,
    meta2: `${g.orderCount} orders`,
    revenue: g.revenue, orderCount: g.orderCount,
  }));
}

function groupByVendor(orders: RawOrder[]): EntityListItem[] {
  const groups = new Map<string, { name: string; revenue: number; orderCount: number; productIds: Set<string> }>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const id = item.Y_1159_5_ESH || 'UNKNOWN';
    const g = groups.get(id) ?? { name: item.Y_1530_5_ESH || id, revenue: 0, orderCount: 0, productIds: new Set() };
    g.revenue += item.QPRICE;
    g.productIds.add(item.PARTNAME);
    groups.set(id, g);
  }));

  // Count orders per vendor (distinct ORDNAME)
  const ordersByVendor = new Map<string, Set<string>>();
  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const id = item.Y_1159_5_ESH || 'UNKNOWN';
    if (!ordersByVendor.has(id)) ordersByVendor.set(id, new Set());
    ordersByVendor.get(id)!.add(o.ORDNAME);
  }));

  return [...groups.entries()].map(([id, g]) => ({
    id, name: g.name,
    meta1: `${g.productIds.size} products`,
    meta2: `${ordersByVendor.get(id)?.size ?? 0} orders`,
    revenue: g.revenue, orderCount: ordersByVendor.get(id)?.size ?? 0,
  }));
}

function groupByBrand(orders: RawOrder[]): EntityListItem[] {
  const groups = new Map<string, { revenue: number; productIds: Set<string>; orderIds: Set<string> }>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const brand = item.Y_9952_5_ESH || 'Other';
    const g = groups.get(brand) ?? { revenue: 0, productIds: new Set(), orderIds: new Set() };
    g.revenue += item.QPRICE;
    g.productIds.add(item.PARTNAME);
    g.orderIds.add(o.ORDNAME);
    groups.set(brand, g);
  }));

  return [...groups.entries()].map(([name, g]) => ({
    id: name, name,
    meta1: `${g.productIds.size} products`,
    meta2: `${g.orderIds.size} orders`,
    revenue: g.revenue, orderCount: g.orderIds.size,
  }));
}

function groupByProductType(orders: RawOrder[]): EntityListItem[] {
  const groups = new Map<string, { code: string; revenue: number; productIds: Set<string>; orderIds: Set<string> }>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const name = item.Y_3021_5_ESH || 'Other';
    const g = groups.get(name) ?? { code: item.Y_3020_5_ESH, revenue: 0, productIds: new Set(), orderIds: new Set() };
    g.revenue += item.QPRICE;
    g.productIds.add(item.PARTNAME);
    g.orderIds.add(o.ORDNAME);
    groups.set(name, g);
  }));

  return [...groups.entries()].map(([name, g]) => ({
    id: g.code || name, name,
    meta1: `${g.productIds.size} products`,
    meta2: `${g.orderIds.size} orders`,
    revenue: g.revenue, orderCount: g.orderIds.size,
  }));
}

function groupByProduct(orders: RawOrder[]): EntityListItem[] {
  const groups = new Map<string, { name: string; brand: string; revenue: number; orderIds: Set<string> }>();

  orders.forEach(o => (o.ORDERITEMS_SUBFORM ?? []).forEach(item => {
    const g = groups.get(item.PARTNAME) ?? { name: item.PARTDES, brand: item.Y_9952_5_ESH, revenue: 0, orderIds: new Set() };
    g.revenue += item.QPRICE;
    g.orderIds.add(o.ORDNAME);
    groups.set(item.PARTNAME, g);
  }));

  return [...groups.entries()].map(([sku, g]) => ({
    id: sku, name: g.name,
    meta1: [sku, g.brand].filter(Boolean).join(' \u00B7 '),
    meta2: `${g.orderIds.size} orders`,
    revenue: g.revenue, orderCount: g.orderIds.size,
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run tests/services/dimension-grouper.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/dimension-grouper.ts server/tests/services/dimension-grouper.test.ts
git commit -m "feat(server): add dimension grouper for 6 dashboard dimensions"
```

---

## Task 8: Redis Cache Layer

**Files:**
- Create: `server/src/cache/redis-client.ts`
- Create: `server/src/cache/cache-keys.ts`
- Create: `server/src/cache/cache-layer.ts`
- Create: `server/tests/cache/cache-layer.test.ts`

- [ ] **Step 1: Write redis-client.ts**

```typescript
// FILE: server/src/cache/redis-client.ts
// PURPOSE: Upstash Redis connection singleton
// USED BY: server/src/cache/cache-layer.ts
// EXPORTS: redis

import { Redis } from '@upstash/redis';
import { env } from '../config/env.js';

export const redis = new Redis({
  url: env.UPSTASH_REDIS_URL,
  token: env.UPSTASH_REDIS_TOKEN,
});
```

- [ ] **Step 2: Write cache-keys.ts**

```typescript
// FILE: server/src/cache/cache-keys.ts
// PURPOSE: Cache key schema and TTL mapping — spec Section 19.1
// USED BY: server/src/cache/cache-layer.ts
// EXPORTS: cacheKey, getTTL

import { CACHE_TTLS } from '../config/constants.js';

type CacheEntity = 'orders_ytd' | 'orders_year' | 'customers' | 'zones' | 'agents' | 'vendors' | 'contacts' | 'years_available';

/** Build a cache key: dashboard:{company}:{entity}:{period}:{qualifier} */
export function cacheKey(entity: CacheEntity, period: string, qualifier = ''): string {
  const parts = ['dashboard', entity, period];
  if (qualifier) parts.push(qualifier);
  return parts.join(':');
}

export function getTTL(entity: CacheEntity): number {
  return CACHE_TTLS[entity];
}
```

- [ ] **Step 3: Write failing tests for cache layer**

```typescript
// FILE: server/tests/cache/cache-layer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cachedFetch } from '../../src/cache/cache-layer';

// Mock redis
const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock('../../src/cache/redis-client', () => ({
  redis: { get: (...args: unknown[]) => mockGet(...args), set: (...args: unknown[]) => mockSet(...args) },
}));

describe('cachedFetch', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
  });

  it('returns cached data on hit', async () => {
    const cached = { data: [1, 2, 3], cachedAt: '2026-03-30T10:00:00Z' };
    mockGet.mockResolvedValueOnce(JSON.stringify(cached));

    const fetcher = vi.fn();
    const result = await cachedFetch('dashboard:orders_ytd:ytd', 900, fetcher);

    expect(result.data).toEqual([1, 2, 3]);
    expect(result.cached).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('calls fetcher and caches on miss', async () => {
    mockGet.mockResolvedValueOnce(null);
    mockSet.mockResolvedValueOnce('OK');

    const fetcher = vi.fn().mockResolvedValueOnce([4, 5, 6]);
    const result = await cachedFetch('dashboard:orders_ytd:ytd', 900, fetcher);

    expect(result.data).toEqual([4, 5, 6]);
    expect(result.cached).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd server && npx vitest run tests/cache/cache-layer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 5: Write cache-layer.ts**

```typescript
// FILE: server/src/cache/cache-layer.ts
// PURPOSE: Get-or-fetch pattern with Redis caching — spec Section 19.3
// USED BY: server/src/routes/dashboard.ts
// EXPORTS: cachedFetch

import { redis } from './redis-client.js';

interface CacheResult<T> {
  data: T;
  cached: boolean;
  cachedAt: string | null;
}

interface CacheEnvelope<T> {
  data: T;
  cachedAt: string;
}

/** Fetch from cache if available, otherwise call fetcher and cache the result */
export async function cachedFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<CacheResult<T>> {
  // Try cache first
  const raw = await redis.get(key);
  if (raw !== null) {
    const envelope: CacheEnvelope<T> = typeof raw === 'string' ? JSON.parse(raw) : raw as CacheEnvelope<T>;
    return { data: envelope.data, cached: true, cachedAt: envelope.cachedAt };
  }

  // Cache miss — fetch fresh data
  const data = await fetcher();
  const envelope: CacheEnvelope<T> = { data, cachedAt: new Date().toISOString() };
  await redis.set(key, JSON.stringify(envelope), { ex: ttlSeconds });

  return { data, cached: false, cachedAt: null };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd server && npx vitest run tests/cache/cache-layer.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/cache/redis-client.ts server/src/cache/cache-keys.ts server/src/cache/cache-layer.ts server/tests/cache/cache-layer.test.ts
git commit -m "feat(server): add Redis cache layer with get-or-fetch pattern and TTL config"
```

---

## Task 9: API Routes — Dashboard + Contacts + Health

**Files:**
- Create: `server/src/routes/dashboard.ts`
- Create: `server/src/routes/contacts.ts`
- Create: `server/src/routes/health.ts`
- Create: `server/src/middleware/error-handler.ts`
- Create: `server/src/middleware/request-validator.ts`

- [ ] **Step 1: Write request validator middleware**

```typescript
// FILE: server/src/middleware/request-validator.ts
// PURPOSE: Zod validation middleware for Express request query params
// USED BY: server/src/routes/dashboard.ts, server/src/routes/contacts.ts
// EXPORTS: validateQuery

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
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
```

- [ ] **Step 2: Write error handler middleware**

```typescript
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
```

- [ ] **Step 3: Write the dashboard route**

```typescript
// FILE: server/src/routes/dashboard.ts
// PURPOSE: GET /api/sales/dashboard — main endpoint returning full dashboard payload
// USED BY: client/hooks/useDashboardData.ts
// EXPORTS: dashboardRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { PriorityClient } from '../services/priority-client.js';
import { fetchOrders, fetchCustomers, fetchZones, fetchAgents, fetchVendors } from '../services/priority-queries.js';
import { aggregateOrders } from '../services/data-aggregator.js';
import { groupByDimension } from '../services/dimension-grouper.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { env } from '../config/env.js';
import type { Dimension, DashboardPayload } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

const querySchema = z.object({
  groupBy: z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']).default('customer'),
  period: z.string().default('ytd'),
  entityId: z.string().optional(), // Filter to specific entity
});

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', validateQuery(querySchema), async (req, res, next) => {
  try {
    const { groupBy, period, entityId } = req.query as z.infer<typeof querySchema>;
    const now = new Date();
    const year = period === 'ytd' ? now.getFullYear() : parseInt(period, 10);

    // Date ranges
    const startDate = `${year}-01-01T00:00:00Z`;
    const endDate = period === 'ytd'
      ? `${year + 1}-01-01T00:00:00Z`  // Will filter client-side for YTD
      : `${year + 1}-01-01T00:00:00Z`;
    const prevStartDate = `${year - 1}-01-01T00:00:00Z`;
    const prevEndDate = `${year}-01-01T00:00:00Z`;

    const client = new PriorityClient({
      baseUrl: env.PRIORITY_BASE_URL,
      username: env.PRIORITY_USERNAME,
      password: env.PRIORITY_PASSWORD,
    });

    // Fetch all data in parallel, with caching
    const cacheEntityType = period === 'ytd' ? 'orders_ytd' : 'orders_year';
    const [ordersResult, prevOrdersResult, customersResult] = await Promise.all([
      cachedFetch(cacheKey(cacheEntityType, period), getTTL(cacheEntityType),
        () => fetchOrders(client, startDate, endDate, true)),
      cachedFetch(cacheKey('orders_year', String(year - 1)), getTTL('orders_year'),
        () => fetchOrders(client, prevStartDate, prevEndDate, false)),
      cachedFetch(cacheKey('customers', 'all'), getTTL('customers'),
        () => fetchCustomers(client)),
    ]);

    // Aggregate and group
    const aggregate = aggregateOrders(ordersResult.data, prevOrdersResult.data, period);
    const entities = groupByDimension(groupBy as Dimension, ordersResult.data, customersResult.data);

    // Derive years available from order dates
    const years = new Set(ordersResult.data.map(o => new Date(o.CURDATE).getUTCFullYear().toString()));
    // Also check prev year data
    prevOrdersResult.data.forEach(o => years.add(new Date(o.CURDATE).getUTCFullYear().toString()));

    const payload: DashboardPayload = {
      entities,
      ...aggregate,
      yearsAvailable: [...years].sort().reverse(),
    };

    const response: ApiResponse<DashboardPayload> = {
      data: payload,
      meta: {
        cached: ordersResult.cached,
        cachedAt: ordersResult.cachedAt,
        period,
        dimension: groupBy,
        entityCount: entities.length,
      },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Write the contacts route**

```typescript
// FILE: server/src/routes/contacts.ts
// PURPOSE: GET /api/sales/contacts?customerId=C00001 — fetch contacts for one customer
// USED BY: client/hooks/useContacts.ts
// EXPORTS: contactsRouter

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/request-validator.js';
import { PriorityClient } from '../services/priority-client.js';
import { fetchContacts } from '../services/priority-queries.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import { env } from '../config/env.js';
import type { Contact } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

const querySchema = z.object({
  customerId: z.string().min(1),
});

export const contactsRouter = Router();

contactsRouter.get('/contacts', validateQuery(querySchema), async (req, res, next) => {
  try {
    const { customerId } = req.query as z.infer<typeof querySchema>;
    const client = new PriorityClient({
      baseUrl: env.PRIORITY_BASE_URL,
      username: env.PRIORITY_USERNAME,
      password: env.PRIORITY_PASSWORD,
    });

    const result = await cachedFetch(
      cacheKey('contacts', customerId),
      getTTL('contacts'),
      async () => {
        const raw = await fetchContacts(client, customerId);
        return raw.map(c => ({
          fullName: c.NAME,
          position: c.POSITIONDES,
          phone: c.CELLPHONE || c.PHONENUM,
          email: c.EMAIL,
        })) satisfies Contact[];
      },
    );

    const response: ApiResponse<Contact[]> = {
      data: result.data,
      meta: {
        cached: result.cached,
        cachedAt: result.cachedAt,
        period: 'all',
        dimension: 'contacts',
        entityCount: result.data.length,
      },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Write the health route**

```typescript
// FILE: server/src/routes/health.ts
// PURPOSE: GET /api/health — liveness check for Railway
// USED BY: Railway health checks, monitoring
// EXPORTS: healthRouter

import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/ server/src/middleware/
git commit -m "feat(server): add dashboard, contacts, health API routes with Zod validation"
```

---

## Task 10: Express Server Entry Point

**Files:**
- Create: `server/src/index.ts`

- [ ] **Step 1: Write server entry point**

```typescript
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
  const clientDist = path.join(__dirname, '../../client/dist');
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd server && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(server): add Express entry point with route mounting and production static serving"
```

---

## Task 11: Integration Test — Dashboard Route

**Files:**
- Create: `server/tests/routes/dashboard.test.ts`

- [ ] **Step 1: Write integration test for dashboard route**

```typescript
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

import request from 'supertest'; // Will need to add supertest to devDependencies
import { app } from '../../src/index';

describe('GET /api/sales/dashboard', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Default: return empty data for all Priority calls
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ value: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
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
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ value: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
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
```

- [ ] **Step 2: Add supertest to devDependencies**

Run: `cd server && npm install -D supertest @types/supertest`

- [ ] **Step 3: Run all tests**

Run: `cd server && npx vitest run`
Expected: All tests PASS (formatting: 16, priority-client: 6, data-aggregator: 11, dimension-grouper: 4, cache-layer: 2, routes: 6 = **45 total**)

- [ ] **Step 4: Commit**

```bash
git add server/tests/routes/dashboard.test.ts server/package.json server/package-lock.json
git commit -m "test(server): add integration tests for dashboard, contacts, health routes"
```

---

## Task 12: Final Backend Verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd server && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run full test suite**

Run: `cd server && npx vitest run`
Expected: All 45 tests PASS, 0 failures

- [ ] **Step 3: Start the dev server (manual smoke test)**

Run: `cd server && npm run dev`
Expected: `[server] listening on port 3001 (development)` — will fail on API calls without .env, but server starts

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore(server): Plan A complete — backend with Priority ERP client, aggregation, caching, routes"
```

---

## Plan A Summary

| Task | What | Tests |
|------|------|-------|
| 0 | Project scaffolding (package.json, tsconfig, vitest) | — |
| 1 | Shared types (dashboard payload, API envelope) | — |
| 2 | Shared formatting utils | 16 tests |
| 3 | Server config (env vars, constants, field lists) | — |
| 4 | Priority OData client (auth, pagination, rate limiting, error parsing) | 6 tests |
| 5 | Priority query builders (orders, customers, zones, agents, vendors, contacts) | — |
| 6 | Data aggregator (KPIs, monthly, product mix, top 10, tables) | 11 tests |
| 7 | Dimension grouper (6 dimensions) | 4 tests |
| 8 | Redis cache layer (get-or-fetch, TTLs) | 2 tests |
| 9 | API routes (dashboard, contacts, health) + middleware | — |
| 10 | Express server entry point | — |
| 11 | Integration tests for routes | 6 tests |
| 12 | Final verification | — |

**Total: 13 tasks, ~60 steps, 45 tests, 15 files created**

---

## Parallelization Map

Use `dispatching-parallel-agents` to run independent tasks concurrently.

```
Sequential prerequisites:
  Task 0 (scaffolding) → Task 1 (shared types) → Task 3 (config)

After Task 3, these are INDEPENDENT and can run in parallel:
  ┌─ Agent 1: Task 4 (Priority client) → Task 5 (query builders)
  ├─ Agent 2: Task 6 (data aggregator)
  └─ Agent 3: Task 7 (dimension grouper)

After all 3 agents complete:
  Task 8 (cache layer) — independent, can start anytime after Task 3

After Tasks 4-8 all complete:
  Task 9 (routes) → Task 10 (server entry) → Task 11 (integration tests) → Task 12 (verification)
```

**Why these are independent:**
- Tasks 4-5 (client + queries): Only depends on config constants. Writes to `services/priority-client.ts` and `services/priority-queries.ts`
- Task 6 (aggregator): Only depends on shared types + query types. Writes to `services/data-aggregator.ts`
- Task 7 (grouper): Only depends on shared types + query types. Writes to `services/dimension-grouper.ts`
- Task 8 (cache): Only depends on config constants + redis. Writes to `cache/` directory

**No shared state conflicts:** Each agent writes to different files in different directories.

### Agent Prompt Templates

**Agent 1 — Priority Client:**
```
Implement Tasks 4-5 from docs/plans/2026-03-30-plan-a-backend.md.

Context: You're building the HTTP client for Priority ERP's OData API.
- Task 4: priority-client.ts with auth, pagination, rate limiting, error parsing
- Task 5: priority-queries.ts with query builders for ORDERS, CUSTOMERS, etc.

Dependencies already created: server/src/config/constants.ts, shared/types/dashboard.ts
Constraints: Only write to server/src/services/ and server/tests/services/
Output: Summary of what you built + test results
```

**Agent 2 — Data Aggregator:**
```
Implement Task 6 from docs/plans/2026-03-30-plan-a-backend.md.

Context: You're building the data aggregation layer that transforms raw Priority
orders + line items into dashboard-ready KPIs, charts, and tables.

Dependencies: shared/types/dashboard.ts, server/src/services/priority-queries.ts (types only)
Constraints: Only write to server/src/services/data-aggregator.ts and server/tests/
Output: Summary + test results for all 11 tests
```

**Agent 3 — Dimension Grouper:**
```
Implement Task 7 from docs/plans/2026-03-30-plan-a-backend.md.

Context: You're building the dimension grouper that takes raw orders + customers
and groups them into entity lists by 6 dimensions (customer, zone, vendor, brand,
product_type, product).

Dependencies: shared/types/dashboard.ts, server/src/services/priority-queries.ts (types only)
Constraints: Only write to server/src/services/dimension-grouper.ts and server/tests/
Output: Summary + test results for all 4 tests
```
