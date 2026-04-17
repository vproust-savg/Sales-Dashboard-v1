# Dashboard All-Dimensions Overhaul — Evaluation Criteria

**Date:** 2026-04-17
**Covers:** `2026-04-17-foundation-and-cross-cutting-plan.md` + `2026-04-17-product-family-migration-plan.md`
**Spec:** `docs/specs/2026-04-17-all-dimensions-review-design.md` (v2)

---

## How to Use This Document

1. **Read before starting.** Read this eval doc in full before writing any code. Implementation choices should be shaped by the criteria — not retrofitted to pass them.
2. **Verify as you go.** Each section has a **Verify After** tag pointing at specific plan tasks. Run those checks after the tagged tasks — not at the end. Late verification = expensive rework.
3. **Show your work.** Paste commands and their output. "I verified it" is not proof. Terminal output or a screenshot is proof. For live-system checks, paste the URL visited + the specific element seen.
4. **Pre-Completion Gate.** Before declaring either plan complete, run the full Quick Smoke Test (§Smoke), paste the complete output, and confirm every line says OK or PASS. Not done until the gate passes with pasted evidence.
5. **Failure recovery.** When a check fails, do NOT retry the same approach. Read the error, re-read the spec and the relevant plan task, fix the root cause. If the same check fails 3 times in a row: stop, invoke systematic-debugging skill, and escalate to the user.

---

## Live system under test

The fresh reviewer agent will visit these URLs via the Claude-in-Chrome MCP after implementation + deploy:

| Surface | URL | Purpose |
|---|---|---|
| Frontend (embedded) | https://airtable.com/appjwOgR4HsXeGIda/pagLryv6BSV06bBdy | Visual + interaction checks (Airtable iframe) |
| Railway logs | https://railway.com/project/43fe7792-51d2-4bb7-be6a-b642f6a227e2/service/52831ed3-287b-4e4f-8668-5f3be69cea22?environmentId=498613ee-b2ae-4f30-b940-bf8c9cf6a9cd | Warm-cache boot log, request/error traces |
| Upstash Redis | https://console.upstash.com/redis/446a3eeb-8d61-4ba9-a950-cbd3fe40191c/data-browser?teamid=0 | Cache-key inspection (product_family keys exist) |

Test customer for all functional checks: **`C7826`**.

---

## Section A — Backend Correctness (Critical)

**Verify After:** Plan A Tasks 1-4, 9, 11, 16 · Plan B Tasks A1-A5

| # | Check | How to verify |
|---|---|---|
| A1 | `computeMetrics` returns all six metrics for non-empty input; all null for empty | `cd server && npx vitest run src/services/__tests__/compute-metrics.test.ts` — 2/2 PASS |
| A2 | `dimension-grouper-prev-year.test.ts` asserts all 18 prev-year fields on `EntityListItem` | `cd server && npx vitest run src/services/__tests__/dimension-grouper-prev-year.test.ts` — all cases PASS |
| A3 | Every entity in `/api/sales/entities?dimension=customer` carries 18 prev-year fields (not just 2) | `curl -s 'http://localhost:3001/api/sales/entities?dimension=customer' \| jq '.data[0] \| keys' \| grep -c "prevYear"` — result is `12` (12 prev-year keys) |
| A4 | Revenue-card prev-year math matches legacy computation for at least one customer | Spot-check C7826: `curl .../entities?dimension=customer \| jq '.data[] \| select(.id=="C7826") \| {rev: .revenue, prev: .prevYearRevenue, prevFull: .prevYearRevenueFull}'` — non-null values, plausible ratio |
| A5 | `fetchProductFamilies` hits FAMILY_LOG with FTCODE ∈ {01,02,03} filter | Unit test `src/services/__tests__/fetch-product-families.test.ts` — PASS |
| A6 | `/api/sales/entities?dimension=product_family` returns approximately 20 rows, each with a readable `FAMILYDESC` name | `curl .../entities?dimension=product_family \| jq '.data \| length'` — between 12 and 25; spot-check names include "Beverages", "Charcuterie", "Chocolate & Praline" |
| A7 | No product with `PARTNAME == '000'` appears in `/api/sales/entities?dimension=product` | `curl .../entities?dimension=product \| jq '[.data[] \| select(.id=="000")] \| length'` — result is `0` |
| A8 | `customerName` is populated on every row of single-entity Orders for non-customer dimensions | `curl .../orders?dimension=zone&entityId=<any>\| jq '.data[] \| select(.customerName==null) \| length'` — 0 |
| A9 | `customerName` is populated on every row of Contacts for non-customer dimensions | `curl .../contacts?dimension=zone&entityId=<any>\| jq '.data[] \| select(.customerName==null) \| length'` — 0 |

