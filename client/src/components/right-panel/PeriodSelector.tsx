// FILE: client/src/components/right-panel/PeriodSelector.tsx
// PURPOSE: Pill-style period tabs with Framer Motion sliding active indicator
// USED BY: client/src/components/right-panel/DetailHeader.tsx
// EXPORTS: PeriodSelector

import { motion } from 'framer-motion';
import type { Period } from '@shared/types/dashboard';

interface PeriodSelectorProps {
  activePeriod: Period;
  yearsAvailable: string[];
  onChange: (period: Period) => void;
}

/** WHY max 3 year tabs + "More": avoids overflow in the 929px header card */
const MAX_VISIBLE_YEARS = 3;

export function PeriodSelector({ activePeriod, yearsAvailable, onChange }: PeriodSelectorProps) {
  const visibleYears = yearsAvailable.slice(0, MAX_VISIBLE_YEARS);
  const hiddenYears = yearsAvailable.slice(MAX_VISIBLE_YEARS);
  const tabs: { label: string; value: Period }[] = [
    { label: 'YTD', value: 'ytd' },
    ...visibleYears.map(y => ({ label: y, value: y as Period })),
  ];

  return (
    <div
      className="flex gap-[var(--spacing-2xs)] rounded-[var(--radius-lg)] bg-[var(--color-bg-page)] p-[3px]"
      role="tablist"
      aria-label="Period selector"
    >
      {tabs.map(tab => {
        const isActive = activePeriod === tab.value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className="relative cursor-pointer rounded-[var(--radius-base)] px-[var(--spacing-xl)] py-[var(--spacing-sm)] text-[12px] transition-colors"
            style={{
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            }}
          >
            {/* WHY layoutId: creates sliding white pill between active tabs */}
            {isActive && (
              <motion.span
                layoutId="period-active-pill"
                className="absolute inset-0 rounded-[var(--radius-base)] bg-[var(--color-bg-card)]"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}

      {/* "More" dropdown for older years */}
      {hiddenYears.length > 0 && (
        <div className="group relative">
          <button
            className="relative cursor-pointer rounded-[var(--radius-base)] px-[var(--spacing-xl)] py-[var(--spacing-sm)] text-[12px] font-medium text-[var(--color-gold-primary)]"
          >
            More &#9662;
          </button>
          <div className="invisible absolute right-0 top-full z-20 mt-1 min-w-[80px] rounded-[var(--radius-base)] bg-[var(--color-bg-card)] py-1 opacity-0 shadow-[var(--shadow-dropdown)] transition-all duration-200 group-hover:visible group-hover:opacity-100">
            {hiddenYears.map(year => (
              <button
                key={year}
                onClick={() => onChange(year)}
                className="block w-full cursor-pointer px-[var(--spacing-xl)] py-[var(--spacing-sm)] text-left text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-gold-hover)]"
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
