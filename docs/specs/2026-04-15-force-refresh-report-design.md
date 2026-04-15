# Force-refresh in Report — Design Spec

**Date:** 2026-04-15
**Status:** Draft (awaiting user review)
**Owner:** Claude Code
**Addresses:** Codex adversarial review Finding 2 on PR #2 (merged as `70ec586`)

---

## Context

Codex's adversarial review of [PR #2](https://github.com/vproust-savg/Sales-Dashboard-v1/pull/2) flagged two high-severity issues. Finding 1 (legacy `__ALL__` URL state) was fixed in-scope as commit `921d105` before merge. Finding 2, captured here, is deferred to this follow-up PR:

> **No force-refresh path for stale raw cache.** `useReport.startReport` never sets `refresh=true`, but the server still supports it. With a 365-day raw-cache TTL and incremental merge that only re-fetches orders with `CURDATE >= lastFetchDate - 1 day`, retroactive edits to old orders in Priority (same `ORDNAME`, past `CURDATE`) are never propagated to the cache.

The current merge-by-ORDNAME logic in `tryIncrementalRefresh` would update corrected orders *if* they were re-fetched, but the fetch window is date-bounded so they aren't. Raw-cache TTL is 365 days, so stale rows can persist up to a year. The system works correctly under append-only order flow; it degrades silently when Priority users retroactively edit closed-period orders (e.g., returned items processed late, invoice corrections, margin adjustments).

### Why this is a separate PR from Finding 1

Finding 1 was a direct regression introduced by PR #2 (the `__ALL__` guard in `useDashboardDetail` was removed without compensating sanitization). Fixable in-scope as a one-line edit at the URL parse boundary, with tests.

Finding 2 is a feature addition: the dashboard gains a user-visible way to flush and rebuild the raw cache on demand. The force-refresh server path (`refresh=true` query param in `fetch-all.ts`) predates PR #2. This spec wires it to a UI affordance that's never existed. Different scope, different review surface, independent revert path.

---

## Scope

### In scope
- Surface a user-visible force-refresh affordance inside `ReportFilterModal` (checkbox)
- Thread a `forceRefresh: boolean` through `useReport.startReport` → URL query param `refresh=true`
- Extend the server's force-refresh branch to clear both current-year AND prior-year raw-order caches (current server behavior only clears current-year)
- Tests covering the end-to-end wiring (hook + server)

### Out of scope
- Force-refresh of the `customers:all` cache. Structural customer changes (renames, zone reassignments, new customers) continue to rely on the customers cache TTL.
- Force-refresh affordance on `View Consolidated`. Consolidated reads from the raw cache that Report populates; forcing a refresh via Report then running Consolidated yields fresh consolidated data — the indirection is acceptable.
- Admin/settings UI for broader cache management
- Observability / telemetry on force-refresh usage (potential follow-up)
- Component-level UI tests for `ReportFilterModal` — no component test infrastructure currently exists in the codebase, and adding it is a larger decision than this PR should carry. Hook-level tests plus manual smoke testing cover the wiring.

---

## Design

### UX

`ReportFilterModal` gains one checkbox row positioned between the filter dropdowns and the Start/Cancel buttons:

```
┌─────────────────────────────────────────────┐
│ [Sales Rep dropdown]                        │
│ [Zone dropdown]                             │
│ [Customer Type dropdown]                    │
│                                             │
│ ☐  Force full refresh from Priority         │
│    (slower, ~1–5 min)                       │
│    Re-fetches all orders including any      │
│    retroactive edits. Use when YoY          │
│    numbers look off.                        │
│                                             │
│                    [Cancel]  [Start]        │
└─────────────────────────────────────────────┘
```

**Behavior:**
- **Default:** unchecked on every modal open (state is local to the modal, not persisted in `localStorage` or URL)
- **Always visible:** a user might want to force-refresh even when the incremental merge just ran, to pick up a prior-year correction they know was made
- **Label tone:** the duration warning (~1–5 min) and use-case hint ("Use when YoY numbers look off") guide the user toward correct usage without being prescriptive or scolding

**Rationale for the chosen location (over alternatives):**
- A separate "Refresh" button in the left panel would duplicate an entry point to the same SSE pipeline and clutter the constrained Airtable iframe real estate.
- A split button on `ReportButton` (primary = normal, dropdown = force refresh) is low-discoverability in an iframe context.
- The checkbox-in-modal pattern keeps the mental model coherent: "open report config → pick filters → decide on refresh depth → Start."

### Client wiring

**`client/src/hooks/useReport.ts`:**

`UseReportReturn.startReport` signature becomes:

```typescript
startReport: (filters: FetchAllFilters, forceRefresh?: boolean) => void;
```

`forceRefresh` defaults to `false`. Existing callers (zero or one argument) compile unchanged.

When `forceRefresh === true`, append `refresh=true` to the EventSource URL:

```typescript
const params = new URLSearchParams({ groupBy: dimension, period });
if (newFilters.agentName?.length) params.set('agentName', newFilters.agentName.join(','));
if (newFilters.zone?.length) params.set('zone', newFilters.zone.join(','));
if (newFilters.customerType?.length) params.set('customerType', newFilters.customerType.join(','));
if (forceRefresh) params.set('refresh', 'true');
```

