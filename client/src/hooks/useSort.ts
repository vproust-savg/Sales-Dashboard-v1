// FILE: client/src/hooks/useSort.ts
// PURPOSE: Sort field + direction state — spec Section 15.4
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useSort, SortField, SortDirection

import { useState, useCallback } from 'react';

export type SortField =
  | 'name'
  | 'revenue'
  | 'orders'
  | 'avgOrder'
  | 'marginPercent'
  | 'frequency'
  | 'outstanding'
  | 'lastOrder';

export type SortDirection = 'asc' | 'desc';

export function useSort() {
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  /** Click the same field to toggle direction; click a new field to sort desc */
  const setSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        // WHY: Toggle direction when clicking the already-active sort field
        setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      // WHY: New sort fields default to desc (highest first) as most useful default
      setSortDirection('desc');
      return field;
    });
  }, []);

  const resetSort = useCallback(() => {
    setSortField('revenue');
    setSortDirection('desc');
  }, []);

  return { sortField, sortDirection, setSort, resetSort };
}
