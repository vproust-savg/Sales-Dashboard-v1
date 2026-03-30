// FILE: client/src/components/right-panel/KPICard.tsx
// PURPOSE: Individual KPI card with label, animated value, trend indicator, and sparkline
// USED BY: KPISection.tsx
// EXPORTS: KPICard

import { AnimatedNumber } from '../shared/AnimatedNumber';
import { Sparkline } from './Sparkline';

interface KPICardProps {
  label: string;
  value: number;
  formatter: (n: number) => string;
  changeValue: string | null;
  changeLabel: string;
  changeColor: 'green' | 'red' | 'neutral';
  sparklineData?: number[];
  /** WHY secondaryValue: Margin card shows both 18.4% and $44,200 per spec 22.4 */
  secondaryValue?: string;
  /** WHY statusDot: Last Order card shows activity status dot per spec 10.3 */
  statusDot?: { color: string; label: string };
}

export function KPICard({
  label,
  value,
  formatter,
  changeValue,
  changeLabel,
  changeColor,
  sparklineData,
  secondaryValue,
  statusDot,
}: KPICardProps) {
  const colorMap = {
    green: 'var(--color-green)',
    red: 'var(--color-red)',
    neutral: 'var(--color-text-muted)',
  };

  return (
    <div
      className="relative flex flex-col justify-center rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] px-[var(--spacing-xl)] py-[var(--spacing-base)] shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
    >
      {/* Sparkline — top-right corner */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="absolute right-[var(--spacing-xl)] top-[var(--spacing-base)]">
          <Sparkline data={sparklineData} />
        </div>
      )}

      {/* Label */}
      <span
        className="text-[10px] font-medium uppercase tracking-[0.5px] text-[#888]"
      >
        {label}
      </span>

      {/* Primary value */}
      <span className="mt-[var(--spacing-2xs)] text-[17px] font-bold text-[var(--color-text-primary)]">
        <AnimatedNumber value={value} formatter={formatter} />
      </span>

      {/* Secondary value — Margin card shows dollar amount below percentage */}
      {secondaryValue && (
        <span className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
          {secondaryValue}
        </span>
      )}

      {/* Trend indicator or status dot */}
      {statusDot ? (
        <span className="mt-[var(--spacing-2xs)] text-[10px] font-medium">
          <span style={{ color: statusDot.color }}>&#9679;</span>{' '}
          <span style={{ color: statusDot.color }}>{statusDot.label}</span>
        </span>
      ) : changeValue !== null ? (
        <span
          className="mt-[var(--spacing-2xs)] text-[10px] font-medium"
          style={{ color: colorMap[changeColor] }}
        >
          {changeValue} {changeLabel}
        </span>
      ) : null}
    </div>
  );
}
