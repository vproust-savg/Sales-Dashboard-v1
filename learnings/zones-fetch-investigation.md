# Zones Fetch Investigation: SF North / SF East Missing

**Date:** 2026-04-17
**Task:** Dashboard Overhaul Plan A §5.3 — investigate missing SF North and SF East zones

## Queries Run

### 1. DISTRLINES full universe (no filter)

```bash
curl -u "$PRIORITY_USERNAME:$PRIORITY_PASSWORD" \
  -H "Prefer: odata.maxpagesize=49900" \
  -H "IEEE754Compatible: true" \
  "${PRIORITY_BASE_URL}DISTRLINES?\$select=DISTRLINECODE,DISTRLINEDES,ZONECODE,ZONEDES&\$top=200"
```

**Result: 25 rows total. All 25 zones are present.**

SF-named zones found:
| DISTRLINECODE | DISTRLINEDES | ZONECODE | ZONEDES  |
|---------------|--------------|----------|----------|
| 21            | SF           | 21       | SF       |
| 22            | SF South     | 22       | SF South |
| 23            | SF North     | 23       | SF North |
| 24            | SF East      | 24       | SF East  |

### 2. ZONES entity (independent check)

```bash
curl -u "$PRIORITY_USERNAME:$PRIORITY_PASSWORD" \
  -H "Prefer: odata.maxpagesize=49900" -H "IEEE754Compatible: true" \
  "${PRIORITY_BASE_URL}ZONES?\$select=ZONECODE,ZONEDES&\$top=100"
```

**Result: 25 rows, identical set.** ZONES and DISTRLINES are in sync. Both have codes 23 and 24.

### 3. INACTIVE field on DISTRLINES

Attempted `$select=...,INACTIVE` — Priority returned a 400 error:
`"Could not find a property named 'INACTIVE' on type 'Priority.OData.DISTRLINES'."`

DISTRLINES has no inactive flag. All rows are always active.

### 4. Customers per zone

```bash
curl -u "$PRIORITY_USERNAME:$PRIORITY_PASSWORD" \
  -H "Prefer: odata.maxpagesize=49900" -H "IEEE754Compatible: true" \
  "${PRIORITY_BASE_URL}CUSTOMERS?\$select=CUSTNAME,ZONECODE,ZONEDES&\$top=2000"
```

**Result (1876 customers total):**
- Zone 23 (SF North): **25 customers** assigned
- Zone 24 (SF East): **0 customers** assigned

### 5. Orders from SF North customers (2026 YTD)

Queried a sample of SF North customers (C9074, C9120, C9127). 
**Result: active orders found in 2026** (e.g., SO26161500, SO26190735). Zone 23 is commercially active.

## Code Path Analysis

### entity-list-builder.ts lines 61-83

1. `fetchZones` returns all 25 DISTRLINES rows.
2. Dedup loop (lines 68-71) iterates by DISTRLINECODE order. Since each zone has exactly **1 row**, every ZONECODE is unique — no collapsing occurs. Zone 23 and 24 survive.
3. `zoneMasters` = all 25 zones.
4. Enriched path: `groupByZone` produces groups only for zones with orders. Zone 23 (25 customers, active orders) → enriched entry. Zone 24 (0 customers) → no entry → falls back to `zoneStub`. Both appear in the final list.

**The code is correct. Both zones should appear in the UI.**

### dimension-grouper.ts — groupByZone

Keyed by `custZone.get(o.CUSTNAME)?.zone` — zone membership flows from customer master data. Zone 24 will never appear in order-derived groups because no customers are assigned to it. But the entity-list-builder merge at line 79-81 catches this and adds a stub. No silent drop.

## Root-Cause Verdict

**`STALE_REDIS_CACHE`** (subcase of `OTHER`)

Neither SF North nor SF East is missing from Priority — both zones exist in DISTRLINES and ZONES. The code path correctly handles them (zone 23 enriched, zone 24 as stub).

The most likely explanation for the user's observation: the `dashboard:zones:all` Redis key was populated **before** zones 23 and 24 were added to Priority, and the 24-hour TTL had not yet expired when the user checked. `cachedFetch` in `warm-cache.ts` no-ops on hot cache — it does NOT force-refresh zone data on server restart unless the key has expired.

Secondary factor: the `dashboard:customers:all` key also carries `ZONECODE`/`ZONEDES` per customer. If it was cached before zone 23 was assigned to customers, the customer metadata passed to `groupByZone` would not include any customers with `ZONECODE='23'`, so zone 23 would also appear as a stub (but still present).

## Fix Recommendation

**No code change needed.** The issue resolves itself when both Redis keys expire (within 24 hours of zones being added to Priority). For an immediate fix: flush `dashboard:zones:all` and `dashboard:customers:all` from Upstash Redis — both will be re-fetched from Priority on next request.

If this happens again after future zone additions, consider reducing the zones TTL from 24h to 1h in `constants.ts` (cheap entity, rarely changes, but should reflect additions same day).
