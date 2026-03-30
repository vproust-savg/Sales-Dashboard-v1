import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function FilterSortToolbar({ onFilterToggle, onSortToggle, filterActive, sortActive, }) {
    return (_jsxs("div", { className: "flex gap-[var(--spacing-md)]", children: [_jsxs("button", { type: "button", onClick: onFilterToggle, "aria-pressed": filterActive, className: `
          flex h-[36px] flex-1 items-center justify-center gap-[var(--spacing-sm)]
          rounded-[var(--radius-lg)] px-[var(--spacing-2xl)] py-[var(--spacing-base)]
          text-[12px] font-medium transition-colors duration-150
          ${filterActive
                    ? 'bg-[var(--color-dark)] text-white hover:bg-[var(--color-dark-hover)]'
                    : 'bg-[var(--color-gold-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-gold-muted)]'}
        `, children: [_jsxs("svg", { width: "14", height: "10", viewBox: "0 0 14 10", fill: "none", "aria-hidden": "true", children: [_jsx("line", { x1: "0", y1: "1", x2: "14", y2: "1", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "2", y1: "5", x2: "12", y2: "5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "4", y1: "9", x2: "10", y2: "9", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })] }), "Filter"] }), _jsxs("button", { type: "button", onClick: onSortToggle, "aria-pressed": sortActive, className: `
          flex h-[36px] flex-1 items-center justify-center gap-[var(--spacing-sm)]
          rounded-[var(--radius-lg)] px-[var(--spacing-2xl)] py-[var(--spacing-base)]
          text-[12px] font-medium transition-colors duration-150
          ${sortActive
                    ? 'bg-[var(--color-dark)] text-white hover:bg-[var(--color-dark-hover)]'
                    : 'bg-[var(--color-gold-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-gold-muted)]'}
        `, children: [_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M4 1v10M4 1L1 4M4 1l3 3", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("path", { d: "M8 11V1M8 11l3-3M8 11L5 8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })] }), "Sort", sortActive && _jsx("span", { "aria-hidden": "true", children: "\u2193" })] })] }));
}
