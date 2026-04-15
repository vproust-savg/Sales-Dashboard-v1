# Force-refresh in Report — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-visible force-refresh affordance to the Report flow that clears both current-year and prior-year raw-order caches before re-fetching from Priority, so users can recover from stale data caused by retroactive edits to closed-period orders.

**Architecture:** Three-layer change. (1) Server extends the existing `refresh=true` branch in `fetch-all.ts` to also delete `orders_year:{prev-year}:{filterHash}` before the full-fetch rebuild. (2) Client extracts URL construction from `useReport` into a pure `buildReportUrl()` utility — testable without React Testing Library, which the project does not have — and adds a `forceRefresh?: boolean` parameter. (3) `ReportFilterModal` gains a checkbox whose state flows through `onConfirm → DashboardLayout.handleReportStart → useReport.startReport → buildReportUrl`.

**Tech Stack:** TypeScript strict (both sides); React 19 + Tailwind v4 (client); Express + zod + Upstash Redis + supertest (server); vitest (both).

**Spec reference:** `docs/specs/2026-04-15-force-refresh-report-design.md` (committed as `da19b0c` on `main`).

---

## File Structure

### New files
| Path | Purpose |
|---|---|
| `client/src/hooks/build-report-url.ts` | Pure URL constructor for the Report SSE endpoint |
| `client/src/hooks/__tests__/build-report-url.test.ts` | Unit tests for `buildReportUrl` |
| `server/src/routes/__tests__/fetch-all.test.ts` | Route tests for `/api/sales/fetch-all` (no prior tests for this route) |

### Modified files
| Path | Change |
|---|---|
| `server/src/routes/fetch-all.ts` | Extend force-refresh branch: +1 `redis.del` call for prev-year raw orders |
| `client/src/hooks/useReport.ts` | Import and call `buildReportUrl`; add `forceRefresh?: boolean` to `startReport` signature |
| `client/src/components/shared/ReportFilterModal.tsx` | Add `forceRefresh` local state + checkbox UI; update `onConfirm` signature |
| `client/src/layouts/DashboardLayout.tsx` | Adapt `handleReportStart` to the new `onConfirm` signature |

All changes stay under the 300-line-per-file rule: post-change estimates are `useReport.ts` ~120, `ReportFilterModal.tsx` ~205, `fetch-all.ts` ~225.

---

## Commit strategy

One commit per phase, clean chronological history for the final PR merge commit:
1. `feat(server): force-refresh also clears prev-year raw cache`
2. `refactor(client): extract buildReportUrl utility with forceRefresh support`
3. `feat(client): force-refresh checkbox in ReportFilterModal`

PR merge strategy: **Merge commit** (NOT squash) — preserves each layer as an independent revert anchor, matching the precedent set by PR #2.

---

## Phase 0 — Branch setup

### Task 0.1: Create feature branch off merged main

**Files:** none modified; creates the working branch.

- [ ] **Step 1: Verify clean working tree on main at `da19b0c`**

Run: `cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1" && git status --short --branch && git log --oneline -1`

Expected output:
```
## main...origin/main
da19b0c docs: spec for force-refresh in Report (Codex Finding 2 follow-up)
```

If the working tree is dirty or HEAD is not `da19b0c`: STOP. Investigate before proceeding. Do not proceed with a dirty tree.

- [ ] **Step 2: Create and check out the feature branch**

Run: `git checkout -b feat/force-refresh-report`

Expected: `Switched to a new branch 'feat/force-refresh-report'`

- [ ] **Step 3: Push the new branch upstream**

Run: `git push -u origin feat/force-refresh-report`

Expected: remote branch created, upstream tracking set.

---

## Phase 1 — Server: extend force-refresh to clear prev-year cache

### Task 1.1: Write failing tests for `/api/sales/fetch-all` cache-delete behavior

**Files:**
- Create: `server/src/routes/__tests__/fetch-all.test.ts`
- Test: same file

- [ ] **Step 1: Create the test file with three cases**

Write `server/src/routes/__tests__/fetch-all.test.ts` with the full content below. This establishes the test file and follows the mocking pattern from `cache-status.test.ts`.

