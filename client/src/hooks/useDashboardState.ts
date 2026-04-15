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
import { useConsolidated } from './useConsolidated';
import { useCacheStatus } from './useCacheStatus';
import { searchEntities } from '../utils/search';
import { filterEntities } from '../utils/filter-engine';
import { sortEntities } from '../utils/sort-engine';
import type { FilterField, FilterOperator } from '../utils/filter-types';
import type { Dimension } from '@shared/types/dashboard';
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
    selectEntity, toggleCheckbox, clearSelection,
  } = useEntitySelection({ activeEntityId: shellActiveEntityId, onActiveEntityChange: setActiveEntityId });
  const {
    conditions, isOpen: filterOpen, activeCount: filterCount,
    addCondition, updateCondition, removeCondition,
    clearAll: clearFilters, togglePanel: toggleFilterPanel,
  } = useFilters();
  const report = useReport(activeDimension, activePeriod);
  const consolidated = useConsolidated(activeDimension, activePeriod);
  const cacheStatus = useCacheStatus(activePeriod);

  // --- Spec Section 13.1: Dimension switch resets ALL other state ---
  const switchDimension = useCallback((dim: Dimension) => {
    setShellDimension(dim);
    clearSelection();
    resetSearch();
    clearFilters();
    resetSort();
    report.reset();
    consolidated.reset();
  }, [setShellDimension, clearSelection, resetSearch, clearFilters, resetSort, report, consolidated]);

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

  // WHY: Contacts only load for the customer dimension when the Contacts tab is active.
  const contactsQuery = useContacts(activeEntityId, activeDimension === 'customer');

  // WHY: In consolidated mode, the active entity is the set of loaded entity IDs.
  // We derive them from whichever mode is loaded and fetch contacts via the multi-
  // customer endpoint so ConsolidatedContactsTable has customerName-annotated rows.
  const consolidatedContactIds = useMemo(() => {
    if (activeDimension !== 'customer') return [] as string[];
    if (report.state === 'loaded' && report.payload) return report.payload.entities.map(e => e.id);
    if (consolidated.state === 'loaded' && consolidated.payload) return consolidated.payload.entities.map(e => e.id);
    return [] as string[];
  }, [activeDimension, report.state, report.payload, consolidated.state, consolidated.payload]);
  const consolidatedContactsQuery = useConsolidatedContacts(
    consolidatedContactIds,
    activeDimension === 'customer' && consolidatedContactIds.length > 0,
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
    ? 'Loading customers...'
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
    consolidated,
    cacheStatus: cacheStatus.data,

    // Actions
    switchDimension,
    switchPeriod,
    selectEntity,
    setActiveTab,
    toggleCheckbox,
    clearSelection,
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
