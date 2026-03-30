# Eval B: Frontend Shell — React + Tailwind CSS v4 + Components

**Spec:** `docs/specs/2026-03-29-sales-dashboard-design.md`
**Plan:** `docs/plans/2026-03-30-plan-b-frontend-shell.md`
**Mockup:** `docs/specs/dashboard-mockup-v5-reference.png`
**Design tokens:** Spec Sections 22-25 (exact measurements from live mockup)

---

## How to Use This Document

1. **Read before starting** — read the entire eval doc before writing code so implementation choices are shaped by the criteria.
2. **Verify as you go** — each section has a "Verify After" tag. Run checks after those tasks, not at the end. Catching issues early is cheap; catching them late means rework.
3. **Show your work** — paste the command and its output. "I verified it" is not proof. Terminal output is proof. For visual checks, use Chrome plugins to take screenshots and extract computed styles.
4. **Use Chrome plugins for visual verification** — use `mcp__Claude_in_Chrome__computer` (screenshot, zoom), `mcp__Claude_in_Chrome__javascript_tool` (getComputedStyle extraction), and `mcp__Claude_in_Chrome__read_page` (accessibility tree) for all visual and layout checks. Never eyeball — measure.
5. **Subagent reviews are mandatory** — at review checkpoints (see Autonomous Review Subagents below), dispatch a fresh autonomous subagent. Do NOT self-review your own design work.
6. **Pre-Completion Gate** — before declaring complete, run the Quick Smoke Test, paste output, confirm all PASS. Not done until the gate passes with evidence.
7. **Failure recovery** — when a check fails, don't retry the same approach. Read the error, re-read the spec, fix the root cause. Same check fails 3 times: stop and ask the user.

---

## Autonomous Review Subagents

At specified checkpoints, dispatch a **fresh subagent** for independent review. The subagent has clean context — it sees the dashboard with fresh eyes.

### Review Checkpoint 1: After Tasks 4-8 (Left Panel Complete)

Dispatch a **design critique** subagent:

```
Use /design-critique to review the left panel of the sales dashboard.

Steps:
1. Open localhost:5173 in Chrome using mcp__Claude_in_Chrome__navigate
2. Take a full screenshot with mcp__Claude_in_Chrome__computer (action: screenshot)
3. Zoom into the left panel (region [0, 0, 310, 810]) for detail inspection
4. Compare against mockup at docs/specs/dashboard-mockup-v5-reference.png
5. Use mcp__Claude_in_Chrome__javascript_tool to extract computed styles for:
   - Dimension toggle container: padding, gap, border-radius, background
   - Search box: height, padding, border-radius
   - List item: padding, border-left (active state), background
   - Selection bar: padding, background, backdrop-filter

Reference measurements: docs/specs/2026-03-29-sales-dashboard-design.md Section 22.2

Report:
- Pixel-level discrepancies vs mockup (flag anything > 2px off)
- Color mismatches (flag any computed color not matching spec hex values)
- Missing states (hover, active, disabled not implemented)
- Layout issues (overflow, alignment, spacing)
```

**Action on findings:** Fix pixel discrepancies > 2px and color mismatches before proceeding.

### Review Checkpoint 2: After Tasks 9-13 (Right Panel KPIs + Charts Complete)

Dispatch a **design critique** subagent:

```
Use /design-critique to review the right panel (KPIs, charts, Top 10).

Steps:
1. Open localhost:5173 in Chrome using mcp__Claude_in_Chrome__navigate
2. Take a full screenshot
3. Zoom into these regions:
   - Hero card + KPI grid: region [310, 90, 1250, 380]
   - Product Mix donut: region [310, 385, 700, 650]
   - Top 10 Best Sellers: region [700, 385, 1250, 650]
4. Use mcp__Claude_in_Chrome__javascript_tool to verify:
   - Hero value: font-size=30px, font-weight=800, letter-spacing=-1px
   - KPI cards: padding=10px 14px, border-radius=12px
   - Chart grid: grid-template-columns ratio ≈ 3:5
   - Rank badges: 20x20px, border-radius=6px, correct gold/neutral colors
5. Compare donut and bar chart styling against spec Section 20

Reference: docs/specs/2026-03-29-sales-dashboard-design.md Sections 20, 22.4, 22.5

Report same categories as Checkpoint 1.
```

### Review Checkpoint 3: After Tasks 14-18 (Tabs + Filter + Skeleton Complete)

Dispatch both a **code review** and a **design critique** subagent in parallel:

