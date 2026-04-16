// FILE: client/src/components/left-panel/EntityList.tsx
// PURPOSE: Scrollable entity list with sticky header showing count
// USED BY: client/src/components/left-panel/LeftPanel.tsx
// EXPORTS: EntityList

import type { EntityListItem as EntityListItemType } from '@shared/types/dashboard';
import { EntityListItem } from './EntityListItem';
import { SelectionBar } from './SelectionBar';

interface EntityListProps {
  entities: EntityListItemType[];
  activeId: string | null;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onCheck: (id: string) => void;
  dimensionLabel: string;
  totalCount: number;
  selectedCount: number;
  onClearSelection: () => void;
  onViewConsolidatedClick: () => void;
}

export function EntityList({
  entities,
  activeId,
  selectedIds,
  onSelect,
  onCheck,
  dimensionLabel,
  totalCount,
  selectedCount,
  onClearSelection,
  onViewConsolidatedClick,
}: EntityListProps) {
  return (
    <div
      className="flex flex-1 flex-col overflow-hidden rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)]"
    >
      {/* WHY: sticky header stays visible while scrolling the entity list */}
      <div className="sticky top-0 z-10 border-b border-[var(--color-gold-muted)] bg-[var(--color-bg-card)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)]">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          {dimensionLabel} ({entities.length} of {totalCount})
        </span>
      </div>

      {/* WHY: live region announces list count changes to screen readers */}
      <div aria-live="polite" className="sr-only">
        Showing {entities.length} of {totalCount} {dimensionLabel.toLowerCase()}
      </div>

      {/* Scrollable list area */}
      <div
        role="listbox"
        aria-label={`${dimensionLabel} list`}
        aria-multiselectable="true"
        className={`min-h-0 flex-1 overflow-y-auto ${selectedCount > 0 ? 'pb-[57px]' : ''}`}
      >
        {entities.map((entity) => (
          <EntityListItem
            key={entity.id}
            entity={entity}
            isActive={entity.id === activeId}
            isSelected={selectedIds.includes(entity.id)}
            onSelect={onSelect}
            onCheck={onCheck}
          />
        ))}

        {entities.length === 0 && (
          <div className="flex items-center justify-center p-[var(--spacing-4xl)]">
            <span className="text-[13px] text-[var(--color-text-muted)]">
              No {dimensionLabel.toLowerCase()} found
            </span>
          </div>
        )}
      </div>

      <SelectionBar
        selectedCount={selectedCount}
        onViewConsolidatedClick={onViewConsolidatedClick}
        onClear={onClearSelection}
      />
    </div>
  );
}
