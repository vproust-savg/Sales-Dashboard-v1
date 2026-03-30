# Eval A: Backend — Express + Priority ERP + Redis Cache

**Spec:** `docs/specs/2026-03-29-sales-dashboard-design.md`
**Plan:** `docs/plans/2026-03-30-plan-a-backend.md`
**Test customer:** `C7826` (read from Priority ERP — **NEVER write to Priority**)

---

## How to Use This Document

1. **Read before starting** — read the entire eval doc before writing code so implementation choices are shaped by the criteria.
2. **Verify as you go** — each section has a "Verify After" tag. Run checks after those tasks, not at the end. Catching issues early is cheap; catching them late means rework.
3. **Show your work** — paste the command and its output. "I verified it" is not proof. Terminal output is proof.
4. **Subagent reviews are mandatory** — at review checkpoints (see Section 7 below), dispatch a fresh autonomous subagent for review. Do NOT self-review your own code.
5. **Pre-Completion Gate** — before declaring complete, run the Quick Smoke Test, paste output, confirm all PASS. Not done until the gate passes with evidence.
6. **Failure recovery** — when a check fails, don't retry the same approach. Read the error, re-read the spec, fix the root cause. Same check fails 3 times: stop and ask the user.

---

## Autonomous Review Subagents

At specified checkpoints, dispatch a **fresh subagent** (not yourself) for independent review. The subagent has clean context — it reads the code with fresh eyes and catches issues you've gone blind to.

### Review Checkpoint 1: After Tasks 4-7 (Core Services Complete)

Dispatch a code review subagent:

```
Use /requesting-code-review to review these files:
- server/src/services/priority-client.ts
- server/src/services/priority-queries.ts
- server/src/services/data-aggregator.ts
- server/src/services/dimension-grouper.ts
- server/tests/services/*.test.ts

Focus areas:
1. SECURITY: Confirm the Priority client is strictly read-only (GET only, no POST/PUT/PATCH/DELETE)
2. CORRECTNESS: KPI formulas match spec Section 10.1 exactly (especially weighted margin, not average)
3. ROBUSTNESS: Both Priority error formats handled (spec 17.7), $expand URL encoding is raw (spec 17.8)
4. Spec: docs/specs/2026-03-29-sales-dashboard-design.md Sections 10, 17, 18
```

**Action on findings:** Fix any Critical/High issues before proceeding to Task 8. Medium issues can be deferred.

### Review Checkpoint 2: After Task 11 (All Routes + Tests Complete)

Dispatch a code review subagent:

```
Use /requesting-code-review to review these files:
- server/src/routes/dashboard.ts
- server/src/routes/contacts.ts
- server/src/cache/cache-layer.ts
- server/src/middleware/error-handler.ts
- server/src/middleware/request-validator.ts
- server/tests/routes/*.test.ts

Focus areas:
1. SECURITY: No user input interpolated into OData $filter without Zod validation
2. API CONTRACT: Response shape matches shared/types/api-responses.ts exactly
3. CACHING: TTLs match spec Section 19.2, cache key schema matches 19.1
4. Spec: docs/specs/2026-03-29-sales-dashboard-design.md Sections 6, 17, 19
```

**Action on findings:** Fix all Critical issues. High issues must have documented fix plan.

---

## Overall Score Table

| Section | Weight | Verify After | Verdict |
|---------|--------|-------------|---------|
| 1. Security & Read-Only | **Critical** | Tasks 4-5 | |
| 2. Data Accuracy | **Critical** | Tasks 6-7 | |
| 3. API Robustness | **Critical** | Tasks 4-5, 9 | |
| 4. Code Quality | High | Tasks 0-10 | |
| 5. Backend Performance | High | Task 11 | |
| 6. Cache Correctness | High | Task 8 | |

**Ship readiness:** All Critical PASS. High allows 1 FAIL with documented fix plan.

---

## 1. Security & Read-Only Enforcement

**Verify After: Tasks 4-5 (Priority client + query builders)**

This is the single most important eval section. Priority ERP is a live production system. The dashboard must NEVER write data.

