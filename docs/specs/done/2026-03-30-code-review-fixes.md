# Code Review Fix Spec — Sales Dashboard v1

**Date:** 2026-03-30
**Source:** Post-implementation code review of Plans 0, A, B, C
**Scope:** 21 issues (3 Critical, 10 Important, 8 Minor) across 5 work areas
**Approach:** Fix by feature area — each area is independently testable

---

## Area 1: Server Pipeline

**Files modified:**
- `server/src/services/priority-instance.ts` (NEW)
- `server/src/services/priority-client.ts`
- `server/src/routes/dashboard.ts`
- `server/src/routes/contacts.ts`
- `server/src/services/data-aggregator.ts`
- `server/src/services/kpi-aggregator.ts`
- `server/src/index.ts`

### Fix C2: PriorityClient Singleton

**Problem:** New `PriorityClient` created per request in `dashboard.ts:39-43` and `contacts.ts:26-30`. The rate limiter's `requestTimestamps` array is instance-scoped, so rate limiting across concurrent requests does not work.

**Fix:** Create `server/src/services/priority-instance.ts`:
```typescript
// Exports a module-scoped singleton so rate-limiter state
// is shared across all concurrent API requests.
import { PriorityClient } from './priority-client.js';
import { env } from '../config/env.js';

export const priorityClient = new PriorityClient({
  baseUrl: env.PRIORITY_BASE_URL,
  username: env.PRIORITY_USERNAME,
  password: env.PRIORITY_PASSWORD,
});
```

Update `dashboard.ts` and `contacts.ts`: replace `new PriorityClient({...})` with `import { priorityClient } from '../services/priority-instance.js'`.

**Verification:** `grep -rn "new PriorityClient" server/src/` should return 0 matches outside of `priority-instance.ts`.

### Fix C3: Pagination Infinite Loop Guard

**Problem:** In `priority-client.ts:110-121`, if the last two records share the same cursor field value, `cursorValue` does not advance and the outer loop fetches the same batch indefinitely.

**Fix:** Track the previous cursor value before each outer loop iteration:
```typescript
let previousCursorValue: string | null = null;
while (true) {
  // ... inner loop ...
  if (cursorValue === previousCursorValue) break; // Cursor didn't advance
  previousCursorValue = cursorValue;
  // ... cursor advancement logic ...
}
```

**Verification:** Unit test with mock data where last two records share the same cursor field value — loop must terminate.

### Fix I7: Remove Duplicate Client-Side Sort

**Problem:** Orders are sorted by date descending on the server (`data-aggregator.ts:105`) and again on the client (`OrdersTable.tsx:34`). Wasteful.

**Fix:** Remove the `.sort()` call in `data-aggregator.ts:105`. The client-side sort in `OrdersTable` is the authoritative one since users may want to change sort direction.

**Verification:** Orders still display in date-descending order by default.

### Fix I9: Add CORS Middleware

**Problem:** No CORS configuration in `server/src/index.ts`. The dashboard is iframe-embedded in Airtable, so cross-origin requests may be needed.

**Fix:** Install `cors` in server `dependencies` (NOT devDependencies — see RG1):
```bash
cd server && npm install cors && npm install -D @types/cors
```

Add middleware with restrictive origin whitelist:
```typescript
import cors from 'cors';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',         // Vite dev server
  process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`  // Railway auto-sets this
    : undefined,
].filter(Boolean) as string[];

app.use(cors({
  origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : true,
  credentials: false,
}));
```

**Why `credentials: false`:** The API uses no cookies or auth headers from the browser — all Priority auth is server-to-server.

**Verification:** `curl -H "Origin: http://localhost:5173" -I http://localhost:3001/api/sales/dashboard` returns `Access-Control-Allow-Origin` header.

### Fix M5: UTC Consistency in kpi-aggregator

**Problem:** `kpi-aggregator.ts:32` uses `now.getMonth()` (local timezone) for quarter boundaries, but lines 93-94 use `getUTCMonth()` for monthly revenue. Server timezone could cause quarterly and monthly aggregations to disagree.

**Fix:** Replace all date methods with UTC equivalents:
- Line 32: `now.getMonth()` → `now.getUTCMonth()`
- Line 33: `now.getFullYear()` → `now.getUTCFullYear()`
- All `new Date(year, month, day)` → construct with UTC: `new Date(Date.UTC(year, month, day))`

