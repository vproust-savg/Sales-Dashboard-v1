// FILE: client/src/components/left-panel/FilterPanel.tsx
// PURPOSE: Expandable filter panel with stacked conditions and AND/OR conjunctions
// USED BY: client/src/components/left-panel/LeftPanel.tsx
// EXPORTS: FilterPanel

import { AnimatePresence, motion } from 'framer-motion';
import { FilterCondition } from './FilterCondition';
import type { FilterConditionData, FilterField } from './FilterCondition';

/** WHY conjunction type: spec Section 3.4 defines AND/OR toggle between conditions,
 *  letting users combine filters with different logic. */
export type Conjunction = 'and' | 'or';

interface FilterPanelProps {
  isOpen: boolean;
  conditions: FilterConditionData[];
  conjunction: Conjunction;
  onConditionsChange: (conditions: FilterConditionData[]) => void;
  onConjunctionChange: (conjunction: Conjunction) => void;
  onClose: () => void;
}

/** Generates a unique ID for new filter conditions */
function createConditionId(): string {
  return `cond_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_FIELD: FilterField = 'total_revenue';

export function FilterPanel({
  isOpen,
  conditions,
  conjunction,
  onConditionsChange,
  onConjunctionChange,
  onClose,
}: FilterPanelProps) {
  function handleAddCondition() {
    const newCondition: FilterConditionData = {
      id: createConditionId(),
      field: DEFAULT_FIELD,
      operator: 'gt',
      value: '',
    };
    onConditionsChange([...conditions, newCondition]);
  }

  function handleUpdateCondition(index: number, updated: FilterConditionData) {
    const next = [...conditions];
    next[index] = updated;
    onConditionsChange(next);
  }

  function handleRemoveCondition(index: number) {
    const next = conditions.filter((_, i) => i !== index);
    onConditionsChange(next);
    /** WHY auto-close: if all conditions removed, close the panel */
    if (next.length === 0) onClose();
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
          <div
            className="flex max-h-[280px] flex-col gap-[var(--spacing-md)] overflow-y-auto rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] p-[12px_16px_12px] shadow-[var(--shadow-card)]"
          >
            {/* "Where" label — spec Section 22.7 */}
            <span className="text-[12px] font-semibold text-[var(--color-gold-primary)]">
              Where
            </span>

            {/* Condition cards with conjunctions between them */}
            {conditions.map((condition, index) => (
              <div key={condition.id}>
                {/* AND/OR conjunction between conditions — spec Section 22.7 */}
                {index > 0 && (
                  <ConjunctionToggle
                    value={conjunction}
                    onChange={onConjunctionChange}
                  />
                )}
                <FilterCondition
                  condition={condition}
                  onChange={(updated) => handleUpdateCondition(index, updated)}
                  onRemove={() => handleRemoveCondition(index)}
                />
              </div>
            ))}

            {/* Add condition button */}
            <button
              type="button"
              onClick={handleAddCondition}
              className="self-start rounded-[var(--radius-md)] px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[11px] font-medium text-[var(--color-gold-primary)] transition-colors hover:bg-[var(--color-gold-hover)]"
            >
              + Add condition
            </button>
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