```typescript
// FILE: server/src/routes/__tests__/fetch-all.test.ts
// PURPOSE: Tests for GET /api/sales/fetch-all — focuses on cache-delete behavior for refresh=true
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// WHY: Mock the boundary dependencies so we can observe Redis del calls without
// a real Redis or Priority API. The SSE endpoint's behavior is deterministic
// once these three mocks are in place.

vi.mock('../../cache/redis-client.js', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../../cache/cache-layer.js', () => ({
  cachedFetch: vi.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => {
    const data = await fn();
    return { data, cached: false, cachedAt: new Date().toISOString() };
  }),
}));

vi.mock('../../services/priority-instance.js', () => ({
  priorityClient: {},
}));

vi.mock('../../services/priority-queries.js', () => ({
  fetchOrders: vi.fn().mockResolvedValue([]),
  fetchCustomers: vi.fn().mockResolvedValue([]),
}));

// Import AFTER mocks are set up so the route picks up the mocked modules.
import { fetchAllRouter } from '../fetch-all.js';
import { redis } from '../../cache/redis-client.js';

function makeApp() {
  const app = express();
  app.use('/api/sales', fetchAllRouter);
  return app;
}

describe('GET /api/sales/fetch-all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
    (redis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
  });

  it('with refresh=true: deletes current-year raw, meta, AND prev-year raw caches', async () => {
    const year = new Date().getFullYear();

    await request(makeApp())
      .get('/api/sales/fetch-all?period=ytd&refresh=true')
      .expect(200);

    const delCalls = (redis.del as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(delCalls).toContain('dashboard:orders_raw:ytd:all');
    expect(delCalls).toContain('dashboard:orders_raw_meta:ytd:all');
    expect(delCalls).toContain(`dashboard:orders_year:${year - 1}:all`);
  });

  it('without refresh: does NOT delete any raw caches (uses incremental path or full fetch)', async () => {
    const year = new Date().getFullYear();

    await request(makeApp())
      .get('/api/sales/fetch-all?period=ytd')
      .expect(200);

    const delCalls = (redis.del as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(delCalls).not.toContain('dashboard:orders_raw:ytd:all');
    expect(delCalls).not.toContain(`dashboard:orders_year:${year - 1}:all`);
  });

  it('with refresh=true AND agentName filter: prev-year del uses the same filterHash', async () => {
    const year = new Date().getFullYear();

    await request(makeApp())
      .get('/api/sales/fetch-all?period=ytd&refresh=true&agentName=Alexandra')
      .expect(200);

    const delCalls = (redis.del as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(delCalls).toContain(`dashboard:orders_raw:ytd:agent=Alexandra`);
    expect(delCalls).toContain(`dashboard:orders_raw_meta:ytd:agent=Alexandra`);
    expect(delCalls).toContain(`dashboard:orders_year:${year - 1}:agent=Alexandra`);
  });
});
```

- [ ] **Step 2: Run the new tests — confirm the third test FAILS**

Run: `cd server && npx vitest run src/routes/__tests__/fetch-all.test.ts`

Expected: first two tests pass (existing behavior already covers them), third test FAILS because the server does not yet delete the prev-year key. The failure message will look like:

```
AssertionError: expected [ 'dashboard:orders_raw:ytd:agent=Alexandra', … ] to contain 'dashboard:orders_year:2025:agent=Alexandra'
```

If all three pass, re-read the server code — the test is broken (probably the mock returned a cached value, skipping the del branch). Do not proceed to implementation if the failing test is not actually red.

---

### Task 1.2: Extend `fetch-all.ts` force-refresh branch

**Files:**
- Modify: `server/src/routes/fetch-all.ts:77-82`

- [ ] **Step 1: Locate the force-refresh else-branch**

The current code in `server/src/routes/fetch-all.ts`:

```typescript
} else {
  // Force refresh: delete cache, do full fetch
  await redis.del(rawKey);
  await redis.del(metaKey);
  orders = await fullFetch(startDate, endDate, extraFilter, sendEvent);
}
```

- [ ] **Step 2: Add the prev-year delete**

Replace the block with:

```typescript
} else {
  // WHY: Force refresh clears both current-period raw + prev-year raw caches
  // under the same filterHash. Without clearing prev-year, retroactive edits
  // to closed-period orders would still be served from the stale prev-year
  // cache, breaking YoY accuracy. The subsequent cachedFetch call for
  // orders_year below will miss and re-fetch from Priority.
  await redis.del(rawKey);
  await redis.del(metaKey);
  await redis.del(cacheKey('orders_year', String(year - 1), filterHash));
  orders = await fullFetch(startDate, endDate, extraFilter, sendEvent);
}
```

- [ ] **Step 3: Run tests — confirm all three now pass**

Run: `cd server && npx vitest run src/routes/__tests__/fetch-all.test.ts`

Expected: `Test Files 1 passed (1) / Tests 3 passed (3)`

If any test still fails: STOP. Re-read the test output — either the implementation is incorrect (wrong cache key, wrong condition) or the mock setup is leaking state between tests.

- [ ] **Step 4: Run the full server test suite to guard against regressions**