**Verification:** Existing tests must still pass. Add a test with a date that falls on a month boundary in UTC vs local time.

### Fix M7: OData Date Filter Documentation

**Problem:** `priority-queries.ts:91` embeds ISO date strings without OData-standard quoting. It works with Priority but is undocumented.

**Fix:** No code change. Add a learning file `learnings/priority-odata-date-literals.md` documenting that Priority accepts unquoted ISO dates in `$filter` clauses, contrary to OData spec.

---

## Area 2: Shared Types + Utils

**Files modified:**
- `shared/types/dashboard.ts`
- `shared/utils/formatting.ts`
- `server/src/services/dimension-grouper.ts`

### EntityListItem Enrichment

**Problem:** `EntityListItem` only has `id`, `name`, `meta1`, `meta2`, `revenue`, `orderCount`. The filter engine needs 10 fields, the sort engine needs 8 fields, but only 3 are available. The design spec (Section 15) defines these fields for filtering and sorting.

**Fix:** Add 8 new fields to `EntityListItem` in `shared/types/dashboard.ts`:

```typescript
export interface EntityListItem {
  id: string;
  name: string;
  meta1: string;
  meta2: string;
  revenue: number;
  orderCount: number;
  // Enrichment fields for filter + sort (computed by dimension-grouper)
  avgOrder: number;                // revenue / orderCount, 0 when no orders
  marginPercent: number;           // (totalProfit / totalRevenue) * 100
  marginAmount: number;            // total profit in dollars
  frequency: number | null;        // orders per month, null when period < 1 month
  lastOrderDate: string | null;    // ISO date of most recent order, null when no orders
  rep: string | null;              // sales agent name (customer dimension only, null otherwise)
  zone: string | null;             // zone name (customer dimension only, null otherwise)
  customerType: string | null;     // customer type (customer dimension only, null otherwise)
}
```

**Why no `outstanding` or `fillRate`:** `outstanding` requires INVOICES_P API data not currently fetched. `fillRate` requires delivery/shipment data not available per-entity. Both are global KPIs only. Filter UI must not offer these fields.

**Server changes:** Update `dimension-grouper.ts`:

1. Change signature to accept period info: `groupByDimension(dimension, orders, customers, periodMonths)`
2. In each `groupBy*` function, compute the new fields from order item data:
   - `avgOrder`: `revenue / orderCount` (or 0 when no orders)
   - `marginPercent`: Sum `QPROFIT` / sum `QPRICE` * 100 across all items in group
   - `marginAmount`: Sum `QPROFIT` across all items in group
   - `frequency`: `orderCount / periodMonths` (null when `periodMonths < 1`)
   - `lastOrderDate`: `Math.max` of all `CURDATE` values in group
   - `rep`: From customer data `AGENTDES` (customer dimension only)
   - `zone`: From customer data `ZONEDES` (customer dimension only)
   - `customerType`: From customer data `CTYPEDES` field (customer dimension only)

3. Update `dashboard.ts` to pass `periodMonths` to `groupByDimension`:
   ```typescript
   // For YTD: months elapsed so far (e.g., March = 3)
   // For full year: 12
   const periodMonths = period === 'ytd'
     ? now.getUTCMonth() + 1
     : 12;
   const entities = groupByDimension(groupBy, orders, customers, periodMonths);
   ```

**Verification:** API response for `GET /api/sales/dashboard?groupBy=customer` returns entities with all new fields populated. Test customer C7826 should have non-null `rep`, `zone`, `customerType`.

### Fix I2: formatCurrencyCompact Negative Sign

**Problem:** `shared/utils/formatting.ts:20-29` uses `Math.abs(value)` but never reattaches the sign. `formatCurrencyCompact(-1500000)` returns `"$1.5M"` instead of `"-$1.5M"`.

**Fix:**
```typescript
export function formatCurrencyCompact(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return k % 1 === 0 ? `${sign}$${k}K` : `${sign}$${k.toFixed(1)}K`;
  }
  return `${sign}$${abs}`;
}
```

**Verification:** `formatCurrencyCompact(-1500000)` === `"-$1.5M"`. `formatCurrencyCompact(1500000)` === `"$1.5M"` (unchanged).

### Fix M4: formatCurrency Rounding Discontinuity

**Problem:** Values under $1000 show two decimals (`$42.80`), values at $1000+ show zero decimals (`$1,000`). Visual jump at the threshold.

