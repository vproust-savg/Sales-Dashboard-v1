// FILE: client/src/hooks/useEntitySelection.ts
// PURPOSE: Active entity + multi-select state — spec Section 13.4
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useEntitySelection

import { useState, useCallback } from 'react';

export function useEntitySelection() {
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConsolidated, setIsConsolidated] = useState(false);

  /** Click an entity row to view its details */
  const selectEntity = useCallback((id: string) => {
    setActiveEntityId(id);
    setIsConsolidated(false);
  }, []);

  /** Toggle the circular checkbox for multi-select */
  const toggleCheckbox = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /** Show consolidated view for all checked entities */
  const viewConsolidated = useCallback(() => {
    setIsConsolidated(true);
  }, []);

  /** Uncheck all entities and exit consolidated view */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsConsolidated(false);
  }, []);

  /** Full reset: clears active entity, unchecks all, exits consolidated */
  const resetSelection = useCallback(() => {
    setActiveEntityId(null);
    setSelectedIds(new Set());
    setIsConsolidated(false);
  }, []);

  return {
    activeEntityId,
    // WHY: Convert Set to array for easier consumption by components
    // and for React's shallow comparison in memoization.
    selectedIds: [...selectedIds],
    isConsolidated,
    selectEntity,
    toggleCheckbox,
    viewConsolidated,
    clearSelection,
    resetSelection,
  };
}
