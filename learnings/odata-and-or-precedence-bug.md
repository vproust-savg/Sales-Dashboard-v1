# OData `and`/`or` operator precedence — wrap extraFilters in parens

## The bug

`fetchOrders` in `server/src/services/priority-queries.ts` composes filters by string concatenation:

```
CURDATE ge 2026-01-01 and CURDATE lt 2027-01-01 and ORDSTATUSDES ne 'Canceled' and <extraFilter>
```

When `extraFilter` is a single term (e.g., `CUSTNAME eq 'C7826'`), this parses correctly — every operator is `and`.

When `extraFilter` is an OR-chain (e.g., `CUSTNAME eq 'C7826' or CUSTNAME eq 'C7825'`), **OData's operator precedence binds `and` tighter than `or`**, and the composed filter parses as:

```
(CURDATE ge 2026-01-01 and CURDATE lt 2027-01-01 and ORDSTATUSDES ne 'Canceled' and CUSTNAME eq 'C7826')
  OR
(CUSTNAME eq 'C7825')
```

The second disjunct escapes the date range filter, so Priority returns **every historical order** for customer C7825 regardless of date.

## Real-world impact (2026-04-17)

A 2-customer View Consolidated call that should have returned ~150 YTD orders returned **3747 rows** — a ~25× blow-up:

| customer | expected YTD | actual with bug | actual with fix |
|----------|-------------|------------------|------------------|
| C7826 (Disney's Club 33) | 52 | 52 (date-filtered correctly) | 52 |
| C7825 (Disney's Grand Californian) | 96 | **~3695** (entire history) | 96 |

Performance: fetch-all took **68s → server cancelled**, dropped to **11.9s** after the fix.

## The fix

Wrap `extraFilter` in parentheses when embedding, so it's always evaluated as an atomic sub-expression:

```ts
// WRONG (bug):
const dateFilter = `CURDATE ge ... and CURDATE lt ... and ${statusExclude}`
  + (extraFilter ? ` and ${extraFilter}` : '');

// CORRECT:
const dateFilter = `CURDATE ge ... and CURDATE lt ... and ${statusExclude}`
  + (extraFilter ? ` and (${extraFilter})` : '');
```

Wrapping a single-term extraFilter in parens is harmless (`(X)` ≡ `X` in any boolean algebra), so no special-casing.

## General rule

**Whenever you string-concatenate a user-supplied or composed OData clause into a larger `and`-joined filter, wrap it in parentheses.** This is the same defensive pattern as using parens when building SQL `WHERE` clauses with user input. OData follows standard boolean-algebra precedence: `not` > `and` > `or`.

## Regression guard

`server/src/services/__tests__/fetch-orders-filter-precedence.test.ts` asserts the composed filter contains `and (extraFilter)` in all four cases: single term, OR-chain (the critical one), undefined, and nested chains.

## Related files

- `server/src/services/priority-queries.ts` (line ~108: where the wrap happens)
- `server/src/services/narrow-order-filter.ts` (generates OR-chains for multi-entity scopes)
- `server/src/routes/dashboard.ts` + `server/src/routes/fetch-all.ts` (consumers of narrow filters)
