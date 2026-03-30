// FILE: client/src/components/right-panel/KPISection.tsx
// PURPOSE: CSS Grid layout — hero revenue card (left) + 2x3 KPI card grid (right)
// USED BY: RightPanel.tsx
// EXPORTS: KPISection

import type { KPIs, MonthlyRevenue, SparklineData } from '@shared/types/dashboard';
import {
  formatCurrency,
  formatPercent,
  formatPercentPoints,
  formatFrequency,
  formatDays,
} from '@shared/utils/formatting';
import { HeroRevenueCard } from './HeroRevenueCard';
import { KPICard } from './KPICard';

interface KPISectionProps {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  sparklines: Record<string, SparklineData>;
}

/** WHY activity status here: spec 10.3 defines dot color thresholds by days since last order */
function getActivityStatus(days: number | null): { color: string; label: string } {
  if (days === null) return { color: '#999', label: 'No orders' };
  if (days <= 14) return { color: '#22c55e', label: 'Active buyer' };
  if (days <= 45) return { color: '#b8a88a', label: 'Regular' };
  if (days <= 90) return { color: '#eab308', label: 'Slowing' };
  return { color: '#ef4444', label: 'At risk' };
}

function getTrendColor(value: number | null): 'green' | 'red' | 'neutral' {
  if (value === null) return 'neutral';
  return value >= 0 ? 'green' : 'red';
}

export function KPISection({ kpis, monthlyRevenue, sparklines }: KPISectionProps) {
  const activity = getActivityStatus(kpis.lastOrderDays);

  return (
    <div className="grid grid-cols-2 gap-[var(--spacing-base)] max-lg:grid-cols-1">
      {/* Hero card — spans full height of grid */}
      <HeroRevenueCard kpis={kpis} monthlyRevenue={monthlyRevenue} />

      {/* 2x3 KPI grid — stretches to match hero height */}
      <div className="grid grid-cols-2 grid-rows-3 gap-[var(--spacing-md)]">
        {/* 1. Orders */}
        <KPICard
          label="Orders"
          value={kpis.orders}
          formatter={(n) => Math.round(n).toLocaleString('en-US')}
          changeValue={kpis.ordersChange !== null ? `${kpis.ordersChange > 0 ? '+' : ''}${kpis.ordersChange}` : null}
          changeLabel="this quarter"
          changeColor={getTrendColor(kpis.ordersChange)}
          sparklineData={sparklines.orders?.values}
        />

        {/* 2. Avg. Order */}
        <KPICard
          label="Avg. Order"
          value={kpis.avgOrder ?? 0}
          formatter={(n) => kpis.avgOrder === null ? '\u2014' : formatCurrency(Math.round(n))}
          changeValue={null}
          changeLabel=""
          changeColor="neutral"
          sparklineData={sparklines.revenue?.values}
        />

        {/* 3. Margin — special: two values per spec 22.4 */}
        <KPICard
          label="Margin"
          value={kpis.marginPercent ?? 0}
          formatter={(n) => kpis.marginPercent === null ? '\u2014' : formatPercent(n)}
          secondaryValue={formatCurrency(kpis.marginAmount)}
          changeValue={kpis.marginChangepp !== null ? formatPercentPoints(kpis.marginChangepp) : null}
          changeLabel="vs target"
          changeColor={getTrendColor(kpis.marginChangepp)}
        />

        {/* 4. Frequency */}
        <KPICard
          label="Frequency"
          value={kpis.frequency ?? 0}
          formatter={(n) => kpis.frequency === null ? '\u2014' : formatFrequency(n)}
          changeValue={kpis.frequencyChange !== null ? `${kpis.frequencyChange > 0 ? '+' : ''}${kpis.frequencyChange.toFixed(1)}` : null}
          changeLabel="vs avg"
          changeColor={getTrendColor(kpis.frequencyChange)}
        />

        {/* 5. Last Order — special: activity status dot per spec 10.3 */}
        <KPICard
          label="Last Order"
          value={kpis.lastOrderDays ?? 0}
          formatter={(n) => kpis.lastOrderDays === null ? 'No orders' : formatDays(Math.round(n))}
          changeValue={null}
          changeLabel=""
          changeColor="neutral"
          statusDot={activity}
        />

        {/* 6. Fill Rate */}
        <KPICard
          label="Fill Rate"
          value={kpis.fillRate ?? 0}
          formatter={(n) => kpis.fillRate === null ? '\u2014' : formatPercent(n)}
          changeValue={kpis.fillRateChangepp !== null ? formatPercentPoints(kpis.fillRateChangepp) : null}
          changeLabel="vs prev year"
          changeColor={getTrendColor(kpis.fillRateChangepp)}
        />
      </div>
    </div>
  );
}
