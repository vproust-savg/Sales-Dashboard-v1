// FILE: client/src/components/right-panel/HeroRevenueCard.tsx
// PURPOSE: Total Revenue hero card with big value, YoY change, sub-items, and bar chart
// USED BY: KPISection.tsx
// EXPORTS: HeroRevenueCard

import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { KPIs, MonthlyRevenue, Period } from '@shared/types/dashboard';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';
import { AnimatedNumber } from '../shared/AnimatedNumber';
import { YoYBarChart } from './YoYBarChart';

interface HeroRevenueCardProps {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  activePeriod: Period;
  /** WHY: Global toggle from KPISection controls sub-items visibility */
  showDetails: boolean;
}

export function HeroRevenueCard({ kpis, monthlyRevenue, activePeriod, showDetails }: HeroRevenueCardProps) {
  const changePercent = kpis.revenueChangePercent;
  const isPositive = changePercent !== null && changePercent >= 0;
  const trendColor = isPositive ? 'var(--color-green)' : 'var(--color-red)';

  /** WHY ResizeObserver: chart container grows via flex-1 when card stretches in the grid;
   *  we measure the actual height so the SVG viewBox stays in sync (no text distortion) */
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(120);
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = Math.round(entry.contentRect.height);
      if (h > 0) setChartHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="group/hero flex h-full flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
      {/* Top row: revenue value (left) + previous year (right) */}
      <div className="flex items-start justify-between">
        {/* Left: label + value + trend */}
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
            Total Revenue ({activePeriod === 'ytd' ? 'YTD' : activePeriod})
          </span>
          <span
            className="tabular-nums text-[30px] font-[800] leading-tight tracking-[-1px] text-[var(--color-text-primary)]"
            style={{ fontFeatureSettings: "'tnum'" }}
          >
            <AnimatedNumber
              value={kpis.totalRevenue}
              formatter={(n) => formatCurrency(Math.round(n))}
            />
          </span>
          {changePercent !== null && (
            <span className="text-[12px] font-medium" style={{ color: trendColor }}>
              {formatPercent(changePercent, { showSign: true })}
              <span className="opacity-0 transition-opacity duration-150 group-hover/hero:opacity-100">
                {' '}vs same period last year
              </span>
            </span>
          )}
        </div>

        {/* Right: previous year — same-period + full year */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-normal text-[var(--color-text-faint)]">
              {activePeriod === 'ytd' ? `YTD ${new Date().getFullYear() - 1}` : `${parseInt(activePeriod, 10) - 1}`}
            </span>
            <span className="text-[16px] font-semibold text-[var(--color-text-faint)]">
              <AnimatedNumber
                value={kpis.prevYearRevenue}
                formatter={(n) => formatCurrency(Math.round(n))}
              />
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-normal text-[var(--color-text-faint)]">
              Full {activePeriod === 'ytd' ? new Date().getFullYear() - 1 : parseInt(activePeriod, 10) - 1}
            </span>
            <span className="text-[14px] font-semibold text-[var(--color-text-faint)]">
              <AnimatedNumber
                value={kpis.prevYearRevenueFull}
                formatter={(n) => formatCurrency(Math.round(n))}
              />
            </span>
          </div>
        </div>
      </div>

      {/* Sub-items row — controlled by global toggle */}
      <AnimatePresence initial={false}>
        {showDetails ? (
          <motion.div
            key="sub-items"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-[var(--spacing-md)] flex gap-[var(--spacing-3xl)]">
              <SubItem label="This Quarter" value={kpis.thisQuarterRevenue} />
              <SubItem label="Last Month" value={kpis.lastMonthRevenue} suffix={kpis.lastMonthName} />
              <SubItem label="Best Month" value={kpis.bestMonth.amount} suffix={kpis.bestMonth.name} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex justify-center pt-[var(--spacing-sm)]"
          >
            <span className="text-[10px] tracking-[3px] text-[var(--color-gold-muted)]">&#183;&#183;&#183;</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* YoY bar chart — flex-1 fills available vertical space in the grid cell */}
      <div ref={chartRef} className="mt-[var(--spacing-lg)] min-h-0 flex-1">
        <YoYBarChart data={monthlyRevenue} chartHeight={chartHeight} />
      </div>
    </div>
  );
}

function SubItem({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-normal text-[var(--color-text-muted)]">{label}</span>
      <span className="text-[15px] font-semibold text-[var(--color-text-secondary)]">
        {formatCurrency(value)}
        {suffix && (
          <span className="ml-1 text-[11px] font-normal text-[var(--color-text-muted)]">({suffix})</span>
        )}
      </span>
    </div>
  );
}
