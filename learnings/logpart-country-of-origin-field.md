# LOGPART Country of Origin: Y_5380_5_ESH is SAFE

## Query run

```bash
# Credentials from server/.env (PRIORITY_USERNAME / PRIORITY_PASSWORD / PRIORITY_BASE_URL)
curl -s \
  -H "Authorization: Basic <base64(USERNAME:PASSWORD)>" \
  -H "Content-Type: application/json" \
  -H "IEEE754Compatible: true" \
  -H "Prefer: odata.maxpagesize=49900" \
  "${PRIORITY_BASE_URL}LOGPART?\$select=PARTNAME,Y_5380_5_ESH&\$filter=STATDES%20eq%20'In%20Use'&\$top=50"
```

## Result (first 5 rows)

```json
[
  {"PARTNAME":"000","Y_5380_5_ESH":null},
  {"PARTNAME":"10025","Y_5380_5_ESH":"China"},
  {"PARTNAME":"10134","Y_5380_5_ESH":"China"},
  {"PARTNAME":"10135","Y_5380_5_ESH":"China"},
  {"PARTNAME":"10138","Y_5380_5_ESH":"China"}
]
```

## Full 50-row sample (distinct values observed)

`null`, `"China"`, `"New Zealand"`, `"Italy"`, `"France"`, `"USA"`

Approximately 50% of rows in the first 50 had a non-null value.

## Verdict: SAFE

HTTP 200. Field exists on the `LOGPART` OData entity type (unlike `Y_9952_5_ESH` which only exists on `ORDERITEMS_SUBFORM`). Returns real country-of-origin strings. Safe to include in `fetchProducts`'s `$select`.

## Contrast with the Y_9952_5_ESH trap

`Y_9952_5_ESH` (brand) is NOT on LOGPART — putting it in `$select` returns HTTP 400. But `Y_5380_5_ESH` (country of origin) IS on LOGPART — the XML metadata is correct in this case.

The naming pattern `Y_5380_5_ESH` follows the same `Y_XXXX_5_ESH` custom-field convention as `Y_9952_5_ESH`, yet it is registered on LOGPART. Not all `Y_*` fields are entity-specific to ORDERITEMS.

## Usage in fetchProducts

```ts
select: 'PARTNAME,PARTDES,FAMILYNAME,SPEC4,Y_5380_5_ESH,STATDES'
// SPEC4 = brand, Y_5380_5_ESH = country of origin
```

## One-line conclusion

`Y_5380_5_ESH` is a valid, live LOGPART field returning country-of-origin strings ("France", "USA", "Italy", etc.) — safe to add to `fetchProducts`'s `$select` for Task 9.
