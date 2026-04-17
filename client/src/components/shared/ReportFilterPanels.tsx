// FILE: client/src/components/shared/ReportFilterPanels.tsx
// PURPOSE: Per-type filter panel components used inside ReportFilterModal
// USED BY: client/src/components/shared/ReportFilterModal.tsx
// EXPORTS: FilterField, TextFilterField

import { useEffect, useRef, useState } from 'react';

export interface FilterFieldProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}

export function FilterField({ label, options, selected, onChange }: FilterFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // WHY: Listeners are only attached while the dropdown is open — no overhead when closed.
  // mousedown fires before blur/click, so the dropdown closes before any other element
  // receives focus. Same pattern as PeriodSelector.tsx:31–53.
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const displayValue = selected.length === 0
    ? 'All'
    : selected.length <= 2
      ? selected.join(', ')
      : `${selected.length} selected`;

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };

  return (
    <div className="flex items-center justify-between gap-[var(--spacing-lg)]">
      <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">{label}</label>
      <div ref={containerRef} className="relative flex-1 max-w-[240px]">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(v => !v)}
          className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-base)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-page)] px-[var(--spacing-lg)] py-[var(--spacing-md)] text-[13px] text-[var(--color-text-secondary)]"
        >
          <span>{displayValue}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {isOpen && (
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-[200px] overflow-y-auto rounded-[var(--radius-base)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)]">
            {options.map(opt => (
              <label key={opt} className="flex cursor-pointer items-center gap-[var(--spacing-sm)] px-[var(--spacing-lg)] py-[var(--spacing-md)] text-[13px] hover:bg-[var(--color-gold-subtle)]">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="h-[14px] w-[14px] accent-[var(--color-gold-primary)]"
                />
                <span>{opt}</span>
              </label>
            ))}
            {options.length === 0 && (
              <div className="px-[var(--spacing-lg)] py-[var(--spacing-md)] text-[12px] text-[var(--color-text-muted)]">No options</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export interface TextFilterFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

/** WHY: Item-level master data (brand, family, country, FS) is not exposed as a queryable list
 *  endpoint yet. Free-text comma-separated input is a pragmatic first round; proper dropdowns
 *  can be added once a master-data route exists. */
export function TextFilterField({ label, value, onChange, placeholder }: TextFilterFieldProps) {
  return (
    <div className="flex items-center justify-between gap-[var(--spacing-lg)]">
      <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 max-w-[240px] rounded-[var(--radius-base)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-page)] px-[var(--spacing-lg)] py-[var(--spacing-md)] text-[13px] text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--color-gold-primary)]"
      />
    </div>
  );
}