**Fix:** Values under $1000 use `toFixed(2)` only when there are cents, otherwise show integer. Values at $1000+ already look correct per the mockup (no decimals in KPI cards). Keep current behavior — the discontinuity is intentional per the design spec which shows `$240,200` (no decimals) and `$7,506` (no decimals) for large values.

**Decision: No code change.** Document as intentional in a comment.

---

## Area 3: Filter/Sort System

**Files modified:**
- `client/src/utils/filter-engine.ts` (rewrite)
- `client/src/utils/sort-engine.ts` (expand)
- `client/src/components/left-panel/FilterCondition.tsx` (align types)
- `client/src/components/left-panel/FilterPanel.tsx` (simplify adapter)
- `client/src/hooks/useFilters.ts` (type tightening)
- `client/src/hooks/useSort.ts` (refactor)
- `client/src/components/left-panel/SearchBox.tsx` (debounce fix)
- `client/src/utils/dimension-config.ts` (update field definitions)

### Fix I3: Unified Operator Naming

**Problem:** FilterCondition.tsx defines operators as `gt`, `lt`, `gte`, `lte`. Filter engine expects `>`, `<`, `>=`, `<=`. The adapter in FilterPanel.tsx doesn't translate. All non-exact-match filters silently pass everything.

**Fix:** Establish a single naming convention used by ALL layers. Internal keys use short symbolic names. Display labels are for the UI only.

**Operator type (in FilterCondition.tsx or a shared filter-types file):**
```typescript
// Numeric operators
type NumericOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'equals' | 'between' | 'is_empty';
// Date operators
type DateOperator = 'is_before' | 'is_after' | 'between' | 'is_empty';
// Text operators
type TextOperator = 'equals' | 'not_equals' | 'contains' | 'is_empty';

type FilterOperator = NumericOperator | DateOperator | TextOperator;
```

**Display label mapping (in FilterCondition.tsx):**
```typescript
const OPERATOR_LABELS: Record<FilterOperator, string> = {
  gt: '>', lt: '<', gte: '>=', lte: '<=',
  equals: 'equals', not_equals: 'not equals',
  contains: 'contains', between: 'between',
  is_before: 'is before', is_after: 'is after',
  is_empty: 'is empty',
};
```

**Filter engine (filter-engine.ts) handles internal keys:**
```typescript
switch (cond.operator) {
  case 'gt': return fieldValue > condValue;
  case 'lt': return fieldValue < condValue;
  case 'gte': return fieldValue >= condValue;
  case 'lte': return fieldValue <= condValue;
  case 'equals': return String(fieldValue).toLowerCase() === String(condValue).toLowerCase();
  case 'not_equals': return String(fieldValue).toLowerCase() !== String(condValue).toLowerCase();
  case 'contains': return String(fieldValue).toLowerCase().includes(String(condValue).toLowerCase());
  case 'is_before': return new Date(String(fieldValue)) < new Date(String(condValue));
  case 'is_after': return new Date(String(fieldValue)) > new Date(String(condValue));
  case 'is_empty': return fieldValue === null || fieldValue === undefined || fieldValue === '';
  case 'between': {
    // condValue stored as "min,max" string (e.g., "1000,5000" or "2026-01-01,2026-03-31")
    const [min, max] = String(condValue).split(',').map(s => parseFloat(s) || s);
    return fieldValue >= min && fieldValue <= max;
  }
  default: return true;
}
```

**FilterPanel adapter becomes a passthrough** — no more unsafe `as` casts.

### Fix I3+: Field-Type-Aware Operator Options

**Insight from mockup:** The filter panel shows different operators per field type. "Last Order" gets date operators ("is in week"), "Revenue" gets numeric (">"), "Zone" gets text ("equals").

**Field type classification:**
```typescript
type FieldType = 'numeric' | 'date' | 'text';

const FIELD_TYPES: Record<FilterField, FieldType> = {
  revenue: 'numeric', orderCount: 'numeric', avgOrder: 'numeric',
  marginPercent: 'numeric', frequency: 'numeric',
  lastOrderDate: 'date',
  name: 'text', rep: 'text', zone: 'text', customerType: 'text',
};
```

When a field is selected, the operator dropdown only shows operators valid for that field type:
- Numeric fields: `gt`, `lt`, `gte`, `lte`, `equals`, `between`, `is_empty`
- Date fields: `is_before`, `is_after`, `between`, `is_empty`
- Text fields: `equals`, `not_equals`, `contains`, `is_empty`

