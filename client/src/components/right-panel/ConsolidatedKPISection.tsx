// FILE: client/src/components/right-panel/ConsolidatedKPISection.tsx
// PURPOSE: KPI card configuration, helpers, and activity status used by KPISection
// USED BY: client/src/components/right-panel/KPISection.tsx
// EXPORTS: KPICardConfig, KPI_CONFIGS, nullableFmt, getActivityStatus, yoyChange

import type { KPIs, KPIMetricBreakdown } from '@shared/types/dashboard';
import {
  formatCurrency,
  formatFrequency,
  formatInteger,
  formatPercent,
} from '@shared/utils/formatting';
import type { KPISubItem } from './KPICard';

// ---------------------------------------------------------------------------
// KPI card config — drives the 5 standard cards via .map()
// ---------------------------------------------------------------------------

export interface KPICardConfig {
  label: string;
  cardIndex: number;
  getValue: (k: KPIs) => number;
  /** WHY: nullable cards show em-dash when raw KPI is null */
  getRawValue: (k: KPIs) => number | null;
  isNullable: boolean;
  formatter: (n: number) => string;
  getBreakdown: (k: KPIs) => KPIMetricBreakdown;
  /** WHY: Frequency sub-items use formatInteger for lastMonth/bestMonth, not formatFrequency */
  buildSubItems: (bd: KPIMetricBreakdown) => KPISubItem[];
}

/** WHY: nullable breakdowns show em-dash when value is 0 (no data for that period) */
export function nullableFmt(value: number, fmt: (n: number) => string): string {
  return value > 0 ? fmt(value) : '\u2014';
}

function standardSubItems(bd: KPIMetricBreakdown, fmt: (n: number) => string, nullable: boolean): KPISubItem[] {
  const f = nullable ? (n: number) => nullableFmt(n, fmt) : fmt;
  return [
    { label: bd.quarterLabel, value: f(bd.thisQuarter) },
    { label: 'Last Month', value: f(bd.lastMonth), suffix: bd.lastMonthName },
    { label: 'Best Month', value: f(bd.bestMonth.value), suffix: bd.bestMonth.name },
  ];
}

export const roundCurrency = (n: number) => formatCurrency(Math.round(n));

export const KPI_CONFIGS: KPICardConfig[] = [
  {
    label: 'Orders',
    cardIndex: 1,
    getValue: (k) => k.orders,
    getRawValue: (k) => k.orders,
    isNullable: false,
    formatter: formatInteger,
    getBreakdown: (k) => k.ordersBreakdown,
    buildSubItems: (bd) => standardSubItems(bd, formatInteger, false),
  },
  {
    label: 'Avg. Order',
    cardIndex: 2,
    getValue: (k) => k.avgOrder ?? 0,
    getRawValue: (k) => k.avgOrder,
    isNullable: true,
    formatter: roundCurrency,
    getBreakdown: (k) => k.avgOrderBreakdown,
    buildSubItems: (bd) => standardSubItems(bd, roundCurrency, true),
  },
  {
    label: 'Margin %',
    cardIndex: 3,
    getValue: (k) => k.marginPercent ?? 0,
    getRawValue: (k) => k.marginPercent,
    isNullable: true,
    formatter: formatPercent,
    getBreakdown: (k) => k.marginPercentBreakdown,
    buildSubItems: (bd) => standardSubItems(bd, formatPercent, true),
  },
  {
    label: 'Margin $',
    cardIndex: 4,
    getValue: (k) => k.marginAmount,
    getRawValue: (k) => k.marginAmount,
    isNullable: false,
    formatter: roundCurrency,
    getBreakdown: (k) => k.marginAmountBreakdown,
    buildSubItems: (bd) => standardSubItems(bd, roundCurrency, false),
  },
  {
    label: 'Frequency',
    cardIndex: 5,
    getValue: (k) => k.frequency ?? 0,
    getRawValue: (k) => k.frequency,
    isNullable: true,
    formatter: formatFrequency,
    getBreakdown: (k) => k.frequencyBreakdown,
    buildSubItems: (bd) => [
      { label: bd.quarterLabel, value: nullableFmt(bd.thisQuarter, formatFrequency) },
      { label: 'Last Month', value: formatInteger(bd.lastMonth), suffix: bd.lastMonthName },
      { label: 'Best Month', value: formatInteger(bd.bestMonth.value), suffix: bd.bestMonth.name },
    ],
  },
];

/** WHY activity status here: spec 10.3 defines dot color thresholds by days since last order */
export function getActivityStatus(days: number | null): { color: string; label: string } {
  if (days === null) return { color: 'var(--color-text-muted)', label: 'No orders' };
  if (days <= 14) return { color: 'var(--color-green)', label: 'Active buyer' };
  if (days <= 45) return { color: 'var(--color-gold-primary)', label: 'Regular' };
  if (days <= 90) return { color: 'var(--color-yellow)', label: 'Slowing' };
  return { color: 'var(--color-red)', label: 'At risk' };
}

/** WHY: YoY percent change — null when no prev year data to avoid division by zero */
export function yoyChange(current: number, prevYear: number): number | null {
  return prevYear > 0 ? ((current - prevYear) / prevYear) * 100 : null;
}
