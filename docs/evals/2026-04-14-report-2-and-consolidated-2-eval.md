# Report 2 & View Consolidated 2 — Evaluation Criteria

**Date:** 2026-04-14
**Spec:** `docs/specs/2026-04-14-report-2-and-consolidated-2-design.md`
**Plan:** `docs/plans/2026-04-14-report-2-and-consolidated-2-plan.md`
**Test customer:** `C7826` (single-entity regression) + customers in delivery zone `Disney` (consolidated scenarios)

---

## How to Use This Document

1. **Read before starting.** Read the entire eval doc before writing code so implementation choices are shaped by these criteria. A check that forces a refactor at the end is a check you should have read up front.
2. **Verify as you go.** Each section has a `Verify After: Task X.Y` tag. Run that section's checks at that plan checkpoint, not at the end. Catching issues early is cheap; catching them late means rework across tightly coupled hooks and components.
3. **Show your work.** Paste the command and its output into the PR/review notes. "I verified it" is not proof. Terminal output, screenshots with visible Customer columns, and `curl | jq` responses are proof.
4. **Pre-Completion Gate.** Before declaring the feature complete, run the full Quick Smoke Test at the bottom of this doc, paste the complete output, and confirm every line ends in `[ OK ]`. Not done until the gate passes with evidence.
5. **Failure recovery.** When a check fails, don't retry the same approach. Read the error, re-read the spec section that describes the failing behavior, fix the root cause. If the same check fails 3 times in a row: stop, invoke `superpowers:systematic-debugging`, and if still stuck, ask the user.

---

## Section 1 — Functional Completeness (Golden Path Scenarios)

**Verify After: Tasks 8.4, 9.2**

These three scenarios are the authoritative end-to-end definition of "working." The user has mandated them. All three must PASS before ship.

### Scenario A — Report 2 with delivery zone "Disney"

| # | Check | How to verify |
|---|-------|---------------|
| A1 | Both dev servers start cleanly | Terminal 1: `cd server && npm run dev` prints `listening on 3001`. Terminal 2: `cd client && npm run dev` prints Vite local URL on 5173. |
| A2 | Report 2 button renders below Report button | Open `http://localhost:5173`. Visually confirm two entries at the top of the entity list: `Report` (v1) then `Report 2` (v2). Inspect DOM: `Report2Button` is a sibling immediately after `AllEntityEntry`. |
| A3 | Clicking Report 2 opens Report2FilterModal | Click "Report 2". Modal with title **"Please select"** and gold filter icon renders. Three dropdowns visible: Sales Rep, Zone, Customer Type (each defaulting to "All"). |
| A4 | Zone dropdown contains "Disney" | Open the Zone dropdown. Confirm `Disney` appears in the option list (sourced from `entities[].zone` via `uniqueValues` in `Report2FilterModal.tsx`). |
| A5 | Selecting only Zone=Disney narrows the count | Select only `Disney` in the Zone dropdown. Leave Sales Rep and Customer Type untouched. Footer text updates to **"Fetching data for N customers"** where `N` equals the number of entities with `zone === 'Disney'` and N ≥ 1. |
| A6 | Start triggers Report2ProgressModal with Phase 1 | Click **Start**. Filter modal unmounts. Progress modal mounts with title **"Loading All Data"** and Phase 1 row `Fetching orders` with a progress bar that updates (`N rows / Y%`). |
| A7 | Exactly one SSE request fires with correct params | In the Network tab, filter for `fetch-all`. Exactly one request appears: `GET /api/sales/fetch-all?groupBy=customer&period=ytd&zone=Disney`. Type: `eventsource`. No other Priority-bound calls occur while the SSE is streaming. |
| A8 | Right panel renders ConsolidatedHeader after complete | When SSE emits `complete`, progress modal closes. Right panel replaces placeholder with a header component whose **first line** reads `Report: N Customers` where N matches A5. |
| A9 | Subtitle reads `Filters: Zone: Disney` | The subtitle line beneath the header title text contains the literal string `Zone: Disney` (from `report2.filters` passed to `ConsolidatedHeader`). |
| A10 | Orders tab has Customer column populated with CUSTDES | Switch to the Orders tab. Column order: Date, Customer, Order Number, … . Cell values in the Customer column are human-readable friendly names (e.g., `Disney Parks`), NOT raw codes like `C7826`. |
| A11 | Contacts tab has Customer column | Switch to the Contacts tab. The first column is **Customer** and rows show the same friendly names. |
| A12 | Hero Revenue modal has PerCustomerToggle | Click the hero revenue card. Modal opens. At the top, a two-state switch with labels **Aggregated** (default selected) / **Per Customer** is visible. |
| A13 | Flipping toggle to "Per Customer" renders sortable table | Click **Per Customer**. Content changes to a table with columns `Customer | Revenue | YoY %`. Rows display the Disney customers. Clicking the Revenue header toggles sort direction. Default sort is Revenue desc. |
| A14 | Product Mix donut modal has per-customer table | Close hero modal. Click one of the 5 donuts in the Product Mix carousel. Modal opens with the PerCustomerToggle. Flip to **Per Customer**: table shows rows with columns `Customer | Top Category | % of Revenue`. |
| A15 | cache-status reflects loaded raw data | After fetch completes, run `curl -s http://localhost:3001/api/sales/cache-status?period=ytd | jq`. Response: `.raw == true`, `.rowCount > 0`, `.filterHashes` includes a hash derived from `zone=Disney`. |

