# Sales Interactive Dashboard — Design Spec

**Date:** 2026-03-29
**Data Source:** Priority ERP (REST/OData API)
**Tech Stack:** React 19 + Vite + Tailwind CSS v4 + Framer Motion + TanStack Query v5 + Express + TypeScript + Zod
**Mockup:** `.superpowers/brainstorm/41012-1774736191/content/detail-layout-v5.html`

---

## 1. Layout Architecture

Master-detail pattern. Two panels fill the viewport (`100vh - 32px`, max `1440px`).

| Panel | Width | Behavior |
|-------|-------|----------|
| Left (list) | 280px fixed | Scrollable list, sticky header & selection bar |
| Right (detail) | flex: 1 | Scrollable detail area with `min-width: 0` |

Gap between panels: `16px`. Body padding: `16px`. Background: `#f5f1eb`.

---

## 2. Design System

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| bg-page | `#f5f1eb` | Page background, period selector bg |
| bg-card | `#ffffff` | All cards, panels |
| gold-primary | `#b8a88a` | Accents, active borders, rank badges, links |
| gold-light | `#d4c5a9` | Chart bars (current year), donut segment |
| gold-muted | `#e8e0d0` | Chart bars (previous year) |
| gold-subtle | `#f0ece5` | Borders, inactive badges, grid lines |
| gold-hover | `#faf8f4` | Hover states |
| dark | `#2c2a26` | Active dimension tab, active filter btn, tab count badge |
| dark-hover | `#3d3a35` | Hover on dark elements |
| text-primary | `#1a1a1a` | Main text |
| text-secondary | `#555` / `#666` | Sub-values, legend text |
| text-muted | `#999` | Labels, metadata |
| text-faint | `#bbb` / `#ccc` | SKUs, previous year value |
| green | `#22c55e` | Positive trends |
| red | `#ef4444` | Negative trends |
| yellow | `#eab308` | Warning dots |

### Typography
- **Font stack:** `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif`
- **Sizes:** 20px (header title), 17px (KPI values), 16px (previous year value), 15px (sub-quarter values), 14px (chart titles), 13px (table text, donut legend, customer name), 12px (dimension tabs, hero trend text, filter/sort text), 11px (metadata, sub-items, consolidated btn, list header), 10px (KPI labels, KPI trend text, SKUs), 9px (chart axis labels)
- **Weights:** 800 (hero revenue), 700 (KPI values, header title), 600 (active tab, customer name, period active, prev year value), 500 (dimension tabs, trend text, period inactive), 400 (body text, labels)
- **Hero revenue:** 30px, weight 800, letter-spacing -1px, `font-feature-settings: 'tnum'`

### Cards
- Border radius: `16px` (main cards), `14px` (dimension toggles container), `12px` (KPI cards, filter panel, search box)
- Shadow: `0 1px 3px rgba(0,0,0,0.04)` (cards), `0 4px 16px rgba(0,0,0,0.12)` (dropdowns)

---

## 3. Left Panel — List & Controls

### 3.1 Dimension Toggles
Position: top of left panel, above search.

2x3 grid of pill buttons:
| Row 1 | Customers | Zone | Vendors |
| Row 2 | Brands | Prod. Type | Products |

- Container: white card, `border-radius: 14px`, padding `6px`, gap `5px`
- Each tab: `flex: 1 1 calc(33.33% - 5px)`, padding `8px 6px`, `border-radius: 10px`, font `12px/500`
- Active state: `bg: #2c2a26`, `color: #fff`, `font-weight: 600`, subtle shadow
- **Behavior:** Switching dimensions changes the list items (customers → zones → vendors → brands → product types → products). Same API endpoint with different "group by" parameter. Dashboard template stays the same; only the list entity and a few labels change.

### 3.2 Search Box
White card, `border-radius: 12px`, padding `10px 14px`. 16px magnifying glass icon + text input (`13px`, placeholder "Search customers...").

### 3.3 Filter & Sort Toolbar
Horizontal row, two buttons side-by-side:

**Filter button:**
- When active: dark bg `#2c2a26`, white text, inverted count badge
- Count badge: 18px circle, gold bg `#b8a88a` (or white when active)
- Toggles the filter panel open/closed

**Sort button:**
- Dropdown on click with 8 sortable fields: Name, Revenue, Orders, Avg Order, Margin %, Frequency, Outstanding, Last Order
- Active sort shows down arrow `↓`
- Dropdown: white card, `border-radius: 10px`, heavy shadow

### 3.4 Filter Panel
Appears below toolbar when filter is active. Max height `280px`, scrollable.

