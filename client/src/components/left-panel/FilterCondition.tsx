// FILE: client/src/components/left-panel/FilterCondition.tsx
// PURPOSE: Single filter condition row — field selector + operator + value input + remove button
// USED BY: client/src/components/left-panel/FilterPanel.tsx
// EXPORTS: FilterCondition, FilterConditionData, FilterField, FilterOperator

/** WHY two-line layout: spec Section 22.7 defines field + remove on top row,
 *  operator + value on bottom row, all inside a #faf8f4 card. */

export interface FilterConditionData {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string;
}

export type FilterField =
  | 'rep' | 'customer_type' | 'zone' | 'last_order_date'
  | 'margin_pct' | 'margin_amt' | 'total_revenue'
  | 'avg_order' | 'frequency' | 'outstanding';

export type FilterOperator =
  | 'contains' | 'equals' | 'not_equals'
  | 'gt' | 'lt' | 'gte' | 'lte'
  | 'between' | 'is_before' | 'is_after' | 'is_empty';

const FIELD_OPTIONS: { value: FilterField; label: string }[] = [
  { value: 'rep', label: 'Rep' },
  { value: 'customer_type', label: 'Customer Type' },
  { value: 'zone', label: 'Zone' },
  { value: 'last_order_date', label: 'Last Order Date' },
  { value: 'margin_pct', label: 'Margin %' },
  { value: 'margin_amt', label: 'Margin $' },
  { value: 'total_revenue', label: 'Total Revenue' },
  { value: 'avg_order', label: 'Average Order' },
  { value: 'frequency', label: 'Frequency' },
  { value: 'outstanding', label: 'Outstanding' },
];

const OPERATOR_OPTIONS: { value: FilterOperator; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
  { value: 'between', label: 'between' },
  { value: 'is_before', label: 'is before' },
  { value: 'is_after', label: 'is after' },
  { value: 'is_empty', label: 'is empty' },
];

interface FilterConditionProps {
  condition: FilterConditionData;
  onChange: (updated: FilterConditionData) => void;
  onRemove: () => void;
}

export function FilterCondition({ condition, onChange, onRemove }: FilterConditionProps) {
  return (
    <div
      className="flex flex-col gap-[var(--spacing-sm)] rounded-[var(--radius-base)] p-[8px_12px]"
      style={{ backgroundColor: 'var(--color-gold-hover)' }}
    >
      {/* Top row: field selector + remove button */}
      <div className="flex items-center gap-[var(--spacing-md)]">
        <select
          value={condition.field}
          onChange={(e) => onChange({ ...condition, field: e.target.value as FilterField })}
          className="flex-1 rounded-[var(--radius-base)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-card)] px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[13px] font-normal text-[var(--color-text-primary)] outline-none focus:border-[var(--color-gold-primary)]"
          aria-label="Filter field"
        >
          {FIELD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
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
          className="w-[90px] shrink-0 rounded-[var(--radius-md)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-card)] px-[var(--spacing-sm)] py-[var(--spacing-xs)] text-[12px] font-normal text-[var(--color-text-primary)] outline-none focus:border-[var(--color-gold-primary)]"
          aria-label="Filter operator"
        >
          {OPERATOR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* WHY conditional: "is empty" operator needs no value input */}
        {condition.operator !== 'is_empty' && (
          <input
            type="text"
            value={condition.value}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            placeholder="Value..."
            className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-card)] px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[12px] font-normal text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-gold-primary)]"
            aria-label="Filter value"
          />
        )}
      </div>
    </div>
  );
}
