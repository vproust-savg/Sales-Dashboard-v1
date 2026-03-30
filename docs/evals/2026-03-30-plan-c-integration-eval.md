# Eval C: Integration — Data Flow, Interactions, Deploy

**Spec:** `docs/specs/2026-03-29-sales-dashboard-design.md`
**Plan:** `docs/plans/2026-03-30-plan-c-integration.md`
**Test customer:** `C7826` (read from Priority ERP — **NEVER write to Priority**)
**Mockup:** `docs/specs/dashboard-mockup-v5-reference.png`

---

## How to Use This Document

1. **Read before starting** — read the entire eval doc before writing code so implementation choices are shaped by the criteria.
2. **Verify as you go** — each section has a "Verify After" tag. Run checks after those tasks, not at the end. Catching issues early is cheap; catching them late means rework.
3. **Show your work** — paste the command and its output. "I verified it" is not proof. Terminal output is proof.
4. **Use Chrome plugins for interaction testing** — use `mcp__Claude_in_Chrome__computer` to click, type, navigate, and screenshot. Use `mcp__Claude_in_Chrome__javascript_tool` to extract data from the running dashboard. Use `mcp__Claude_in_Chrome__read_page` for accessibility tree verification.
5. **Subagent reviews are mandatory** — at review checkpoints below, dispatch a fresh autonomous subagent. Do NOT self-review your own integration work.
6. **Pre-Completion Gate** — before declaring complete, run the Quick Smoke Test, paste output, confirm all PASS. Not done until the gate passes with evidence.
7. **Failure recovery** — when a check fails, don't retry the same approach. Read the error, re-read the spec, fix the root cause. Same check fails 3 times: stop and ask the user.

---

## Autonomous Review Subagents

### Review Checkpoint 1: After Tasks 0-6 (Data Wiring Complete, Mock Data Removed)

Dispatch a **code review** subagent:

```
Use /requesting-code-review to review the integration hooks and utils:
- client/src/hooks/*.ts (all 8 hook files)
- client/src/utils/*.ts (search, filter-engine, sort-engine, dimension-config, aggregation)
- client/src/App.tsx (verify mock data is removed)

Focus areas:
1. CORRECTNESS: useDashboardState resets all state on dimension switch (spec 13.1)
2. CORRECTNESS: Consolidated aggregation uses WEIGHTED averages, not simple averages (spec 10.5)
3. PERFORMANCE: No unnecessary re-renders (check useMemo/useCallback usage)
4. SECURITY: No direct fetch to Priority API from client — all via /api/ proxy
5. TYPE SAFETY: All hooks return properly typed values, no `any`
Spec: docs/specs/2026-03-29-sales-dashboard-design.md Sections 5, 6, 10.5, 13
```

Then dispatch a **design critique** subagent (in parallel):

```
Use /design-critique to verify the dashboard with REAL data.

Steps:
1. Ensure both dev servers are running (server :3001, client :5173)
2. Open localhost:5173 in Chrome using mcp__Claude_in_Chrome__navigate
3. Take a full screenshot — this is now REAL Priority ERP data
4. Verify the dashboard looks correct with real data:
   - Do customer names render properly (French accented characters)?
   - Do revenue numbers look realistic (not $0, not $999,999,999)?
   - Does the bar chart show reasonable monthly distribution?
   - Does the donut chart have segments that add to 100%?
5. Use mcp__Claude_in_Chrome__computer to:
   - Click a dimension toggle (e.g., "Zone") → screenshot → verify list changed
   - Type in search box → screenshot → verify list filtered
   - Click a customer → screenshot → verify detail panel updated
   - Click "2025" period tab → screenshot → verify data changed
6. Use mcp__Claude_in_Chrome__javascript_tool to extract:
   - Number of entities in the list
   - KPI values displayed
   - Whether all sections rendered (no empty sections that should have data)

Report: Data rendering issues, interaction failures, visual regressions from Plan B.
```

**Action on findings:** Fix all Critical issues. Data rendering bugs are blockers.

### Review Checkpoint 2: After Tasks 7-8 (Animation + Accessibility Complete)

Dispatch a **design critique** subagent focused on motion and accessibility:

