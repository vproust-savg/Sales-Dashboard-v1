import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatCurrency, formatPercent, formatDate } from '@shared/utils/formatting';
import { EmptyState } from '../shared/EmptyState';
const COLUMNS = ['Date', 'Order #', 'Items', 'Amount', 'Margin %', 'Margin $', 'Status'];
/** WHY status colors map — spec Section 4.4 / 10.4: Delivered=green, Pending=yellow, Processing=blue */
const STATUS_STYLES = {
    Delivered: 'bg-[#dcfce7] text-[var(--color-green)]',
    Pending: 'bg-[#fef9c3] text-[var(--color-yellow)]',
    Processing: 'bg-[#dbeafe] text-[var(--color-blue)]',
};
export function OrdersTable({ orders }) {
    if (orders.length === 0) {
        return (_jsx(EmptyState, { title: "No orders for this period.", description: "Orders will appear here when available." }));
    }
    /** WHY sorted copy — spec Section 13.6 mandates date descending, we don't mutate props */
    const sorted = [...orders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { children: _jsx("tr", { className: "border-b border-[var(--color-gold-subtle)]", children: COLUMNS.map((col) => (_jsx("th", { className: "px-[var(--spacing-3xl)] py-[var(--spacing-lg)] text-left text-[11px] font-semibold uppercase text-[#888] tracking-wide whitespace-nowrap", children: col }, col))) }) }), _jsx("tbody", { children: sorted.map((order) => (_jsxs("tr", { className: "border-b border-[var(--color-bg-page)]", children: [_jsx("td", { className: "px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-primary)] whitespace-nowrap", children: formatDate(order.date) }), _jsx("td", { className: "px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] font-medium text-[var(--color-text-primary)]", children: order.orderNumber }), _jsx("td", { className: "px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-secondary)] text-center", children: order.itemCount }), _jsx("td", { className: "px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-primary)] tabular-nums", children: formatCurrency(order.amount) }), _jsx("td", { className: "px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-secondary)] tabular-nums", children: formatPercent(order.marginPercent) }), _jsx("td", { className: "px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-secondary)] tabular-nums", children: formatCurrency(order.marginAmount) }), _jsx("td", { className: "px-[var(--spacing-3xl)] py-[var(--spacing-base)]", children: _jsx(StatusBadge, { status: order.status }) })] }, order.orderNumber))) })] }) }));
}
function StatusBadge({ status }) {
    return (_jsx("span", { className: `inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLES[status]}`, children: status }));
}
