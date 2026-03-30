// FILE: client/src/hooks/useDashboardState.ts
// PURPOSE: Combines all state hooks + server data into one prop bundle for DashboardLayout
// USED BY: client/src/App.tsx
// EXPORTS: useDashboardState

import { useCallback, useMemo } from 'react';
import { useDashboardData } from './useDashboardData';
import { useContacts } from './useContacts';
import { useDimension } from './useDimension';
import { usePeriod } from './usePeriod';
import { useEntitySelection } from './useEntitySelection';
import { useSearch } from './useSearch';
import { useFilters } from './useFilters';
import { useSort } from './useSort';
import { searchEntities } from '../utils/search';
import { filterEntities } from '../utils/filter-engine';
import { sortEntities } from '../utils/sort-engine';
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

  // --- Spec Section 13.1: Dimension switch resets ALL other state ---
  const switchDimension = useCallback((dim: Dimension) => {
    rawSwitchDimension(dim);
    resetSelection();
    resetSearch();
    clearFilters();
    resetSort();
  }, [rawSwitchDimension, resetSelection, resetSearch, clearFilters, resetSort]);

  // --- Server data ---
  const { data: response, isLoading, error } = useDashboardData({
    groupBy: activeDimension,
    period: activePeriod,
  });
  const dashboard = response?.data ?? null;
  const meta = response?.meta ?? null;

  // WHY: Contacts only load for the customer dimension when the Contacts tab is active.
  // The tab-active flag will be wired in Task 6; for now we enable when dimension is customer.
  const contactsQuery = useContacts(activeEntityId, activeDimension === 'customer');

  // --- Client-side pipeline: search -> filter -> sort (spec Section 6) ---
  const processedEntities = useMemo(() => {
    if (!dashboard) return [];
    let entities = dashboard.entities;
    if (searchTerm) entities = searchEntities(entities, searchTerm);
    if (conditions.length > 0) entities = filterEntities(entities, conditions);
    entities = sortEntities(entities, sortField, sortDirection);
    return entities;
  }, [dashboard, searchTerm, conditions, sortField, sortDirection]);

  // --- Return flat props object for DashboardLayout ---
  return {
    // Data
    dashboard: dashboard ? { ...dashboard, entities: processedEntities } : null,
    contacts: contactsQuery.data ?? [],
    isLoading,
    error: error?.message ?? null,
    meta,

    // State
    activeDimension,
    activePeriod,
    activeEntityId,
    selectedEntityIds: selectedIds,
    isConsolidated,
    searchTerm,
    filterConditions: conditions,
    filterOpen,
    filterCount,
    sortField,
    sortDirection,

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
  };
}
