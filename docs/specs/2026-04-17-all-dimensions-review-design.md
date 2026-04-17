# All-Dimensions Review & Overhaul — Design Spec

**Date:** 2026-04-17
**Status:** Draft v2 — revised after Codex adversarial review
**Author:** Claude Code (paired with Victor Proust)

---

## Revision log

**v2 (2026-04-17)** — addresses Codex adversarial-review findings:
- **[HIGH]** §5.1 (prev-year fields): targeted the wrong producer. The per-customer modal reads `DashboardPayload.entities`, produced by `groupByDimension()` in `dimension-grouper.ts` + the per-dimension groupers in `dimension-grouper-items.ts` — NOT by `aggregateOrders()` in `data-aggregator.ts` (which produces the top-of-panel aggregate KPIs). Spec rewired to extend the correct producer.
- **[HIGH]** §5.5 (Product Family rename): original file map was incomplete. The `product_type` token appears in 22 files across URL parsing, Zod enums, scoping logic, cache keys, warm-cache seeders, and tests. Added explicit boundary enumeration.
- **[MEDIUM]** §4.5 (contacts grouping): only covered the consolidated/report path. Single-entity views (Zone/Vendor/Brand/Product Family/Product) render `ContactsTable.tsx` via `TabsSection.tsx` when `consolidatedMode === false`, so the main user-visible path would have been missed. Expanded to cover both render paths and the server-side `customerName` annotation for single-entity contacts.
- Added §8 test-first discipline per TDD: every behavior change listed here lists its failing-test first.

---

## 1. Context

This is a broad, mostly-refinement pass over every dimension of the Sales Dashboard (Customer / Zone / Vendor / Brand / Product Type / Product) plus two cross-cutting surfaces (Reports / Consolidated view, shared Contacts & Orders). The user walked through each dimension in one sitting and listed concrete issues — some cosmetic (hide a toggle, relabel a column), some structural (redefine Product Type semantics, redesign the KPI "Per Customer" modal, add prev-year enrichment to every metric).

The through-line is **trust in what the dashboard shows**: arrows that don't render, zones that vanish, vendor YoY that may or may not be correct, customer names that appear as em-dashes in Orders. Several asks are therefore *debug-first* rather than *design-first* — the spec has to acknowledge when the correct change is "verify live data, then decide."

### 1.1 Scope decisions already made (from brainstorm Q&A)

| Question | Decision |
|---|---|
| KPI modal prev-year columns — Revenue-only or all cards? | **All cards.** Add prev-year fields to every metric on `EntityListItem`. |
| Product Type → FAMILY_LOG rework — rename or keep label? | **Rename to "Product Family" throughout.** |
| Reports time-range tabs — which tabs? | **Orders tab only.** Default "Last 30 Days". |
| Contacts grouping — flat with subheaders, sticky column, or collapsible sections? | **Collapsible sections per customer.** |

### 1.2 Non-goals

- No backend API shape changes beyond adding prev-year fields and `customerName` enrichment.
- No new dimensions (Product Family *replaces* Product Type; no 7th dimension).
- No URL schema change for the Reports view (state stays in-memory via `useReport`).
- No change to the period-state backbone — the user only wants the UI *hidden*.

---

## 2. Goals & non-goals (feature-level)

**Goals**

1. Every small KPI card's "Per Customer" detail shows YTD value (with coloured trend arrow) + LY same-period + LY full-year.
2. Users can exit Reports / Consolidated view with a single click (no URL refresh).
3. Customer name is visible on every Order row in every non-Customer dimension view.
4. Contacts are grouped per customer on Zone / Vendor / Brand / Product Family / Product views, with expandable sections.
5. Left-panel search works on both entity name AND entity ID (customer ID, vendor code, SKU).
6. Product Family dimension replaces Product Type, sourced from `FAMILY_LOG` filtered to `FTCODE ∈ {01,02,03}`.
7. Product list excludes SKU '000'; sub-line shows country of origin instead of brand.
8. Zones list investigation: SF North / SF East appear, OR the root cause is documented.
9. Vendor prev-year data is verified end-to-end (and fixed only if broken).

**Non-goals**

- Deleting `PeriodSelector`; we *hide* it.
- Changing the overall master-detail layout or navigation paradigm.
- Migrating the period state out of the URL backbone.
- Adding a new 7th dimension.

---

## 3. Requirements matrix (user ask → spec section)

| User request | Spec section |
|---|---|
| Hide YTD/2026 toggle on all dimensions + reports | §4.1 |
| KPI small-card Per Customer: YTD + arrow / LY same-period / LY full | §4.2 + §5.1 (backend) |
| Same logic for all cards (orders, margin, etc.) | §5.1 |
| Reports view: easy exit | §4.3.1 |
| Reports view: customer name under Orders | §4.3.2 + §5.2 |
| Reports view: time tabs work + default Last 30 Days | §4.3.3 |
| Customer search by ID | §4.4 |
| Zones: SF North/East missing — why? | §5.3 |
| Zone: contacts grouped per customer | §4.5 |
| Zone: customer name on order main line | §4.6 |
| Vendor: previous-year data fetched correctly | §5.4 |
| Vendor: search by vendor ID | §4.4 |
| Vendor / Brand: contacts grouped per customer | §4.5 |
| Vendor / Brand: customer name on order main line | §4.6 |
| Product Type → FAMILY_LOG (FTCODE 01/02/03) | §5.5 |
| Products: filter SKU='000' | §5.6.1 |
| Products: search by SKU | §4.4 |
| Products: brand → country of origin on sub-line | §5.6.2 |