**Code review subagent:**
```
Use /requesting-code-review to review all frontend component files:
- client/src/components/**/*.tsx
- client/src/styles/index.css

Focus areas:
1. No hardcoded hex colors (all via CSS custom properties or Tailwind token classes)
2. Every file under 200 lines with intent block
3. Tailwind v4 @theme used (NOT tailwind.config.js)
4. ARIA roles match spec Section 9.1 (tablist, listbox, option, searchbox, etc.)
5. No useEffect for data fetching (TanStack Query handles this in Plan C)
Spec: docs/specs/2026-03-29-sales-dashboard-design.md Sections 9, 24, 25
```

**Design critique subagent (parallel):**
```
Use /design-critique for a full-page visual comparison.

Steps:
1. Open localhost:5173 in Chrome
2. Take a full-page screenshot and save to disk (save_to_disk: true)
3. Open the mockup reference: docs/specs/dashboard-mockup-v5-reference.png
4. Compare region by region:
   - Left panel (dim toggles, search, filter button, list, selection bar)
   - Header bar (entity name, subtitle, period tabs, export)
   - KPI section (hero + 6 cards)
   - Charts row (donut + top 10)
   - Tabs section (tab bar + active tab content)
5. Use mcp__Claude_in_Chrome__read_page (filter: "interactive") to verify
   all interactive elements have proper roles and labels

Report: Side-by-side comparison findings. Flag EVERY discrepancy > 2px or any
color that doesn't match the spec hex values. Score 1-10 for overall fidelity.
```

**Action on findings:** Fix all discrepancies before proceeding to Plan C. The dashboard must be pixel-perfect to the mockup before real data is wired in.

---

## Overall Score Table

| Section | Weight | Verify After | Verdict |
|---------|--------|-------------|---------|
| 1. Design Token Accuracy | **Critical** | Task 1 | |
| 2. Layout Fidelity | **Critical** | Tasks 3, 9 | |
| 3. Component Completeness | **Critical** | Tasks 4-18 | |
| 4. Typography & Color | High | Tasks 4-16 | |
| 5. Accessibility Foundations | High | Tasks 4-16 | |
| 6. Code Quality | High | Task 19 | |

**Ship readiness:** All Critical PASS. High allows 1 FAIL with documented fix plan.

---

## 1. Design Token Accuracy

**Verify After: Task 1 (index.css)**

Every visual value must come from a CSS custom property, not a hardcoded value.

| # | Check | How to verify |
|---|-------|---------------|
| 1.1 | `@theme` block defines all 16 color tokens from spec Section 2 | Open `client/src/styles/index.css`. Count color tokens: bg-page, bg-card, gold-primary, gold-light, gold-muted, gold-subtle, gold-hover, dark, dark-hover, text-primary, text-secondary, text-muted, text-faint, green, red, yellow, blue = 17 tokens. All present. |
| 1.2 | `@theme` block defines all 10 spacing tokens | Tokens: 2xs(2px), xs(4px), sm(6px), md(8px), base(10px), lg(12px), xl(14px), 2xl(16px), 3xl(20px), 4xl(24px). All 10 present. |
| 1.3 | `@theme` block defines all 8 radius tokens | Tokens: xs(2px), sm(4px), md(6px), base(8px), lg(10px), xl(12px), 2xl(14px), 3xl(16px). All 8 present. |
| 1.4 | `@theme` block defines all 4 shadow tokens | Tokens: card, active, dropdown, glow. All 4 present with exact values from spec 24.1. |
| 1.5 | Font family is system stack, not a web font | `--font-sans` value is `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif`. No Google Fonts import. |
| 1.6 | Focus ring uses gold-primary | `:focus-visible` rule uses `outline: 2px solid var(--color-gold-primary)` with `outline-offset: 2px`. |
| 1.7 | Custom scrollbar uses gold tokens | `::-webkit-scrollbar-thumb` uses `var(--color-gold-light)`, track uses `var(--color-gold-subtle)`, width is `4px`. |
| 1.8 | No hardcoded hex colors in component files | `grep -rn '#[0-9a-fA-F]\{3,6\}' client/src/components/` — 0 matches. All colors use `var(--color-*)` or Tailwind token classes. |

**Verdict:** PASS if 8/8 checks succeed.

---

## 2. Layout Fidelity

**Verify After: Task 3 (DashboardLayout), Task 9 (KPISection)**

Measurements compared against the live mockup values extracted in spec Section 22.

