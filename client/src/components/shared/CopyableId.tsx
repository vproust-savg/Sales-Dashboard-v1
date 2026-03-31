// FILE: client/src/components/shared/CopyableId.tsx
// PURPOSE: Inline click-to-copy button for IDs, SKUs, order numbers — copies to clipboard + triggers toast
// USED BY: DetailHeader, TopTenBestSellers, ItemsAccordion, OrdersTable
// EXPORTS: CopyableId

import { useCallback } from 'react';
import { useCopyToast } from './CopyToast';

interface CopyableIdProps {
  value: string;
  /** Toast message prefix, e.g. "SKU" → "Copied SKU" */
  label?: string;
  className?: string;
}

export function CopyableId({ value, label, className = '' }: CopyableIdProps) {
  const { showToast } = useCopyToast();

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      showToast(`Copied ${label ?? value}`);
    });
  }, [value, label, showToast]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`group/copy inline-flex items-center gap-1 cursor-pointer rounded-[var(--radius-sm)] px-1 -mx-1 transition-all duration-150 hover:text-[var(--color-gold-primary)] hover:bg-[var(--color-gold-hover)] ${className}`}
      title={`Click to copy: ${value}`}
    >
      {value}
      {/* WHY: Clipboard icon appears on hover to signal copy affordance */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        className="shrink-0 opacity-0 transition-opacity duration-150 group-hover/copy:opacity-100"
        aria-hidden="true"
      >
        <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );
}
