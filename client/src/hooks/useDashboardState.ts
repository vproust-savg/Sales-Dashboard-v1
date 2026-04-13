// FILE: client/src/hooks/useDashboardState.ts
// PURPOSE: Combines all state hooks + two-stage server data into one prop bundle for DashboardLayout
// USED BY: client/src/App.tsx
// EXPORTS: useDashboardState

import { useCallback, useMemo } from 'react';
import { useEntities, useDashboardDetail, useConsolidatedDashboard } from './useDashboardData';
import { useContacts } from './useContacts';
import { useDimension } from './useDimension';
import { usePeriod } from './usePeriod';
import { useEntitySelection } from './useEntitySelection';
import { useSearch } from './useSearch';
import { useFilters } from './useFilters';
import { useSort } from './useSort';
import { useFetchAll } from './useFetchAll';
import { searchEntities } from '../utils/search';
import { filterEntities } from '../utils/filter-engine';
import { sortEntities } from '../utils/sort-engine';
import type { FilterField, FilterOperator } from '../utils/filter-types';
import type { Dimension } from '@shared/types/dashboard';

export function useDashboardState() {
  // --- Individual state slices ---
  const { activeDimension, switchDimension: rawSwitchDimension } = useDimension();
  const { activePeriod, switchPeriod } = usePeriod();
  const {
    activeEntityId, selectedIds, isConsolidated,
    selectEntity, toggleCheckbox, viewConsolidated, clearSelection, resetSelection,
  } = useEntitySelection();
  const { searchTerm, setSearchTerm, resetSearch } = useSearch();
  const {
    conditions, isOpen: filterOpen, activeCount: filterCount,
    addCondition, updateCondition, removeCondition,
    clearAll: clearFilters, togglePanel: toggleFilterPanel,
  } = useFilters();
  const { sortField, sortDirection, setSort, resetSort } = useSort();
  const {
    loadState: fetchAllLoadState, progress: fetchAllProgress,
    allDashboard, error: fetchAllError,
    startFetchAll, abortFetch,
  } = useFetchAll(activeDimension, activePeriod);
  const dataLoaded = fetchAllLoadState === 'loaded';

  // --- Spec Section 13.1: Dimension switch resets ALL other state ---
  const switchDimension = useCallback((dim: Dimension) => {
    rawSwitchDimension(dim);
    resetSelection();
    resetSearch();
    clearFilters();
    resetSort();
    abortFetch();
  }, [rawSwitchDimension, resetSelection, resetSearch, clearFilters, resetSort, abortFetch]);

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

  // --- Stage 3: Consolidated data for multi-select (on-demand) ---
  const consolidatedQuery = useConsolidatedDashboard({
    entityIds: selectedIds,
    groupBy: activeDimension,
    period: activePeriod,
    enabled: isConsolidated && selectedIds.length > 0,
  });
  const consolidatedDashboard = consolidatedQuery.data?.data ?? null;

  // WHY: Contacts only load for the customer dimension when the Contacts tab is active.
  const contactsQuery = useContacts(activeEntityId, activeDimension === 'customer');

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

  // --- Consolidated view uses server-aggregated multi-entity data ---
  const finalDashboard = useMemo(() => {
    if (isConsolidated && consolidatedDashboard) {
      return { ...consolidatedDashboard, entities: processedEntities };
    }
    if (!dashboard) return null;
    return { ...dashboard, entities: processedEntities };
  }, [dashboard, consolidatedDashboard, isConsolidated, processedEntities]);

  // --- Loading stage for progress modal ---
  const loadingStage = entitiesQuery.isLoading
    ? 'Loading customers...'
    : detailQuery.isLoading
      ? 'Loading dashboard data...'
      : null;
  const isConsolidatedLoading = consolidatedQuery.isLoading && isConsolidated;

  // --- Return flat props object for DashboardLayout ---
  return {
    // Data
    dashboard: finalDashboard,
    entities: processedEntities,
    allEntities: entitiesData?.entities ?? [],
    contacts: contactsQuery.data ?? [],
    isLoading: entitiesQuery.isLoading,
    isDetailLoading: detailQuery.isLoading,
    isConsolidatedLoading,
    loadingStage,
    error: entitiesQuery.error?.message ?? detailQuery.error?.message ?? fetchAllError ?? null,
    meta,
    yearsAvailable: entitiesData?.yearsAvailable ?? dashboard?.yearsAvailable ?? [],

    // State
    activeDimension,
    activePeriod,
    activeEntityId,
    selectedEntityIds: selectedIds,
    searchTerm,
    filterConditions: conditions,
    filterOpen,
    filterCount,
    sortField,
    sortDirection,
    dataLoaded,
    fetchAllLoadState,
    fetchAllProgress,
    allDashboard,

    // Actions
    switchDimension,
    switchPeriod,
    selectEntity,
    toggleCheckbox,
    viewConsolidated,
    clearSelection,
    setSearchTerm,
    addCondition,
    updateCondition,
    removeCondition,
    clearFilters,
    toggleFilterPanel,
    setSort,
    startFetchAll,
    abortFetch,
  };
}
