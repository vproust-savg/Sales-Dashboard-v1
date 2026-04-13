// FILE: client/src/components/right-panel/ItemsProductRow.tsx
// PURPOSE: Single product row in Items table (name, SKU, value, margins, units, freq, last price, last order)
// USED BY: ItemsTable.tsx
// EXPORTS: ItemsProductRow

import type { FlatItem } from '@shared/types/dashboard';
import { formatCurrency, formatInteger, formatPercent } from '@shared/utils/formatting';
import { CopyableId } from '../shared/CopyableId';
import { TrendArrow } from '../shared/TrendArrow';
import { ItemsCompareRow } from './ItemsCompareRow';

interface ItemsProductRowProps {
  item: FlatItem;
  depth: number;
  showCompare: boolean;
}

function formatLastOrder(isoDate: string | null): { text: string; color: string } {
  if (!isoDate) return { text: '\u2014', color: 'var(--color-text-muted)' };
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
  const text = days <= 0 ? 'Today' : days === 1 ? '1d' : days < 7 ? `${days}d` : days < 30 ? `${Math.floor(days / 7)}w` : `${Math.floor(days / 30)}mo`;
  let color = 'var(--color-red)';
  if (days <= 14) color = 'var(--color-green)';
  else if (days <= 45) color = 'var(--color-gold-primary)';
  else if (days <= 90) color = 'var(--color-yellow)';
  return { text, color };
}

export function ItemsProductRow({ item, depth, showCompare }: ItemsProductRowProps) {
  /** WHY: depth * 24px + 24px base = indentation under deepest group level */
  const paddingLeft = `${depth * 24 + 24}px`;
  const lastOrder = formatLastOrder(item.lastOrderDate);
  /** WHY: Compute prev margin amount from prev year data for TrendArrow comparison */
  const prevMarginAmount = item.prevYearValue > 0 ? (item.prevYearMarginPercent / 100) * item.prevYearValue : 0;

  return (
    <>
      <div
        role="row"
        aria-level={depth + 1}
        className="flex items-center border-b border-[var(--color-bg-page)] py-[var(--spacing-md)] hover:bg-[var(--color-gold-hover)] transition-colors duration-150"
        style={{ paddingLeft, paddingRight: 'var(--spacing-3xl)' }}
      >
        <div role="gridcell" className="flex-1 min-w-0">
          <span className="block text-[14px] text-[var(--color-text-primary)] truncate">{item.name}</span>
          <CopyableId value={item.sku} label="SKU" className="block text-[12px] text-[var(--color-text-muted)]" />
        </div>
        <div role="gridcell" className="w-24 text-right text-[14px] tabular-nums text-[var(--color-text-primary)]">
          {formatCurrency(item.value)}
          <TrendArrow current={item.value} previous={item.prevYearValue} />
        </div>
        <div role="gridcell" className="w-24 text-right text-[14px] tabular-nums text-[var(--color-text-muted)]">
          {formatPercent(item.marginPercent)}
          <TrendArrow current={item.marginPercent} previous={item.prevYearMarginPercent} />
        </div>
        <div role="gridcell" className="w-24 text-right text-[14px] tabular-nums text-[var(--color-text-muted)]">
          {formatCurrency(item.marginAmount)}
          <TrendArrow current={item.marginAmount} previous={prevMarginAmount} />
        </div>
        <div role="gridcell" className="w-24 text-right text-[14px] tabular-nums text-[var(--color-text-muted)]">
          {formatInteger(item.totalUnits)} {item.unitName}
          <TrendArrow current={item.totalUnits} previous={item.prevYearUnits} />
        </div>
        <div role="gridcell" className="w-20 text-right text-[14px] tabular-nums text-[var(--color-text-muted)]">
          {item.purchaseFrequency.toFixed(1)}/mo
        </div>
        <div role="gridcell" className="w-24 text-right text-[14px] tabular-nums text-[var(--color-text-muted)]">
          {formatCurrency(item.lastPrice)}
        </div>
        <div role="gridcell" className="w-24 text-right text-[14px] tabular-nums flex items-center justify-end gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lastOrder.color }} />
          <span style={{ color: lastOrder.color }}>{lastOrder.text}</span>
        </div>
      </div>
      {showCompare && <ItemsCompareRow item={item} paddingLeft={paddingLeft} />}
    </>
  );
}
