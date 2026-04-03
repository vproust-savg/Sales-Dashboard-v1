// FILE: client/src/components/right-panel/ItemsExplorer.tsx
// PURPOSE: Top-level Items tab component — orchestrates toolbar + table
// USED BY: TabsSection.tsx
// EXPORTS: ItemsExplorer

import type { FlatItem } from '@shared/types/dashboard';
import { useItemsExplorer } from '../../hooks/useItemsExplorer';
import { ItemsToolbar } from './ItemsToolbar';
import { ItemsTable } from './ItemsTable';
import { EmptyState } from '../shared/EmptyState';

interface ItemsExplorerProps {
  items: FlatItem[];
}

export function ItemsExplorer({ items }: ItemsExplorerProps) {
  const explorer = useItemsExplorer(items);
  const isGrouped = explorer.groupLevels.length > 0;

  if (items.length === 0) {
    return (
      <EmptyState
        title="No items for this period."
        description="Product categories will appear here when available."
      />
    );
  }

  const hasResults = explorer.filteredCount > 0;

  return (
    <div>
      <ItemsToolbar
        searchTerm={explorer.searchTerm}
        onSearch={explorer.setSearch}
        groupLevels={explorer.groupLevels}
        onGroupLevelsChange={explorer.setGroupLevels}
        sortField={explorer.sortField}
        sortDirection={explorer.sortDirection}
        onToggleSort={explorer.toggleSort}
        filters={explorer.filters}
        onSetFilter={explorer.setFilter}
        onClearAllFilters={explorer.clearAllFilters}
        items={items}
        totalCount={explorer.totalCount}
        filteredCount={explorer.filteredCount}
      />

      {hasResults ? (
        <ItemsTable
          groups={explorer.groups}
          flatItems={explorer.sortedFlatItems}
          isGrouped={isGrouped}
          sortField={explorer.sortField}
          sortDirection={explorer.sortDirection}
          expandedGroups={explorer.expandedGroups}
          onToggleSort={explorer.toggleSort}
          onToggleGroup={explorer.toggleGroup}
        />
      ) : (
        <EmptyState
          title={explorer.searchTerm ? 'No items match your search.' : 'No items match your filters.'}
          description={explorer.searchTerm ? 'Try a different search term.' : 'Adjust or clear your filters.'}
        />
      )}
    </div>
  );
}
