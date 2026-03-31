// FILE: client/src/components/right-panel/OrderLineItems.tsx
// PURPOSE: Sub-table showing line item details for an expanded order row
// USED BY: OrdersTable (expanded row)
// EXPORTS: OrderLineItems

import type { OrderLineItem } from '@shared/types/dashboard';
import { formatCurrency } from '@shared/utils/formatting';
import { CopyableId } from '../shared/CopyableId';

interface OrderLineItemsProps {
  items: OrderLineItem[];
}

/** WHY: SKU first — B2B users scan by SKU code, not product name */
const COLUMNS = ['SKU', 'Product', 'Qty', 'Unit Price', 'Line Total'] as const;

export function OrderLineItems({ items }: OrderLineItemsProps) {
  if (items.length === 0) {
    return (
      <div className="mx-[var(--spacing-3xl)] my-[var(--spacing-md)] rounded-[var(--radius-base)] bg-[var(--color-bg-card)] border-l-[3px] border-l-[var(--color-gold-primary)] py-[var(--spacing-base)] pl-[var(--spacing-3xl)]">
        <span className="text-[12px] text-[var(--color-text-muted)]">
          No line item details available.
        </span>
      </div>
    );
  }

  return (
    <div className="mx-[var(--spacing-3xl)] my-[var(--spacing-md)] rounded-[var(--radius-base)] bg-[var(--color-bg-card)] border-l-[3px] border-l-[var(--color-gold-primary)] shadow-[var(--shadow-card)] overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse">
        <thead>
          <tr>
            {COLUMNS.map((col, i) => (
              <th
                key={col}
                className={`py-[var(--spacing-sm)] text-[10px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide ${
                  i <= 1 ? 'text-left' : 'text-right'
                } ${i === 0 ? 'pl-[var(--spacing-3xl)] pr-[var(--spacing-base)]' : 'px-[var(--spacing-base)]'} ${
                  i === COLUMNS.length - 1 ? 'pr-[var(--spacing-3xl)]' : ''
                }`}
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
              className="border-t border-[var(--color-gold-subtle)]"
            >
              <td className="pl-[var(--spacing-3xl)] pr-[var(--spacing-base)] py-[var(--spacing-md)] text-[12px]">
                <CopyableId value={item.sku} label="SKU" className="text-[var(--color-text-muted)]" />
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-md)] text-[12px] text-[var(--color-text-secondary)]">
                {item.productName}
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-md)] text-[12px] text-[var(--color-text-secondary)] tabular-nums text-right whitespace-nowrap">
                {item.quantity} {item.unit}
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-md)] text-[12px] text-[var(--color-text-secondary)] tabular-nums text-right whitespace-nowrap">
                {formatCurrency(item.unitPrice)}
              </td>
              <td className="px-[var(--spacing-base)] py-[var(--spacing-md)] text-[12px] text-[var(--color-text-primary)] font-medium tabular-nums text-right pr-[var(--spacing-3xl)] whitespace-nowrap">
                {formatCurrency(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
