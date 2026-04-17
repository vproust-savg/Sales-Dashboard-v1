// FILE: client/src/components/right-panel/GroupedContactsTable.tsx
// PURPOSE: Contacts grouped per customer with collapsible sections.
//          Used for Zone/Vendor/Brand/Product Family/Product views where
//          contacts span multiple customers.
// USED BY: TabsSection.tsx
// EXPORTS: GroupedContactsTable

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Contact } from '@shared/types/dashboard';

interface Props {
  contacts: Contact[];
}

export function GroupedContactsTable({ contacts }: Props) {
  // WHY group client-side: server already provides customerName per row (per Codex #4).
  // Grouping here keeps the wire format flat and the UI control local.
  const groups = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of contacts) {
      const key = c.customerName ?? 'Unknown';
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [contacts]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  if (contacts.length === 0) {
    return (
      <p className="px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] text-[14px] text-[var(--color-text-muted)]">
        No contacts on file.
      </p>
    );
  }

  return (
    <div className="px-[var(--spacing-3xl)] py-[var(--spacing-lg)]">
      {groups.map(([customer, rows]) => {
        const open = expanded.has(customer);
        const listId = `contacts-group-${customer.replace(/\s+/g, '-')}`;
        const countLabel = `${rows.length} ${rows.length === 1 ? 'contact' : 'contacts'}`;
        return (
          <section
            key={customer}
            className="border-l-2 border-[var(--color-gold-subtle)] pl-[var(--spacing-md)] mb-[var(--spacing-md)]"
          >
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => toggle(customer)}
              className="w-full text-left py-[var(--spacing-sm)] flex justify-between items-center gap-[var(--spacing-md)]"
            >
              <span className="flex items-center gap-[var(--spacing-sm)] text-[14px] font-semibold text-[var(--color-text-primary)]">
                <span aria-hidden="true" className="text-[10px] text-[var(--color-gold-primary)]">
                  {open ? '▼' : '▶'}
                </span>
                {customer}
              </span>
              <span className="text-[12px] text-[var(--color-text-muted)] shrink-0">
                {countLabel}
              </span>
            </button>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  id={listId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <table className="w-full border-collapse mt-[var(--spacing-xs)]">
                    <thead>
                      <tr className="border-b border-[var(--color-gold-subtle)]">
                        {['Full Name', 'Position', 'Phone', 'Email'].map(col => (
                          <th
                            key={col}
                            className="px-[var(--spacing-md)] py-[var(--spacing-xs)] text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c, idx) => (
                        <tr
                          key={c.email || `${customer}-${idx}`}
                          className="border-b border-[var(--color-bg-page)] last:border-0"
                        >
                          <td className="px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[13px] text-[var(--color-text-primary)]">
                            {c.fullName}
                          </td>
                          <td className="px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[13px] text-[var(--color-text-secondary)]">
                            {c.position}
                          </td>
                          <td className="px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[13px] text-[var(--color-text-secondary)] whitespace-nowrap">
                            {c.phone}
                          </td>
                          <td className="px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[13px] truncate max-w-0">
                            <a
                              href={`mailto:${c.email}`}
                              className="text-[var(--color-gold-primary)] no-underline hover:underline"
                              title={c.email}
                            >
                              {c.email}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}
