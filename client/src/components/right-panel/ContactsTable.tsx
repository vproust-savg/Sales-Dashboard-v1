// FILE: client/src/components/right-panel/ContactsTable.tsx
// PURPOSE: Contacts table with name, position, phone, email (gold mailto link)
// USED BY: TabsSection (Contacts tab)
// EXPORTS: ContactsTable

import type { Contact } from '@shared/types/dashboard';
import { EmptyState } from '../shared/EmptyState';

interface ContactsTableProps {
  contacts: Contact[];
}

/** WHY column widths differ — Phone is fixed-width (~15 chars), Email needs the most room */
const COLUMNS = [
  { label: 'Full Name', width: 'w-[28%]' },
  { label: 'Position', width: 'w-[20%]' },
  { label: 'Phone', width: 'w-[15%]' },
  { label: 'Email', width: 'w-[37%]' },
] as const;

export function ContactsTable({ contacts }: ContactsTableProps) {
  if (contacts.length === 0) {
    return (
      <EmptyState
        title="No contacts on file."
        description="Contact information will appear here when available."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--color-gold-subtle)]">
            {COLUMNS.map((col) => (
              <th
                key={col.label}
                className={`${col.width} px-[var(--spacing-3xl)] py-[var(--spacing-lg)] text-left text-[12px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact, index) => (
            <tr
              key={contact.email || `contact-${index}`}
              className="border-b border-[var(--color-bg-page)]"
            >
              <td className="w-[28%] px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[14px] text-[var(--color-text-primary)]">
                {contact.fullName}
              </td>
              <td className="w-[20%] px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[14px] text-[var(--color-text-primary)]">
                {contact.position}
              </td>
              <td className="w-[15%] px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[14px] text-[var(--color-text-primary)] whitespace-nowrap">
                {contact.phone}
              </td>
              <td className="w-[37%] px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[14px] truncate max-w-0">
                <a
                  href={`mailto:${contact.email}`}
                  className="text-[var(--color-gold-primary)] no-underline hover:underline"
                  title={contact.email}
                >
                  {contact.email}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
