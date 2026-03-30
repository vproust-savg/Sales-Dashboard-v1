// FILE: client/src/layouts/DashboardLayout.tsx
// PURPOSE: Master-detail layout — left panel (280px) + right panel (flex:1)
// USED BY: client/src/App.tsx
// EXPORTS: DashboardLayout

import type { DashboardPayload, Contact, Dimension, Period } from '@shared/types/dashboard';
import { LeftPanel } from '../components/left-panel/LeftPanel';
import { RightPanel } from '../components/right-panel/RightPanel';

interface DashboardLayoutProps {
  dashboard: DashboardPayload;
  contacts: Contact[];
  activeDimension: Dimension;
  activePeriod: Period;
  activeEntityId: string | null;
  selectedEntityIds: string[];
}

export function DashboardLayout({
  dashboard, contacts, activeDimension, activePeriod,
  activeEntityId, selectedEntityIds,
}: DashboardLayoutProps) {
  const activeEntity = dashboard.entities.find(e => e.id === activeEntityId) ?? null;

  return (
    <div
      className="mx-auto flex h-[calc(100vh-32px)] max-w-[1440px] gap-[var(--spacing-2xl)] p-[var(--spacing-2xl)]"
      role="application"
      aria-label="Sales Dashboard"
    >
      {/* Left panel — 280px fixed */}
      <div className="flex w-[280px] shrink-0 flex-col gap-[var(--spacing-base)]">
        <LeftPanel
          entities={dashboard.entities}
          activeDimension={activeDimension}
          activeEntityId={activeEntityId}
          selectedEntityIds={selectedEntityIds}
        />
      </div>

      {/* Right panel — fills remaining space */}
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-base)] overflow-y-auto pr-[var(--spacing-xs)]">
        <RightPanel
          entity={activeEntity}
          kpis={dashboard.kpis}
          monthlyRevenue={dashboard.monthlyRevenue}
          productMix={dashboard.productMix}
          topSellers={dashboard.topSellers}
          sparklines={dashboard.sparklines}
          orders={dashboard.orders}
          items={dashboard.items}
          contacts={contacts}
          yearsAvailable={dashboard.yearsAvailable}
          activePeriod={activePeriod}
        />
      </div>
    </div>
  );
}
