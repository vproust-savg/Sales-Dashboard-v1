// FILE: client/src/components/right-panel/TabsSection.tsx
// PURPOSE: Tab bar (Orders, Items, Contacts) with gold underline, count badges, keyboard nav
// USED BY: RightPanel
// EXPORTS: TabsSection

import { useRef, useCallback } from 'react';
import type { OrderRow, FlatItem, Contact } from '@shared/types/dashboard';
import { OrdersTab } from './OrdersTab';
import { ItemsExplorer } from './ItemsExplorer';
import { ContactsTable } from './ContactsTable';
import { ConsolidatedOrdersTable } from './ConsolidatedOrdersTable';
import { ConsolidatedContactsTable } from './ConsolidatedContactsTable';
import type { DetailTab } from './detail-tab-types';

interface TabsSectionProps {
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  orders: OrderRow[];
  items: FlatItem[];
  contacts: Contact[];
  consolidatedMode?: boolean;
}

interface TabDef {
  key: DetailTab;
  label: string;
  count: number;
}

export function TabsSection({ activeTab, onTabChange, orders, items, contacts, consolidatedMode }: TabsSectionProps) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const tabs: TabDef[] = [
    { key: 'orders', label: 'Orders', count: orders.length },
    { key: 'items', label: 'Items', count: items.length },
    { key: 'contacts', label: 'Contacts', count: contacts.length },
  ];

  /** WHY keyboard nav — spec Section 22.6 requires role="tablist" with arrow key support */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = tabs.findIndex((t) => t.key === activeTab);
      let nextIndex = currentIndex;

      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else {
        return;
      }

      e.preventDefault();
      onTabChange(tabs[nextIndex].key);

      /* Focus the newly active tab button */
      const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[nextIndex]?.focus();
    },
    [activeTab, onTabChange, tabs],
  );

  return (
    <div className="flex flex-1 flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)] min-h-[260px]">
      {/* Tab bar */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Detail tabs"
        onKeyDown={handleKeyDown}
        className="sticky top-0 z-10 flex gap-6 border-b border-[var(--color-gold-subtle)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)]"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              id={`tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.key)}
              className={`relative flex items-center gap-1.5 py-3 text-[15px] transition-colors duration-200 ${
                isActive
                  ? 'font-bold text-[var(--color-text-primary)]'
                  : 'font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {tab.label}

              {/* Count badge */}
              <span
                className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-semibold ${
                  isActive
                    ? 'bg-[var(--color-dark)] text-white'
                    : 'bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)]'
                }`}
              >
                {tab.count}
              </span>

              {/* Active underline — gold 2px, offset -1px over the border */}
              {isActive && (
                <span
                  className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--color-gold-primary)]"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      <div className="flex-1 overflow-y-auto">
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === 'orders' && (
            consolidatedMode
              ? <ConsolidatedOrdersTable orders={orders} />
              : <OrdersTab orders={orders} />
          )}
          {activeTab === 'items' && <ItemsExplorer items={items} />}
          {activeTab === 'contacts' && (
            consolidatedMode
              ? <ConsolidatedContactsTable contacts={contacts} />
              : <ContactsTable contacts={contacts} />
          )}
        </div>
      </div>
    </div>
  );
}
