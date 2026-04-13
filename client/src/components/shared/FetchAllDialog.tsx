// FILE: client/src/components/shared/FetchAllDialog.tsx
// PURPOSE: Confirmation modal with pre-fetch multi-select filter dropdowns
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: FetchAllDialog

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EntityListItem, Dimension, FetchAllFilters } from '@shared/types/dashboard';
import { formatInteger } from '@shared/utils/formatting';

interface FetchAllDialogProps {
  isOpen: boolean;
  dimension: Dimension;
  entities: EntityListItem[];
  isRefresh?: boolean;
  onConfirm: (filters: FetchAllFilters) => void;
  onCancel: () => void;
}

function estimateTime(count: number): string {
  if (count < 200) return '~1 minute';
  if (count < 500) return '~2 minutes';
  if (count < 1000) return '~3\u20134 minutes';
  return '4\u20137 minutes';
}

export function FetchAllDialog({ isOpen, dimension, entities, isRefresh, onConfirm, onCancel }: FetchAllDialogProps) {
  const [agentNames, setAgentNames] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [customerTypes, setCustomerTypes] = useState<string[]>([]);

  const showRep = dimension === 'customer';

  const repOptions = useMemo(() => [...new Set(entities.map(e => e.rep).filter(Boolean) as string[])].sort(), [entities]);
  const zoneOptions = useMemo(() => [...new Set(entities.map(e => e.zone).filter(Boolean) as string[])].sort(), [entities]);
  const typeOptions = useMemo(() => [...new Set(entities.map(e => e.customerType).filter(Boolean) as string[])].sort(), [entities]);

  const filteredCount = useMemo(() => {
    let filtered = entities;
    if (agentNames.length > 0) { const s = new Set(agentNames); filtered = filtered.filter(e => e.rep !== null && s.has(e.rep)); }
    if (zones.length > 0) { const s = new Set(zones); filtered = filtered.filter(e => e.zone !== null && s.has(e.zone)); }
    if (customerTypes.length > 0) { const s = new Set(customerTypes); filtered = filtered.filter(e => e.customerType !== null && s.has(e.customerType)); }
    return filtered.length;
  }, [entities, agentNames, zones, customerTypes]);

  const handleConfirm = () => {
    const filters: FetchAllFilters = {};
    if (agentNames.length > 0) filters.agentName = agentNames;
    if (zones.length > 0) filters.zone = zones;
    if (customerTypes.length > 0) filters.customerType = customerTypes;
    onConfirm(filters);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[400px] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-8 shadow-lg"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fef3c7] text-2xl">
              &#9203;
            </div>
            <h2 className="mb-4 text-center text-[16px] font-semibold text-[var(--color-text-primary)]">
              {isRefresh ? 'Re-fetch data?' : 'Please select'}
            </h2>

            <div className="mb-4 space-y-3">
              {showRep && <MultiSelect label="Sales Rep" selected={agentNames} options={repOptions} onChange={setAgentNames} />}
              <MultiSelect label="Zone" selected={zones} options={zoneOptions} onChange={setZones} />
              <MultiSelect label="Customer Type" selected={customerTypes} options={typeOptions} onChange={setCustomerTypes} />
            </div>

            <p className="mb-5 text-center text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              {isRefresh
                ? `This will replace cached data. Estimated ${estimateTime(filteredCount)}.`
                : `Fetching data for ${formatInteger(filteredCount)} ${dimension === 'customer' ? 'customers' : 'entities'}. Estimated ${estimateTime(filteredCount)}.`}
            </p>

            <div className="flex gap-3">
              <button type="button" onClick={onCancel}
                className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] py-2.5 text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-gold-muted)]">
                Cancel
              </button>
              <button type="button" onClick={handleConfirm}
                className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-dark)] py-2.5 text-[13px] font-semibold text-white transition-colors hover:opacity-90">
                Start
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MultiSelect({ label, selected, options, onChange }: {
  label: string; selected: string[]; options: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };

  return (
    <div className="flex items-start gap-3" ref={ref}>
      <span className="mt-2 w-28 shrink-0 text-[12px] text-[var(--color-text-muted)]">{label}</span>
      <div className="relative flex-1">
        <button type="button" onClick={() => setOpen(!open)}
          className="flex w-full min-h-[34px] flex-wrap items-center gap-1 rounded-[var(--radius-base)] border border-[var(--color-gold-subtle)] bg-white px-2 py-1.5 text-left text-[12px] text-[var(--color-text-primary)]">
          {selected.length === 0 ? (
            <span className="text-[var(--color-text-muted)]">All</span>
          ) : (
            selected.map(v => (
              <span key={v} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-gold-subtle)] px-2 py-0.5 text-[11px] text-[var(--color-text-primary)]">
                {v}
                <button type="button" onClick={(e) => { e.stopPropagation(); toggle(v); }}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">&times;</button>
              </span>
            ))
          )}
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[180px] overflow-y-auto rounded-[var(--radius-base)] border border-[var(--color-gold-subtle)] bg-white py-1 shadow-md">
            {options.map(opt => (
              <label key={opt} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-[var(--color-gold-hover)]">
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)}
                  className="h-3.5 w-3.5 rounded border-[var(--color-gold-muted)] accent-[var(--color-gold-primary)]" />
                {opt}
              </label>
            ))}
            {options.length === 0 && <p className="px-3 py-2 text-[11px] text-[var(--color-text-muted)]">No options</p>}
          </div>
        )}
      </div>
    </div>
  );
}
