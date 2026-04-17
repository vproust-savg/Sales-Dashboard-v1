# Vendor (and Product-Type) Prev-Year Verification

**Date:** 2026-04-17  
**Verdict:** `BUG_FIXED`

## Raw findings snapshot (vendor, dashboard endpoint)

```json
[
  {"id":"V4480","name":"SOPAC","revenue":836728.19,"prevYearRevenue":null,"prevYearRevenueFull":null,"orderCount":432,"prevYearOrderCount":null},
  {"id":"V4157","name":"DGF France","revenue":480112.03,"prevYearRevenue":null,"prevYearRevenueFull":null,"orderCount":937,"prevYearOrderCount":null},
  {"id":"V7815","name":"Plantin","revenue":368555.02,"prevYearRevenue":null,"prevYearRevenueFull":null,"orderCount":795,"prevYearOrderCount":null},
  {"id":"V6520","name":"La Fromagee Jean-Yves Bordier","revenue":340424.81,"prevYearRevenue":null,"prevYearRevenueFull":null,"orderCount":406,"prevYearOrderCount":null},
  {"id":"V5494","name":"Antipodes","revenue":339581.78,"prevYearRevenue":null,"prevYearRevenueFull":null,"orderCount":901,"prevYearOrderCount":null}
]
```

KPI-level `prevYearRevenue = 7,099,186` — prev-year orders were in cache. Entity-level was all null.

## Root cause

`ORDERITEM_SELECT_PREV` in `server/src/config/constants.ts` is the reduced field set used when fetching prev-year orders (`isCurrentPeriod = false`). It was missing two fields:

| Field | Used as |
|---|---|
| `Y_1159_5_ESH` | Vendor code — the bucket key in `buildItemPrevMaps` for vendor dim |
| `Y_3020_5_ESH` | Product-type code — the entity `id` used by `groupByProductType` |

**Vendor:** without `Y_1159_5_ESH`, all prev-year items had `undefined` vendor code → bucketed under `'UNKNOWN'` → lookup by real vendor id (`V4480`, etc.) returned nothing → null prev-year for every vendor.

**Product type:** without `Y_3020_5_ESH`, the prevMap keyed by name (`Y_3021_5_ESH`), but `groupByProductType` built entity ids from code (`Y_3020_5_ESH`). Key mismatch → null prevYear for all named types. Only the `'Other'` fallback matched (both sides fell back to name when code absent).

**Brand and product were unaffected** — their key fields (`Y_9952_5_ESH` and `PARTNAME`) were already in `ORDERITEM_SELECT_PREV`.

## Fix applied

`server/src/config/constants.ts` — added `Y_1159_5_ESH` and `Y_3020_5_ESH` to `ORDERITEM_SELECT_PREV`:

```typescript
export const ORDERITEM_SELECT_PREV = [
  'PARTNAME', 'QPRICE', 'QPROFIT', 'TQUANT',
  'Y_9952_5_ESH', 'Y_3021_5_ESH',
  'Y_1159_5_ESH', 'Y_3020_5_ESH',  // ← added
].join(',');
```

The fix takes effect on the next Priority API fetch for prev-year orders (cache miss or TTL expiry). The Redis per-order cache TTL for historical years is 365 days — so a manual cache clear or new deploy will re-fetch with the corrected field set.

## Lesson

When adding a new dimension that keys on a custom field (`Y_XXXX_5_ESH`), always verify that field is included in BOTH `ORDERITEM_SELECT` (current) AND `ORDERITEM_SELECT_PREV` (prev-year). The "lighter" prev-year set is easy to forget. The existing unit tests in `dimension-grouper-prev-year.test.ts` use mock order items with all fields populated, so they don't catch this class of bug — they would need mocks that only populate `ORDERITEM_SELECT_PREV` fields to catch it.