### Fix I4: Complete Field Mapping

**Problem:** `getFieldValue` in `filter-engine.ts:66-76` only maps 3 of 10 fields. Unmapped fields return `0`.

**Fix:** Direct property access from enriched `EntityListItem`:
```typescript
function getFieldValue(entity: EntityListItem, field: FilterField): number | string | null {
  const map: Record<FilterField, number | string | null> = {
    revenue: entity.revenue,
    orderCount: entity.orderCount,
    avgOrder: entity.avgOrder,
    marginPercent: entity.marginPercent,
    frequency: entity.frequency,
    lastOrderDate: entity.lastOrderDate,
    name: entity.name,
    rep: entity.rep,
    zone: entity.zone,
    customerType: entity.customerType,
  };
  return map[field] ?? null;
}
```

**Display labels for field dropdowns:**
```typescript
const FIELD_LABELS: Record<FilterField, string> = {
  revenue: 'Revenue', orderCount: 'Orders', avgOrder: 'Avg Order',
  marginPercent: 'Margin %', frequency: 'Frequency',
  lastOrderDate: 'Last Order',
  name: 'Name', rep: 'Rep', zone: 'Zone', customerType: 'Customer Type',
};
```

**Dimension-aware field visibility:** Not all fields are relevant for all dimensions. For example, `rep`, `zone`, `customerType` are only meaningful when viewing customers. The filter UI should only show fields relevant to the active dimension.

```typescript
// In dimension-config.ts, define available filter fields per dimension
const DIMENSION_FILTER_FIELDS: Record<Dimension, FilterField[]> = {
  customer: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name', 'rep', 'zone', 'customerType'],
  zone: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
  vendor: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
  brand: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
  product_type: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
  product: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
};
```

### Sort Engine Completion

**Problem:** `sort-engine.ts` only handles 3 of 8 sort fields. Fields like `avgOrder`, `marginPercent`, `frequency`, `outstanding`, `lastOrder` default to revenue sort.

**Fix:** Now that `EntityListItem` carries these fields, add cases:
```typescript
case 'avgOrder': return e.avgOrder;
case 'marginPercent': return e.marginPercent;
case 'frequency': return e.frequency ?? -Infinity; // null sorts last
case 'lastOrder': return e.lastOrderDate ? new Date(e.lastOrderDate).getTime() : -Infinity;
```

Remove `outstanding` from the `SortField` type since it's not available per-entity.

### Fix I5: useSort Stale Closure

**Problem:** `useSort.ts:25-36` calls `setSortDirection` inside a `setSortField` updater — nested state setters with stale closure risk.

**Fix:** Replace with `useReducer`:
```typescript
type SortAction =
  | { type: 'toggle'; field: SortField }
  | { type: 'reset' };

function sortReducer(state: SortState, action: SortAction): SortState {
  switch (action.type) {
    case 'toggle':
      if (state.field === action.field) {
        return { ...state, direction: state.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field: action.field, direction: 'desc' };
    case 'reset':
      return { field: 'revenue', direction: 'desc' };
  }
}
```

**Verification:** Clicking the same sort field toggles direction. Clicking a different field sets it to descending.

### Fix I6: SearchBox Debounce

**Problem:** `SearchBox.tsx:23-31` includes `onChange` in the effect dependency array. If `onChange` identity changes between renders, the debounce timer restarts.

**Fix:** Store `onChange` in a ref:
```typescript
const onChangeRef = useRef(onChange);
onChangeRef.current = onChange;

useEffect(() => {
  if (localValue === value) return;
  if (!localValue) { onChangeRef.current(''); return; }
  const timer = setTimeout(() => onChangeRef.current(localValue), 300);
  return () => clearTimeout(timer);
}, [localValue, value]);
```

**Verification:** Typing rapidly in the search box only triggers one filter update after 300ms pause.

---

## Area 4: Client Rendering

**Files modified:**
- `client/src/hooks/useEntitySelection.ts`
- `client/src/components/right-panel/Sparkline.tsx`
- `client/src/components/right-panel/DetailHeader.tsx`
- `client/src/components/shared/ErrorBoundary.tsx` (NEW)
- `client/src/App.tsx`

### Fix C1: useEntitySelection Memoization

**Problem:** `useEntitySelection.ts:54` spreads `selectedIds` Set to a new array every render: `selectedIds: [...selectedIds]`. Every component receiving this prop re-renders on every parent render.

