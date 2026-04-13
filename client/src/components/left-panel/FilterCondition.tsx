// FILE: client/src/components/left-panel/FilterCondition.tsx
// PURPOSE: Single filter condition row — field selector + operator + value input + remove button
// USED BY: client/src/components/left-panel/FilterPanel.tsx
// EXPORTS: FilterConditionRow

/** WHY two-line layout: spec Section 22.7 defines field + remove on top row,
 *  operator + value on bottom row, all inside a #faf8f4 card. */

import {
  type FilterField, type FilterOperator,
  FIELD_LABELS, OPERATOR_LABELS, FIELD_TYPES, OPERATORS_BY_TYPE,
} from '../../utils/filter-types';

export interface FilterConditionData {
  id: string;
  field: FilterField | '';
  operator: FilterOperator | '';
  value: string;
}

interface FilterConditionProps {
  condition: FilterConditionData;
  availableFields: FilterField[];
  onChange: (updated: FilterConditionData) => void;
  onRemove: () => void;
}

export function FilterConditionRow({ condition, availableFields, onChange, onRemove }: FilterConditionProps) {
  const fieldType = condition.field ? FIELD_TYPES[condition.field] : null;
  const operatorOptions = fieldType ? OPERATORS_BY_TYPE[fieldType] : [];

  return (
    <div
      className="flex flex-col gap-[var(--spacing-sm)] rounded-[var(--radius-base)] p-[8px_12px]"
      style={{ backgroundColor: 'var(--color-gold-hover)' }}
    >
      {/* Top row: field selector + remove button */}
      <div className="flex items-center gap-[var(--spacing-md)]">
        <select
          value={condition.field}
          onChange={(e) => {
            const newField = e.target.value as FilterField | '';
            // WHY: Reset operator when field changes — different types have different operators
            onChange({ ...condition, field: newField, operator: '', value: '' });
          }}
          className="flex-1 rounded-[var(--radius-base)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-card)] px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[13px] font-normal text-[var(--color-text-primary)] focus:border-[var(--color-gold-primary)]"
          aria-label="Filter field"
        >
          <option value="">Select field...</option>
          {availableFields.map((f) => (
            <option key={f} value={f}>{FIELD_LABELS[f]}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-[16px] leading-none text-[var(--color-text-faint)] transition-colors hover:text-[var(--color-red)]"
          aria-label="Remove condition"
        >
          &times;
        </button>
      </div>

      {/* Bottom row: operator selector + value input */}
      <div className="flex items-center gap-[var(--spacing-md)]">
        <select
          value={condition.operator}
          onChange={(e) => onChange({ ...condition, operator: e.target.value as FilterOperator })}
          className="w-[90px] shrink-0 rounded-[var(--radius-md)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-card)] px-[var(--spacing-sm)] py-[var(--spacing-xs)] text-[12px] font-normal text-[var(--color-text-primary)] focus:border-[var(--color-gold-primary)]"
          aria-label="Filter operator"
        >
          <option value="">Op...</option>
          {operatorOptions.map((op) => (
            <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
          ))}
        </select>

        {/* WHY conditional: "is empty" operator needs no value input */}
        {condition.operator !== 'is_empty' && (
          <input
            type="text"
            value={condition.value}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            placeholder="Value..."
            className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-card)] px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[12px] font-normal text-[var(--color-text-primary)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-gold-primary)]"
            aria-label="Filter value"
          />
        )}
      </div>
    </div>
  );
}