| # | Check | How to verify |
|---|-------|---------------|
| 1.1 | `PriorityClient` class exposes only GET methods — no POST, PUT, PATCH, DELETE | `grep -rn 'method:' server/src/services/priority-client.ts` — only `'GET'` appears. No other HTTP methods exist in the file. |
| 1.2 | `fetch()` calls in priority-client.ts use `method: 'GET'` exclusively | `grep -n "method:" server/src/services/priority-client.ts` — every match is `method: 'GET'` |
| 1.3 | No OData write operations in query builders | `grep -rn '\$action\|POST\|PUT\|PATCH\|DELETE\|insert\|update\|delete' server/src/services/priority-queries.ts` — 0 matches |
| 1.4 | Priority credentials are not logged or exposed | `grep -rn 'password\|PRIORITY_PASSWORD' server/src/` — only appears in `config/env.ts` (Zod parse) and `priority-client.ts` (auth header construction). Never in console.log, error messages, or API responses. |
| 1.5 | `.env` file is in `.gitignore` | `grep '.env' .gitignore` — `.env` or `.env*` is listed |
| 1.6 | No user input is interpolated into OData `$filter` without validation | Inspect all `$filter` constructions in `priority-queries.ts` — customer codes use Zod-validated input from route handlers, single quotes are escaped with `''` |

**Verdict:** PASS if 6/6 checks succeed. Any failure is a blocker.

---

## 2. Data Accuracy

**Verify After: Tasks 6-7 (data aggregator + dimension grouper)**

Validate dashboard calculations against Priority ERP's native reports using test customer C7826.

| # | Check | How to verify |
|---|-------|---------------|
| 2.1 | Total Revenue for C7826 YTD matches Priority | Fetch orders for C7826 via the dashboard API: `curl 'localhost:3001/api/sales/dashboard?groupBy=customer&period=ytd'`. Find C7826 in entities array. Compare `revenue` against Priority's "Sales by Customer" report for C7826 YTD. Must match within $1 (rounding). |
| 2.2 | Order count for C7826 matches Priority | Same API response — `orderCount` for C7826 entity must equal the number of non-cancelled orders in Priority for that customer in YTD. |
| 2.3 | Margin $ is computed from QPROFIT, not from price arithmetic | In `data-aggregator.ts`, `marginAmount` must use `SUM(QPROFIT)`. Verify: `grep 'QPROFIT' server/src/services/data-aggregator.ts` — used in reduce for marginAmount. |
| 2.4 | Margin % is weighted (totalProfit / totalItemRevenue), not average of percentages | Read `computeKPIs()` function — `marginPercent` = `totalProfit / totalItemRevenue * 100`. Not an average of per-order margins. |
| 2.5 | Cancelled orders are excluded | `grep -n 'Canceled\|EXCLUDED_STATUSES' server/src/services/` — filter applied in query builders. Verify: the count from check 2.2 excludes any status matching `EXCLUDED_STATUSES`. |
| 2.6 | Monthly revenue sums to total revenue | From the API response: `SUM(monthlyRevenue[*].currentYear)` must equal `kpis.totalRevenue`. Tolerance: $0 (exact). |
| 2.7 | Top 10 products are ranked by revenue descending | From the API response: `topSellers[0].revenue >= topSellers[1].revenue >= ... >= topSellers[9].revenue`. |
| 2.8 | Product mix percentages sum to 100% (±1% rounding) | `SUM(productMix[*].percentage)` is between 99 and 101. |
| 2.9 | Dimension grouper produces correct entity count for "customer" | Entity count in API response matches `SELECT COUNT(DISTINCT CUSTNAME) FROM ORDERS WHERE CURDATE >= [ytd_start] AND status != Canceled` equivalent. |

**Verdict:** PASS if 9/9 checks succeed. Any failure is a blocker.

---

## 3. API Robustness

**Verify After: Tasks 4-5 (Priority client), Task 9 (routes)**

