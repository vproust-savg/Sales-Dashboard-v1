// FILE: client/src/components/right-panel/kpi-peek-content.tsx
// PURPOSE: Peek preview content for KPI cards — shows card data at comfortable reading size
// USED BY: KPISection.tsx (via peekContent prop on KPICard)
// EXPORTS: KPIPeekContent, HeroPeekContent

import type { KPISubItem } from './KPICard';

interface KPIPeekContentProps {
  label: string;
  periodLabel: string;
  value: string;
  changePercent?: number | null;
  subItems?: KPISubItem[];
}

export function KPIPeekContent({ label, periodLabel, value, changePercent, subItems }: KPIPeekContentProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-lg)]">
      <span className="text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-muted)]">{label} {periodLabel}</span>
      <span className="tabular-nums text-[22px] font-bold text-[var(--color-text-primary)]">{value}</span>
      {changePercent != null && (
        <span className="text-[12px] font-medium" style={{ color: changePercent >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
          {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}% vs same period last year
        </span>
      )}
      {subItems && subItems.length > 0 && (
        <div className="flex gap-[var(--spacing-lg)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
          {subItems.map((item) => (
            <div key={item.label} className="flex flex-col">
              <span className="text-[10px] text-[var(--color-text-muted)]">{item.label}</span>
              <span className="text-[14px] font-semibold text-[var(--color-text-secondary)]">
                {item.value}
                {item.suffix && <span className="ml-0.5 text-[10px] text-[var(--color-text-muted)]">({item.suffix})</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface HeroPeekContentProps {
  revenue: string;
  changePercent: number | null;
  thisQuarter: string;
  lastMonth: string;
  lastMonthName: string;
  bestMonth: string;
  bestMonthName: string;
}

export function HeroPeekContent({ revenue, changePercent, thisQuarter, lastMonth, lastMonthName, bestMonth, bestMonthName }: HeroPeekContentProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-lg)]">
      <span className="text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-muted)]">Total Revenue</span>
      <span className="tabular-nums text-[22px] font-bold text-[var(--color-text-primary)]">{revenue}</span>
      {changePercent !== null && (
        <span className="text-[12px] font-medium" style={{ color: changePercent >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
          {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}% vs same period last year
        </span>
      )}
      <div className="flex gap-[var(--spacing-lg)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)]">
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--color-text-muted)]">This Quarter</span>
          <span className="text-[14px] font-semibold text-[var(--color-text-secondary)]">{thisQuarter}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--color-text-muted)]">Last Month</span>
          <span className="text-[14px] font-semibold text-[var(--color-text-secondary)]">{lastMonth} <span className="text-[10px] text-[var(--color-text-muted)]">({lastMonthName})</span></span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-[var(--color-text-muted)]">Best Month</span>
          <span className="text-[14px] font-semibold text-[var(--color-text-secondary)]">{bestMonth} <span className="text-[10px] text-[var(--color-text-muted)]">({bestMonthName})</span></span>
        </div>
      </div>
    </div>
  );
}
