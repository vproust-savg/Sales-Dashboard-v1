// FILE: client/src/components/right-panel/KPICard.tsx
// PURPOSE: Individual KPI card with label (YTD), animated value, prev year, and toggleable sub-items
// USED BY: KPISection.tsx
// EXPORTS: KPICard

import { motion, AnimatePresence } from 'framer-motion';
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
  /** WHY: Global toggle from KPISection controls all cards at once */
  expanded?: boolean;
  /** WHY statusDot: Last Order card shows activity status dot per spec 10.3 */
  statusDot?: { color: string; label: string };
}

export function KPICard({
  label, periodLabel, value, formatter, prevYearValue, changePercent, subItems, expanded, statusDot,
}: KPICardProps) {
  const hasSubItems = subItems && subItems.length > 0;

  return (
    <div
      className="group/kpi flex flex-col justify-between rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] px-[var(--spacing-xl)] py-[var(--spacing-base)] shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
    >
      {/* Top row: label + value (left) + prev year (right) */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-muted)]">
            {label}{periodLabel && <span className="opacity-0 transition-opacity duration-150 group-hover/kpi:opacity-100"> {periodLabel}</span>}
          </span>
          <span className="mt-[var(--spacing-2xs)] text-[17px] font-bold text-[var(--color-text-primary)]">
            <AnimatedNumber value={value} formatter={formatter} />
          </span>
          {changePercent !== undefined && changePercent !== null && (
            <span
              className="text-[9px] font-medium"
              style={{ color: changePercent >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}
            >
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
              <span className="opacity-0 transition-opacity duration-150 group-hover/kpi:opacity-100">
                {' '}vs same period last year
              </span>
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

      {/* Expandable sub-items — controlled by global toggle */}
      {hasSubItems && (
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="sub-items"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-[var(--spacing-sm)] flex gap-[var(--spacing-lg)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-sm)]">
                {subItems.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.15, ease: 'easeOut' }}
                    className="flex flex-col min-w-0"
                  >
                    <span className="text-[8px] font-normal text-[var(--color-text-muted)] whitespace-nowrap">{item.label}</span>
                    <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">
                      {item.value}
                      {item.suffix && (
                        <span className="ml-0.5 text-[8px] font-normal text-[var(--color-text-muted)]">({item.suffix})</span>
                      )}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex justify-center pt-[var(--spacing-xs)]"
            >
              <span className="text-[8px] tracking-[3px] text-[var(--color-gold-muted)]">&#183;&#183;&#183;</span>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