**Verdict threshold:** All 9 PASS required.

---

## Section B — Functional Completeness (Critical)

**Verify After:** Plan A Tasks 5-23 · Plan B Task A7, B1-B2

Functional = "the feature works end-to-end when a human clicks through." Verified live in the Airtable embed by the fresh reviewer agent via Claude-in-Chrome MCP.

| # | Check | How to verify |
|---|---|---|
| B1 | Period toggle NOT visible in any dimension's DetailHeader | Visit Airtable embed, click each dimension tab, screenshot the header. No YTD/2026 pills anywhere. |
| B2 | Period toggle NOT visible in ConsolidatedHeader | Enter Reports view, screenshot header. No YTD/2026 pills. |
| B3 | KPI small card → Per Customer → renders 4 columns (Customer, YTD+arrow, LY same period, LY full) | Click the Revenue small card. Switch to "Per Customer". Screenshot shows 4 columns. Repeat for Orders, Avg Order, Margin %, Margin $, Frequency cards. |
| B4 | Trend arrow colors: green ▲ when current > prev, red ▼ when lower, muted em-dash when prev null | Screenshot shows mixture of green ▲, red ▼, and em-dash values across visible rows. |
| B5 | NO literal `\u2014` rendered anywhere in the Per-Customer table (either real em-dash "—" or a colored arrow) | Screenshot; text should show "—" (single character) never the 6-char literal `\u2014`. |
| B6 | Reports view has a visible close button (X) in the header | Enter Reports view, screenshot — X icon top-right of ConsolidatedHeader. |
| B7 | Clicking the Reports close button returns to single-entity view AND the URL no longer reflects report mode | Click X → dashboard returns to classic left-panel+right-panel view. |
| B8 | Escape key also closes Reports view | With Reports view open, press Escape — dashboard returns to classic. |
| B9 | Reports Orders tab has time-range filter tabs (Last 30 Days / 3 Months / 6 Months / 12 Months / All) | Enter Reports view, go to Orders tab, screenshot shows filter tabs row. |
| B10 | Reports Orders tab defaults to Last 30 Days on open | Enter Reports view, go to Orders tab — "Last 30 Days" is highlighted as active without any click. |
| B11 | Reports Orders tab respects selection — switching to 12 Months changes the row count | Click "12 Months", row count visibly increases. |
| B12 | Consolidated Orders column order is `Date · Order # · Customer · Items · Amount · Margin % · Status` | Screenshot of thead row — Customer sits between Order # and Items. |
| B13 | Single-entity Orders table shows Customer column between Order # and Items for Zone / Vendor / Brand / Product Family / Product dimensions | Select a Zone → Orders tab → Customer column visible. Repeat for Vendor, Brand, Product Family, Product. |
| B14 | Single-entity Orders table does NOT show Customer column on the Customer dimension | Select customer C7826 → Orders tab → no Customer column. |
| B15 | Contacts tab on Zone / Vendor / Brand / Product Family / Product renders `GroupedContactsTable` (per-customer sections with ▶ / ▼ toggles) | Visit Zone dimension → Contacts tab. Sections visible with "▶ <customer name>  N contacts". |
| B16 | Collapsed section expands on click; expanded section collapses on click | Click a ▶ header → contacts appear, icon flips to ▼. Click again → contacts hide. |
| B17 | Customer dimension Contacts tab renders `ContactsTable` (flat, not grouped) | Select C7826 → Contacts tab → flat table, no ▶ / ▼ section headers. |
| B18 | Left-panel search by `C78` matches C7826 | Customer dimension, type `C78` in search → C7826 appears in the filtered list. |
| B19 | Left-panel search by vendor code matches vendor | Vendor dimension, type a known vendor code (e.g., `V01`) → vendor appears. |
| B20 | Left-panel search by SKU matches product | Product dimension, type a known SKU prefix → product appears. |
| B21 | Left panel Product Family shows approximately 20 entries, sorted alphabetically | Select Product Family dimension → list contains "Beverages", "Charcuterie", "Cheeses", "Chocolate & Praline", "Filling & Decor", "Glaze & Inclusion", "Honey & Sweet", "Oils & Vinegars", "Olives & Vegetables", "Salt & Spices", "Technical Ingredients", "Truffles & Mushrooms", … |
| B22 | Selecting a Product Family entity loads metrics correctly | Click "Beverages" → right panel renders without errors; revenue/orders populated; Orders tab lists orders. |
| B23 | Legacy URL with `?dimension=product_type` auto-redirects to `?dimension=product_family` | Load URL with `?dimension=product_type` → after init, address bar reads `product_family`. |
| B24 | Product card sub-line shows country of origin (e.g., "P1234 · France"), not brand | Product dimension, pick any product → card sub-line reads `SKU · <country>`. |