**`client/src/components/shared/ReportFilterModal.tsx`:**

- Add `forceRefresh` to local modal state, initialized to `false` on mount/open
- Render a labeled checkbox between filter dropdowns and Start/Cancel buttons, using the existing design tokens (`text-foreground-*`, `border-subtle`, etc. — no hardcoded hex)
- On Start click, call `onStart(filters, forceRefresh)` instead of `onStart(filters)`
- If the modal uses a `useEffect`/reset hook tied to `open`, add `setForceRefresh(false)` to the reset path so the checkbox clears between opens

Existing query-key invalidation on SSE `complete` (already invalidates `['cache-status', period]` and `['entities', dimension, period]`) requires no change.

### Server wiring

**Priority ERP safety:** this change only adds extra Redis `del` calls on an existing Priority-read code path. No new writes to Priority ERP. Consistent with CLAUDE.md's non-negotiable read-only constraint.

**`server/src/routes/fetch-all.ts`** — extend the force-refresh `else` branch (around line 77) to also clear the prior-year raw-orders cache for the same `filterHash`:

```typescript
} else {
  // Force refresh: delete current + prev-year raw caches, do full fetch
  await redis.del(rawKey);
  await redis.del(metaKey);
  await redis.del(cacheKey('orders_year', String(year - 1), filterHash));
  orders = await fullFetch(startDate, endDate, extraFilter, sendEvent);
}
```

The subsequent `cachedFetch` call for `orders_year:{year-1}:{filterHash}` later in the same handler will now miss and re-fetch from Priority. The final Redis writes at the end of the handler (`orders_raw`, `orders_raw_meta`, `entities_full`, `report_payload`, `entity_detail`) overwrite any stale derived aggregates with fresh values.

**What's NOT cleared on force-refresh, and why:**
- `customers:all` — customer data (names, zones, rep assignments) changes rarely; has its own TTL. Out of scope per user decision during brainstorming.
- `entities_full`, `report_payload`, `entity_detail` — derived aggregates. Re-written at the end of the same handler run from fresh raw orders, so explicitly deleting them would be redundant work.
- `orders_ytd` / `orders_year` (non-filtered keys used by the entity-detail path) — those are independent of the filtered Report flow and are not hydrated by the fetch-all pipeline.

---

## Error handling

No new paths. The existing SSE error flow covers all failure modes:

| Failure mode | Path |
|---|---|
| Redis `del` throws (Redis down) | outer try/catch → SSE `error` event → modal surfaces error, user can retry |
| Priority API error during full-fetch | existing `fetchOrders` error propagation → SSE `error` |
| Priority rate-limit (100/min) | Priority 429 → existing error surfacing |
| Client-side cancel mid-refresh | `abort()` closes the EventSource; server request continues to completion. Orphaned work but no data corruption — the final Redis writes are idempotent (they overwrite the same keys). |
| SSE connection drops (Railway nginx timeout) | heartbeat + `error` event → modal shows "Connection lost" |

---

## Testing

### Client

**`client/src/hooks/__tests__/useReport.test.ts`** (NEW FILE — first test for this hook):

- `startReport({}, true)` appends `refresh=true` to the EventSource URL
- `startReport({})` (no second arg) produces a URL WITHOUT `refresh` — backward-compat guard for existing call sites
- `startReport({ agentName: ['Alexandra'] }, true)` produces a URL with BOTH `agentName=Alexandra` AND `refresh=true`
- `startReport({}, false)` produces a URL WITHOUT `refresh` — explicit-false check

