// FILE: client/src/components/right-panel/KPICard.tsx
// PURPOSE: Individual KPI card with label (YTD), animated value, prev year, and sub-items row
// USED BY: KPISection.tsx
// EXPORTS: KPICard

import { AnimatedNumber } from '../shared/AnimatedNumber';

interface KPISubItem {
  label: string;
  value: string;
  suffix?: string; // e.g. month name "(Jan)"
}

interface KPICardProps {
  label: string;
  periodLabel: string; // "(YTD)" or "(2025)"
  value: number;
  formatter: (n: number) => string;
  prevYearValue?: string;
  /** YoY change line — e.g. "-22.4% vs same period last year" */
  changePercent?: number | null;
  subItems?: KPISubItem[];
  /** WHY statusDot: Last Order card shows activity status dot per spec 10.3 */
  statusDot?: { color: string; label: string };
}

export function KPICard({
  label, periodLabel, value, formatter, prevYearValue, changePercent, subItems, statusDot,
}: KPICardProps) {
  return (
    <div
      className="flex flex-col justify-between rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] px-[var(--spacing-xl)] py-[var(--spacing-base)] shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
    >
      {/* Top row: label + value (left) + prev year (right) */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-muted)]">
            {label} {periodLabel}
          </span>
          <span className="mt-[var(--spacing-2xs)] text-[17px] font-bold text-[var(--color-text-primary)]">
            <AnimatedNumber value={value} formatter={formatter} />
          </span>
          {changePercent !== undefined && changePercent !== null && (
            <span
              className="text-[9px] font-medium"
              style={{ color: changePercent >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}
            >
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}% vs same period last year
            </span>
          )}
          {statusDot && (
            <span className="mt-[var(--spacing-2xs)] text-[10px] font-medium">
              <span style={{ color: statusDot.color }}>&#9679;</span>{' '}
              <span style={{ color: statusDot.color }}>{statusDot.label}</span>
            </span>
          )}
        </div>
        {prevYearValue && (
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[8px] font-normal text-[var(--color-text-faint)]">Prev Year</span>
            <span className="text-[11px] font-semibold text-[var(--color-text-faint)]">{prevYearValue}</span>
          </div>
        )}
      </div>

      {/* Sub-items row — This Quarter, Last Month, Best Month */}
      {subItems && subItems.length > 0 && (
        <div className="mt-[var(--spacing-sm)] flex gap-[var(--spacing-lg)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-sm)]">
          {subItems.map((item) => (
            <div key={item.label} className="flex flex-col min-w-0">
              <span className="text-[8px] font-normal text-[var(--color-text-muted)] whitespace-nowrap">{item.label}</span>
              <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">
                {item.value}
                {item.suffix && (
                  <span className="ml-0.5 text-[8px] font-normal text-[var(--color-text-muted)]">({item.suffix})</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
