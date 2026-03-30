# Priority OData: Unquoted Date Literals

**Discovery date:** 2026-03-30

Priority's OData implementation accepts unquoted ISO 8601 date strings in `$filter`:

```
CURDATE ge 2026-01-01T00:00:00Z and CURDATE lt 2027-01-01T00:00:00Z
```

Per OData v4 spec, `Edm.DateTimeOffset` literals should be unquoted (unlike `Edm.String`).
Priority conforms here. No quoting needed for date filters.

Used in: `server/src/services/priority-queries.ts:91`