**Verdict threshold:** PASS if all 15 checks succeed. Any single failure on A7, A8, A9, A10, A15 is a blocker — those verify the contract between server aggregation and client display.

---

### Scenario B — View Consolidated 2 with multiple Disney customers (warm cache)

**Precondition:** Scenario A has just run successfully; Redis holds `dashboard:orders_raw:ytd:<filterHash>`.

| # | Check | How to verify |
|---|-------|---------------|
| B1 | Reset state to entity-list view | Click a non-Disney customer in the entity list (puts app in single-entity mode and dismisses Report 2's `loaded` state path for the purposes of this test). |
| B2 | Search "disney" in entity list | Type `disney` in the search box. List filters to Disney-related entities. |
| B3 | Check 3 Disney entities | Click the circular checkboxes on 3 entities. Each shows a checked state. |
| B4 | SelectionBar slides up with count and two button rows | The bottom `SelectionBar` is visible. Left side: `3 selected`. Right side: row 1 = `[Clear] [View Consolidated]` (v1, untouched), row 2 = `[View Consolidated 2]` below row 1. |
| B5 | Clicking View Consolidated 2 opens confirmation modal | Click "View Consolidated 2". Modal opens with title **"Confirm View Consolidated"** and body text **"Fetching data for 3 selected entities"** followed by a bullet list of the 3 Disney entity names. |
| B6 | Clicking Start triggers a single fast-path GET | Click **Start**. Network tab shows exactly one new request: `GET /api/sales/dashboard?entityIds=D1,D2,D3&groupBy=customer&period=ytd` (where D1/D2/D3 are the 3 selected entity ids, sorted). Response status: 200. No SSE, no `fetch-all` call. |
| B7 | Response returns in under 1 second | Network tab "Duration" column for the request in B6 shows < 1000 ms (fast path reads cached raw orders and re-aggregates server-side). |
| B8 | ConsolidatedHeader shows `Consolidated: 3 Customers` | Right panel renders header with first line **`Consolidated: 3 Customers`** (NOT `Report: ...`). |
| B9 | Orders tab has Customer column with ONLY 3 Disney customers | Switch to Orders tab. Customer column exists. Distinct values in the Customer column are ≤ 3 and every value is one of the 3 entities checked in B3 — no orders from non-selected Disney customers or non-Disney customers leak through. |
| B10 | Revenue is a subset of Scenario A's revenue | Note the hero revenue total displayed. This number must be ≤ the total revenue shown in Scenario A step A12 (subset of entities cannot exceed superset). |
| B11 | Hero modal per-customer toggle works | Click hero revenue card. Modal opens with PerCustomerToggle. Flip to **Per Customer**. Table has exactly 3 rows (one per selected Disney customer). Revenue column sums to B10's total within ±$0.01 rounding. |

**Verdict threshold:** PASS if all 11 checks succeed. B6, B7, B9, B10 are the correctness backbone — any failure here indicates the dimension-agnostic cache key or the `filterOrdersByEntityIds` path is broken.

---

### Scenario C — Cold cache recovery path for Consolidated 2

| # | Check | How to verify |
|---|-------|---------------|
| C1 | Redis is empty for raw orders | Before starting: restart Redis OR from the server REPL run: `await redis.del('dashboard:orders_raw:ytd:all')`. Confirm via `curl -s http://localhost:3001/api/sales/cache-status?period=ytd | jq .raw` → `false`. |
| C2 | Check 2 Disney customers | In the entity list, search "disney", check 2 entities. SelectionBar shows `2 selected`. |
| C3 | Click View Consolidated 2 → Start | Click "View Consolidated 2", then **Start**. Confirmation modal shows the inline fetching state. |
| C4 | Server returns HTTP 422 | Network tab: `GET /api/sales/dashboard?entityIds=...&groupBy=customer&period=ytd` returns **422 Unprocessable Entity**. Response body contains `{"error":{"message":"Consolidated view requires loaded data. Use \"Report 2\" first, then try again."}}` (or close match). |
| C5 | Modal transitions to `needs-report-2` state | `Consolidated2ConfirmModal` rerenders with new title **"Data not available"** and body explaining that Report 2 must be run first. A button labeled **"Go to Report 2"** is visible. |
| C6 | Clicking "Go to Report 2" routes into Report2FilterModal | Click the button. The Consolidated 2 modal unmounts. Within the same render cycle, `Report2FilterModal` (title **"Please select"**) is visible on top. |

**Verdict threshold:** PASS if all 6 checks succeed. C4, C5, C6 together verify the single failure path that separates "broken" from "recoverable."

**Section 1 overall verdict:** PASS only if Scenarios A, B, and C all individually pass. This section is **Critical** weight.

---

## Section 2 — Functional Completeness (Non-Scenario Checks)

**Verify After: Tasks 7.1, 7.2, 7.3, 8.4**

| # | Check | How to verify |
|---|-------|---------------|
| 2.1 | Per-customer toggle absent in single-entity mode | Click customer `C7826` in the entity list. Right panel renders with `DetailHeader`. Click the hero revenue card. Modal opens — scan the top of the modal: no PerCustomerToggle visible, modal content matches pre-v2 behavior. |
| 2.2 | Single-entity Orders tab has no Customer column | Same C7826 selection: Orders tab column headers are Date, Order Number, Items, Amount, Margin, Status (no Customer column). Check against the consolidated table which has 7 columns instead of 6. |
| 2.3 | KPI modals (all 5) get the toggle in consolidated mode | From Scenario A's loaded state, click each of the 5 KPI cards in turn (Orders, Avg. Order, Margin %, Margin $, Frequency). Each modal shows PerCustomerToggle at the top. Flipping to Per Customer renders a Customer / <Metric> / YoY table. |
| 2.4 | Last Order card modal per-customer view | Click the Last Order card in consolidated mode. Modal has toggle. Per Customer view shows `Customer | Last Order Date | Status (color dot)` columns. |
| 2.5 | Best Sellers modal per-customer view | Click the Best Sellers section in consolidated mode to expand. Modal shows toggle. Per Customer view columns: `Customer | Top SKU | Revenue from that SKU`. |
| 2.6 | Toggle state resets between modal openings | Open hero revenue modal, flip to Per Customer, close modal. Re-open hero revenue modal. Default is **Aggregated** again (local state per `useModal()` mount). |
| 2.7 | v1 Report button remains untouched and still functions | After Report 2 loads, click the original `Report` (v1) button. v1's `FetchAllDialog` flow runs to completion as before. v2 state (`report2.state === 'loaded'`) is not reset or disturbed — v1 and v2 coexist. |
| 2.8 | v1 View Consolidated button remains untouched | Select entities, click v1 `View Consolidated` (top button in SelectionBar). v1 flow runs. v2 `consolidated2` state stays at `idle`. |
| 2.9 | Dimension switch resets v2 state | From Scenario A's loaded state, switch dimension from Customer to Vendor. Report 2 button returns to "Data ready — click to view" (or "Click to generate report" if no cache). Right panel clears to placeholder text. `report2.state === 'idle'`. |

**Verdict threshold:** PASS if at least 8 of 9 succeed (allow 1 minor to pass with documented fix plan for a known small UI tweak). This section is **High** weight.

---

## Section 3 — Fidelity / Correctness

**Verify After: Tasks 1.6, 2.3, 8.4**

| # | Check | How to verify |
|---|-------|---------------|
| 3.1 | Consolidated revenue == sum of per-entity revenues | In Scenario B's loaded state, toggle hero revenue modal to Per Customer. Sum the Revenue column for the 3 rows. Confirm it equals (within ±$0.01) the aggregated revenue displayed on the hero card's **Aggregated** view. |
| 3.2 | Consolidated order count == sum of per-entity order counts | On the Orders KPI card in consolidated mode, aggregated value equals the sum of `entities[i].kpis.orders` from `consolidatedPayload.entities`. Verify in dev tools: `window.__DEV__dashboardPayload.entities.reduce((a,e) => a + e.kpis.orders, 0)` matches the displayed aggregated Orders KPI. |
| 3.3 | Customer names resolve from CUSTDES, not CUSTNAME codes | In Scenario A's Orders tab, inspect 5 random rows: the Customer column cells must be human-readable descriptions (e.g., `Disney Parks and Resorts`) not `CUSTNAME` codes (e.g., `C7826`). Verify `custMap.get(order.CUSTNAME) ?? order.CUSTNAME` produced a CUSTDES hit. |
| 3.4 | Unknown customer falls back to CUSTNAME | Add a synthetic test case or inspect an order whose `CUSTNAME` is not in the customers table: Customer column shows the raw code (graceful fallback from `aggregator` opts). Covered by unit test `falls back to CUSTNAME when customer lookup misses`. |
| 3.5 | Per-entity product mixes sum to aggregated mix (roughly) | In Scenario A, click Brand donut. Sum `perEntityProductMixes[eid].brand` segment values across all entities for a given brand — should equal the aggregated `productMixes.brand` segment for that brand (within ±$0.01). |
| 3.6 | Top seller per customer honors revenue descending | In Scenario A, open Best Sellers modal, flip to Per Customer. For a spot-checked customer, the "Top SKU" cell is the SKU with highest `QPRICE` sum for that customer — verify against raw data via server log or direct Redis dump. |
| 3.7 | Monthly revenue per entity sums to aggregated monthly | For a given month (e.g., `2026-01`), `perEntityMonthlyRevenue[eid]['2026-01'].current` summed across entities equals `monthlyRevenue['2026-01'].current`. |

**Verdict threshold:** PASS if at least 6 of 7 checks succeed (3.6 can be skipped if manual Redis dump is impractical). This section is **Critical** weight.

---

## Section 4 — Backend / API Robustness

**Verify After: Tasks 2.3, 2.5**

| # | Check | How to verify |
|---|-------|---------------|
| 4.1 | cache-status returns correct shape when empty | Clear Redis. `curl -s http://localhost:3001/api/sales/cache-status?period=ytd | jq` returns `{"raw":false,"lastFetchDate":null,"rowCount":0,"filterHashes":[]}`. |
| 4.2 | cache-status returns correct shape when warm | After Scenario A runs: `curl -s http://localhost:3001/api/sales/cache-status?period=ytd | jq '.raw, .rowCount, .filterHashes | length'` → `true`, `<int > 0>`, `<int ≥ 1>`. |
| 4.3 | cache-status triggers zero Priority calls | Tail server logs while running `curl http://localhost:3001/api/sales/cache-status?period=ytd`. Confirm no log lines matching `priority-queries` or `[Priority]` or outbound HTTP to `priority-connect.online`. |
| 4.4 | cache-status response time < 50 ms | `time curl -s -o /dev/null http://localhost:3001/api/sales/cache-status?period=ytd` reports `real < 0.05s` on a warm Redis. |
| 4.5 | dashboard endpoint 422 path | With cold cache, `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/sales/dashboard?entityIds=C7826&groupBy=customer&period=ytd"` → `422`. |
| 4.6 | dashboard 422 body shape | Same request with `-s | jq '.error.message'` returns a non-empty string containing `"Report 2"`. |
| 4.7 | SSE heartbeat survives >60s | Start Report 2 fetch. In Network tab, keep the SSE connection open longer than 60 seconds (simulates Railway proxy timeout). Connection is NOT dropped with `502 Bad Gateway`. Either the SSE completes normally or heartbeat `:ping` comments appear every ~30s keeping it alive. |
| 4.8 | Raw cache key is dimension-agnostic | Inspect Redis: `redis-cli KEYS 'dashboard:orders_raw:ytd:*'` returns keys of the form `dashboard:orders_raw:ytd:<filterHash>` (no `:customer:` or `:vendor:` segment between period and filterHash). |
| 4.9 | report2_payload key uses dimension qualifier | After Scenario A: `redis-cli KEYS 'dashboard:report2_payload:ytd:*'` returns at least one key matching `dashboard:report2_payload:ytd:<filterHash>:customer`. |
| 4.10 | Zod validation rejects invalid period | `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/sales/cache-status?period=invalid_garbage"` → treated per Zod schema; a period string is accepted but malformed queries to downstream routes return 400 with validation error. |

**Verdict threshold:** PASS if at least 9 of 10 succeed. 4.7 may be skipped if you cannot easily simulate a 60s+ SSE in local dev; document the skip. This section is **High** weight.

---

## Section 5 — Code Quality (CLAUDE.md Compliance)

**Verify After: Task 9.1**

| # | Check | How to verify |
|---|-------|---------------|
| 5.1 | No `any` types added by v2 files | `git diff main --unified=0 -- '*.ts' '*.tsx' \| grep -E '^\+' \| grep -E ': any\|as any'` returns empty. |
| 5.2 | Every new file has intent block | `for f in $(git diff main --name-only --diff-filter=A -- '*.ts' '*.tsx'); do head -4 "$f" \| grep -q 'FILE:' \|\| echo "MISSING: $f"; done` returns empty. |
| 5.3 | No new file exceeds 300 lines | `git diff main --name-only --diff-filter=A -- '*.ts' '*.tsx' \| xargs wc -l \| awk '$1 > 300 { print $0 }'` returns empty. |
| 5.4 | v1 useFetchAll.ts unchanged | `git diff main -- client/src/hooks/useFetchAll.ts` returns empty. |
| 5.5 | v1 useEntitySelection.ts unchanged | `git diff main -- client/src/hooks/useEntitySelection.ts` returns empty. |
| 5.6 | v1 FetchAllDialog.tsx unchanged | `git diff main -- client/src/components/shared/FetchAllDialog.tsx` returns empty. |
| 5.7 | v1 select-display-dashboard.ts unchanged | `git diff main -- client/src/utils/select-display-dashboard.ts` returns empty. |
| 5.8 | Import order follows CLAUDE.md convention | Spot-check 3 new files (`useReport2.ts`, `ConsolidatedHeader.tsx`, `Report2FilterModal.tsx`): imports in order `react/libs → hooks → components → utils → types`. |
| 5.9 | No hardcoded hex colors in new files | `git diff main --diff-filter=A -- '*.tsx' \| grep -E '^\+' \| grep -Ei '#[0-9a-f]{3,6}[^-]' \| grep -v 'var(--color-' \| grep -v 'aria-' ` returns empty (hex colors should only come via Tailwind tokens / CSS vars). |
| 5.10 | Identical patterns for identical things | Compare `useReport2` and `useConsolidated2` — both follow the same state-machine / `useRef` / `useCallback` / abort-controller pattern. Confirm via side-by-side diff: same hook shape, same naming (`state`/`error`/`reset`/`abort`). |

**Verdict threshold:** PASS if all 10 checks succeed. This section is **Critical** weight — any violation of CLAUDE.md's mandatory rules kills Railway builds or breaks maintenance.

---

## Section 6 — Cache Strategy

**Verify After: Tasks 2.2, 2.3, 3.1, 8.1**

| # | Check | How to verify |
|---|-------|---------------|
| 6.1 | Dimension switch reuses raw cache (no Priority calls) | With Report 2 loaded on `customer` dimension, tail server logs: `tail -f server-log`. Switch to `vendor` dimension in the UI. In the log, no lines with `[Priority]` or outbound call to `priority-connect.online` — only a new aggregation pass. Dimension switch completes in <1s. |
| 6.2 | Raw cache key format is dimension-agnostic | `redis-cli KEYS 'dashboard:orders_raw:ytd:*'` shows keys WITHOUT a dimension segment. E.g., `dashboard:orders_raw:ytd:all` is valid; `dashboard:orders_raw:ytd:customer:all` is invalid and its presence is a FAIL. |
| 6.3 | View Consolidated 2 uses Report 2's raw cache | After running Scenario A (populating the raw cache), run Scenario B. Confirm in server logs that B's handler hit `dashboard:orders_raw:ytd:<same-filterHash>` key that A wrote — no new Priority fetch. |
| 6.4 | Payload cache with 1h TTL | `redis-cli TTL dashboard:report2_payload:ytd:<filterHash>:customer` returns a value in range [3500, 3600] immediately after Report 2 completes. |
| 6.5 | Raw cache has 365-day TTL (unchanged) | `redis-cli TTL dashboard:orders_raw:ytd:<filterHash>` returns a value near `31536000` (365 days). |
| 6.6 | Iframe reload shows "Data ready" state | With Report 2 loaded, hard-refresh the page (Cmd+R). Within <500ms of page load, the Report 2 button displays **"Data ready — click to view"** (from `useCacheStatus`). Clicking it should re-fetch the aggregated payload from server cache only. |
| 6.7 | Report2 query invalidates cache-status on complete | In React Query devtools, observe `['cache-status','ytd']` query. After Report 2 completes, it becomes `stale` and refetches, ending with `.raw === true`. |

**Verdict threshold:** PASS if all 7 checks succeed. This section is **High** weight.

---

## Section 7 — Deployment Readiness

**Verify After: Task 9.1**

| # | Check | How to verify |
|---|-------|---------------|
| 7.1 | Client TypeScript build passes | `cd client && npx tsc -b --noEmit` exits 0 with 0 errors. |
| 7.2 | Server TypeScript build passes | `cd server && npx tsc --noEmit` exits 0 with 0 errors. |
| 7.3 | Server tests pass (all 63+ existing + 10 new) | `cd server && npx vitest run` reports total tests ≥ 73 (63 existing + 7 aggregator + 3 cache-status), all PASS, 0 failures. |
| 7.4 | Vite client build succeeds | `cd client && npx vite build` exits 0 without errors. `client/dist/assets/*.js` emitted. |
| 7.5 | Bundle size under 500 KB gzip | `cd client && du -sk dist/assets/*.js \| awk '{sum+=$1} END {print sum" KB"}'` reports < 500. Alternative: `gzip -c dist/assets/index-*.js \| wc -c` < 512000. |
| 7.6 | railway.json present and unchanged | `git diff main -- railway.json` returns empty. File exists. |
| 7.7 | Dockerfile unchanged unless intentional | `git diff main -- Dockerfile` returns empty (v2 does not touch infrastructure files). |
| 7.8 | No compiled .js artifacts committed | `git diff main --name-only -- 'server/src/**.js' 'client/src/**.js'` returns empty. Only `.ts`/`.tsx` source in `src/`. |
| 7.9 | No secrets committed | `git diff main \| grep -iE 'PRIORITY_PASSWORD\|REDIS_TOKEN\|api[_-]?key\|bearer'` returns empty. |

**Verdict threshold:** PASS requires all 9 checks. This section is **Critical** weight — any FAIL here blocks Railway deploy.

---

## Section 8 — Priority ERP Compliance (Safety)

**Verify After: Tasks 2.3, 2.5, 9.1**

| # | Check | How to verify |
|---|-------|---------------|
| 8.1 | No new POST/PATCH/PUT/DELETE to Priority | `grep -rn "method:.*POST\|method:.*PATCH\|method:.*PUT\|method:.*DELETE" server/src/` returns no matches in new v2 files (`cache-status.ts`, new aggregator code, etc.). Priority is read-only. |
| 8.2 | priority-queries.ts unchanged by this feature | `git diff main -- server/src/services/priority-queries.ts` returns empty. |
| 8.3 | IEEE754Compatible header still present | `grep -n "IEEE754Compatible" server/src/services/priority-queries.ts` shows at least one match with `true`. (Not modified, but must not be accidentally removed in merge.) |
| 8.4 | No hardcoded Priority credentials | `grep -rn "priority-connect.online" server/src/ \| grep -v 'const\\|import\\|from\\|// '` finds no URLs with embedded credentials. All auth flows through env-var `PRIORITY_USERNAME`/`PRIORITY_PASSWORD`. |
| 8.5 | Rate-limited client still used | All new server code paths that touch Priority go through `priorityClient` from `priority-instance.ts` (verify by grep: `grep -rn "priority-connect.online" server/src/` shows only references inside `priority-instance.ts`). |
| 8.6 | No `.env` file committed | `git ls-files \| grep -E '^\\.env$\|^server/\\.env$'` returns empty. |

**Verdict threshold:** PASS requires all 6 checks. This section is **Critical** weight — Priority read-only is non-negotiable per CLAUDE.md.

---

## Overall Score Table

| Section | Weight | Verify After | Verdict |
|---------|--------|--------------|---------|
| 1. Functional Completeness (Scenarios A, B, C) | **Critical** | Tasks 8.4, 9.2 | |
| 2. Functional Completeness (Non-Scenario) | High | Tasks 7.1, 7.2, 7.3, 8.4 | |
| 3. Fidelity / Correctness | **Critical** | Tasks 1.6, 2.3, 8.4 | |
| 4. Backend / API Robustness | High | Tasks 2.3, 2.5 | |
| 5. Code Quality (CLAUDE.md) | **Critical** | Task 9.1 | |
| 6. Cache Strategy | High | Tasks 2.2, 2.3, 3.1, 8.1 | |
| 7. Deployment Readiness | **Critical** | Task 9.1 | |
| 8. Priority ERP Compliance | **Critical** | Tasks 2.3, 2.5, 9.1 | |

**Ship-readiness rules:**
- **ALL Critical sections must PASS** (Sections 1, 3, 5, 7, 8).
- **High sections** (Sections 2, 4, 6) may have at most 1 FAIL each, **only** if accompanied by a documented follow-up fix plan.
- Medium sections: advisory only (none defined for this feature).

---

## Verification Schedule

Map plan phases to eval sections. Run each mapping checkpoint BEFORE moving to the next phase.

| After completing… | Run these eval sections |
|-------------------|-------------------------|
| Phase 1 (Tasks 1.1–1.6): shared types + aggregator | Section 5 (lines 5.1, 5.2, 5.3, 5.8), run aggregator unit tests (`npx vitest run src/services/__tests__/data-aggregator-consolidated.test.ts`) |
| Phase 2 (Tasks 2.1–2.5): cache key change + cache-status | Section 4 (4.1–4.6, 4.8, 4.9), Section 6 (6.2, 6.4, 6.5), Section 8 (8.1–8.3) |
| Phase 3 (Tasks 3.1–3.3): client hooks | Section 5 (5.1, 5.8, 5.10) |
| Phase 4 (Tasks 4.1–4.2): UI buttons | Section 5 (5.2, 5.3, 5.9) — visual smoke only, no live data yet |
| Phase 5 (Tasks 5.1–5.3): modals | Section 5 structural checks, Section 1 A3, A4, A5, B5, C5 (modal-only) |
| Phase 6 (Tasks 6.1–6.6): consolidated display components | Section 5 structural, unit-level spot checks of tables |
| Phase 7 (Tasks 7.1–7.3): per-customer toggle wiring | Section 2 (2.3, 2.4, 2.5, 2.6), Section 3 (3.1, 3.2) |
| Phase 8 (Tasks 8.1–8.4): wire state through layout | **Section 1 (full Scenarios A, B, C)**, Section 2, Section 3, Section 4, Section 6 |
| Phase 9 (Tasks 9.1–9.2): verification | **Pre-Completion Gate — full Quick Smoke Test below**, plus Sections 5, 7, 8 in full |

---

## Pre-Completion Gate

Before declaring the feature complete, the implementing agent MUST:

1. Run the Quick Smoke Test script below end-to-end.
2. Paste the **complete, unabridged** output into the PR/review notes (not a summary).
3. Confirm every single line ends in `[ OK ]`. Any `[ FAIL ]` blocks completion.
4. If any line fails: fix the root cause (not the symptom), re-run the full script, paste again.
5. Additionally, execute Scenarios A, B, C from Section 1 manually in a browser and paste screenshots or Network-tab screenshots proving:
   - A9 (subtitle `Filters: Zone: Disney`)
   - A10 (Customer column with CUSTDES names)
   - B8 (header `Consolidated: 3 Customers`)
   - C5 (modal title `Data not available`)

The gate is passed only with **all three artifacts**: smoke test output, browser screenshots, and a written confirmation that all Critical sections passed.

---

## Quick Smoke Test

Save as `quick-smoke-test.sh` at the repo root. Requires the dev server running on port 3001 (for 4 checks at the end). Runs in under 5 minutes.

```bash
#!/usr/bin/env bash
# Quick Smoke Test — Report 2 & View Consolidated 2
# Exits 0 on full PASS; non-zero on any FAIL.
set -u
cd "$(dirname "$0")"

PASS_COUNT=0
FAIL_COUNT=0

check() {
  local label="$1"
  shift
  if "$@" >/tmp/smoke_out.log 2>&1; then
    echo "[ OK ] $label"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "[ FAIL ] $label"
    echo "  ---- output ----"
    sed 's/^/    /' /tmp/smoke_out.log | head -20
    echo "  ---- end ----"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo "=== Report 2 & Consolidated 2 Smoke Test ==="
echo "Date: $(date -Iseconds)"
echo ""

# --- 1. Type builds ---
check "client TypeScript builds (0 errors)" \
  bash -c 'cd client && npx tsc -b --noEmit'

check "server TypeScript builds (0 errors)" \
  bash -c 'cd server && npx tsc --noEmit'

# --- 2. Server tests ---
check "server vitest suite (all pass, including 10 new tests)" \
  bash -c 'cd server && npx vitest run'

# --- 3. Client Vite build ---
check "client Vite build succeeds" \
  bash -c 'cd client && npx vite build'

# --- 4. Bundle size under 500 KB gzip ---
check "bundle size < 500 KB gzip" \
  bash -c '
    total=$(cd client/dist/assets && for f in *.js; do gzip -c "$f" | wc -c; done | awk "{s+=\$1} END {print s}")
    limit=$((500 * 1024))
    echo "bundle gzipped: $total bytes (limit: $limit)"
    [ "$total" -lt "$limit" ]
  '

# --- 5. Intent blocks on all NEW files ---
check "every new .ts/.tsx file has intent block (FILE: header)" \
  bash -c '
    missing=""
    for f in $(git diff main --name-only --diff-filter=A -- "*.ts" "*.tsx" | grep -E "^(client|server|shared)/"); do
      [ -f "$f" ] || continue
      head -4 "$f" | grep -q "FILE:" || missing="$missing\n$f"
    done
    if [ -n "$missing" ]; then
      printf "missing intent blocks:%b\n" "$missing"
      false
    else
      true
    fi
  '

# --- 6. No `any` added ---
check "no \": any\" or \"as any\" added vs main" \
  bash -c '
    added=$(git diff main --unified=0 -- "*.ts" "*.tsx" | grep -E "^\+" | grep -v "^+++ " | grep -E ": any|as any" || true)
    if [ -n "$added" ]; then
      echo "$added"
      false
    else
      true
    fi
  '

# --- 7. No new file over 300 lines ---
check "no newly-added file exceeds 300 lines" \
  bash -c '
    offenders=""
    for f in $(git diff main --name-only --diff-filter=A -- "*.ts" "*.tsx"); do
      [ -f "$f" ] || continue
      lines=$(wc -l < "$f")
      if [ "$lines" -gt 300 ]; then
        offenders="$offenders\n$f ($lines lines)"
      fi
    done
    if [ -n "$offenders" ]; then
      printf "over-300 files:%b\n" "$offenders"
      false
    else
      true
    fi
  '

# --- 8. v1 files untouched ---
check "v1 useFetchAll.ts unchanged vs main" \
  bash -c '[ -z "$(git diff main -- client/src/hooks/useFetchAll.ts)" ]'

check "v1 useEntitySelection.ts unchanged vs main" \
  bash -c '[ -z "$(git diff main -- client/src/hooks/useEntitySelection.ts)" ]'

check "v1 FetchAllDialog.tsx unchanged vs main" \
  bash -c '[ -z "$(git diff main -- client/src/components/shared/FetchAllDialog.tsx)" ]'

check "v1 select-display-dashboard.ts unchanged vs main" \
  bash -c '[ -z "$(git diff main -- client/src/utils/select-display-dashboard.ts)" ]'

# --- 9. Priority ERP safety ---
check "no new POST/PATCH/PUT/DELETE to Priority in new server files" \
  bash -c '
    for f in $(git diff main --name-only --diff-filter=AM -- "server/src/**/*.ts"); do
      [ -f "$f" ] || continue
      if grep -qE "method:\s*[\"'"'"']?(POST|PATCH|PUT|DELETE)" "$f"; then
        echo "offender: $f"
        exit 1
      fi
    done
    exit 0
  '

check "priority-queries.ts unchanged" \
  bash -c '[ -z "$(git diff main -- server/src/services/priority-queries.ts)" ]'

# --- 10. Live cache-status endpoint (requires server running on :3001) ---
check "GET /api/sales/cache-status?period=ytd returns 200 with correct shape" \
  bash -c '
    body=$(curl -sf "http://localhost:3001/api/sales/cache-status?period=ytd") || { echo "curl failed"; exit 1; }
    echo "$body" | jq -e "has(\"raw\") and has(\"rowCount\") and has(\"filterHashes\") and has(\"lastFetchDate\")" > /dev/null
  '

check "cache-status.raw is boolean" \
  bash -c '
    curl -sf "http://localhost:3001/api/sales/cache-status?period=ytd" | jq -e ".raw | type == \"boolean\""
  '

check "cache-status.rowCount is number" \
  bash -c '
    curl -sf "http://localhost:3001/api/sales/cache-status?period=ytd" | jq -e ".rowCount | type == \"number\""
  '

# --- 11. No secrets in tracked files ---
check "no secrets/.env committed" \
  bash -c '
    offender=$(git ls-files | grep -E "^\.env$|^server/\.env$|^client/\.env$" || true)
    if [ -n "$offender" ]; then echo "offender: $offender"; false; else true; fi
  '

check "no bearer/password strings added in diff" \
  bash -c '
    leak=$(git diff main | grep -E "^\+" | grep -v "^+++ " | grep -iE "PRIORITY_PASSWORD=|REDIS_TOKEN=|bearer [a-z0-9]{20,}" || true)
    if [ -n "$leak" ]; then echo "$leak"; false; else true; fi
  '

echo ""
echo "=== Summary ==="
echo "PASS: $PASS_COUNT"
echo "FAIL: $FAIL_COUNT"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "[ OK ] Overall: PASS"
  exit 0
else
  echo "[ FAIL ] Overall: $FAIL_COUNT check(s) failed"
  exit 1
fi
```

---

## Loop Detection

Defense against doom-loops — specific triggers and recovery guidance.

### Triggers (stop work IMMEDIATELY if any apply)

| Trigger | Typical symptom |
|---------|-----------------|
| **Same file edited more than 5 times** for the same check | The same check keeps failing and each fix touches `useReport2.ts` (or similar). You're patching symptoms, not root cause. |
| **Same evaluation check fails 3 times in a row** | E.g., A9 (`Filters: Zone: Disney`) has failed after 3 implementation attempts. |
| **Revisiting a task already marked complete** | Going back to Task 1.4 (aggregator opts) after Phase 6 suggests the aggregator contract is wrong, not a display bug. |
| **Screenshot shows fine, check says FAIL** | You're looking at stale state; browser/dev cache or the server restart was skipped. |
| **TypeScript error "fixed" by adding `as any`** | CLAUDE.md explicitly bans this. The type error is telling you the contract is broken. |
| **Test made to "pass" by weakening the assertion** | If a test now checks `>= 0` where it used to check `=== 100`, you've removed the test's value. |

### Recovery procedure

When a trigger fires:

1. **Stop coding.** Do not attempt another fix in the same file.
2. **Re-read the spec** (`docs/specs/2026-04-14-report-2-and-consolidated-2-design.md`) — especially sections 4 (user flows), 6 (server design), 7 (client design). The contract you violated is described there.
3. **Re-read this eval doc** from the top. Understand what the failing check is actually testing.
4. **Invoke `superpowers:systematic-debugging`.** Isolate the failure: minimal reproduction, verify assumptions from the ground up (Redis contents → server route → aggregator → client hook → component). Do NOT guess.
5. **Try a fundamentally different approach.** If you've been modifying `useReport2.ts`, try looking at the server response shape instead. Flip the angle of attack.
6. **If still stuck after recovery:** write a clear 3-sentence summary (what you tried, what failed, what you think the cause is) and ask the user directly. Do not bury the question in prose.

### Scope creep guard

- Do NOT modify v1 files (`useFetchAll.ts`, `useEntitySelection.ts`, `FetchAllDialog.tsx`, `select-display-dashboard.ts`) — per spec section 7.4 and plan. If a check fails and the "fix" requires touching a v1 file, the fix is wrong. The eval doc's v1-untouched checks (5.4–5.7) are hard gates.
- Do NOT add new Priority ERP API endpoints — per spec section 9, v2 makes ZERO new Priority calls. All new functionality lives in client-side UI + server-side re-aggregation.
- Do NOT split existing 300-line files preemptively — only split if a new file would breach 300.
- Do NOT refactor existing passing tests. If a v1 test starts failing after a v2 change, the v2 change violates spec section 2 goal 7 (v1 coexistence) and is wrong.
