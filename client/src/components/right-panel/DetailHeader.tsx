// FILE: client/src/components/right-panel/DetailHeader.tsx
// PURPOSE: Top card of right panel — entity name, subtitle, layout controls, period selector, export
// USED BY: client/src/components/right-panel/RightPanel.tsx
// EXPORTS: DetailHeader

import type { EntityListItem, Period } from '@shared/types/dashboard';
import type { LayoutPreset } from '../../hooks/useDashboardLayout';
import { CopyableId } from '../shared/CopyableId';
import { PeriodSelector } from './PeriodSelector';
import { LayoutPresetToggle } from './LayoutPresetToggle';

interface DetailHeaderProps {
  entity: EntityListItem | null;
  activePeriod: Period;
  yearsAvailable: string[];
  onPeriodChange: (period: Period) => void;
  onExport: () => void;
  activePreset: LayoutPreset;
  onPresetChange: (preset: Exclude<LayoutPreset, 'custom'>) => void;
  onResetLayout: () => void;
}

export function DetailHeader({
  entity, activePeriod, yearsAvailable, onPeriodChange, onExport,
  activePreset, onPresetChange, onResetLayout,
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
        <h1 className="truncate text-[22px] font-bold leading-[1.3] text-[var(--color-text-primary)]" title={name}>{name}</h1>
        {subtitle && (
          <p className="mt-[var(--spacing-2xs)] truncate text-[12px] text-[var(--color-text-muted)]" title={subtitle}>
            {entity?.id && <CopyableId value={entity.id} label="ID" className="inline text-[12px] text-[var(--color-text-muted)]" />}
            {entity?.zone && <> &middot; {entity.zone}</>}
            {entity?.customerType && <> &middot; {entity.customerType}</>}
            {entity?.rep && <> &middot; {entity.rep}</>}
          </p>
        )}
      </div>

      {/* Right side — reset, preset toggle, period selector, export */}
      <div className="ml-[var(--spacing-lg)] flex shrink-0 items-center gap-[var(--spacing-lg)]">
        {/* Reset layout button */}
        <button
          type="button"
          onClick={onResetLayout}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-gold-muted)] hover:text-[var(--color-text-secondary)]"
          aria-label="Reset layout to defaults"
          title="Reset layout"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1.5 2.5v3.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2.1 8.5a5 5 0 104.9-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <LayoutPresetToggle activePreset={activePreset} onPresetChange={onPresetChange} />

        <PeriodSelector activePeriod={activePeriod} yearsAvailable={yearsAvailable} onChange={onPeriodChange} />
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
