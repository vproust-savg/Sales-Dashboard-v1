# LOGPART brand lives in SPEC4, not Y_9952_5_ESH

## The trap

Priority ERP stores the same **brand** value in two places:

| Entity | Field | Shape |
|--------|-------|-------|
| `LOGPART` (master products) | **`SPEC4`** | string like `"BLACK PEARL"` (nullable) |
| `ORDERITEMS_SUBFORM` (order line items) | **`Y_9952_5_ESH`** | string like `"BLACK PEARL"` |

The values are **identical** for the same PARTNAME — it's denormalized, not a foreign-key relationship. Verified live on `tabc8cae.ini/a012226`:

```
LOGPART PARTNAME=10305  SPEC4='FABRIQUE DELICES'
ORDERITEMS for ORDNAME=X, PARTNAME=10305  Y_9952_5_ESH='FABRIQUE DELICES'
```

## What fails

Putting `Y_9952_5_ESH` in a `LOGPART` `$select` returns a hard 400:

```
HTTP 400
{"error":{"code":"400","message":"Could not find a property named
 'Y_9952_5_ESH' on type 'Priority.OData.LOGPART'."}}
```

This is not a typo or permissions issue — the field literally doesn't exist on the LOGPART entity type. Y_* custom fields are entity-specific; the same logical concept can be `Y_9952_5_ESH` on ORDERITEMS and `SPEC4` on LOGPART.

## Why this matters

- **Warm-cache failure symptom:** `[warm-cache] Background warm failed: HTTP 400` on every Railway boot. The `Promise.all` in `warmEntityCache` rejects on the first 400 from `fetchProducts`, `dashboard:products:all` never writes to Redis, the master-data layer for the product dim stays empty.
- **Brand filter dropdown:** sourcing brands from `LOGPART.SPEC4` gives you the complete universe (every in-use product's brand). Sourcing from whatever `Y_9952_5_ESH` values happen to appear in the current order cache gives you a subset.

## The fix pattern

When you need a field that exists on both the master and the transactional entity, query the master-entity spelling:

```ts
// LOGPART master
select: 'PARTNAME,PARTDES,FAMILYNAME,SPEC4,STATDES',  // SPEC4 = brand

// ORDERITEMS subform (different entity!)
select: 'PARTNAME,Y_9952_5_ESH,...',  // Y_9952_5_ESH = brand
```

Both return the same string values, so downstream joins (e.g., "does this order item's brand match the selected brand filter?") work without normalization.

## Discovering the truth for any field

1. **Don't trust a column name across entities.** Custom fields are entity-scoped.
2. **Use `GetMetadataFor(entity='LOGPART')`** (from the priority-erp-api skill, Section 22) to list every field the entity actually exposes.
3. **Grep sister projects** for production-proven field mappings. In this repo the sister project `/Users/victorproust/Documents/Work/Priority/Airtable_Priority_N8N_v1/` maps LOGPART with `SPEC1`–`SPEC16` (no Y_* customs) — that's the authoritative shape.

## Related

- `learnings/priority-api-custom-fields-pattern.md` — the general pattern of Y_* vs SPEC* fields
- `tools/Priority ERP March 30.xml` — full metadata reference (search for `"SPEC4"` under LOGPART)
- priority-erp-api skill Section 9 — SPEC fields are always strings
- priority-erp-api skill Section 22 — `GetMetadataFor` for entity discovery
