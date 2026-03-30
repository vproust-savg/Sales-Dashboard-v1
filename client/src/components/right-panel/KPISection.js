import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatCurrency, formatPercent, formatPercentPoints, formatFrequency, formatDays, } from '@shared/utils/formatting';
import { HeroRevenueCard } from './HeroRevenueCard';
import { KPICard } from './KPICard';
/** WHY activity status here: spec 10.3 defines dot color thresholds by days since last order */
function getActivityStatus(days) {
    if (days === null)
        return { color: '#999', label: 'No orders' };
    if (days <= 14)
        return { color: '#22c55e', label: 'Active buyer' };
    if (days <= 45)
        return { color: '#b8a88a', label: 'Regular' };
    if (days <= 90)
        return { color: '#eab308', label: 'Slowing' };
    return { color: '#ef4444', label: 'At risk' };
}
function getTrendColor(value) {
    if (value === null)
        return 'neutral';
    return value >= 0 ? 'green' : 'red';
}
export function KPISection({ kpis, monthlyRevenue, sparklines }) {
    const activity = getActivityStatus(kpis.lastOrderDays);
    return (_jsxs("div", { className: "grid grid-cols-2 gap-[var(--spacing-base)]", children: [_jsx(HeroRevenueCard, { kpis: kpis, monthlyRevenue: monthlyRevenue }), _jsxs("div", { className: "grid grid-cols-2 grid-rows-3 gap-[var(--spacing-md)]", children: [_jsx(KPICard, { label: "Orders", value: kpis.orders, formatter: (n) => Math.round(n).toLocaleString('en-US'), changeValue: kpis.ordersChange !== null ? `${kpis.ordersChange > 0 ? '+' : ''}${kpis.ordersChange}` : null, changeLabel: "this quarter", changeColor: getTrendColor(kpis.ordersChange), sparklineData: sparklines.orders?.values }), _jsx(KPICard, { label: "Avg. Order", value: kpis.avgOrder ?? 0, formatter: (n) => kpis.avgOrder === null ? '\u2014' : formatCurrency(Math.round(n)), changeValue: null, changeLabel: "", changeColor: "neutral", sparklineData: sparklines.revenue?.values }), _jsx(KPICard, { label: "Margin", value: kpis.marginPercent ?? 0, formatter: (n) => kpis.marginPercent === null ? '\u2014' : formatPercent(n), secondaryValue: formatCurrency(kpis.marginAmount), changeValue: kpis.marginChangepp !== null ? formatPercentPoints(kpis.marginChangepp) : null, changeLabel: "vs target", changeColor: getTrendColor(kpis.marginChangepp) }), _jsx(KPICard, { label: "Frequency", value: kpis.frequency ?? 0, formatter: (n) => kpis.frequency === null ? '\u2014' : formatFrequency(n), changeValue: kpis.frequencyChange !== null ? `${kpis.frequencyChange > 0 ? '+' : ''}${kpis.frequencyChange.toFixed(1)}` : null, changeLabel: "vs avg", changeColor: getTrendColor(kpis.frequencyChange) }), _jsx(KPICard, { label: "Last Order", value: kpis.lastOrderDays ?? 0, formatter: (n) => kpis.lastOrderDays === null ? 'No orders' : formatDays(Math.round(n)), changeValue: null, changeLabel: "", changeColor: "neutral", statusDot: activity }), _jsx(KPICard, { label: "Fill Rate", value: kpis.fillRate ?? 0, formatter: (n) => kpis.fillRate === null ? '\u2014' : formatPercent(n), changeValue: kpis.fillRateChangepp !== null ? formatPercentPoints(kpis.fillRateChangepp) : null, changeLabel: "vs prev year", changeColor: getTrendColor(kpis.fillRateChangepp) })] })] }));
}