**Verdict threshold:** All Critical. Zero FAIL permitted.

---

## Section C — Design / UI Quality (High)

**Verify After:** Plan A Tasks 14, 17, 19, 20

The fresh reviewer agent should apply design-critique principles (hierarchy, spacing, consistency, color contrast) in addition to these concrete checks.

| # | Check | How to verify |
|---|---|---|
| C1 | Trend arrow uses design-token colors, not hardcoded hex | Inspect computed style of `[data-testid="trend-arrow"]` in Chrome DevTools. Color should resolve from CSS var `--color-trend-positive` or `--color-trend-negative` (not a literal `#16a34a` inline). |
| C2 | GroupedContactsTable section headers use design-system typography scale (not arbitrary font sizes) | Inspect a section header element. `font-size` matches an existing scale token (check `client/src/styles/index.css` for the scale). |
| C3 | Per-Customer KPI table has visual separation between YTD column and the 2 grey LY columns (e.g., vertical line or color change) | Screenshot shows clear distinction; LY columns use muted text token. |
| C4 | Reports close button has hover affordance | Hover the X → background changes (not just cursor). |
| C5 | Collapsible section animation runs on expand/collapse (not instant pop) | Toggle a contact section; expansion is animated over ~150-300ms. Subsection C5a: if OS has reduced-motion set, animations are skipped (Framer Motion respects app-level `MotionConfig reducedMotion="user"`). |
| C6 | Column order in Consolidated Orders matches spec §4.6 exactly | Screenshot of thead — no reordering slip. |
| C7 | No layout shift when switching between Aggregated and Per Customer modes | Click the toggle; modal dimensions stay stable (no jumping). |

**Verdict threshold:** All C1-C4, C6, C7 PASS. C5 may be subjective — allow PASS with note.

---

## Section D — Interaction / Animation (Medium)

**Verify After:** Plan A Tasks 14, 17, 19

| # | Check | How to verify |
|---|---|---|
| D1 | Section expand collapse animation over 150-300ms | Visual timing — feels responsive, not sluggish or instant. |
| D2 | Escape key closes Reports view (confirmed B8 above — restated here for animation concern) | Key press → smooth transition to classic view, no flash of empty state. |
| D3 | Time-range tab switch on Reports Orders does not refetch (purely client filter) | Network tab in DevTools — switching tabs produces zero new requests. |
| D4 | Search input feels responsive (no noticeable debounce lag) | Type a customer ID quickly — list filters within 100ms per keystroke. |

