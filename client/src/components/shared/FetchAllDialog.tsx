// FILE: client/src/components/shared/FetchAllDialog.tsx
// PURPOSE: Confirmation modal with pre-fetch filter dropdowns
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: FetchAllDialog

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EntityListItem, Dimension, FetchAllFilters } from '@shared/types/dashboard';
import { DIMENSION_CONFIG } from '../../utils/dimension-config';

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
  const [agentName, setAgentName] = useState('');
  const [zone, setZone] = useState('');
  const [customerType, setCustomerType] = useState('');

  const config = DIMENSION_CONFIG[dimension];
  const showRep = dimension === 'customer';

  // Extract unique values for dropdowns
  const reps = useMemo(() => [...new Set(entities.map(e => e.rep).filter(Boolean) as string[])].sort(), [entities]);
  const zones = useMemo(() => [...new Set(entities.map(e => e.zone).filter(Boolean) as string[])].sort(), [entities]);
  const types = useMemo(() => [...new Set(entities.map(e => e.customerType).filter(Boolean) as string[])].sort(), [entities]);

  // Filter entities to estimate count
  const filteredCount = useMemo(() => {
    let filtered = entities;
    if (agentName) filtered = filtered.filter(e => e.rep === agentName);
    if (zone) filtered = filtered.filter(e => e.zone === zone);
    if (customerType) filtered = filtered.filter(e => e.customerType === customerType);
    return filtered.length;
  }, [entities, agentName, zone, customerType]);

  const handleConfirm = () => {
    const filters: FetchAllFilters = {};
    if (agentName) filters.agentName = agentName;
    if (zone) filters.zone = zone;
    if (customerType) filters.customerType = customerType;
    onConfirm(filters);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[400px] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-8 shadow-lg"
          >
            {/* Hourglass icon */}
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fef3c7] text-2xl">
              &#9203;
            </div>

            <h2 className="mb-2 text-center text-[16px] font-semibold text-[var(--color-text-primary)]">
              {isRefresh ? `Re-fetch ${config.allLabel} Data?` : `Load ${config.allLabel} Data?`}
            </h2>

            {/* Filter dropdowns */}
            <div className="mb-4 space-y-2">
              {showRep && (
                <FilterDropdown label="Sales Rep" value={agentName} options={reps} onChange={setAgentName} />
              )}
              <FilterDropdown label="Zone" value={zone} options={zones} onChange={setZone} />
              <FilterDropdown label="Customer Type" value={customerType} options={types} onChange={setCustomerType} />
            </div>

            <p className="mb-5 text-center text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              {isRefresh
                ? `Re-fetch all order data from Priority ERP? This will replace cached data. Estimated ${estimateTime(filteredCount)}.`
                : `This will fetch order data from Priority ERP for ${filteredCount.toLocaleString()} ${dimension === 'customer' ? 'customers' : 'entities'}. Estimated ${estimateTime(filteredCount)}.`}
            </p>

            <div className="flex gap-3">
              <button type="button" onClick={onCancel}
                className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] py-2.5 text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-gold-muted)]">
                Cancel
              </button>
              <button type="button" onClick={handleConfirm}
                className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-dark)] py-2.5 text-[13px] font-semibold text-white transition-colors hover:opacity-90">
                Yes, Load All
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FilterDropdown({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-[12px] text-[var(--color-text-muted)]">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="flex-1 rounded-[var(--radius-base)] border border-[var(--color-gold-subtle)] bg-white px-3 py-1.5 text-[12px] text-[var(--color-text-primary)]">
        <option value="">All</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}