**Fix:** Memoize the array conversion:
```typescript
const selectedIdsArray = useMemo(
  () => [...selectedIds],
  [selectedIds],
);

return {
  // ...
  selectedIds: selectedIdsArray,
  // ...
};
```

Since `selectedIds` is a `useState` value, it only changes reference when `setSelectedIds` is called, so the memo correctly tracks changes.

**Verification:** React DevTools Profiler shows no unnecessary re-renders of `EntityList` when hovering over right panel components.

### Fix I8: Sparkline Gradient ID

**Problem:** `Sparkline.tsx:41` uses `Math.random()` to generate gradient IDs. New ID every render = SVG `<defs>` recreated = potential visual flicker.

**Fix:** Replace with React 19's `useId()`:
```typescript
const id = useId();
const gradientId = `sparkline-grad-${id}`;
```

**Verification:** Multiple sparklines render simultaneously without ID collisions or flicker.

### Fix I10: Export Button Type

**Problem:** `DetailHeader.tsx:53` button lacks `type="button"`. Defaults to `type="submit"`.

**Fix:** Add `type="button"` attribute.

**Verification:** Clicking Export does not trigger form submission behavior.

### Fix M8: Error Boundary

**Problem:** No React error boundary. Runtime errors crash the entire dashboard to a white screen with no recovery.

**Fix:** Create `client/src/components/shared/ErrorBoundary.tsx`:
```typescript
// React error boundaries must be class components — no hook equivalent exists
class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-[var(--color-bg-page)]">
          <div className="text-center">
            <h2 className="text-[var(--color-text-primary)]">Something went wrong</h2>
            <p className="text-[var(--color-text-muted)]">{this.state.error?.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded bg-[var(--color-dark)] px-4 py-2 text-white"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Wrap in `App.tsx`:
```tsx
<ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <DashboardApp />
  </QueryClientProvider>
</ErrorBoundary>
```

**Verification:** Temporarily throw an error in a component — error boundary catches it and shows fallback UI instead of white screen.

---

## Area 5: Cleanup

**Files modified:**
- `.gitignore`
- `client/src/components/right-panel/HeroRevenueCard.tsx`
- `client/src/components/right-panel/KPICard.tsx`
- `client/src/components/right-panel/KPISection.tsx`
- `client/src/components/right-panel/YoYBarChart.tsx`
- `client/src/layouts/DashboardLayout.tsx`
- `client/src/components/shared/Badge.tsx` (DELETE)
- `client/src/components/shared/Badge.js` (DELETE)

### Fix I1: Remove .js Build Artifacts

**Problem:** 35 `.js` files committed alongside `.ts`/`.tsx` sources in `client/src/` and `shared/`. These are stale transpiler output that should not be in source control.

**Fix:**
1. Add to `.gitignore`:
   ```
   # Compiled output alongside source (only dist/ should have .js)
   client/src/**/*.js
   shared/**/*.js
   ```
2. Remove tracked files AND delete from disk: `git rm client/src/**/*.js shared/**/*.js`

**Verification:** `git status` shows .js files as deleted. `ls client/src/App.js` returns "No such file".

### Fix M1: Magic Hex Values to Design Tokens

**Problem:** Multiple components use hardcoded hex colors instead of CSS custom properties from the design system.

**Token mapping** (validated against mockup):

| Raw Hex | Design Token Variable | Usage |
|---------|----------------------|-------|
| `#888` | `var(--color-text-muted)` | KPI labels, sub-labels |
| `#999` | `var(--color-text-muted)` | Muted text |
| `#bbb` | `var(--color-text-faint)` | Chart axis, faintest text |
| `#22c55e` | `var(--color-green)` | Positive trends |
| `#ef4444` | `var(--color-red)` | Negative trends |
| `#b8a88a` | `var(--color-gold-primary)` | Gold accents |
| `#eab308` | `var(--color-yellow)` | Warning/slowing status |
| `#e8e0d0` | `var(--color-gold-muted)` | Chart bars (prev year) |
| `#d4c5a9` | `var(--color-gold-light)` | Chart bars (current year) |

**Files to update:**
- `HeroRevenueCard.tsx`: `#888` → `var(--color-text-muted)`
- `KPICard.tsx`: `#888` → `var(--color-text-muted)`
- `KPISection.tsx`: `#999`, `#22c55e`, `#b8a88a`, `#eab308`, `#ef4444` → respective tokens
- `YoYBarChart.tsx`: `#e8e0d0`, `#d4c5a9`, `#bbb`, `#888` → respective tokens

