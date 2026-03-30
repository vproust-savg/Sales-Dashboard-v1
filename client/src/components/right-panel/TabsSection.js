import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FILE: client/src/components/right-panel/TabsSection.tsx
// PURPOSE: Tab bar (Orders, Items, Contacts) with gold underline, count badges, keyboard nav
// USED BY: RightPanel
// EXPORTS: TabsSection
import { useState, useRef, useCallback } from 'react';
import { OrdersTable } from './OrdersTable';
import { ItemsAccordion } from './ItemsAccordion';
import { ContactsTable } from './ContactsTable';
export function TabsSection({ orders, items, contacts }) {
    const [activeTab, setActiveTab] = useState('orders');
    const tabListRef = useRef(null);
    const tabs = [
        { key: 'orders', label: 'Orders', count: orders.length },
        { key: 'items', label: 'Items', count: items.reduce((sum, cat) => sum + cat.itemCount, 0) },
        { key: 'contacts', label: 'Contacts', count: contacts.length },
    ];
    /** WHY keyboard nav — spec Section 22.6 requires role="tablist" with arrow key support */
    const handleKeyDown = useCallback((e) => {
        const currentIndex = tabs.findIndex((t) => t.key === activeTab);
        let nextIndex = currentIndex;
        if (e.key === 'ArrowRight') {
            nextIndex = (currentIndex + 1) % tabs.length;
        }
        else if (e.key === 'ArrowLeft') {
            nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        }
        else {
            return;
        }
        e.preventDefault();
        const nextKey = tabs[nextIndex].key;
        setActiveTab(nextKey);
        /* Focus the newly active tab button */
        const buttons = tabListRef.current?.querySelectorAll('[role="tab"]');
        buttons?.[nextIndex]?.focus();
    }, [activeTab, tabs]);
    return (_jsxs("div", { className: "flex flex-1 flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)] min-h-[260px]", children: [_jsx("div", { ref: tabListRef, role: "tablist", "aria-label": "Detail tabs", onKeyDown: handleKeyDown, className: "flex gap-6 border-b border-[var(--color-gold-subtle)] px-[var(--spacing-3xl)]", children: tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (_jsxs("button", { role: "tab", type: "button", id: `tab-${tab.key}`, "aria-selected": isActive, "aria-controls": `panel-${tab.key}`, tabIndex: isActive ? 0 : -1, onClick: () => setActiveTab(tab.key), className: `relative flex items-center gap-1.5 py-3 text-[14px] transition-colors duration-200 outline-none ${isActive
                            ? 'font-bold text-[var(--color-text-primary)]'
                            : 'font-medium text-[#888] hover:text-[var(--color-text-secondary)]'}`, children: [tab.label, _jsx("span", { className: `inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-semibold ${isActive
                                    ? 'bg-[var(--color-dark)] text-white'
                                    : 'bg-[var(--color-gold-subtle)] text-[#888]'}`, children: tab.count }), isActive && (_jsx("span", { className: "absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--color-gold-primary)]", "aria-hidden": "true" }))] }, tab.key));
                }) }), _jsx("div", { className: "flex-1 overflow-y-auto", children: _jsxs("div", { role: "tabpanel", id: `panel-${activeTab}`, "aria-labelledby": `tab-${activeTab}`, children: [activeTab === 'orders' && _jsx(OrdersTable, { orders: orders }), activeTab === 'items' && _jsx(ItemsAccordion, { items: items }), activeTab === 'contacts' && _jsx(ContactsTable, { contacts: contacts })] }) })] }));
}
