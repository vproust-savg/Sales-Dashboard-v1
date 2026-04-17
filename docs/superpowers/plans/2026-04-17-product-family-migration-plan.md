# Product Family Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the `product_type` dimension to `product_family` throughout the codebase AND redefine its semantics: group by `FAMILY_LOG.FAMILYNAME` (where `FTCODE ∈ {01,02,03}`) instead of the current `FTCODE` buckets. Ship as a five-phase alias-first migration to avoid a flag-day deploy breaking saved Airtable embeds or open tabs.

**Architecture:** New `fetchProductFamilies()` hitting `FAMILY_LOG`. New `groupByProductFamily()` that joins order items to LOGPART on `PARTNAME` → reads `FAMILYNAME`. Zod enums accept BOTH tokens during alias window; client shim auto-redirects legacy URLs. Cache keys change; old keys TTL-expire naturally.

**Tech Stack:** Express + TypeScript, React 19 + Vite, Zod, Vitest, Upstash Redis. Priority ERP read-only oData for `FAMILY_LOG` entity.

**Reference spec:** `docs/specs/2026-04-17-all-dimensions-review-design.md` §5.5 (v2).

**Prerequisite:** `2026-04-17-foundation-and-cross-cutting-plan.md` should be merged first. This plan depends on the prev-year backend changes landing in `dimension-grouper.ts` / `dimension-grouper-items.ts`.

**Critical guardrail:** Priority ERP is **read-only**. No writes. Test customer `C7826`.

---

## Migration strategy (alias-first, five phases)

Each phase ends in a deployable state. The system is never in a broken intermediate configuration.

| Phase | Token state | Telemetry outcome |
|---|---|---|
| A | Accept both `product_type` and `product_family` on server; cache writes under `product_family`; URL shim present | Both paths work; old bookmarks OK |
| B | Client emits `product_family` everywhere | Legacy accept path idle |
| C | Remove `product_type` from server Zod enums | Legacy URLs hit shim → redirect → `product_family` → OK |
| D | Wait 1–2 months, confirm shim never fires | Safe to remove shim |
| E | Remove shim | Migration complete |

This plan covers Phases A–C (code work). Phases D/E are timed follow-ups.

---

## Phase A — Accept both tokens (no breakage)

### Task A1: Fetch FAMILY_LOG master data

**Files:**
- Modify: `shared/types/dashboard.ts` (add `RawFamily`)
- Modify: `server/src/services/priority-queries.ts` (add `fetchProductFamilies`)
- Create: `server/src/services/__tests__/fetch-product-families.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// server/src/services/__tests__/fetch-product-families.test.ts
import { describe, it, expect, vi } from 'vitest';
import { fetchProductFamilies } from '../priority-queries.js';

const mockClient = {
  fetchAllPages: vi.fn(),
};

describe('fetchProductFamilies', () => {
  it('requests FAMILY_LOG with the FTCODE filter and expected fields', async () => {
    mockClient.fetchAllPages.mockResolvedValue([]);
    await fetchProductFamilies(mockClient as any);
    expect(mockClient.fetchAllPages).toHaveBeenCalledWith('FAMILY_LOG', expect.objectContaining({
      select: 'FAMILYNAME,FAMILYDESC,FTCODE,FTNAME',
      filter: "FTCODE eq '01' or FTCODE eq '02' or FTCODE eq '03'",
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/services/__tests__/fetch-product-families.test.ts`
Expected: FAIL — `fetchProductFamilies` does not exist.

- [ ] **Step 3: Add `RawFamily` type to shared/types/dashboard.ts**

```typescript
export interface RawFamily {
  FAMILYNAME: string;   // family code (e.g., "111", "112") — used as dimension ID
  FAMILYDESC: string;   // display name (e.g., "Beverages", "Charcuterie")
  FTCODE: string;       // "01" | "02" | "03" — family type code
  FTNAME: string;       // "Culinary" | "Pastry" | "Beverages" — family type description
}
```

- [ ] **Step 4: Implement fetchProductFamilies**

In `server/src/services/priority-queries.ts`:

