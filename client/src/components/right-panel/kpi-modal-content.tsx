// FILE: client/src/components/right-panel/kpi-modal-content.tsx
// PURPOSE: Modal content builders for KPI cards and hero revenue card — extracted from KPISection
// USED BY: KPISection.tsx (via onExpand callbacks)
// EXPORTS: KPIModalContent, HeroRevenueModalContent

import type { KPIs, MonthlyRevenue } from '@shared/types/dashboard';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';
import { YoYBarChart } from './YoYBarChart';

interface KPISubItem {
  label: string;
  value: string;
  suffix?: string;
}

interface KPIModalContentProps {
  value: string;
  changePercent?: number | null;
  prevYearValue?: string;
  prevYearFullValue?: string;
  prevYearLabel?: string;
  prevYearFullLabel?: string;
  subItems?: KPISubItem[];
}

export function KPIModalContent({ value, changePercent, prevYearValue, prevYearFullValue, prevYearLabel, prevYearFullLabel, subItems }: KPIModalContentProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      <div>
        <span className="tabular-nums text-[30px] font-bold text-[var(--color-text-primary)]">{value}</span>
        {changePercent != null && (
          <span className="ml-[var(--spacing-md)] text-[14px] font-medium" style={{ color: changePercent >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}% vs same period last year
          </span>
        )}
      </div>
      {prevYearValue && (
        <div className="flex gap-[var(--spacing-4xl)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
          <div className="flex flex-col">
            <span className="text-[11px] text-[var(--color-text-muted)]">{prevYearLabel}</span>
            <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">{prevYearValue}</span>
          </div>
          {prevYearFullValue && (
            <div className="flex flex-col">
              <span className="text-[11px] text-[var(--color-text-muted)]">{prevYearFullLabel}</span>
              <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">{prevYearFullValue}</span>
            </div>
          )}
        </div>
      )}
      {subItems && subItems.length > 0 && (
        <div className="flex gap-[var(--spacing-4xl)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
          {subItems.map((item) => (
            <div key={item.label} className="flex flex-col">
              <span className="text-[11px] text-[var(--color-text-muted)]">{item.label}</span>
              <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">
                {item.value}
                {item.suffix && <span className="ml-1 text-[11px] font-normal text-[var(--color-text-muted)]">({item.suffix})</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface HeroRevenueModalContentProps {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
}

export function HeroRevenueModalContent({ kpis, monthlyRevenue }: HeroRevenueModalContentProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      <div className="flex items-end justify-between">
        <span className="tabular-nums text-[36px] font-[800] leading-tight tracking-[-1px] text-[var(--color-text-primary)]">
          {formatCurrency(Math.round(kpis.totalRevenue))}
        </span>
        {kpis.revenueChangePercent !== null && (
          <span className="text-[14px] font-medium" style={{ color: kpis.revenueChangePercent >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
            {formatPercent(kpis.revenueChangePercent, { showSign: true })} vs last year
          </span>
        )}
      </div>
      <div className="h-[300px]">
        <YoYBarChart data={monthlyRevenue} height={300} />
      </div>
      <div className="flex gap-[var(--spacing-4xl)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
        <div className="flex flex-col">
          <span className="text-[11px] text-[var(--color-text-muted)]">This Quarter</span>
          <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">{formatCurrency(kpis.thisQuarterRevenue)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-[var(--color-text-muted)]">Last Month</span>
          <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">
            {formatCurrency(kpis.lastMonthRevenue)} <span className="text-[11px] text-[var(--color-text-muted)]">({kpis.lastMonthName})</span>
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-[var(--color-text-muted)]">Best Month</span>
          <span className="text-[16px] font-semibold text-[var(--color-text-secondary)]">
            {formatCurrency(kpis.bestMonth.amount)} <span className="text-[11px] text-[var(--color-text-muted)]">({kpis.bestMonth.name})</span>
          </span>
        </div>
      </div>
    </div>
  );
}
