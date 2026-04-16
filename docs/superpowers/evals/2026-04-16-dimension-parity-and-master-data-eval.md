# Dimension Parity & Master-Data — Evaluation Criteria

**Spec:** [2026-04-16-dimension-parity-and-master-data-design.md](../specs/2026-04-16-dimension-parity-and-master-data-design.md)
**Plan:** [2026-04-16-dimension-parity-and-master-data-plan.md](../plans/2026-04-16-dimension-parity-and-master-data-plan.md)
**Date:** 2026-04-16

---

## How to Use This Document

1. **Read before starting.** Read this entire doc before writing code so implementation choices are shaped by the criteria. The bar for "done" is defined here, not by intuition.
2. **Verify as you go.** Each section has a `Verify After: Tasks X, Y` tag. Run those checks at that phase boundary — not at the end. Catching a regression between Task 1.3 and Task 3.3 is cheap; catching it after Phase 7 means unwinding 30 commits.
3. **Show your work.** Paste the command and its output. "I verified it" is not proof. Terminal output, curl responses, `tsc --noEmit` exit codes, diff output — that's proof.
4. **Pre-Completion Gate.** Before claiming the feature is complete, run the Quick Smoke Test at the bottom, paste the full output, and confirm every line says OK or PASS. Any FAIL line blocks completion.
5. **Failure recovery.** If a check fails, do NOT retry the same code change. Read the error, re-read the spec, identify the root cause, change approach. If the same check fails 3 times, stop and ask the user — you're in a loop.
6. **Commit after every passing task.** The plan mandates a commit step as the final step of each task. This is non-negotiable. A clean commit stream is required so that:
   - Reviewers can bisect if a regression shows up later.
   - The eval's "Verify After" tags map to specific commit checkpoints.
   - Each eval failure can be narrowed to the commit that introduced it.
   Do NOT batch multiple tasks into a single commit. Do NOT reorder commits. Do NOT squash-rebase before pushing. Push frequently — at minimum at the end of each phase — so progress is visible on GitHub.

## Production & Monitoring Resources

The implementing agent (or reviewer) has browser-based access to these for out-of-process verification:

| Resource | URL | Purpose |
|---|---|---|
| Production dashboard | https://sales-dashboard-production-dbff.up.railway.app/ | Live verification of deployed UI (vendor/zone/prodtype/product dims populated, detail views work). Use Chrome MCP tools. |
| Upstash Redis data browser | https://console.upstash.com/redis/446a3eeb-8d61-4ba9-a950-cbd3fe40191c/data-browser?teamid=0 | Inspect live cache keys — verify master-data caches exist, per-order keys written, filter-hash correct. Use Chrome MCP tools. |
| Railway service console | https://railway.com/project/43fe7792-51d2-4bb7-be6a-b642f6a227e2/service/52831ed3-287b-4e4f-8668-5f3be69cea22?environmentId=498613ee-b2ae-4f30-b940-bf8c9cf6a9cd | Check deploy logs for `[warm-cache] Done.`, `[entities] join-ratio`, build failures. Use Chrome MCP tools. |

**Chrome MCP notes:** Claude's browser tools (`mcp__Claude_in_Chrome__navigate` / `computer` / `get_page_text` etc.) are authorized to interact with these URLs. The Upstash and Railway consoles may require an active authenticated session in the user's Chrome — if the MCP lands on a login screen, surface that to the user rather than auto-driving authentication.

---

## Section 1 — Fidelity / Correctness

**Verify After:** Tasks 1.3, 3.3, 4.1

The core correctness guarantees. Any failure here means the dashboard is silently wrong.

