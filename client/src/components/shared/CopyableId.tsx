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
      className={`cursor-pointer transition-colors duration-150 hover:text-[var(--color-gold-primary)] ${className}`}
      title={`Click to copy: ${value}`}
    >
      {value}
    </button>
  );
}
