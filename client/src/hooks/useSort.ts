// FILE: client/src/hooks/useSort.ts
// PURPOSE: Sort field + direction state — spec Section 15.4
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useSort, SortField, SortDirection

import { useReducer, useCallback } from 'react';

export type SortField =
  | 'name'
  | 'revenue'
  | 'orders'
  | 'avgOrder'
  | 'marginPercent'
  | 'frequency'
  | 'lastOrder';

export type SortDirection = 'asc' | 'desc';

interface SortState {
  field: SortField;
  direction: SortDirection;
}

type SortAction =
  | { type: 'toggle'; field: SortField }
  | { type: 'reset' };

const INITIAL_STATE: SortState = { field: 'revenue', direction: 'desc' };

// WHY: useReducer instead of two useState calls eliminates stale closure risk
// where setSortDirection was called inside setSortField's updater function.
function sortReducer(state: SortState, action: SortAction): SortState {
  switch (action.type) {
    case 'toggle':
      if (state.field === action.field) {
        return { ...state, direction: state.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field: action.field, direction: 'desc' };
    case 'reset':
      return INITIAL_STATE;
  }
}

export function useSort() {
  const [state, dispatch] = useReducer(sortReducer, INITIAL_STATE);

  const setSort = useCallback((field: SortField) => {
    dispatch({ type: 'toggle', field });
  }, []);

  const resetSort = useCallback(() => {
    dispatch({ type: 'reset' });
  }, []);

  return { sortField: state.field, sortDirection: state.direction, setSort, resetSort };
}
