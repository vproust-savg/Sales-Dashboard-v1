// FILE: client/src/components/left-panel/LeftPanel.tsx
// PURPOSE: Left panel container — controlled component composing dimension toggles, search,
//          filter/sort, entity list, and selection bar
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: LeftPanel

import type { EntityListItem, Dimension } from '@shared/types/dashboard';
import type { ReportState } from '../../hooks/useReport';
import type { FilterCondition } from '../../hooks/useFilters';
import type { SortField, SortDirection } from '../../hooks/sort-types';
import { DIMENSION_CONFIG } from '../../utils/dimension-config';
import { DimensionToggles } from './DimensionToggles';
import { SearchBox } from './SearchBox';
import { FilterSortToolbar } from './FilterSortToolbar';
import { FilterPanel } from './FilterPanel';
import { EntityList } from './EntityList';
import { ReportButton } from './ReportButton';

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
  reportState: ReportState;
  activeView: 'single' | 'report';

  // Actions
  onDimensionChange: (dim: Dimension) => void;
  onEntitySelect: (id: string) => void;
  onEntityCheck: (id: string) => void;
  onClearSelection: () => void;
  onReportClick: () => void;
  onViewConsolidatedClick: () => void;
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
  sortField, sortDirection, sortActive,
  reportState, activeView,
  onDimensionChange, onEntitySelect, onEntityCheck, onClearSelection,
  onReportClick, onViewConsolidatedClick, onSearchChange, onFilterToggle,
  onAddCondition, onUpdateCondition, onRemoveCondition, onClearFilters,
  onSort,
}: LeftPanelProps) {
  const config = DIMENSION_CONFIG[activeDimension];

  return (
    <>
      <ReportButton
        state={reportState}
        isActive={activeView === 'report'}
        onClick={onReportClick}
      />

      <DimensionToggles
        activeDimension={activeDimension}
        onDimensionChange={onDimensionChange}
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

      <SearchBox
        value={searchTerm}
        onChange={onSearchChange}
        placeholder={config.searchPlaceholder}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <EntityList
          entities={entities}
          activeId={activeEntityId}
          selectedIds={selectedEntityIds}
          onSelect={onEntitySelect}
          onCheck={onEntityCheck}
          dimensionLabel={config.label}
          totalCount={totalCount}
          selectedCount={selectedEntityIds.length}
          onClearSelection={onClearSelection}
          onViewConsolidatedClick={onViewConsolidatedClick}
        />
      </div>
    </>
  );
}
