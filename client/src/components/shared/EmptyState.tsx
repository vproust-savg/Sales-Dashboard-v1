// FILE: client/src/components/shared/EmptyState.tsx
// PURPOSE: Generic empty state with SVG illustration, title, and description
// USED BY: ContactsTable, OrdersTable, ItemsAccordion (when no data)
// EXPORTS: EmptyState

import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
}

/** WHY default icon is a box with magnifying glass — matches spec Section 11.2 empty state illustration */
function DefaultIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Box outline */}
      <rect
        x="8"
        y="14"
        width="24"
        height="20"
        rx="3"
        stroke="var(--color-gold-muted)"
        strokeWidth="2"
        strokeDasharray="4 2"
      />
      {/* Magnifying glass */}
      <circle
        cx="33"
        cy="21"
        r="7"
        stroke="var(--color-gold-primary)"
        strokeWidth="2"
      />
      <line
        x1="38"
        y1="26"
        x2="42"
        y2="30"
        stroke="var(--color-gold-primary)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="mb-3">{icon ?? <DefaultIcon />}</div>
      <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1">
        {title}
      </p>
      <p className="text-[12px] text-[var(--color-text-muted)]">
        {description}
      </p>
    </div>
  );
}