**Verdict threshold:** Advisory; PASS preferred but not blocking.

---

## Section E — Code Quality (Critical)

**Verify After:** End of each plan task

| # | Check | How to verify |
|---|---|---|
| E1 | Server TypeScript compiles clean | `cd server && npx tsc --noEmit` — exit code 0, zero errors |
| E2 | Client TypeScript compiles clean | `cd client && npx tsc -b --noEmit` — exit code 0 |
| E3 | No `any` types introduced | `grep -rn ': any\|as any' server/src/ client/src/` — zero matches beyond pre-existing legacy (delta must be zero vs main) |
| E4 | All unit tests pass | `cd server && npx vitest run` — all tests PASS; `cd client && npx vitest run` — all tests PASS |
| E5 | No file exceeds 300 LOC among files changed by these plans | `git diff --name-only main... -- '*.ts' '*.tsx' \| xargs wc -l \| awk '$1>300 {print}'` — no output |
| E6 | Every new file has a header intent block (`FILE`, `PURPOSE`, `USED BY`, `EXPORTS`) | `git diff --name-only --diff-filter=A main... -- '*.ts' '*.tsx'` — open each file, verify comment block exists |
| E7 | No secrets committed | `grep -rn 'priority.*password\|priority.*basicAuth\|BasicAuthPass' server/src/ client/src/` — zero matches |

**Verdict threshold:** All 7 PASS. Hard deploy gate per CLAUDE.md.

---

## Section F — Backend / API Robustness (Critical)

**Verify After:** Plan A Tasks 11, 16 · Plan B Tasks A4, A5, C1

| # | Check | How to verify |
|---|---|---|
| F1 | `/api/sales/entities?dimension=product_family` returns 200 | `curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3001/api/sales/entities?dimension=product_family'` — `200` |
| F2 | `/api/sales/entities?dimension=product_type` also returns 200 during alias window (Phase A-B) | Same curl with `product_type` — `200` |
| F3 | `/api/sales/entities?dimension=product_type` returns 400 after Phase C | After Plan B Task C1 deployed, same curl — `400` |
| F4 | `/api/sales/entities?dimension=bogus` returns 400 | `curl -s -o /dev/null -w '%{http_code}' '.../entities?dimension=bogus'` — `400` |
| F5 | `fetch-all`, `contacts`, `orders` routes all accept `product_family` during alias window | curl each with `?dimension=product_family` — all `200` |
| F6 | Priority ERP is never written to | `grep -rn "method: 'POST'\|method: 'PUT'\|method: 'PATCH'\|method: 'DELETE'" server/src/ \| grep -i 'priority'` — zero matches |
| F7 | Route-test suite passes | `cd server && npx vitest run src/routes/__tests__/` — all PASS |

**Verdict threshold:** F1, F2, F4-F7 PASS. F3 verified only after Phase C ships.

---

## Section G — Deployment Readiness (Critical)

**Verify After:** Pre-deploy gate at end of each plan

| # | Check | How to verify |
|---|---|---|
| G1 | `client/dist` build succeeds | `cd client && npx vite build` — exit code 0 |
| G2 | Gzip bundle size under 500 KB | Look at Vite build output — largest chunk gzip < 500 KB |
| G3 | Railway build + deploy succeeds (post-push) | Railway dashboard deploys latest commit status = "Success" |
| G4 | `[warm-cache] Done.` appears in Railway logs within 5 minutes of boot | Railway logs → filter for `warm-cache` → "Done." line present |
| G5 | No unhandled errors in the first 10 minutes of logs post-deploy | Railway logs → filter for `Error` / `ERR` / stack traces — none unexplained |
| G6 | Upstash Redis has `dashboard:product_family:*` keys after warm-cache completes | Upstash Data Browser → search for `product_family` — at least one key present |
| G7 | Upstash Redis has `dashboard:customer:*`, `dashboard:zone:*`, `dashboard:vendor:*`, `dashboard:brand:*`, `dashboard:product:*` keys after warm-cache | Upstash Data Browser → one key per dimension present |
| G8 | Airtable Omni embed loads the dashboard without iframe errors | Load the Airtable page → embed renders fully → DevTools Console has no iframe security or CORS errors |

