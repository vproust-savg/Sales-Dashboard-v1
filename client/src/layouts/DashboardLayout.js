import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LeftPanel } from '../components/left-panel/LeftPanel';
import { RightPanel } from '../components/right-panel/RightPanel';
export function DashboardLayout({ dashboard, contacts, activeDimension, activePeriod, activeEntityId, selectedEntityIds, }) {
    const activeEntity = dashboard.entities.find(e => e.id === activeEntityId) ?? null;
    return (_jsxs("div", { className: "mx-auto flex h-[calc(100vh-32px)] max-w-[1440px] gap-[var(--spacing-2xl)] p-[var(--spacing-2xl)]", role: "application", "aria-label": "Sales Dashboard", children: [_jsx("div", { className: "flex w-[280px] shrink-0 flex-col gap-[var(--spacing-base)]", children: _jsx(LeftPanel, { entities: dashboard.entities, activeDimension: activeDimension, activeEntityId: activeEntityId, selectedEntityIds: selectedEntityIds }) }), _jsx("div", { className: "flex min-w-0 flex-1 flex-col gap-[var(--spacing-base)] overflow-y-auto pr-[var(--spacing-xs)]", children: _jsx(RightPanel, { entity: activeEntity, kpis: dashboard.kpis, monthlyRevenue: dashboard.monthlyRevenue, productMix: dashboard.productMix, topSellers: dashboard.topSellers, sparklines: dashboard.sparklines, orders: dashboard.orders, items: dashboard.items, contacts: contacts, yearsAvailable: dashboard.yearsAvailable, activePeriod: activePeriod }) })] }));
}
