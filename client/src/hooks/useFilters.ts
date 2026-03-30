// FILE: client/src/hooks/useFilters.ts
// PURPOSE: Filter conditions state + add/update/remove/clear — spec Section 13.3
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useFilters, FilterCondition

import { useState, useCallback } from 'react';
import type { FilterField, FilterOperator } from '../utils/filter-types';

export interface FilterCondition {
  id: string;
  field: FilterField | '';         // WHY: '' = "not yet selected" in a new condition
  operator: FilterOperator | '';
  value: string | number;
  conjunction: 'and' | 'or';
}

export function useFilters() {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addCondition = useCallback(() => {
    setConditions(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        field: '' as const,
        operator: '' as const,
        value: '',
        conjunction: 'and' as const,
      },
    ]);
  }, []);

  const updateCondition = useCallback(
    (id: string, updates: Partial<FilterCondition>) => {
      setConditions(prev =>
        prev.map(c => (c.id === id ? { ...c, ...updates } : c)),
      );
    },
    [],
  );

  const removeCondition = useCallback((id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setConditions([]);
    setIsOpen(false);
  }, []);

  const togglePanel = useCallback(() => setIsOpen(prev => !prev), []);

  return {
    conditions,
    isOpen,
    // WHY: Only count conditions with both field and value set as "active"
    // so the badge count reflects actually-applied filters.
    activeCount: conditions.filter(c => c.field && c.value).length,
    addCondition,
    updateCondition,
    removeCondition,
    clearAll,
    togglePanel,
  };
}
