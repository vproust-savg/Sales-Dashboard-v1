import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** WHY default icon is a box with magnifying glass — matches spec Section 11.2 empty state illustration */
function DefaultIcon() {
    return (_jsxs("svg", { width: "48", height: "48", viewBox: "0 0 48 48", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", children: [_jsx("rect", { x: "8", y: "14", width: "24", height: "20", rx: "3", stroke: "var(--color-gold-muted)", strokeWidth: "2", strokeDasharray: "4 2" }), _jsx("circle", { cx: "33", cy: "21", r: "7", stroke: "var(--color-gold-primary)", strokeWidth: "2" }), _jsx("line", { x1: "38", y1: "26", x2: "42", y2: "30", stroke: "var(--color-gold-primary)", strokeWidth: "2", strokeLinecap: "round" })] }));
}
export function EmptyState({ title, description, icon }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center py-12 px-6", children: [_jsx("div", { className: "mb-3", children: icon ?? _jsx(DefaultIcon, {}) }), _jsx("p", { className: "text-[13px] font-semibold text-[var(--color-text-primary)] mb-1", children: title }), _jsx("p", { className: "text-[12px] text-[var(--color-text-muted)]", children: description })] }));
}
