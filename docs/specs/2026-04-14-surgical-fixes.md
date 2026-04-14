# Surgical Fixes for Report 2 & View Consolidated 2

**Date:** 2026-04-14
**Scope:** Minimum-viable patches to address the symptom "second Report 2 reverts to first" + the 6 HIGH findings from `codex:adversarial-review`.
**Decision:** Patch in place, do NOT revert Sonnet's 7 commits, do NOT rewrite backend. Both Codex runs independently rejected the rewrite on evidence (121 tests pass, backend architecture sound).

## Symptom (verbatim from user)

> "I was able to run one report when I select sales rep Alexandra Gasia (she has only one customer). Then I tried to run another report for another rep with 70 [customers]. It reverted back to the first report for Alexandra Gasia."

## Root causes (evidence-backed)

### RC-A — User-visible "revert" symptom

1. **`Report2FilterModal.tsx:28-30`** — `useState<string[]>([])` runs once at component mount, not per `isOpen` transition. The modal is always mounted in `DashboardLayout` (visibility via inner `AnimatePresence`), so Alexandra's selection persists across reopens. User is misled into re-running the same filter.
2. **`useReport2.ts:65-70`** — `startReport` does not call `setPayload(null)`. If the second fetch resolves with identical cache-hit data (because filter hash unchanged), the UI renders the same payload, visually identical to the first report.

### RC-B — Adversarial review HIGH findings

3. **`dashboard.ts:47`** — hardcodes `'all'` as filter hash; `fetch-all.ts:56` writes under actual computed hash → Consolidated 2 always returns 422 when any filter was used.
4. **`dashboard.ts:58`** — Consolidated 2 passes `[]` for `prevOrders`; YoY is universally broken.
5. **`fetch-all.ts:98`** — `orders_year:<year>` cache key ignores `filterHash`; first filtered Report 2 poisons prev-year cache for every subsequent filter.
6. **`DashboardLayout.tsx:47-50`** — `report2.state === 'loaded'` always wins over `consolidated2.state === 'loaded'` regardless of user intent.
7. **`contacts.ts`** — single-customer API only. `ConsolidatedContactsTable` has no data source.
8. **`fetch-all.ts:127-129`** — `report2_payload` cache is write-only; no read path → iframe-reload "Data ready" claim is aspirational.

## Fixes (in execution order)

| # | File | Change | Verification |
|---|------|--------|--------------|
| F1 | `client/src/components/shared/Report2FilterModal.tsx` | Reset `selectedReps/Zones/Types` to `[]` when `isOpen` transitions `false → true`. | Manual: open modal, pick rep, Start, reopen modal → selection is empty. |
| F2 | `client/src/hooks/useReport2.ts` | Call `setPayload(null)` at top of `startReport`. | Manual: run Report 2, start second with different filter, observe placeholder behind progress modal (not stale data). |
| F3 | `client/src/hooks/useConsolidated2.ts` + `client/src/layouts/DashboardLayout.tsx` + `server/src/routes/dashboard.ts` | Accept `filters` arg on `start()`; send `agentName/zone/customerType` params; server computes `filterHash` same way as fetch-all, probes `orders_raw:{period}:{filterHash}`. | Unit test: fast-path returns 200 when filters match cache; 422 when no cache. |
| F4 | `server/src/routes/fetch-all.ts:97-100` | Append `filterHash` to prev-year cache key: `cacheKey('orders_year', String(year-1), filterHash)`. | Unit test: two successive fetch-all calls with different agent filters cache independently. |
| F5 | `client/src/layouts/DashboardLayout.tsx:47-54` | `useEffect` that resets the non-winning v2 mode when the other transitions to `loaded`. | Manual: load Report 2 then load Consolidated 2 → Consolidated 2 renders; reverse works too. |
| F6 | `server/src/routes/dashboard.ts:58` | Fetch prev-year orders (filtered) before `aggregateOrders`; pass real data not `[]`. | Unit test: consolidated payload `kpis.revenueChangePercent` is non-null when prev-year data exists. |
| F7 | `server/src/routes/contacts.ts` | Accept `customerIds` (plural, comma-separated). Return array annotated with `customerName`. | Unit test: two-customer request returns contacts from both with customerName populated. |

## Out of scope (deferred, known gaps)

- **Hydration path for `report2_payload`** (adversarial H6) — treated as perf optimization, not correctness. Incremental fetch-all is fast enough for MVP.
- **Per-customer toggle in all 7 modals** — already planned; verify after F1-F7 ship.

## Verification plan

### Unit tests
```bash
cd server && npx vitest run
```
New tests added for F3, F4, F6, F7. All 121 existing tests + new tests must pass.

### TypeScript
```bash
cd server && npx tsc --noEmit
cd client && npx tsc -b --noEmit
```
Must be clean.

### Live reproduction (Chrome MCP, Railway URL)

**URL:** `https://sales-dashboard-production-dbff.up.railway.app`

**Test R1 — Alexandra → 70-rep flow (must now work):**
1. Click Report 2 → Filter modal opens → Verify all three dropdowns read "All"
2. Select Sales Rep: Alexandra Gasia → Start → Wait for load
3. Verify Consolidated header shows "Report: 1 Customer" + subtitle "Sales Rep: Alexandra Gasia"
4. Click Report 2 again → Modal opens → **Verify selection is EMPTY (no carryover)**
5. Select Sales Rep: different rep with ~70 customers → Start → Wait
6. Verify new header shows "Report: ~70 Customers" + new rep name
7. Verify Orders tab has Customer column populated with ≠ Disney customers

**Test R2 — View Consolidated 2 fast path:**
1. Run Report 2 (any filter) first
2. Check 3 entities in list → Click View Consolidated 2 → Start
3. Verify network tab shows single `GET /api/sales/dashboard?entityIds=...&groupBy=customer&period=ytd&agentName=...` with 200 response under 1s

**Test R3 — 422 path:**
1. Fresh page load with no prior Report 2
2. Check 3 entities → View Consolidated 2 → Start
3. Verify modal transitions to "needs-report-2" state with "Go to Report 2" button

## If any test fails

Per systematic-debugging skill: STOP, return to Phase 1, re-analyze with new information. Do NOT attempt a second fix without understanding why the first failed. After 3 failed fix attempts, escalate to user and question architecture.

---

**Author:** Claude Opus 4.6 (main conversation)
**Approach:** Patch in place (not revert, not rewrite)
**Estimated edits:** 7 files, ~150 LOC delta
