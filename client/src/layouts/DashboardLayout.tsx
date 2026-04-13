// FILE: client/src/layouts/DashboardLayout.tsx
// PURPOSE: Master-detail layout — left panel (280px) + right panel (flex:1), two-stage loading
// USED BY: client/src/App.tsx
// EXPORTS: DashboardLayout

import { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DashboardPayload, EntityListItem, Contact, Dimension, Period, EntityListLoadState, SSEProgressEvent, FetchAllFilters } from '@shared/types/dashboard';
import type { FilterCondition } from '../hooks/useFilters';
import type { SortField, SortDirection } from '../hooks/useSort';
import type { ApiResponse } from '@shared/types/api-responses';
import { LeftPanel } from '../components/left-panel/LeftPanel';
import { RightPanel } from '../components/right-panel/RightPanel';
import { FetchAllProgress } from '../components/right-panel/FetchAllProgress';
import { FetchAllDialog } from '../components/shared/FetchAllDialog';
import { LoadingModal } from '../components/shared/LoadingModal';
import { Skeleton } from '../components/shared/Skeleton';
import { useExport } from '../hooks/useExport';

export interface DashboardLayoutProps {
  dashboard: DashboardPayload | null;
  entities: EntityListItem[];
  allEntities: EntityListItem[];
  contacts: Contact[];
  isLoading: boolean;
  isDetailLoading: boolean;
  loadingStage: string | null;
  error: string | null;
  meta: ApiResponse<unknown>['meta'] | null;
  yearsAvailable: string[];
  activeDimension: Dimension;
  activePeriod: Period;
  activeEntityId: string | null;
  selectedEntityIds: string[];
  searchTerm: string;
  filterConditions: FilterCondition[];
  filterOpen: boolean;
  filterCount: number;
  sortField: SortField;
  sortDirection: SortDirection;
  dataLoaded: boolean;
  fetchAllLoadState: EntityListLoadState;
  fetchAllProgress: SSEProgressEvent | null;
  allDashboard: DashboardPayload | null;
  startFetchAll: (filters: FetchAllFilters, forceRefresh?: boolean) => void;
  abortFetch: () => void;
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
    dashboard, entities, allEntities, contacts, isLoading, isDetailLoading, loadingStage, error,
    activeDimension, activePeriod, activeEntityId, selectedEntityIds, yearsAvailable,
    searchTerm, filterConditions, filterOpen, filterCount,
    sortField, sortDirection, dataLoaded, fetchAllLoadState, fetchAllProgress, allDashboard,
    startFetchAll,
    switchDimension, switchPeriod, selectEntity, toggleCheckbox,
    viewConsolidated, clearSelection, setSearchTerm,
    addCondition, updateCondition, removeCondition, clearFilters, toggleFilterPanel,
    setSort,
  } = props;

  useEffect(() => {
    if (entities.length > 0 && !activeEntityId) selectEntity(entities[0].id);
  }, [entities, activeEntityId, selectEntity]);

  const exportData = dashboard && activeEntityId ? {
    entityName: entities.find(e => e.id === activeEntityId)?.name ?? 'Dashboard',
    period: activePeriod, kpis: dashboard.kpis, orders: dashboard.orders, items: dashboard.items,
  } : null;
  const { exportCsv } = useExport(exportData);

  // WHY: All hooks must be called before any early returns (React Rules of Hooks)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRefresh, setDialogRefresh] = useState(false);
  const entitiesWithOrders = useMemo(
    () => allEntities.filter(e => e.revenue !== null && e.revenue > 0).length,
    [allEntities],
  );

  if (isLoading && entities.length === 0) {
    return (
      <>
        <LoadingModal stage={loadingStage} />
        <div
          className="mx-auto flex h-[calc(100vh-32px)] gap-[var(--spacing-2xl)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)]"
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
      </>
    );
  }

  // --- Error state ---
  if (error && entities.length === 0) {
    return (
      <div
        className="mx-auto flex h-[calc(100vh-32px)] items-center justify-center px-[var(--spacing-3xl)] py-[var(--spacing-2xl)]"
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

  const activeEntity = entities.find(e => e.id === activeEntityId) ?? null;
  const totalCount = entities.length;
  const sortActive = sortField !== 'id' || sortDirection !== 'asc';

  const handleAllClick = () => {
    if (fetchAllLoadState === 'loaded') { selectEntity('__ALL__'); }
    else if (fetchAllLoadState !== 'loading') { setDialogRefresh(false); setDialogOpen(true); }
  };
  const handleRefresh = () => { setDialogRefresh(true); setDialogOpen(true); };
  const handleDialogConfirm = (filters: FetchAllFilters) => { setDialogOpen(false); startFetchAll(filters, dialogRefresh); selectEntity('__ALL__'); };

  // WHY: When activeEntityId is '__ALL__' and data is loaded, show allDashboard
  const displayDashboard = activeEntityId === '__ALL__' && allDashboard ? allDashboard : dashboard;
  const isAllActive = activeEntityId === '__ALL__';

  return (
    <>
      {/* WHY: Show loading modal when fetching detail data for a selected entity */}
      <LoadingModal stage={isDetailLoading && !isAllActive ? loadingStage : null} />
      <FetchAllDialog
        isOpen={dialogOpen}
        dimension={activeDimension}
        entities={allEntities}
        isRefresh={dialogRefresh}
        onConfirm={handleDialogConfirm}
        onCancel={() => setDialogOpen(false)}
      />

      <div
        className="mx-auto flex h-[calc(100vh-32px)] gap-[var(--spacing-2xl)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] max-lg:h-auto max-lg:flex-col max-lg:overflow-y-auto"
        role="application"
        aria-label="Sales Dashboard"
      >
        <div className="flex w-[280px] shrink-0 flex-col gap-[var(--spacing-base)] max-lg:w-full">
          <LeftPanel
            entities={entities}
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
            dataLoaded={dataLoaded}
            fetchAllLoadState={fetchAllLoadState}
            allDashboard={allDashboard}
            entitiesWithOrders={entitiesWithOrders}
            onAllClick={handleAllClick}
            onRefresh={handleRefresh}
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
          {fetchAllLoadState === 'loading' ? (
            <FetchAllProgress progress={fetchAllProgress} />
          ) : (
            <AnimatePresence mode="wait">
              {displayDashboard ? (
                <motion.div
                  key={activeEntityId ?? 'none'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col gap-[var(--spacing-base)]"
                >
                  <RightPanel
                    entity={isAllActive ? null : activeEntity}
                    kpis={displayDashboard.kpis}
                    monthlyRevenue={displayDashboard.monthlyRevenue}
                    productMixes={displayDashboard.productMixes}
                    topSellers={displayDashboard.topSellers}
                    sparklines={displayDashboard.sparklines}
                    orders={displayDashboard.orders}
                    items={displayDashboard.items}
                    contacts={contacts}
                    yearsAvailable={yearsAvailable}
                    activePeriod={activePeriod}
                    onPeriodChange={switchPeriod}
                    onExport={exportCsv}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-1 items-center justify-center"
                >
                  <p className="text-[14px] text-[var(--color-text-muted)]">
                    Select a customer to view details
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </>
  );
}