| # | Check | How to verify |
|---|-------|---------------|
| 3.1 | `IEEE754Compatible: true` header on every Priority request | In `priority-client.ts`, the headers object includes `'IEEE754Compatible': 'true'`. Verify: `grep 'IEEE754' server/src/services/priority-client.ts` — present. |
| 3.2 | `Prefer: odata.maxpagesize=49900` header on every request | `grep 'Prefer' server/src/services/priority-client.ts` — `'Prefer': 'odata.maxpagesize=49900'` present in headers. |
| 3.3 | `$expand` is appended as raw string, not via searchParams | In `buildUrl()`, the `$expand` parameter is concatenated to the URL string, NOT passed through `URL.searchParams.set()`. Verify the code does not encode `(` or `)` in expand values. |
| 3.4 | Both Priority error formats are parsed | `extractError()` handles `body.error.message` (OData format) AND `body.FORM.InterfaceErrors.text` (Priority format). Verify: unit tests for both formats pass. |
| 3.5 | Pagination handles MAXAPILINES boundary | `fetchAllPages()` implements cursor-based pagination when page count approaches MAXAPILINES. Verify: unit test for multi-page fetch passes. |
| 3.6 | Rate limiting throttles at 100 calls/min | `throttle()` method tracks request timestamps and waits when approaching limit. Verify: `API_LIMITS.CALLS_PER_MINUTE` equals `100` in constants. |
| 3.7 | Invalid `groupBy` param returns 400 | `curl 'localhost:3001/api/sales/dashboard?groupBy=invalid'` — returns HTTP 400 with Zod validation error. |
| 3.8 | Missing `customerId` on contacts returns 400 | `curl 'localhost:3001/api/sales/contacts'` — returns HTTP 400. |
| 3.9 | Health endpoint returns 200 | `curl 'localhost:3001/api/health'` — returns `{"status":"ok"}` with HTTP 200. |

**Verdict:** PASS if 9/9 checks succeed.

---

## 4. Code Quality

**Verify After: All tasks (run at Task 12)**

| # | Check | How to verify |
|---|-------|---------------|
| 4.1 | TypeScript strict mode compiles clean | `cd server && npx tsc --noEmit` — 0 errors, 0 warnings |
| 4.2 | No unused locals or parameters | Same as 4.1 — `noUnusedLocals: true` and `noUnusedParameters: true` in tsconfig enforces this |
| 4.3 | Every file under 200 lines | `find server/src -name '*.ts' -exec wc -l {} + \| awk '$1 > 200'` — 0 results |
| 4.4 | Every file has intent block | `for f in server/src/**/*.ts; do head -4 "$f" \| grep -q 'FILE:' \|\| echo "MISSING: $f"; done` — 0 missing |
| 4.5 | All 45 tests pass | `cd server && npx vitest run` — 45 tests, 0 failures |
| 4.6 | No `any` type usage | `grep -rn ': any\|as any' server/src/` — 0 matches (excluding error handler where `unknown` is used) |

**Verdict:** PASS if 6/6 checks succeed. 1 failure acceptable with documented fix.

---

## 5. Backend Performance

**Verify After: Task 11 (integration tests)**

| # | Check | How to verify |
|---|-------|---------------|
| 5.1 | Dashboard API responds in < 5s (cold cache) | `time curl 'localhost:3001/api/sales/dashboard?groupBy=customer&period=ytd'` — real time < 5.0s |
| 5.2 | Dashboard API responds in < 200ms (warm cache) | Run same curl twice. Second call: real time < 0.2s |
| 5.3 | API response payload < 500KB | `curl -s 'localhost:3001/api/sales/dashboard?groupBy=customer&period=ytd' \| wc -c` — under 512000 bytes |
| 5.4 | Initial load uses ≤ 8 Priority API calls | Count `fetch()` calls logged during a cold-cache dashboard load. Must be ≤ 8 (per spec Section 17.5 rate budget). |

**Verdict:** PASS if 4/4 checks succeed. 1 failure acceptable with documented fix.

---

## 6. Cache Correctness

**Verify After: Task 8 (cache layer)**

| # | Check | How to verify |
|---|-------|---------------|
| 6.1 | Second request for same params is served from cache | Make two identical requests. Response `meta.cached` is `false` on first, `true` on second. |
| 6.2 | Cache key includes entity type and period | `grep 'cacheKey' server/src/routes/dashboard.ts` — key uses entity type + period parameters. |
| 6.3 | YTD cache TTL is 15 minutes | `CACHE_TTLS.orders_ytd` equals `900` (15 * 60). Verify in constants.ts. |
| 6.4 | Historical year cache TTL is 24 hours | `CACHE_TTLS.orders_year` equals `86400` (24 * 60 * 60). |
| 6.5 | Cache stores aggregated data, not raw API responses | Inspect what's stored: the `cachedFetch` wraps the fetcher output (which is the aggregated `DashboardPayload`), not raw Priority response arrays. |

**Verdict:** PASS if 5/5 checks succeed.

---

## Verification Schedule

