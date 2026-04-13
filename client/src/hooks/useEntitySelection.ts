// FILE: client/src/hooks/useEntitySelection.ts
// PURPOSE: Active entity + multi-select state — spec Section 13.4
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useEntitySelection

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

interface UseEntitySelectionOptions {
  activeEntityId: string | null;
  onActiveEntityChange: (id: string | null) => void;
}

export function useEntitySelection({ activeEntityId, onActiveEntityChange }: UseEntitySelectionOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConsolidated, setIsConsolidated] = useState(false);
  const prevActiveEntityIdRef = useRef(activeEntityId);

  useEffect(() => {
    if (prevActiveEntityIdRef.current === activeEntityId) return;
    prevActiveEntityIdRef.current = activeEntityId;
    setIsConsolidated(false);
  }, [activeEntityId]);

  /** Click an entity row to view its details */
  const selectEntity = useCallback((id: string) => {
    onActiveEntityChange(id);
    setIsConsolidated(false);
  }, [onActiveEntityChange]);

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
    onActiveEntityChange(null);
    setSelectedIds(new Set());
    setIsConsolidated(false);
  }, [onActiveEntityChange]);

  // WHY: Without useMemo, [...selectedIds] creates a new array on every render,
  // defeating React.memo on every downstream component that receives this prop.
  const selectedIdsArray = useMemo(() => [...selectedIds], [selectedIds]);

  return {
    activeEntityId,
    selectedIds: selectedIdsArray,
    isConsolidated,
    selectEntity,
    toggleCheckbox,
    viewConsolidated,
    clearSelection,
    resetSelection,
  };
}