**Verdict threshold:** All 8 PASS. G4 is the single most important boot-health signal.

---

## Section H — Performance (Medium)

**Verify After:** Plan A Task 4 (prev-year backend) and post-deploy

| # | Check | How to verify |
|---|---|---|
| H1 | `/api/sales/entities?dimension=customer` responds within 2 seconds (cold cache) | `time curl .../entities?dimension=customer -o /dev/null` — real < 2s |
| H2 | Same endpoint responds within 500 ms warm | Same curl re-run — real < 0.5s |
| H3 | Per-Customer modal renders 200+ rows without visible lag | Open modal on a dimension with many entities — scroll; no stutter |
| H4 | No N+1 pattern introduced by prev-year enrichment (single pass per window, not per metric) | Code review: confirm `computeMetrics` is called once per window per entity bucket |

**Verdict threshold:** Advisory. H4 PASS required.

---

## Overall Score Table

| Section | Weight | Verify After | Verdict (fill in) |
|---|---|---|---|
| A. Backend Correctness | Critical | Plan A Tasks 1-4, 9, 11, 16; Plan B Tasks A1-A5 | |
| B. Functional Completeness | Critical | All plan tasks (see B rows) | |
| C. Design / UI Quality | High | Plan A Tasks 14, 17, 19, 20 | |
| D. Interaction / Animation | Medium | Plan A Tasks 14, 17, 19 | |
| E. Code Quality | Critical | End of each task | |
| F. Backend / API Robustness | Critical | Plan A Tasks 11, 16; Plan B Tasks A4, A5, C1 | |
| G. Deployment Readiness | Critical | Post-deploy of each plan | |
| H. Performance | Medium | Plan A Task 4; post-deploy | |

**Ship readiness:** all Critical sections PASS. High allows at most 1 FAIL with a documented follow-up plan. Medium is advisory.

---

## Verification Schedule

Tie to plan task boundaries to catch issues early.

| After completing... | Run these sections |
|---|---|
| Plan A Task 0 (diagnostics) | No code checks; confirm learnings files written |
| Plan A Task 4 (prev-year wired for all dimensions) | Section A (A1–A4), Section E |
| Plan A Task 10 (products: SKU filter + country) | Section A (A7), Section E |
| Plan A Task 16 (contacts customerName annotation) | Section A (A8, A9), Section E |
| Plan A Task 21 (KPI modal wired for all cards) | Section B (B3–B5), Section C (C1, C3, C7), Section E |
| Plan A end | Full Pre-Completion Gate — Sections A, B (B1–B20), C, E, F (F1, F4–F7), G, H |
| Plan B Phase A (alias window active) | Section A (A5, A6), Section B (B21–B23), Section F (F1, F2, F5), Section E |
| Plan B Phase B (migration done) | Section B (all product_family checks), Section F (F1, F2, F5) |
| Plan B Phase C (legacy removed) | Section F (F3 flips to PASS) |
| Post-deploy of either plan | Section G (all), Section H |

---

## Pre-Completion Gate

**MANDATORY before marking either plan complete.**

