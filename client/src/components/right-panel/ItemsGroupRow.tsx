// FILE: client/src/components/right-panel/ItemsGroupRow.tsx
// PURPOSE: Collapsible group header row (chevron, label, badge, aggregated metrics)
// USED BY: ItemsTable.tsx
// EXPORTS: ItemsGroupRow

import type { GroupNode } from '../../utils/items-grouping';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';

interface ItemsGroupRowProps {
  group: GroupNode;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ItemsGroupRow({ group, depth, isExpanded, onToggle }: ItemsGroupRowProps) {
  const paddingLeft = `${depth * 24}px`;

  return (
    <button
      type="button"
      role="row"
      aria-expanded={isExpanded}
      aria-level={depth + 1}
      onClick={onToggle}
      className={`flex w-full items-center bg-[var(--color-gold-hover)] border-b border-[var(--color-gold-subtle)] py-[var(--spacing-base)] hover:bg-[var(--color-gold-subtle)] transition-colors duration-150${depth > 0 ? ' border-l-2 border-l-[var(--color-gold-primary)]' : ''}`}
      style={{ paddingLeft: `calc(${paddingLeft} + var(--spacing-3xl))`, paddingRight: 'var(--spacing-3xl)' }}
    >
      <svg
        width="14" height="14" viewBox="0 0 14 14" fill="none"
        className={`mr-2 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        aria-hidden="true"
      >
        <path d="M5 3l4 4-4 4" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <span className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate">
        {group.label}
      </span>

      <span className="ml-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-gold-subtle)] px-1 text-[9px] font-semibold text-[var(--color-text-muted)]">
        {group.totals.itemCount}
      </span>

      {/* WHY: flex-1 spacer pushes metrics to the right, keeping label left-aligned */}
      <div className="flex-1" />

      <span role="gridcell" className="w-24 text-right text-[14px] tabular-nums text-[var(--color-text-primary)]">
        {formatCurrency(group.totals.value)}
      </span>
      <span role="gridcell" className="w-24 text-right text-[14px] tabular-nums text-[var(--color-text-secondary)]">
        {formatPercent(group.totals.marginPercent)}
      </span>
      <span role="gridcell" className="w-24 text-right text-[14px] tabular-nums text-[var(--color-text-secondary)]">
        {formatCurrency(group.totals.marginAmount)}
      </span>
      <span role="gridcell" className="w-24 text-right text-[14px] text-[var(--color-text-faint)]">{'\u2014'}</span>
      <span role="gridcell" className="w-20 text-right text-[14px] text-[var(--color-text-faint)]">{'\u2014'}</span>
      <span role="gridcell" className="w-24 text-right text-[14px] text-[var(--color-text-faint)]">{'\u2014'}</span>
      <span role="gridcell" className="w-24 text-right text-[14px] text-[var(--color-text-faint)]">{'\u2014'}</span>
    </button>
  );
}