| After completing... | Run these sections |
|--------------------|--------------------|
| Tasks 0-3 (scaffolding + types + config) | Section 4: checks 4.1, 4.2 only (TypeScript compiles) |
| Tasks 4-5 (Priority client + queries) | **Section 1: Security** (all 6 checks) + **Section 3: API Robustness** (checks 3.1-3.6) |
| Tasks 6-7 (aggregator + grouper) | **Section 2: Data Accuracy** (all 9 checks) |
| Task 8 (cache layer) | **Section 6: Cache Correctness** (all 5 checks) |
| Tasks 9-11 (routes + server + integration tests) | **Section 3** (checks 3.7-3.9) + **Section 5: Performance** (all 4 checks) |
| Task 12 (final verification) | **Section 4: Code Quality** (all 6 checks) + **Pre-Completion Gate** |

---

## Pre-Completion Gate

Before declaring Plan A complete, the implementing agent MUST:

1. Run the Quick Smoke Test below
2. Paste the **complete output** (not a summary)
3. Confirm every line says OK or PASS
4. If any line fails: fix, re-run, paste again

---

## Quick Smoke Test

```bash
#!/bin/bash
echo "========================================="
echo "  Plan A Backend — Quick Smoke Test"
echo "========================================="

cd server

# 1. TypeScript
echo -n "[4.1] TypeScript compiles clean... "
npx tsc --noEmit 2>&1 && echo "OK" || echo "FAIL"

# 2. Tests
echo -n "[4.5] All tests pass... "
RESULT=$(npx vitest run 2>&1)
if echo "$RESULT" | grep -q "Tests.*passed"; then
  COUNT=$(echo "$RESULT" | grep -o '[0-9]* passed' | head -1)
  echo "OK ($COUNT)"
else
  echo "FAIL"
  echo "$RESULT" | tail -5
fi

# 3. File size
echo -n "[4.3] All files under 200 lines... "
OVERSIZE=$(find src -name '*.ts' -exec sh -c 'test $(wc -l < "$1") -gt 200 && echo "$1"' _ {} \;)
if [ -z "$OVERSIZE" ]; then echo "OK"; else echo "FAIL: $OVERSIZE"; fi

# 4. Intent blocks
echo -n "[4.4] All files have intent blocks... "
MISSING=$(find src -name '*.ts' -exec sh -c 'head -4 "$1" | grep -q "FILE:" || echo "$1"' _ {} \;)
if [ -z "$MISSING" ]; then echo "OK"; else echo "FAIL: $MISSING"; fi

# 5. No any types
echo -n "[4.6] No 'any' type usage... "
ANYS=$(grep -rn ': any\|as any' src/ 2>/dev/null | wc -l)
if [ "$ANYS" -eq 0 ]; then echo "OK"; else echo "FAIL ($ANYS occurrences)"; fi

# 6. Security: read-only
echo -n "[1.1] Priority client is read-only... "
WRITES=$(grep -n 'POST\|PUT\|PATCH\|DELETE' src/services/priority-client.ts 2>/dev/null | grep -v '// ' | wc -l)
if [ "$WRITES" -eq 0 ]; then echo "OK"; else echo "FAIL ($WRITES write methods found)"; fi

# 7. Required headers
echo -n "[3.1] IEEE754Compatible header present... "
grep -q 'IEEE754Compatible' src/services/priority-client.ts && echo "OK" || echo "FAIL"

echo -n "[3.2] Prefer header present... "
grep -q 'odata.maxpagesize' src/services/priority-client.ts && echo "OK" || echo "FAIL"

# 8. Server starts
echo -n "[3.9] Server starts and health endpoint works... "
timeout 10 npx tsx src/index.ts &
SERVER_PID=$!
sleep 3
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null)
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
if [ "$HEALTH" = "200" ]; then echo "OK"; else echo "FAIL (HTTP $HEALTH)"; fi

echo "========================================="
echo "  Smoke Test Complete"
echo "========================================="
```

---

## Loop Detection

Stop and reassess if any of these occur:
- Same file edited more than **5 times** for the same check
- Same evaluation check fails **3 times** in a row
- Going back to a task already marked complete
- Priority API returns unexpected data format — re-read spec Section 17.7 before retrying

**Recovery:** Re-read the spec section referenced in the failing check. Try a fundamentally different approach. If stuck after 3 attempts, ask the user.