Run: `cd server && npx vitest run`

Expected: all tests pass (previous session had 121 passing; this change adds 3 more → 124 passing).

If any previously-passing test fails: STOP. The change has broken another test — most likely the redis mock is interfering with tests that previously read real (fake) cache envelopes. Investigate.

- [ ] **Step 5: TypeScript check**

Run: `cd server && npx tsc --noEmit`

Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/fetch-all.ts server/src/routes/__tests__/fetch-all.test.ts
git commit -m "$(cat <<'EOF'
feat(server): force-refresh also clears prev-year raw cache

fetch-all.ts force-refresh branch now deletes
dashboard:orders_year:{year-1}:{filterHash} in addition to the current-year
raw + meta envelopes. Without this, retroactive edits to prior-year orders
(e.g., invoice corrections, returned items processed late) would remain
silently stale up to the 365-day prev-year cache TTL, breaking YoY math.

The subsequent cachedFetch call for prev-year orders later in the same
handler will now miss and re-fetch from Priority, matching the intent of
a "force full refresh" from the user's perspective.

Addresses Codex Finding 2 on PR #2.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Client: extract `buildReportUrl` utility, thread `forceRefresh`

### Task 2.1: Create `buildReportUrl` pure utility (TDD)

**Files:**
- Create: `client/src/hooks/build-report-url.ts`
- Create: `client/src/hooks/__tests__/build-report-url.test.ts`

- [ ] **Step 1: Write the failing test file first**

Create `client/src/hooks/__tests__/build-report-url.test.ts`:

```typescript
// FILE: client/src/hooks/__tests__/build-report-url.test.ts
// PURPOSE: Tests for buildReportUrl pure URL constructor
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { buildReportUrl } from '../build-report-url';

describe('buildReportUrl', () => {
  it('builds baseline URL with just dimension and period', () => {
    const url = buildReportUrl('customer', 'ytd', {});
    expect(url).toBe('/api/sales/fetch-all?groupBy=customer&period=ytd');
  });

  it('does NOT include refresh param by default', () => {
    const url = buildReportUrl('customer', 'ytd', {});
    expect(url).not.toContain('refresh');
  });

  it('includes refresh=true when forceRefresh=true', () => {
    const url = buildReportUrl('customer', 'ytd', {}, true);
    expect(url).toContain('refresh=true');
  });

  it('does NOT include refresh when forceRefresh is explicitly false', () => {
    const url = buildReportUrl('customer', 'ytd', {}, false);
    expect(url).not.toContain('refresh');
  });

  it('includes agentName when filters.agentName is set', () => {
    const url = buildReportUrl('customer', 'ytd', { agentName: ['Alexandra'] });
    expect(url).toContain('agentName=Alexandra');
  });

  it('joins multiple agent names with comma (URL-encoded)', () => {
    const url = buildReportUrl('customer', 'ytd', { agentName: ['Alice', 'Bob'] });
    expect(url).toContain('agentName=Alice%2CBob');
  });

  it('includes zone filter', () => {
    const url = buildReportUrl('customer', 'ytd', { zone: ['East'] });
    expect(url).toContain('zone=East');
  });

  it('includes customerType filter', () => {
    const url = buildReportUrl('customer', 'ytd', { customerType: ['Retail'] });
    expect(url).toContain('customerType=Retail');
  });

  it('combines filters + forceRefresh correctly', () => {
    const url = buildReportUrl(
      'customer',
      'ytd',
      { agentName: ['Alexandra'], zone: ['East'] },
      true,
    );
    expect(url).toContain('agentName=Alexandra');
    expect(url).toContain('zone=East');
    expect(url).toContain('refresh=true');
  });

  it('omits empty-array filters', () => {
    const url = buildReportUrl('customer', 'ytd', { agentName: [] });
    expect(url).not.toContain('agentName');
  });

  it('URL is parseable back to same params', () => {
    const url = buildReportUrl('vendor', '2024', { customerType: ['Retail'] }, true);
    const search = new URL(url, 'http://localhost').searchParams;
    expect(search.get('groupBy')).toBe('vendor');
    expect(search.get('period')).toBe('2024');
    expect(search.get('customerType')).toBe('Retail');
    expect(search.get('refresh')).toBe('true');
  });
});
```

- [ ] **Step 2: Run the test — confirm it FAILS because the module does not exist**

Run: `cd client && npx vitest run src/hooks/__tests__/build-report-url.test.ts`

Expected: failure with message like `Failed to resolve import "../build-report-url" from "src/hooks/__tests__/build-report-url.test.ts"`.

- [ ] **Step 3: Create the `buildReportUrl` module**