**Note on `#888` vs `#999`:** The mockup shows KPI labels in a light gray matching `#999` (text-muted). The code uses `#888` which is slightly darker. Normalizing to `var(--color-text-muted)` (#999) matches the mockup.

**Verification:** Visual comparison with mockup — all colors match design tokens. `grep -rn "#[0-9a-fA-F]\{3,6\}" client/src/components/` should return no hex color matches in component files (only in CSS custom property definitions in index.css).

### Fix M2: Remove Unused isConsolidated

**Problem:** `isConsolidated` is declared in `DashboardLayoutProps` but never used in the layout component body.

**Fix:** Remove from the props interface and the `useDashboardState` return type if unused by any consumer. Check all callers first.

**Verification:** `grep -rn "isConsolidated" client/src/` confirms no remaining references.

### Fix M3: Remove Unused Badge Component

**Problem:** `client/src/components/shared/Badge.tsx` (125 lines) is fully implemented but not imported anywhere.

**Fix:** Delete `Badge.tsx` and `Badge.js`.

**Verification:** `grep -rn "Badge" client/src/` returns no import references.

### Fix M6: Type meta Prop

**Problem:** `DashboardLayout.tsx` types the `meta` prop as `unknown`.

**Fix:** Define a proper meta type:
```typescript
interface DashboardMeta {
  cached: boolean;
  cachedAt: string | null;
  period: string;
  dimension: string;
  entityCount: number;
}
```

Or import from `ApiResponse` if the shape matches.

**Verification:** TypeScript compiles without `as` casts when accessing meta properties.

---

## Railway Deployment Guardrails

The dashboard deploys via multi-stage Dockerfile on Railway. Any TypeScript error or missing module kills the deploy. These guardrails prevent silent build/deploy failures.

### RG1: `cors` Package — Must Be in `dependencies`

The CORS fix (I9) adds `cors` as a new server dependency. It MUST go in `dependencies`, not `devDependencies`.

**Why:** The Docker production stage runs `npm ci --omit=dev` (Dockerfile line 42). If `cors` is in `devDependencies`, it won't be installed in production, and the server crashes on startup with `Cannot find module 'cors'`.

```bash
# In server/
npm install cors
npm install -D @types/cors
```

**Verification:** `grep cors server/package.json` shows it under `"dependencies"`, not `"devDependencies"`.

### RG2: Server `@shared` Imports — Type-Only Guardrail

Currently, ALL server `@shared/*` imports are `import type` (7 imports across 4 files). TypeScript erases `import type` at compile time, so the compiled JS has no `@shared` references. This is why the build works without `tsc-alias`.

**CRITICAL GUARDRAIL:** The enrichment changes in Area 2 add new fields to `EntityListItem`, but `dimension-grouper.ts` only uses `import type { EntityListItem }` — still type-only. No `tsc-alias` needed.

**However:** If ANY future change converts a type import to a value import in the server (e.g., importing a formatting function from `@shared/utils/formatting`), the compiled JS will contain an unresolved `@shared/...` require and the server will crash at startup in Docker.

**Mandatory check after EVERY server change:**
```bash
cd server && npm run build
grep -r "@shared" server/dist/ && echo "FAIL: unresolved @shared" || echo "OK"
```

Zero results = safe. Any match = must add `tsc-alias` to server build script (`"build": "tsc && tsc-alias"`).

### RG3: New File `priority-instance.ts` — Singleton Import Safety

The new singleton file (`server/src/services/priority-instance.ts`) imports from `'./priority-client.js'` and `'../config/env.js'` — both are relative paths, no alias resolution needed. Safe for Docker.

**But:** The `env` module reads `process.env` at import time. Since `priority-instance.ts` is imported at module scope (not inside a request handler), the singleton is created when the server starts. The `.env` file must be loaded BEFORE this import.

**Verification:** In `server/src/index.ts`, ensure `dotenv.config()` runs before any route imports that transitively import `priority-instance.ts`. Or use `import 'dotenv/config'` as the FIRST import.

### RG4: `.js` File Removal — Docker Build Safety

Removing 35 `.js` files (I1) from `client/src/` and `shared/` is safe for Docker. The Dockerfile copies source directories and runs `npm run build` which generates fresh output. The stale `.js` files were never used by the build pipeline.

**However:** The `git rm` command must run BEFORE the Docker build, since Railway builds from the git HEAD. After committing the `.js` removals, Railway's next deploy won't have them.

### RG5: Client Test Files — Future-Proofing

No client test files exist yet (`client/src/**/*.test.*` returns nothing). But:

- Client `tsconfig.json` has `"include": ["src/**/*"]` with no `"exclude"` for test patterns
- The client build runs `tsc -b` which would pick up any `.test.ts(x)` files
- Test files import from `vitest` (a devDependency) — this breaks Docker's `npm ci` which only has production deps

**Guardrail for future:** When client tests are added, `client/tsconfig.json` must exclude them:
```json
"exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]
```

Or create a separate `tsconfig.app.json` for the build (used by `tsc -b`) that excludes tests.

### RG6: Express 5 Catch-All Syntax

The server uses Express 5. If any fix introduces a catch-all route (unlikely but worth noting):
- **Wrong:** `app.get('*', handler)` — fails silently
- **Right:** `app.get('/{*path}', handler)` — named wildcard

### RG7: Dockerfile Path Math — No Changes Needed

The fixes don't modify:
- `server/tsconfig.json` `rootDir` or `outDir`
- `Dockerfile` COPY paths or CMD
- `server/src/index.ts` static file path resolution (`../../../../client/dist`)

All three must stay in sync. **Do not modify tsconfig `rootDir`/`outDir` as part of these fixes.**

---

## Execution Order and Dependencies

```
Area 1 (Server)  ──┐
                    ├──→ Area 3 (Filter/Sort) ──→ Area 4 (Rendering) ──→ Area 5 (Cleanup)
Area 2 (Shared)  ──┘
```

**Areas 1 + 2 can run in parallel.** Area 3 depends on Area 2 (enriched EntityListItem). Area 4 is independent but sequenced after Area 3 for testing convenience. Area 5 is pure cleanup, runs last.

## Verification Checklist

### TypeScript + Tests (run first)

```bash
cd client && npx tsc -b --noEmit        # 1. Client TS — zero errors
cd ../server && npx tsc --noEmit         # 2. Server TS — zero errors
cd ../server && npx vitest run           # 3. Tests — all pass (add new for C3, M5)
cd ../client && npx vite build           # 4. Bundle — < 500KB gzip
```

### Code Quality Checks

```bash
# 5. No any types
grep -rn ": any\|as any" server/src/ client/src/
# → zero matches

# 6. PriorityClient singleton enforced
grep -rn "new PriorityClient" server/src/routes/
# → zero matches

# 7. No magic hex colors in components
grep -rn "#[0-9a-fA-F]\{3,6\}" client/src/components/
# → zero matches (only CSS custom property definitions in index.css)

# 8. No files over 200 lines
find client/src server/src shared -name "*.ts" -o -name "*.tsx" | xargs wc -l | awk '$1 > 200'
# → zero results

# 9. No stale .js alongside .ts
find client/src shared -name "*.js" | head -5
# → zero results
```

### Railway Deployment Checks

```bash
# 10. cors in dependencies (NOT devDependencies)
node -e "const p=require('./server/package.json'); console.log(p.dependencies.cors ? 'OK' : 'FAIL')"

# 11. No unresolved @shared in compiled server output
cd server && npm run build && grep -r "@shared" dist/ && echo "FAIL" || echo "OK"

# 12. Server build script doesn't include tsc-alias (not needed — all @shared are type-only)
# BUT: if this check fails (step 11), add tsc-alias

# 13. Dockerfile path math unchanged
grep "../../../../client/dist" server/src/index.ts && echo "OK" || echo "FAIL: path math changed"

# 14. railway.json exists
test -f railway.json && echo "OK" || echo "FAIL: railway.json missing"

# 15. dotenv loads before singleton import
head -5 server/src/index.ts
# → dotenv/config or dotenv.config() must be FIRST
```

### Docker Build (final gate — catches isolation issues)

```bash
docker build -t sales-dashboard-test .
# Must complete all 3 stages without errors
```

### Functional Checks (manual)

16. Filter test: apply "Revenue > 100000" filter → entity list updates correctly
17. Sort test: click each sort field → list reorders correctly
18. Visual comparison with mockup — colors, layout, behavior match
19. Error boundary test: temporarily throw in a component → fallback UI shows
