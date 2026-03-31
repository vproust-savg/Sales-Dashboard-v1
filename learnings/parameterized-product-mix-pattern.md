# Parameterized Field Extractor for Product Mix Aggregation

## The Pattern

When computing the same aggregation (group-by + sum + percentage) across multiple category fields on the same dataset, use a parameterized field extractor instead of duplicating the function.

```typescript
function computeProductMix(
  items: RawOrderItem[],
  getCategory: (item: RawOrderItem) => string,
): ProductMixSegment[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const cat = getCategory(item) || 'Unknown';
    map.set(cat, (map.get(cat) ?? 0) + value);
  }
  // sort descending, compute percentages, filter zero-value
}
```

Then call it 5 times with different extractors:

```typescript
function computeAllProductMixes(items: RawOrderItem[]): Record<ProductMixType, ProductMixSegment[]> {
  return {
    productType:      computeProductMix(items, i => i.Y_3021_5_ESH),
    productFamily:    computeProductMix(items, i => i.Y_2075_5_ESH),
    brand:            computeProductMix(items, i => i.Y_9952_5_ESH),
    countryOfOrigin:  computeProductMix(items, i => i.Y_5380_5_ESH),
    foodServiceRetail: computeProductMix(items, i => i.Y_9967_5_ESH === 'Y' ? 'Retail' : 'Food Service'),
  };
}
```

## Why This Works Well

- **One function, 5 uses** — any fix to sorting/percentage logic applies everywhere
- **Field extractor handles transforms** — the FS vs Retail `'Y' ? 'Retail' : 'Food Service'` mapping lives inline
- **Zero-value filter once** — `.filter(([, value]) => value > 0)` in `computeProductMix` protects all 5 mixes
- **Type-safe** — `Record<ProductMixType, ProductMixSegment[]>` ensures all 5 are present

## When to Use

Any time you're running the same group-by aggregation across different fields of the same dataset. The key insight: the aggregation logic is identical, only the "which field?" part varies.

## Discovered

2026-03-31 — during product mix carousel implementation (5 donut chart types from same ORDERITEMS data)
