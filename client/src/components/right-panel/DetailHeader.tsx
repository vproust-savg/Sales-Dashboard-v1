// FILE: client/src/components/right-panel/DetailHeader.tsx
// PURPOSE: Top card of right panel — entity name, subtitle, period selector, export button
// USED BY: client/src/components/right-panel/RightPanel.tsx
// EXPORTS: DetailHeader

import type { EntityListItem, Period } from '@shared/types/dashboard';
import { PeriodSelector } from './PeriodSelector';

interface DetailHeaderProps {
  entity: EntityListItem | null;
  activePeriod: Period;
  yearsAvailable: string[];
  onPeriodChange: (period: Period) => void;
  onExport: () => void;
}

export function DetailHeader({
  entity, activePeriod, yearsAvailable, onPeriodChange, onExport,
}: DetailHeaderProps) {
  const name = entity?.name ?? 'All Customers';
  const subtitle = entity?.meta1 ?? '';

  return (
    <div
      className="flex items-center justify-between rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-4xl)] py-[var(--spacing-xl)] shadow-[var(--shadow-card)]"
      role="banner"
    >
      {/* Left side — entity info */}
      <div className="min-w-0 flex-1">
        <h1
          className="truncate text-[20px] font-bold leading-[1.3] text-[var(--color-text-primary)]"
          title={name}
        >
          {name}
        </h1>
        {subtitle && (
          <p
            className="mt-[var(--spacing-2xs)] truncate text-[11px] text-[var(--color-text-muted)]"
            title={subtitle}
          >
            {entity?.id} &middot; {subtitle} &middot; {entity?.meta2}
          </p>
        )}
      </div>

      {/* Right side — period selector + export */}
      <div className="ml-[var(--spacing-lg)] flex shrink-0 items-center gap-[var(--spacing-lg)]">
        <PeriodSelector
          activePeriod={activePeriod}
          yearsAvailable={yearsAvailable}
          onChange={onPeriodChange}
        />
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