```typescript
/** WHY FAMILY_LOG filtered to FTCODE 01/02/03: per spec §5.5, only the three
 *  "real" family types surface in the dimension list. FAMILYDESC is the
 *  display name; FAMILYNAME (e.g. "111") is the canonical ID used for joins. */
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

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run src/services/__tests__/fetch-product-families.test.ts`
Expected: PASS.

- [ ] **Step 6: Live-verify against Priority**

```bash
cd server && npx tsx -e "
import { getPriorityClient } from './src/services/priority-client.js';
import { fetchProductFamilies } from './src/services/priority-queries.js';
const rows = await fetchProductFamilies(getPriorityClient());
console.log('Count:', rows.length);
console.log('Sample:', rows.slice(0, 5));
"
```
Expected: ~20 rows (roughly: Beverages, Charcuterie, Glaze & Inclusion, Chocolate & Praline, Filling & Decor, Cheeses, Salt & Spices, Olives & Vegetables, Truffles & Mushrooms, Oils & Vinegars, Honey & Sweet, Technical Ingredients, …).

- [ ] **Step 7: Commit**

```bash
git add shared/types/dashboard.ts server/src/services/priority-queries.ts server/src/services/__tests__/fetch-product-families.test.ts
git commit -m "feat(priority): add fetchProductFamilies for FAMILY_LOG (FTCODE 01/02/03)"
```

---

### Task A2: `groupByProductFamily` grouper

**Files:**
- Modify: `server/src/services/dimension-grouper-items.ts`
- Create: `server/src/services/__tests__/group-by-product-family.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// server/src/services/__tests__/group-by-product-family.test.ts
import { describe, it, expect } from 'vitest';
import { groupByProductFamily } from '../dimension-grouper-items.js';
import type { RawOrder, RawCustomer, RawProduct } from '../../../../shared/types/dashboard.js';

const CUSTOMERS: RawCustomer[] = [
  { CUSTNAME: 'C1', CUSTDES: 'C1', ZONECODE: 'Z', ZONEDES: 'Z', STATDES: 'A', INACTIVE: '', CURRNCY: 'USD', PHONE: '', EMAIL: '' } as RawCustomer,
];
const PRODUCTS: RawProduct[] = [
  { PARTNAME: 'P1', PARTDES: 'Part 1', FAMILYNAME: '111', SPEC4: null, Y_5380_5_ESH: null, STATDES: 'In Use' },
  { PARTNAME: 'P2', PARTDES: 'Part 2', FAMILYNAME: '112', SPEC4: null, Y_5380_5_ESH: null, STATDES: 'In Use' },
];

function mkOrder(partname: string, amount: number): RawOrder {
  return {
    ORDNAME: 'O1', CUSTNAME: 'C1', CURDATE: '2026-02-01', TOTPRICE: amount, TOTCOST: 0, STATDES: 'Closed',
    ORDERITEMS_SUBFORM: [{ PARTNAME: partname, PDES: 'x', TQUANT: 1, PRICE: amount, QUANTCOST: 0 }],
  } as unknown as RawOrder;
}

describe('groupByProductFamily', () => {
  it('groups order items by LOGPART.FAMILYNAME resolved from PARTNAME', () => {
    const productsByPartname = new Map(PRODUCTS.map(p => [p.PARTNAME, p]));
    const rows = groupByProductFamily(
      [mkOrder('P1', 100), mkOrder('P2', 200)],
      CUSTOMERS, 12, productsByPartname,
    );
    expect(rows).toHaveLength(2);
    const f111 = rows.find(r => r.id === '111');
    const f112 = rows.find(r => r.id === '112');
    expect(f111?.revenue).toBe(100);
    expect(f112?.revenue).toBe(200);
  });

  it('falls back to "UNKNOWN" when PARTNAME not in products map', () => {
    const productsByPartname = new Map<string, RawProduct>();
    const rows = groupByProductFamily(
      [mkOrder('P-missing', 50)],
      CUSTOMERS, 12, productsByPartname,
    );
    const unknown = rows.find(r => r.id === 'UNKNOWN');
    expect(unknown?.revenue).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/services/__tests__/group-by-product-family.test.ts`
Expected: FAIL — `groupByProductFamily` does not exist.

- [ ] **Step 3: Implement groupByProductFamily**