```
Use /design-critique to verify animation choreography and accessibility.

Steps:
1. Open localhost:5173 in Chrome
2. ANIMATION TEST:
   - Hard refresh (Cmd+Shift+R) → screenshot at 0ms, 200ms, 500ms, 1000ms
     (use mcp__Claude_in_Chrome__computer action:wait between screenshots)
   - Verify staged loading: skeleton → list stagger → KPI counters → chart bars
   - Click a different customer → verify exit/enter transition (not instant swap)
   - Check a checkbox → verify selection bar slides up
   - Click period tab → verify counter animation on KPI values
3. REDUCED MOTION TEST:
   - In Chrome DevTools Rendering tab, enable "Emulate prefers-reduced-motion: reduce"
   - Repeat above interactions → verify all transitions are instant (0ms)
4. ACCESSIBILITY TEST:
   - Use mcp__Claude_in_Chrome__read_page (filter: "all") to get accessibility tree
   - Verify: dimension toggles have role=tablist, list has role=listbox,
     detail tabs have role=tablist, search has role=searchbox
   - Use mcp__Claude_in_Chrome__computer to Tab through the page — verify
     focus ring (2px gold outline) appears on each interactive element
   - Verify trend indicators use icons (▲/▼) alongside colors

Spec: docs/specs/2026-03-29-sales-dashboard-design.md Sections 9, 12, 21
Report: Missing animations, a11y violations, focus management issues.
```

### Review Checkpoint 3: After Task 12 (Pre-Deploy, Everything Complete)

Dispatch both a **code review** and a **design critique** subagent in parallel for the final pass:

**Code review subagent:**
```
Use /requesting-code-review for a FULL PROJECT review:
- All server/src/**/*.ts files
- All client/src/**/*.ts and *.tsx files
- Dockerfile, railway.json, .dockerignore
- shared/types/*.ts and shared/utils/*.ts

Focus areas:
1. SECURITY: Priority client read-only, no secrets in source, .env in .gitignore
2. TYPE SAFETY: No `any`, all imports resolve, shared types consistent across server + client
3. FILE QUALITY: Every file < 200 lines, has intent block, follows import order convention
4. DEPLOYMENT: Dockerfile paths correct, railway.json valid, Express serves client in production
5. CLAUDE.md COMPLIANCE: All rules from CLAUDE.md followed
```

**Design critique subagent (parallel):**
```
Use /design-critique for a FINAL visual fidelity check.

Steps:
1. Open localhost:5173 in Chrome
2. Take a full screenshot (save_to_disk: true)
3. Open mockup: docs/specs/dashboard-mockup-v5-reference.png
4. Do a region-by-region comparison:
   - Dimension toggles (shape, spacing, active state)
   - Search box (height, radius, icon)
   - Entity list (item height, meta text, active border)
   - Header (title size, subtitle, period tabs, export button)
   - KPIs (hero value, 6 cards, sparklines)
   - Charts (donut segments, top 10 layout, rank badges)
   - Tabs (tab bar, active indicator, table content)
5. Use mcp__Claude_in_Chrome__javascript_tool to verify 5 critical computed styles:
   - Hero revenue: fontSize=30px, fontWeight=800, letterSpacing=-1px
   - Page bg: backgroundColor=rgb(245,241,235)
   - Card shadow: boxShadow contains rgba(0,0,0,0.04)
   - Left panel width: 280px
   - KPI card borderRadius: 12px

Score the dashboard 1-10 for mockup fidelity. 8+ is PASS. Below 8: list every discrepancy.
```

**Action on findings:** Fix all Critical issues before deploying to Railway.

---

## Overall Score Table

| Section | Weight | Verify After | Verdict |
|---------|--------|-------------|---------|
| 1. End-to-End Data Accuracy | **Critical** | Tasks 0-6 | |
| 2. Interaction Correctness | **Critical** | Tasks 2-6 | |
| 3. Deployment Readiness | **Critical** | Tasks 11-12 | |
| 4. Animation & Polish | High | Tasks 7-8 | |
| 5. Accessibility Completion | High | Task 8 | |
| 6. Performance | High | Task 12 | |
| 7. Responsive Layout | Medium | Task 10 | |
| 8. Empty States & Export | High | Tasks 6, 9 | |

**Ship readiness:** All Critical PASS. High allows 1 FAIL with documented fix plan.

---

## 1. End-to-End Data Accuracy

**Verify After: Tasks 0-6 (hooks wired, mock data removed)**

The dashboard must show real Priority ERP data that matches Priority's own reports.

