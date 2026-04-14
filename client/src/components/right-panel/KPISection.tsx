// FILE: client/src/components/right-panel/KPISection.tsx
// PURPOSE: CSS Grid layout — hero revenue card (left) + 2x3 KPI card grid (right)
// USED BY: RightPanel.tsx
// EXPORTS: KPISection

import { useState } from 'react';
import type { KPIs, KPIMetricBreakdown, MonthlyRevenue, SparklineData, Period } from '@shared/types/dashboard';
import {
  formatCurrency,
  formatDays,
  formatFrequency,
  formatInteger,
  formatPercent,
} from '@shared/utils/formatting';
import { HeroRevenueCard } from './HeroRevenueCard';
import { KPICard } from './KPICard';
import type { KPISubItem } from './KPICard';
import { useResizablePanel } from '../../hooks/useResizablePanel';
import { ResizeDivider } from './ResizeDivider';
import { useModal } from '../shared/ModalProvider';
import { KPIModalContent, HeroRevenueModalContent } from './kpi-modal-content';
import { useCardNavigation } from '../../hooks/useCardNavigation';

interface KPISectionProps {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  sparklines: Record<string, SparklineData>;
  activePeriod: Period;
  /** WHY: 3-column grid template from useDashboardLayout — e.g. "3fr 6px 2fr" */
  heroKpiGridTemplate: string;
  onHeroKpiRatioChange: (ratio: [number, number]) => void;
  heroKpiRatio: [number, number];
}

// ---------------------------------------------------------------------------
// KPI card config — drives the 5 standard cards via .map()
// ---------------------------------------------------------------------------

interface KPICardConfig {
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
function nullableFmt(value: number, fmt: (n: number) => string): string {
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

const roundCurrency = (n: number) => formatCurrency(Math.round(n));

const KPI_CONFIGS: KPICardConfig[] = [
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
function getActivityStatus(days: number | null): { color: string; label: string } {
  if (days === null) return { color: 'var(--color-text-muted)', label: 'No orders' };
  if (days <= 14) return { color: 'var(--color-green)', label: 'Active buyer' };
  if (days <= 45) return { color: 'var(--color-gold-primary)', label: 'Regular' };
  if (days <= 90) return { color: 'var(--color-yellow)', label: 'Slowing' };
  return { color: 'var(--color-red)', label: 'At risk' };
}

/** WHY: YoY percent change — null when no prev year data to avoid division by zero */
function yoyChange(current: number, prevYear: number): number | null {
  return prevYear > 0 ? ((current - prevYear) / prevYear) * 100 : null;
}

export function KPISection({
  kpis,
  monthlyRevenue,
  sparklines: _sparklines,
  activePeriod,
  heroKpiGridTemplate,
  onHeroKpiRatioChange,
  heroKpiRatio,
}: KPISectionProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { containerRef, isDragging, handleMouseDown } = useResizablePanel({
    direction: 'horizontal',
    defaultRatio: heroKpiRatio,
    minPercent: 30,
    maxPercent: 70,
    onRatioChange: onHeroKpiRatioChange,
  });
  const { openModal } = useModal();
  const { setCardRef, onCardFocus, onCardBlur } = useCardNavigation(7);
  const activity = getActivityStatus(kpis.lastOrderDays);
  const pLabel = activePeriod === 'ytd' ? '(YTD)' : `(${activePeriod})`;
  const prevYr = activePeriod === 'ytd' ? new Date().getFullYear() - 1 : parseInt(activePeriod, 10) - 1;
  const pyLabel = activePeriod === 'ytd' ? `YTD ${prevYr}` : `${prevYr}`;
  const pyFullLabel = `Full ${prevYr}`;

  return (
    <div className="flex flex-col gap-[var(--spacing-sm)]" role="grid" aria-label="KPI cards">
      <div ref={containerRef} className="grid gap-0 max-lg:grid-cols-1 max-lg:gap-[var(--spacing-base)]" style={{ gridTemplateColumns: heroKpiGridTemplate }}>
        <HeroRevenueCard
          kpis={kpis}
          monthlyRevenue={monthlyRevenue}
          activePeriod={activePeriod}
          showDetails={showDetails}
          onExpand={() => openModal('Total Revenue', <HeroRevenueModalContent kpis={kpis} monthlyRevenue={monthlyRevenue} />)}
          cardRef={setCardRef(0)}
          onCardFocus={onCardFocus(0)}
          onCardBlur={onCardBlur}
        />
        <ResizeDivider direction="horizontal" isDragging={isDragging} onMouseDown={handleMouseDown} onTouchStart={handleMouseDown} />
        <div className="grid grid-cols-2 grid-rows-3 gap-[var(--spacing-sm)] overflow-hidden">
          {KPI_CONFIGS.map((cfg) => {
            const bd = cfg.getBreakdown(kpis);
            const value = cfg.getValue(kpis);
            const raw = cfg.getRawValue(kpis);
            const change = yoyChange(value, bd.prevYear);
            const subItems = cfg.buildSubItems(bd);
            const fmtPrevYear = cfg.isNullable ? nullableFmt(bd.prevYear, cfg.formatter) : cfg.formatter(bd.prevYear);
            const fmtPrevYearFull = cfg.isNullable ? nullableFmt(bd.prevYearFull, cfg.formatter) : cfg.formatter(bd.prevYearFull);
            const displayValue = (raw === null) ? '\u2014' : cfg.formatter(value);
            const cardFormatter = cfg.isNullable
              ? (n: number) => raw === null ? '\u2014' : cfg.formatter(n)
              : cfg.formatter;

            return (
              <KPICard
                key={cfg.label}
                label={cfg.label}
                periodLabel={pLabel}
                value={value}
                formatter={cardFormatter}
                prevYearValue={fmtPrevYear}
                prevYearFullValue={fmtPrevYearFull}
                prevYearLabel={pyLabel}
                prevYearFullLabel={pyFullLabel}
                changePercent={change}
                expanded={showDetails}
                subItems={subItems}
                onExpand={() => openModal(cfg.label, (
                  <KPIModalContent
                    value={displayValue}
                    changePercent={change}
                    prevYearValue={fmtPrevYear}
                    prevYearFullValue={fmtPrevYearFull}
                    prevYearLabel={pyLabel}
                    prevYearFullLabel={pyFullLabel}
                    subItems={subItems}
                  />
                ))}
                cardRef={setCardRef(cfg.cardIndex)}
                onCardFocus={onCardFocus(cfg.cardIndex)}
                onCardBlur={onCardBlur}
              />
            );
          })}

          <KPICard
            label="Last Order"
            periodLabel=""
            value={kpis.lastOrderDays ?? 0}
            formatter={(n) => kpis.lastOrderDays === null ? 'No orders' : formatDays(Math.round(n))}
            statusDot={activity}
            onExpand={() => openModal('Last Order', (
              <KPIModalContent value={kpis.lastOrderDays === null ? 'No orders' : formatDays(Math.round(kpis.lastOrderDays))} />
            ))}
            cardRef={setCardRef(6)}
            onCardFocus={onCardFocus(6)}
            onCardBlur={onCardBlur}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((prev) => !prev)}
        className="mx-auto flex cursor-pointer items-center gap-[var(--spacing-xs)] rounded-full bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-xs)] text-[10px] font-medium text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[var(--color-gold-muted)] hover:text-[var(--color-text-secondary)]"
      >
        {showDetails ? 'Hide details' : 'Show details'}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