Create `client/src/hooks/build-report-url.ts`:

```typescript
// FILE: client/src/hooks/build-report-url.ts
// PURPOSE: Build the SSE URL for /api/sales/fetch-all — pure function, testable without React
// USED BY: client/src/hooks/useReport.ts
// EXPORTS: buildReportUrl

import type { Dimension, Period, FetchAllFilters } from '@shared/types/dashboard';

/**
 * Build the EventSource URL for a Report run.
 * WHY: Extracted from useReport so the URL contract (query param names, forceRefresh
 * passthrough) can be unit-tested without a React Testing Library render harness.
 */
export function buildReportUrl(
  dimension: Dimension,
  period: Period,
  filters: FetchAllFilters,
  forceRefresh = false,
): string {
  const params = new URLSearchParams({ groupBy: dimension, period });
  if (filters.agentName?.length) params.set('agentName', filters.agentName.join(','));
  if (filters.zone?.length) params.set('zone', filters.zone.join(','));
  if (filters.customerType?.length) params.set('customerType', filters.customerType.join(','));
  if (forceRefresh) params.set('refresh', 'true');
  return `/api/sales/fetch-all?${params}`;
}
```

- [ ] **Step 4: Run the test — confirm all cases pass**

Run: `cd client && npx vitest run src/hooks/__tests__/build-report-url.test.ts`

Expected: `Test Files 1 passed (1) / Tests 11 passed (11)`

If any test fails: STOP. Either the implementation is wrong or a test expectation is wrong. Fix before proceeding.

---

### Task 2.2: Wire `buildReportUrl` into `useReport.ts`

**Files:**
- Modify: `client/src/hooks/useReport.ts`

- [ ] **Step 1: Update the imports**

At the top of `useReport.ts`, add:

```typescript
import { buildReportUrl } from './build-report-url';
```

- [ ] **Step 2: Update the `UseReportReturn` interface**

Change:
```typescript
export interface UseReportReturn {
  state: ReportState;
  progress: SSEProgressEvent | null;
  payload: DashboardPayload | null;
  error: string | null;
  filters: FetchAllFilters;
  open: () => void;
  cancel: () => void;
  startReport: (filters: FetchAllFilters) => void;
  abort: () => void;
  reset: () => void;
}
```

To:
```typescript
export interface UseReportReturn {
  state: ReportState;
  progress: SSEProgressEvent | null;
  payload: DashboardPayload | null;
  error: string | null;
  filters: FetchAllFilters;
  open: () => void;
  cancel: () => void;
  /** WHY: forceRefresh is optional for backward compatibility; defaults to false. */
  startReport: (filters: FetchAllFilters, forceRefresh?: boolean) => void;
  abort: () => void;
  reset: () => void;
}
```

- [ ] **Step 3: Update `startReport` signature and body**

Change:
```typescript
const startReport = useCallback((newFilters: FetchAllFilters) => {
  abort();
  setFilters(newFilters);
  // WHY: Without clearing payload, if the second fetch hits the same cache (e.g., user
  // re-ran the same filter by accident), the UI renders identical data and looks "stuck"
  // on the first report. Clearing first forces the placeholder / progress modal to show.
  setPayload(null);
  setState('fetching');
  setError(null);
  setProgress(null);

  const params = new URLSearchParams({ groupBy: dimension, period });
  if (newFilters.agentName?.length) params.set('agentName', newFilters.agentName.join(','));
  if (newFilters.zone?.length) params.set('zone', newFilters.zone.join(','));
  if (newFilters.customerType?.length) params.set('customerType', newFilters.customerType.join(','));

  const es = new EventSource(`/api/sales/fetch-all?${params}`);
  eventSourceRef.current = es;
  // ... event listeners unchanged ...
}, [dimension, period, abort, queryClient]);
```

To:
```typescript
const startReport = useCallback((newFilters: FetchAllFilters, forceRefresh = false) => {
  abort();
  setFilters(newFilters);
  // WHY: Without clearing payload, if the second fetch hits the same cache (e.g., user
  // re-ran the same filter by accident), the UI renders identical data and looks "stuck"
  // on the first report. Clearing first forces the placeholder / progress modal to show.
  setPayload(null);
  setState('fetching');
  setError(null);
  setProgress(null);

  const es = new EventSource(buildReportUrl(dimension, period, newFilters, forceRefresh));
  eventSourceRef.current = es;
  // ... event listeners unchanged ...
}, [dimension, period, abort, queryClient]);
```

Leave the `es.addEventListener('progress', ...)`, `es.addEventListener('complete', ...)`, and `es.addEventListener('error', ...)` blocks untouched.

