# Zero-Value Filtering: Server + Client Defense-in-Depth

## The Problem

Priority ERP order items can have zero revenue (cancelled lines, free samples, placeholder entries). If these flow through to charts and lists, they create confusing "0%" segments in donut charts and "$0" entries in best sellers.

## The Fix: Filter at Both Layers

### Server (data-aggregator.ts)

Filter during aggregation before sorting/slicing:

```typescript
// In computeProductMix — filter zero-value segments
const sorted = [...map.entries()]
  .filter(([, value]) => value > 0)  // ← here
  .sort((a, b) => b[1] - a[1]);

// In computeTopSellers — filter zero-revenue items
const sorted = [...map.entries()]
  .filter(([, data]) => data.revenue > 0)  // ← here
  .sort(...)
  .slice(0, 25);
```

### Client (BestSellers.tsx)

Filter again before rendering, in case mock data or future API changes introduce zeros:

```typescript
const filtered = data.filter(item => item.revenue > 0);
```

## Why Both Layers

- **Server filter is primary** — prevents zero-value data from crossing the API boundary, saves bandwidth
- **Client filter is defensive** — catches edge cases: mock data with zeros, race conditions during data refresh, or future API contract changes
- **Cost is negligible** — one `.filter()` call on 25 items is unmeasurable

## Anti-Pattern: Filtering Only on Client

If you only filter on the client, the server might return 25 items where 5 are zero-value, giving you only 20 meaningful items. The server should filter *before* slicing to `top N`.

## Discovered

2026-03-31 — during best sellers and product mix implementation
