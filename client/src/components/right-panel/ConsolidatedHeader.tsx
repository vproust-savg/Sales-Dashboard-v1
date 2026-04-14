// FILE: client/src/components/right-panel/ConsolidatedHeader.tsx
// PURPOSE: Header replacing DetailHeader when in Report 2 / View Consolidated 2 mode
// USED BY: client/src/components/right-panel/RightPanel.tsx
// EXPORTS: ConsolidatedHeader

import type { Period, FetchAllFilters } from '@shared/types/dashboard';
import { PeriodSelector } from './PeriodSelector';
import { formatInteger } from '@shared/utils/formatting';

interface ConsolidatedHeaderProps {
  mode: 'report' | 'consolidated';
  entityCount: number;
  dimensionLabel: string;          // Singular or plural; caller chooses
  filters: FetchAllFilters | null; // null for consolidated mode
  yearsAvailable: string[];
  activePeriod: Period;
  onPeriodChange: (p: Period) => void;
  onExport: () => void;
}

function formatFilters(filters: FetchAllFilters | null): string | null {
  if (!filters) return null;
  const parts: string[] = [];
  if (filters.agentName?.length) parts.push(`Rep: ${filters.agentName.join(', ')}`);
  if (filters.zone?.length) parts.push(`Zone: ${filters.zone.join(', ')}`);
  if (filters.customerType?.length) parts.push(`Type: ${filters.customerType.join(', ')}`);
  return parts.length > 0 ? `Filters: ${parts.join(' · ')}` : null;
}

export function ConsolidatedHeader({
  mode, entityCount, dimensionLabel, filters, yearsAvailable, activePeriod, onPeriodChange, onExport,
}: ConsolidatedHeaderProps) {
  const prefix = mode === 'report' ? 'Report' : 'Consolidated';
  const title = `${prefix}: ${formatInteger(entityCount)} ${dimensionLabel}`;
  const filterLine = formatFilters(filters);

  return (
    <div className="flex items-start justify-between gap-[var(--spacing-lg)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-bold text-[var(--color-text-primary)]">{title}</h1>
        {filterLine && (
          <p className="mt-[var(--spacing-xs)] truncate text-[12px] text-[var(--color-text-muted)]">{filterLine}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-[var(--spacing-lg)]">
        <PeriodSelector yearsAvailable={yearsAvailable} activePeriod={activePeriod} onChange={onPeriodChange} />
        <button
          type="button"
          onClick={onExport}
          className="cursor-pointer rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-md)] text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-gold-muted)]"
        >
          Export
        </button>
      </div>
    </div>
  );
}