- [ ] **Step 4: Run client type check**

Run: `cd client && npx tsc -b --noEmit`

Expected: no output (clean). If there are errors: verify the import path (`./build-report-url`, no `.js` extension in source), the `forceRefresh = false` default parameter, and that `buildReportUrl` is properly exported.

- [ ] **Step 5: Run full client test suite**

Run: `cd client && npx vitest run`

Expected: `Test Files 5 passed (5) / Tests 57 passed (57)` (46 previous + 11 new `buildReportUrl` tests).

If any previously-passing test fails: STOP. Investigate before proceeding.

- [ ] **Step 6: Commit**

```bash
git add client/src/hooks/build-report-url.ts client/src/hooks/__tests__/build-report-url.test.ts client/src/hooks/useReport.ts
git commit -m "$(cat <<'EOF'
refactor(client): extract buildReportUrl utility with forceRefresh support

useReport's URL construction is now a pure function in build-report-url.ts.
This makes the URL contract (query param names, forceRefresh passthrough)
unit-testable without a React Testing Library render harness — the client
project has only vitest, no @testing-library/react. 11 test cases cover
the URL contract end-to-end.

useReport.startReport gains an optional forceRefresh boolean parameter,
defaulting to false. Existing callers that pass one argument continue to
work unchanged. When forceRefresh is true, the URL includes refresh=true
which the server's existing force-refresh branch will honor.

No runtime behavior change yet; the UI affordance lands in the next commit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Client: `ReportFilterModal` force-refresh checkbox

### Task 3.1: Add `forceRefresh` state + checkbox UI in `ReportFilterModal`

**Files:**
- Modify: `client/src/components/shared/ReportFilterModal.tsx`

- [ ] **Step 1: Update the `ReportFilterModalProps` interface**

Change:
```typescript
interface ReportFilterModalProps {
  isOpen: boolean;
  entities: EntityListItem[];
  onConfirm: (filters: FetchAllFilters) => void;
  onCancel: () => void;
}
```

To:
```typescript
interface ReportFilterModalProps {
  isOpen: boolean;
  entities: EntityListItem[];
  /** WHY: forceRefresh is passed through so the caller can threadit to useReport.startReport. */
  onConfirm: (filters: FetchAllFilters, forceRefresh: boolean) => void;
  onCancel: () => void;
}
```

- [ ] **Step 2: Add `forceRefresh` state inside `ReportFilterModalContent`**

Locate the existing state declarations near the top of `ReportFilterModalContent`:

```typescript
const [selectedReps, setSelectedReps] = useState<string[]>([]);
const [selectedZones, setSelectedZones] = useState<string[]>([]);
const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
```

Add a new state line immediately below:

```typescript
const [selectedReps, setSelectedReps] = useState<string[]>([]);
const [selectedZones, setSelectedZones] = useState<string[]>([]);
const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
// WHY: Resets to false each time the modal opens. The outer component
// only mounts ReportFilterModalContent while isOpen, so useState naturally
// reinitializes on reopen (matches the existing pattern for filter state).
const [forceRefresh, setForceRefresh] = useState<boolean>(false);
```

- [ ] **Step 3: Update `handleConfirm` to pass `forceRefresh`**

Change:
```typescript
const handleConfirm = () => {
  const filters: FetchAllFilters = {};
  if (selectedReps.length > 0) filters.agentName = selectedReps;
  if (selectedZones.length > 0) filters.zone = selectedZones;
  if (selectedTypes.length > 0) filters.customerType = selectedTypes;
  onConfirm(filters);
};
```

To:
```typescript
const handleConfirm = () => {
  const filters: FetchAllFilters = {};
  if (selectedReps.length > 0) filters.agentName = selectedReps;
  if (selectedZones.length > 0) filters.zone = selectedZones;
  if (selectedTypes.length > 0) filters.customerType = selectedTypes;
  onConfirm(filters, forceRefresh);
};
```

- [ ] **Step 4: Add the checkbox UI between filter fields and the count label**

Locate this block in the JSX:

```tsx
<FilterField label="Sales Rep" options={reps} selected={selectedReps} onChange={setSelectedReps} />
<FilterField label="Zone" options={zones} selected={selectedZones} onChange={setSelectedZones} />
<FilterField label="Customer Type" options={types} selected={selectedTypes} onChange={setSelectedTypes} />

<p className="text-center text-[12px] text-[var(--color-text-muted)]">
  Fetching data for {formatInteger(estimatedCount)} customers. Estimated 4&ndash;7 minutes.
