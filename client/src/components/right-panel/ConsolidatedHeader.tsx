// FILE: client/src/components/right-panel/ConsolidatedHeader.tsx
// PURPOSE: Header replacing DetailHeader when in Report / View Consolidated mode
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: ConsolidatedHeader

import { useEffect } from 'react';
import type { FetchAllFilters } from '@shared/types/dashboard';
import { formatInteger } from '@shared/utils/formatting';

interface ConsolidatedHeaderProps {
  mode: 'report' | 'consolidated';
  entityCount: number;
  dimensionLabel: string;          // Singular or plural; caller chooses
  filters: FetchAllFilters | null; // null for consolidated mode
  onExport: () => void;
  onClose: () => void;
}

/** WHY: foodServiceRetail values: 'Y' = Retail, anything else = Food Service */
function mapFoodServiceRetail(values: string[]): string {
  return values.map(v => v === 'Y' ? 'Retail' : 'Food Service').join(', ');
}

function formatFilters(filters: FetchAllFilters | null): string | null {
  if (!filters) return null;
  const parts: string[] = [];
  if (filters.agentName?.length) parts.push(`Rep: ${filters.agentName.join(', ')}`);
  if (filters.zone?.length) parts.push(`Zone: ${filters.zone.join(', ')}`);
  if (filters.customerType?.length) parts.push(`Type: ${filters.customerType.join(', ')}`);
  if (filters.brand?.length) parts.push(`Brand: ${filters.brand.join(', ')}`);
  if (filters.productFamily?.length) parts.push(`Product Family: ${filters.productFamily.join(', ')}`);
  if (filters.countryOfOrigin?.length) parts.push(`Country: ${filters.countryOfOrigin.join(', ')}`);
  if (filters.foodServiceRetail?.length) parts.push(`FS vs Retail: ${mapFoodServiceRetail(filters.foodServiceRetail)}`);
  return parts.length > 0 ? `Filters: ${parts.join(' · ')}` : null;
}

export function ConsolidatedHeader({
  mode, entityCount, dimensionLabel, filters, onExport, onClose,
}: ConsolidatedHeaderProps) {
  const prefix = mode === 'report' ? 'Report' : 'Consolidated';
  const title = `${prefix}: ${formatInteger(entityCount)} ${dimensionLabel}`;
  const filterLine = formatFilters(filters);

  /** WHY: Escape exits Reports view globally while this component is mounted.
      document-level listener means it works regardless of focus position. */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="flex items-start justify-between gap-[var(--spacing-lg)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-bold text-[var(--color-text-primary)]">{title}</h1>
        {filterLine && (
          <p className="mt-[var(--spacing-xs)] truncate text-[12px] text-[var(--color-text-muted)]">{filterLine}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-[var(--spacing-lg)]">
        {/* Period selector hidden 2026-04-17 — activePeriod state still flows through
            to KPISection and HeroRevenueCard for labelling. Restore when multi-year
            comparison is reintroduced. */}
        <button
          type="button"
          onClick={onExport}
          className="cursor-pointer rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-md)] text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-gold-muted)]"
        >
          Export
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit Reports view"
          className="cursor-pointer rounded-[var(--radius-sm)] p-[var(--spacing-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-gold-subtle)] hover:text-[var(--color-text-secondary)]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
