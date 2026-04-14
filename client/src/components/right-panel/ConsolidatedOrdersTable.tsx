// FILE: client/src/components/right-panel/ConsolidatedOrdersTable.tsx
// PURPOSE: Orders table variant with Customer column — used in Report 2 / View Consolidated 2 mode
// USED BY: client/src/components/right-panel/TabsSection.tsx
// EXPORTS: ConsolidatedOrdersTable

import { useMemo, useState } from 'react';
import type { OrderRow } from '@shared/types/dashboard';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';

type SortKey = 'date' | 'customer' | 'orderNumber' | 'itemCount' | 'amount' | 'marginPercent' | 'status';
type SortDir = 'asc' | 'desc';

interface ConsolidatedOrdersTableProps {
  orders: OrderRow[];
}

export function ConsolidatedOrdersTable({ orders }: ConsolidatedOrdersTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    const arr = [...orders];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date': cmp = a.date.localeCompare(b.date); break;
        case 'customer': cmp = (a.customerName ?? '').localeCompare(b.customerName ?? ''); break;
        case 'orderNumber': cmp = a.orderNumber.localeCompare(b.orderNumber); break;
        case 'itemCount': cmp = a.itemCount - b.itemCount; break;
        case 'amount': cmp = a.amount - b.amount; break;
        case 'marginPercent': cmp = a.marginPercent - b.marginPercent; break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [orders, sortKey, sortDir]);

  const onHeaderClick = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'customer' || key === 'orderNumber' || key === 'status' ? 'asc' : 'desc'); }
  };

  return (
    <div className="overflow-auto rounded-[var(--radius-base)] border border-[var(--color-gold-subtle)]">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-[var(--color-bg-card)]">
          <tr className="border-b border-[var(--color-gold-subtle)]">
            <Th label="Date" k="date" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Customer" k="customer" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Order #" k="orderNumber" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Items" k="itemCount" active={sortKey} dir={sortDir} onClick={onHeaderClick} align="right" />
            <Th label="Amount" k="amount" active={sortKey} dir={sortDir} onClick={onHeaderClick} align="right" />
            <Th label="Margin %" k="marginPercent" active={sortKey} dir={sortDir} onClick={onHeaderClick} align="right" />
            <Th label="Status" k="status" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(o => (
            <tr key={o.orderNumber} className="border-b border-[var(--color-gold-subtle)] last:border-b-0 hover:bg-[var(--color-gold-subtle)]">
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{o.date.slice(0, 10)}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-primary)]">{o.customerName ?? '\u2014'}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] font-mono text-[var(--color-text-secondary)]">{o.orderNumber}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-secondary)]">{o.itemCount}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-secondary)]">{formatCurrency(o.amount)}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-secondary)]">{formatPercent(o.marginPercent)}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{o.status}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={7} className="p-[var(--spacing-2xl)] text-center text-[var(--color-text-muted)]">No orders</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label, k, active, dir, onClick, align = 'left',
}: {
  label: string; k: SortKey; active: SortKey; dir: SortDir; onClick: (k: SortKey) => void; align?: 'left' | 'right';
}) {
  const isActive = active === k;
  return (
    <th
      onClick={() => onClick(k)}
      className={`cursor-pointer select-none px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] ${align === 'right' ? 'text-right' : 'text-left'} hover:text-[var(--color-text-secondary)]`}
    >
      {label}{isActive ? (dir === 'asc' ? ' \u2191' : ' \u2193') : ''}
    </th>
  );
}
