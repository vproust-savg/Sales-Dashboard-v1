// FILE: client/src/utils/items-deltas.ts
// PURPOSE: Compute YoY delta values for a FlatItem (used by compare toggle sub-row)
// USED BY: ItemsCompareRow.tsx
// EXPORTS: computeItemDeltas, ItemDeltas

import type { FlatItem } from '@shared/types/dashboard';

export interface ItemDeltas {
  /** Percent change in value vs previous year, null if no prev data */
  valueDelta: number | null;
  /** Percentage points change in margin vs previous year, null if no prev data */
  marginDelta: number | null;
  /** Percent change in margin amount vs previous year, null if no prev data */
  marginAmountDelta: number | null;
  /** Absolute change in units vs previous year, null if no prev data */
  unitsDelta: number | null;
}

/** WHY: Returns null for each delta when no prev-year baseline — prevents misleading comparisons */
export function computeItemDeltas(item: FlatItem): ItemDeltas {
  const hasPrev = item.prevYearValue > 0;
  const prevMarginAmount = hasPrev ? (item.prevYearMarginPercent / 100) * item.prevYearValue : 0;

  return {
    valueDelta: hasPrev
      ? ((item.value - item.prevYearValue) / item.prevYearValue) * 100
      : null,
    marginDelta: hasPrev
      ? item.marginPercent - item.prevYearMarginPercent
      : null,
    marginAmountDelta: hasPrev && Math.abs(prevMarginAmount) > 0.01
      ? ((item.marginAmount - prevMarginAmount) / Math.abs(prevMarginAmount)) * 100
      : null,
    unitsDelta: item.prevYearUnits > 0
      ? item.totalUnits - item.prevYearUnits
      : null,
  };
}
