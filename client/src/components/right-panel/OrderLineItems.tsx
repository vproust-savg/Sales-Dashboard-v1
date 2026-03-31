// FILE: client/src/components/right-panel/OrderLineItems.tsx
// PURPOSE: Sub-table showing line item details for an expanded order row
// USED BY: OrdersTable (expanded row)
// EXPORTS: OrderLineItems

import type { OrderLineItem } from '@shared/types/dashboard';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';
import { CopyableId } from '../shared/CopyableId';

interface OrderLineItemsProps {
  items: OrderLineItem[];
}

const COLUMNS = ['Product', 'SKU', 'Qty', 'Unit Price', 'Line Total', 'Margin %'] as const;

export function OrderLineItems({ items }: OrderLineItemsProps) {
  if (items.length === 0) {
    return (
      <div className="bg-[var(--color-bg-page)] py-[var(--spacing-base)]" style={{ paddingLeft: '48px' }}>
        <span className="text-[12px] text-[var(--color-text-muted)]">
          No line item details available.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-bg-page)]">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {COLUMNS.map((col, i) => (
              <th
                key={col}
                className={`py-[var(--spacing-sm)] text-[10px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide ${
                  i <= 1 ? 'text-left' : 'text-right'
                } ${i === 0 ? 'pl-[48px] pr-[var(--spacing-base)]' : 'px-[var(--spacing-base)]'}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.sku}
              className="border-t border-[var(--color-gold-subtle)]/50"
            >
              <td className="pl-[48px] pr-[var(--spacing-base)] py-[var(--spacing-sm)] text-[12px] text-[var(--color-text-secondary)] truncate max-w-[200px]">
                {item.productName}
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-sm)] text-[12px]">
                <CopyableId value={item.sku} label="SKU" className="text-[var(--color-text-faint)]" />
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-sm)] text-[12px] text-[var(--color-text-secondary)] tabular-nums text-right">
                {item.quantity} {item.unit}
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-sm)] text-[12px] text-[var(--color-text-secondary)] tabular-nums text-right">
                {formatCurrency(item.unitPrice)}
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-sm)] text-[12px] text-[var(--color-text-primary)] tabular-nums text-right">
                {formatCurrency(item.lineTotal)}
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-sm)] text-[12px] text-[var(--color-text-secondary)] tabular-nums text-right pr-[var(--spacing-3xl)]">
                {formatPercent(item.marginPercent)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
