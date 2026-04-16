// FILE: client/src/components/right-panel/kpi-modal-content.tsx
// PURPOSE: Modal content builders for KPI cards and hero revenue card — extracted from KPISection
// USED BY: KPISection.tsx (via onExpand callbacks)
// EXPORTS: KPIModalContent, HeroRevenueModalContent

import { useState } from 'react';
import type { KPIs, MonthlyRevenue, EntityListItem } from '@shared/types/dashboard';
import type { KPISubItem } from './KPICard';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';
import { YoYBarChart } from './YoYBarChart';
import { useContainerSize } from '../../hooks/useContainerSize';
import { PerCustomerToggle, type PerCustomerMode } from './PerCustomerToggle';
import { PerCustomerKPITable } from './PerCustomerKPITable';

interface KPIModalContentProps {
  value: string;
  changePercent?: number | null;
  prevYearValue?: string;
  prevYearFullValue?: string;
  prevYearLabel?: string;
  prevYearFullLabel?: string;
  subItems?: KPISubItem[];
  entityLabel?: string;
  /** WHY: Enables per-customer toggle when in Report / View Consolidated mode */
  perCustomer?: {
    entities: EntityListItem[];
    getValue: (e: EntityListItem) => number | null;
    formatValue: (v: number) => string;
    getPrevValue?: (e: EntityListItem) => number | null;
    valueLabel: string;
  };
}

export function KPIModalContent({
  value, changePercent, prevYearValue, prevYearFullValue, prevYearLabel, prevYearFullLabel, subItems, entityLabel, perCustomer,
}: KPIModalContentProps) {
  const [mode, setMode] = useState<PerCustomerMode>('aggregated');
  const showToggle = !!perCustomer;

  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      {showToggle && (
        <div className="flex justify-end">
          <PerCustomerToggle mode={mode} onChange={setMode} entityLabel={entityLabel} />
        </div>
      )}

      {mode === 'per-customer' && perCustomer ? (
        <PerCustomerKPITable
          entities={perCustomer.entities}
          getValue={perCustomer.getValue}
          formatValue={perCustomer.formatValue}
          getPrevValue={perCustomer.getPrevValue}
          valueLabel={perCustomer.valueLabel}
          entityLabel={entityLabel}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

interface HeroRevenueModalContentProps {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  entityLabel?: string;
  /** WHY: Enables per-customer toggle when in consolidated mode */
  perCustomer?: {
    entities: EntityListItem[];
    getValue: (e: EntityListItem) => number | null;
    formatValue: (v: number) => string;
    getPrevValue?: (e: EntityListItem) => number | null;
  };
}

export function HeroRevenueModalContent({ kpis, monthlyRevenue, entityLabel, perCustomer }: HeroRevenueModalContentProps) {
  const [mode, setMode] = useState<PerCustomerMode>('aggregated');
  const [chartRef, chartSize] = useContainerSize();
  const showToggle = !!perCustomer;

  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      {showToggle && (
        <div className="flex justify-end">
          <PerCustomerToggle mode={mode} onChange={setMode} entityLabel={entityLabel} />
        </div>
      )}

      {mode === 'per-customer' && perCustomer ? (
        <PerCustomerKPITable
          entities={perCustomer.entities}
          getValue={perCustomer.getValue}
          formatValue={perCustomer.formatValue}
          getPrevValue={perCustomer.getPrevValue}
          valueLabel="Revenue"
          entityLabel={entityLabel}
        />
      ) : (
        <>
          <div className="flex flex-col gap-[var(--spacing-xs)]">
            <span className="tabular-nums text-[36px] font-[800] leading-tight tracking-[-1px] text-[var(--color-text-primary)]">
              {formatCurrency(Math.round(kpis.totalRevenue))}
            </span>
            {kpis.revenueChangePercent !== null && (
              <span className="text-[14px] font-medium" style={{ color: kpis.revenueChangePercent >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                {formatPercent(kpis.revenueChangePercent, { showSign: true })} vs last year
              </span>
            )}
          </div>
          <div ref={chartRef} className="h-[300px]">
            {chartSize.width > 0 && <YoYBarChart data={monthlyRevenue} width={chartSize.width} height={300} />}
          </div>
          <div className="flex gap-[var(--spacing-4xl)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
            <div className="flex flex-col">
              <span className="text-[11px] text-[var(--color-text-muted)]">{kpis.quarterLabel}</span>
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
        </>
      )}
    </div>
  );
}