Test harness: use a minimal `EventSource` mock that exposes the constructed URL (the pattern used by existing client tests is plain `vitest` without `@testing-library/react`, so this hook test should follow suit — mock `globalThis.EventSource`, call the hook's `startReport` in isolation, assert on the captured URL).

**`ReportFilterModal` component tests:**

OUT OF SCOPE for this PR (see "Out of scope" above). Covered by:
- Hook unit tests (source of truth for the wiring)
- Manual smoke test on Railway (covers the UI path end-to-end)

If the user chooses to add component tests anyway, the implementation plan should include installing `@testing-library/react` and establishing the `.test.tsx` file convention. This is a ~half-day decision, not a ~one-hour addition.

### Server

**`server/src/routes/__tests__/fetch-all.test.ts`** (NEW FILE — no existing `fetch-all.test.ts` in the repo):

- **Force-refresh clears both caches**: seed Redis with envelopes for `orders_raw:{period}:{filterHash}`, `orders_raw_meta:{period}:{filterHash}`, AND `orders_year:{year-1}:{filterHash}`. Call `GET /api/sales/fetch-all?refresh=true`. Assert all three keys are `del`-ed BEFORE Priority is hit. Assert `fullFetch` path runs (not `tryIncrementalRefresh`).
- **Non-refresh regression guard**: seed the same three keys, call `GET /api/sales/fetch-all` (no `refresh`). Assert `orders_year:{year-1}` is NOT deleted. Assert the `tryIncrementalRefresh` path runs when cache is recent.
- **Refresh + filter combination**: call `GET /api/sales/fetch-all?refresh=true&agentName=Alexandra`. Assert the prev-year `del` uses the same `filterHash` as the current-year `del` (i.e., the filtered hash, not `'all'`).

Test harness: follow the existing pattern in `server/src/routes/__tests__/cache-status.test.ts` — mock the Redis client and the Priority client, assert on call order and arguments.

---

## Integration contracts (per CLAUDE.md discipline)

1. **`forceRefresh` param flows end-to-end with no dead-end state:** Modal local state → `onStart(filters, forceRefresh)` prop → `useReport.startReport(filters, forceRefresh)` → URL query param `refresh=true` → server parses via `refresh: z.enum(['true', 'false']).optional()` → `forceRefresh = refresh === 'true'` → branch executes extra `redis.del` calls. Every hop is exercised by at least one test.

2. **URL param name alignment:** client must send `refresh=true` (string), not `forceRefresh=true`. Matches the existing server Zod schema in `fetch-all.ts`. Mismatched names would silently fail the branch (schema passes with missing param → `forceRefresh = false` → no cache deletion → silent bug).

3. **Default alignment:** client default for `forceRefresh` is `false`; server treats missing `refresh` param as `false`. Symmetric in both directions.

4. **Backward compatibility:** Existing `startReport(filters)` callers continue to work without modification — `forceRefresh` is optional with a default.

5. **Redis key structure match:** client does not construct Redis keys. Server uses `cacheKey('orders_year', String(year - 1), filterHash)` — identical to the existing prev-year READ path lower in the same handler. Confirming: same key template, same `filterHash` (derived from the same `buildFilterHash(agentName, zone, customerType)` call), same TTL family.

6. **Exported test harness uses existing utilities:** no new mocking libraries introduced; follows the cache-status.test.ts pattern.

---

## Verification plan

**Pre-commit gates (all must pass):**

```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
cd ../server && npx vitest run
cd ../client && npx vitest run
cd ../client && npx vite build
```

Plus:
- No `any` types: `grep -rn ": any\|as any" server/src/ client/src/` returns 0 new occurrences
- No files > 300 lines (LLM-optimized rule). Current line counts: `useReport.ts` 113, `ReportFilterModal.tsx` 180, `fetch-all.ts` 221. Estimated post-change: ~120, ~200, ~225 respectively — all well under 300.
- No hardcoded hex colors in `ReportFilterModal.tsx` — checkbox styling uses tokens only

**Manual smoke test on Railway (after deploy):**
1. Open Airtable Omni iframe
2. Click "Report" → filter modal opens → checkbox visible, unchecked by default
3. Leave filters at defaults, check the force-refresh checkbox → click Start
4. Observe progress modal; verify SSE events flow (Phase 1 fetching, Phase 2 processing); note that progress reaches completion (longer than normal since cache was cleared)
5. On completion, Report displays with fresh data; the "Data ready" cache-status badge reflects the updated cache
6. Re-open modal → checkbox is unchecked again (confirms state is NOT persisted)
7. Run Report without the checkbox → runs incremental-merge path (fast, since cache was just rebuilt)
8. Add a filter (e.g., `agentName=Alexandra`) + check force-refresh → verify the filtered scope rebuilds correctly (server log shows Priority call with the agent filter)

---

## Rollback

- **Primary:** single-PR feature. Revert via `git revert <merge-sha>` on the merge commit.
- **Soft-disable path:** delete the one line `if (forceRefresh) params.set('refresh', 'true')` in `useReport.ts`. The user can still check the checkbox, but the URL never carries the flag — force-refresh becomes a no-op. Server behavior unchanged.
- **Hide-affordance path:** conditionally render the checkbox behind a client-side constant (e.g., `const FORCE_REFRESH_ENABLED = true;` at module top). Not implemented here; noted as a future option if operational issues emerge.

---

## Open design questions (resolved during brainstorming)

| Question | Options considered | Decision | Rationale |
|---|---|---|---|
| Where does the affordance live? | Checkbox in filter modal / separate button / split button on Report | Checkbox in `ReportFilterModal` | Discoverable at the moment of action; no new surface area in the constrained Airtable iframe; coherent mental model with existing Report config flow. |
| What does "force refresh" actually clear? | Current-year only / current + prior-year / nuclear including customers | Current + prior-year raw orders | Addresses the full YoY failure mode (retroactive edits to prior-year closed orders). Doesn't over-stress the Priority 100-calls/min rate limit. `customers:all` is rarely edited structurally; deferred. |

---

## Next steps after spec approval

1. User reviews this spec and approves (or requests changes)
2. Invoke `superpowers:writing-plans` to produce detailed step-by-step implementation plan
3. Create a feature branch off merged `main` (current SHA: `70ec586`)
4. Execute via `superpowers:subagent-driven-development` (two-stage review pattern)
5. Open follow-up PR targeting `main` with a clean merge-commit history
