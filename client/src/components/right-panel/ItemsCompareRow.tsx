// FILE: client/src/components/right-panel/ItemsCompareRow.tsx
// PURPOSE: YoY delta sub-row shown when Compare toggle is active
// USED BY: ItemsProductRow.tsx
// EXPORTS: ItemsCompareRow

import type { FlatItem } from '@shared/types/dashboard';
import { computeItemDeltas } from '../../utils/items-deltas';

interface Props {
  item: FlatItem;
  paddingLeft: string;
}

export function ItemsCompareRow({ item, paddingLeft }: Props) {
  const d = computeItemDeltas(item);
  if (item.prevYearValue === 0) return null;

  return (
    <div
      className="flex items-center border-b border-[var(--color-bg-page)] py-[2px] text-[10px]"
      style={{ paddingLeft, paddingRight: 'var(--spacing-3xl)' }}
    >
      <div className="flex-1" />
      <DeltaCell value={d.valueDelta} suffix="%" width="w-24" />
      <div className="w-24" />
      <DeltaCell value={d.marginDelta} suffix="pp" width="w-28" />
      <DeltaCell value={d.marginAmountDelta} suffix="%" width="w-24" />
      <DeltaCell value={d.unitsDelta} suffix=" units" isAbsolute width="w-24" />
      <div className="w-20" />
      <div className="w-24" />
    </div>
  );
}

function DeltaCell({ value, suffix, isAbsolute, width }: {
  value: number | null; suffix: string; isAbsolute?: boolean; width: string;
}) {
  if (value === null) return <div className={`${width} text-right text-[var(--color-text-faint)]`}>{'\u2014'}</div>;
  const isPositive = value > 0;
  const color = isPositive ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]';
  const sign = isPositive ? '+' : '';
  const formatted = isAbsolute ? `${sign}${Math.round(value)}` : `${sign}${value.toFixed(1)}`;
  return <div className={`${width} text-right ${color}`}>{formatted}{suffix}</div>;
}
