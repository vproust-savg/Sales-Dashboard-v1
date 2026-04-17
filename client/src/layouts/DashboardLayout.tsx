// FILE: client/src/layouts/DashboardLayout.tsx
// PURPOSE: Master-detail layout — left panel (280px) + right panel (flex:1), two-stage loading
// USED BY: client/src/App.tsx
// EXPORTS: DashboardLayout

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FetchAllFilters } from '@shared/types/dashboard';
import { LeftPanel } from '../components/left-panel/LeftPanel';
import { RightPanel } from '../components/right-panel/RightPanel';
import { ConsolidatedHeader } from '../components/right-panel/ConsolidatedHeader';
import { ReportFilterModal } from '../components/shared/ReportFilterModal';
import { ReportProgressModal } from '../components/shared/ReportProgressModal';
import { computeReportModalState } from '../hooks/report-modal-state';
import { LoadingModal } from '../components/shared/LoadingModal';
import { Skeleton } from '../components/shared/Skeleton';
import { DIMENSION_CONFIG } from '../utils/dimension-config';
import { useExport } from '../hooks/useExport';
import { CollapsedPanel } from '../components/left-panel/CollapsedPanel';
import type { DashboardLayoutProps } from './dashboard-layout-types';

export type { DashboardLayoutProps };

export function DashboardLayout(props: DashboardLayoutProps) {
  const {
    dashboard, entities, allEntities, contacts, isLoading, isDetailLoading, loadingStage, error,
    activeDimension, activePeriod, activeEntityId, activeTab, selectedEntityIds,
    searchTerm, filterConditions, filterOpen, filterCount,
    sortField, sortDirection,
    report,
    switchDimension, selectEntity, toggleCheckbox,
    setActiveTab,
    clearSelection, resetSelection, setSearchTerm,
    addCondition, updateCondition, removeCondition, clearFilters, toggleFilterPanel,
    setSort,
    panelCollapsed,
    togglePanel,
  } = props;

  // WHY: report.state === 'loaded' means we render the consolidated surface; otherwise single-entity mode.
  // View Consolidated now routes through useReport (D3), so both Report and View Consolidated
  // use the same state machine — no mutual-exclusion effects needed.
  const activeView: 'single' | 'report' =
    report.state === 'loaded' ? 'report' : 'single';

  const consolidatedPayload = activeView === 'report' ? report.payload : null;

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

  const modalState = computeReportModalState(report);

  const activeEntity = entities.find(e => e.id === activeEntityId) ?? null;
  const totalCount = entities.length;
  const sortActive = sortField !== 'id' || sortDirection !== 'asc';

  const handleReportClick = () => { report.open(); };
  // WHY: View Consolidated now routes through useReport so the same ReportProgressModal
  // handles loading, cancel, and retry. entityIds are passed as a filter so the server
  // scopes the fetch-all result to the selection.
  const handleViewConsolidatedClick = () => { report.startReport({ entityIds: selectedEntityIds }); };
  const handleReportStart = (filters: FetchAllFilters, forceRefresh: boolean) => {
    report.startReport(filters, forceRefresh);
  };

  return (
    <>
      <LoadingModal stage={isDetailLoading ? loadingStage : null} />
      <ReportFilterModal
        isOpen={report.state === 'configuring'}
        entities={allEntities}
        activeDimension={activeDimension}
        onConfirm={handleReportStart}
        onCancel={report.cancel}
      />
      <ReportProgressModal
        isOpen={modalState.isOpen}
        progress={modalState.mode === 'fetching' ? report.progress : null}
        errorMessage={modalState.errorMessage}
        onCancel={report.cancelFetch}
        onClose={report.cancelFetch}
        onRetry={report.retry}
      />
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
              sortDirection={sortDirection} sortActive={sortActive} onSort={setSort} totalCount={totalCount}
              onDimensionChange={switchDimension} onEntitySelect={selectEntity} onEntityCheck={toggleCheckbox}
              onClearSelection={clearSelection}
              reportState={report.state}
              activeView={activeView}
              onReportClick={handleReportClick}
              onViewConsolidatedClick={handleViewConsolidatedClick}
            />
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-base)] overflow-y-auto pr-[var(--spacing-xs)] max-lg:pr-0" aria-label="Dashboard details">
          {activeView !== 'single' && consolidatedPayload ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-[var(--spacing-base)]"
              >
                <ConsolidatedHeader
                  mode="report"
                  entityCount={consolidatedPayload.entities.length}
                  dimensionLabel={DIMENSION_CONFIG[activeDimension].pluralLabel}
                  filters={report.filters}
                  onExport={exportCsv}
                  onClose={() => { report.reset(); resetSelection(); }}
                />
                <RightPanel
                  entity={null}
                  activeDimension={activeDimension}
                  kpis={consolidatedPayload.kpis}
                  monthlyRevenue={consolidatedPayload.monthlyRevenue}
                  productMixes={consolidatedPayload.productMixes}
                  topSellers={consolidatedPayload.topSellers}
                  sparklines={consolidatedPayload.sparklines}
                  orders={consolidatedPayload.orders}
                  items={consolidatedPayload.items}
                  contacts={contacts}
                  activePeriod={activePeriod}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  onExport={exportCsv}
                  consolidatedMode={true}
                  consolidatedEntities={consolidatedPayload.entities}
                  perEntityProductMixes={consolidatedPayload.perEntityProductMixes}
                  perEntityTopSellers={consolidatedPayload.perEntityTopSellers}
                  hideDetailHeader={true}
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            <AnimatePresence mode="wait">
              {dashboard ? (
                <motion.div key={activeEntityId ?? 'none'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex flex-col gap-[var(--spacing-base)]">
                  <RightPanel
                    entity={activeEntity} activeDimension={activeDimension} kpis={dashboard.kpis}
                    monthlyRevenue={dashboard.monthlyRevenue} productMixes={dashboard.productMixes}
                    topSellers={dashboard.topSellers} sparklines={dashboard.sparklines}
                    orders={dashboard.orders} items={dashboard.items} contacts={contacts}
                    activePeriod={activePeriod} activeTab={activeTab}
                    onTabChange={setActiveTab} onExport={exportCsv}
                  />
                </motion.div>
              ) : (
                <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 items-center justify-center">
                  <p className="text-[14px] text-[var(--color-text-muted)]">
                    Select a {DIMENSION_CONFIG[activeDimension].singularLabel} to view details
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
