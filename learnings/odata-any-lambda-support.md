# OData `any()` lambda and standalone ORDERITEMS are BOTH unavailable in Priority

**Date:** 2026-04-17
**Context:** While designing a per-item dimension narrow-fetch (plan `validated-floating-rossum.md` / adversarial-reviewed), we needed a way to narrow the `ORDERS` fetch by a field that lives on `ORDERITEMS_SUBFORM` (vendor code `Y_1159_5_ESH`, brand `Y_9952_5_ESH`, product type `Y_3020_5_ESH`, `PARTNAME`). Both paths the plan considered are not viable on Priority's OData build.

## Finding 1 — `any()` lambda operator is not supported (HTTP 501)

```
GET .../ORDERS?$select=ORDNAME&$top=1
    &$filter=CURDATE ge 2026-01-01T00:00:00Z
        and ORDERITEMS_SUBFORM/any(i: i/Y_1159_5_ESH eq 'XXX')
→ 501 {"error":{"code":"501","message":"\"any\" operator is not supported"}}
```

Priority's OData implementation rejects `any()` with a clear 501. No workaround; `all()` almost certainly has the same constraint. Option A is dead.

## Finding 2 — Standalone `ORDERITEMS` entity is not queryable (HTTP 404)

```
GET .../ORDERITEMS?$top=1 → 404
GET .../ORDERITEMSTRANS?$top=1 → 404
GET .../PARTTRAN?$top=1 → 404
```

The metadata (`GetMetadataFor(entity='ORDERS')`) lists `ORDERITEMS_SUBFORM` with `ContainsTarget="true"` and type `Collection(Priority.OData.ORDERITEMS)`. The containment annotation means the entity is only addressable *through* its parent ORDERS. The top-level collection is not exposed.

As a result, even though `ORDERITEMS` has `PARTNAME` and all three `Y_*` custom discriminator fields, we cannot run a standalone `$filter=<dim>` to collect ORDNAMEs. Option B as originally planned (standalone resolver) is dead.

Additionally, standalone `ORDERITEMS` metadata does NOT include `ORDNAME` or `CUSTNAME` properties — even if the entity were queryable, we'd have no way to relate items back to parent orders from its response.

## Finding 3 — `$expand` with nested `$filter` works server-side but is slower than the full fetch

The last viable API technique is to query ORDERS with a stripped payload and a nested subform filter:

```
GET .../ORDERS?$select=ORDNAME
    &$top=5000
    &$expand=ORDERITEMS_SUBFORM($filter=Y_1159_5_ESH eq 'V5840';$select=KLINE;$top=1)
    &$filter=CURDATE ge 2026-01-01T00:00:00Z and CURDATE lt 2027-01-01T00:00:00Z
→ 200, 116s, 245 KB
    value: 5000 orders, of which 57 had non-empty ORDERITEMS_SUBFORM (i.e., touched V5840)
```

The nested `$filter` is honored: non-matching orders return an empty `ORDERITEMS_SUBFORM`, matching orders return a 1-element array (`$top=1` in the expand). We can then client-side filter for non-empty subforms to get the ORDNAMEs touching the target entity, and run a narrowed `$filter=ORDNAME eq 'A' or ORDNAME eq 'B' ...` second fetch.

**But the timing is unusable.** 5000 orders took 116s; the full YTD universe is ~22K; scaling linearly this is 8–10 minutes for the discovery query alone, then a second fetch on top. The existing universal full-fetch without this trick takes ~6 minutes — the "narrow" approach is actually SLOWER because Priority has to evaluate the subform filter for every parent.

## Implication for the plan

The plan `validated-floating-rossum.md` cannot be implemented as designed. Neither the `any()` path nor the standalone-ORDERITEMS path exists. The `$expand($filter)` workaround is slower than the status quo, so it's not a viable Option B replacement either.

## Alternative paths worth considering (deferred — flag to user)

1. **Warm-cache reverse index** — when the warm-cache service builds `dashboard:orders:ytd:all`, also iterate the orders once and persist `dashboard:revidx:<dim>:ytd` → `Map<entityId, Set<CUSTNAME>>`. Per-item narrow requests then do a local lookup to get CUSTNAMEs, then reuse the existing customer CUSTNAME narrow-fetch. Fast when warm. On true cold (e.g., first request post-deploy before warm-cache finishes), fall through to the universal path — which is what happens today.
2. **Accept the limitation + improve UX** — keep the existing universal-cache path for per-item dims, but replace the 170s-timeout-into-500 failure mode with a 202 "warming up, retry in N seconds" response. Frontend shows a friendly indicator instead of a broken empty screen.
3. **Pre-aggregate server-side** — compute per-dim aggregates during warm-cache and persist. Per-item requests read the aggregate directly, without needing orders at all. Larger refactor.

## References

- Skill §6 "`any()` operator" — documented that `$filter` operators include only `eq/ne/gt/ge/lt/le/and/or`. `any()` was an assumption on our side, not something the skill promised.
- Skill §7 "Sub-Form Patterns" — notes that sub-forms have three access patterns (A/B/C). ORDERITEMS_SUBFORM's `ContainsTarget="true"` plus the 404 on standalone confirms it's only addressable through ORDERS.
- Live probes captured in this note were run against `https://us.priority-connect.online/odata/Priority/tabc8cae.ini/a012226/` on 2026-04-17.
