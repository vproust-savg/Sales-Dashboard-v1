// FILE: client/src/components/right-panel/ItemsProductRow.tsx
// PURPOSE: Single product row in Items table (name, SKU, value, margins)
// USED BY: ItemsTable.tsx
// EXPORTS: ItemsProductRow

import type { FlatItem } from '@shared/types/dashboard';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';
import { CopyableId } from '../shared/CopyableId';

interface ItemsProductRowProps {
  item: FlatItem;
  depth: number;
}

export function ItemsProductRow({ item, depth }: ItemsProductRowProps) {
  /** WHY: depth * 24px + 24px base = indentation under deepest group level */
  const paddingLeft = `${depth * 24 + 24}px`;

  return (
    <div
      role="row"
      aria-level={depth + 1}
      className="flex items-center border-b border-[var(--color-bg-page)] py-[var(--spacing-md)] hover:bg-[var(--color-gold-hover)] transition-colors duration-150"
      style={{ paddingLeft, paddingRight: 'var(--spacing-3xl)' }}
    >
      <div role="gridcell" className="flex-1 min-w-0">
        <span className="block text-[14px] text-[var(--color-text-primary)] truncate">
          {item.name}
        </span>
        <CopyableId value={item.sku} label="SKU" className="block text-[12px] text-[var(--color-text-muted)]" />
      </div>
      <div role="gridcell" className="w-28 text-right text-[14px] tabular-nums text-[var(--color-text-primary)]">
        {formatCurrency(item.value)}
      </div>
      <div role="gridcell" className="w-24 text-right text-[14px] tabular-nums text-[var(--color-text-muted)]">
        {formatPercent(item.marginPercent)}
      </div>
      <div role="gridcell" className="w-28 text-right text-[14px] tabular-nums text-[var(--color-text-muted)]">
        {formatCurrency(item.marginAmount)}
      </div>
    </div>
  );
}