| # | Check | How to verify |
|---|-------|---------------|
| 1.1 | Dashboard loads real data (not mock) | Open `localhost:5173`. Network tab shows `GET /api/sales/dashboard?groupBy=customer&period=ytd`. Response contains `meta.cached` field. Mock data import is removed from App.tsx. |
| 1.2 | Customer C7826 appears in entity list | Search for C7826's customer name in the left panel list. It appears with correct revenue and order count. |
| 1.3 | C7826 revenue matches Priority report | Click C7826 in the list. Hero card shows Total Revenue. Compare against Priority's "Sales by Customer" report for C7826 YTD. Must match within $1. |
| 1.4 | C7826 order count matches Priority | Dashboard shows N orders. Priority shows N non-cancelled orders for C7826 in YTD. Must match exactly. |
| 1.5 | C7826 contacts load in Contacts tab | Click Contacts tab for C7826. Names and emails appear. Compare against Priority's customer record contacts. |
| 1.6 | Period switching loads correct year data | Click "2025" tab. Revenue and orders change to 2025 values. Verify one customer's revenue against Priority's 2025 report. |
| 1.7 | "All Customers" row shows correct totals | Click "All Customers" — Total Revenue should equal SUM of all individual customer revenues in the list. |
| 1.8 | Dimension switching shows correct entities | Switch to "Brands" dimension. List shows brand names with revenue. Switch to "Vendors" — shows vendor names. Each dimension shows correct entity count. |

**Verdict:** PASS if 8/8 checks succeed. Any failure is a blocker.

---

## 2. Interaction Correctness

**Verify After: Tasks 2-6 (state hooks + wiring)**

Each check maps to a GIVEN/WHEN/THEN acceptance criterion from spec Section 13.

| # | Check | How to verify |
|---|-------|---------------|
| 2.1 | Dimension switch resets filters, search, sort, selection | Have active filters + search + 2 selected items. Click "Zone" dimension. Filter panel closes, search clears, selection bar disappears, sort resets to Revenue desc. (Spec 13.1) |
| 2.2 | Search filters list with 300ms debounce | Type "acm" in search — list updates after ~300ms pause. Header shows "CUSTOMERS (N OF M)". Clear search — full list restores immediately. (Spec 13.2) |
| 2.3 | Filter adds condition and updates list | Open filter panel. Add "Revenue > 100000". List count decreases. Badge shows "1". Add second filter — count decreases further, badge shows "2". (Spec 13.3) |
| 2.4 | Multi-select shows selection bar | Check 3 checkboxes. Bar appears with "3 selected". "View Consolidated" button is enabled. (Spec 13.4) |
| 2.5 | "View Consolidated" aggregates data | Click "View Consolidated" with 3 selected. Header shows "Customer A, Customer B, +1 more". Revenue = SUM. Avg Order = weighted (total revenue / total orders). (Spec 13.4) |
| 2.6 | "Clear" reverts consolidated view | Click "Clear" — checkboxes uncheck, bar slides down, detail reverts to previous single entity. (Spec 13.4) |
| 2.7 | Period tab switch updates all data | Click "2025". KPI values change (with counter animation). Bar chart shows 2025 vs 2024. Tables show 2025 orders. (Spec 13.5) |
| 2.8 | Sort changes list order | Click Sort → "Name" → list alphabetizes. Click "Name" again → reverses. Click Sort → "Orders" → list orders by count desc. (Spec 15.4) |
| 2.9 | Entity selection loads detail | Click a customer in list. Right panel header changes to that customer name. KPIs, charts, tables update. Active state (gold border) appears on clicked item. |

**Verdict:** PASS if 9/9 checks succeed. Any failure is a blocker.

---

## 3. Deployment Readiness

**Verify After: Tasks 11-12 (Docker + verification)**

