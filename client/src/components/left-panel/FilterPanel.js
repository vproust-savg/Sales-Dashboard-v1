import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FILE: client/src/components/left-panel/FilterPanel.tsx
// PURPOSE: Expandable filter panel with stacked conditions and AND/OR conjunctions
// USED BY: client/src/components/left-panel/LeftPanel.tsx
// EXPORTS: FilterPanel
import { AnimatePresence, motion } from 'framer-motion';
import { FilterCondition } from './FilterCondition';
/** Generates a unique ID for new filter conditions */
function createConditionId() {
    return `cond_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
const DEFAULT_FIELD = 'total_revenue';
export function FilterPanel({ isOpen, conditions, conjunction, onConditionsChange, onConjunctionChange, onClose, }) {
    function handleAddCondition() {
        const newCondition = {
            id: createConditionId(),
            field: DEFAULT_FIELD,
            operator: 'gt',
            value: '',
        };
        onConditionsChange([...conditions, newCondition]);
    }
    function handleUpdateCondition(index, updated) {
        const next = [...conditions];
        next[index] = updated;
        onConditionsChange(next);
    }
    function handleRemoveCondition(index) {
        const next = conditions.filter((_, i) => i !== index);
        onConditionsChange(next);
        /** WHY auto-close: if all conditions removed, close the panel */
        if (next.length === 0)
            onClose();
    }
    return (_jsx(AnimatePresence, { children: isOpen && (_jsx(motion.div, { initial: { height: 0, opacity: 0 }, animate: { height: 'auto', opacity: 1 }, exit: { height: 0, opacity: 0 }, transition: { duration: 0.2, ease: 'easeInOut' }, className: "overflow-hidden", role: "region", "aria-label": "Filters", "aria-expanded": isOpen, children: _jsxs("div", { className: "flex max-h-[280px] flex-col gap-[var(--spacing-md)] overflow-y-auto rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] p-[12px_16px_12px] shadow-[var(--shadow-card)]", children: [_jsx("span", { className: "text-[12px] font-semibold text-[var(--color-gold-primary)]", children: "Where" }), conditions.map((condition, index) => (_jsxs("div", { children: [index > 0 && (_jsx(ConjunctionToggle, { value: conjunction, onChange: onConjunctionChange })), _jsx(FilterCondition, { condition: condition, onChange: (updated) => handleUpdateCondition(index, updated), onRemove: () => handleRemoveCondition(index) })] }, condition.id))), _jsx("button", { type: "button", onClick: handleAddCondition, className: "self-start rounded-[var(--radius-md)] px-[var(--spacing-md)] py-[var(--spacing-xs)] text-[11px] font-medium text-[var(--color-gold-primary)] transition-colors hover:bg-[var(--color-gold-hover)]", children: "+ Add condition" })] }) })) }));
}
/** AND/OR toggle — centered text with horizontal rules on both sides (spec Section 22.7) */
function ConjunctionToggle({ value, onChange, }) {
    return (_jsxs("div", { className: "flex items-center gap-[var(--spacing-md)] py-[var(--spacing-xs)]", children: [_jsx("div", { className: "h-px flex-1 bg-[var(--color-gold-muted)]" }), _jsx("button", { type: "button", onClick: () => onChange(value === 'and' ? 'or' : 'and'), className: "text-[11px] font-semibold uppercase text-[var(--color-gold-primary)] transition-colors hover:text-[var(--color-dark)]", "aria-label": `Toggle conjunction, currently ${value.toUpperCase()}`, children: value.toUpperCase() }), _jsx("div", { className: "h-px flex-1 bg-[var(--color-gold-muted)]" })] }));
}
