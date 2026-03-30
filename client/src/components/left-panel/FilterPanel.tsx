// FILE: client/src/components/left-panel/FilterPanel.tsx
// PURPOSE: Expandable filter panel with stacked conditions and AND/OR conjunctions
// USED BY: client/src/components/left-panel/LeftPanel.tsx
// EXPORTS: FilterPanel

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FilterCondition as FilterConditionRow } from './FilterCondition';
import type { FilterConditionData } from './FilterCondition';
import type { FilterCondition as HookFilterCondition } from '../../hooks/useFilters';

/** WHY conjunction type: spec Section 3.4 defines AND/OR toggle between conditions,
 *  letting users combine filters with different logic. */
export type Conjunction = 'and' | 'or';

interface FilterPanelProps {
  isOpen: boolean;
  conditions: HookFilterCondition[];
  onAddCondition: () => void;
  onUpdateCondition: (id: string, updates: Partial<HookFilterCondition>) => void;
  onRemoveCondition: (id: string) => void;
  onClearFilters: () => void;
  onClose: () => void;
}

/** WHY: Adapter converts hook's string-typed condition to FilterConditionData for the UI row.
 *  FilterCondition component uses typed enums internally for select options. */
function toConditionData(c: HookFilterCondition): FilterConditionData {
  return {
    id: c.id,
    field: (c.field || 'total_revenue') as FilterConditionData['field'],
    operator: (c.operator || 'gt') as FilterConditionData['operator'],
    value: String(c.value),
  };
}

export function FilterPanel({
  isOpen, conditions, onAddCondition, onUpdateCondition, onRemoveCondition, onClearFilters, onClose,
}: FilterPanelProps) {
  const [conjunction, setConjunction] = useState<Conjunction>('and');

  /** WHY: When conjunction toggles, update ALL conditions so the filter engine
   *  evaluates them with the correct logic (AND vs OR). */
  function handleConjunctionChange(newConj: Conjunction) {
    setConjunction(newConj);
    conditions.forEach(c => onUpdateCondition(c.id, { conjunction: newConj }));
  }

  function handleUpdate(id: string, updated: FilterConditionData) {
    onUpdateCondition(id, {
      field: updated.field,
      operator: updated.operator,
      value: updated.value,
    });
  }

  function handleRemove(id: string) {
    onRemoveCondition(id);
    /** WHY auto-close: if this was the last condition, close the panel */
    if (conditions.length <= 1) onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-hidden"
          role="region"
          aria-label="Filters"
          aria-expanded={isOpen}
        >
          <div className="flex max-h-[280px] flex-col gap-[var(--spacing-md)] overflow-y-auto rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] p-[12px_16px_12px] shadow-[var(--shadow-card)]">
            <span className="text-[12px] font-semibold text-[var(--color-gold-primary)]">
              Where
            </span>

            {conditions.map((condition, index) => (
              <div key={condition.id}>
                {index > 0 && (
                  <ConjunctionToggle value={conjunction} onChange={handleConjunctionChange} />
                )}
                <FilterConditionRow
                  condition={toConditionData(condition)}
                  onChange={(updated) => handleUpdate(condition.id, updated)}
                  onRemove={() => handleRemove(condition.id)}
                />
              </div>
            ))}

            <div className="flex gap-[var(--spacing-md)]">
              <button
                type="button"
                onClick={onAddCondition}
                className="rounded-[var(--radius-md)] px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[11px] font-medium text-[var(--color-gold-primary)] transition-colors hover:bg-[var(--color-gold-hover)]"
              >
                + Add condition
              </button>
              {conditions.length > 0 && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="rounded-[var(--radius-md)] px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[11px] font-medium text-[var(--color-red)] transition-colors hover:bg-red-50"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** AND/OR toggle — centered text with horizontal rules on both sides (spec Section 22.7) */
function ConjunctionToggle({
  value,
  onChange,
}: {
  value: Conjunction;
  onChange: (v: Conjunction) => void;
}) {
  return (
    <div className="flex items-center gap-[var(--spacing-md)] py-[var(--spacing-xs)]">
      <div className="h-px flex-1 bg-[var(--color-gold-muted)]" />
      <button
        type="button"
        onClick={() => onChange(value === 'and' ? 'or' : 'and')}
        className="text-[11px] font-semibold uppercase text-[var(--color-gold-primary)] transition-colors hover:text-[var(--color-dark)]"
        aria-label={`Toggle conjunction, currently ${value.toUpperCase()}`}
      >
        {value.toUpperCase()}
      </button>
      <div className="h-px flex-1 bg-[var(--color-gold-muted)]" />
    </div>
  );
}