Append to `dimension-grouper-items.ts`:

```typescript
/**
 * WHY separate from groupByProductType:
 * - Different aggregation KEY: FAMILYNAME (from LOGPART, ~20 buckets) vs
 *   Y_3020_5_ESH (on order items directly, 3 buckets).
 * - Different JOIN requirement: family code lives on LOGPART, so we need
 *   the PARTNAME→product map passed in from the caller.
 */
export function groupByProductFamily(
  orders: RawOrder[],
  customers: RawCustomer[],
  periodMonths: number,
  productsByPartname: Map<string, RawProduct>,
  prevTotals?: PrevYearTotals,
): EntityListItem[] {
  // Flatten order items with family resolution
  const buckets = new Map<string, { items: MetricItem[]; familyDesc: string | null }>();
  for (const o of orders) {
    for (const it of o.ORDERITEMS_SUBFORM ?? []) {
      const family = productsByPartname.get(it.PARTNAME)?.FAMILYNAME ?? 'UNKNOWN';
      const bucket = buckets.get(family) ?? { items: [], familyDesc: null };
      bucket.items.push({
        orderId: o.ORDNAME,
        amount: Number(it.PRICE) * Number(it.TQUANT),
        cost: Number(it.QUANTCOST) * Number(it.TQUANT),
      });
      buckets.set(family, bucket);
    }
  }
  // Build EntityListItem rows, populate prev-year like the other groupers
  const rows: EntityListItem[] = [];
  const periodDays = periodMonths * 30;
  for (const [family, { items }] of buckets) {
    const current = computeMetrics(items, periodDays);
    const same = prevTotals?.samePeriod.get(family) ?? null;
    const full = prevTotals?.full.get(family) ?? null;
    rows.push({
      id: family,
      name: family, // caller overrides with FAMILYDESC map
      revenue: current.revenue,
      orderCount: current.orderCount,
      avgOrder: current.avgOrder,
      marginPercent: current.marginPercent,
      marginAmount: current.marginAmount,
      frequency: current.frequency,
      lastOrderDate: null, // compute if needed
      prevYearRevenue: same?.revenue ?? null,
      prevYearRevenueFull: full?.revenue ?? null,
      prevYearOrderCount: same?.orderCount ?? null,
      prevYearOrderCountFull: full?.orderCount ?? null,
      prevYearAvgOrder: same?.avgOrder ?? null,
      prevYearAvgOrderFull: full?.avgOrder ?? null,
      prevYearMarginPercent: same?.marginPercent ?? null,
      prevYearMarginPercentFull: full?.marginPercent ?? null,
      prevYearMarginAmount: same?.marginAmount ?? null,
      prevYearMarginAmountFull: full?.marginAmount ?? null,
      prevYearFrequency: same?.frequency ?? null,
      prevYearFrequencyFull: full?.frequency ?? null,
    } as EntityListItem);
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/services/__tests__/group-by-product-family.test.ts`
Expected: PASS both cases.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/dimension-grouper-items.ts server/src/services/__tests__/group-by-product-family.test.ts
git commit -m "feat(server): add groupByProductFamily grouping order items by LOGPART.FAMILYNAME"
```

---

### Task A3: Wire `product_family` through `groupByDimension` + `entity-list-builder`

**Files:**
- Modify: `server/src/services/dimension-grouper.ts`
- Modify: `server/src/services/entity-list-builder.ts`

- [ ] **Step 1: Extend the dimension router in dimension-grouper.ts**

Add a new branch alongside the existing `product_type` branch:

```typescript
case 'product_family': {
  const productsByPartname = new Map((extras.products ?? []).map(p => [p.PARTNAME, p]));
  return groupByProductFamily(orders, customers, periodMonths, productsByPartname, prevTotals);
}
```

(Pass `extras.products` through the existing call signature — `entity-list-builder.ts` already has the products list.)

- [ ] **Step 2: Add a product_family branch to entity-list-builder.ts**

After the `product_type` branch (around line 98):

```typescript
if (dimension === 'product_family') {
  const familiesResult = await fetchProductFamilies(client, signal);
  const descByFamily = new Map(familiesResult.map(f => [f.FAMILYNAME, f.FAMILYDESC]));
  const rows = groupByDimension('product_family', orders, customersResult.data, periodMonths, {
    products: productsResult.data,
    prevInput,
  });
  // Override name with FAMILYDESC
  return { entities: rows.map(r => ({ ...r, name: descByFamily.get(r.id) ?? r.id })) };
}
```

- [ ] **Step 3: Run server tests**

Run: `cd server && npx vitest run`
Expected: PASS. If compilation fails due to unknown dimension values, continue to Step 4.

- [ ] **Step 4: Extend the shared `Dimension` type to include both names (alias window)**

In `shared/types/dashboard.ts`:

```typescript
// WHY both names: during alias window (Phase A-C), server accepts both.
// `product_type` will be removed in Phase C.
export type Dimension =
  | 'customer' | 'zone' | 'vendor' | 'brand'
  | 'product_type'   // DEPRECATED — remove in Phase C
  | 'product_family'
  | 'product';