---

## 4. Frontend design

### 4.1 Hide period toggle

Remove the `<PeriodSelector />` render from both headers; leave the component file intact for future restoration.

- `client/src/components/right-panel/DetailHeader.tsx` — delete the JSX that renders `PeriodSelector` (currently around line 45). Keep the `activePeriod` prop in the signature — it still flows through to `KPISection` and `HeroRevenueCard` for labelling.
- `client/src/components/right-panel/ConsolidatedHeader.tsx` — same (around line 55).
- Verify `useDashboardShellState` defaults `activePeriod` to `'YTD'` so the state stays predictable with no UI to change it.

No design decisions beyond this. One-line rationale comment at the removal site: `// Period selector hidden 2026-04-17 — reintroduce when multi-year comparison returns.`

### 4.2 KPI "Per Customer" modal redesign

**New table** (`PerCustomerKPITable.tsx`):

| Customer | YTD `↑/↓` | LY same period | LY full year |
|---|---:|---:|---:|

- Column 2 shows the current-period value with an inline colored arrow:
  - Green ▲ if `ytd > prevSamePeriod`
  - Red ▼ if `ytd < prevSamePeriod`
  - Muted em-dash if `prevSamePeriod` is null (new customer)
- Column 3 shows `prevSamePeriod` value, muted text.
- Column 4 shows `prevFull` (previous calendar year total), muted text.
- Sort default: `ytd desc` (matches current default).
- Sortable on all four columns.

**New shared component** `client/src/components/shared/TrendArrow.tsx`:

```tsx
interface TrendArrowProps { current: number | null; prev: number | null; inverted?: boolean; }
// WHY inverted: for "time to next order" style metrics where lower = better.
```

Used by the modal table, and available to other places (HeroRevenueCard, future sparklines).

**Modal wiring** (`kpi-modal-content.tsx`, `KPISection.tsx`):
- Every card's `perCustomer` config gains two new callbacks:
  - `getPrevPeriodValue: (e: EntityListItem) => number | null`
  - `getPrevFullValue: (e: EntityListItem) => number | null`
- Concrete mappings:
  | Card | getValue | getPrevPeriodValue | getPrevFullValue |
  |---|---|---|---|
  | Revenue | `e.revenue` | `e.prevYearRevenue` | `e.prevYearRevenueFull` |
  | Orders | `e.orderCount` | `e.prevYearOrderCount` | `e.prevYearOrderCountFull` |
  | Avg Order | `e.avgOrder` | `e.prevYearAvgOrder` | `e.prevYearAvgOrderFull` |
  | Margin % | `e.marginPercent` | `e.prevYearMarginPercent` | `e.prevYearMarginPercentFull` |
  | Margin $ | `e.marginAmount` | `e.prevYearMarginAmount` | `e.prevYearMarginAmountFull` |
  | Frequency | `e.frequency` | `e.prevYearFrequency` | `e.prevYearFrequencyFull` |

**Bug fix (literal `\u2014`):** the screenshot shows the YoY column rendering the literal string `\u2014` instead of an em-dash. PerCustomerKPITable source does render the real em-dash (`'\u2014'` evaluated to `"—"`). The bug is upstream — something in the consolidated response pipeline is double-encoding the escape. Investigation:
- Grep for `"\\\\u2014"` and `"\\u2014"` in `server/` and `client/` source.
- If clean, trace a live response to find where the raw string appears.
- Fix at the source, not in the renderer.

**Aggregated vs Per-Customer toggle** (`PerCustomerToggle.tsx`): unchanged.

### 4.3 Reports / Consolidated view

#### 4.3.1 Exit button

`useReport` already has a `close()` transition. The pain is simply the missing button.

- `ConsolidatedHeader.tsx` gains a close icon button on the right, styled as a secondary/ghost button with an X glyph.
- On click: call `report.close()` AND clear the entity selection (so we return to the classic single-entity layout, not a blank consolidated frame with no data).
- Wire from `DashboardLayout.tsx` where `useReport` is instantiated (line 43 area) down through props to `ConsolidatedHeader`.
- Keyboard: Escape also triggers close (standard modal/overlay affordance).

#### 4.3.2 Customer name under Orders — debug

The UI already renders `o.customerName ?? '\u2014'` at `ConsolidatedOrdersTable.tsx:62`. If the em-dash is showing, the server isn't populating the field.

- Inspect the consolidated payload returned by `server/src/routes/fetch-all.ts`. Expected: every `OrderRow` has `customerName` populated when returned in consolidated mode.
- Likely fix: enrich inside `fetch-all.ts` using the cached customers lookup (build `Map<CUSTNAME, CUSTDES>` once, annotate every order row). This is a 5-line change if absent.
- No UI change required — just data.

#### 4.3.3 Time-range tabs on Reports Orders tab

Classic Orders tab (`OrdersTab.tsx:17-19`) has `useState<OrderTimeFilter | null>('last30')` driving a tabs-row (Last 30 Days, 3 Months, 6 Months, 12 Months, All). Reports has no equivalent.

