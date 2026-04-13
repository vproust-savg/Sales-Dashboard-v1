// FILE: client/src/components/right-panel/KPISection.tsx
// PURPOSE: CSS Grid layout — hero revenue card (left) + 2x3 KPI card grid (right)
// USED BY: RightPanel.tsx
// EXPORTS: KPISection

import { useState } from 'react';
import type { KPIs, MonthlyRevenue, SparklineData, Period } from '@shared/types/dashboard';
import {
  formatCurrency,
  formatPercent,
  formatFrequency,
  formatDays,
} from '@shared/utils/formatting';
import { HeroRevenueCard } from './HeroRevenueCard';
import { KPICard } from './KPICard';
import { useResizablePanel } from '../../hooks/useResizablePanel';
import { ResizeDivider } from './ResizeDivider';
import { useModal } from '../shared/ModalProvider';
import { KPIModalContent, HeroRevenueModalContent } from './kpi-modal-content';

interface KPISectionProps {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  sparklines: Record<string, SparklineData>;
  activePeriod: Period;
  /** WHY: Grid template from useDashboardLayout — e.g. "3fr 2fr" */
  heroKpiTemplate: string;
  onHeroKpiRatioChange: (ratio: [number, number]) => void;
  heroKpiRatio: [number, number];
}

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