| # | Check | How to verify |
|---|-------|---------------|
| 2.1 | Left panel is exactly 280px wide | DevTools: select left panel container → computed width = `280px`. |
| 2.2 | Right panel uses `flex: 1` with `min-width: 0` | DevTools: computed `flex-grow: 1`, `min-width: 0px`. |
| 2.3 | Gap between panels is 16px | DevTools: parent flex container `gap: 16px`. |
| 2.4 | Page padding is 16px | DevTools: main container `padding: 16px`. |
| 2.5 | Dashboard height is `calc(100vh - 32px)` | DevTools: container height = viewport height minus 32px. |
| 2.6 | Max width is 1440px, centered | DevTools: `max-width: 1440px`, `margin-left: auto`, `margin-right: auto`. |
| 2.7 | KPI section uses CSS Grid `1fr 1fr` | DevTools on KPI section: `display: grid`, `grid-template-columns: 1fr 1fr`, gap `10px`. |
| 2.8 | Hero card dimensions: 460×281px area, padding 16px 20px | DevTools on hero card: padding `16px 20px`, border-radius `16px`. Width approximately 460px (depends on container). |
| 2.9 | KPI card dimensions: padding 10px 14px, border-radius 12px | DevTools on any KPI card: `padding: 10px 14px`, `border-radius: 12px`. |
| 2.10 | Charts row uses CSS Grid `3fr 5fr`, gap 12px | DevTools on charts grid: `grid-template-columns` ratio approximately 3:5, `gap: 12px`. |

**Verdict:** PASS if 10/10 checks succeed.

---

## 3. Component Completeness

**Verify After: Tasks 4-18 (all components)**

Every component from the plan must exist and render.

| # | Check | How to verify |
|---|-------|---------------|
| 3.1 | DimensionToggles renders 6 pills in 2×3 grid | Visual: 6 dimension buttons visible (Customers, Zone, Vendors, Brands, Prod. Type, Products). One shows active state (dark bg). |
| 3.2 | SearchBox renders with placeholder | Visual: search input with magnifying glass icon, placeholder "Search customers..." |
| 3.3 | FilterSortToolbar renders Filter + Sort buttons | Visual: two buttons side by side. Filter shows count badge. |
| 3.4 | EntityList renders with sticky header and items | Visual: header "CUSTOMERS (N OF M)", "All Customers" summary row, then customer items with name + meta + revenue. |
| 3.5 | EntityListItem shows active state correctly | Visual: active item has `#f0ebe3` bg + 3px gold left border. Inactive items have no border. |
| 3.6 | SelectionBar appears when items checked | Visual: when 2+ checkboxes are checked, bar slides up with "N selected" + "View Consolidated" button + "Clear" link. |
| 3.7 | DetailHeader shows entity name + subtitle + period tabs + export | Visual: "Acme Corporation" title, subtitle with ID/zone/rep/date, period pills (YTD active), Export button. |
| 3.8 | HeroRevenueCard shows value + trend + sub-items + chart | Visual: "$240,200" in 30px bold, "+12.4% vs previous year" in green, quarter values, bar chart below. |
| 3.9 | 6 KPI cards render with labels + values + trends + sparklines | Visual: ORDERS (32), AVG ORDER ($7,506), MARGIN (18.4%), FREQUENCY (2.7/mo), LAST ORDER (4 days), FILL RATE (94.2%). Each has a sparkline in top-right. |
| 3.10 | ProductMixDonut renders with 5 segments + center text + legend | Visual: donut chart with "Total 24" center, 5 legend items with percentages. |
| 3.11 | TopTenBestSellers renders 10 items in 2 columns | Visual: #1-#5 left, #6-#10 right, vertical divider, rank badges (gold for 1-3), product name + SKU + $ + units. |
| 3.12 | TabsSection renders 3 tabs with active indicator | Visual: Orders (count badge), Items (count badge), Contacts (count badge). Active tab has gold underline. |
| 3.13 | OrdersTable renders with status badges | Visual: table with Date, Order #, Items, Amount, Margin, Status columns. Status shows colored badges. |
| 3.14 | ItemsAccordion renders with expandable categories | Visual: category rows with chevron + progress bar. Clicking expands to show indented products. |
| 3.15 | ContactsTable renders with email links | Visual: Full Name, Position, Phone, Email columns. Email is gold-colored. |
| 3.16 | FilterPanel renders when Filter button is active | Visual: clicking Filter button reveals panel with "Where" label, condition rows, AND conjunctions. |
| 3.17 | Badge component renders all 3 variants | Visual: count badges (circle, on tabs/filter), rank badges (square, on Top 10), status badges (pill, on Orders table). |
| 3.18 | Skeleton loading state renders for all sections | Visual: set loading=true prop — shimmer rectangles appear for list, KPIs, charts, tabs. |

**Verdict:** PASS if 18/18 checks succeed.

---

## 4. Typography & Color

**Verify After: Tasks 4-16 (component implementation)**

