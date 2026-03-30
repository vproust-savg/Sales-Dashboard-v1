# Priority API: $expand URL Encoding Trap

## The Problem

Using JavaScript's `URL` and `searchParams.set()` for OData query parameters double-encodes the `$expand` value, breaking nested `$select` clauses.

## Why It Happens

`searchParams.set('$expand', 'ORDERITEMS_SUBFORM($select=PARTNAME,TQUANT)')` encodes the parentheses and dollar signs, producing:

```
%24expand=ORDERITEMS_SUBFORM%28%24select%3DPARTNAME%2CTQUANT%29
```

Priority's OData endpoint does NOT decode this correctly and returns an error.

## The Fix

Build the URL string with raw concatenation:

```typescript
const url = `${baseUrl}/ORDERS?$expand=ORDERITEMS_SUBFORM($select=PARTNAME,TQUANT)&$filter=...`;
```

Or use a URL object but append query params manually without `searchParams.set()`.

## Discovered

2026-03-30 — during spec research (Section 17.8)