| # | Check | How to verify |
|---|-------|---------------|
| 3.1 | Docker builds successfully | `docker build -t sales-dashboard .` — exits 0, no errors |
| 3.2 | Docker container serves the dashboard | `docker run -p 3001:3001 --env-file server/.env sales-dashboard` — `curl localhost:3001` returns HTML. `curl localhost:3001/api/health` returns `{"status":"ok"}`. |
| 3.3 | Client TypeScript builds clean | `cd client && npx tsc -b --noEmit` — 0 errors |
| 3.4 | Server TypeScript builds clean | `cd server && npx tsc --noEmit` — 0 errors |
| 3.5 | All server tests pass | `cd server && npx vitest run` — all tests pass, 0 failures |
| 3.6 | `railway.json` exists with Dockerfile builder | `cat railway.json` — contains `"builder": "DOCKERFILE"` and `"healthcheckPath": "/api/health"` |
| 3.7 | `.dockerignore` excludes sensitive files | `grep '.env' .dockerignore` — `.env` is listed. `grep 'node_modules' .dockerignore` — listed. |
| 3.8 | No secrets in committed files | `grep -rn 'PRIORITY_PASSWORD\|UPSTASH_REDIS_TOKEN' --include='*.ts' --include='*.json' server/src/ client/src/` — 0 matches (only in .env.example as placeholder text) |
| 3.9 | Production Express serves client static files | In Docker container: `curl localhost:3001/` returns the React app HTML (not a 404 or Express default). |

**Verdict:** PASS if 9/9 checks succeed. Any failure is a blocker.

---

## 4. Animation & Polish

**Verify After: Tasks 7-8 (animation choreography + a11y pass)**

| # | Check | How to verify |
|---|-------|---------------|
| 4.1 | Page load has staged animation sequence | On fresh load: skeleton appears first, then list items stagger in (20ms each), KPI values count up, chart bars grow from baseline, donut draws clockwise. Not everything appears simultaneously. |
| 4.2 | Entity switch has exit/enter transition | Click a different customer. Current detail fades out (slight upward movement), new detail fades in (slight downward-to-position movement). |
| 4.3 | KPI values use counter animation | Switch period or entity. Revenue number rolls from old value to new value (not instant snap). Duration ~350ms. |
| 4.4 | Period selector has sliding pill | Click different period tabs. White active pill slides horizontally to new position (Framer Motion layoutId). |
| 4.5 | Selection bar slides up/down | Check a checkbox — bar slides up from bottom. Uncheck all — bar slides down. Uses AnimatePresence. |
| 4.6 | Filter panel expands/collapses smoothly | Toggle filter button — panel height animates open. Toggle again — animates closed. |
| 4.7 | `prefers-reduced-motion` disables animations | In DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce". Reload. All transitions should be instant (no animation). |

**Verdict:** PASS if 7/7 checks succeed. 1 failure acceptable with documented fix.

---

## 5. Accessibility Completion

**Verify After: Task 8 (accessibility final pass)**

| # | Check | How to verify |
|---|-------|---------------|
| 5.1 | Tab navigates between major regions | Press Tab repeatedly: focus moves through dimension bar → search → filter button → list → detail header → tabs. Logical order. |
| 5.2 | Arrow keys work in dimension tabs | Focus dimension bar → press → / ← to move between tabs → Enter to activate. |
| 5.3 | Arrow keys work in entity list | Focus list → ↑/↓ moves through items → Enter selects → Space toggles checkbox. |
| 5.4 | Escape closes open panels | Open filter panel → press Escape → panel closes, focus returns to filter button. Open sort dropdown → Escape → closes. |
| 5.5 | Screen reader live region announces changes | Check `aria-live="polite"` region exists. When list count changes (via filter/search), the region text updates (e.g., "Showing 8 of 42 customers"). |
| 5.6 | Trend indicators are not color-only | Positive trends show `▲` icon alongside green text. Negative show `▼`. Status badges have text labels (not just colored dots). |

**Verdict:** PASS if 6/6 checks succeed. 1 failure acceptable with documented fix.

---

## 6. Performance

**Verify After: Task 12 (pre-deploy verification)**

| # | Check | How to verify |
|---|-------|---------------|
| 6.1 | Initial load under 3 seconds (warm backend cache) | DevTools → Network → reload with cache cleared. DOMContentLoaded < 1s, full data painted < 3s. |
| 6.2 | Dimension switch is instant (< 100ms) | Click dimension toggle — list swaps immediately (client-side re-grouping, no API call). DevTools Performance tab: no network request fired. |
| 6.3 | Entity selection is instant (< 100ms) | Click customer in list — detail panel updates without network request. Client-side data filtering. |
| 6.4 | Period switch shows data within 5s (cold) or instant (cached) | Click "2025" — if not cached, loading state shows then data appears < 5s. Second click: instant (< 100ms). |
| 6.5 | Bundle size under 500KB gzipped | `cd client && npm run build` — check output. Total JS + CSS gzipped < 500KB. |

