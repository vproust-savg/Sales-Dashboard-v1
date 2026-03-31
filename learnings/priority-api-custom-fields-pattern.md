# Priority API: Custom Field Naming Pattern

## Pattern

Custom fields added to Priority entities follow the naming convention: `Y_XXXX_5_ESH`

- `Y_` prefix indicates a custom (user-defined) field
- `XXXX` is a 4-character alphanumeric code
- `_5_ESH` is a company-specific suffix

## ORDERITEMS Custom Fields Used in This Dashboard

| Field | Maps to | Purpose |
|-------|---------|---------|
| `Y_2K28_5_ESH` | Vendor Code | Links order item to supplier |
| `Y_2HZQ_5_ESH` | Vendor Name | Display name for vendor dimension |
| `Y_2I8Z_5_ESH` | Brand | Brand grouping for dimension |
| `Y_2IAI_5_ESH` | Family Type | Product type grouping for dimension |
| `Y_2J31_5_ESH` | Family Type Name | Display name for product type dimension |
| `Y_3021_5_ESH` | Product Type (alt) | Product type category used in product mix aggregation |
| `Y_9952_5_ESH` | Brand (alt) | Brand field used in product mix aggregation |
| `Y_2075_5_ESH` | Product Family | Product family grouping for product mix |
| `Y_5380_5_ESH` | Country of Origin | Country of origin for product mix |
| `Y_9967_5_ESH` | FS vs Retail flag | `'Y'` = Retail, anything else = Food Service |

## Standard Fields Used

| Field | Purpose |
|-------|---------|
| `TUNITNAME` | Unit of measure name (MaxLength 3, e.g. "cs", "ea", "lb"). Can be empty — default to `'units'` |

## Important

These field names are specific to this Priority installation. Other Priority instances will have different custom field codes. The XML metadata (`tools/Priority ERP March 30.xml`) is the source of truth.

## Discovered

2026-03-30 — during ERP field mapping research