**Architecture** (adapted from Priority Reports' FilterBuilder):
- Stacked conditions, each in a `#faf8f4` rounded card
- Two-line layout per condition: field selector + remove button on top, operator + value on bottom
- AND/OR conjunctions between conditions (centered text with horizontal rules)
- Nested OR groups: left gold border (`2px solid #b8a88a`), indented

**Filter fields (10):** Rep, Customer Type, Zone, Last Order Date, Margin %, Margin $, Total Revenue, Average Order, Frequency, Outstanding

**Date operators:** equals, is before, is after, is between, is in week, is empty
- "is in week" uses a WeekPicker component showing week range (e.g., "Mar 24 – 30") with calendar icon

**Numeric operators:** >, <, >=, <=, between, equals

**Text/enum operators:** equals, not equals, is empty

**Group support:** One level of nesting. Add filter / Add group buttons at bottom.

### 3.5 Customer List
White card, `border-radius: 16px`, flex: 1, scrollable.

- **Sticky header:** "CUSTOMERS (8 OF 42)" — uppercase, `11px`, gold-muted border bottom
- **"All Customers" row:** Summary row at top, separated by `2px` border. Shows total orders + total revenue.
- **Customer items:** Padding `12px 16px`, name (13px/600), zone + rep (10px, gold), meta row with orders + revenue
- **Active state:** `bg: #f0ebe3`, `3px` gold left border
- **Selected state:** `bg: #f7f3ed`, `3px` gold left border

### 3.6 Multi-Select
Always-visible circular checkboxes (18px, gold when checked with white checkmark SVG).

**Selection bar:** Sticky at bottom of list container.
- Left: checkbox icon + "3 selected"
- Right: "View Consolidated" dark button + "Clear" underlined link
- Background: `#f5f1eb` with top border

**Consolidated view:** Selecting multiple customers and clicking "View Consolidated" aggregates all KPIs, charts, and table data for the selected entities.

---

## 4. Right Panel — Detail Area

Scrollable column, gap `10px`, padding-right `4px` (for scrollbar).

### 4.1 Header Bar
White card, `border-radius: 16px`, padding `14px 24px`.

Left side:
- Customer name: 20px, weight 700
- Subtitle: "C-10042 . North Zone . Rep: Sarah M. . Active since Jan 2021" — 11px, `#999`

Right side (flex row, gap 12px):
- **Period selector:** Pill-style tabs in `#f5f1eb` container, `border-radius: 10px`, padding `3px`
  - Tabs: YTD (default/active), 2025, 2024, More (dropdown for older years)
  - Active tab: white bg, shadow, bold
  - "More" tab: gold color, caret, hover reveals dropdown
  - **API strategy:** YTD loads by default. Year tabs auto-show/hide based on a lightweight availability API. Clicking a year tab fetches on-demand + client-side caching.
- **Export button:** `#f0ece5` bg, `12px` text

### 4.2 KPI Section
CSS Grid: `grid-template-columns: 1fr 1fr`, gap `10px`. Two children: hero card (left) and KPI grid (right).

**Hero Card — Total Revenue:**
- White card, `border-radius: 16px`, padding `16px 20px`
- Top row (flex space-between):
  - Left: label "Total Revenue (12 months)" → `$240,200` (30px/800) → "+12.4% vs previous year" (green)
  - Right: "Previous Year" label → `$213,800` (16px/600, `#bbb`)
- Sub-items row: This Quarter / Last Quarter / Best Month (11px, `#888`)
- **YoY Bar Chart** (replaces sparkline): Full-width, 120px height
  - Paired bars per month: faded (`#e8e0d0`, 50% opacity) for previous year, gold (`#d4c5a9`) for current year
  - Y-axis labels: $0–$30K. X-axis: Jan–Dec (calendar year)
  - Legend below: Previous Year / This Year dots

**Secondary KPI Grid:**
- CSS Grid: `grid-template-columns: 1fr 1fr`, `grid-template-rows: 1fr 1fr 1fr`, gap `8px`
- Cards stretch to match hero card height (`display: flex; align-items: center`)
- Each card: `border-radius: 12px`, padding `10px 14px`
- Content: label (10px uppercase) → value (17px/700) → trend (10px, colored)
- Mini sparkline (60x24 SVG) in top-right corner

| KPI | Value | Trend |
|-----|-------|-------|
| Orders | 32 | +4 this quarter (green) |
| Avg Order | $7,506 | -3% vs prev year (red) |
| Margin | 18.4% + $44,200 | -1.2pp vs target (red) |
| Frequency | 2.7/mo | +0.3 vs avg (green) |
| Last Order | 4 days | Active buyer (green dot) |
| Fill Rate | 94.2% | +1.8pp vs prev year (green) |

### 4.3 Charts Row
CSS Grid: `grid-template-columns: 3fr 5fr`, gap `12px`.

**Product Mix (3fr):**
- Donut chart: 160x160 SVG (viewBox 120x120), 5 segments
- Center text: "Total" + count
- Legend: vertical list, 13px, dot + percentage + label
- Categories: Packaging (38%), Raw Materials (25%), Equipment (15%), Consumables (13%), Other (9%)
- Container uses `flex: 1` to fill vertical space

**Top 10 Best Sellers (5fr):**
- Two-column grid: #1–#5 left, #6–#10 right
- Vertical divider: `1px solid #f0ece5` on right border of left column, 24px padding/gap
- Each item: rank badge (20px square, `border-radius: 6px`) + name + SKU + dollar amount + unit qty
- Gold badges for top 3, neutral `#f0ece5` for 4–10
- Item padding: `7px 0`, subtle bottom border

### 4.4 Tabs Section
White card, `border-radius: 16px`, flex: 1, min-height `260px`.

Tab bar with bottom border. 3 tabs: Orders, Items, Contacts. Active tab: bold, gold bottom border, dark count badge.

**Orders Tab:**
- Table columns: Date, Order #, Items, Amount, Margin, Status
- Margin shows both `%` and `$` value
- Status badges: Delivered (green), Pending (yellow), Processing (blue)

**Items Tab:**
- Category accordion table
- Columns: Category/Product, Value, Margin %, Margin $
- Category rows: bold, clickable, with chevron + items count + progress bar
- Expanded: indented line items (44px left padding) with SKU, lighter style
- Categories: Butter, Cheese, Caviar, etc.

**Contacts Tab:**
- Table columns: Full Name, Position, Phone, Email
- Email as gold-colored links

---

## 5. Dimension Switching

When the user clicks a dimension toggle (Customers, Zone, Vendors, Brands, Prod. Type, Products), the dashboard pivots:

| Dimension | List shows | Group by |
|-----------|-----------|----------|
| Customers | Customer names + zone + rep | customer |
| Zone | Zone names (flat list) | zone |
| Vendors | Vendor names | vendor |
| Brands | Brand names | brand |
| Prod. Type | Product type names | product_type |
| Products | Product names + SKU | product |

**What changes:** List items, list header label, "All [Dimension]" summary row, search placeholder
**What stays:** KPI cards, charts, tabs, filter/sort (fields adapt to dimension context), period selector

**API:** Same endpoint, different `groupBy` query parameter. Response shape stays consistent.

---

## 6. API & Data Strategy

### Endpoints (conceptual)
- `GET /api/sales/dashboard?groupBy=customer&period=ytd` — main dashboard data
- `GET /api/sales/years-available?customerId=X` — lightweight check for year tab visibility
- `GET /api/sales/dashboard?groupBy=customer&period=2025` — on-demand year fetch

### Loading Strategy
1. **Default load:** YTD data (fast, small payload)
2. **Year availability:** Parallel lightweight API call to determine which year tabs to show
3. **On-demand:** Click a year tab → fetch that year's data → cache client-side (TanStack Query)
4. **Consolidated:** Multi-select sends array of IDs → server aggregates → returns same response shape

### Caching
- TanStack Query v5 with `staleTime: 5 min` for dashboard data
- Year data cached per entity + year combination
- Filter/sort applied client-side for the current dataset, server-side for initial fetch

---

## 7. Interactions Summary

| Action | Behavior |
|--------|----------|
| Click dimension toggle | Switches list entity, re-fetches dashboard data |
| Type in search | Filters list client-side (debounced 300ms) |
| Toggle filter panel | Expand/collapse filter conditions |
| Add/remove filter | Re-queries list, updates count badge |
| Click sort field | Sorts list, toggles asc/desc |
| Click customer | Loads detail for that customer in right panel |
| Check customer checkbox | Adds to multi-select; selection bar appears |
| "View Consolidated" | Aggregates selected entities into one dashboard view |
| Click period tab | Fetches that period's data, updates all KPIs/charts/tabs |
| "More" dropdown hover | Reveals older year options |
| Click category row (Items tab) | Expands/collapses line items accordion |
| Export button | Exports current view (format TBD) |

---

## 8. Component States & Loading Patterns

Every interactive component must define all six states. This section is the canonical reference for implementers.

### 8.1 State Definitions

| State | Visual | Behavior |
|-------|--------|----------|
| Default | Resting appearance | Responds to interaction |
| Hover | Subtle bg shift or border highlight | Cursor: pointer (interactive) |
| Active/Pressed | Slightly darker bg, inset feel | Fires action on release |
| Disabled | 50% opacity, `cursor: not-allowed` | Non-interactive, tooltip explains why |
| Loading | Skeleton shimmer or spinner | Non-interactive until resolved |
| Error | Red border or inline error text | Shows retry action if applicable |

### 8.2 Component State Matrix

| Component | Default | Hover | Active | Disabled | Loading | Error |
|-----------|---------|-------|--------|----------|---------|-------|
| Dimension toggle | `bg: transparent` | `bg: #faf8f4` | `bg: #2c2a26, color: #fff` | N/A (always available) | Skeleton pill | N/A |
| Search box | `bg: #fff`, placeholder | Border: `#b8a88a` focus ring | N/A | N/A | N/A | N/A |
| Filter button | `bg: #f0ece5` | `bg: #e8e0d0` | `bg: #2c2a26` (open state) | `opacity: 0.5` (no data) | N/A | N/A |
| Sort dropdown | `bg: #f0ece5` | `bg: #e8e0d0` | White card expanded | N/A | N/A | N/A |
| List item | `bg: transparent` | `bg: #faf8f4` | `bg: #f0ebe3`, gold left border | N/A | Skeleton row | N/A |
| Checkbox | Gold border, empty | Fill `#b8a88a` at 20% | Checkmark appears | `opacity: 0.5` | N/A | N/A |
| Period tab | `bg: transparent` | `bg: rgba(255,255,255,0.5)` | `bg: #fff`, shadow, bold | Greyed text (no data) | Pulsing dot | N/A |
| Export button | `bg: #f0ece5` | `bg: #e8e0d0` | `bg: #d4c5a9` | `opacity: 0.5` | Spinner icon | Toast error |
| Tab (Orders/Items/Contacts) | `color: #999` | `color: #555` | Bold, gold underline, dark badge | N/A | N/A | N/A |
| Category accordion row | `bg: #faf8f4` | `bg: #f0ece5` | Chevron rotates, children expand | N/A | Skeleton rows | N/A |
| "View Consolidated" btn | `bg: #2c2a26`, white text | `bg: #3d3a35` | `bg: #1a1a1a` | `opacity: 0.5` (0 selected) | Spinner in button | Toast error |
| "Clear" link | `color: #999`, underline | `color: #b8a88a` | `color: #2c2a26` | Hidden (0 selected) | N/A | N/A |

### 8.3 Loading Skeletons

Dashboard loads in stages. Each section has its own skeleton.

**Left panel skeleton:**
- 6 dimension pills: `#f0ece5` rounded rectangles, shimmer animation
- Search box: full-width `#f5f1eb` rectangle
- List: 8 skeleton rows — two-line layout (name line 60% width, meta line 40% width), `#f0ece5` with shimmer

**Right panel skeleton:**
- Header: name line (40% width) + subtitle line (70% width)
- KPI section: 7 cards with value placeholder (30% width) and label placeholder (50% width)
- Charts: donut → circle outline shimmer; top 10 → 10 two-line rows
- Tabs: 3 tab labels + 5 table row skeletons

**Shimmer animation:** Left-to-right gradient sweep (`#f0ece5` → `#faf8f4` → `#f0ece5`), 1.5s duration, infinite loop, `ease-in-out`.

**Progressive loading order:**
1. Layout shell + dimension toggles (instant, cached)
2. Left panel list (first API response)
3. Right panel KPIs (parallel with list, or dependent on selected entity)
4. Charts + tables (slightly after KPIs, can lazy-load)

### 8.4 Badge Variants

Three badge patterns used across the dashboard:

| Badge Type | Shape | Sizing | Colors | Usage |
|------------|-------|--------|--------|-------|
| Count | Circle | 18px diameter | Gold bg / white text (default), White bg / dark text (on dark bg) | Filter count, tab count |
| Rank | Square | 20x20px, `border-radius: 6px` | `#b8a88a` bg (top 3), `#f0ece5` bg (4–10) | Top 10 best sellers |
| Status | Pill | `padding: 2px 8px`, `border-radius: 4px` | Green/yellow/blue bg at 15% opacity, matching text color | Order status |

### 8.5 Tooltip Pattern

Tooltips appear on hover for truncated text and chart elements.

- Background: `#2c2a26`, color: `#fff`, `border-radius: 8px`, padding: `8px 12px`
- Font: 12px/400, max-width: 240px
- Arrow: 6px CSS triangle pointing toward trigger element
- Delay: 400ms hover before show, 150ms before hide
- **Chart bar tooltips:** Show month name, value, and YoY change (e.g., "March: $28,400 (+8.2%)")
- **Donut segment tooltips:** Show category name, value, and percentage
- **Truncated text tooltips:** Show full text content

---

## 9. Accessibility & Keyboard Navigation

### 9.1 ARIA Roles & Labels

| Component | Role | ARIA attributes |
|-----------|------|-----------------|
| Left panel | `role="navigation"` | `aria-label="Entity list"` |
| Dimension toggles | `role="tablist"` | Each toggle: `role="tab"`, `aria-selected` |
| Search box | `role="searchbox"` | `aria-label="Search [dimension]"` |
| Filter panel | `role="region"` | `aria-label="Filters"`, `aria-expanded` |
| Entity list | `role="listbox"` | `aria-label="[Dimension] list"`, `aria-multiselectable="true"` |
| List item | `role="option"` | `aria-selected`, `aria-checked` (multi-select) |
| Right panel | `role="main"` | `aria-label="Detail view"` |
| Period tabs | `role="tablist"` | Each tab: `role="tab"`, `aria-selected` |
| KPI card | `role="status"` | `aria-label="[KPI name]: [value]"` |
| Detail tabs | `role="tablist"` | Standard tabs pattern |
| Data table | `role="table"` | Column headers: `role="columnheader"`, sortable columns: `aria-sort` |
| Category accordion | `role="tree"` | Items: `role="treeitem"`, `aria-expanded` |
| Selection bar | `role="toolbar"` | `aria-label="Selection actions"` |

### 9.2 Keyboard Navigation

**Global shortcuts:**
| Key | Action |
|-----|--------|
| `Tab` | Move focus between major regions (dimension bar → search → filter → list → detail) |
| `Escape` | Close open dropdown/filter panel, deselect current entity |

**Dimension toggles (tablist):**
| Key | Action |
|-----|--------|
| `←` / `→` | Move between dimension tabs |
| `Enter` / `Space` | Activate focused dimension |
| `Home` / `End` | Jump to first/last dimension |

**Entity list (listbox):**
| Key | Action |
|-----|--------|
| `↑` / `↓` | Move selection through list items |
| `Enter` | Select/activate focused item (loads detail) |
| `Space` | Toggle checkbox (multi-select) |
| `Ctrl+A` / `Cmd+A` | Select all visible items |
| `Home` / `End` | Jump to first/last item |

**Detail tabs:**
| Key | Action |
|-----|--------|
| `←` / `→` | Move between tabs |
| `Enter` / `Space` | Activate tab |

**Tables:**
| Key | Action |
|-----|--------|
| `↑` / `↓` | Move between rows |
| `Enter` | Expand/collapse category row (Items tab) |

### 9.3 Focus Management

| Trigger | Focus moves to |
|---------|---------------|
| Dimension switch | First item in new list |
| Search clears results | Search input retains focus |
| Filter panel opens | First filter condition |
| Filter panel closes | Filter toggle button |
| Entity selected from list | Detail panel header (customer name) |
| Period tab clicked | Active period tab retains focus |
| "View Consolidated" clicked | Detail panel header |
| Modal/dropdown opens | First interactive element in overlay |
| Modal/dropdown closes | Element that triggered the open |

### 9.4 Screen Reader Announcements

**Live regions (`aria-live="polite"`):**
- List count changes: "Showing 8 of 42 customers"
- Filter applied: "Filter applied. 8 results."
- Period changed: "Showing YTD data for Acme Corporation"
- Consolidated view: "Consolidated view for 3 customers"
- KPI value changes: Announce via `role="status"` (no explicit interruption)

### 9.5 Color Contrast (WCAG AA)

| Combination | Foreground | Background | Ratio | Pass? |
|-------------|-----------|------------|-------|-------|
| Primary text on card | `#1a1a1a` | `#ffffff` | 17.4:1 | ✅ AA |
| Secondary text on card | `#555555` | `#ffffff` | 7.5:1 | ✅ AA |
| Muted text on card | `#999999` | `#ffffff` | 2.8:1 | ❌ Fails AA (use for decorative only) |
| Gold text on white | `#b8a88a` | `#ffffff` | 2.3:1 | ❌ Fails AA (never for essential text) |
| White text on dark | `#ffffff` | `#2c2a26` | 14.9:1 | ✅ AA |
| Green trend | `#22c55e` | `#ffffff` | 2.5:1 | ❌ Pair with ▲ icon |
| Red trend | `#ef4444` | `#ffffff` | 3.9:1 | ⚠️ Pair with ▼ icon |

**Rules:**
- `#999` and `#b8a88a` may only be used for decorative/supplementary text — never for information the user needs to act on.
- Trend colors (`green`, `red`) must always be paired with directional icons (`▲`, `▼`, `●`) — never color alone.
- All interactive elements must have visible focus indicators: `2px solid #b8a88a` outline with `2px` offset.

---

## 10. Calculation Formulas & Business Rules

### 10.1 KPI Formulas

| KPI | Formula | Source | Edge cases |
|-----|---------|--------|------------|
| Total Revenue | `SUM(ORDERS.TOTPRICE)` for period, excl. cancelled orders | ORDERS entity | If 0 orders: show `$0` not blank |
| Orders | `COUNT(ORDERS)` for period, excl. cancelled | ORDERS entity | If 0: show `0` |
| Avg Order | `Total Revenue / Orders` | Derived | If 0 orders: show `—` (em dash) |
| Margin % | `SUM(ORDERITEMS.margin_amount) / SUM(ORDERITEMS.extended_price) × 100` | ORDERITEMS | If revenue = 0: show `—` |
| Margin $ | `SUM(ORDERITEMS.margin_amount)` | ORDERITEMS | If 0: show `$0` |
| Frequency | `Orders / months_in_period` | Derived | Partial months count as 1. If 0 months: show `—` |
| Last Order | `NOW() - MAX(ORDERS.CREATEDDATE)` in days | ORDERS | If no orders: show `No orders` |
| Fill Rate | `SUM(ORDERITEMS.qty_delivered) / SUM(ORDERITEMS.qty_ordered) × 100` | ORDERITEMS | If 0 ordered: show `—`. Capped at 100%. |

### 10.2 Trend Calculations

| Trend | Formula | Display |
|-------|---------|---------|
| Revenue YoY % | `(current_period - prev_period) / prev_period × 100` | `+12.4%` or `-5.2%` |
| Revenue YoY $ | `current_period - prev_period` | `+$26,400` or `-$8,100` |
| Orders change | `current_qty - prev_qty` | `+4 this quarter` |
| Margin pp change | `current_margin% - prev_margin%` | `+1.2pp` or `-0.8pp` |
| Frequency change | `current_freq - avg_freq` | `+0.3 vs avg` |
| Last Order status | Based on days since last order | See 10.3 |

**When previous period = 0:** Show `New` badge instead of percentage. Green color.
**When previous period missing:** Show `—` for trend.

### 10.3 Activity Status Rules

Based on `days_since_last_order`:

| Days | Label | Color | Icon |
|------|-------|-------|------|
| 0–14 | Active buyer | `#22c55e` | Green dot `●` |
| 15–45 | Regular | `#b8a88a` | Gold dot `●` |
| 46–90 | Slowing | `#eab308` | Yellow dot `●` |
| 91+ | At risk | `#ef4444` | Red dot `●` |
| No orders | No orders | `#999` | Gray dot `●` |

### 10.4 Order Status Mapping

Priority ERP `ORDSTATUS` field → Dashboard display:

| ERP Value | Badge Label | Badge Color |
|-----------|-------------|-------------|
| `O` (Open) | Processing | Blue (`#3b82f6` at 15% bg) |
| `P` (Partially delivered) | Pending | Yellow (`#eab308` at 15% bg) |
| `C` (Closed/Delivered) | Delivered | Green (`#22c55e` at 15% bg) |
| `X` (Cancelled) | *Excluded from dashboard* | N/A |

### 10.5 Consolidated Aggregation Rules

When multiple entities are selected and "View Consolidated" is clicked:

| KPI | Aggregation | Example |
|-----|-------------|---------|
| Total Revenue | SUM across entities | $240K + $180K = $420K |
| Orders | SUM | 32 + 28 = 60 |
| Avg Order | Weighted: total revenue / total orders | $420K / 60 = $7,000 |
| Margin % | Weighted: total margin $ / total revenue | Not simple average of percentages |
| Margin $ | SUM | $44K + $36K = $80K |
| Frequency | Weighted average by order count | Not simple average |
| Last Order | MIN (most recent across all) | Most recent date wins |
| Fill Rate | Weighted: total delivered / total ordered | Not simple average |

**Charts:** YoY bars = summed monthly values. Product mix = combined. Top 10 = re-ranked across all entities.
**Tables:** Orders tab = merged & sorted by date desc. Items tab = merged categories. Contacts tab = all contacts.
**Header:** Shows "[Entity1], [Entity2], +N more" or "3 Customers Selected" if > 3.

### 10.6 Currency & Number Formatting

| Type | Format | Examples |
|------|--------|---------|
| Currency | `$X,XXX` (no decimals for ≥ $1K); `$X.XX` (under $1K) | `$240,200`, `$7,506`, `$0.85` |
| Currency (compact) | `$XK` / `$XM` for axis labels | `$30K`, `$1.2M` |
| Percentage | One decimal place + `%` | `18.4%`, `94.2%` |
| Percentage points | One decimal + `pp` | `+1.8pp`, `-1.2pp` |
| Count | Integer with comma separator | `1,248` |
| Frequency | One decimal + `/mo` | `2.7/mo` |
| Days | Integer + `days` / `day` (singular when 1) | `4 days`, `1 day` |
| Date (table) | `MMM DD, YYYY` | `Mar 28, 2026` |
| Date (subtitle) | `MMM YYYY` | `Jan 2021` |

### 10.7 Period Definitions

| Period | Start | End | Previous Period |
|--------|-------|-----|-----------------|
| YTD | Jan 1 of current year | Today | Same date range of previous year (Jan 1 – today's date) |
| 2025 | Jan 1, 2025 | Dec 31, 2025 | Jan 1, 2024 – Dec 31, 2024 |
| 2024 | Jan 1, 2024 | Dec 31, 2024 | Jan 1, 2023 – Dec 31, 2023 |

YoY chart always shows calendar months (Jan–Dec). For YTD, future months show no bars.

---

## 11. Error & Empty States

### 11.1 Error Hierarchy

| Severity | Trigger | UI Treatment |
|----------|---------|-------------|
| **Critical** | API unreachable, auth failure | Full-screen error card replacing dashboard. "Unable to load dashboard. Check your connection." + Retry button |
| **Section** | Single API call fails (e.g., chart data) | Error card within that section. Other sections still render. "Unable to load [section]." + Retry link |
| **Inline** | Single field computation error | Show `—` with tooltip "Data unavailable" |
| **Toast** | Export fails, transient network issue | Bottom-right toast, auto-dismiss 5s. Gold border for warnings, red for errors. |

### 11.2 Empty States

| Scenario | Display |
|----------|---------|
| No entities in list | Centered illustration (simple line art) + "No [dimension] found" + suggestion text |
| Search returns 0 results | "No results for '[query]'" + "Try a different search term" |
| Filter returns 0 results | "No [dimension] match these filters" + "Clear filters" link |
| Entity has 0 orders for period | KPIs show `$0` / `0` / `—`. Charts show empty state with dotted outline. Tables show "No orders for this period." |
| Entity has no contacts | Contacts tab shows "No contacts on file." |
| No previous year data | Trend shows `—`. YoY chart shows only current year bars. Legend hides "Previous Year". |
| Consolidated with 0 overlap | If selected entities have no orders in period: same as single-entity empty state |

### 11.3 Rate Limit Handling

Priority ERP: 100 calls/min, 15 queued max, 3-min timeout.

| Scenario | Backend | Frontend |
|----------|---------|----------|
| Approaching limit | Exponential backoff (1s, 2s, 4s, 8s max) | No visible change (backend absorbs) |
| Rate limited (429) | Queue request, retry after `Retry-After` header | Show subtle "Loading..." if > 3s |
| Queue full | Return cached data if available, else error | Section-level error with retry |
| Timeout (3 min) | Cancel request, return partial data or error | Toast: "Request timed out. Showing cached data." |

### 11.4 Stale Data Indicator

When serving cached data older than `staleTime` (5 min):
- Small `●` yellow dot next to the period selector
- Tooltip: "Data last updated X minutes ago"
- Click refreshes all data

---

## 12. Animation & Transitions (Framer Motion)

### 12.1 Timing Standards

| Duration | Use | Easing |
|----------|-----|--------|
| 150ms | Micro-interactions (hover, focus, badge) | `ease-out` |
| 200ms | State changes (tab switch, sort, active item) | `ease-in-out` |
| 300ms | Panel transitions (filter expand, accordion) | `spring(1, 0.85, 0)` — Framer Motion spring |
| 400ms | Content swap (dimension switch, entity load) | `spring(1, 0.8, 0)` |

### 12.2 Component Animations

| Component | Trigger | Animation |
|-----------|---------|-----------|
| Dimension switch | Click toggle | List: `opacity 0→1`, `y: 8→0` staggered 30ms per item |
| Entity detail load | Click list item | Right panel: `opacity 0→1`, `y: 4→0` over 200ms |
| Filter panel | Toggle open/close | `height: 0→auto`, `opacity 0→1` over 300ms (Framer `AnimatePresence`) |
| Filter condition add | Click "Add filter" | New row: `opacity 0→1`, `height: 0→auto`, `y: -8→0` |
| Filter condition remove | Click × | Row: `opacity 1→0`, `height: auto→0`, `x: 0→-20` |
| Accordion expand | Click category row | Children: `height: 0→auto`, stagger 20ms per child |
| Selection bar | First checkbox checked | Slide up from bottom: `y: 100%→0` over 300ms |
| Selection bar | Last checkbox unchecked | Slide down: `y: 0→100%` over 200ms |
| Period tab switch | Click tab | KPI values: number counter animation (count up/down). Charts: bars scale from 0 height. |
| Skeleton → content | Data loads | Skeleton: `opacity 1→0`. Content: `opacity 0→1`, slight `y: 4→0` |
| Toast notification | Error/warning | Slide in from right: `x: 100%→0`, auto-dismiss with fade out |
| Sort dropdown | Open/close | `opacity 0→1`, `y: -4→0`, `scale: 0.98→1` over 150ms |
| KPI number change | New data | Animated number counter using Framer Motion `useMotionValue` |

### 12.3 Reduced Motion

Respect `prefers-reduced-motion`:
- Replace all animations with instant state changes (`duration: 0`)
- Keep layout shifts (height changes) but make them instant
- Never animate purely for decoration

---

## 13. Testable Behaviors — Acceptance Criteria

Every feature must have a test written before implementation. This section defines the expected behaviors in assertion-ready language.

### 13.1 Dimension Switching

```
GIVEN the dashboard is loaded with "Customers" active
WHEN user clicks "Zone" dimension toggle
THEN:
  - List shows zone entities (not customers)
  - List header reads "ZONES (X OF Y)"
  - Search placeholder reads "Search zones..."
  - "All Zones" summary row appears at top
  - All filters are RESET (not preserved across dimensions)
  - Sort resets to default (Revenue desc)
  - Multi-select is cleared
  - Right panel shows "All Zones" aggregate data
  - Active toggle shows dark bg (#2c2a26)
  - Previously active toggle returns to default state
```

### 13.2 Search

```
GIVEN the customer list is visible with 42 items
WHEN user types "acm" in search box
THEN:
  - After 300ms debounce, list filters to matching items
  - Match is case-insensitive, partial, on entity name
  - Header updates to "CUSTOMERS (N OF 42)" where N = match count
  - "All Customers" summary row is always visible (not filtered)
  - If 0 matches: empty state with "No results for 'acm'"

WHEN user clears search (backspace or × button)
THEN:
  - Full list restores immediately (no debounce on clear)
  - Filter/sort still apply if active
```

### 13.3 Filters

```
GIVEN no filters are active
WHEN user clicks Filter button
THEN:
  - Filter panel slides open (300ms spring)
  - Filter button becomes dark bg (#2c2a26)
  - Count badge shows "0"
  - Panel shows "Add Filter" button

GIVEN filter panel is open
WHEN user adds a filter: Revenue > $10,000
THEN:
  - New condition row animates in
  - List updates immediately (client-side filtering on current dataset)
  - Count badge updates to "1"
  - Header count updates to match filtered results

GIVEN 2 filters are active
WHEN user switches dimension from Customers to Zones
THEN:
  - All filters are CLEARED
  - Filter panel closes
  - Filter button returns to default state
  - Count badge resets to "0"
```

### 13.4 Multi-Select & Consolidated View

```
GIVEN customer list is visible
WHEN user checks 3 customer checkboxes
THEN:
  - Selection bar slides up from bottom
  - Shows "3 selected" text
  - "View Consolidated" button is enabled
  - "Clear" link is visible

WHEN user clicks "View Consolidated"
THEN:
  - Right panel shows aggregated data for all 3 customers
  - Header shows "Acme Corp, Beta Inc, +1 more"
  - Revenue = SUM of all 3 customers' revenue
  - Avg Order = total revenue / total orders (weighted, not average of averages)
  - Margin % = total margin $ / total revenue (weighted)
  - Charts merge data across all 3 customers
  - Tables merge and re-sort

WHEN user clicks "Clear"
THEN:
  - All checkboxes uncheck
  - Selection bar slides down
  - Right panel reverts to previously selected single entity (or "All Customers")
```

### 13.5 Period Switching

```
GIVEN YTD is selected for Acme Corporation
WHEN user clicks "2025" period tab
THEN:
  - 2025 tab becomes active (white bg, bold)
  - YTD tab returns to default state
  - If 2025 data is cached: instant switch (< 100ms)
  - If not cached: loading state in right panel, tab shows pulsing dot
  - KPI values animate to new numbers (counter animation)
  - YoY chart updates to show 2025 vs 2024 bars (full 12 months)
  - Tables show 2025 orders only
  - Subtitle date range updates

WHEN user clicks "More" dropdown
THEN:
  - Dropdown shows available years not in main tabs
  - Only years with actual order data appear
  - Clicking a year behaves same as clicking a main tab
```

### 13.6 Data Tables

```
GIVEN the Orders tab is active
THEN:
  - Orders are sorted by date descending (most recent first)
  - Each row shows: Date, Order #, Items count, Amount, Margin (% + $), Status badge
  - Cancelled orders are excluded
  - Status badges use correct colors (see 10.4)

GIVEN the Items tab is active
THEN:
  - Products are grouped by category
  - Category rows show: name, total value, margin %, margin $, items count, progress bar
  - Categories are sorted by value descending
  - Clicking a category row expands to show child products
  - Child products are indented 44px, sorted by value descending
  - Child products show SKU in muted text

GIVEN the Contacts tab is active
THEN:
  - Contacts show: Full Name, Position, Phone, Email
  - Email renders as gold-colored clickable link
  - If no contacts: "No contacts on file." message
```

### 13.7 Error Recovery

```
GIVEN the API returns a 429 (rate limited)
THEN:
  - Backend retries with exponential backoff
  - If retry succeeds: normal response, user sees nothing unusual
  - If retries exhausted: section-level error with "Retry" button
  - Other sections that loaded successfully remain visible

GIVEN the API times out (> 3 min)
THEN:
  - If cached data exists: serve cached data + yellow stale indicator dot
  - If no cache: section-level error
  - Toast: "Request timed out. Showing cached data."

GIVEN user clicks "Retry" on a section error
THEN:
  - Error card shows spinner
  - New API request fires
  - On success: section loads normally
  - On failure: error card returns with updated message
```

---

## 14. Responsive Behavior

Dashboard is embedded in Airtable via Omni block. Viewport width varies.

### 14.1 Breakpoints

| Breakpoint | Width | Layout Change |
|------------|-------|---------------|
| Desktop | ≥ 1024px | Full master-detail layout as spec'd |
| Compact | 768–1023px | Left panel shrinks to 240px, KPI grid becomes `1fr 1fr` (2 cols), charts stack vertically |
| Narrow | < 768px | Single-column: left panel full width at top (collapsible), detail below |

### 14.2 Airtable Iframe Constraints

- No control over parent page scroll
- `100vh` refers to iframe height, not browser window
- Test with actual Airtable embed, not just localhost
- `postMessage` not available for cross-origin communication
- URL routing won't work inside iframe — state management must be in-memory (React state / TanStack Query cache)

---

## 15. Dimension-Specific Metadata

Each dimension shows different metadata in the list items and subtitle.

### 15.1 List Item Metadata

| Dimension | Line 1 | Line 2 (meta) |
|-----------|--------|---------------|
| Customers | Customer name (13px/600) | Zone + Rep (10px, gold) |
| Zone | Zone name (13px/600) | Customer count + Total revenue (10px, gold) |
| Vendors | Vendor name (13px/600) | Product count + Total revenue (10px, gold) |
| Brands | Brand name (13px/600) | Product count + Total revenue (10px, gold) |
| Prod. Type | Product type name (13px/600) | Product count + Total revenue (10px, gold) |
| Products | Product name (13px/600) | SKU + Brand (10px, gold) |

### 15.2 Detail Header Subtitle

| Dimension | Subtitle pattern |
|-----------|-----------------|
| Customers | `{ID} · {Zone} · Rep: {Rep Name} · Active since {Date}` |
| Zone | `{Customer Count} customers · {Rep Count} reps` |
| Vendors | `{ID} · {Product Count} products · Since {Date}` |
| Brands | `{Product Count} products · {Vendor Count} vendors` |
| Prod. Type | `{Product Count} products · {Brand Count} brands` |
| Products | `{SKU} · {Brand} · {Vendor} · {Prod Type}` |

### 15.3 Filter Fields per Dimension

Not all filter fields apply to all dimensions:

| Filter Field | Customers | Zone | Vendors | Brands | Prod. Type | Products |
|-------------|-----------|------|---------|--------|------------|----------|
| Rep | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Customer Type | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Zone | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Last Order Date | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Margin % | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Margin $ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Total Revenue | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Average Order | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Frequency | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Outstanding | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 15.4 Sort Default & Fields per Dimension

Default sort: **Revenue descending** for all dimensions.

Sort fields available for all dimensions: Name, Revenue, Orders, Avg Order, Margin %, Frequency, Outstanding, Last Order.

---

## 16. Export Specification

### 16.1 Export Format

**Primary:** CSV download (all tabs data in one file or multi-sheet XLSX).

**What's exported:** Current view state — respects active period, filters, selected entity or consolidated selection.

| Section | CSV Columns |
|---------|-------------|
| KPIs | KPI Name, Value, Trend, Previous Value |
| Orders | Date, Order #, Items, Amount, Margin %, Margin $, Status |
| Items | Category, Product, SKU, Value, Margin %, Margin $ |
| Contacts | Full Name, Position, Phone, Email |

### 16.2 Export Behavior

- Click export → browser download starts immediately (no modal)
- Filename: `{Entity Name}_{Period}_{YYYY-MM-DD}.csv`
- If consolidated: `Consolidated_{N}_Customers_{Period}_{YYYY-MM-DD}.csv`
- During export: button shows spinner icon, disabled state
- On success: button returns to default
- On failure: toast error "Export failed. Please try again."

---

## 17. Priority ERP OData Integration Patterns

This section defines the exact Priority ERP queries the backend must execute. All patterns follow the production-proven `priority-erp-api` skill. Reference: `tools/erp-field-mapping.xlsx` for the complete 52-field mapping.

### 17.1 Required Headers (Every Request)

```
Content-Type: application/json
IEEE754Compatible: true
Prefer: odata.maxpagesize=49900
Authorization: Basic {base64(username:password)}
```

`IEEE754Compatible: true` is **CRITICAL** — without it, numeric values (TOTPRICE, QPRICE, QPROFIT) return incorrectly. Always include it.

### 17.2 Core Queries — Orders + Line Items

This is the primary data source for the dashboard. ORDERS with ORDERITEMS expanded inline.

**Main dashboard fetch (YTD):**
```
GET /ORDERS
  ?$select=ORDNAME,CURDATE,ORDSTATUSDES,TOTPRICE,CUSTNAME,CUSTDES,AGENTCODE,AGENTDES
  &$expand=ORDERITEMS_SUBFORM($select=PARTDES,PARTNAME,TQUANT,QPRICE,PRICE,PURCHASEPRICE,COST,QPROFIT,PERCENT,Y_1159_5_ESH,Y_1530_5_ESH,Y_9952_5_ESH,Y_3020_5_ESH,Y_3021_5_ESH,Y_17936_5_ESH)
  &$filter=CURDATE ge 2026-01-01T00:00:00Z and ORDSTATUSDES ne 'Canceled'
  &$orderby=ORDNAME asc
  &$top=5000
```

**Why `$expand` with nested `$select`:**
- Without nested `$select`: ~13 MB per page, risks 3-min timeout
- With nested `$select` (16 fields): ~0.3 MB per page, 4x faster
- This is the single biggest performance lever

**Previous year fetch (for YoY):**
```
GET /ORDERS
  ?$select=ORDNAME,CURDATE,TOTPRICE,CUSTNAME,AGENTCODE
  &$expand=ORDERITEMS_SUBFORM($select=PARTNAME,QPRICE,QPROFIT,Y_9952_5_ESH,Y_3021_5_ESH)
  &$filter=CURDATE ge 2025-01-01T00:00:00Z and CURDATE lt 2026-01-01T00:00:00Z and ORDSTATUSDES ne 'Canceled'
  &$orderby=ORDNAME asc
  &$top=5000
```

Previous year needs fewer fields — only what's required for trends, no display names.

**On-demand year fetch (e.g., 2024):**
Same pattern as previous year, adjusted date range:
```
$filter=CURDATE ge 2024-01-01T00:00:00Z and CURDATE lt 2025-01-01T00:00:00Z and ORDSTATUSDES ne 'Canceled'
```

### 17.3 Lookup Entity Queries

These are small, cacheable datasets that populate dimensions, filters, and metadata.

**Customers:**
```
GET /CUSTOMERS
  ?$select=CUSTNAME,CUSTDES,ZONECODE,ZONEDES,AGENTCODE,AGENTDES,CREATEDDATE,CTYPECODE,CTYPEDES
  &$top=5000
```

**Customer contacts (sub-form):**
```
GET /CUSTOMERS
  ?$select=CUSTNAME
  &$expand=CUSTPERSONNEL_SUBFORM($select=NAME,POSITIONDES,PHONENUM,CELLPHONE,EMAIL,INACTIVE)
  &$filter=CUSTNAME eq '{customer_code}'
  &$top=1
```
Sub-form pattern: **Pattern B** (multi-record via `$expand`). Filter inactive contacts client-side: `INACTIVE ne 'Y'`.

**Zones (Distribution Lines):**
```
GET /DISTRLINES
  ?$select=DISTRLINECODE,DISTRLINEDES,ZONECODE,ZONEDES
  &$top=5000
```

**Sales Reps (Agents):**
```
GET /AGENTS
  ?$select=AGENTCODE,AGENTNAME,INACTIVE
  &$filter=INACTIVE ne 'Y'
  &$top=5000
```

**Vendors:**
```
GET /SUPPLIERS
  ?$select=SUPNAME,SUPDES
  &$top=5000
```

### 17.4 Pagination — MAXAPILINES Cap

Priority caps results at **MAXAPILINES** (currently 50,000 for this instance, but default is 2,000). When paginating with `$skip` beyond this limit, Priority returns **0 records silently**.

**Strategy: Cursor-based pagination with `$top=5000`.**

```
Page 1: $top=5000&$skip=0&$orderby=ORDNAME asc
Page 2: $top=5000&$skip=5000&$orderby=ORDNAME asc
...
If page returns exactly MAXAPILINES records total:
  → New query context: $filter=ORDNAME gt '{last_ordname}'&$orderby=ORDNAME asc&$top=5000
```

**Key rules:**
- `$orderby` is **required** — ensures consistent sort for cursor extraction
- Single quotes in key values must be escaped as `''` (OData convention)
- When combining with date filters: `$filter=CURDATE ge ... and ORDNAME gt '...'`

### 17.5 Rate Limit Budget

100 calls/min shared across ALL Priority users. Budget per dashboard scenario:

| Scenario | Queries | Budget |
|----------|---------|--------|
| **Initial load (YTD)** | Orders YTD (1–2 pages) + Prev year (1–2 pages) + Customers (1) + Zones (1) + Agents (1) + Vendors (1) | **6–8 calls** |
| **Select entity** | 0 — data already loaded, filter client-side | **0 calls** |
| **Switch dimension** | 0 — data already loaded, re-aggregate client-side | **0 calls** |
| **Load year tab** | Year orders (1–2 pages) | **1–2 calls** |
| **Load contacts** | Customer contacts (1) | **1 call** |
| **Refresh all** | Same as initial load | **6–8 calls** |

**Total for heavy session (initial + 3 year switches + 10 contact loads):** ~20 calls. Well within 100/min.

**Design principle:** Fetch wide (all orders, all customers) on initial load, then filter/aggregate entirely client-side. This minimizes API calls and makes dimension switching, entity selection, and filtering instant.

### 17.6 DateTime Format

Priority uses ISO 8601 with `Z` suffix:
```
2026-01-01T00:00:00Z
```

Always use this format in `$filter` expressions. Never use `+00:00` or raw date formats.

### 17.7 Error Response Handling

Priority returns errors in **two formats**. The backend must parse both:

**Format 1 — OData standard:**
```json
{"error": {"code": "404", "message": "Entity not found"}}
```

**Format 2 — Priority interface errors:**
```json
{"FORM": {"InterfaceErrors": {"text": "Line 1- error message here"}}}
```

**Backend error extraction pattern:**
```typescript
function extractPriorityError(response: Response, body: unknown): string {
  if (body?.error?.message) return body.error.message;
  if (body?.FORM?.InterfaceErrors?.text) return body.FORM.InterfaceErrors.text;
  return `HTTP ${response.status}: ${response.statusText}`;
}
```

### 17.8 URL Encoding Trap

**Do NOT use `URL.searchParams.set()` for `$expand`** — it encodes `(` → `%28`, `)` → `%29`, which breaks Priority's OData parser.

```typescript
// WRONG — form-encodes nested OData syntax
url.searchParams.set('$expand', 'ORDERITEMS_SUBFORM($select=PARTNAME,QPRICE)');

// CORRECT — append raw string
let urlStr = baseUrl + '?' + params.join('&');
urlStr += '&$expand=ORDERITEMS_SUBFORM($select=PARTNAME,QPRICE)';
```

`$select`, `$filter`, `$orderby` are safe with `searchParams` because their values don't contain nested OData syntax.

### 17.9 Custom Fields (Y_ Pattern)

Priority custom fields follow the `Y_XXXX_5_ESH` naming pattern. These are the dashboard-critical custom fields on ORDERITEMS:

| Custom Field | Purpose | Dashboard Use |
|-------------|---------|---------------|
| `Y_1159_5_ESH` | Vendor code | Vendors dimension grouping |
| `Y_1530_5_ESH` | Vendor name | Vendors dimension display |
| `Y_9952_5_ESH` | Brand | Brands dimension grouping + display |
| `Y_3020_5_ESH` | Family type code | Prod. Type dimension grouping |
| `Y_3021_5_ESH` | Family type name | Prod. Type dimension display + Product Mix donut |
| `Y_17936_5_ESH` | Vendor part number | Items tab display |
| `Y_5380_5_ESH` | Country of origin | Future filter (NEW) |
| `Y_9967_5_ESH` | Retail Y/N | Future filter (NEW) |
| `Y_9964_5_ESH` | Catalog status | Future filter (NEW) |
| `Y_9965_5_ESH` | Inventory status | Future filter (NEW) |

The last 4 fields are available but not yet placed in the dashboard. They can be added as filter options in a future iteration.

---

## 18. Entity-to-Dashboard Field Mapping

Complete mapping from Priority ERP entities to dashboard data points. Canonical reference: `tools/erp-field-mapping.xlsx`.

### 18.1 ORDERS → KPIs, Orders Tab, Header

| Dashboard Element | Priority Field | Type | Notes |
|-------------------|---------------|------|-------|
| Order # | `ORDNAME` | string | Primary key. Format: alphanumeric |
| Order Date | `CURDATE` | datetime | ISO 8601 with `Z`. Used for period filtering, Last Order KPI, monthly revenue grouping |
| Order Status | `ORDSTATUSDES` | string | Text description. Map to badge: Delivered/Pending/Processing (see 10.4) |
| Order Total | `TOTPRICE` | decimal | Main revenue figure. With `IEEE754Compatible: true`, returned as float |
| Customer Code | `CUSTNAME` | string | Foreign key to CUSTOMERS |
| Customer Name | `CUSTDES` | string | Display name — avoids JOIN for list rendering |
| Sales Rep Code | `AGENTCODE` | string | Foreign key to AGENTS. For rep filter + grouping |
| Sales Rep Name | `AGENTDES` | string | Display name for header subtitle |

### 18.2 ORDERITEMS_SUBFORM → Items Tab, Charts, KPIs

| Dashboard Element | Priority Field | Type | Notes |
|-------------------|---------------|------|-------|
| Product Name | `PARTDES` | string | Display in Items accordion + Top 10 |
| Product SKU | `PARTNAME` | string | Shown in muted text beside product name |
| Quantity | `TQUANT` | decimal | For Top 10 unit quantity display |
| Extended Price | `QPRICE` | decimal | Line total = qty × unit price. Revenue per product |
| Unit Price | `PRICE` | decimal | Unit selling price. Shown in Items tab detail |
| Purchase Price | `PURCHASEPRICE` | decimal | Cost per unit. For margin calculation |
| Item Cost | `COST` | decimal | Alternative cost field per UOM |
| Line Profit | `QPROFIT` | decimal | Margin $ per line. `SUM(QPROFIT)` = Margin $ KPI |
| Discount % | `PERCENT` | decimal | Discount on line item |
| Vendor Code | `Y_1159_5_ESH` | string | Groups items by vendor for Vendors dimension |
| Vendor Name | `Y_1530_5_ESH` | string | Display in Vendors dimension |
| Brand | `Y_9952_5_ESH` | string | Groups items for Brands dimension |
| Family Code | `Y_3020_5_ESH` | string | Groups items for Prod. Type dimension |
| Family Name | `Y_3021_5_ESH` | string | Display in Prod. Type dimension + Product Mix donut categories |
| Vendor Part # | `Y_17936_5_ESH` | string | Display in Items tab |

### 18.3 CUSTOMERS → Customer List, Header

| Dashboard Element | Priority Field | Type | Notes |
|-------------------|---------------|------|-------|
| Customer Code | `CUSTNAME` | string | Primary key. Display as "C-10042" in subtitle |
| Customer Name | `CUSTDES` | string | List item line 1, header title |
| Zone Code | `ZONECODE` | string | For Zone dimension grouping |
| Zone Name | `ZONEDES` | string | List item meta, header subtitle |
| Rep Code | `AGENTCODE` | string | For Rep filter |
| Rep Name | `AGENTDES` | string | Header subtitle "Rep: Sarah M." |
| Active Since | `CREATEDDATE` | datetime | Header subtitle "Active since Jan 2021" |
| Customer Type Code | `CTYPECODE` | string | For Customer Type filter |
| Customer Type Name | `CTYPEDES` | string | Filter dropdown display |

### 18.4 CUSTPERSONNEL_SUBFORM → Contacts Tab

| Dashboard Element | Priority Field | Type | Notes |
|-------------------|---------------|------|-------|
| Full Name | `NAME` | string | Contact display name |
| Position | `POSITIONDES` | string | e.g., "Purchasing Manager" |
| Phone (Office) | `PHONENUM` | string | Office/landline |
| Phone (Cell) | `CELLPHONE` | string | Mobile — show whichever is available |
| Email | `EMAIL` | string | Gold-colored `mailto:` link |
| Inactive Flag | `INACTIVE` | string | `Y`/`N`. **Always filter: exclude where `INACTIVE = 'Y'`** |

### 18.5 Lookup Entities → Dimensions & Filters

| Entity | Key Fields | Used For |
|--------|-----------|----------|
| `DISTRLINES` | `DISTRLINECODE`, `DISTRLINEDES`, `ZONECODE`, `ZONEDES` | Zone dimension list, zone filter |
| `AGENTS` | `AGENTCODE`, `AGENTNAME`, `INACTIVE` | Sales rep filter dropdown. Exclude `INACTIVE = 'Y'` |
| `SUPPLIERS` | `SUPNAME`, `SUPDES` | Vendors dimension list (supplemental — primary vendor data is on ORDERITEMS) |

### 18.6 Deferred Fields

| Field | Status | Reason |
|-------|--------|--------|
| Outstanding Balance | DEFERRED | Requires separate Priority form (not ORDERS). May add if loading time permits. |
| `Y_5380_5_ESH` (Country of Origin) | NEW — unplaced | Available on ORDERITEMS. Could be a filter. |
| `Y_9967_5_ESH` (Retail Y/N) | NEW — unplaced | Available on ORDERITEMS. Could be a filter. |
| `Y_9964_5_ESH` (Catalog Status) | NEW — unplaced | Available on ORDERITEMS. Could be a filter. |
| `Y_9965_5_ESH` (Inventory Status) | NEW — unplaced | Available on ORDERITEMS. Could be a filter. |

### 18.7 Margin Calculation — Which Field to Use

Two margin approaches are available from ORDERITEMS:

| Approach | Formula | Pros | Cons |
|----------|---------|------|------|
| **Use `QPROFIT`** (recommended) | `SUM(QPROFIT)` for Margin $ | Priority-calculated, includes all cost factors | Single field, no transparency into cost breakdown |
| **Calculate from prices** | `QPRICE - (PURCHASEPRICE × TQUANT)` | Full transparency, can debug cost components | May not match Priority's internal margin logic |

**Recommendation:** Use `QPROFIT` as the authoritative margin value. It's what Priority users see in their system. Show `PURCHASEPRICE` and `COST` as optional detail in Items tab.

---

## 19. Backend Caching & Data Freshness (Upstash Redis)

### 19.1 Cache Key Schema

```
dashboard:{company}:{entity}:{period}:{hash}
```

| Segment | Values | Example |
|---------|--------|---------|
| `company` | Priority company code | `mycompany` |
| `entity` | `orders`, `customers`, `zones`, `agents`, `vendors` | `orders` |
| `period` | `ytd`, `2025`, `2024`, ... | `ytd` |
| `hash` | Short hash of filter/expand params | `a3f8c1` |

**Examples:**
```
dashboard:mycompany:orders:ytd:a3f8c1
dashboard:mycompany:orders:2025:b7d2e4
dashboard:mycompany:customers:all:c9e5f3
dashboard:mycompany:zones:all:d1a4b6
dashboard:mycompany:agents:all:e2c7f8
```

### 19.2 TTL Strategy

| Data Type | Redis TTL | Rationale |
|-----------|-----------|-----------|
| Orders (YTD) | 15 min | Active data, changes frequently |
| Orders (historical year) | 24 hours | Past years rarely change |
| Customers | 1 hour | Metadata changes infrequently |
| Zones | 24 hours | Almost never changes |
| Agents | 1 hour | Reps can be added/deactivated |
| Vendors | 24 hours | Rarely changes |
| Contacts (per customer) | 30 min | May change, but fetched on demand |

### 19.3 Cache Flow

```
Client request → Express backend → Check Redis
  ├─ Cache HIT + fresh → Return cached data (< 5ms)
  ├─ Cache HIT + stale → Return cached + trigger background refresh
  └─ Cache MISS → Fetch from Priority → Store in Redis → Return
```

**Stale-while-revalidate:** When cache exists but is past `staleTime` (configured per entity), serve the cached data immediately and refresh in the background. The next request gets fresh data.

### 19.4 Cache Invalidation

| Trigger | Action |
|---------|--------|
| Manual refresh (stale indicator click) | Delete key + re-fetch |
| Period switch to uncached year | Fetch + cache with long TTL |
| Server restart | Redis persists — no cold start penalty |
| Deploy | No invalidation needed — cache keys are stable |

### 19.5 Redis Payload Optimization

Store aggregated/computed data, not raw API responses:
- Raw Priority response for 5,000 orders + items: ~2.7 MB
- Aggregated dashboard payload (KPIs + monthly totals + top 10 + tables): ~50–100 KB

**Compute on write:** When caching, pre-compute KPIs, monthly breakdowns, dimension groupings, and product rankings. The frontend receives ready-to-render data.

### 19.6 Year Availability Check

Instead of a separate API endpoint, derive year availability from cached data:
- On initial load, the backend knows which years have order data from the CURDATE range
- Store a lightweight `years-available` key: `["2026", "2025", "2024", "2023"]`
- TTL: 1 hour
- Frontend uses this to show/hide period tabs

---

## 20. Chart & Data Visualization Styling

### 20.1 YoY Revenue Bar Chart (Hero Card)

**Dimensions:** Full-width of hero card, 120px height. SVG `viewBox` calculated dynamically based on card width.

**Bar styling:**
- Previous year bars: `fill: #e8e0d0`, `opacity: 0.5`, `border-radius: 2px 2px 0 0` (top corners only)
- Current year bars: `fill: #d4c5a9`, `opacity: 1`, `border-radius: 2px 2px 0 0`
- Bar width: 60% of available column space, 2px gap between paired bars
- Bars grow from bottom (baseline at y-axis 0)

**Axis styling:**
- Y-axis: 2–3 labels (`$0`, `$15K`, `$30K`), `9px`, `#bbb`, right-aligned with 4px gap to chart area
- X-axis: Month abbreviations (`Jan`–`Dec`), `9px`, `#bbb`, centered under bar pairs
- Grid lines: `1px solid #f0ece5`, horizontal only, dashed (`stroke-dasharray: 4,4`)
- No axis borders — grid lines provide structure

**Animation on load:**
- Bars scale from `scaleY(0)` to `scaleY(1)`, `transform-origin: bottom`, 400ms spring
- Staggered: 30ms delay per month (Jan first, Dec last)
- Previous year bars animate first, current year bars 100ms after

**Animation on period switch:**
- Bars morph height: current values → new values over 300ms
- Use Framer Motion `layout` prop for smooth height transitions

**Hover interaction:**
- Hovering a bar pair highlights both bars: previous year → `opacity: 0.7`, current year → `opacity: 1`, adds `filter: brightness(1.05)`
- Tooltip appears above hovered pair (see 8.5)
- Non-hovered months dim to `opacity: 0.4`

**Empty months (YTD):**
- Future months: no bars, axis label still shows in `#ddd`
- Current month (partial): bar renders with actual data, no special treatment

**Legend:**
- Below chart, left-aligned, `11px`, `#888`
- Two items: small circle `6px` + label
- Previous Year: `#e8e0d0` dot + "Previous Year"
- This Year: `#d4c5a9` dot + "This Year"
- Gap between items: 16px

### 20.2 Product Mix Donut Chart

**Dimensions:** 160x160px SVG, `viewBox="0 0 120 120"`, centered in container.

**Ring styling:**
- Outer radius: 54, inner radius: 36 (ring thickness: 18)
- `stroke-linecap: round` for segment ends
- 2px gap between segments (achieved via `stroke-dashoffset`)
- Segments arranged clockwise from 12 o'clock position

**Color palette for segments (up to 7):**
```
Segment 1: #b8a88a (gold-primary)
Segment 2: #d4c5a9 (gold-light)
Segment 3: #8B7355 (darker warm brown)
Segment 4: #C4A882 (light warm tan)
Segment 5: #e8e0d0 (gold-muted)
Segment 6: #A09070 (medium brown)
Segment 7: #f0ece5 (gold-subtle — "Other")
```

**Center text:**
- Line 1: "Total" in `10px`, `#999`
- Line 2: Count (e.g., "24") in `17px/700`, `#1a1a1a`

**Animation on load:**
- Ring draws clockwise from 0° to 360° using `stroke-dasharray` animation, 600ms `ease-out`
- Center text fades in at 400ms
- Legend items stagger in: `opacity 0→1`, `y: 4→0`, 50ms per item

**Hover interaction:**
- Hovered segment: `scale(1.04)` from center + `filter: brightness(1.08)`
- All other segments: `opacity: 0.5`
- Center text changes to show hovered category name + value
- Cursor: `pointer`

**Legend:**
- Right side of donut (or below on narrow containers)
- Vertical list, `13px`, each item: color dot (8px circle) + percentage + category name
- Sorted by percentage descending (matches segment order)

### 20.3 KPI Sparklines

**Dimensions:** 60x24px SVG per KPI card, positioned top-right corner.

**Line styling:**
- `stroke: #d4c5a9`, `stroke-width: 1.5`, `fill: none`
- `stroke-linecap: round`, `stroke-linejoin: round`
- Area fill below line: gradient from `#d4c5a9` at 20% opacity to transparent

**Data:** 6 monthly data points (last 6 months), evenly spaced.

**Animation on load:** Line draws left-to-right using `stroke-dasharray` + `stroke-dashoffset` animation, 500ms, 200ms delay after parent card appears.

**No hover interaction** — sparklines are decorative context, not interactive.

### 20.4 Category Progress Bars (Items Tab)

**Dimensions:** 80px wide, 4px height, inline with category row.

**Styling:**
- Track: `bg: #f0ece5`, `border-radius: 2px`
- Fill: `bg: #d4c5a9`, `border-radius: 2px`
- Fill width: proportional to category revenue vs. total revenue

**Animation on expand:** Fill bar grows from `width: 0` to target width, 300ms `ease-out`.

---

## 21. Micro-Interactions & Visual Polish

### 21.1 Page Load Orchestration

The dashboard entrance is the moment that defines the user's impression. This is a choreographed sequence, not a simultaneous pop:

```
T+0ms:     Layout shell renders (panels, backgrounds)
T+50ms:    Dimension toggles stagger in (left→right, 40ms each, opacity + y)
T+100ms:   Search box fades in
T+150ms:   Left panel skeleton rows appear (staggered 25ms each)
T+200ms:   Right panel skeleton appears (header, KPIs, charts)
---data arrives---
T+Xms:     Skeleton → content crossfade (per section):
           1. List items replace skeletons (stagger 20ms per item)
           2. KPI values count up from 0 (350ms counter animation)
           3. Hero chart bars grow from baseline (stagger 30ms/month)
           4. Donut ring draws clockwise (600ms)
           5. Sparklines draw left→right (500ms, 200ms after parent)
           6. Tab content fades in
```

All animations respect `prefers-reduced-motion` → instant (0ms duration).

### 21.2 Entity Selection Transition

When clicking a list item, the detail panel doesn't just swap — it breathes:

```
T+0ms:     Current detail content: opacity 1→0, y: 0→-4 (150ms ease-in)
T+100ms:   New detail content: opacity 0→1, y: 4→0 (200ms ease-out)
           KPI values: animated counter from old→new (350ms)
           Chart bars: morph height (300ms spring)
           Donut: segments interpolate to new proportions (400ms)
```

The active list item transition is simultaneous:
- Previous active: gold left border fades out (150ms), bg returns to transparent
- New active: gold left border slides in from top (150ms), bg fills `#f0ebe3`

### 21.3 Number Counter Animation

All KPI values use animated counters when data changes (entity switch, period switch):

**Implementation:** Framer Motion `useSpring` + `useTransform`
- Duration: 350ms
- Easing: `spring(1, 0.9, 0)` (snappy, slight overshoot)
- Format: Apply currency/percentage/count formatting on each animation frame
- Start: Previous value (or 0 on first load)
- End: New value

**Behavior:**
- Currency values ($240,200): digits roll smoothly, comma separators stable
- Percentages (18.4%): decimal rolls, `%` stays fixed
- Counts (32): integer rolls

### 21.4 Hover Micro-Interactions

| Element | Hover Effect | Duration |
|---------|-------------|----------|
| List item | `bg: #faf8f4`, slight `translateX(2px)` | 150ms |
| Active list item | Additional `brightness(0.98)` on hover | 150ms |
| Dimension toggle | `bg: #faf8f4`, `scale(1.02)` | 120ms |
| KPI card | `translateY(-1px)`, `shadow: 0 2px 8px rgba(0,0,0,0.06)` | 150ms |
| Chart bar pair | Highlight pair, dim others to `opacity: 0.4` | 200ms |
| Donut segment | `scale(1.04)`, dim others, center text updates | 200ms |
| Top 10 item | `bg: #faf8f4`, rank badge: `scale(1.1)` | 150ms |
| Table row | `bg: #faf8f4` | 100ms |
| Button (any) | Per component state matrix (Section 8.2) | 150ms |
| Email link (contacts) | `color: #2c2a26`, underline appears | 150ms |
| Export button | `bg: #e8e0d0`, subtle `scale(1.01)` | 150ms |

### 21.5 Scroll Behavior

**Left panel list:**
- Custom scrollbar: 4px wide, `#d4c5a9` thumb, `#f0ece5` track, `border-radius: 2px`
- Scrollbar auto-hides after 1.5s of inactivity, fades in on scroll
- Overscroll: subtle `bounce` effect disabled (CSS `overscroll-behavior: contain`)

**Right panel:**
- Same custom scrollbar styling
- Sticky header bar (detail header stays visible on scroll)

**Smooth scroll:** Use `scroll-behavior: smooth` for programmatic scrolls (e.g., selecting entity scrolls list to show active item). Native scrolling remains instant.

### 21.6 Visual Texture & Atmosphere

The gold/cream palette already creates a warm, luxury feel. These subtle details elevate it from "clean" to "crafted":

**Page background:**
- Not a flat `#f5f1eb` — add a subtle noise texture overlay at 2% opacity
- CSS: `background-image: url('/noise.svg'); background-size: 200px; opacity: 0.02;` layered over the base color
- The noise adds organic warmth, prevents the "digital flat" feeling

**Card shadows (depth layers):**
- Resting cards: `0 1px 3px rgba(0,0,0,0.04)` (current)
- Add a second shadow for depth: `0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(184,168,138,0.08)`
- The second shadow is a barely-visible gold border that adds warmth to card edges

**Active entity glow:**
- The selected list item gets a subtle glow on its gold left border:
- `box-shadow: -2px 0 8px rgba(184,168,138,0.3)` — a warm glow bleeding left from the active border

**Hero revenue number:**
- `letter-spacing: -1px` (already spec'd) + `font-feature-settings: 'tnum'` for tabular numbers
- Tabular numbers prevent layout shift when values change (counter animation)

**Separator details:**
- Between "All Customers" row and customer list: not a plain border but a `1px` line with gradient fade at both ends:
- `background: linear-gradient(90deg, transparent, #e8e0d0 20%, #e8e0d0 80%, transparent)`

### 21.7 Empty State Illustrations

Empty states use minimal line-art illustrations in the gold palette, not stock icons:

| State | Illustration | Message |
|-------|-------------|---------|
| No search results | Magnifying glass with dotted circle | "No results for '{query}'" |
| No filter results | Funnel with empty droplets | "No [dimension] match these filters" |
| No orders for period | Calendar with empty cells | "No orders for this period" |
| No contacts | Address book with empty page | "No contacts on file" |
| API error | Broken connection nodes | "Unable to load [section]" |

All illustrations: SVG, 48x48px, `stroke: #d4c5a9`, `stroke-width: 1.5`, `fill: none`. Centered above message text.

### 21.8 Selection Bar Polish

The multi-select bar at the bottom of the list deserves extra attention — it's the gateway to the consolidated view:

**Appearance:** `backdrop-filter: blur(8px)`, `bg: rgba(245,241,235,0.92)`, top border `1px solid #e8e0d0`
- The blur creates a frosted glass effect over the list items below
- Selected count: `13px/600`, `#2c2a26`

**"View Consolidated" button:**
- Dark bg `#2c2a26`, white text, `border-radius: 8px`, padding `8px 16px`
- On hover: `bg: #3d3a35`, subtle `scale(1.02)`
- On click: ripple effect from click point (300ms, gold at 20% opacity)

**Entry animation:** Slides up with `spring(1, 0.85, 0)`, slight overshoot that settles back.

### 21.9 Period Selector Polish

The pill-style period tabs are a distinctive UI element:

**Active tab transition:**
- White background pill slides horizontally from previous active to new active position
- Uses Framer Motion `layoutId` for shared layout animation
- Duration: 200ms, `spring(1, 0.9, 0)`
- The sliding pill is the only white element in the gray container — it acts like a spotlight

**"More" dropdown:**
- Opens on hover with 200ms delay (prevents accidental triggers)
- Dropdown appears with `opacity 0→1`, `y: -4→0`, `scale: 0.98→1`
- Dropdown shadow matches card shadow pattern
- Each year option: hover shows `bg: #faf8f4`
- Clicking a year: dropdown closes, new tab appears in main bar, "More" retracts

---

## 22. Design Handoff — Exact Measurements

All values extracted from the live mockup (`detail-layout-v5.html`) via computed styles. These are the **source of truth** for implementation. When the spec text and this section conflict, this section wins.

### 22.1 Layout Grid

| Element | Width | Height | Gap | Padding | Notes |
|---------|-------|--------|-----|---------|-------|
| **Page container** | `max-width: 1440px` | `100vh - 32px` | — | `16px` all sides | Centered, `bg: #f5f1eb` |
| **Main layout** (flex) | 1233px (content) | 744px | `16px` | `0` | `display: flex`, `align-items: stretch` |
| **Left panel** | `280px` fixed | 744px (stretch) | `10px` vertical | `0` | `flex-shrink: 0`, `display: flex`, `flex-direction: column` |
| **Right panel** | `flex: 1` (≈937px) | 744px (stretch) | `10px` vertical | `0 4px 0 0` | `overflow-y: auto`, 4px right padding for scrollbar |

### 22.2 Left Panel Components

| Component | Width | Height | Padding | Border-radius | Background | Shadow |
|-----------|-------|--------|---------|---------------|------------|--------|
| **Dimension toggles container** | 280px | 77px | `6px` | `14px` | `#ffffff` | `0 1px 3px rgba(0,0,0,0.04)` |
| **Dimension tab (active)** | flex | 31px | `8px 6px` | `10px` | `#2c2a26` | subtle inset |
| **Dimension tab (inactive)** | flex | 31px | `8px 6px` | `10px` | transparent | none |
| **Search box** | 280px | 36px | `10px 14px` | `12px` | `#ffffff` | `0 1px 3px rgba(0,0,0,0.04)` |
| **Filter button (active)** | ~145px | 36px | `10px 16px` | `10px` | `#2c2a26` | none |
| **Sort button** | ~135px | 36px | `10px 16px` | `10px` | `#f0ece5` | none |
| **List container** | 280px | flex (fills remaining) | `0` | `16px` | `#ffffff` | `0 1px 3px rgba(0,0,0,0.04)` |
| **List item (default)** | 265px | 68px | `12px 16px` | — | transparent | — |
| **List item (selected)** | 265px | 68px | `12px 16px 12px 13px` | — | `#f7f3ed` | — |
| **List item selected border** | 3px | full height | — | — | `#b8a88a` solid left | — |
| **"All Customers" row** | 265px | 56px | `12px 16px` | — | transparent | `2px solid #e8e0d0` bottom |
| **Selection bar** | 265px | 57px | `10px 16px` | — | `#f5f1eb` | `1px solid #e8e0d0` top |
| **"View Consolidated" btn** | 118px | 36px | `5px 12px` | `8px` | `#2c2a26` | none |

**Dimension toggle grid:** `display: grid`, `grid-template-columns: repeat(3, 1fr)`, `grid-template-rows: repeat(2, 1fr)`, gap `5px`.

**Filter/sort row:** `display: flex`, gap `8px`, both buttons `flex: 1`.

### 22.3 Right Panel — Header Bar

| Element | Value | Notes |
|---------|-------|-------|
| **Header card** | 929×67px, padding `14px 24px`, `border-radius: 16px` | `display: flex`, `justify-content: space-between`, `align-items: center` |
| **Entity name** | `20px/700`, `#1a1a1a` | `line-height: 1.3` |
| **Subtitle** | `11px/400`, `#999` | Separated by ` · ` (middle dot with spaces) |
| **Period selector container** | auto × 32px, padding `3px`, `border-radius: 10px` | `bg: #f5f1eb`, `display: flex`, gap `2px` |
| **Period tab (active)** | 53px × 26px, padding `6px 14px`, `border-radius: 8px` | `bg: #fff`, `color: #1a1a1a`, `fw: 600`, `shadow: 0 1px 3px rgba(0,0,0,0.08)` |
| **Period tab (inactive)** | 58px × 26px, padding `6px 14px`, `border-radius: 8px` | `bg: transparent`, `color: #888`, `fw: 500` |
| **Period tab "More"** | 72px × 26px | `color: #b8a88a`, includes caret `▾` |
| **Export button** | auto × 36px, padding `8px 16px`, `border-radius: 8px` | `bg: #f0ece5`, `color: #555`, `12px/500` |

### 22.4 Right Panel — KPI Section

| Element | Value | Notes |
|---------|-------|-------|
| **KPI section grid** | `grid-template-columns: 1fr 1fr`, gap `10px` | Two children: hero (left) + KPI grid (right) |
| **Hero card** | 460×281px, padding `16px 20px`, `border-radius: 16px` | `bg: #fff`, shadow `0 1px 3px rgba(0,0,0,0.04)` |
| **Hero label** | `11px/500`, `#888` | "Total Revenue (12 months)" |
| **Hero value** | `30px/800`, `#1a1a1a`, `letter-spacing: -1px` | `font-feature-settings: 'tnum'` |
| **Hero trend** | `12px/500`, green `#22c55e` or red `#ef4444` | "+12.4% vs previous year" |
| **Previous Year label** | `10px/400`, `#bbb` | Right-aligned |
| **Previous Year value** | `16px/600`, `#bbb` | Right-aligned |
| **Sub-items row** | `11px/400`, `#888` | "This Quarter: $68,400" etc. Values in `15px/600`, `#555` |
| **YoY bar chart** | Full-width, 120px height | SVG, see Section 20.1 |
| **KPI grid** | `grid-template-columns: 1fr 1fr`, `grid-template-rows: 1fr 1fr 1fr`, gap `8px` | 6 cards, stretches to match hero height |
| **KPI card** | 226×88px, padding `10px 14px`, `border-radius: 12px` | `bg: #fff`, shadow `0 1px 3px rgba(0,0,0,0.04)` |
| **KPI label** | `10px/500`, `#888`, `text-transform: uppercase`, `letter-spacing: 0.5px` | "ORDERS", "MARGIN", etc. |
| **KPI value** | `17px/700`, `#1a1a1a` | Tabular nums for counter animation |
| **KPI trend** | `10px/500`, green or red | "+4 this quarter", "-3% vs prev year" |
| **KPI sparkline** | 60×24px SVG, top-right of card | `stroke: #d4c5a9`, `stroke-width: 1.5` |

**Margin card special:** Shows two values — `18.4%` (17px/700) on first line, `$44,200` (13px/600, `#555`) on second line, then trend.

**Last Order card special:** Value `4 days` (17px/700), then `● Active buyer` (10px, green dot + text).

### 22.5 Right Panel — Charts Row

| Element | Value | Notes |
|---------|-------|-------|
| **Charts grid** | `grid-template-columns: 3fr 5fr`, gap `12px` | Product Mix (3fr) + Top 10 (5fr) |
| **Chart card (Product Mix)** | 364×269px, padding `16px 20px`, `border-radius: 16px` | `bg: #fff` |
| **Chart card (Top 10)** | 564×269px, padding `16px 20px`, `border-radius: 16px` | `bg: #fff` |
| **Chart title** | `14px/600`, `#1a1a1a` | "Product Mix", "Top 10 Best Sellers" |
| **Top 10 layout** | Two-column grid, `1px solid #f0ece5` vertical divider | #1–#5 left, #6–#10 right, 24px gap |
| **Top 10 item** | full-width, ~47px height, padding `7px 0` | Subtle `1px solid #f5f1eb` bottom border |
| **Rank badge** | 20×20px, `border-radius: 6px` | `bg: #b8a88a` + `color: #fff` (1–3), `bg: #f0ece5` + `color: #999` (4–10) |
| **Product name** | `13px/500`, `#1a1a1a` | Truncate with `...` if overflows |
| **SKU** | `10px/400`, `#bbb` | Below product name |
| **Dollar amount** | `14px/600`, `#1a1a1a` | Right-aligned |
| **Unit quantity** | `10px/400`, `#888` | Below dollar amount, right-aligned |

### 22.6 Right Panel — Tabs Section

| Element | Value | Notes |
|---------|-------|-------|
| **Tabs container** | 929×260px (min-height), `border-radius: 16px` | `bg: #fff`, `flex: 1` |
| **Tab bar** | `padding: 0 20px`, `border-bottom: 1px solid #f0ece5` | `display: flex`, gap `24px` |
| **Tab (inactive)** | `14px/500`, `color: #888`, padding `12px 0` | — |
| **Tab (active)** | `14px/700`, `color: #1a1a1a`, padding `12px 0` | `border-bottom: 2px solid #b8a88a`, offset -1px |
| **Tab count badge** | 18px diameter circle, `9px/600` | Active: `bg: #2c2a26`, `color: #fff`. Inactive: `bg: #f0ece5`, `color: #888` |
| **Table header row** | `11px/600`, `#888`, `text-transform: uppercase` | `padding: 12px 20px`, bottom border |
| **Table body row** | `13px/400`, `#1a1a1a`, `padding: 10px 20px` | Bottom border `1px solid #f5f1eb` |
| **Email links** | `13px/400`, `color: #b8a88a` | `text-decoration: none`, hover: underline |
| **Column widths (Contacts)** | Full Name: 25%, Position: 25%, Phone: 25%, Email: 25% | Even distribution |

### 22.7 Filter Panel

| Element | Value | Notes |
|---------|-------|-------|
| **Panel container** | 280px wide, max-height `280px`, `overflow-y: auto` | `bg: #fff`, `border-radius: 12px` |
| **"Where" label** | `12px/600`, `#b8a88a` | Top of panel, `padding: 12px 16px 8px` |
| **Condition card** | full-width, padding `8px 12px`, `border-radius: 8px` | `bg: #faf8f4` |
| **Field selector** | `13px/400`, `border-radius: 8px`, `bg: #fff`, `border: 1px solid #e8e0d0` | Dropdown with chevron |
| **Operator selector** | `12px/400`, `border-radius: 6px` | Same styling as field |
| **Value input** | `12px/400`, `border-radius: 6px`, `bg: #fff` | Text input or dropdown |
| **Remove button (×)** | 16px, `color: #bbb`, hover `color: #ef4444` | Top-right of condition card |
| **"AND" conjunction** | `11px/600`, `#b8a88a`, centered | Horizontal rules on both sides, `1px solid #e8e0d0` |

---

## 23. Content Specifications

### 23.1 Text Truncation Rules

| Element | Max chars | Truncation | Tooltip |
|---------|-----------|------------|---------|
| **Customer name (list)** | ~28 chars | `text-overflow: ellipsis` | Full name on hover |
| **Customer name (header)** | ~40 chars | Ellipsis | Full name tooltip |
| **Product name (Top 10)** | ~22 chars | Ellipsis | Full name tooltip |
| **SKU (Top 10)** | ~12 chars | Ellipsis | Full SKU tooltip |
| **Product name (Items tab)** | ~35 chars | Ellipsis | Full name tooltip |
| **Subtitle metadata** | ~80 chars | Ellipsis at end | Full subtitle tooltip |
| **Filter value** | ~15 chars | Ellipsis | Full value tooltip |
| **Tab label** | No truncation | — | Fixed labels: "Orders", "Items", "Contacts" |
| **Email (Contacts tab)** | ~30 chars | Ellipsis | Full email tooltip |

**Implementation:** Use `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` consistently. Never wrap entity names to multiple lines in the list or Top 10.

### 23.2 Character Limits & Overflow

| Data Point | Priority Max Length | Dashboard Handling |
|------------|--------------------|--------------------|
| Customer name (`CUSTDES`) | 48 chars | Truncate at container width |
| Product name (`PARTDES`) | 48 chars | Truncate at container width |
| SKU (`PARTNAME`) | 21 chars | Full display (fits in all contexts) |
| Zone name (`ZONEDES`) | 28 chars | Truncate in list meta line |
| Rep name (`AGENTDES`) | 28 chars | Truncate in subtitle |
| Position (`POSITIONDES`) | 30 chars | Truncate in table |
| Email (`EMAIL`) | 46 chars | Truncate in table, full in tooltip |
| Phone (`PHONENUM`) | 20 chars | Full display |

### 23.3 International Text & Long Strings

The dashboard serves French and English customer data. Plan for:

| Scenario | Example | Handling |
|----------|---------|----------|
| French accented chars | "Boulangerie Paul - Paris 5e" (28 chars) | UTF-8 throughout. No char stripping. |
| Long French names | "Établissements Gastronomiques du Sud-Ouest" (44 chars) | Truncation kicks in at container edge |
| Compound names | "Boulangerie Paul - Paris 11e" | Dash is part of the name, never strip |
| Phone formats | "+33 1 42 68 53 21" | Display as-is from Priority, no reformatting |
| Currency | Always USD (`$`), left of number | No locale switching needed |

### 23.4 Number Edge Cases

| Scenario | Value | Display |
|----------|-------|---------|
| Revenue = $0 | 0 | `$0` (not blank, not `$0.00`) |
| Revenue > $1M | 1234567 | `$1,234,567` (full), `$1.2M` (compact axis) |
| Revenue > $1B | 1234567890 | `$1,234,567,890` (full), `$1.2B` (compact axis) |
| Negative margin | -5.2 | `-5.2%` in red |
| Margin = 0% | 0 | `0.0%` |
| Frequency = 0 | 0 | `0.0/mo` |
| Percentage > 100% | 105.3 | `105.3%` (possible for YoY growth) |
| Orders = 1 | 1 | `1` (no "orders" suffix on KPI card) |
| Days = 0 | 0 | `Today` (special case, not "0 days") |
| Days = 1 | 1 | `1 day` (singular) |

### 23.5 Minimum & Maximum Content

| Component | Minimum | Maximum | Notes |
|-----------|---------|---------|-------|
| **Entity list** | 1 entity + "All" row | 500+ entities | Virtualize list beyond ~100 items (react-window) |
| **Multi-select** | 1 checkbox | All visible entities | No hard cap. Selection bar shows "N selected" |
| **Filter conditions** | 0 conditions | 10 conditions | Scroll within 280px max-height |
| **Orders table** | 0 rows (empty state) | 500+ rows | Paginate at 50 rows, "Load more" or virtual scroll |
| **Items accordion** | 1 category | 20+ categories | Each category: 1–100 products |
| **Contacts table** | 0 rows (empty state) | 20 contacts | No pagination needed |
| **Top 10** | 1 product (if only 1 sold) | Always 10 | If < 10 products: show all, relabel "Top N" |
| **Product Mix categories** | 1 segment | 7 segments max | Group 6+ into "Other" |
| **YoY chart months** | 1 month (Jan, for YTD in January) | 12 months | Empty months show no bars |
| **Period tabs** | 1 tab (YTD) | YTD + 5 years + "More" | "More" appears when > 3 historical years |

---

## 24. Component Inventory — Design Token References

Every component defined with token references instead of raw values. Tokens are defined in Section 2.

### 24.1 Token Definitions

**Spacing scale:**
| Token | Value | Usage |
|-------|-------|-------|
| `space-2xs` | `2px` | Inline gaps (badge margin) |
| `space-xs` | `4px` | Tight gaps (scrollbar padding, right panel padding-right) |
| `space-sm` | `6px` | Dimension container padding, toggle gap |
| `space-md` | `8px` | KPI grid gap, filter/sort row gap |
| `space-base` | `10px` | Section gaps (left panel, right panel, KPI card padding-top) |
| `space-lg` | `12px` | Charts row gap, list item padding-y, tab padding-y |
| `space-xl` | `14px` | KPI card padding-x, search padding-x, header padding-y |
| `space-2xl` | `16px` | Page padding, list item padding-x, hero card padding-y, layout gap |
| `space-3xl` | `20px` | Hero/chart card padding-x, tab bar padding-x |
| `space-4xl` | `24px` | Header padding-x, tab bar gap, Top 10 column gap |

**Border-radius scale:**
| Token | Value | Usage |
|-------|-------|-------|
| `radius-xs` | `2px` | Bar chart bar tops, progress bar |
| `radius-sm` | `4px` | Status badge |
| `radius-md` | `6px` | Rank badge, filter operator select |
| `radius-base` | `8px` | Period tabs, consolidated btn, condition card, filter field select |
| `radius-lg` | `10px` | Dimension tabs, period selector container, filter/sort buttons |
| `radius-xl` | `12px` | KPI cards, search box, filter panel |
| `radius-2xl` | `14px` | Dimension container |
| `radius-3xl` | `16px` | All major cards (hero, charts, tabs, list, header) |

**Shadow scale:**
| Token | Value | Usage |
|-------|-------|-------|
| `shadow-card` | `0 1px 3px rgba(0,0,0,0.04)` | All resting cards |
| `shadow-active` | `0 1px 3px rgba(0,0,0,0.08)` | Active period tab |
| `shadow-dropdown` | `0 4px 16px rgba(0,0,0,0.12)` | Sort dropdown, "More" dropdown |
| `shadow-glow` | `-2px 0 8px rgba(184,168,138,0.3)` | Active list item left border glow |

### 24.2 Component → Token Mapping

| Component | Background | Border-radius | Shadow | Padding | Font |
|-----------|-----------|---------------|--------|---------|------|
| **Page** | `bg-page` | — | — | `space-2xl` | — |
| **Dimension container** | `bg-card` | `radius-2xl` | `shadow-card` | `space-sm` | — |
| **Dim tab (active)** | `dark` | `radius-lg` | — | `space-md space-sm` | `12px/600 white` |
| **Dim tab (inactive)** | transparent | `radius-lg` | — | `space-md space-sm` | `12px/500 text-secondary` |
| **Search box** | `bg-card` | `radius-xl` | `shadow-card` | `space-base space-xl` | `13px/400 text-muted` |
| **Filter btn (active)** | `dark` | `radius-lg` | — | `space-base space-2xl` | `12px/600 white` |
| **Filter btn (inactive)** | `gold-subtle` | `radius-lg` | — | `space-base space-2xl` | `12px/500 text-primary` |
| **Sort btn** | `gold-subtle` | `radius-lg` | — | `space-base space-2xl` | `12px/500 text-primary` |
| **List container** | `bg-card` | `radius-3xl` | `shadow-card` | `0` | — |
| **List item** | transparent | — | — | `space-lg space-2xl` | Name: `13px/600`, Meta: `10px/400` |
| **List item (active)** | `#f0ebe3` | — | `shadow-glow` | `space-lg space-2xl space-lg 13px` | Same |
| **Selection bar** | `bg-page` | — | — | `space-base space-2xl` | `13px/600` |
| **Consolidated btn** | `dark` | `radius-base` | — | `5px space-lg` | `11px/500 white` |
| **Header bar** | `bg-card` | `radius-3xl` | `shadow-card` | `space-xl space-4xl` | Title: `20px/700`, Sub: `11px/400` |
| **Period tab (active)** | `bg-card` | `radius-base` | `shadow-active` | `6px space-xl` | `12px/600` |
| **Period tab (inactive)** | transparent | `radius-base` | — | `6px space-xl` | `12px/500 #888` |
| **Export btn** | `gold-subtle` | `radius-base` | — | `space-md space-2xl` | `12px/500 text-secondary` |
| **Hero card** | `bg-card` | `radius-3xl` | `shadow-card` | `space-2xl space-3xl` | See 22.4 |
| **KPI card** | `bg-card` | `radius-xl` | `shadow-card` | `space-base space-xl` | Label: `10px/500`, Value: `17px/700` |
| **Chart card** | `bg-card` | `radius-3xl` | `shadow-card` | `space-2xl space-3xl` | Title: `14px/600` |
| **Tabs container** | `bg-card` | `radius-3xl` | `shadow-card` | `0` | — |
| **Tab (active)** | — | — | — | `space-lg 0` | `14px/700`, `gold-primary` underline |
| **Tab (inactive)** | — | — | — | `space-lg 0` | `14px/500 #888` |
| **Count badge (active)** | `dark` | `50%` | — | `2px 5px` | `9px/600 white` |
| **Count badge (inactive)** | `gold-subtle` | `50%` | — | `2px 5px` | `9px/600 #888` |
| **Rank badge (1–3)** | `gold-primary` | `radius-md` | — | centered | `11px/700 white` |
| **Rank badge (4–10)** | `gold-subtle` | `radius-md` | — | centered | `11px/600 #999` |
| **Status badge** | `{color} 15%` | `radius-sm` | — | `2px space-md` | `10px/500 {color}` |
| **Filter condition** | `gold-hover` | `radius-base` | — | `space-md space-lg` | — |
| **AND conjunction** | — | — | — | — | `11px/600 gold-primary` |
| **Tooltip** | `dark` | `radius-base` | — | `space-md space-lg` | `12px/400 white` |

### 24.3 Scrollbar Tokens

| Property | Value |
|----------|-------|
| Width | `4px` |
| Thumb color | `gold-light` (`#d4c5a9`) |
| Track color | `gold-subtle` (`#f0ece5`) |
| Border-radius | `radius-xs` (`2px`) |
| Auto-hide delay | `1.5s` |

### 24.4 Focus Ring Token

All interactive elements:
```css
:focus-visible {
  outline: 2px solid #b8a88a;    /* gold-primary */
  outline-offset: 2px;
}
```

---

## 25. Developer Implementation Notes

### 25.1 CSS Custom Properties Setup

All tokens should be defined as CSS custom properties in the Tailwind v4 `@theme` block:

```css
@theme {
  /* Spacing */
  --spacing-2xs: 2px;
  --spacing-xs: 4px;
  --spacing-sm: 6px;
  --spacing-md: 8px;
  --spacing-base: 10px;
  --spacing-lg: 12px;
  --spacing-xl: 14px;
  --spacing-2xl: 16px;
  --spacing-3xl: 20px;
  --spacing-4xl: 24px;

  /* Colors */
  --color-bg-page: #f5f1eb;
  --color-bg-card: #ffffff;
  --color-gold-primary: #b8a88a;
  --color-gold-light: #d4c5a9;
  --color-gold-muted: #e8e0d0;
  --color-gold-subtle: #f0ece5;
  --color-gold-hover: #faf8f4;
  --color-dark: #2c2a26;
  --color-dark-hover: #3d3a35;
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #555555;
  --color-text-muted: #999999;
  --color-text-faint: #bbbbbb;
  --color-green: #22c55e;
  --color-red: #ef4444;
  --color-yellow: #eab308;
  --color-blue: #3b82f6;

  /* Border radius */
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-base: 8px;
  --radius-lg: 10px;
  --radius-xl: 12px;
  --radius-2xl: 14px;
  --radius-3xl: 16px;

  /* Shadows */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.04);
  --shadow-active: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-dropdown: 0 4px 16px rgba(0,0,0,0.12);
  --shadow-glow: -2px 0 8px rgba(184,168,138,0.3);
}
```

### 25.2 Why Decisions (for Developer Judgment Calls)

| Decision | Why |
|----------|-----|
| `280px` fixed left panel | Fits ~28 chars of customer name before truncation. Wider wastes detail space. Narrower truncates too aggressively. |
| `16px` gap between panels | Enough visual separation without wasting horizontal pixels in the iframe |
| Cards use `16px` radius | Rounded enough to feel modern/warm, not so round it feels toy-like. Matches the luxury/refined aesthetic. |
| KPI grid is 2×3 not 3×2 | Matches hero card height when both are in a 1fr/1fr grid. 3×2 would be too short. |
| Charts row is 3fr/5fr | Product Mix is visually lighter (donut), needs less width. Top 10 has two columns of data, needs more. |
| Period tabs are inside the header | Keeps the data-context (entity + time period) in one visual group. Separating them would split the "what am I looking at" context. |
| Filter panel max-height 280px | Shows ~3 conditions fully. More requires scroll. Prevents the filter from pushing the list below the fold. |
| Selection bar is sticky bottom | Always accessible when items are checked, even when scrolled deep in the list. Follows the Airtable/Notion pattern users know. |
| Gold palette (not blue/purple) | Differentiates from every SaaS dashboard. Conveys warmth and premium feel appropriate for a sales tool. Avoids the "default Tailwind" look. |
| System fonts (not custom) | Dashboard is embedded in Airtable iframe. Custom font loading adds latency and FOIT/FOUT risk. System fonts render instantly and match the host UI. |
| `font-feature-settings: 'tnum'` on numbers | Tabular numbers prevent layout shift during counter animations. Without this, `$240,200` → `$180,500` would cause the text to jitter. |

### 25.3 Airtable Embed Testing Checklist

Before shipping any visual change, verify in the actual Airtable Interface page:

- [ ] Dashboard fits within Omni block without horizontal scrollbar
- [ ] Vertical scroll works (no conflict with Airtable page scroll)
- [ ] No CORS errors in console (all API calls via Express proxy)
- [ ] Custom scrollbar renders (some iframe contexts strip `::-webkit-scrollbar`)
- [ ] Hover states work (some iframe contexts intercept pointer events)
- [ ] Keyboard navigation works (some iframe contexts trap Tab key)
- [ ] Font rendering is consistent (SF Pro on Mac, Segoe UI on Windows)
- [ ] No flash of unstyled content on load (critical path CSS)
- [ ] Export download triggers correctly (iframe download behavior varies)