| # | Check | How to verify |
|---|---|---|
| 1.1 | `scopeOrders('customer', {C1})` returns only orders with `CUSTNAME=C1`, items unchanged, `TOTPRICE` unchanged | `npx vitest run server/src/services/__tests__/entity-subset-filter.test.ts -t "customer dim"` — PASS |
| 1.2 | `scopeOrders('zone', {Z1})` returns orders whose customer's ZONECODE ∈ {Z1}, `TOTPRICE` unchanged | Same test file, `-t "zone dim"` — PASS |
| 1.3 | `scopeOrders('vendor', {V1, V2})` narrows items to matching vendors AND rewrites `TOTPRICE = Σ QPRICE` of remaining items | Same test file, `-t "vendor dim"` — PASS; `scoped[0].TOTPRICE === 300` when V1=$100, V2=$200, V3=$50 dropped |
| 1.4 | `scopeOrders` drops orders with zero matching items for item-based dims | Same test file, `-t "drops orders with no matching items"` — PASS |
| 1.5 | Empty `entityIds` Set → returns `[]` (not no-op; caller handles) | Same test file, `-t "empty entityIds"` — PASS |
| 1.6 | Consolidated per-entity breakdowns do NOT cross-contaminate (Codex #2) — one order with V1=$100 + V2=$200 selected: `perEntityMonthlyRevenue[V1]=100`, `perEntityMonthlyRevenue[V2]=200`, NOT 300/300 | `npx vitest run server/src/services/__tests__/data-aggregator.test.ts -t "per-entity"` — PASS |
| 1.7 | Customer-dim back-compat: `GET /api/sales/dashboard?groupBy=customer&entityId=C7826&period=ytd` response is byte-identical to pre-change | Snapshot regression test in `dashboard.test.ts` — PASS |
| 1.8 | Same-period prev-year scope is applied consistently: scoped current AND scoped prev use the same entityIds | Test: given prev-year orders with V1 items, `kpis.prevYearRevenue` reflects only V1's prev-year QPRICE, not full TOTPRICE — PASS |
| 1.9 | Join ratio for vendor master (SUPPLIERS ↔ Y_1159_5_ESH): **100% of order-vendor-codes resolve in SUPPLIERS master** | Run dev server, hit `/api/sales/entities?groupBy=vendor`, inspect `[entities] join-ratio dim=vendor ratio=X.XX` Railway/server log line — `ratio === 1.00` |

**Verdict:** PASS if 9/9. Any failure is blocking.

---

## Section 2 — Functional Completeness

**Verify After:** Tasks 4.1-4.5, Phase 7 smoke test

End-to-end dimension parity. Each dim must function like customers.

| # | Check | How to verify |
|---|---|---|
| 2.1 | `/api/sales/entities?groupBy=vendor` returns populated vendor list when orders cache is warm | `curl 'http://localhost:3001/api/sales/entities?groupBy=vendor'` — `data.entities.length > 0`, `meta.enriched === true` |
| 2.2 | `/api/sales/entities?groupBy=vendor` returns populated list with NULL metrics when orders cache is cold | After `redis-cli flushdb orders:*` then curl entities endpoint — `data.entities.length > 0` (from warm master data), `entities[0].revenue === null`, `meta.enriched === false` |
| 2.3 | `/api/sales/dashboard?groupBy=vendor&entityId=V8534` returns scoped dashboard; vendor revenue = Σ QPRICE of V8534's items only | Pick a known vendor-order pair, manual curl, compare KPIs against direct Priority query — match within $0.01 |
| 2.4 | Multi-select consolidated: `?groupBy=vendor&entityIds=V8534,V8533` returns `perEntityProductMixes`, `perEntityTopSellers`, `perEntityMonthlyRevenue` maps with distinct per-vendor values | Manual curl, assert `data.perEntityMonthlyRevenue['V8534']` and `['V8533']` present with different values |
| 2.5 | Contacts tab for vendor: `GET /api/sales/contacts?dimension=vendor&entityId=V8534` returns contacts from customers who bought V8534's items, with `customerName` field populated on each contact | Manual curl, inspect `data[0].customerName` exists and varies across rows |
| 2.6 | Contacts preserve `(customer, email)` pairs — same email in two customers yields two rows (Codex #4) | Seed test fixture with shared email across C1 + C2, `npx vitest run server/src/routes/__tests__/contacts.test.ts -t "no cross-customer email dedup"` — PASS |
| 2.7 | Report SSE on vendor dim with `brand=ACETUM&countryOfOrigin=Italy` completes and returns scoped CSV | In dev, trigger Report modal on vendor dim, add filters, click Generate — SSE progress completes; downloaded CSV has rows matching both filters only |
| 2.8 | Zone / product_type / product dims each produce entity list + detail view + consolidated mode | Manual dev-smoke: click each dim toggle, click an entity, click Orders/Items/Contacts tabs. No console errors, no empty panels (assuming warm cache) |
| 2.9 | Back-compat: `?customerId=C7826` legacy contacts endpoint unchanged | `curl 'http://localhost:3001/api/sales/contacts?customerId=C7826'` — identical response shape as pre-change |

**Verdict:** PASS if 9/9. Any failure on 2.1-2.6 blocks; 2.7-2.9 may be addressed in a follow-up patch with written plan.

---

## Section 3 — UI Quality & Dimension-Aware Labels

**Verify After:** Tasks 6.1-6.6

No dimension-specific string should leak into another dimension's UI.

| # | Check | How to verify |
|---|---|---|
| 3.1 | Selecting no entity on Vendor dim shows "All Vendors" header (not "All Customers") | Dev server, click Vendors toggle with no entity selected, inspect `<h1>` text — "All Vendors" |
| 3.2 | Loading state on Vendor dim shows "Loading vendors..." (not "Loading customers...") | Cold-boot dev server, click Vendor toggle before data loads, inspect visible loading message — "Loading vendors..." |
| 3.3 | `PerCustomerToggle` button on Vendor consolidated view shows "Per Vendor" | Multi-select 2 vendors, open consolidated modal, find the toggle — "Per Vendor" |
| 3.4 | `PerCustomerKPITable` first column header on Vendor consolidated view shows "Vendor" | Same view as above, inspect table header — "Vendor" |
| 3.5 | `PerCustomerChartTable` first column header on Vendor consolidated view shows "Vendor" | Click a Product Mix / Best Sellers expansion on consolidated vendor view, inspect header — "Vendor" |
| 3.6 | `ConsolidatedHeader` filter summary includes brand/productFamily/countryOfOrigin/foodServiceRetail when set | Run Report with these filters, inspect header line — shows "Brand: ACETUM · Country: Italy" etc. |
| 3.7 | `ReportFilterModal` on Vendor dim shows brand/productFamily/countryOfOrigin/foodServiceRetail dropdowns | Open Report modal from Vendor dim, count dropdowns — 7 visible (3 customer-level + 4 item-level) |
| 3.8 | `ReportFilterModal` on Zone dim shows only customer-level dropdowns (agent, customerType — zone is the dim itself) | Open Report modal from Zone dim — 2 dropdowns visible |
| 3.9 | `ReportFilterModal` "Fetching data for {N} {dim-plural}" uses dim-plural label | Run Report on Vendor dim, observe progress text — "Fetching data for N vendors" |

**Verdict:** PASS if ≥ 8/9. One Medium-severity label miss may ship with a tracked follow-up.

---

## Section 4 — Code Quality

**Verify After:** Each phase (continuous)

Enforce CLAUDE.md rules.

| # | Check | How to verify |
|---|---|---|
| 4.1 | Zero `any` types in new/modified code | `grep -rn ": any\|as any" server/src/ client/src/ shared/ \| grep -v ".test." \| wc -l` — 0 |
| 4.2 | No server or client source file exceeds 300 lines | `find server/src client/src shared -name "*.ts" -o -name "*.tsx" \| xargs wc -l \| awk '$1 > 300 && $2 != "total" {print}'` — empty output |
| 4.3 | Every new file has the FILE/PURPOSE/USED BY/EXPORTS intent block | `for f in $(git diff --name-only HEAD~20 HEAD -- 'server/src/*.ts' 'client/src/*.ts' 'shared/*.ts'); do head -5 "$f" \| grep -q "// FILE:" \|\| echo "MISSING: $f"; done` — empty output (ignore test files) |
| 4.4 | No hardcoded Tailwind colors (use design tokens) | `grep -rn 'className=".*text-\[#' client/src/components/ \| wc -l` — 0 |
| 4.5 | No secrets in source | `grep -rn "password\|Sav1234\|SGAPI" server/src/ client/src/ shared/ --include="*.ts" --include="*.tsx"` — no matches |
| 4.6 | Server TypeScript strict build | `cd server && npx tsc --noEmit` — exit 0, no errors |
| 4.7 | Client TypeScript strict build | `cd client && npx tsc -b --noEmit` — exit 0, no errors |
| 4.8 | Every exported function has at least one importer | For each new `export function X`, `grep -rn "import.*\bX\b" server/src client/src shared \| wc -l` — ≥ 1 |

**Verdict:** PASS if 8/8. Strict — these are CLAUDE.md mandates.

---

## Section 5 — API Robustness & Edge Cases

**Verify After:** Tasks 4.1, 4.4, 4.5

| # | Check | How to verify |
|---|---|---|
| 5.1 | Unknown `entityId` on vendor dim returns empty-but-valid payload (not 500) | `curl 'localhost:3001/api/sales/dashboard?groupBy=vendor&entityId=V_NONEXISTENT'` — status 200, `kpis.totalRevenue === 0`, `orders.length === 0` |
| 5.2 | Empty `entityIds` query param treated as no-scope | `curl 'localhost:3001/api/sales/dashboard?groupBy=vendor&entityIds='` — returns full-dimension (unscoped) dashboard |
| 5.3 | `entityId` and `entityIds` both provided → Zod normalization treats both, uses `entityIds` | Inspect `dashboard.ts` Zod transform output — `_ids.length` reflects union |
| 5.4 | Non-customer-dim request WITHOUT `dimension` param in contacts route defaults to `customer` (back-compat) | `curl 'localhost:3001/api/sales/contacts?customerId=C7826'` — works; response matches legacy shape |
| 5.5 | Contacts batch: request with 50+ customer IDs uses `CUSTNAME in (...)` batched at ≤50/call | Seed fixture with 100 customers, trigger scoped contacts, inspect Priority API call logs — ≤ 50 CUSTNAMEs per `$filter` call |
| 5.6 | fetch-all with `brand=X` filter writes a distinct cache key from unfiltered request | Inspect Redis after two fetch-all runs — `dashboard:report_payload:ytd:customer:brand=X:...` ≠ `dashboard:report_payload:ytd:customer:all:...` |
| 5.7 | SSE abort on in-flight fetch-all stops scope resolution | Manual test: trigger Report, immediately click Cancel — no runaway console/log activity, SSE connection closes cleanly |
| 5.8 | No silent data-corruption cache writes — `entity_detail` cache key NOT written for non-customer dims | `redis-cli KEYS "dashboard:entity_detail:*:vendor:*"` after a vendor dim request — empty result |

**Verdict:** PASS if 8/8.

---

## Section 6 — Deployment Readiness

**Verify After:** Phase 7 + Phase 8

| # | Check | How to verify |
|---|---|---|
| 6.1 | All tests pass (63 existing + ~18 new ≈ 81) | `cd server && npx vitest run` — exit 0, `X passed (X)` line shows all PASS |
| 6.2 | Client bundle under 500 KB gzip | `cd client && npx vite build` — output log shows `dist/assets/index-*.js` size `< 500 kB │ gzip:` |
| 6.3 | Docker multi-stage build succeeds locally | `docker build -t sales-dashboard-test .` from repo root — exit 0 |
| 6.4 | Docker image runs and serves | `docker run -p 3001:3001 --env-file server/.env sales-dashboard-test` → `curl localhost:3001/api/health` returns 200 |
| 6.5 | Warm-cache runs without errors on cold Redis | `redis-cli flushdb`, start server, wait 30s, `redis-cli KEYS "dashboard:*"` — shows customers, zones, vendors, product_types, products, orders_ytd |
| 6.6 | Railway deploy from `main` succeeds (check after push) | After `git push origin main`, monitor Railway dashboard — build + deploy status: Success |
| 6.7 | Production smoke: `/api/sales/entities?groupBy=vendor` on Railway URL returns populated list | `curl 'https://sales-dashboard-production-dbff.up.railway.app/api/sales/entities?groupBy=vendor'` — entities array non-empty |

**Verdict:** PASS if 7/7. 6.6/6.7 are post-merge; others can verify locally.

---

## Section 7 — Performance

**Verify After:** Task 3.3, Phase 7

| # | Check | How to verify |
|---|---|---|
| 7.1 | `scopeOrders` on 5000 orders × 5 entityIds completes in < 50ms | Add a performance test with `performance.now()` — assert duration < 50ms |
| 7.2 | Per-entity re-scoping loop for 10 selected entities completes in < 500ms | Integration test or Railway log — `[dashboard] perEntity aggregation took Xms` — `X < 500` |
| 7.3 | Entities endpoint cold path (master data only) responds in < 200ms | Warm Redis with master data, flush orders, `time curl 'localhost:3001/api/sales/entities?groupBy=vendor'` — real time < 0.5s |
| 7.4 | Entities endpoint warm path (enriched) responds in < 1s for 500 entities | After full warm, `time curl 'localhost:3001/api/sales/entities?groupBy=vendor'` — < 1s |
| 7.5 | Railway master-data parallel warm completes within 10s on cold boot | Check Railway deploy logs for `[warm-cache] Done.` timestamp — ≤ 10s after start |

**Verdict:** PASS if ≥ 4/5. Medium-weight section; 1 miss acceptable with written plan.

---

## Section 8 — Codex Findings Regression

**Verify After:** All relevant tasks (1.3, 3.3, 4.4, 5.2)

Explicit regression tests for each Codex finding so they don't silently reopen.

| # | Check | How to verify |
|---|---|---|
| 8.1 | **Codex #1** — Entity ID for vendor/product_type/product matches order-item field, not master-data PK | Assertion in entity-list-builder test: for a sampled vendor entity, `entity.id === item.Y_1159_5_ESH` for some item where that entity has orders |
| 8.2 | **Codex #2** — Consolidated per-entity breakdowns are computed from per-entity re-scopings, not reused orders | Test from §1.6 — PASS |
| 8.3 | **Codex #3** — Entities query does NOT use `staleTime: Infinity` when `meta.enriched === false` | Grep `grep -n "staleTime: Infinity" client/src/hooks/` — no matches; OR if used, it's gated behind `meta.enriched === true` |
| 8.4 | **Codex #3** — `refetchInterval: 15000` while not enriched | Dev test: flush Redis orders, load vendor dim, observe entities query refetching every ~15s in React Query DevTools until `meta.enriched` flips to true |
| 8.5 | **Codex #4** — Cross-customer email dedup absent | Test from §2.6 — PASS |
| 8.6 | **User direction** — SUPPLIERS fetched without STATDES filter | `grep -n "STATDES" server/src/services/priority-queries.ts` — only appears in `fetchProducts` (LOGPART In Use), NOT in `fetchVendors` |

**Verdict:** PASS if 6/6. All Codex findings + user-direction resolution must hold.

---


## Section 9 — Live Production Verification (Chrome MCP)

**Verify After:** Phase 8 (after Railway deploy completes)

Use Chrome MCP tools (`mcp__Claude_in_Chrome__navigate`, `mcp__Claude_in_Chrome__computer`, `mcp__Claude_in_Chrome__get_page_text`) against the three provided URLs. If a browser session requires authentication, pause and surface the auth prompt to the user — do NOT attempt to drive login.

### 9A — Production Dashboard

URL: `https://sales-dashboard-production-dbff.up.railway.app/`

| # | Check | How to verify via Chrome MCP |
|---|---|---|
| 9A.1 | Vendors toggle shows a populated list (NOT "0 of 0") | Navigate to URL, click Vendors pill (coord near `[140, 23]`), take screenshot, read list-count label — reads `Vendors (N of N)` where N > 0 |
| 9A.2 | Clicking a vendor populates the right panel with KPIs | With Vendors dim active, click a vendor row, screenshot — right panel shows revenue/orders/margin cards, no "Select a vendor to view details" empty state |
| 9A.3 | Vendor revenue ≠ order TOTPRICE for multi-vendor orders | Pick an order in the Orders tab of a vendor detail view, open the order, verify shown line items are narrowed to that vendor's items (should NOT see items from other vendors in the expanded rows) |
| 9A.4 | Contacts tab loads contacts for a vendor with Customer column populated | Click Contacts tab on a vendor detail view, screenshot — tab shows contacts table with a "Customer" column showing actual customer names (not blank) |
| 9A.5 | Zone / Prod. Type / Products toggles each populated | Click each of the 3 remaining toggles in sequence, screenshot each — each shows a non-empty list |
| 9A.6 | No `activeDimension === 'customer'` hidden UI elements — Contacts tab renders on all dims | On each non-customer dim, confirm Contacts tab is present (not hidden) |
| 9A.7 | No console errors in Chrome DevTools after navigating all dims | `mcp__Claude_in_Chrome__read_console_messages` with `onlyErrors: true` — empty or only pre-existing warnings (not regressions) |
| 9A.8 | Dimension label strings are correct — header never reads "All Customers" on a non-customer empty state | On Vendors dim with no entity selected, screenshot and read `<h1>` — "All Vendors" |

### 9B — Upstash Redis Data Browser

URL: `https://console.upstash.com/redis/446a3eeb-8d61-4ba9-a950-cbd3fe40191c/data-browser?teamid=0`

If the page redirects to login, surface the auth prompt to the user and skip the remaining 9B checks with a manual note.

| # | Check | How to verify |
|---|---|---|
| 9B.1 | `dashboard:customers:all` key exists | Navigate to URL, search/filter by pattern `dashboard:customers:all` — key present |
| 9B.2 | `dashboard:vendors:all` key exists | Same, pattern `dashboard:vendors:all` — key present |
| 9B.3 | `dashboard:zones:all` key exists | Same, pattern `dashboard:zones:all` — key present |
| 9B.4 | `dashboard:product_types:all` key exists | Same, pattern `dashboard:product_types:all` — key present |
| 9B.5 | `dashboard:products:all` key exists | Same, pattern `dashboard:products:all` — key present |
| 9B.6 | NO `dashboard:brands:all` key exists (brand dim deferred) | Same, pattern `dashboard:brands:all` — no matches |
| 9B.7 | `orders:idx:ytd:customer:all` index key exists (universal order cache populated) | Pattern `orders:idx:ytd:customer:all` — key present, value is a JSON array of ORDNAMEs |
| 9B.8 | NO stray `dashboard:entity_detail:*:vendor:*` keys (Codex-flagged corruption prevented) | Pattern `dashboard:entity_detail` — no keys with vendor/brand/zone/product_type/product in the qualifier |

### 9C — Railway Deploy Console

URL: `https://railway.com/project/43fe7792-51d2-4bb7-be6a-b642f6a227e2/service/52831ed3-287b-4e4f-8668-5f3be69cea22?environmentId=498613ee-b2ae-4f30-b940-bf8c9cf6a9cd`

If the page requires authentication, surface the auth prompt and skip remaining 9C checks.

| # | Check | How to verify |
|---|---|---|
| 9C.1 | Latest deploy status: Success | Navigate to URL, read the top-of-page status badge — "Success" or equivalent green indicator |
| 9C.2 | Deploy logs show `[warm-cache] Done.` within 30s of startup | Open deploy logs tab, search/grep for `[warm-cache] Done.` — timestamp present, within 30s after `listening on` log line |
| 9C.3 | Deploy logs show `[entities] join-ratio dim=vendor ratio=1.00` (or ≥ 0.98) | Search logs for `join-ratio` — every dimension logs a ratio ≥ 0.98; vendor expected 1.00 |
| 9C.4 | No `[error]` log lines during first 5 minutes post-deploy | Search logs for `error` — only pre-existing noise, no new regression |
| 9C.5 | Health endpoint green | In logs, look for `GET /api/health 200` appearing regularly — confirms Express is serving |

**Verdict:** 9A PASS if ≥ 7/8, 9B PASS if ≥ 6/8 (auth-skipped rows count as not-blocking), 9C PASS if ≥ 4/5. All three sub-sections must be attempted; auth-blocked checks must be surfaced.

---


## Overall Score Table

| Section | Weight | Verify After | Verdict |
|---|---|---|---|
| 1. Fidelity / Correctness | **Critical** | Tasks 1.3, 3.3, 4.1 | |
| 2. Functional Completeness | **Critical** | Tasks 4.1-4.5, Phase 7 | |
| 3. UI Quality & Dimension Labels | High | Tasks 6.1-6.6 | |
| 4. Code Quality | **Critical** | Continuous | |
| 5. API Robustness & Edge Cases | High | Tasks 4.1, 4.4, 4.5 | |
| 6. Deployment Readiness | **Critical** | Phase 7, Phase 8 | |
| 7. Performance | Medium | Task 3.3, Phase 7 | |
| 8. Codex Findings Regression | **Critical** | Tasks 1.3, 3.3, 4.4, 5.2 | |
| 9. Live Production Verification (Chrome MCP) | High | Phase 8 post-deploy | |

**Ship readiness:** all **Critical** sections PASS. **High** sections allow 1 FAIL with written fix plan.

---

## Verification Schedule

Run eval sections at these plan checkpoints:

| After completing... | Run these sections |
|---|---|
| Phase 1 (Tasks 1.1-1.4) — foundation types | §1 (checks 1.1-1.5), §4 (all) |
| Phase 2 (Tasks 2.1-2.3) — master data fetches | §4 (all), §6.5 (warm-cache cold boot) |
| Phase 3 (Tasks 3.1-3.3) — scope aggregation | §1 (all), §4 (all), §7.1-7.2, §8.2 |
| Phase 4 (Tasks 4.1-4.5) — backend routes | §1 (all), §2 (checks 2.1-2.6, 2.9), §5 (all), §8.5, §8.6 |
| Phase 5 (Tasks 5.1-5.6) — client types + hooks | §4 (all), §8.3, §8.4 |
| Phase 6 (Tasks 6.1-6.6) — client components | §3 (all) |
| Phase 7 (Task 7.1) — vendor smoke | §1 (9), §2 (7), §6 (all local), §7 (all) |
| Phase 8 (Tasks 8.1-8.5) — other dims + deploy | §2 (check 2.8), §6.6, §6.7, **§9 Live Production Verification (Chrome MCP)**, **Pre-Completion Gate** |

---

## Pre-Completion Gate

Before declaring the feature complete, the implementing agent must:

1. Run the full Quick Smoke Test below.
2. Paste the complete terminal output (not a summary) into the PR description or completion message.
3. Confirm every check shows OK or PASS.
4. If any line shows FAIL: do NOT declare complete. Fix root cause, re-run, paste again.

**This gate is non-negotiable.** Implementation is not done until the gate passes with pasted evidence.

---

## Quick Smoke Test

Self-contained bash script. Runs in under 3 minutes. Covers every Critical check.

```bash
#!/usr/bin/env bash
# Dimension Parity Pre-Completion Smoke Test
set -u
ROOT="/Users/victorproust/Documents/Work/SG Interface/Sales Dashboard v1"
cd "$ROOT"

echo "============================================================"
echo "  Dimension Parity & Master-Data — Pre-Completion Gate"
echo "  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================================"
pass=0; fail=0
check() { local label="$1"; shift; if "$@" > /tmp/smoke.out 2>&1; then echo "OK    $label"; ((pass++)); else echo "FAIL  $label (see /tmp/smoke.out)"; ((fail++)); fi; }

# --- Code quality ---
check "4.1 no any types" bash -c 'test "$(grep -rn ": any\|as any" server/src/ client/src/ shared/ 2>/dev/null | grep -v ".test." | wc -l | tr -d " ")" = "0"'
check "4.2 no file > 300 LOC" bash -c 'test -z "$(find server/src client/src shared -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs wc -l 2>/dev/null | awk "\$1 > 300 && \$2 != \"total\" {print}")"'
check "4.5 no secrets in source" bash -c '! grep -rqn "Sav1234\|SGAPI" server/src/ client/src/ shared/ --include="*.ts" --include="*.tsx"'
check "4.6 server TS build" bash -c 'cd server && npx tsc --noEmit'
check "4.7 client TS build" bash -c 'cd client && npx tsc -b --noEmit'
check "8.6 fetchVendors no STATDES filter" bash -c '! grep -E "STATDES.*Active" server/src/services/priority-queries.ts'

# --- Correctness tests ---
check "1.1-1.5 scopeOrders unit tests" bash -c 'cd server && npx vitest run src/services/__tests__/entity-subset-filter.test.ts'
check "1.6 per-entity breakdown (Codex #2)" bash -c 'cd server && npx vitest run src/services/__tests__/data-aggregator.test.ts -t "per-entity"'
check "1.4 filterOrdersByItemCriteria tests" bash -c 'cd server && npx vitest run src/services/__tests__/customer-filter.test.ts'
check "1.7 customer-dim back-compat regression" bash -c 'cd server && npx vitest run src/routes/__tests__/dashboard.test.ts -t "back-compat"'
check "2.6 contacts no cross-customer dedup (Codex #4)" bash -c 'cd server && npx vitest run src/routes/__tests__/contacts.test.ts -t "no cross-customer"'

# --- Build + full test suite ---
check "6.1 full vitest suite" bash -c 'cd server && npx vitest run'
check "6.2 client vite build" bash -c 'cd client && npx vite build'

# --- Grep-based regressions ---
check "8.3 no staleTime: Infinity in entity query hooks" bash -c '! grep -rn "staleTime:[[:space:]]*Infinity" client/src/hooks/ --include="*.ts" --include="*.tsx"'
check "5.8 no entity_detail cache write for non-customer dims" bash -c '! grep -n "cacheKey.\x27entity_detail\x27.*groupBy.*!==.\x27customer\x27" server/src/routes/dashboard.ts'

# --- Output ---
echo "============================================================"
echo "  Results: $pass PASS, $fail FAIL"
echo "============================================================"
if [ "$fail" -ne 0 ]; then
  echo "GATE BLOCKED — fix failing checks before declaring complete."
  exit 1
fi
echo "GATE PASSED — implementation complete."
```

Save to `scripts/smoke-dimension-parity.sh` and make executable. Run with `bash scripts/smoke-dimension-parity.sh` (or after `chmod +x`, `./scripts/smoke-dimension-parity.sh`).

**Manual checks NOT in the automated smoke test** (require dev server + browser):
- §2.3 vendor revenue matches direct Priority query within $0.01
- §2.7 Report SSE with new filters produces scoped CSV
- §2.8 zone/product_type/product dims each work end-to-end
- §3.1-3.9 UI labels
- §6.5-6.7 Docker + Railway + production smoke
- §7.3-7.5 performance observation

Do these manually as part of Phase 7 vendor smoke and Phase 8. Document results in `docs/superpowers/plans/vendor-smoke-results.md` (referenced in plan Task 7.1 Step 5).

---

## Loop Detection

If ANY of these triggers fires, the implementing agent must stop and ask the user:

- **Same file edited more than 5 times** for a single eval check
- **Same eval check fails 3 times in a row** with different attempted fixes
- **Going back to a task already marked complete** to "fix" it
- **Re-running the smoke test more than 4 times** without full PASS

Recovery protocol:
1. Re-read the spec section covering the failing check.
2. Re-read the relevant plan task.
3. Write a one-line diagnosis: "The check fails because X, and my attempted fixes have all assumed Y."
4. Try a fundamentally different approach — if you tried "tweak the predicate," try "rewrite the aggregator contract."
5. If still stuck after one different-approach attempt, **stop and ask the user** with the one-line diagnosis.

---

## Self-Review Coverage

Every spec section maps to at least one eval check:

| Spec § | Eval coverage |
|---|---|
| §1 Motivation (root-cause) | §1.9 (join-ratio log), §2.2 (cold orders → enriched=false), §5.8 (entity_detail not written) |
| §2 Dimension Semantics | §1.1-1.5 scopeOrders per dim |
| §3 Pre-filter + per-entity | §1.6, §8.2 |
| §4 Master data | §6.5 warm-cache cold boot |
| §5 File changes | §4 code quality, §4.8 unused exports |
| §6 API contracts | §2.1-2.9, §5 |
| §7 Error handling + staleTime | §5.1-5.3 edge cases, §8.3-8.4 staleTime |
| §8 Edge cases | §5.1, §2.2, §5.5, §5.8 |
| §9 Testing | §1, §2, §4.6-4.7 all anchor on existing and new tests |
| §10 Out of scope | Not evaluated (by definition) |
| §11 Rollout | §6.6 Railway deploy |
| §12 Integration contracts | §4.8 unused exports |
| §13 Codex findings | §8 regression section |

No gaps identified.
