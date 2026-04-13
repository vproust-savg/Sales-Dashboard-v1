// FILE: client/src/components/right-panel/OrdersTable.tsx
// PURPOSE: Orders data table with expandable rows showing line item details
// USED BY: TabsSection (Orders tab)
// EXPORTS: OrdersTable

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OrderRow } from '@shared/types/dashboard';
import { formatCurrency, formatPercent, formatDate } from '@shared/utils/formatting';
import { CopyableId } from '../shared/CopyableId';
import { EmptyState } from '../shared/EmptyState';
import { OrderLineItems } from './OrderLineItems';

interface OrdersTableProps {
  orders: OrderRow[];
}

const COLUMNS = ['', 'Date', 'Order #', 'Items', 'Amount', 'Margin %', 'Margin $', 'Status'] as const;

/** WHY: Raw Priority status names — spec Section 10.4 */
const STATUS_STYLES: Record<string, string> = {
  Open: 'bg-[#dbeafe] text-[var(--color-blue)]',
  Closed: 'bg-[#dcfce7] text-[var(--color-green)]',
  'Partially Filled': 'bg-[#fef9c3] text-[var(--color-yellow)]',
};
const DEFAULT_STATUS_STYLE = 'bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)]';

export function OrdersTable({ orders }: OrdersTableProps) {
  /** WHY: string | null not Set — only one row open at a time (accordion behavior) */
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders for this period."
        description="Orders will appear here when available."
      />
    );
  }

  function toggleRow(orderNumber: string) {
    setExpandedOrder(prev => (prev === orderNumber ? null : orderNumber));
  }

  const sorted = [...orders].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--color-gold-subtle)]">
            {COLUMNS.map((col, i) => (
              <th
                key={col || 'chevron'}
                className={`px-[var(--spacing-lg)] py-[var(--spacing-lg)] text-left text-[12px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide whitespace-nowrap ${
                  i === 0 ? 'w-8 px-0 pl-[var(--spacing-3xl)]' : ''
                } ${i === 1 ? 'pl-[var(--spacing-3xl)]' : ''}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((order) => {
            const isExpanded = expandedOrder === order.orderNumber;
            return (
              <OrderRowGroup
                key={order.orderNumber}
                order={order}
                isExpanded={isExpanded}
                onToggle={() => toggleRow(order.orderNumber)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --- Single order row + expandable detail --- */

interface OrderRowGroupProps {
  order: OrderRow;
  isExpanded: boolean;
  onToggle: () => void;
}

function OrderRowGroup({ order, isExpanded, onToggle }: OrderRowGroupProps) {
  return (
    <>
      <tr
        className="border-b border-[var(--color-bg-page)] cursor-pointer hover:bg-[var(--color-gold-hover)] transition-colors duration-150"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        aria-expanded={isExpanded}
      >
        {/* Chevron — CSS rotation, matching ItemsAccordion pattern */}
        <td className="w-8 px-0 pl-[var(--spacing-3xl)] py-[var(--spacing-base)]">
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none"
            className={`shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            aria-hidden="true"
          >
            <path d="M5 3l4 4-4 4" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </td>
        <td className="pl-[var(--spacing-3xl)] pr-[var(--spacing-lg)] py-[var(--spacing-base)] text-[14px] text-[var(--color-text-primary)] whitespace-nowrap">
          {formatDate(order.date)}
        </td>
        <td className="px-[var(--spacing-lg)] py-[var(--spacing-base)] text-[14px] font-medium text-[var(--color-text-primary)]">
          <CopyableId value={order.orderNumber} label="Order #" />
        </td>
        <td className="px-[var(--spacing-lg)] py-[var(--spacing-base)] text-[14px] text-[var(--color-text-secondary)] text-center">
          {order.itemCount}
        </td>
        <td className="px-[var(--spacing-lg)] py-[var(--spacing-base)] text-[14px] text-[var(--color-text-primary)] tabular-nums">
          {formatCurrency(order.amount)}
        </td>
        <td className="px-[var(--spacing-lg)] py-[var(--spacing-base)] text-[14px] text-[var(--color-text-secondary)] tabular-nums">
          {formatPercent(order.marginPercent)}
        </td>
        <td className="px-[var(--spacing-lg)] py-[var(--spacing-base)] text-[14px] text-[var(--color-text-secondary)] tabular-nums">
          {formatCurrency(order.marginAmount)}
        </td>
        <td className="px-[var(--spacing-lg)] py-[var(--spacing-base)]">
          <span className={`inline-block px-2 py-0.5 rounded-full text-[12px] font-semibold whitespace-nowrap ${STATUS_STYLES[order.status] ?? DEFAULT_STATUS_STYLE}`}>
            {order.status}
          </span>
        </td>
      </tr>

      {/* Expanded line items — AnimatePresence with initial={false} to prevent mount animation */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <tr key={`${order.orderNumber}-detail`}>
            <td colSpan={8} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <OrderLineItems items={order.items} />
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}
