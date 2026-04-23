// FILE: client/src/hooks/useDashboardState.ts
// PURPOSE: Combines all state hooks + two-stage server data into one prop bundle for DashboardLayout
// USED BY: client/src/App.tsx
// EXPORTS: useDashboardState

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useEntities, useDashboardDetail } from './useDashboardData';
import { useContacts, useConsolidatedContacts } from './useContacts';
import { useEntitySelection } from './useEntitySelection';
import { useFilters } from './useFilters';
import { useReport } from './useReport';
import { deriveConsolidatedContactIds } from './derive-consolidated-contact-ids';
import { searchEntities } from '../utils/search';
import { filterEntities } from '../utils/filter-engine';
import { sortEntities } from '../utils/sort-engine';
import type { FilterField, FilterOperator } from '../utils/filter-types';
import type { Dimension } from '@shared/types/dashboard';
import { DIMENSION_PLURAL_LABELS } from '@shared/types/dashboard';
import { useDashboardShellState } from './useDashboardShellState';

export function useDashboardState() {
  // --- Individual state slices ---
  const {
    activeDimension,
    activePeriod,
    activeEntityId: shellActiveEntityId,
    activeTab,
    searchTerm,
    sortField,
    sortDirection,
    switchDimension: setShellDimension,
    switchPeriod,
    setActiveEntityId,
    setActiveTab,
    setSearchTerm,
    resetSearch,
    setSort,
    resetSort,
    panelCollapsed,
    togglePanel,
  } = useDashboardShellState();
  const {
    activeEntityId, selectedIds,
    selectEntity, toggleCheckbox, clearSelection, resetSelection,
  } = useEntitySelection({ activeEntityId: shellActiveEntityId, onActiveEntityChange: setActiveEntityId });
  const {
    conditions, isOpen: filterOpen, activeCount: filterCount,
    addCondition, updateCondition, removeCondition,
    clearAll: clearFilters, togglePanel: toggleFilterPanel,
  } = useFilters();
  const report = useReport(activeDimension, activePeriod);

  // --- Spec Section 13.1: Dimension switch resets ALL other state ---
  const switchDimension = useCallback((dim: Dimension) => {
    setShellDimension(dim);
    clearSelection();
    resetSearch();
    clearFilters();
    resetSort();
    report.reset();
  }, [setShellDimension, clearSelection, resetSearch, clearFilters, resetSort, report]);

  const prevDimensionRef = useRef(activeDimension);
  useEffect(() => {
    if (prevDimensionRef.current === activeDimension) return;
    prevDimensionRef.current = activeDimension;
    clearSelection();
    clearFilters();
  }, [activeDimension, clearSelection, clearFilters]);

  // --- Stage 1: Lightweight entity list (fast — no orders needed) ---
  const entitiesQuery = useEntities({
    groupBy: activeDimension,
    period: activePeriod,
  });
  const entitiesData = entitiesQuery.data?.data ?? null;

  // --- Stage 2: Full detail for selected entity (on-demand) ---
  const detailQuery = useDashboardDetail({
    entityId: activeEntityId,
    groupBy: activeDimension,
    period: activePeriod,
  });
  const dashboard = detailQuery.data?.data ?? null;
  const meta = detailQuery.data?.meta ?? entitiesQuery.data?.meta ?? null;

  // WHY: Contacts load for any dimension — server resolves to customer contacts via scopeOrders.
  const contactsQuery = useContacts(activeDimension, activeEntityId, !!activeEntityId);

  // WHY: Only the View Consolidated path (filters.entityIds set) should enable consolidated
  // contacts. A regular Report leaves filters.entityIds undefined and must not fan out to
  // a per-customer Priority fetch across the full dimension (1876-call 500). See
  // derive-consolidated-contact-ids.ts for the decision logic and its test coverage.
  const consolidatedContactIds = useMemo(
    () => deriveConsolidatedContactIds({ state: report.state, payload: report.payload, filters: report.filters }),
    [report.state, report.payload, report.filters],
  );
  const consolidatedContactsQuery = useConsolidatedContacts(
    activeDimension,
    consolidatedContactIds,
    consolidatedContactIds.length > 0,
  );

  // --- Client-side pipeline: search -> filter -> sort (spec Section 6) ---
  const processedEntities = useMemo(() => {
    if (!entitiesData) return [];
    let entities = entitiesData.entities;
    if (searchTerm) entities = searchEntities(entities, searchTerm);
    const complete = conditions.filter(
      (c): c is typeof c & { field: FilterField; operator: FilterOperator } =>
        c.field !== '' && c.operator !== '',
    );
    if (complete.length > 0) entities = filterEntities(entities, complete);
    entities = sortEntities(entities, sortField, sortDirection);
    return entities;
  }, [entitiesData, searchTerm, conditions, sortField, sortDirection]);

  const finalDashboard = useMemo(() => {
    if (!dashboard) return null;
    return { ...dashboard, entities: processedEntities };
  }, [dashboard, processedEntities]);

  // --- Loading stage for progress modal ---
  const loadingStage = entitiesQuery.isLoading
    ? `Loading ${DIMENSION_PLURAL_LABELS[activeDimension].toLowerCase()}...`
    : detailQuery.isLoading
      ? 'Loading dashboard data...'
      : null;

  // --- Return flat props object for DashboardLayout ---
  return {
    // Data
    dashboard: finalDashboard,
    entities: processedEntities,
    allEntities: entitiesData?.entities ?? [],
    // WHY: Prefer consolidated contacts when consolidated mode is loaded; otherwise single-entity contacts.
    contacts: (consolidatedContactsQuery.data && consolidatedContactsQuery.data.length > 0)
      ? consolidatedContactsQuery.data
      : (contactsQuery.data ?? []),
    isLoading: entitiesQuery.isLoading,
    isDetailLoading: detailQuery.isLoading,
    loadingStage,
    error: entitiesQuery.error?.message ?? detailQuery.error?.message ?? null,
    // WHY: Split detail errors from combined `error` so the right panel can surface a
    // failed detail fetch inline instead of falling back to the "Select an entity"
    // placeholder. Before this, a 500 on /api/sales/dashboard (e.g., cold-cache Priority
    // timeout) left the user staring at a blank placeholder with no feedback or retry path.
    detailError: detailQuery.error?.message ?? null,
    retryDetail: () => { void detailQuery.refetch(); },
    meta,
    yearsAvailable: entitiesData?.yearsAvailable ?? dashboard?.yearsAvailable ?? [],

    // State
    activeDimension,
    activePeriod,
    activeEntityId,
    activeTab,
    selectedEntityIds: selectedIds,
    searchTerm,
    filterConditions: conditions,
    filterOpen,
    filterCount,
    sortField,
    sortDirection,
    panelCollapsed,
    report,

    // Actions
    switchDimension,
    switchPeriod,
    selectEntity,
    setActiveTab,
    toggleCheckbox,
    clearSelection,
    resetSelection,
    setSearchTerm,
    addCondition,
    updateCondition,
    removeCondition,
    clearFilters,
    toggleFilterPanel,
    setSort,
    togglePanel,
  };
}