</p>
```

Insert the checkbox label between the last `FilterField` and the count paragraph:

```tsx
<FilterField label="Sales Rep" options={reps} selected={selectedReps} onChange={setSelectedReps} />
<FilterField label="Zone" options={zones} selected={selectedZones} onChange={setSelectedZones} />
<FilterField label="Customer Type" options={types} selected={selectedTypes} onChange={setSelectedTypes} />

<label className="flex cursor-pointer items-start gap-[var(--spacing-sm)]">
  <input
    type="checkbox"
    checked={forceRefresh}
    onChange={(e) => setForceRefresh(e.target.checked)}
    className="mt-[2px] h-[14px] w-[14px] accent-[var(--color-gold-primary)]"
  />
  <span className="text-[12px] leading-snug text-[var(--color-text-secondary)]">
    <span className="font-medium">Force full refresh from Priority</span>
    <span className="text-[var(--color-text-muted)]"> (slower, ~1–5 min)</span>
    <br />
    <span className="text-[var(--color-text-muted)]">
      Re-fetches all orders including any retroactive edits. Use when YoY numbers look off.
    </span>
  </span>
</label>

<p className="text-center text-[12px] text-[var(--color-text-muted)]">
  Fetching data for {formatInteger(estimatedCount)} customers. Estimated 4&ndash;7 minutes.
</p>
```

All styling uses CSS custom property tokens — no hardcoded hex values. Label uses the existing `--color-gold-primary` accent for the checkbox, matching the `FilterField` checkbox style at line 167 of the current file.

- [ ] **Step 5: Verify client type check**

Run: `cd client && npx tsc -b --noEmit`

Expected: an error in `DashboardLayout.tsx` because `onConfirm` signature changed and `handleReportStart` still takes only `filters`. This is expected — we fix it in Task 3.2.

Example expected error:
```
src/layouts/DashboardLayout.tsx:133:19 - error TS2322: Type '(filters: FetchAllFilters) => void' is not assignable to type '(filters: FetchAllFilters, forceRefresh: boolean) => void'.
```

If the error is elsewhere (e.g., in ReportFilterModal itself): STOP. The modal edit is incorrect.

---

### Task 3.2: Adapt `DashboardLayout.handleReportStart` to new signature

**Files:**
- Modify: `client/src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Update `handleReportStart`**

Locate line 120 in `DashboardLayout.tsx`:

```typescript
const handleReportStart = (filters: FetchAllFilters) => { report.startReport(filters); };
```

Change to:

```typescript
const handleReportStart = (filters: FetchAllFilters, forceRefresh: boolean) => {
  report.startReport(filters, forceRefresh);
};
```

- [ ] **Step 2: Run client type check — confirm clean**

Run: `cd client && npx tsc -b --noEmit`

Expected: no output (clean).

If there are errors: investigate. Most likely cause is a leftover reference to the old signature somewhere else, but a full-repo `grep` should find nothing.

- [ ] **Step 3: Run full client test suite**

Run: `cd client && npx vitest run`

Expected: `Test Files 5 passed (5) / Tests 57 passed (57)` — no change from Phase 2; the UI change does not affect tests.

- [ ] **Step 4: Run client bundle build**

Run: `cd client && npx vite build`

Expected: successful build with gzip size reported. The bundle must remain under 500 KB gzip (current baseline ~151 KB gzip; this change is ~30 lines of UI + a pure utility, adds <1 KB gzip).

If bundle fails: STOP. Investigate the build output.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/shared/ReportFilterModal.tsx client/src/layouts/DashboardLayout.tsx
git commit -m "$(cat <<'EOF'
feat(client): force-refresh checkbox in ReportFilterModal

Adds a 'Force full refresh from Priority (slower, ~1-5 min)' checkbox
inside ReportFilterModal. Local state defaults to false on every modal
open (the outer component only mounts content while isOpen, so useState
reinitializes naturally — matches the existing pattern for filter state).

The checkbox value flows through:
  Modal local state
    -> onConfirm(filters, forceRefresh)
    -> DashboardLayout.handleReportStart(filters, forceRefresh)
    -> useReport.startReport(filters, forceRefresh)
    -> buildReportUrl(..., forceRefresh)
    -> EventSource URL with refresh=true
    -> server force-refresh branch (clears current + prev-year raw caches)

Closes Codex Finding 2 on PR #2.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Final verification + PR

### Task 4.1: Full pre-commit verification gate

**Files:** none modified; verification only.

- [ ] **Step 1: Run all four TypeScript + test gates sequentially**

```bash
cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1"
cd client && npx tsc -b --noEmit && cd ..
cd server && npx tsc --noEmit && cd ..
cd server && npx vitest run && cd ..
cd client && npx vitest run && cd ..
cd client && npx vite build && cd ..
```

