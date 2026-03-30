import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { EmptyState } from '../shared/EmptyState';
/** WHY column widths are 25% each — spec Section 22.6 mandates even distribution */
const COLUMNS = ['Full Name', 'Position', 'Phone', 'Email'];
export function ContactsTable({ contacts }) {
    if (contacts.length === 0) {
        return (_jsx(EmptyState, { title: "No contacts on file.", description: "Contact information will appear here when available." }));
    }
    return (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { children: _jsx("tr", { className: "border-b border-[var(--color-gold-subtle)]", children: COLUMNS.map((col) => (_jsx("th", { className: "w-1/4 px-[var(--spacing-3xl)] py-[var(--spacing-lg)] text-left text-[11px] font-semibold uppercase text-[#888] tracking-wide", children: col }, col))) }) }), _jsx("tbody", { children: contacts.map((contact) => (_jsxs("tr", { className: "border-b border-[var(--color-bg-page)]", children: [_jsx("td", { className: "w-1/4 px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-primary)]", children: contact.fullName }), _jsx("td", { className: "w-1/4 px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-primary)]", children: contact.position }), _jsx("td", { className: "w-1/4 px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] text-[var(--color-text-primary)]", children: contact.phone }), _jsx("td", { className: "w-1/4 px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-[13px] truncate max-w-0", children: _jsx("a", { href: `mailto:${contact.email}`, className: "text-[var(--color-gold-primary)] no-underline hover:underline", title: contact.email, children: contact.email }) })] }, contact.email))) })] }) }));
}
