// FILE: client/src/hooks/useItemsExplorer.ts
// PURPOSE: useReducer-based state for Items tab (search, sort, filter, group, expand)
// USED BY: client/src/components/right-panel/ItemsExplorer.tsx
// EXPORTS: useItemsExplorer

import { useReducer, useMemo, useEffect, useCallback } from 'react';
import type { FlatItem } from '@shared/types/dashboard';
import { searchItems } from '../utils/items-search';
import { filterItems } from '../utils/items-filter';
import type { ItemDimensionKey, ItemFilters } from '../utils/items-filter';
import { groupItems, sortFlatItems } from '../utils/items-grouping';
import type { ItemSortField } from '../utils/items-grouping';

interface State {
  searchTerm: string;
  groupLevels: ItemDimensionKey[];
  sortField: ItemSortField;
  sortDirection: 'asc' | 'desc';
  filters: ItemFilters;
  expandedGroups: Set<string>;
}

type Action =
  | { type: 'setSearch'; term: string }
  | { type: 'setGroupLevels'; levels: ItemDimensionKey[] }
  | { type: 'toggleSort'; field: ItemSortField }
  | { type: 'setFilter'; field: ItemDimensionKey; values: string[] }
  | { type: 'clearAllFilters' }
  | { type: 'toggleGroup'; key: string }
  | { type: 'reset' };

const INITIAL: State = {
  searchTerm: '',
  groupLevels: ['productType'],
  sortField: 'value',
  sortDirection: 'desc',
  filters: {},
  expandedGroups: new Set(),
};

/** WHY useReducer: 6 interdependent state atoms — avoids stale closure bugs (same as useSort) */
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setSearch':
      return { ...state, searchTerm: action.term };
    case 'setGroupLevels':
      return { ...state, groupLevels: action.levels, expandedGroups: new Set() };
    case 'toggleSort':
      if (state.sortField === action.field) {
        return { ...state, sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc' };
      }
      return { ...state, sortField: action.field, sortDirection: 'desc' };
    case 'setFilter': {
      const filters = { ...state.filters };
      if (action.values.length === 0) {
        delete filters[action.field];
      } else {
        filters[action.field] = action.values;
      }
      return { ...state, filters };
    }
    case 'clearAllFilters':
      return { ...state, filters: {} };
    case 'toggleGroup': {
      const next = new Set(state.expandedGroups);
      if (next.has(action.key)) next.delete(action.key);
      else next.add(action.key);
      return { ...state, expandedGroups: next };
    }
    case 'reset':
      return INITIAL;
  }
}

export function useItemsExplorer(items: FlatItem[]) {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  /** WHY: Reset all state when items change (entity switch) */
  const itemsRef = items;
  useEffect(() => {
    dispatch({ type: 'reset' });
  }, [itemsRef]);

  const filteredItems = useMemo(() => {
    let result = filterItems(items, state.filters);
    if (state.searchTerm) result = searchItems(result, state.searchTerm);
    return result;
  }, [items, state.filters, state.searchTerm]);

  const groups = useMemo(
    () => groupItems(filteredItems, state.groupLevels, state.sortField, state.sortDirection),
    [filteredItems, state.groupLevels, state.sortField, state.sortDirection],
  );

  const sortedFlatItems = useMemo(
    () => sortFlatItems(filteredItems, state.sortField, state.sortDirection),
    [filteredItems, state.sortField, state.sortDirection],
  );

  const setSearch = useCallback((term: string) => dispatch({ type: 'setSearch', term }), []);
  const setGroupLevels = useCallback((levels: ItemDimensionKey[]) => dispatch({ type: 'setGroupLevels', levels }), []);
  const toggleSort = useCallback((field: ItemSortField) => dispatch({ type: 'toggleSort', field }), []);
  const setFilter = useCallback((field: ItemDimensionKey, values: string[]) => dispatch({ type: 'setFilter', field, values }), []);
  const clearAllFilters = useCallback(() => dispatch({ type: 'clearAllFilters' }), []);
  const toggleGroup = useCallback((key: string) => dispatch({ type: 'toggleGroup', key }), []);

  return {
    ...state,
    filteredItems,
    groups,
    sortedFlatItems,
    totalCount: items.length,
    filteredCount: filteredItems.length,
    setSearch,
    setGroupLevels,
    toggleSort,
    setFilter,
    clearAllFilters,
    toggleGroup,
  };
}