1. Run the full Quick Smoke Test (next section).
2. Paste the complete stdout to the PR / final summary — NOT a summary, the raw output.
3. Confirm every line ends in `OK` or `PASS`. Any `FAIL` = not complete.
4. Visit the Airtable embed via Chrome MCP. Screenshot the header, a KPI modal, a grouped contacts panel, and the Reports view with exit button. Paste screenshots (or Chrome-MCP-captured snapshot text) alongside the smoke test output.
5. Tail Railway logs for 10 minutes post-deploy. Paste the `[warm-cache] Done.` line and confirm no unhandled errors.
6. If any check fails: fix root cause (do NOT swap assertion to match buggy output), re-run gate, paste updated output.

---

## Quick Smoke Test {#Smoke}

Runs in under 5 minutes. Covers every Critical-weight check that can be automated. Save as `scripts/eval-smoke.sh` and run from repo root.

```bash
#!/usr/bin/env bash
set -u
PASS=0
FAIL=0

pass() { echo "[PASS] $*"; PASS=$((PASS+1)); }
fail() { echo "[FAIL] $*"; FAIL=$((FAIL+1)); }

echo "=================================================="
echo " Dashboard Overhaul — Quick Smoke Test"
echo "=================================================="

# --- E. Code quality gates ---
echo "--- Section E — Code Quality ---"
(cd client && npx tsc -b --noEmit) >/dev/null 2>&1 && pass "E1 client tsc clean" || fail "E1 client tsc"
(cd server && npx tsc --noEmit)    >/dev/null 2>&1 && pass "E2 server tsc clean" || fail "E2 server tsc"

ANY_COUNT=$(grep -rn ': any\|as any' server/src/ client/src/ 2>/dev/null | wc -l | tr -d ' ')
[ "$ANY_COUNT" = "0" ] && pass "E3 no any types" || fail "E3 found $ANY_COUNT any types"

(cd server && npx vitest run)  >/tmp/eval-server-tests.log 2>&1 && pass "E4a server tests pass" || fail "E4a server tests — see /tmp/eval-server-tests.log"
(cd client && npx vitest run)  >/tmp/eval-client-tests.log 2>&1 && pass "E4b client tests pass" || fail "E4b client tests — see /tmp/eval-client-tests.log"

OVERSIZE=$(find client/src server/src -name '*.ts' -o -name '*.tsx' | xargs wc -l 2>/dev/null | awk '$1>300 && $2!="total"{print $2}' | wc -l | tr -d ' ')
[ "$OVERSIZE" = "0" ] && pass "E5 no >300 LOC files" || fail "E5 $OVERSIZE files >300 LOC"

# --- G. Deployment readiness (local build) ---
echo "--- Section G — Build ---"
(cd client && npx vite build) >/tmp/eval-vite-build.log 2>&1 && pass "G1 vite build" || fail "G1 vite build"

# --- A + F. Live backend checks (local server assumed running on :3001) ---
echo "--- Section A + F — Backend (local) ---"
BASE="http://localhost:3001"

probe() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$1")
  if [ "$code" = "200" ]; then pass "$2  ($code $1)"; else fail "$2  ($code $1)"; fi
}
probe_reject() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$1")
  if [ "$code" = "400" ]; then pass "$2  ($code $1)"; else fail "$2  (expected 400, got $code, $1)"; fi
}

probe "/api/sales/entities?dimension=customer"        "F1a customer route"
probe "/api/sales/entities?dimension=zone"            "F1b zone route"
probe "/api/sales/entities?dimension=vendor"          "F1c vendor route"
probe "/api/sales/entities?dimension=brand"           "F1d brand route"
probe "/api/sales/entities?dimension=product_family"  "F1e product_family route"
probe "/api/sales/entities?dimension=product"         "F1f product route"
probe_reject "/api/sales/entities?dimension=bogus"    "F4  bogus dimension rejected"

# A3 — 12 prev-year keys on each EntityListItem
KEYCOUNT=$(curl -s "$BASE/api/sales/entities?dimension=customer" | jq '.data[0] | [to_entries[] | select(.key | startswith("prevYear"))] | length' 2>/dev/null || echo 0)
[ "$KEYCOUNT" = "12" ] && pass "A3 prev-year keys present (12)" || fail "A3 prev-year key count = $KEYCOUNT (expected 12)"

# A7 — no SKU 000
ZEROSKU=$(curl -s "$BASE/api/sales/entities?dimension=product" | jq '[.data[] | select(.id=="000")] | length' 2>/dev/null || echo -1)
[ "$ZEROSKU" = "0" ] && pass "A7 no SKU=000 in product list" || fail "A7 SKU=000 count = $ZEROSKU"

# A6 — ~20 families
FAMCOUNT=$(curl -s "$BASE/api/sales/entities?dimension=product_family" | jq '.data | length' 2>/dev/null || echo -1)
if [ "$FAMCOUNT" -ge 12 ] && [ "$FAMCOUNT" -le 25 ]; then pass "A6 product_family count=$FAMCOUNT"; else fail "A6 product_family count=$FAMCOUNT (expected 12–25)"; fi

# --- F6. Priority is read-only ---
WRITES=$(grep -rn "method: 'POST'\|method: 'PUT'\|method: 'PATCH'\|method: 'DELETE'" server/src/ | grep -ic 'priority' || true)
[ "$WRITES" = "0" ] && pass "F6 no Priority writes" || fail "F6 $WRITES Priority write call(s) found"

echo "=================================================="
echo " RESULTS: $PASS pass, $FAIL fail"
echo "=================================================="
[ "$FAIL" = "0" ] && exit 0 || exit 1
```