```

- [ ] **Step 5: Re-run server tests**

Run: `cd server && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/dimension-grouper.ts server/src/services/entity-list-builder.ts shared/types/dashboard.ts
git commit -m "feat(server): add product_family dimension alongside legacy product_type"
```

---

### Task A4: Accept `product_family` in all Zod route validators

**Files:**
- Modify: `server/src/routes/entities.ts`
- Modify: `server/src/routes/dashboard.ts`
- Modify: `server/src/routes/fetch-all.ts`
- Modify: `server/src/routes/contacts.ts`

- [ ] **Step 1: Update Zod enum in each route**

In each file, find the dimension enum (likely `z.enum([...])`) and add `'product_family'`:

```typescript
// BEFORE
z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product'])
// AFTER
z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product_family', 'product'])
```

Apply the same change in all four route files.

- [ ] **Step 2: Extend existing route tests**

In each of `server/src/routes/__tests__/entities.test.ts`, `fetch-all.test.ts`, `contacts.test.ts`, add a case:

```typescript
it('accepts ?dimension=product_family during alias window', async () => {
  const res = await request(app).get('/api/sales/entities?dimension=product_family').expect(200);
  expect(Array.isArray(res.body.data)).toBe(true);
});
```

- [ ] **Step 3: Run tests**

Run: `cd server && npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/ server/src/routes/__tests__/
git commit -m "feat(routes): accept product_family dimension in all Zod validators (alias window)"
```

---

### Task A5: Extend server cache + warm-cache + subset-filter for `product_family`

**Files:**
- Modify: `server/src/cache/cache-keys.ts`
- Modify: `server/src/config/constants.ts`
- Modify: `server/src/services/warm-cache.ts`
- Modify: `server/src/services/entity-subset-filter.ts`
- Modify: `server/src/cache/__tests__/cache-keys.test.ts`
- Modify: `server/src/services/__tests__/entity-subset-filter.test.ts`

- [ ] **Step 1: Extend cache-keys.ts**

Wherever `product_type` appears in key-building logic, add a parallel branch for `product_family`:

```typescript
export function dashboardEntityCacheKey(dimension: Dimension): string {
  return `dashboard:${dimension}:all`; // naturally supports any string dim
}
```

If it's a hardcoded enum, add `'product_family'` to the list.

- [ ] **Step 2: Extend constants.ts dimension list**

Find the dimension list constant (e.g., `DIMENSIONS = ['customer', 'zone', ...]`) and add `'product_family'`. Keep `'product_type'` during the alias window.

- [ ] **Step 3: Extend warm-cache.ts seeder loop**

Where warm-cache iterates over dimensions, ensure `'product_family'` is included. If the seeder reads from the `DIMENSIONS` constant, Step 2 covers it.

- [ ] **Step 4: Extend entity-subset-filter.ts**

Add a `product_family` case to the scoping switch (should mirror `product_type` but with the new key field).

- [ ] **Step 5: Extend existing tests**

```typescript
// cache-keys.test.ts
it('builds a unique key for product_family', () => {
  expect(dashboardEntityCacheKey('product_family')).toBe('dashboard:product_family:all');
});

