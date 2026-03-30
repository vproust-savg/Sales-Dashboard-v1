import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FILE: client/src/components/right-panel/ItemsAccordion.tsx
// PURPOSE: Category accordion — expandable rows showing products per category
// USED BY: TabsSection (Items tab)
// EXPORTS: ItemsAccordion
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';
import { EmptyState } from '../shared/EmptyState';
export function ItemsAccordion({ items }) {
    /** WHY Set for expanded — supports multiple categories open at once */
    const [expanded, setExpanded] = useState(new Set());
    if (items.length === 0) {
        return (_jsx(EmptyState, { title: "No items for this period.", description: "Product categories will appear here when available." }));
    }
    function toggleCategory(category) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            }
            else {
                next.add(category);
            }
            return next;
        });
    }
    /** WHY sorted by totalValue desc — spec Section 13.6 */
    const sorted = [...items].sort((a, b) => b.totalValue - a.totalValue);
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center border-b border-[var(--color-gold-subtle)] px-[var(--spacing-3xl)] py-[var(--spacing-lg)]", children: [_jsx("span", { className: "flex-1 text-[11px] font-semibold uppercase text-[#888] tracking-wide", children: "Category / Product" }), _jsx("span", { className: "w-24 text-right text-[11px] font-semibold uppercase text-[#888] tracking-wide", children: "Value" }), _jsx("span", { className: "w-20 text-right text-[11px] font-semibold uppercase text-[#888] tracking-wide", children: "Margin %" }), _jsx("span", { className: "w-24 text-right text-[11px] font-semibold uppercase text-[#888] tracking-wide", children: "Margin $" })] }), sorted.map((cat) => (_jsx(CategoryRow, { category: cat, isExpanded: expanded.has(cat.category), onToggle: () => toggleCategory(cat.category) }, cat.category)))] }));
}
function CategoryRow({ category, isExpanded, onToggle }) {
    return (_jsxs("div", { className: "border-b border-[var(--color-bg-page)]", children: [_jsxs("button", { type: "button", onClick: onToggle, className: "flex w-full items-center px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-left hover:bg-[var(--color-gold-hover)] transition-colors duration-150", "aria-expanded": isExpanded, children: [_jsx("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", className: `mr-2 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`, "aria-hidden": "true", children: _jsx("path", { d: "M5 3l4 4-4 4", stroke: "var(--color-text-muted)", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) }), _jsx("span", { className: "flex-1 text-[13px] font-semibold text-[var(--color-text-primary)] truncate", children: category.category }), _jsx("span", { className: "mx-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-gold-subtle)] px-1 text-[9px] font-semibold text-[#888]", children: category.itemCount }), _jsx("span", { className: "w-24 text-right text-[13px] tabular-nums text-[var(--color-text-primary)]", children: formatCurrency(category.totalValue) }), _jsx("span", { className: "w-20 text-right text-[13px] tabular-nums text-[var(--color-text-secondary)]", children: formatPercent(category.marginPercent) }), _jsx("span", { className: "w-24 text-right text-[13px] tabular-nums text-[var(--color-text-secondary)]", children: formatCurrency(category.marginAmount) })] }), _jsx(AnimatePresence, { initial: false, children: isExpanded && (_jsx(motion.div, { initial: { height: 0, opacity: 0 }, animate: { height: 'auto', opacity: 1 }, exit: { height: 0, opacity: 0 }, transition: { duration: 0.2, ease: 'easeInOut' }, className: "overflow-hidden", children: [...category.products]
                        .sort((a, b) => b.value - a.value)
                        .map((product) => (_jsxs("div", { className: "flex items-center border-b border-[var(--color-bg-page)] py-[var(--spacing-md)]", 
                        /** WHY 44px left padding — spec Section 4.4 child product indentation */
                        style: { paddingLeft: '44px', paddingRight: 'var(--spacing-3xl)' }, children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("span", { className: "block text-[12px] text-[var(--color-text-secondary)] truncate", children: product.name }), _jsx("span", { className: "block text-[10px] text-[var(--color-text-faint)]", children: product.sku })] }), _jsx("span", { className: "w-24 text-right text-[12px] tabular-nums text-[var(--color-text-secondary)]", children: formatCurrency(product.value) }), _jsx("span", { className: "w-20 text-right text-[12px] tabular-nums text-[var(--color-text-muted)]", children: formatPercent(product.marginPercent) }), _jsx("span", { className: "w-24 text-right text-[12px] tabular-nums text-[var(--color-text-muted)]", children: formatCurrency(product.marginAmount) })] }, product.sku))) }, "products")) })] }));
}