export function KPISection({ kpis, monthlyRevenue, sparklines: _sparklines, activePeriod, heroKpiTemplate, onHeroKpiRatioChange, heroKpiRatio }: KPISectionProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { containerRef, isDragging, handleMouseDown } = useResizablePanel({
    direction: 'horizontal',
    defaultRatio: heroKpiRatio,
    minPercent: 30,
    maxPercent: 70,
    onRatioChange: onHeroKpiRatioChange,
  });
  const { openModal } = useModal();
  const activity = getActivityStatus(kpis.lastOrderDays);
  const pLabel = activePeriod === 'ytd' ? '(YTD)' : `(${activePeriod})`;
  // WHY: Dynamic year labels for the two-line prev year display
  const prevYr = activePeriod === 'ytd' ? new Date().getFullYear() - 1 : parseInt(activePeriod, 10) - 1;
  const pyLabel = activePeriod === 'ytd' ? `YTD ${prevYr}` : `${prevYr}`;
  const pyFullLabel = `Full ${prevYr}`;
  const ob = kpis.ordersBreakdown;
  const ab = kpis.avgOrderBreakdown;
  const mpb = kpis.marginPercentBreakdown;
  const mab = kpis.marginAmountBreakdown;
  const fb = kpis.frequencyBreakdown;

  return (
    <div className="flex flex-col gap-[var(--spacing-sm)]">
    {/* WHY style prop: Dynamic ratio from drag — Tailwind can't use JS variables */}
    <div ref={containerRef} className="grid gap-0 max-lg:grid-cols-1 max-lg:gap-[var(--spacing-base)]" style={{ gridTemplateColumns: `${heroKpiTemplate.split(' ')[0]} 6px ${heroKpiTemplate.split(' ')[1]}` }}>
      <HeroRevenueCard kpis={kpis} monthlyRevenue={monthlyRevenue} activePeriod={activePeriod} showDetails={showDetails} onExpand={() => openModal('Total Revenue', <HeroRevenueModalContent kpis={kpis} monthlyRevenue={monthlyRevenue} />)} />
      <ResizeDivider direction="horizontal" isDragging={isDragging} onMouseDown={handleMouseDown} onTouchStart={handleMouseDown} />
      <div className="grid grid-cols-2 grid-rows-3 gap-[var(--spacing-sm)]">
        {/* 1. Orders */}
        <KPICard
          label="Orders" periodLabel={pLabel} value={kpis.orders}
          formatter={(n) => Math.round(n).toLocaleString('en-US')}
          prevYearValue={Math.round(ob.prevYear).toLocaleString('en-US')}
          prevYearFullValue={Math.round(ob.prevYearFull).toLocaleString('en-US')}
          prevYearLabel={pyLabel} prevYearFullLabel={pyFullLabel}
          changePercent={yoyChange(kpis.orders, ob.prevYear)} expanded={showDetails}
          subItems={[
            { label: 'This Quarter', value: Math.round(ob.thisQuarter).toLocaleString('en-US') },
            { label: 'Last Month', value: Math.round(ob.lastMonth).toLocaleString('en-US'), suffix: ob.lastMonthName },
            { label: 'Best Month', value: Math.round(ob.bestMonth.value).toLocaleString('en-US'), suffix: ob.bestMonth.name },
          ]}
          onExpand={() => openModal('Orders', <KPIModalContent value={Math.round(kpis.orders).toLocaleString('en-US')} changePercent={yoyChange(kpis.orders, ob.prevYear)} prevYearValue={Math.round(ob.prevYear).toLocaleString('en-US')} prevYearFullValue={Math.round(ob.prevYearFull).toLocaleString('en-US')} prevYearLabel={pyLabel} prevYearFullLabel={pyFullLabel} subItems={[{ label: 'This Quarter', value: Math.round(ob.thisQuarter).toLocaleString('en-US') }, { label: 'Last Month', value: Math.round(ob.lastMonth).toLocaleString('en-US'), suffix: ob.lastMonthName }, { label: 'Best Month', value: Math.round(ob.bestMonth.value).toLocaleString('en-US'), suffix: ob.bestMonth.name }]} />)}
        />

        {/* 2. Avg. Order */}
        <KPICard
          label="Avg. Order" periodLabel={pLabel} value={kpis.avgOrder ?? 0}
          formatter={(n) => kpis.avgOrder === null ? '\u2014' : formatCurrency(Math.round(n))}
          prevYearValue={ab.prevYear > 0 ? formatCurrency(Math.round(ab.prevYear)) : '\u2014'}
          prevYearFullValue={ab.prevYearFull > 0 ? formatCurrency(Math.round(ab.prevYearFull)) : '\u2014'}
          prevYearLabel={pyLabel} prevYearFullLabel={pyFullLabel}
          changePercent={yoyChange(kpis.avgOrder ?? 0, ab.prevYear)} expanded={showDetails}
          subItems={[
            { label: 'This Quarter', value: ab.thisQuarter > 0 ? formatCurrency(Math.round(ab.thisQuarter)) : '\u2014' },
            { label: 'Last Month', value: ab.lastMonth > 0 ? formatCurrency(Math.round(ab.lastMonth)) : '\u2014', suffix: ab.lastMonthName },
            { label: 'Best Month', value: ab.bestMonth.value > 0 ? formatCurrency(Math.round(ab.bestMonth.value)) : '\u2014', suffix: ab.bestMonth.name },
          ]}
          onExpand={() => openModal('Avg. Order', <KPIModalContent value={kpis.avgOrder === null ? '\u2014' : formatCurrency(Math.round(kpis.avgOrder))} changePercent={yoyChange(kpis.avgOrder ?? 0, ab.prevYear)} prevYearValue={ab.prevYear > 0 ? formatCurrency(Math.round(ab.prevYear)) : '\u2014'} prevYearFullValue={ab.prevYearFull > 0 ? formatCurrency(Math.round(ab.prevYearFull)) : '\u2014'} prevYearLabel={pyLabel} prevYearFullLabel={pyFullLabel} subItems={[{ label: 'This Quarter', value: ab.thisQuarter > 0 ? formatCurrency(Math.round(ab.thisQuarter)) : '\u2014' }, { label: 'Last Month', value: ab.lastMonth > 0 ? formatCurrency(Math.round(ab.lastMonth)) : '\u2014', suffix: ab.lastMonthName }, { label: 'Best Month', value: ab.bestMonth.value > 0 ? formatCurrency(Math.round(ab.bestMonth.value)) : '\u2014', suffix: ab.bestMonth.name }]} />)}
        />

        {/* 3. Margin % */}
        <KPICard
          label="Margin %" periodLabel={pLabel} value={kpis.marginPercent ?? 0}
          formatter={(n) => kpis.marginPercent === null ? '\u2014' : formatPercent(n)}
          prevYearValue={mpb.prevYear > 0 ? formatPercent(mpb.prevYear) : '\u2014'}
          prevYearFullValue={mpb.prevYearFull > 0 ? formatPercent(mpb.prevYearFull) : '\u2014'}
          prevYearLabel={pyLabel} prevYearFullLabel={pyFullLabel}
          changePercent={yoyChange(kpis.marginPercent ?? 0, mpb.prevYear)} expanded={showDetails}
          subItems={[
            { label: 'This Quarter', value: mpb.thisQuarter > 0 ? formatPercent(mpb.thisQuarter) : '\u2014' },
            { label: 'Last Month', value: mpb.lastMonth > 0 ? formatPercent(mpb.lastMonth) : '\u2014', suffix: mpb.lastMonthName },
            { label: 'Best Month', value: mpb.bestMonth.value > 0 ? formatPercent(mpb.bestMonth.value) : '\u2014', suffix: mpb.bestMonth.name },
          ]}
          onExpand={() => openModal('Margin %', <KPIModalContent value={kpis.marginPercent === null ? '\u2014' : formatPercent(kpis.marginPercent)} changePercent={yoyChange(kpis.marginPercent ?? 0, mpb.prevYear)} prevYearValue={mpb.prevYear > 0 ? formatPercent(mpb.prevYear) : '\u2014'} prevYearFullValue={mpb.prevYearFull > 0 ? formatPercent(mpb.prevYearFull) : '\u2014'} prevYearLabel={pyLabel} prevYearFullLabel={pyFullLabel} subItems={[{ label: 'This Quarter', value: mpb.thisQuarter > 0 ? formatPercent(mpb.thisQuarter) : '\u2014' }, { label: 'Last Month', value: mpb.lastMonth > 0 ? formatPercent(mpb.lastMonth) : '\u2014', suffix: mpb.lastMonthName }, { label: 'Best Month', value: mpb.bestMonth.value > 0 ? formatPercent(mpb.bestMonth.value) : '\u2014', suffix: mpb.bestMonth.name }]} />)}
        />

        {/* 4. Margin $ */}
        <KPICard
          label="Margin $" periodLabel={pLabel} value={kpis.marginAmount}
          formatter={(n) => formatCurrency(Math.round(n))}
          prevYearValue={formatCurrency(Math.round(mab.prevYear))}
          prevYearFullValue={formatCurrency(Math.round(mab.prevYearFull))}
          prevYearLabel={pyLabel} prevYearFullLabel={pyFullLabel}
          changePercent={yoyChange(kpis.marginAmount, mab.prevYear)} expanded={showDetails}
          subItems={[
            { label: 'This Quarter', value: formatCurrency(Math.round(mab.thisQuarter)) },
            { label: 'Last Month', value: formatCurrency(Math.round(mab.lastMonth)), suffix: mab.lastMonthName },
            { label: 'Best Month', value: formatCurrency(Math.round(mab.bestMonth.value)), suffix: mab.bestMonth.name },
          ]}
          onExpand={() => openModal('Margin $', <KPIModalContent value={formatCurrency(Math.round(kpis.marginAmount))} changePercent={yoyChange(kpis.marginAmount, mab.prevYear)} prevYearValue={formatCurrency(Math.round(mab.prevYear))} prevYearFullValue={formatCurrency(Math.round(mab.prevYearFull))} prevYearLabel={pyLabel} prevYearFullLabel={pyFullLabel} subItems={[{ label: 'This Quarter', value: formatCurrency(Math.round(mab.thisQuarter)) }, { label: 'Last Month', value: formatCurrency(Math.round(mab.lastMonth)), suffix: mab.lastMonthName }, { label: 'Best Month', value: formatCurrency(Math.round(mab.bestMonth.value)), suffix: mab.bestMonth.name }]} />)}
        />

        {/* 5. Frequency */}
        <KPICard
          label="Frequency" periodLabel={pLabel} value={kpis.frequency ?? 0}
          formatter={(n) => kpis.frequency === null ? '\u2014' : formatFrequency(n)}
          prevYearValue={fb.prevYear > 0 ? formatFrequency(fb.prevYear) : '\u2014'}
          prevYearFullValue={fb.prevYearFull > 0 ? formatFrequency(fb.prevYearFull) : '\u2014'}
          prevYearLabel={pyLabel} prevYearFullLabel={pyFullLabel}
          changePercent={yoyChange(kpis.frequency ?? 0, fb.prevYear)} expanded={showDetails}
          subItems={[
            { label: 'This Quarter', value: fb.thisQuarter > 0 ? formatFrequency(fb.thisQuarter) : '\u2014' },
            { label: 'Last Month', value: Math.round(fb.lastMonth).toLocaleString('en-US'), suffix: fb.lastMonthName },
            { label: 'Best Month', value: Math.round(fb.bestMonth.value).toLocaleString('en-US'), suffix: fb.bestMonth.name },
          ]}
          onExpand={() => openModal('Frequency', <KPIModalContent value={kpis.frequency === null ? '\u2014' : formatFrequency(kpis.frequency)} changePercent={yoyChange(kpis.frequency ?? 0, fb.prevYear)} prevYearValue={fb.prevYear > 0 ? formatFrequency(fb.prevYear) : '\u2014'} prevYearFullValue={fb.prevYearFull > 0 ? formatFrequency(fb.prevYearFull) : '\u2014'} prevYearLabel={pyLabel} prevYearFullLabel={pyFullLabel} subItems={[{ label: 'This Quarter', value: fb.thisQuarter > 0 ? formatFrequency(fb.thisQuarter) : '\u2014' }, { label: 'Last Month', value: Math.round(fb.lastMonth).toLocaleString('en-US'), suffix: fb.lastMonthName }, { label: 'Best Month', value: Math.round(fb.bestMonth.value).toLocaleString('en-US'), suffix: fb.bestMonth.name }]} />)}
        />

        {/* 6. Last Order — activity status dot per spec 10.3 */}
        <KPICard
          label="Last Order" periodLabel="" value={kpis.lastOrderDays ?? 0}
          formatter={(n) => kpis.lastOrderDays === null ? 'No orders' : formatDays(Math.round(n))}
          statusDot={activity}
          onExpand={() => openModal('Last Order', <KPIModalContent value={kpis.lastOrderDays === null ? 'No orders' : formatDays(Math.round(kpis.lastOrderDays))} />)}
        />
      </div>
    </div>

    {/* Toggle button — centered pill below the KPI grid */}
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
