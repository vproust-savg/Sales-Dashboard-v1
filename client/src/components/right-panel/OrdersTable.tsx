// FILE: client/src/components/right-panel/OrdersTable.tsx
// PURPOSE: Orders data table with date, order#, items, amount, margin, status badges
// USED BY: TabsSection (Orders tab)
// EXPORTS: OrdersTable

import type { OrderRow } from '@shared/types/dashboard';
import { formatCurrency, formatPercent, formatDate } from '@shared/utils/formatting';
import { EmptyState } from '../shared/EmptyState';

interface OrdersTableProps {
  orders: OrderRow[];
}

const COLUMNS = ['Date', 'Order #', 'Items', 'Amount', 'Margin %', 'Margin $', 'Status'] as const;

/** WHY status colors map — spec Section 4.4 / 10.4: Delivered=green, Pending=yellow, Processing=blue */
const STATUS_STYLES: Record<OrderRow['status'], string> = {
  Delivered: 'bg-[#dcfce7] text-[var(--color-green)]',
  Pending: 'bg-[#fef9c3] text-[var(--color-yellow)]',
  Processing: 'bg-[#dbeafe] text-[var(--color-blue)]',
};

export function OrdersTable({ orders }: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders for this period."
        description="Orders will appear here when available."
      />
    );
  }

  /** WHY sorted copy — spec Section 13.6 mandates date descending, we don't mutate props */
  const sorted = [...orders].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--color-gold-subtle)]">
            {COLUMNS.map((col) => (
              <th
                key={col}
                className="px-[var(--spacing-3xl)] py-[var(--spacing-lg)] text-left text-[11px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((order) => (
            <tr
              key={order.orderNumber}
              className="border-b border-[var(--color-bg-page)]"
            >
              <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-primary)] whitespace-nowrap">
                {formatDate(order.date)}
              </td>
              <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] font-medium text-[var(--color-text-primary)]">
                {order.orderNumber}
              </td>
              <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-secondary)] text-center">
                {order.itemCount}
              </td>
              <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-primary)] tabular-nums">
                {formatCurrency(order.amount)}
              </td>
              <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-secondary)] tabular-nums">
                {formatPercent(order.marginPercent)}
              </td>
              <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-secondary)] tabular-nums">
                {formatCurrency(order.marginAmount)}
              </td>
              <td className="px-[var(--spacing-3xl)] py-[var(--spacing-base)]">
                <StatusBadge status={order.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderRow['status'] }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
