import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const FIELD_OPTIONS = [
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
const OPERATOR_OPTIONS = [
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
export function FilterCondition({ condition, onChange, onRemove }) {
    return (_jsxs("div", { className: "flex flex-col gap-[var(--spacing-sm)] rounded-[var(--radius-base)] p-[8px_12px]", style: { backgroundColor: 'var(--color-gold-hover)' }, children: [_jsxs("div", { className: "flex items-center gap-[var(--spacing-md)]", children: [_jsx("select", { value: condition.field, onChange: (e) => onChange({ ...condition, field: e.target.value }), className: "flex-1 rounded-[var(--radius-base)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-card)] px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[13px] font-normal text-[var(--color-text-primary)] outline-none focus:border-[var(--color-gold-primary)]", "aria-label": "Filter field", children: FIELD_OPTIONS.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value))) }), _jsx("button", { type: "button", onClick: onRemove, className: "shrink-0 text-[16px] leading-none text-[var(--color-text-faint)] transition-colors hover:text-[var(--color-red)]", "aria-label": "Remove condition", children: "\u00D7" })] }), _jsxs("div", { className: "flex items-center gap-[var(--spacing-md)]", children: [_jsx("select", { value: condition.operator, onChange: (e) => onChange({ ...condition, operator: e.target.value }), className: "w-[90px] shrink-0 rounded-[var(--radius-md)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-card)] px-[var(--spacing-sm)] py-[var(--spacing-xs)] text-[12px] font-normal text-[var(--color-text-primary)] outline-none focus:border-[var(--color-gold-primary)]", "aria-label": "Filter operator", children: OPERATOR_OPTIONS.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value))) }), condition.operator !== 'is_empty' && (_jsx("input", { type: "text", value: condition.value, onChange: (e) => onChange({ ...condition, value: e.target.value }), placeholder: "Value...", className: "min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-card)] px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[12px] font-normal text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-gold-primary)]", "aria-label": "Filter value" }))] })] }));
}
