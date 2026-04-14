// FILE: client/src/layouts/DashboardLayout.tsx
// PURPOSE: Master-detail layout — left panel (280px) + right panel (flex:1), two-stage loading
// USED BY: client/src/App.tsx
// EXPORTS: DashboardLayout

import { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FetchAllFilters } from '@shared/types/dashboard';
import { LeftPanel } from '../components/left-panel/LeftPanel';
import { RightPanel } from '../components/right-panel/RightPanel';
import { FetchAllProgress } from '../components/right-panel/FetchAllProgress';
import { FetchAllDialog } from '../components/shared/FetchAllDialog';
import { LoadingModal } from '../components/shared/LoadingModal';
import { Skeleton } from '../components/shared/Skeleton';
import { DIMENSION_CONFIG } from '../utils/dimension-config';
import { useExport } from '../hooks/useExport';
import { CollapsedPanel } from '../components/left-panel/CollapsedPanel';
import type { DashboardLayoutProps } from './dashboard-layout-types';
import { selectDisplayDashboard } from './select-display-dashboard';

export type { DashboardLayoutProps };

export function DashboardLayout(props: DashboardLayoutProps) {
  const {
    dashboard, entities, allEntities, contacts, isLoading, isDetailLoading, loadingStage, error,
    activeDimension, activePeriod, activeEntityId, activeTab, selectedEntityIds, yearsAvailable,
    searchTerm, filterConditions, filterOpen, filterCount,
    sortField, sortDirection, dataLoaded, fetchAllLoadState, fetchAllProgress, allDashboard,
    isConsolidated, isConsolidatedLoading,
    startFetchAll,
    switchDimension, switchPeriod, selectEntity, toggleCheckbox,
    setActiveTab,
    viewConsolidated, clearSelection, setSearchTerm,
    addCondition, updateCondition, removeCondition, clearFilters, toggleFilterPanel,
    setSort,
    panelCollapsed,
    togglePanel,
  } = props;

  const exportData = dashboard && activeEntityId ? {
    entityName: entities.find(e => e.id === activeEntityId)?.name ?? 'Dashboard',
    period: activePeriod, kpis: dashboard.kpis, orders: dashboard.orders, items: dashboard.items,
  } : null;
  const { exportCsv } = useExport(exportData);

  /** WHY: [ key toggles left panel collapse — quick keyboard shortcut per spec */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        togglePanel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePanel]);

  /** WHY: One-time cleanup of stale layout localStorage from the removed resize/preset system */
  useEffect(() => {
    localStorage.removeItem('sg-dashboard-layout');
  }, []);

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
        <div className="mx-auto flex h-[calc(100vh-32px)] gap-[var(--spacing-2xl)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)]">
          <div className="w-[280px] shrink-0"><Skeleton variant="left-panel" /></div>
          <div className="min-w-0 flex-1"><Skeleton variant="right-panel" /></div>
        </div>
      </>
    );
  }

  if (error && entities.length === 0) {
    return (
      <div className="mx-auto flex h-[calc(100vh-32px)] items-center justify-center px-[var(--spacing-3xl)] py-[var(--spacing-2xl)]">
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
  const displayDashboard = selectDisplayDashboard({ isConsolidated, activeEntityId, allDashboard, dashboard });
  const isAllActive = activeEntityId === '__ALL__';

  return (
    <>
      <LoadingModal stage={isDetailLoading && !isAllActive ? loadingStage : null} />
      <FetchAllDialog isOpen={dialogOpen} dimension={activeDimension} entities={allEntities} isRefresh={dialogRefresh} onConfirm={handleDialogConfirm} onCancel={() => setDialogOpen(false)} />

      <div className="mx-auto flex h-[calc(100vh-32px)] gap-[var(--spacing-2xl)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] max-lg:h-auto max-lg:flex-col max-lg:overflow-y-auto">
        {panelCollapsed ? (
          <aside className="w-auto shrink-0" aria-label="Entity list and filters">
            <CollapsedPanel activeDimension={activeDimension} onExpand={togglePanel} />
          </aside>
        ) : (
          <aside className="group/left relative flex w-[280px] shrink-0 flex-col gap-[var(--spacing-base)] max-lg:w-full" aria-label="Entity list and filters">
            <button type="button" onClick={togglePanel} className="absolute right-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-faint)] opacity-0 transition-[opacity,background-color,color] hover:bg-[var(--color-gold-subtle)] hover:text-[var(--color-text-muted)] group-hover/left:opacity-100" aria-label="Collapse panel" title="Collapse panel (or press [)">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M8 2L3 6l5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <LeftPanel
              entities={entities} activeDimension={activeDimension} activeEntityId={activeEntityId}
              selectedEntityIds={selectedEntityIds} searchTerm={searchTerm} onSearchChange={setSearchTerm}
              filterOpen={filterOpen} filterCount={filterCount} filterConditions={filterConditions}
              onFilterToggle={toggleFilterPanel} onAddCondition={addCondition} onUpdateCondition={updateCondition}
              onRemoveCondition={removeCondition} onClearFilters={clearFilters} sortField={sortField}
              sortDirection={sortDirection} sortActive={sortActive} dataLoaded={dataLoaded}
              fetchAllLoadState={fetchAllLoadState} allDashboard={allDashboard} entitiesWithOrders={entitiesWithOrders}
              onAllClick={handleAllClick} onRefresh={handleRefresh} onSort={setSort} totalCount={totalCount}
              onDimensionChange={switchDimension} onEntitySelect={selectEntity} onEntityCheck={toggleCheckbox}
              onClearSelection={clearSelection} onViewConsolidated={viewConsolidated}
            />
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-base)] overflow-y-auto pr-[var(--spacing-xs)] max-lg:pr-0" aria-label="Dashboard details">
          {/* WHY: fetchAllError is normally swallowed by the entities.length===0 gate.
           *  Show it as a dismissable banner so the user knows what went wrong and can retry. */}
          {fetchAllLoadState === 'error' && error && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-[var(--color-red)] bg-[var(--color-bg-card)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px]">
              <span className="text-[var(--color-red)]">Failed to load data: {error}</span>
              <button
                type="button"
                onClick={() => { setDialogRefresh(false); setDialogOpen(true); }}
                className="shrink-0 rounded-[var(--radius-base)] bg-[var(--color-dark)] px-[var(--spacing-lg)] py-[5px] text-[12px] font-medium text-white hover:opacity-90 transition-opacity"
              >
                Retry
              </button>
            </div>
          )}
          {fetchAllLoadState === 'loading' ? (
            <FetchAllProgress progress={fetchAllProgress} />
          ) : (
            <AnimatePresence mode="wait">
              {displayDashboard ? (
                <motion.div key={activeEntityId ?? 'none'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex flex-col gap-[var(--spacing-base)]">
                  <RightPanel
                    entity={isAllActive ? null : activeEntity} kpis={displayDashboard.kpis}
                    monthlyRevenue={displayDashboard.monthlyRevenue} productMixes={displayDashboard.productMixes}
                    topSellers={displayDashboard.topSellers} sparklines={displayDashboard.sparklines}
                    orders={displayDashboard.orders} items={displayDashboard.items} contacts={contacts}
                    yearsAvailable={yearsAvailable} activePeriod={activePeriod} activeTab={activeTab}
                    onPeriodChange={switchPeriod} onTabChange={setActiveTab} onExport={exportCsv}
                  />
                </motion.div>
              ) : (
                <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 items-center justify-center">
                  <p className="text-[14px] text-[var(--color-text-muted)]">
                    {isConsolidatedLoading
                      ? 'Loading consolidated view\u2026'
                      : `Select a ${DIMENSION_CONFIG[activeDimension].singularLabel} to view details`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>
    </>
  );
}