Spot-check critical typography values against spec Section 22.

| # | Check | How to verify |
|---|-------|---------------|
| 4.1 | Hero revenue: 30px, weight 800, letter-spacing -1px | DevTools on "$240,200" element: `font-size: 30px`, `font-weight: 800`, `letter-spacing: -1px`. |
| 4.2 | KPI values: 17px, weight 700 | DevTools on "32" (orders): `font-size: 17px`, `font-weight: 700`. |
| 4.3 | KPI labels: 10px, weight 500, uppercase | DevTools on "ORDERS": `font-size: 10px`, `font-weight: 500`, `text-transform: uppercase`. |
| 4.4 | Entity name: 20px, weight 700 for header | DevTools on "Acme Corporation" in header: `font-size: 20px`, `font-weight: 700`. |
| 4.5 | Customer name in list: 13px, weight 600 | DevTools on customer name: `font-size: 13px`, `font-weight: 600`. |
| 4.6 | Positive trend text is green #22c55e | DevTools on "+12.4%": `color: rgb(34, 197, 94)`. |
| 4.7 | Negative trend text is red #ef4444 | DevTools on "-3% vs prev year": `color: rgb(239, 68, 68)`. |
| 4.8 | Page background is #f5f1eb | DevTools on body: `background-color: rgb(245, 241, 235)`. |
| 4.9 | Card background is #ffffff with correct shadow | DevTools on any card: `background-color: rgb(255, 255, 255)`, `box-shadow` contains `rgba(0, 0, 0, 0.04)`. |

**Verdict:** PASS if 9/9 checks succeed. 1 failure acceptable if within 1px of target.

---

## 5. Accessibility Foundations

**Verify After: Tasks 4-16 (component implementation)**

These are the baseline ARIA attributes that must exist before Plan C adds full keyboard navigation.

| # | Check | How to verify |
|---|-------|---------------|
| 5.1 | Dimension toggles have `role="tablist"` | DevTools → Elements → dimension container has `role="tablist"`, each toggle has `role="tab"`. |
| 5.2 | Entity list has `role="listbox"` with `aria-multiselectable` | DevTools → list container: `role="listbox"`, `aria-multiselectable="true"`. |
| 5.3 | Each list item has `role="option"` | DevTools → list items: `role="option"`, `aria-selected` attribute present. |
| 5.4 | Detail tabs have `role="tablist"` | DevTools → tab bar: `role="tablist"`, each tab has `role="tab"`, `aria-selected`. |
| 5.5 | Search box has `role="searchbox"` and `aria-label` | DevTools → search input: `role="searchbox"`, `aria-label="Search customers..."`. |
| 5.6 | Focus ring is visible on interactive elements | Tab through the page — every focusable element shows 2px gold outline on `:focus-visible`. |
| 5.7 | Trend indicators use icons, not just color | Visual: positive trends show `▲` or similar icon alongside green text. Negative trends show `▼`. Not color alone. |

**Verdict:** PASS if 7/7 checks succeed. 1 failure acceptable with documented fix.

---

## 6. Code Quality

**Verify After: Task 19 (final verification)**

| # | Check | How to verify |
|---|-------|---------------|
| 6.1 | TypeScript compiles clean | `cd client && npx tsc -b --noEmit` — 0 errors |
| 6.2 | Vite builds successfully | `cd client && npm run build` — exits 0, `dist/` directory created |
| 6.3 | Every file under 200 lines | `find client/src -name '*.tsx' -o -name '*.ts' \| xargs wc -l \| awk '$1 > 200'` — 0 results |
| 6.4 | Every file has intent block | `for f in client/src/**/*.{tsx,ts}; do head -4 "$f" \| grep -q 'FILE:' \|\| echo "MISSING: $f"; done` — 0 missing |
| 6.5 | No hardcoded hex colors in components | `grep -rn '#[0-9a-fA-F]\{3,6\}' client/src/components/` — 0 matches |
| 6.6 | No `any` type usage | `grep -rn ': any\|as any' client/src/` — 0 matches |
| 6.7 | Tailwind v4 @theme used (not tailwind.config.js) | `ls client/tailwind.config.*` — file does NOT exist. Tokens are in `index.css` `@theme` block. |
| 6.8 | Import order follows CLAUDE.md convention | Spot-check 3 component files: React/libraries → hooks → components → utils → types. |

**Verdict:** PASS if 8/8 checks succeed. 1 failure acceptable with documented fix.

---

## Verification Schedule