- Build a `ConsolidatedOrdersTab.tsx` wrapper (or extend the existing consolidated Orders rendering surface) that:
  - Owns the same `OrderTimeFilter` state, defaulted to `'last30'`.
  - Renders the same time-filter tabs component (extract from `OrdersTab.tsx` if inline; otherwise reuse directly).
  - Filters `OrderRow[]` client-side by `date` before passing to `ConsolidatedOrdersTable`.
- No server change — all order rows are already in the consolidated payload; filter is display-only.
- Other tabs (Contacts, Products, Items) do NOT get time filters (per user decision).

### 4.4 Search by ID across dimensions

One-file change in `client/src/utils/search.ts`:

```ts
export function searchEntities(entities: EntityListItem[], query: string): EntityListItem[] {
  if (!query.trim()) return entities;
  const q = query.trim().toLowerCase();
  // WHY match on id too: IDs are meaningful to users. Customer IDs (C7826),
  // vendor codes, and SKUs are frequently the fastest way to locate a row.
  return entities.filter(
    (e) => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q),
  );
}
```

This one change satisfies the Customer / Vendor / Product search-by-ID asks in a single place. No dimension-aware routing needed — matching on both fields is always safe: IDs rarely collide with name substrings, and if they do, the user sees both matches.

### 4.5 Contacts — collapsible sections per customer

**Scope correction (v2):** applies to every non-Customer view in BOTH single-entity mode (Zone / Vendor / Brand / Product Family / Product) AND consolidated/report mode. `TabsSection.tsx:131-132` routes to `ConsolidatedContactsTable` when `consolidatedMode === true`, else `ContactsTable` — so the single-entity path is the main user-visible surface for Zone/Vendor/Brand, not the consolidated path.

**Rendering strategy — introduce one shared grouped component:**

Create `client/src/components/right-panel/GroupedContactsTable.tsx` and have `TabsSection.tsx` select it whenever contacts carry `customerName`, regardless of `consolidatedMode`:

```tsx
// TabsSection.tsx routing (new)
const hasCustomerName = contacts.length > 0 && contacts.every(c => !!c.customerName);
return hasCustomerName
  ? <GroupedContactsTable contacts={contacts} />
  : <ContactsTable contacts={contacts} />;
```

- Customer-dimension single-entity view: contacts carry no `customerName` (all contacts belong to the selected customer), so the data check falls through to the flat `ContactsTable`. Grouping is meaningless with one customer — this preserves existing behavior.
- Zone / Vendor / Brand / Product Family / Product in EITHER mode: every contact has `customerName`, grouping kicks in.

