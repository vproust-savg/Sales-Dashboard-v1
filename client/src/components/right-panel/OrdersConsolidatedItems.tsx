// FILE: client/src/components/right-panel/OrdersConsolidatedItems.tsx
// PURPOSE: Collapsible SKU-level summary table below the orders table
// USED BY: OrdersTab.tsx
// EXPORTS: OrdersConsolidatedItems

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ConsolidatedOrderItem } from '../../utils/consolidate-order-items';
import { CopyableId } from '../shared/CopyableId';
import { formatCurrency } from '@shared/utils/formatting';

/** WHY gold vs neutral: spec says top 3 get gold badges, 4+ get neutral */
function rankBadgeClasses(rank: number): string {
  if (rank <= 3) return 'bg-[var(--color-gold-primary)] text-white';
  return 'bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)]';
}

const HEADER_CLASSES = 'text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]';
const CELL_CLASSES = 'py-[var(--spacing-sm)] text-[13px] text-[var(--color-text-primary)]';

export function OrdersConsolidatedItems({ items }: { items: ConsolidatedOrderItem[] }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (items.length === 0) return null;

  return (
    <div className="mt-[var(--spacing-xl)]">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex w-full cursor-pointer items-center gap-[var(--spacing-sm)] py-[var(--spacing-sm)]"
      >
        <svg
          width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"
          className={`shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        >
          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">Items Summary</span>
        <span className="rounded-[var(--radius-sm)] bg-[var(--color-gold-subtle)] px-[6px] py-[1px] text-[11px] font-medium text-[var(--color-text-muted)]">
          {items.length}
        </span>
      </button>

      {/* Animated table body */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <table className="mt-[var(--spacing-sm)] w-full">
              <thead>
                <tr className="border-b border-[var(--color-gold-subtle)]">
                  <th className={`${HEADER_CLASSES} w-8 pb-[var(--spacing-sm)] text-center`}>#</th>
                  <th className={`${HEADER_CLASSES} pb-[var(--spacing-sm)] pl-[var(--spacing-lg)] text-left`}>Product</th>
                  <th className={`${HEADER_CLASSES} pb-[var(--spacing-sm)] text-right`}>Qty</th>
                  <th className={`${HEADER_CLASSES} pb-[var(--spacing-sm)] text-right`}>Value</th>
                  <th className={`${HEADER_CLASSES} pb-[var(--spacing-sm)] text-right`}>Orders</th>
                  <th className={`${HEADER_CLASSES} pb-[var(--spacing-sm)] pr-[var(--spacing-3xl)] text-right`}>Last Price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.sku} className="border-b border-[var(--color-gold-subtle)]/50">
                    <td className={`${CELL_CLASSES} text-center`}>
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-[var(--radius-md)] text-[10px] font-semibold ${rankBadgeClasses(idx + 1)}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className={`${CELL_CLASSES} pl-[var(--spacing-lg)]`}>
                      <p className="truncate text-[13px] font-medium leading-tight">{item.productName}</p>
                      <CopyableId value={item.sku} label="SKU" className="text-[11px] text-[var(--color-text-muted)]" />
                    </td>
                    <td className={`${CELL_CLASSES} text-right tabular-nums`}>
                      {item.totalQuantity.toLocaleString('en-US')} {item.unit}
                    </td>
                    <td className={`${CELL_CLASSES} text-right font-medium tabular-nums`}>
                      {formatCurrency(item.totalValue)}
                    </td>
                    <td className={`${CELL_CLASSES} text-right tabular-nums`}>{item.orderCount}</td>
                    <td className={`${CELL_CLASSES} pr-[var(--spacing-3xl)] text-right tabular-nums text-[var(--color-text-secondary)]`}>
                      {formatCurrency(item.lastPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
