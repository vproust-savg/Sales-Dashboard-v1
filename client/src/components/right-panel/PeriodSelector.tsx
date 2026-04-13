// FILE: client/src/components/right-panel/PeriodSelector.tsx
// PURPOSE: Pill-style period tabs with Framer Motion sliding active indicator
// USED BY: client/src/components/right-panel/DetailHeader.tsx
// EXPORTS: PeriodSelector

import { useEffect, useRef, useState } from 'react';
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
  const [overflowOpen, setOverflowOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visibleYears = yearsAvailable.slice(0, MAX_VISIBLE_YEARS);
  const hiddenYears = yearsAvailable.slice(MAX_VISIBLE_YEARS);
  const activeHiddenYear = hiddenYears.includes(activePeriod) ? activePeriod : null;
  const tabs: { label: string; value: Period }[] = [
    { label: 'YTD', value: 'ytd' },
    ...visibleYears.map(y => ({ label: y, value: y as Period })),
  ];

  useEffect(() => {
    if (!overflowOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOverflowOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOverflowOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [overflowOpen]);

  function handleOverflowSelect(year: string) {
    onChange(year);
    setOverflowOpen(false);
  }

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
            onClick={() => {
              setOverflowOpen(false);
              onChange(tab.value);
            }}
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
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            role="tab"
            aria-selected={activeHiddenYear !== null}
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            aria-controls="period-overflow-menu"
            onClick={() => setOverflowOpen((prev) => !prev)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setOverflowOpen(true);
              }
            }}
            className="relative cursor-pointer rounded-[var(--radius-base)] px-[var(--spacing-xl)] py-[var(--spacing-sm)] text-[12px] transition-colors"
            style={{
              fontWeight: activeHiddenYear ? 600 : 500,
              color: activeHiddenYear ? 'var(--color-text-primary)' : 'var(--color-gold-primary)',
            }}
          >
            {activeHiddenYear && (
              <motion.span
                layoutId="period-active-pill"
                className="absolute inset-0 rounded-[var(--radius-base)] bg-[var(--color-bg-card)]"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-10">{activeHiddenYear ?? 'More'} &#9662;</span>
          </button>
          {overflowOpen && (
            <div
              id="period-overflow-menu"
              ref={menuRef}
              role="menu"
              className="absolute right-0 top-full z-20 mt-1 min-w-[88px] rounded-[var(--radius-base)] bg-[var(--color-bg-card)] py-1 shadow-[var(--shadow-dropdown)]"
            >
              {hiddenYears.map((year) => {
                const isActive = activePeriod === year;
                return (
                  <button
                    key={year}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => handleOverflowSelect(year)}
                    className={`block w-full cursor-pointer px-[var(--spacing-xl)] py-[var(--spacing-sm)] text-left text-[12px] ${
                      isActive
                        ? 'bg-[var(--color-gold-hover)] font-semibold text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-gold-hover)]'
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
