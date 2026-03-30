// FILE: client/src/components/right-panel/HeroRevenueCard.tsx
// PURPOSE: Total Revenue hero card with big value, YoY change, sub-items, and bar chart
// USED BY: KPISection.tsx
// EXPORTS: HeroRevenueCard

import type { KPIs, MonthlyRevenue } from '@shared/types/dashboard';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';
import { AnimatedNumber } from '../shared/AnimatedNumber';
import { YoYBarChart } from './YoYBarChart';

interface HeroRevenueCardProps {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
}

export function HeroRevenueCard({ kpis, monthlyRevenue }: HeroRevenueCardProps) {
  const changePercent = kpis.revenueChangePercent;
  const isPositive = changePercent !== null && changePercent >= 0;
  const trendColor = isPositive ? 'var(--color-green)' : 'var(--color-red)';

  return (
    <div className="flex flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
      {/* Top row: revenue value (left) + previous year (right) */}
      <div className="flex items-start justify-between">
        {/* Left: label + value + trend */}
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-[#888]">
            Total Revenue (12 months)
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
              {formatPercent(changePercent, { showSign: true })} vs previous year
            </span>
          )}
        </div>

        {/* Right: previous year */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-normal text-[var(--color-text-faint)]">
            Previous Year
          </span>
          <span className="text-[16px] font-semibold text-[var(--color-text-faint)]">
            <AnimatedNumber
              value={kpis.prevYearRevenue}
              formatter={(n) => formatCurrency(Math.round(n))}
            />
          </span>
        </div>
      </div>

      {/* Sub-items row */}
      <div className="mt-[var(--spacing-md)] flex gap-[var(--spacing-3xl)]">
        <SubItem label="This Quarter" value={kpis.thisQuarterRevenue} />
        <SubItem label="Best Month" value={kpis.bestMonth.amount} suffix={kpis.bestMonth.name} />
        <SubItem label="Previous Year" value={kpis.prevYearRevenue} />
      </div>

      {/* YoY bar chart */}
      <div className="mt-[var(--spacing-lg)]">
        <YoYBarChart data={monthlyRevenue} />
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
      <span className="text-[11px] font-normal text-[#888]">{label}</span>
      <span className="text-[15px] font-semibold text-[var(--color-text-secondary)]">
        {formatCurrency(value)}
        {suffix && (
          <span className="ml-1 text-[11px] font-normal text-[#888]">({suffix})</span>
        )}
      </span>
    </div>
  );
}