**Verdict:** PASS if 5/5 checks succeed. 1 failure acceptable with documented fix.

---

## 7. Responsive Layout

**Verify After: Task 10 (responsive breakpoints)**

| # | Check | How to verify |
|---|-------|---------------|
| 7.1 | Desktop (≥ 1024px) shows full master-detail | DevTools → set viewport 1280px wide. Two-panel layout visible, all sections render. |
| 7.2 | Compact (768-1023px) adjusts layout | Set viewport 900px. Left panel shrinks or collapses. KPI grid adapts. Charts stack if needed. |
| 7.3 | Narrow (< 768px) stacks vertically | Set viewport 600px. Single-column layout. Left panel above, detail below. All content accessible via scroll. |
| 7.4 | No horizontal scrollbar at any breakpoint | At each breakpoint: verify no horizontal overflow. `document.documentElement.scrollWidth <= document.documentElement.clientWidth`. |

**Verdict:** PASS if 4/4 checks succeed. Advisory — responsive is Medium weight.

---

## 8. Empty States & Export

**Verify After: Tasks 6, 9 (wiring + export)**

| # | Check | How to verify |
|---|-------|---------------|
| 8.1 | Search with no results shows empty state | Type "zzzzzzz" in search. List shows "No results for 'zzzzzzz'" with suggestion text. (Spec 11.2) |
| 8.2 | Entity with 0 orders shows empty KPIs | If a customer has no orders for a period, KPIs show `$0` / `0` / `—`. Charts show empty outlines. Tables show "No orders for this period." |
| 8.3 | Contacts tab with no contacts shows message | Select an entity with no contacts. Tab shows "No contacts on file." |
| 8.4 | Export downloads CSV with correct data | Click Export button → CSV file downloads. Filename matches `{Entity}_{Period}_{Date}.csv`. Open CSV — contains KPI, Orders, Items sections with correct values. |
| 8.5 | Export button shows loading state during export | Click Export — button shows spinner briefly, then reverts to default. |

**Verdict:** PASS if 5/5 checks succeed. 1 failure acceptable with documented fix.

---

## Verification Schedule

| After completing... | Run these sections |
|--------------------|--------------------|
| Tasks 0-1 (TanStack Query + contacts hook) | Verify network requests fire correctly (Section 1, check 1.1 only) |
| Tasks 2-4 (state hooks + utils) | **Section 2: Interaction Correctness** (all 9 checks) |
| Tasks 5-6 (consolidated + wiring) | **Section 1: End-to-End Data Accuracy** (all 8 checks) |
| Tasks 7-8 (animation + a11y) | **Section 4: Animation** + **Section 5: Accessibility** |
| Task 9 (export) | Verify: click Export → CSV downloads with correct filename and data |
| Task 10 (responsive) | **Section 7: Responsive Layout** (all 4 checks) |
| Tasks 11-12 (deploy + verification) | **Section 3: Deployment** + **Section 6: Performance** + **Pre-Completion Gate** |

---

## Pre-Completion Gate

Before declaring Plan C (and the entire project) complete, the implementing agent MUST:

1. Run the Quick Smoke Test below
2. Paste the **complete output** (not a summary)
3. Confirm every line says OK or PASS
4. If any line fails: fix, re-run, paste again

---

## Quick Smoke Test