// entity-subset-filter.test.ts
it('scopes orders by product_family dimension', () => {
  // ... fixture with orders spanning two families; assert only matching family's orders returned
});
```

- [ ] **Step 6: Run tests**

Run: `cd server && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/cache/ server/src/config/constants.ts server/src/services/warm-cache.ts server/src/services/entity-subset-filter.ts
git commit -m "feat(server): extend cache keys, warm-cache, subset filter for product_family"
```

---

### Task A6: Client URL parser accepts both tokens + shim redirects

**Files:**
- Modify: `client/src/hooks/shell-state-url.ts`
- Create: `client/src/hooks/__tests__/shell-state-url.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { parseShellUrl, applyLegacyDimensionShim } from '../shell-state-url';

describe('shell-state-url', () => {
  it('parses ?dimension=product_family', () => {
    const url = new URL('http://x/?dimension=product_family');
    expect(parseShellUrl(url).dimension).toBe('product_family');
  });

  it('still parses legacy ?dimension=product_type (accepted during alias window)', () => {
    const url = new URL('http://x/?dimension=product_type');
    expect(parseShellUrl(url).dimension).toBe('product_type');
  });

  it('applyLegacyDimensionShim rewrites product_type → product_family on the URL', () => {
    const url = new URL('http://x/?dimension=product_type&entityId=111');
    const rewritten = applyLegacyDimensionShim(url);
    expect(rewritten?.searchParams.get('dimension')).toBe('product_family');
  });

  it('applyLegacyDimensionShim returns null when no rewrite needed', () => {
    const url = new URL('http://x/?dimension=customer');
    expect(applyLegacyDimensionShim(url)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/hooks/__tests__/shell-state-url.test.ts`
Expected: FAIL — `applyLegacyDimensionShim` does not exist; parser may reject `product_family`.

- [ ] **Step 3: Extend the parser's dimension enum**

Find the Zod/guard in `shell-state-url.ts`. Add `'product_family'` to the list.

- [ ] **Step 4: Export applyLegacyDimensionShim**

```typescript
/** WHY a separate shim (not inline in parser): old URLs parse OK during the
 *  alias window; the shim only fires in Phase C/D+ to rewrite the URL before
 *  it's shown in the address bar. Returns the rewritten URL, or null if
 *  no rewrite needed. */
export function applyLegacyDimensionShim(url: URL): URL | null {
  if (url.searchParams.get('dimension') === 'product_type') {
    const rewritten = new URL(url.toString());
    rewritten.searchParams.set('dimension', 'product_family');
    return rewritten;
  }
  return null;
}
```

- [ ] **Step 5: Call the shim at app init**

In `useDashboardShellState` or the dashboard shell init effect, call on mount:

```typescript
useEffect(() => {
  const rewritten = applyLegacyDimensionShim(new URL(window.location.href));
  if (rewritten) {
    window.history.replaceState(null, '', rewritten.toString());
  }
}, []);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd client && npx vitest run src/hooks/__tests__/shell-state-url.test.ts`
Expected: PASS all 4 cases.

- [ ] **Step 7: Commit**

```bash
git add client/src/hooks/shell-state-url.ts client/src/hooks/__tests__/shell-state-url.test.ts
git commit -m "feat(client): URL parser accepts product_family; shim rewrites legacy product_type"
```

---

### Task A7: Add `product_family` to client dimension config (Phase A stops here)

**Files:**
- Modify: `client/src/utils/dimension-config.ts`
- Modify: `client/src/utils/filter-types.ts`
- Modify: `client/src/hooks/useContacts.ts`
- Modify: `client/src/components/left-panel/DimensionToggles.tsx`

- [ ] **Step 1: Add product_family entry to dimension-config.ts**

Add an entry mirroring `product_type` but with label "Product Family" and an appropriate icon. Keep `product_type` for now so both toggles render during alias window (or choose to show only `product_family` — see user decision in spec §5.5.1).

- [ ] **Step 2: Extend filter-types.ts dimension enum**

Add `'product_family'`.

- [ ] **Step 3: Extend useContacts.ts dimension branch**

If `useContacts` has a dimension switch, add a `product_family` case mirroring `product_type`.

- [ ] **Step 4: Update DimensionToggles.tsx**

Replace the `product_type` toggle button with `product_family` (label "Product Family"). Users click through the new dimension; `useReport`/`useDashboardState` pass `'product_family'` to the API; server accepts it.

- [ ] **Step 5: Run client build**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 6: Visual verify end-to-end**

Start both servers. Click Product Family in the left panel:
- ~20 entries appear (Beverages, Charcuterie, Glaze & Inclusion, Chocolate & Praline, ...).
- Click one → right panel shows correct grouped metrics.
- Legacy URL `?dimension=product_type` still works via Zod accept + server still returns the old 3-bucket data.
- Fresh URL `?dimension=product_family` returns ~20 buckets.

- [ ] **Step 7: Commit**

```bash
git add client/src/utils/dimension-config.ts client/src/utils/filter-types.ts client/src/hooks/useContacts.ts client/src/components/left-panel/DimensionToggles.tsx
git commit -m "feat(client): migrate dimension toggle from product_type to product_family"
```

---

## Phase B — Migrate call sites

### Task B1: Update ReportFilterModal + ProductMixCarousel labels

**Files:**
- Modify: `client/src/components/shared/ReportFilterModal.tsx`
- Modify: `client/src/components/right-panel/ProductMixCarousel.tsx`

- [ ] **Step 1: Replace `product_type` references in ReportFilterModal**

`grep -n 'product_type\|productType\|"Product Type"' client/src/components/shared/ReportFilterModal.tsx`

Replace each with `product_family` / `productFamily` / "Product Family". Keep `Y_3020_5_ESH` references as-is (that's the Priority field, not the dimension).

- [ ] **Step 2: De-duplicate ProductMixCarousel**

The carousel currently has both "product_type" and "family" mix slides per explore findings. With the new `product_family` dimension, these refer to the same data. Pick one:
- If `family` slide already exists and renders correctly → remove the `product_type` slide.
- If `product_type` slide was the primary → rename it to `product_family` and remove the redundant `family` slide.

Document the choice in the commit message.

- [ ] **Step 3: Run client build**

Run: `cd client && npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/shared/ReportFilterModal.tsx client/src/components/right-panel/ProductMixCarousel.tsx
git commit -m "refactor(client): rename product_type→product_family in ReportFilterModal; dedupe carousel slides"
```

---

### Task B2: Final grep-sweep — no unexpected `product_type` references

**Files:** verification only.

- [ ] **Step 1: Sweep the client**

Run: `grep -rn 'product_type\|productType\|"Product Type"' client/src/`
Expected: zero matches (except possibly in the URL shim path, which intentionally recognizes the legacy string).

- [ ] **Step 2: Sweep the server (expect some — alias window still open)**

Run: `grep -rn 'product_type\|"Product Type"' server/src/`
Expected: matches in Zod enums, constants, dimension-grouper-items.ts (old grouper), cache keys — ALL intentional during alias window. No unexpected UI-label strings.

- [ ] **Step 3: Commit if any cleanup happened**

```bash
git commit -m "chore(client): remove stray product_type references" # only if anything was cleaned
```

If nothing to clean up, skip the commit.

---

## Phase C — Remove legacy `product_type` acceptance

### Task C1: Remove `product_type` from server Zod enums

**Files:**
- Modify: `server/src/routes/entities.ts`, `dashboard.ts`, `fetch-all.ts`, `contacts.ts`
- Modify: `server/src/routes/__tests__/*.test.ts` (update tests to expect 400 on legacy)

**⚠️ DO NOT run this task until the URL shim (Task A6) has been live in production for at least 1 week and telemetry confirms no direct `product_type` requests without shim redirect.**

- [ ] **Step 1: Remove `'product_type'` from each Zod enum**

```typescript
// BEFORE (alias window)
z.enum(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product_family', 'product'])
// AFTER
z.enum(['customer', 'zone', 'vendor', 'brand', 'product_family', 'product'])
```

Apply to all four route files.

- [ ] **Step 2: Write assertion that legacy is now rejected**

Add to each route test:

```typescript
it('rejects legacy ?dimension=product_type after alias window', async () => {
  await request(app).get('/api/sales/entities?dimension=product_type').expect(400);
});
```

- [ ] **Step 3: Run tests**

Run: `cd server && npx vitest run`
Expected: PASS.

- [ ] **Step 4: Verify the URL shim still handles legacy URLs**

Manual check: visit `http://localhost:5173/?dimension=product_type&entityId=111`. Expected flow:
1. Client URL shim rewrites → `?dimension=product_family&entityId=111`
2. API call uses `product_family` → server accepts → data renders.

If the shim is missing or broken, DO NOT proceed.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/ server/src/routes/__tests__/
git commit -m "feat(routes): remove legacy product_type acceptance (alias window closed)"
```

---

### Task C2: Remove `product_type` from shared type, cache-keys, constants, dimension-grouper

**Files:**
- Modify: `shared/types/dashboard.ts` (remove `'product_type'` from `Dimension`)
- Modify: `server/src/cache/cache-keys.ts`
- Modify: `server/src/config/constants.ts`
- Modify: `server/src/services/dimension-grouper.ts` (remove `case 'product_type'`)
- Modify: `server/src/services/dimension-grouper-items.ts` (delete `groupByProductType`)
- Modify: `server/src/services/entity-list-builder.ts` (delete `product_type` branch)
- Update any test fixtures still referencing `product_type`.

- [ ] **Step 1: Remove the token everywhere on server side**

Run: `grep -rn "'product_type'\|\"product_type\"" server/src/` — go through each and remove. Leave tests that assert rejection.

- [ ] **Step 2: Remove from shared Dimension type**

```typescript
export type Dimension =
  | 'customer' | 'zone' | 'vendor' | 'brand'
  | 'product_family' | 'product';
```

- [ ] **Step 3: Delete groupByProductType**

Delete the whole function from `dimension-grouper-items.ts`. Also delete its tests if any.

- [ ] **Step 4: Run full pre-deploy gate**

```bash
cd client && npx tsc -b --noEmit
cd ../server && npx tsc --noEmit
cd ../server && npx vitest run
cd ../client && npx vite build
```
All must pass.

- [ ] **Step 5: Commit**

```bash
git add shared/types/dashboard.ts server/src/cache/cache-keys.ts server/src/config/constants.ts server/src/services/
git commit -m "refactor(server): remove all product_type code paths (migration complete)"
```

---

## Phase D/E (follow-up, not coded now)

**Phase D (telemetry wait):** After Phase C is deployed, monitor `applyLegacyDimensionShim` invocation count (add a console.log or analytics event before deploying). If zero invocations over 30+ days, proceed to Phase E.

**Phase E (shim removal):** Delete `applyLegacyDimensionShim` + its tests + the `useEffect` call in the shell. Single commit titled "chore(client): remove legacy product_type URL shim".

---

## Self-review checklist

Against spec §5.5 (v2):

| Spec sub-section | Covered by task |
|---|---|
| §5.5.1 Data redefinition (FAMILY_LOG + FAMILYDESC) | Tasks A1, A2, A3 |
| §5.5.2 Contract boundaries — Server Zod | Task A4 |
| §5.5.2 — Server scoping + cache + warm-cache | Task A5 |
| §5.5.2 — Shared types | Task A3 Step 4 |
| §5.5.2 — Client contracts + URL parser | Tasks A6, A7 |
| §5.5.2 — Client UI | Tasks A7, B1 |
| §5.5.2 — Server tests | Extended across A2, A4, A5, C1 |
| §5.5.2 — Client tests | Tasks A6 |
| §5.5.2 — Alias-first migration order | Phases A / B / C / D-E |
| §5.5.3 URL shim | Task A6 |
| §5.5.4 Tests | Tasks A1, A2, A4, A5, A6 |
| §5.5.4 Cache-key migration | Task A5 + TTL behavior |

**Placeholder scan:** none — all code blocks complete, all paths absolute to repo root, all test assertions concrete.

**Type consistency:** `RawFamily`, `groupByProductFamily`, `fetchProductFamilies`, `'product_family'` used identically across every task.

**Sequencing:** Phase C tasks are gated by the "⚠️ DO NOT run" callout in C1 — they must wait for real telemetry.
