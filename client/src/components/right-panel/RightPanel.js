import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { DetailHeader } from './DetailHeader';
import { KPISection } from './KPISection';
import { ChartsRow } from './ChartsRow';
export function RightPanel({ entity, kpis, monthlyRevenue, productMix, topSellers, sparklines, yearsAvailable, activePeriod, }) {
    return (_jsxs(_Fragment, { children: [_jsx(DetailHeader, { entity: entity, activePeriod: activePeriod, yearsAvailable: yearsAvailable, onPeriodChange: () => { }, onExport: () => { } }), _jsx(KPISection, { kpis: kpis, monthlyRevenue: monthlyRevenue, sparklines: sparklines }), _jsx(ChartsRow, { productMix: productMix, topSellers: topSellers }), _jsx("div", { className: "flex-1 rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)]", children: _jsx("p", { className: "p-4 text-xs text-[var(--color-text-muted)]", children: "TabsSection" }) })] }));
}
