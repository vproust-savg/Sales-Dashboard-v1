import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FILE: client/src/components/right-panel/KPICard.tsx
// PURPOSE: Individual KPI card with label, animated value, trend indicator, and sparkline
// USED BY: KPISection.tsx
// EXPORTS: KPICard
import { AnimatedNumber } from '../shared/AnimatedNumber';
import { Sparkline } from './Sparkline';
export function KPICard({ label, value, formatter, changeValue, changeLabel, changeColor, sparklineData, secondaryValue, statusDot, }) {
    const colorMap = {
        green: 'var(--color-green)',
        red: 'var(--color-red)',
        neutral: 'var(--color-text-muted)',
    };
    return (_jsxs("div", { className: "relative flex flex-col justify-center rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] px-[var(--spacing-xl)] py-[var(--spacing-base)] shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]", children: [sparklineData && sparklineData.length > 1 && (_jsx("div", { className: "absolute right-[var(--spacing-xl)] top-[var(--spacing-base)]", children: _jsx(Sparkline, { data: sparklineData }) })), _jsx("span", { className: "text-[10px] font-medium uppercase tracking-[0.5px] text-[#888]", children: label }), _jsx("span", { className: "mt-[var(--spacing-2xs)] text-[17px] font-bold text-[var(--color-text-primary)]", children: _jsx(AnimatedNumber, { value: value, formatter: formatter }) }), secondaryValue && (_jsx("span", { className: "text-[13px] font-semibold text-[var(--color-text-secondary)]", children: secondaryValue })), statusDot ? (_jsxs("span", { className: "mt-[var(--spacing-2xs)] text-[10px] font-medium", children: [_jsx("span", { style: { color: statusDot.color }, children: "\u25CF" }), ' ', _jsx("span", { style: { color: statusDot.color }, children: statusDot.label })] })) : changeValue !== null ? (_jsxs("span", { className: "mt-[var(--spacing-2xs)] text-[10px] font-medium", style: { color: colorMap[changeColor] }, children: [changeValue, " ", changeLabel] })) : null] }));
}
