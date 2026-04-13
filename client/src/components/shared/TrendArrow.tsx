// FILE: client/src/components/shared/TrendArrow.tsx
// PURPOSE: Reusable ▲/▼ trend indicator — green for improvement, red for decline
// USED BY: ItemsProductRow.tsx
// EXPORTS: TrendArrow

interface TrendArrowProps {
  current: number;
  previous: number;
}

/** WHY: No arrow when previous is 0 — means new SKU with no comparison baseline */
export function TrendArrow({ current, previous }: TrendArrowProps) {
  if (previous === 0) return null;
  const isUp = current > previous;
  return (
    <span className={`ml-0.5 text-[10px] ${isUp ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}`}>
      {isUp ? '▲' : '▼'}
    </span>
  );
}
