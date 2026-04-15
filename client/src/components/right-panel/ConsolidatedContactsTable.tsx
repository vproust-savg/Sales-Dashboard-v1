// FILE: client/src/components/right-panel/ConsolidatedContactsTable.tsx
// PURPOSE: Contacts table variant with Customer column — used in Report / View Consolidated mode
// USED BY: client/src/components/right-panel/TabsSection.tsx
// EXPORTS: ConsolidatedContactsTable

import { useMemo, useState } from 'react';
import type { Contact } from '@shared/types/dashboard';

type SortKey = 'customer' | 'fullName' | 'position' | 'email' | 'phone';
type SortDir = 'asc' | 'desc';

interface ConsolidatedContactsTableProps {
  contacts: Contact[];
}

export function ConsolidatedContactsTable({ contacts }: ConsolidatedContactsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('customer');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    const arr = [...contacts];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'customer': cmp = (a.customerName ?? '').localeCompare(b.customerName ?? ''); break;
        case 'fullName': cmp = a.fullName.localeCompare(b.fullName); break;
        case 'position': cmp = a.position.localeCompare(b.position); break;
        case 'email': cmp = a.email.localeCompare(b.email); break;
        case 'phone': cmp = a.phone.localeCompare(b.phone); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [contacts, sortKey, sortDir]);

  const onHeaderClick = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  return (
    <div className="overflow-auto rounded-[var(--radius-base)] border border-[var(--color-gold-subtle)]">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-[var(--color-bg-card)]">
          <tr className="border-b border-[var(--color-gold-subtle)]">
            <Th label="Customer" k="customer" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Name" k="fullName" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Position" k="position" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Email" k="email" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label="Phone" k="phone" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => (
            <tr key={`${c.customerName ?? ''}-${c.fullName}-${i}`} className="border-b border-[var(--color-gold-subtle)] last:border-b-0 hover:bg-[var(--color-gold-subtle)]">
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-primary)]">{c.customerName ?? '\u2014'}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{c.fullName || '\u2014'}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{c.position || '\u2014'}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{c.email || '\u2014'}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{c.phone || '\u2014'}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={5} className="p-[var(--spacing-2xl)] text-center text-[var(--color-text-muted)]">No contacts</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label, k, active, dir, onClick,
}: {
  label: string; k: SortKey; active: SortKey; dir: SortDir; onClick: (k: SortKey) => void;
}) {
  const isActive = active === k;
  return (
    <th
      onClick={() => onClick(k)}
      className="cursor-pointer select-none px-[var(--spacing-md)] py-[var(--spacing-sm)] text-left text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
    >
      {label}{isActive ? (dir === 'asc' ? ' \u2191' : ' \u2193') : ''}
    </th>
  );
}