**Server-side prerequisite:** the single-entity contacts route must also annotate `customerName` on every row for non-customer dimensions. Today, `server/src/routes/contacts.ts` already does this on the multi-customer path (lines 99-113 per Codex #4). Verify single-entity Zone/Vendor/Brand requests hit the multi-customer code path and that the `customerName` field is NOT stripped before serialization. If it is, fix the route.

**Visual layout (GroupedContactsTable):**

```
┌──────────────────────────────────────────────────┐
│ ▼ Acme Foods           5 contacts                │  ← sticky section header, clickable
├──────────────────────────────────────────────────┤
│   Jane Doe · jane@acme.com · AP                  │
│   ...                                            │
├──────────────────────────────────────────────────┤
│ ▶ Beta Distributors    3 contacts                │  ← collapsed
└──────────────────────────────────────────────────┘
```

- Group by `contact.customerName`.
- Expand state: `useState<Set<string>>` keyed by customer name. Default: all collapsed.
- Accessibility: section header is a `<button>` with `aria-expanded`, `aria-controls` pointing to the group's `<ul id>`. Each contact row is an `<li>` inside the per-section `<ul>`.
- Animation: Framer Motion `AnimatePresence` height animation (respects the existing app-level `<MotionConfig reducedMotion="user">`).
- In-group sorting: keep existing sort options (name / email / role) scoped inside each group.
- `ConsolidatedContactsTable.tsx` becomes dead code after this change — delete it in the same commit to avoid drift.
- `ContactsTable.tsx` stays for the Customer-dimension fall-through case.

### 4.6 Orders card — customerName on main line

Applies to every non-Customer single-entity view AND the consolidated view.

- **Consolidated** (`ConsolidatedOrdersTable.tsx`): reorder columns so Customer sits between Order # and Items: current `Date | Customer | Order # | Items | Amount | Margin % | Status` → new `Date | Order # | Customer | Items | Amount | Margin % | Status`.
- **Single-entity** (`OrdersTable.tsx`): add a `Customer` column/cell between Order # and Items. Render only when `props.includeCustomer === true`.
- Caller (`OrdersTab.tsx`) passes `includeCustomer={dimension !== 'customer'}`.
- Data: requires server-side enrichment of `customerName` on single-entity order responses for non-customer dimensions. See §5.2.

---

## 5. Backend design

### 5.1 Prev-year fields for every metric

**Shared type extension** (`shared/types/dashboard.ts`):

```ts
export interface EntityListItem {
  // ... existing fields ...
  revenue: number | null;
  prevYearRevenue: number | null;       // existing
  prevYearRevenueFull: number | null;   // existing

  orderCount: number | null;
  prevYearOrderCount: number | null;        // NEW
  prevYearOrderCountFull: number | null;    // NEW

  avgOrder: number | null;
  prevYearAvgOrder: number | null;          // NEW
  prevYearAvgOrderFull: number | null;      // NEW

  marginPercent: number | null;
  prevYearMarginPercent: number | null;     // NEW
  prevYearMarginPercentFull: number | null; // NEW

  marginAmount: number | null;
  prevYearMarginAmount: number | null;      // NEW
  prevYearMarginAmountFull: number | null;  // NEW

  frequency: number | null;
  prevYearFrequency: number | null;         // NEW
  prevYearFrequencyFull: number | null;     // NEW
}
```

**Producer correction (v2):** the per-customer modal reads `DashboardPayload.entities`, and those rows are built by `groupByDimension()` in `server/src/services/dimension-grouper.ts` (customer + zone paths, line 70) and the per-dimension groupers in `server/src/services/dimension-grouper-items.ts` (vendor line 35, brand line 67, product_type line 99, product line 133). That's the producer we extend — NOT `data-aggregator.ts`, which produces the top-of-panel aggregate KPIs shown in `KPISection` and has no path into the per-customer table.

**Where prev-year for revenue lives today (for reference):**
- `dimension-grouper.ts` already exports `PrevYearTotals` and computes `prevYearRevenue` + `prevYearRevenueFull` per entity from a separate prev-year window. Extend the SAME computation to carry the other 5 metrics.

**Extension plan:**

1. Generalize `PrevYearTotals` in `dimension-grouper.ts`:
   ```ts
   // WHY one record per entity, not one per metric:
   // the grouper already walks items per entity — a single aggregation pass
   // per window yields all metrics. Six separate passes would be 6x slower.
   export interface PrevYearMetrics {
     revenue: number | null;
     orderCount: number | null;
     avgOrder: number | null;
     marginPercent: number | null;
     marginAmount: number | null;
     frequency: number | null;
   }
   export type PrevYearTotals = Map<string, { samePeriod: PrevYearMetrics; full: PrevYearMetrics }>;
   ```

2. Extract a shared `computeMetrics(items: RawOrderItem[]): PrevYearMetrics` helper (same file). Call it from the current-window aggregation AND from both prev-year windows (same-period and full-year). No per-metric duplication.

3. Every `groupBy*` function in `dimension-grouper-items.ts` (and the customer/zone branches in `dimension-grouper.ts`) receives the generalized `PrevYearTotals`, looks up the entity's samePeriod + full buckets, and spreads them into `EntityListItem`.

4. Tests (new files in `server/src/services/__tests__/`):
   - `dimension-grouper-prev-year.test.ts` — one fixture customer with known current + prev-same + prev-full data; assert all 18 numeric fields on the output `EntityListItem`. This is the RED test before any code change.
   - Per-dimension coverage: tests for `groupByVendor`, `groupByBrand`, `groupByProductFamily`, `groupByProduct` asserting each returns prev-year fields populated.

5. File-size guard: `dimension-grouper.ts` is already non-trivial. If extending pushes it past 300 LOC, split per-metric computation into `prev-year-metrics.ts` (pure function) and keep `dimension-grouper.ts` as orchestration.

**Explicit non-scope (v2 clarification):** `data-aggregator.ts` changes are NOT in this spec. The aggregate-KPI top-of-panel cards may also benefit from prev-year fields in a follow-up, but the per-customer modal work is complete once `EntityListItem` rows carry the 18 fields.

### 5.2 `customerName` enrichment on all order responses

Currently `customerName` is only populated on `OrderRow` in consolidated mode. Extend to single-entity mode for non-customer dimensions.

- `server/src/routes/orders.ts` (or wherever single-entity Orders is served): after resolving the filtered `OrderRow[]`, enrich using the cached customers map: `orders.map(o => ({ ...o, customerName: custMap.get(o.custname) ?? null }))`.
- This belongs on the server, not the client — the client should not need to know about the customer lookup; one concern per layer.
- The cached customers fetcher already exists (used by consolidated path); reuse it. Don't refetch.

### 5.3 Zone investigation — SF North / SF East

Two cheap diagnostic queries before touching code:

1. `GET DISTRLINES?$filter=contains(ZONEDES,'SF')&$select=DISTRLINECODE,DISTRLINEDES,ZONECODE,ZONEDES&$top=50` — confirm whether SF North/East rows exist at all.
2. If they exist, `GET DISTRLINES?$filter=ZONECODE eq '<actual code>'` with ALL selectable fields to see inactive flags.

Branch:

- **They don't exist in Priority** → escalate to user. Not a dashboard bug.
- **They exist with an `INACTIVE='Y'` (or similar) flag** → add filter to `fetchZones()` in `server/src/services/priority-queries.ts`. Document the flag field name.
- **They exist but get filtered out in app code** → debug `entity-list-builder.ts:61-83`:
  - The dedup on `ZONECODE` (lines 68-71) could collapse them if both have the same zone code with different DISTRLINE descriptions.
  - The orders-join could filter them if the zone list is inner-joined to orders. (Spec is currently "master-data only" — verify that comment matches behavior.)

Findings go in a new learning file: `learnings/zones-fetch-investigation.md`.

### 5.4 Vendor prev-year verification

No speculative code change. Steps:

1. Hit `/api/sales/entities?dimension=vendor` and snapshot the JSON. Confirm `prevYearRevenue` and `prevYearRevenueFull` populate for vendors active last year.
2. If null for a vendor that clearly had prior-year activity: inspect the prev-year grouper at `dimension-grouper.ts:50` (`item.Y_1159_5_ESH`). Check:
   - Is `Y_1159_5_ESH` populated on prev-year order items? (Compare raw Priority rows.)
   - Does the date window used for prev-year match the current-year window? (Off-by-one year windowing is the classic bug.)
3. Fix whatever the actual bug is — or document "verified correct" if nothing is broken.

### 5.5 Product Type → Product Family rework

This is the most structural change. Two parts: data redefinition and frontend rename.

#### 5.5.1 Data redefinition

**New master fetch** (`server/src/services/priority-queries.ts`):

```ts
// Replaces fetchProductTypes. Sources FAMILY_LOG filtered to the 3 family
// types that matter (Culinary=01, Pastry=02, Beverages=03). FAMILYDESC is
// the display name ("Beverages", "Charcuterie", "Chocolate & Praline", ...).
export async function fetchProductFamilies(
  client: PriorityClient,
  signal?: AbortSignal,
): Promise<RawFamily[]> {
  return client.fetchAllPages<RawFamily>('FAMILY_LOG', {
    select: 'FAMILYNAME,FAMILYDESC,FTCODE,FTNAME',
    filter: "FTCODE eq '01' or FTCODE eq '02' or FTCODE eq '03'",
    orderby: 'FAMILYDESC asc',
    signal,
  });
}
```

**New shared type:**
```ts
export interface RawFamily {
  FAMILYNAME: string;  // the family code (e.g., "111", "112") — the ID
  FAMILYDESC: string;  // the display name (e.g., "Beverages", "Charcuterie")
  FTCODE: string;      // "01" | "02" | "03"
  FTNAME: string;      // "Culinary" | "Pastry" | "Beverages"
}
```

**Aggregation key change** (`server/src/services/dimension-grouper-items.ts`): `groupByProductType` → `groupByProductFamily`. Group key becomes the family code (`FAMILYNAME`), resolved per order-item via the LOGPART map we already build (LOGPART has `FAMILYNAME`; order items reference LOGPART via `PARTNAME`).

- Implementation detail to resolve at build time: confirm whether `ORDERITEMS` carries a direct family field. If yes, use it (avoids a join). If not, look up `FAMILYNAME` through the LOGPART map passed into the grouper. The LOGPART map already exists in `entity-list-builder.ts`.

**Entity list builder** (`entity-list-builder.ts`): a new branch for `product_family` that uses `fetchProductFamilies` + the family grouper.

#### 5.5.2 Contract-boundary enumeration (v2 — addresses Codex finding)

The original v1 spec treated this as "bulk rename in `client/src/`". It is not. The `product_type` token appears in **22 files** spanning URL parsing, server-side Zod enums, cache keys, warm-cache seeders, scoping logic, and tests. Every one is a runtime contract that rejects or silently drops the new value if not migrated.

**Server Zod enums (MUST update — hard gate):**
- `server/src/routes/entities.ts` — dimension enum validates `?dimension=product_type` requests
- `server/src/routes/dashboard.ts` — same
- `server/src/routes/fetch-all.ts` — same; affects Reports / Consolidated view
- `server/src/routes/contacts.ts` — same; affects contacts grouping on the new dimension

**Server scoping / filtering:**
- `server/src/services/entity-subset-filter.ts` — dimension-specific filter branches
- `server/src/services/dimension-grouper.ts` — `groupByDimension()` router
- `server/src/services/dimension-grouper-items.ts` — `groupByProductType` → `groupByProductFamily` (function rename + key change)
- `server/src/services/entity-list-builder.ts` — existing `product_type` branch

**Server cache & warm-cache (silent-drift hazard):**
- `server/src/cache/cache-keys.ts` — cache key format includes the dimension
- `server/src/config/constants.ts` — dimension list constants
- `server/src/services/warm-cache.ts` — loops over dimensions at boot; missing `product_family` = empty cache forever

**Server tests:**
- `server/src/services/__tests__/entity-subset-filter.test.ts`
- `server/src/routes/__tests__/fetch-all.test.ts`
- `server/src/cache/__tests__/cache-keys.test.ts`
- `server/tests/services/entity-filter.test.ts`

**Shared types:**
- `shared/types/dashboard.ts` — `Dimension` union (`'product_type'` → `'product_family'`)

**Client contracts:**
- `client/src/hooks/shell-state-url.ts` — URL param validator; rejects unknown dimensions
- `client/src/utils/dimension-config.ts` — labels, icons, metadata per dimension
- `client/src/utils/filter-types.ts` — dimension enum
- `client/src/hooks/useContacts.ts` — dimension-branched route picker
- `client/src/components/left-panel/DimensionToggles.tsx` — the tab strip users click

**Client UI (mentions only — no runtime gate):**
- `client/src/components/shared/ReportFilterModal.tsx` — label and filter logic

**Order of operations (critical — avoid a broken intermediate state):**

1. Add `product_family` as a **valid alias** first (Zod enums accept BOTH `'product_type'` and `'product_family'`; cache keys read both; warm-cache populates under the new name).
2. Migrate call sites to emit `product_family`.
3. Deploy the URL shim (§5.5.3) so stale URLs redirect.
4. Remove `product_type` acceptance from Zod enums + constants.
5. Remove the shim after a telemetry window (1–2 months).

This keeps old Airtable embeds and open tabs working during the transition.

#### 5.5.3 URL backward-compat shim

A one-time redirect at app init:

```ts
// WHY: existing bookmarks / Airtable embed links may still use ?dimension=product_type.
// Redirect once on app load so they continue to work.
if (url.searchParams.get('dimension') === 'product_type') {
  url.searchParams.set('dimension', 'product_family');
  window.history.replaceState(null, '', url.toString());
}
```

Placed in the dashboard shell's init effect (`useDashboardShellState` or equivalent). Remove after 1–2 months if no telemetry hits it.

#### 5.5.4 Tests & cache keys

**Regression tests (must all still pass after migration):**
- `server/src/services/__tests__/entity-subset-filter.test.ts` — extend with a `product_family` case
- `server/src/routes/__tests__/fetch-all.test.ts` — verify `?dimension=product_family` is accepted
- `server/src/cache/__tests__/cache-keys.test.ts` — verify the new key format
- `server/tests/services/entity-filter.test.ts` — update dimension fixtures

**New tests (RED-first — write before implementing):**
- `server/src/services/__tests__/product-family-aggregation.test.ts` — only `FTCODE ∈ {01,02,03}` families appear; grouping key is `FAMILYNAME`; ~20 bucket count sanity assertion.
- `client/src/hooks/__tests__/shell-state-url.test.ts` — new URL with `?dimension=product_family` parses correctly; legacy `?dimension=product_type` is redirected.

**Cache-key migration:** `dashboard:product_type:*` keys will expire via TTL. No active migration. During the alias window, warm-cache writes to `dashboard:product_family:*`; the legacy keys age out naturally.

### 5.6 Products dimension

#### 5.6.1 Filter SKU '000'

Server-side, extend the existing filter in `fetchProducts()`:

```ts
filter: "STATDES eq 'In Use' and PARTNAME ne '000'"
```

Rationale: catching it server-side guarantees it's gone everywhere, including any consumer we add later. One line.

#### 5.6.2 Country of origin on sub-line

**Verification first** (critical — we hit the `Y_9952_5_ESH` trap recently):

Live-query: `LOGPART?$select=PARTNAME,Y_5380_5_ESH&$filter=STATDES eq 'In Use'&$top=5`.

- **200 OK with values** → safe to proceed.
- **400** → the field isn't queryable on LOGPART; fall back to a SPEC slot. Inspect `tools/Priority ERP March 30.xml` for LOGPART properties describing country (SPEC1–SPEC16 are strings; one likely holds country). Update the live query and the spec before committing.

**If `Y_5380_5_ESH` works:**
- `RawProduct` in `shared/types/dashboard.ts`: add `Y_5380_5_ESH: string | null; // country of origin`.
- `fetchProducts()`: extend `$select` to include `Y_5380_5_ESH`.
- Grouper change (`dimension-grouper-items.ts:~154`): the product card's `meta1` assembly currently joins SKU with brand (`item.Y_9952_5_ESH`). Replace brand with country resolved via the LOGPART map (not the order-item field, which is still there but we want the canonical LOGPART value).
  - New `meta1`: `[sku, country].filter(Boolean).join(' · ')`
- New learning note: `learnings/logpart-country-of-origin-field.md`, same pattern as the recent SPEC4 learning.

---

## 6. Data flow summary

```
Priority oData  ──►  server fetchers  ──►  dimension-grouper (prev-year × 6 metrics per entity)
                          │                         │
                          ▼                         ▼
                   Redis cache                 EntityListItem
                                                    │
                                                    ▼
                                               GET /api/sales/entities
                                                    │
                                                    ▼
                                        useDashboardState (client)
                                                    │
                                    ┌───────────────┴──────────────┐
                                    ▼                              ▼
                              Left panel                      Right panel
                              (list + search by              (KPI modal w/
                              name AND id)                    4-col prev-year table)
```

No architectural shift — this is an enrichment pass, not a rewrite.

---

## 7. Build order (dependency-aware)

1. **Live diagnostics** — Zone fetch (§5.3 step 1), `Y_5380_5_ESH` query (§5.6.2). 5 minutes. Resolve before writing code.
2. **§5.1** — prev-year backend enrichment. Unlocks §4.2.
3. **§4.1** — hide period toggle (trivial).
4. **§4.4** — search by ID (one file).
5. **§5.6** — products: SKU filter + country swap.
6. **§5.2 + §4.6** — customerName enrichment + Orders column reorder.
7. **§4.5** — contacts grouping.
8. **§4.3** — Reports: exit button + time-range tabs.
9. **§4.2** — KPI modal redesign.
10. **§5.5** — Product Family rework (largest blast radius — do last, alone). Ship in the alias-first order from §5.5.2: (a) accept both tokens, (b) migrate callers, (c) land URL shim, (d) drop legacy acceptance, (e) remove shim after telemetry window.
11. **§5.4** — vendor prev-year verification (may be a no-op).

Each step is one commit (or a small series if backend + frontend must move together).

---

## 8. Testing & verification

### 8.1 TDD discipline (v2)

Every behavior change in this spec is implemented RED-first: write the failing test, verify it fails for the expected reason (feature missing, not typo), write the minimal code to pass, re-run. No production code without a failing test first — per the superpowers:test-driven-development skill loaded during brainstorm.

**What that looks like concretely per change:**
- §5.1 prev-year fields → RED test in `dimension-grouper-prev-year.test.ts` asserts all 18 fields on an `EntityListItem` before any grouper change.
- §4.5 contacts grouping → RED test for `TabsSection` routing: contacts with `customerName` → `GroupedContactsTable`; without → `ContactsTable`.
- §4.6 `customerName` enrichment → RED test on the server route: single-entity Zone/Vendor/Brand orders response has `customerName` populated per row.
- §3.1 search by ID → RED test `search.test.ts`: `searchEntities([...], 'C78')` matches a row with `id='C7826', name='Altamira Foods'`.
- §5.5 Product Family alias path → RED test on the Zod enum accepting BOTH `'product_type'` and `'product_family'` during transition; test rejecting `'product_type'` after removal.

### 8.2 Test pyramid (per engineering:testing-strategy)

```
             ┌────────┐   Manual smoke + Airtable iframe checks (§8.5)
             │  E2E   │   Few; expensive; high-confidence
             ├────────┤
             │  Int.  │   Route tests (fetch-all, contacts, orders); cache-key roundtrip
             ├────────┤
             │  Unit  │   Groupers, search util, filter helpers, aggregation math
             └────────┘   Majority — fast, focused, many cases
```

**Unit (Vitest — `server/src/**/__tests__/` and `client/src/**/__tests__/`):**
- `dimension-grouper-prev-year.test.ts` — NEW. Per-entity fixture covering all 6 metrics × 3 windows (current, prev-same-period, prev-full). 18 assertions per fixture.
- `product-family-aggregation.test.ts` — NEW. FAMILY_LOG fixture with FTCODE ∈ {01,02,03} and others; asserts only the matching three appear; grouping key is `FAMILYNAME`.
- `search.test.ts` — NEW. `searchEntities` matches on id and name; case-insensitive; empty query returns all; no false positives on overlapping substrings.
- `grouped-contacts-routing.test.tsx` — NEW. Render `TabsSection` with mixed contact shapes; assert the correct table component is chosen.
- `shell-state-url.test.ts` — NEW. `product_family` parses; legacy `product_type` redirects once.

**Integration (Vitest with `vi.mock` boundary — `server/src/routes/__tests__/`):**
- `fetch-all.test.ts` — extend: `?dimension=product_family` accepted; legacy `product_type` accepted during the alias window.
- `contacts.test.ts` — existing Codex #4 tests still pass; add assertion that single-entity Zone/Vendor/Brand responses carry `customerName`.
- `orders.test.ts` — NEW or extend: single-entity non-customer dimension responses include `customerName` on each `OrderRow`.
- `cache-keys.test.ts` — extend: new `product_family` keys format; collision impossible with legacy `product_type` keys.

**Manual / E2E (Airtable Omni embed):** §8.5.

### 8.3 Existing test regression surface

These tests currently pass and MUST still pass (see per-file diffs in §5.5.2):
- `server/src/services/__tests__/entity-subset-filter.test.ts`
- `server/src/routes/__tests__/fetch-all.test.ts`
- `server/src/cache/__tests__/cache-keys.test.ts`
- `server/tests/services/entity-filter.test.ts`
- `server/src/routes/__tests__/contacts.test.ts`
- `server/src/services/__tests__/data-aggregator.test.ts`

### 8.4 Pre-deploy gate (CLAUDE.md)

```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
cd ../server && npx vitest run
cd ../client && npx vite build     # < 500 KB gzip
```

Plus:
```bash
grep -rn ": any\|as any" server/src/ client/src/    # must be empty
```
No files > 300 LOC.

### 8.5 Manual smoke (local + Airtable embed)

Test customer: **C7826**.

- [ ] No period toggle visible in classic or consolidated header.
- [ ] Click each small KPI card on C7826 → Per Customer tab → 4 columns, coloured arrows render (green/red/em-dash).
- [ ] Reports view entry via ReportButton → close via new X button → classic view restored.
- [ ] Reports Orders tab: time tabs visible, defaults to Last 30 Days, filters apply.
- [ ] Consolidated Orders + every single-entity Orders tab (non-Customer dim): customer name visible between Order # and Items.
- [ ] Contacts tab on Zone / Vendor / Brand: section headers per customer, click expands, rows render inside.
- [ ] Left-panel search: `C78` matches C7826 (Customer); SKU prefix matches Products; vendor code matches Vendor.
- [ ] Products list: no SKU '000'; sub-line shows country, not brand.
- [ ] Left panel Product Family: ~20 entries (Beverages, Charcuterie, Glaze & Inclusion, Chocolate & Praline, Filling & Decor, Cheeses, Salt & Spices, Olives & Vegetables, Truffles & Mushrooms, Oils & Vinegars, Honey & Sweet, Technical Ingredients, ...).
- [ ] Zones: SF North + SF East visible — OR the investigation outcome documented.
- [ ] Vendors: prev-year revenue non-null for a vendor active last year.
- [ ] Legacy URL `?dimension=product_type` auto-rewrites to `?dimension=product_family`.

### 8.6 Post-deploy

- Railway log tail: `[warm-cache] Done.` on boot.
- Upstash: `dashboard:product_family:all` key materialized.
- Airtable Omni embed — verify iframe doesn't surface different behavior.

---

## 9. Risks & open questions

| Risk | Mitigation |
|---|---|
| `Y_5380_5_ESH` might 400 on LOGPART (like `Y_9952_5_ESH` did) | Live-query before committing (§5.6 diagnostic). Fall back to SPEC slot. |
| Prev-year margin calculation semantics — average of averages? | Resolve at implementation: pass pre-aggregated values into the grouper, not raw items. Document in the aggregator comment. |
| "Zero-order" zones being filtered out in the orders-join could hide SF North/East | Add to §5.3 diagnostic — check whether the zones list is master-only or orders-scoped. |
| Large product family list (~20 entries) might break the UI assumption of 3-6 buckets in `ProductMixCarousel` | Validate carousel works with 20 bars; if too dense, truncate to top-10 + "Other" (user decision needed). |
| Rename blast radius — missed references to `product_type` | grep-before-commit for literal `product_type` and `"Product Type"` strings. The URL shim catches at least the saved-link case. |
| Bulk rename interacts with Redis cache keys | Old `dashboard:product_type:*` keys expire via TTL; no explicit migration. Document in the cache-key learning note. |

**Open questions (need user confirmation before implementation):**
- None blocking. The four clarifying decisions are already captured in §1.1.
- Implementation-time decisions (SPEC fallback for country, margin aggregation semantics, carousel handling of 20 families) are scoped inside the relevant sections; they don't require spec-level approval.

---

## 10. Appendix — file map (v2, corrected)

| Area | Files |
|---|---|
| Hide period toggle | `client/src/components/right-panel/DetailHeader.tsx`, `ConsolidatedHeader.tsx` |
| KPI modal | `client/src/components/right-panel/PerCustomerKPITable.tsx`, `kpi-modal-content.tsx`, `KPISection.tsx`; new `client/src/components/shared/TrendArrow.tsx` |
| **Prev-year backend (v2 — corrected producer)** | `shared/types/dashboard.ts`; `server/src/services/dimension-grouper.ts` (generalize `PrevYearTotals`); `server/src/services/dimension-grouper-items.ts` (all `groupBy*`); possibly new `server/src/services/prev-year-metrics.ts` if size grows; new `server/src/services/__tests__/dimension-grouper-prev-year.test.ts` |
| Reports exit + time tabs | `client/src/components/right-panel/ConsolidatedHeader.tsx`, `client/src/layouts/DashboardLayout.tsx`, `client/src/hooks/useReport.ts`; new `ConsolidatedOrdersTab.tsx` or extension |
| **Contacts grouping (v2 — covers single-entity path)** | new `client/src/components/right-panel/GroupedContactsTable.tsx`; `client/src/components/right-panel/TabsSection.tsx` (routing); delete `ConsolidatedContactsTable.tsx`; `server/src/routes/contacts.ts` (verify single-entity Zone/Vendor/Brand annotates `customerName`) |
| Orders customerName | `client/src/components/right-panel/ConsolidatedOrdersTable.tsx`, `OrdersTable.tsx`, `OrdersTab.tsx`; `server/src/routes/orders.ts`, `server/src/routes/fetch-all.ts` |
| Search by ID | `client/src/utils/search.ts`; new `client/src/utils/__tests__/search.test.ts` |
| Zone debug | `server/src/services/priority-queries.ts` (fetchZones), `entity-list-builder.ts`; new learning file |
| Vendor verify | `server/src/services/dimension-grouper.ts` / `dimension-grouper-items.ts` (if broken) |
| **Product Family (v2 — full contract boundary, 22 files)** | **Server Zod enums:** `server/src/routes/entities.ts`, `dashboard.ts`, `fetch-all.ts`, `contacts.ts`. **Server scoping/grouping:** `server/src/services/entity-subset-filter.ts`, `dimension-grouper.ts`, `dimension-grouper-items.ts`, `entity-list-builder.ts`, `priority-queries.ts` (new `fetchProductFamilies`). **Server cache:** `server/src/cache/cache-keys.ts`, `config/constants.ts`, `services/warm-cache.ts`. **Shared:** `shared/types/dashboard.ts`. **Client:** `client/src/hooks/shell-state-url.ts`, `utils/dimension-config.ts`, `utils/filter-types.ts`, `hooks/useContacts.ts`, `components/left-panel/DimensionToggles.tsx`, `components/shared/ReportFilterModal.tsx`, `components/right-panel/ProductMixCarousel.tsx`. **Tests:** `server/src/services/__tests__/entity-subset-filter.test.ts`, `routes/__tests__/fetch-all.test.ts`, `cache/__tests__/cache-keys.test.ts`, `server/tests/services/entity-filter.test.ts`; new `product-family-aggregation.test.ts`, `shell-state-url.test.ts`. |
| Products filter + country | `server/src/services/priority-queries.ts`, `shared/types/dashboard.ts`, `dimension-grouper-items.ts`; new learning file |
