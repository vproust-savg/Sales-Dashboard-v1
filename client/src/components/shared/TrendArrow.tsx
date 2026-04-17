// FILE: client/src/components/shared/TrendArrow.tsx
// PURPOSE: Inline ▲/▼/— indicator comparing current to previous value.
//          Color green if current is favorable vs prev, red if unfavorable,
//          em-dash if prev is null/0 (no comparison baseline available).
// USED BY: PerCustomerKPITable.tsx, ItemsProductRow.tsx
// EXPORTS: TrendArrow

interface TrendArrowProps {
  current: number | null;
  /** WHY: nullable — some entities have no prior-year data (new customers, new SKUs). */
  prev: number | null;
  /** WHY inverted: some metrics improve as they decrease (e.g., days-since-order). */
  inverted?: boolean;
}

/** WHY: No arrow when prev is null or 0 — 0 means new SKU with no comparison baseline. */
export function TrendArrow({ current, prev, inverted = false }: TrendArrowProps) {
  if (current == null || prev == null || prev === 0) {
    return <span data-testid="trend-arrow" className="text-[var(--color-text-muted)]">—</span>;
  }
  if (current === prev) {
    return <span data-testid="trend-arrow" className="text-[var(--color-text-muted)]">—</span>;
  }
  const rawUp = current > prev;
  const up = inverted ? !rawUp : rawUp;
  const arrow = up ? '▲' : '▼';
  const className = up
    ? 'text-[var(--color-trend-positive)]'
    : 'text-[var(--color-trend-negative)]';
  return <span data-testid="trend-arrow" className={className}>{arrow}</span>;
}
