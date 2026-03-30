import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatCurrency } from '@shared/utils/formatting';
/** WHY gold vs neutral: spec says top 3 get gold badges, 4-10 get neutral */
function rankBadgeClasses(rank) {
    if (rank <= 3) {
        return 'bg-[var(--color-gold-primary)] text-white';
    }
    return 'bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)]';
}
function SellerRow({ item }) {
    return (_jsxs("div", { className: "flex items-center gap-[var(--spacing-md)] border-b border-[#f5f1eb] py-[7px]", children: [_jsx("span", { className: `flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[10px] font-semibold ${rankBadgeClasses(item.rank)}`, children: item.rank }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-[13px] font-medium leading-tight text-[var(--color-text-primary)]", title: item.name, children: item.name }), _jsx("p", { className: "truncate text-[10px] text-[var(--color-text-faint)]", title: item.sku, children: item.sku })] }), _jsxs("div", { className: "shrink-0 text-right", children: [_jsx("p", { className: "text-[14px] font-semibold text-[var(--color-text-primary)]", children: formatCurrency(item.revenue) }), _jsxs("p", { className: "text-[10px] text-[var(--color-text-muted)]", children: [item.units.toLocaleString('en-US'), " units"] })] })] }));
}
export function TopTenBestSellers({ data }) {
    const leftColumn = data.filter(item => item.rank <= 5);
    const rightColumn = data.filter(item => item.rank > 5 && item.rank <= 10);
    return (_jsxs("div", { className: "grid grid-cols-2 gap-[var(--spacing-4xl)]", children: [_jsx("div", { className: "border-r border-[var(--color-gold-subtle)] pr-[var(--spacing-4xl)]", children: leftColumn.map(item => (_jsx(SellerRow, { item: item }, item.rank))) }), _jsx("div", { children: rightColumn.map(item => (_jsx(SellerRow, { item: item }, item.rank))) })] }));
}