Expected:
- Client tsc: clean (no output)
- Server tsc: clean
- Server tests: 124 passed (121 baseline + 3 new)
- Client tests: 57 passed (46 baseline + 11 new)
- Client bundle: successful; gzip size <500 KB

If any gate fails: STOP. Diagnose and fix before proceeding to PR.

- [ ] **Step 2: Run the `any` / `as any` grep guardrail**

Run: `cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1" && grep -rn ": any\|as any" server/src/ client/src/ | grep -v "__tests__"`

Expected: no lines returned (or only lines that existed before this change — `git diff` should show this grep result is unchanged versus `main`).

The new test files at `__tests__/` paths are excluded because `ReturnType<typeof vi.fn>` is acceptable in test mocks.

- [ ] **Step 3: Run the file-size guardrail**

Run: `cd "/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1" && wc -l $(git diff --name-only main...HEAD | grep -E '\.(ts|tsx)$' | grep -v '__tests__')`

Expected: no file exceeds 300 lines. Post-change estimates:
- `client/src/hooks/useReport.ts` ~115
- `client/src/hooks/build-report-url.ts` ~25
- `client/src/components/shared/ReportFilterModal.tsx` ~205
- `client/src/layouts/DashboardLayout.tsx` unchanged line count
- `server/src/routes/fetch-all.ts` ~225

If any file exceeds 300 lines: STOP. Split per LLM-optimized rule.

---

### Task 4.2: Push branch and open PR

**Files:** none modified; remote state only.

- [ ] **Step 1: Verify branch status**

Run: `git status --short --branch && git log --oneline main..HEAD`

Expected:
```
## feat/force-refresh-report...origin/feat/force-refresh-report
<sha>  feat(client): force-refresh checkbox in ReportFilterModal
<sha>  refactor(client): extract buildReportUrl utility with forceRefresh support
<sha>  feat(server): force-refresh also clears prev-year raw cache
```

Three commits, branch ahead of origin by 3 if no intermediate push was made, or by 0 if `git push` was run during phases.

- [ ] **Step 2: Push all commits**

Run: `git push`

Expected: branch updated on origin.

- [ ] **Step 3: Open PR with merge-commit reminder**

Run (single command; use HEREDOC for body):

