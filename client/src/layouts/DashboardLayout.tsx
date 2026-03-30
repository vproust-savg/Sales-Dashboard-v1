// FILE: client/src/layouts/DashboardLayout.tsx
// PURPOSE: Master-detail layout — left panel (280px) + right panel (flex:1), loading/error states
// USED BY: client/src/App.tsx
// EXPORTS: DashboardLayout

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DashboardPayload, Contact, Dimension, Period } from '@shared/types/dashboard';
import type { FilterCondition } from '../hooks/useFilters';
import type { SortField, SortDirection } from '../hooks/useSort';
import { LeftPanel } from '../components/left-panel/LeftPanel';
import { RightPanel } from '../components/right-panel/RightPanel';
import { Skeleton } from '../components/shared/Skeleton';
import { useExport } from '../hooks/useExport';

export interface DashboardLayoutProps {
  // Data
  dashboard: DashboardPayload | null;
  contacts: Contact[];
  isLoading: boolean;
  error: string | null;
  meta: unknown;

  // State
  activeDimension: Dimension;
  activePeriod: Period;
  activeEntityId: string | null;
  selectedEntityIds: string[];
  isConsolidated: boolean;
  searchTerm: string;
  filterConditions: FilterCondition[];
  filterOpen: boolean;
  filterCount: number;
  sortField: SortField;
  sortDirection: SortDirection;

  // Actions
  switchDimension: (dim: Dimension) => void;
  switchPeriod: (period: Period) => void;
  selectEntity: (id: string) => void;
  toggleCheckbox: (id: string) => void;
  viewConsolidated: () => void;
  clearSelection: () => void;
  setSearchTerm: (term: string) => void;
  addCondition: () => void;
  updateCondition: (id: string, updates: Partial<FilterCondition>) => void;
  removeCondition: (id: string) => void;
  clearFilters: () => void;
  toggleFilterPanel: () => void;
  setSort: (field: SortField) => void;
}

export function DashboardLayout(props: DashboardLayoutProps) {
  const {
    dashboard, contacts, isLoading, error,
    activeDimension, activePeriod, activeEntityId, selectedEntityIds,
    searchTerm, filterConditions, filterOpen, filterCount,
    sortField, sortDirection,
    switchDimension, switchPeriod, selectEntity, toggleCheckbox,
    viewConsolidated, clearSelection, setSearchTerm,
    addCondition, updateCondition, removeCondition, clearFilters, toggleFilterPanel,
    setSort,
  } = props;

  // WHY: Auto-select first entity when data loads and nothing is selected
  useEffect(() => {
    if (dashboard?.entities.length && !activeEntityId) {
      selectEntity(dashboard.entities[0].id);
    }
  }, [dashboard?.entities, activeEntityId, selectEntity]);

  // WHY: useExport called before early returns to satisfy React hook ordering rules
  const exportData = dashboard && activeEntityId ? {
    entityName: dashboard.entities.find(e => e.id === activeEntityId)?.name ?? 'Dashboard',
    period: activePeriod,
    kpis: dashboard.kpis,
    orders: dashboard.orders,
    items: dashboard.items,
  } : null;
  const { exportCsv } = useExport(exportData);

  // --- Loading state ---
  if (isLoading && !dashboard) {
    return (
      <div
        className="mx-auto flex h-[calc(100vh-32px)] max-w-[1440px] gap-[var(--spacing-2xl)] p-[var(--spacing-2xl)]"
        role="application"
        aria-label="Sales Dashboard"
      >
        <div className="w-[280px] shrink-0">
          <Skeleton variant="left-panel" />
        </div>
        <div className="min-w-0 flex-1">
          <Skeleton variant="right-panel" />
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error && !dashboard) {
    return (
      <div
        className="mx-auto flex h-[calc(100vh-32px)] max-w-[1440px] items-center justify-center p-[var(--spacing-2xl)]"
        role="application"
        aria-label="Sales Dashboard"
      >
        <div className="rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-4xl)] py-[var(--spacing-3xl)] text-center shadow-[var(--shadow-card)]">
          <p className="text-[16px] font-semibold text-[var(--color-red)]">Failed to load dashboard</p>
          <p className="mt-[var(--spacing-md)] text-[13px] text-[var(--color-text-muted)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const activeEntity = dashboard.entities.find(e => e.id === activeEntityId) ?? null;
  /** WHY: totalCount before filtering — useDashboardState may have filtered the list,
   *  but EntityList header needs the original count for "12 of 45" display. */
  const totalCount = dashboard.entities.length;

  /** WHY: sortActive is true when sort is NOT the default (revenue desc) */
  const sortActive = sortField !== 'revenue' || sortDirection !== 'desc';

  return (
    <div
      className="mx-auto flex h-[calc(100vh-32px)] max-w-[1440px] gap-[var(--spacing-2xl)] p-[var(--spacing-2xl)] max-lg:h-auto max-lg:flex-col max-lg:overflow-y-auto"
      role="application"
      aria-label="Sales Dashboard"
    >
      <div className="flex w-[280px] shrink-0 flex-col gap-[var(--spacing-base)] max-lg:w-full">
        <LeftPanel
          entities={dashboard.entities}
          activeDimension={activeDimension}
          activeEntityId={activeEntityId}
          selectedEntityIds={selectedEntityIds}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterOpen={filterOpen}
          filterCount={filterCount}
          filterConditions={filterConditions}
          onFilterToggle={toggleFilterPanel}
          onAddCondition={addCondition}
          onUpdateCondition={updateCondition}
          onRemoveCondition={removeCondition}
          onClearFilters={clearFilters}
          sortField={sortField}
          sortDirection={sortDirection}
          sortActive={sortActive}
          onSort={setSort}
          totalCount={totalCount}
          onDimensionChange={switchDimension}
          onEntitySelect={selectEntity}
          onEntityCheck={toggleCheckbox}
          onClearSelection={clearSelection}
          onViewConsolidated={viewConsolidated}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-base)] overflow-y-auto pr-[var(--spacing-xs)] max-lg:pr-0">
        {/* WHY AnimatePresence: fade out/in right panel when active entity changes per spec 21.1 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeEntityId ?? 'none'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-[var(--spacing-base)]"
          >
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
              onPeriodChange={switchPeriod}
              onExport={exportCsv}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