| After completing... | Run these sections |
|--------------------|--------------------|
| Task 1 (design tokens) | **Section 1: Design Token Accuracy** (all 8 checks) |
| Task 3 (layout) | **Section 2: Layout Fidelity** (checks 2.1-2.6) |
| Tasks 4-8 (left panel components) | **Section 3** (checks 3.1-3.6) + **Section 5** (checks 5.1-5.3, 5.5) |
| Tasks 9-13 (right panel components) | **Section 2** (checks 2.7-2.10) + **Section 3** (checks 3.7-3.11) + **Section 4** (all) |
| Tasks 14-18 (tabs, filter, skeleton) | **Section 3** (checks 3.12-3.18) + **Section 5** (checks 5.4, 5.6, 5.7) |
| Task 19 (final verification) | **Section 6: Code Quality** (all 8 checks) + **Pre-Completion Gate** |

---

## Pre-Completion Gate

Before declaring Plan B complete, the implementing agent MUST:

1. Run the Quick Smoke Test below
2. Paste the **complete output** (not a summary)
3. Confirm every line says OK or PASS
4. If any line fails: fix, re-run, paste again

---

## Quick Smoke Test

```bash
#!/bin/bash
echo "========================================="
echo "  Plan B Frontend Shell — Quick Smoke Test"
echo "========================================="

cd client

# 1. TypeScript
echo -n "[6.1] TypeScript compiles clean... "
npx tsc -b --noEmit 2>&1 && echo "OK" || echo "FAIL"

# 2. Vite build
echo -n "[6.2] Vite build succeeds... "
npm run build 2>&1 > /dev/null && echo "OK" || echo "FAIL"

# 3. File size
echo -n "[6.3] All files under 200 lines... "
OVERSIZE=$(find src -name '*.ts' -o -name '*.tsx' | xargs wc -l 2>/dev/null | awk '$1 > 200 && !/total/' | head -5)
if [ -z "$OVERSIZE" ]; then echo "OK"; else echo "FAIL: $OVERSIZE"; fi

# 4. No hardcoded colors
echo -n "[1.8] No hardcoded hex colors in components... "
HARDCODED=$(grep -rn '#[0-9a-fA-F]\{6\}' src/components/ 2>/dev/null | wc -l)
if [ "$HARDCODED" -eq 0 ]; then echo "OK"; else echo "FAIL ($HARDCODED occurrences)"; fi

# 5. No any types
echo -n "[6.6] No 'any' type usage... "
ANYS=$(grep -rn ': any\|as any' src/ 2>/dev/null | wc -l)
if [ "$ANYS" -eq 0 ]; then echo "OK"; else echo "FAIL ($ANYS occurrences)"; fi

# 6. No tailwind.config.js (v4 uses @theme)
echo -n "[6.7] Using Tailwind v4 @theme (no config file)... "
if [ ! -f tailwind.config.js ] && [ ! -f tailwind.config.ts ]; then echo "OK"; else echo "FAIL (config file exists)"; fi

# 7. Design tokens present
echo -n "[1.1] All color tokens in @theme... "
COLORS=$(grep -c 'color-' src/styles/index.css 2>/dev/null)
if [ "$COLORS" -ge 17 ]; then echo "OK ($COLORS tokens)"; else echo "FAIL (only $COLORS tokens, need 17)"; fi

# 8. Component files exist
echo -n "[3.*] Core component files exist... "
MISSING=0
for f in \
  src/components/left-panel/LeftPanel.tsx \
  src/components/left-panel/DimensionToggles.tsx \
  src/components/left-panel/SearchBox.tsx \
  src/components/left-panel/EntityList.tsx \
  src/components/left-panel/SelectionBar.tsx \
  src/components/right-panel/RightPanel.tsx \
  src/components/right-panel/DetailHeader.tsx \
  src/components/right-panel/KPISection.tsx \
  src/components/right-panel/HeroRevenueCard.tsx \
  src/components/right-panel/KPICard.tsx \
  src/components/right-panel/ProductMixDonut.tsx \
  src/components/right-panel/TopTenBestSellers.tsx \
  src/components/right-panel/TabsSection.tsx \
  src/components/shared/Badge.tsx \
  src/components/shared/Skeleton.tsx; do
  [ ! -f "$f" ] && MISSING=$((MISSING + 1)) && echo -n "MISSING:$f "
done
if [ "$MISSING" -eq 0 ]; then echo "OK (15 files)"; else echo "FAIL ($MISSING missing)"; fi

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
- Tailwind class not applying — check if using v3 syntax instead of v4 `@theme`
- Layout breaks when content changes — check for missing `min-width: 0` on flex children

**Recovery:** Re-read the spec section referenced in the failing check (especially Sections 22-25 for exact measurements). Try a fundamentally different approach. If stuck after 3 attempts, ask the user.