```bash
gh pr create --base main --head feat/force-refresh-report \
  --title "feat: force-refresh checkbox in Report (Codex Finding 2 follow-up)" \
  --body "$(cat <<'EOF'
## Summary

Addresses Codex adversarial review [Finding 2](https://github.com/vproust-savg/Sales-Dashboard-v1/pull/2#issuecomment-4249986036) on PR #2: the client had no way to trigger the server's existing \`refresh=true\` path, so retroactive edits to old orders in Priority could silently persist in the cache for up to 365 days.

## What changed

- **Server (\`fetch-all.ts\`):** force-refresh branch now also deletes \`dashboard:orders_year:{year-1}:{filterHash}\`. The existing delete of current-year raw + meta stays. Prev-year cache-fetch later in the same handler now misses and re-fetches from Priority.
- **Client (\`buildReportUrl\`):** URL construction extracted from \`useReport\` into a pure function, unit-tested exhaustively (11 cases) without React Testing Library (which the project doesn't have).
- **Client (\`useReport.startReport\`):** optional \`forceRefresh\` parameter, backward-compatible default \`false\`.
- **Client (\`ReportFilterModal\`):** new checkbox 'Force full refresh from Priority (slower, ~1–5 min)' with copy explaining when to use it.
- **Client (\`DashboardLayout\`):** \`handleReportStart\` adapted to new signature.

## Spec + plan

- Spec: \`docs/specs/2026-04-15-force-refresh-report-design.md\` (on \`main\`)
- Plan: \`docs/plans/2026-04-15-force-refresh-report-plan.md\` (on \`main\`)

## Test plan

- [x] \`cd server && npx vitest run\` — 124 passed (+3 new route tests)
- [x] \`cd client && npx vitest run\` — 57 passed (+11 new \`buildReportUrl\` tests)
- [x] \`cd server && npx tsc --noEmit\` — clean
- [x] \`cd client && npx tsc -b --noEmit\` — clean
- [x] \`cd client && npx vite build\` — bundle under 500 KB gzip
- [ ] Manual smoke on Railway:
    1. Open Report filter modal → checkbox visible, unchecked
    2. Run Report with checkbox → progress completes → fresh data displayed
    3. Reopen modal → checkbox back to unchecked
    4. Run Report without checkbox → incremental-merge path (fast)
    5. Filtered refresh (e.g., \`agentName=Alexandra\`) → prev-year cache for that filter is rebuilt

## Merge strategy

**Merge commit (NOT squash)** — preserves the three-commit structure for independent revert:
- \`feat(server): force-refresh also clears prev-year raw cache\` → revert = drop server-side delete
- \`refactor(client): extract buildReportUrl utility\` → safe structural change
- \`feat(client): force-refresh checkbox\` → revert = hide the UI affordance

## Rollback

Single-line disable: remove \`if (forceRefresh) params.set('refresh', 'true')\` in \`build-report-url.ts\` — checkbox becomes a no-op, server behavior unchanged.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL returned in stdout.

- [ ] **Step 4: Return the PR URL**

The \`gh pr create\` command prints the new PR URL. Copy it and return it to the user so they can review, merge with the correct strategy, and trigger Railway deploy.

---

## Integration contracts verification (post-merge)

Per CLAUDE.md, every exported function must be imported, every state field must flow end-to-end, and default values must match across files. Before merging, verify:

1. **`buildReportUrl` is imported by useReport:** `grep -rn "buildReportUrl" client/src/` returns matches in both `build-report-url.ts` (export) and `useReport.ts` (import + call). 0 matches = bug.
2. **`forceRefresh` flows end-to-end:** trace through the call chain: `ReportFilterModal.setForceRefresh` → `handleConfirm` → `onConfirm(filters, forceRefresh)` → `DashboardLayout.handleReportStart(filters, forceRefresh)` → `report.startReport(filters, forceRefresh)` → `buildReportUrl(..., forceRefresh)` → URL query param → server route.
3. **Default alignment:** `forceRefresh = false` in client hook default, server Zod schema treats missing `refresh` as false. Symmetric.
4. **Cache key match:** client never constructs Redis keys directly; server uses the same `cacheKey('orders_year', String(year - 1), filterHash)` template for delete as it uses for read elsewhere in the same handler.
5. **No dead state:** every line of state added (`forceRefresh` in modal, the parameter on `startReport`) is observably used by at least one test or one call site.

---

## Manual smoke test script (post-deploy on Railway)

1. Open Airtable Omni iframe with the dashboard
2. Click "Report" → filter modal opens → confirm checkbox visible between filters and count line → confirm unchecked by default
3. Leave filters at defaults, check the force-refresh checkbox → click Start
4. Progress modal opens; watch SSE events flow through Phase 1 (Fetching) and Phase 2 (Processing). Expect longer total time than usual (~1–5 min).
5. On completion, Report displays with fresh data. The "Data ready" cache-status badge updates.
6. Re-open modal → checkbox is unchecked again (state did NOT persist — confirms local-state-only design)
7. Run Report without the checkbox → incremental-merge path runs, fast (<10s if cache was just rebuilt)
8. Add filter (e.g., `agentName=Alexandra`) + check force-refresh → verify: in server logs, Priority is called with an `AGENTNAME eq 'Alexandra'` filter on both the current-year AND prev-year fetch. The filtered scope is fully rebuilt.
9. Regression guard: pick a specific Disney customer → click the card → per-entity detail still loads (unrelated to force-refresh, but confirms the Phase 2 refactor didn't break the main page path).

---

## Rollback options

### Full revert
```bash
git revert -m 1 <merge-sha>
```
Single merge commit on main; reverts all three feature commits atomically.

### Partial revert (keep extraction, drop feature)
```bash
git revert <Phase-3-commit-sha>  # drop checkbox
git revert <Phase-1-commit-sha>  # drop server prev-year delete
```
Keeps `buildReportUrl` extraction (it's a pure refactor, safe) but removes the user-facing feature and the server-side delete.

### Soft-disable (no code revert)
Change the one line in `client/src/hooks/build-report-url.ts`:

```typescript
if (forceRefresh) params.set('refresh', 'true');
```

To:

```typescript
// Temporarily disabled: force-refresh does not reach the server.
// if (forceRefresh) params.set('refresh', 'true');
```

Deploy. The checkbox is still visible but does nothing. Server behavior unchanged. Useful if force-refresh is causing operational issues (Priority rate-limit pressure from multiple concurrent users) without wanting to ship a revert.

---

## Estimated effort

- Phase 0 (branch setup): 2 min
- Phase 1 (server + tests): 20–30 min
- Phase 2 (URL builder + useReport wiring): 30–40 min
- Phase 3 (modal + layout): 25–35 min
- Phase 4 (verification + PR): 15 min

**Total wall-clock:** ~1.5–2 hours for a human; <30 min with subagent-driven execution at Sonnet 4.6.