**Manual post-deploy additions (not in the script):**
- Visit Railway logs, confirm `[warm-cache] Done.`
- Visit Upstash, confirm `dashboard:product_family:*` keys exist.
- Visit Airtable embed, click through checks B1–B24.

---

## Loop Detection

Defense against doom loops during implementation OR during the post-review fix loop.

**Triggers that require stopping and reassessing:**
- The same source file is edited more than 5 times for the same eval check.
- The same eval check transitions PASS → FAIL → PASS → FAIL (flaky) more than twice.
- Implementing agent goes back to a task already marked complete.
- Fix loop iterates more than 3 times on the same finding without converging.

**Recovery procedure:**
1. STOP editing.
2. Re-read the relevant spec section AND the eval check AND the plan task in full.
3. Invoke superpowers:systematic-debugging skill. State the hypothesis, the evidence, the failing assertion.
4. Propose a fundamentally different approach — NOT a tweak of the last attempt.
5. If still stuck after the new approach: escalate to the user with the three failed attempts documented.

---

## Reviewer-Agent Runbook (post-implementation)

The fresh reviewer agent dispatched after implementation completes should:

1. **Read this eval doc + both plans + the spec** in full.
2. **Load Chrome MCP tools** via ToolSearch: `{query: "mcp__Claude_in_Chrome", max_results: 25}`.
3. **Visit the three live URLs** (Airtable embed, Railway logs, Upstash Redis) in sequence.
4. **Execute every check in Sections A–H** that is verifiable live. For checks that require running tests locally, use Bash.
5. **Apply design-critique principles** on top of the concrete Section C checks:
   - Visual hierarchy: is the most important data (YTD value) visually dominant over secondary (LY columns)?
   - Consistency: are the grouped contacts sections visually consistent with the rest of the dashboard?
   - Color contrast: trend arrow red/green contrast against background meets WCAG AA (4.5:1 for text)?
   - Spacing: Orders table column gutters consistent with existing tables?
6. **Produce a review document** at `docs/superpowers/evals/2026-04-17-dashboard-overhaul-eval-RESULTS.md` containing:
   - Every check with verdict (PASS / FAIL / NOT-YET-VERIFIABLE).
   - For FAILs: URL visited, screenshot reference, concrete description of the mismatch.
   - Priority ranking of FAILs (blocker / high / medium / low).
   - Recommended fix approach for each FAIL.
7. **Flag any issues outside the eval scope** in a "Out of Scope Observations" section — bugs or concerns noticed while reviewing that aren't in the spec.
