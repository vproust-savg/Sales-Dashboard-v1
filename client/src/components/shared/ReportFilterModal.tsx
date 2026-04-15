// FILE: client/src/components/shared/ReportFilterModal.tsx
// PURPOSE: Filter selection modal for Report — Sales Rep / Zone / Customer Type dropdowns
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: ReportFilterModal

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { EntityListItem, FetchAllFilters } from '@shared/types/dashboard';
import { formatInteger } from '@shared/utils/formatting';

interface ReportFilterModalProps {
  isOpen: boolean;
  entities: EntityListItem[];
  onConfirm: (filters: FetchAllFilters) => void;
  onCancel: () => void;
}

function uniqueValues(entities: EntityListItem[], getter: (e: EntityListItem) => string | null): string[] {
  const set = new Set<string>();
  entities.forEach(e => {
    const v = getter(e);
    if (v) set.add(v);
  });
  return [...set].sort();
}

// WHY: Inner component is only mounted while isOpen is true. This forces useState to
// reinitialize on every open, so the previous report's selection cannot leak into the next.
// A useEffect-based reset is unreliable because the modal may be always-mounted and React
// can batch the close+reopen transitions.
export function ReportFilterModal({ isOpen, entities, onConfirm, onCancel }: ReportFilterModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <ReportFilterModalContent
          entities={entities}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </AnimatePresence>
  );
}

function ReportFilterModalContent({
  entities,
  onConfirm,
  onCancel,
}: Omit<ReportFilterModalProps, 'isOpen'>) {
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const reps = useMemo(() => uniqueValues(entities, e => e.rep), [entities]);
  const zones = useMemo(() => uniqueValues(entities, e => e.zone), [entities]);
  const types = useMemo(() => uniqueValues(entities, e => e.customerType), [entities]);

  const estimatedCount = useMemo(() => {
    return entities.filter(e => {
      if (selectedReps.length > 0 && (!e.rep || !selectedReps.includes(e.rep))) return false;
      if (selectedZones.length > 0 && (!e.zone || !selectedZones.includes(e.zone))) return false;
      if (selectedTypes.length > 0 && (!e.customerType || !selectedTypes.includes(e.customerType))) return false;
      return true;
    }).length;
  }, [entities, selectedReps, selectedZones, selectedTypes]);

  const handleConfirm = () => {
    const filters: FetchAllFilters = {};
    if (selectedReps.length > 0) filters.agentName = selectedReps;
    if (selectedZones.length > 0) filters.zone = selectedZones;
    if (selectedTypes.length > 0) filters.customerType = selectedTypes;
    onConfirm(filters);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="flex w-[420px] max-w-[90vw] flex-col gap-[var(--spacing-2xl)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]"
        role="dialog"
        aria-label="Report filters"
      >
        <div className="flex flex-col items-center gap-[var(--spacing-md)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-gold-subtle)]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 5h14l-5 6v5l-4 2v-7L3 5z" stroke="var(--color-gold-primary)" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Please select</h2>
        </div>

        <FilterField label="Sales Rep" options={reps} selected={selectedReps} onChange={setSelectedReps} />
        <FilterField label="Zone" options={zones} selected={selectedZones} onChange={setSelectedZones} />
        <FilterField label="Customer Type" options={types} selected={selectedTypes} onChange={setSelectedTypes} />

        <p className="text-center text-[12px] text-[var(--color-text-muted)]">
          Fetching data for {formatInteger(estimatedCount)} customers. Estimated 4&ndash;7 minutes.
        </p>

        <div className="flex gap-[var(--spacing-md)]">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-gold-muted)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-dark)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-dark-hover)]"
          >
            Start
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface FilterFieldProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}

function FilterField({ label, options, selected, onChange }: FilterFieldProps) {
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
      <div className="relative flex-1 max-w-[240px]">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-[var(--radius-base)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-page)] px-[var(--spacing-lg)] py-[var(--spacing-md)] text-[13px] text-[var(--color-text-secondary)]">
            <span>{displayValue}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="transition-transform group-open:rotate-180" aria-hidden="true">
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
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
        </details>
      </div>
    </div>
  );
}
