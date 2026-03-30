// FILE: client/src/components/left-panel/LeftPanel.tsx
// PURPOSE: Left panel container — composes dimension toggles, search, filter/sort, entity list, selection bar
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: LeftPanel

import { useState, useCallback, useMemo } from 'react';
import type { EntityListItem, Dimension } from '@shared/types/dashboard';
import { DimensionToggles } from './DimensionToggles';
import { SearchBox } from './SearchBox';
import { FilterSortToolbar } from './FilterSortToolbar';
import { EntityList } from './EntityList';
import { SelectionBar } from './SelectionBar';

/** WHY: maps Dimension enum values to user-facing plural labels for the list header */
const DIMENSION_LABELS: Record<Dimension, string> = {
  customer: 'Customers',
  zone: 'Zones',
  vendor: 'Vendors',
  brand: 'Brands',
  product_type: 'Product Types',
  product: 'Products',
};

/** WHY: maps Dimension to search placeholder text that adapts to context */
const SEARCH_PLACEHOLDERS: Record<Dimension, string> = {
  customer: 'Search customers...',
  zone: 'Search zones...',
  vendor: 'Search vendors...',
  brand: 'Search brands...',
  product_type: 'Search product types...',
  product: 'Search products...',
};

interface LeftPanelProps {
  entities: EntityListItem[];
  activeDimension: Dimension;
  activeEntityId: string | null;
  selectedEntityIds: string[];
}

export function LeftPanel({
  entities,
  activeDimension,
  activeEntityId,
  selectedEntityIds: initialSelectedIds,
}: LeftPanelProps) {
  const [dimension, setDimension] = useState<Dimension>(activeDimension);
  const [searchValue, setSearchValue] = useState('');
  const [filterActive, setFilterActive] = useState(false);
  const [sortActive, setSortActive] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(activeEntityId);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  /** WHY: case-insensitive search filters on entity name and meta fields */
  const filteredEntities = useMemo(() => {
    if (!searchValue.trim()) return entities;
    const query = searchValue.toLowerCase();
    return entities.filter(
      (e) =>
        e.name.toLowerCase().includes(query) ||
        e.meta1.toLowerCase().includes(query),
    );
  }, [entities, searchValue]);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const handleCheck = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleViewConsolidated = useCallback(() => {
    /** WHY: placeholder for Plan C — will trigger consolidated data fetch */
  }, []);

  return (
    <>
      <DimensionToggles
        activeDimension={dimension}
        onDimensionChange={setDimension}
      />

      <SearchBox
        value={searchValue}
        onChange={setSearchValue}
        placeholder={SEARCH_PLACEHOLDERS[dimension]}
      />

      <FilterSortToolbar
        filterActive={filterActive}
        sortActive={sortActive}
        onFilterToggle={() => setFilterActive((prev) => !prev)}
        onSortToggle={() => setSortActive((prev) => !prev)}
      />

      {/* WHY: relative container lets SelectionBar position at bottom of the list card */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <EntityList
          entities={filteredEntities}
          activeId={activeId}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onCheck={handleCheck}
          dimensionLabel={DIMENSION_LABELS[dimension]}
          totalCount={entities.length}
        />

        {/* WHY: absolute positioning keeps the bar at the bottom of the list container */}
        <div className="absolute bottom-0 left-0 right-0">
          <SelectionBar
            selectedCount={selectedIds.length}
            onViewConsolidated={handleViewConsolidated}
            onClear={handleClearSelection}
          />
        </div>
      </div>
    </>
  );
}