```bash
#!/bin/bash
echo "========================================="
echo "  Plan C Integration — Quick Smoke Test"
echo "========================================="

# 1. Both TypeScript projects compile
echo -n "[3.3] Client TypeScript... "
cd client && npx tsc -b --noEmit 2>&1 && echo "OK" || echo "FAIL"
cd ..

echo -n "[3.4] Server TypeScript... "
cd server && npx tsc --noEmit 2>&1 && echo "OK" || echo "FAIL"
cd ..

# 2. Server tests
echo -n "[3.5] Server tests... "
cd server
RESULT=$(npx vitest run 2>&1)
if echo "$RESULT" | grep -q "Tests.*passed"; then
  echo "OK ($(echo "$RESULT" | grep -o '[0-9]* passed' | head -1))"
else
  echo "FAIL"
fi
cd ..

# 3. Client builds
echo -n "[3.3] Client Vite build... "
cd client && npm run build 2>&1 > /dev/null && echo "OK" || echo "FAIL"
cd ..

# 4. Docker build
echo -n "[3.1] Docker build... "
docker build -t sales-dashboard-test . 2>&1 > /dev/null && echo "OK" || echo "FAIL"

# 5. Security: read-only
echo -n "[SECURITY] Priority client is read-only... "
WRITES=$(grep -rn 'POST\|PUT\|PATCH\|DELETE' server/src/services/priority-client.ts 2>/dev/null | grep -v '//' | wc -l)
if [ "$WRITES" -eq 0 ]; then echo "OK"; else echo "FAIL ($WRITES write methods)"; fi

# 6. No secrets committed
echo -n "[3.8] No secrets in source... "
SECRETS=$(grep -rn 'PRIORITY_PASSWORD\|UPSTASH_REDIS_TOKEN' server/src/ client/src/ --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l)
if [ "$SECRETS" -eq 0 ]; then echo "OK"; else echo "FAIL ($SECRETS occurrences)"; fi

# 7. Required files exist
echo -n "[3.6] railway.json exists... "
[ -f railway.json ] && echo "OK" || echo "FAIL"

echo -n "[3.7] .dockerignore exists... "
[ -f .dockerignore ] && echo "OK" || echo "FAIL"

# 8. No mock data in production
echo -n "[1.1] Mock data removed from App... "
MOCK=$(grep -c 'mock-data\|MOCK_DASHBOARD' client/src/App.tsx 2>/dev/null)
if [ "$MOCK" -eq 0 ]; then echo "OK"; else echo "FAIL (mock data still imported)"; fi

# 9. Hook files exist
echo -n "[HOOKS] Data hooks exist... "
MISSING=0
for f in \
  client/src/hooks/useDashboardData.ts \
  client/src/hooks/useContacts.ts \
  client/src/hooks/useDashboardState.ts \
  client/src/hooks/useSearch.ts \
  client/src/hooks/useFilters.ts \
  client/src/hooks/useSort.ts \
  client/src/hooks/useExport.ts; do
  [ ! -f "$f" ] && MISSING=$((MISSING + 1))
done
if [ "$MISSING" -eq 0 ]; then echo "OK (7 hooks)"; else echo "FAIL ($MISSING missing)"; fi

echo "========================================="
echo "  Smoke Test Complete"
echo "========================================="
```

---

## Post-Implementation Eval-Fix Loop

After all tasks complete and the Pre-Completion Gate passes, enter the eval-fix iteration loop.

**Protocol:** `docs/evals/eval-fix-iteration-loop.md`
**Max iterations:** 3

**Scope for this plan:**
- Smoke test: Quick Smoke Test above (10 checks)
- Full eval: Sections 1-8 (53 checks)
- Convergence: All Critical PASS, High allows max 1 FAIL with documented fix plan

**Fix agent file scope:** `client/src/**`, `server/src/**`, `shared/**`, `Dockerfile`, `railway.json`, `.dockerignore`
**Fix agent spec sections:** 5-7, 10.5, 12-14, 21
**Fix agent visual reference:** `docs/specs/dashboard-mockup-v5-reference.png`

**Iteration Reports:** Appended to the bottom of this document.

---

## Loop Detection

Stop and reassess if any of these occur:
- Same file edited more than **5 times** for the same check
- Same evaluation check fails **3 times** in a row
- Going back to a task already marked complete
- Priority API returns unexpected data — re-read spec Section 17 before retrying
- TanStack Query refetching in a loop — check staleTime and query key stability

**Recovery:** Re-read the spec section referenced in the failing check. Try a fundamentally different approach. If stuck after 3 attempts, ask the user.

---

## Airtable Embed Final Test

This is the ultimate validation. After Railway deployment:

| # | Check | How to verify |
|---|-------|---------------|
| A.1 | Dashboard loads inside Airtable Omni block | Open Airtable Interface page → Omni block with Railway URL → dashboard renders |
| A.2 | No horizontal scrollbar | Visually confirm no overflow |
| A.3 | Vertical scroll works | Scroll the dashboard content — no conflict with Airtable page scroll |
| A.4 | No CORS errors | Browser console → filter "CORS" → 0 errors |
| A.5 | Interactions work inside iframe | Click dimension toggle, select customer, switch period — all work |
| A.6 | Export downloads work | Click Export → CSV file downloads in browser |

This section is verified manually by the user after deployment. It cannot be automated.
