// FILE: client/src/components/left-panel/LeftPanel.tsx
// PURPOSE: Left panel container — controlled component composing dimension toggles, search,
//          filter/sort, entity list, and selection bar
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: LeftPanel

import type { EntityListItem, Dimension, EntityListLoadState, DashboardPayload } from '@shared/types/dashboard';
import type { FilterCondition } from '../../hooks/useFilters';
import type { SortField, SortDirection } from '../../hooks/useSort';
import { DIMENSION_CONFIG } from '../../utils/dimension-config';
import { DimensionToggles } from './DimensionToggles';
import { SearchBox } from './SearchBox';
import { FilterSortToolbar } from './FilterSortToolbar';
import { FilterPanel } from './FilterPanel';
import { EntityList } from './EntityList';
import { SelectionBar } from './SelectionBar';

interface LeftPanelProps {
  // Data — already filtered/sorted by useDashboardState
  entities: EntityListItem[];
  totalCount: number;

  // State
  activeDimension: Dimension;
  activeEntityId: string | null;
  selectedEntityIds: string[];
  searchTerm: string;
  filterOpen: boolean;
  filterCount: number;
  filterConditions: FilterCondition[];
  sortField: SortField;
  sortDirection: SortDirection;
  sortActive: boolean;
  dataLoaded: boolean;
  fetchAllLoadState: EntityListLoadState;
  allDashboard: DashboardPayload | null;
  entitiesWithOrders: number;
  onAllClick: () => void;
  onRefresh: () => void;

  // Actions
  onDimensionChange: (dim: Dimension) => void;
  onEntitySelect: (id: string) => void;
  onEntityCheck: (id: string) => void;
  onClearSelection: () => void;
  onViewConsolidated: () => void;
  onSearchChange: (term: string) => void;
  onFilterToggle: () => void;
  onAddCondition: () => void;
  onUpdateCondition: (id: string, updates: Partial<FilterCondition>) => void;
  onRemoveCondition: (id: string) => void;
  onClearFilters: () => void;
  onSort: (field: SortField) => void;
}

export function LeftPanel({
  entities, totalCount, activeDimension, activeEntityId, selectedEntityIds,
  searchTerm, filterOpen, filterCount, filterConditions,
  sortField, sortDirection, sortActive, dataLoaded,
  fetchAllLoadState, allDashboard, entitiesWithOrders, onAllClick, onRefresh,
  onDimensionChange, onEntitySelect, onEntityCheck, onClearSelection,
  onViewConsolidated, onSearchChange, onFilterToggle,
  onAddCondition, onUpdateCondition, onRemoveCondition, onClearFilters,
  onSort,
}: LeftPanelProps) {
  const config = DIMENSION_CONFIG[activeDimension];

  return (
    <>
      <DimensionToggles
        activeDimension={activeDimension}
        onDimensionChange={onDimensionChange}
      />

      <SearchBox
        value={searchTerm}
        onChange={onSearchChange}
        placeholder={config.searchPlaceholder}
      />

      <FilterSortToolbar
        filterActive={filterOpen || filterCount > 0}
        sortActive={sortActive}
        filterCount={filterCount}
        onFilterToggle={onFilterToggle}
        onSortToggle={() => onSort(sortField === 'id' && sortDirection === 'asc' ? 'name' : 'id')}
      />

      <FilterPanel
        isOpen={filterOpen}
        conditions={filterConditions}
        activeDimension={activeDimension}
        onAddCondition={onAddCondition}
        onUpdateCondition={onUpdateCondition}
        onRemoveCondition={onRemoveCondition}
        onClearFilters={onClearFilters}
        onClose={onFilterToggle}
      />

      {/* WHY: relative container lets SelectionBar position at bottom of the list card */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <EntityList
          entities={entities}
          activeId={activeEntityId}
          selectedIds={selectedEntityIds}
          onSelect={onEntitySelect}
          onCheck={onEntityCheck}
          dimensionLabel={config.label}
          totalCount={totalCount}
          dataLoaded={dataLoaded}
          allLabel={config.allLabel}
          fetchAllLoadState={fetchAllLoadState}
          allDashboard={allDashboard}
          entitiesWithOrders={entitiesWithOrders}
          onAllClick={onAllClick}
          onRefresh={onRefresh}
        />

        {/* WHY: absolute positioning keeps the bar at the bottom of the list container */}
        <div className="absolute bottom-0 left-0 right-0">
          <SelectionBar
            selectedCount={selectedEntityIds.length}
            dataLoaded={dataLoaded}
            onViewConsolidated={onViewConsolidated}
            onClear={onClearSelection}
          />
        </div>
      </div>
    </>
  );
}
