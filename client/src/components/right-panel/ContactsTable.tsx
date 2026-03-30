// FILE: client/src/components/right-panel/ContactsTable.tsx
// PURPOSE: Contacts table with name, position, phone, email (gold mailto link)
// USED BY: TabsSection (Contacts tab)
// EXPORTS: ContactsTable

import type { Contact } from '@shared/types/dashboard';
import { EmptyState } from '../shared/EmptyState';

interface ContactsTableProps {
  contacts: Contact[];
}

/** WHY column widths are 25% each — spec Section 22.6 mandates even distribution */
const COLUMNS = ['Full Name', 'Position', 'Phone', 'Email'] as const;

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
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--color-gold-subtle)]">
            {COLUMNS.map((col) => (
              <th
                key={col}
                className="w-1/4 px-[var(--spacing-3xl)] py-[var(--spacing-lg)] text-left text-[11px] font-semibold uppercase text-[#888] tracking-wide"
              >
                {col}
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
              <td className="w-1/4 px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-primary)]">
                {contact.fullName}
              </td>
              <td className="w-1/4 px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-primary)]">
                {contact.position}
              </td>
              <td className="w-1/4 px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-primary)]">
                {contact.phone}
              </td>
              <td className="w-1/4 px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] truncate max-w-0">
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
