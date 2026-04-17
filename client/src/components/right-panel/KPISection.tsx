// FILE: client/src/components/right-panel/KPISection.tsx
// PURPOSE: CSS Grid layout — hero revenue card (left) + 2x3 KPI card grid (right)
// USED BY: RightPanel.tsx
// EXPORTS: KPISection

import { useState } from 'react';
import type { KPIs, MonthlyRevenue, SparklineData, Period, EntityListItem, Dimension } from '@shared/types/dashboard';
import { DIMENSION_SINGULAR_LABELS } from '@shared/types/dashboard';
import { formatDays } from '@shared/utils/formatting';
import { HeroRevenueCard } from './HeroRevenueCard';
import { KPICard } from './KPICard';
import { useModal } from '../shared/ModalProvider';
import { KPIModalContent, HeroRevenueModalContent } from './kpi-modal-content';
import { useCardNavigation } from '../../hooks/useCardNavigation';
import {
  KPI_CONFIGS,
  nullableFmt,
  roundCurrency,
  getActivityStatus,
  yoyChange,
} from './ConsolidatedKPISection';

interface KPISectionProps {
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  sparklines: Record<string, SparklineData>;
  activePeriod: Period;
  activeDimension?: Dimension;
  /** WHY: When set, KPI modals render the per-customer toggle and table */
  consolidatedEntities?: EntityListItem[];
}


export function KPISection({
  kpis,
  monthlyRevenue,
  sparklines: _sparklines,
  activePeriod,
  activeDimension = 'customer',
  consolidatedEntities,
}: KPISectionProps) {
  const entityLabel = DIMENSION_SINGULAR_LABELS[activeDimension];
  const [showDetails, setShowDetails] = useState(false);
  const { openModal } = useModal();
  const { setCardRef, onCardFocus, onCardBlur } = useCardNavigation(7);
  const activity = getActivityStatus(kpis.lastOrderDays);
  const pLabel = activePeriod === 'ytd' ? '(YTD)' : `(${activePeriod})`;
  const prevYr = activePeriod === 'ytd' ? new Date().getFullYear() - 1 : parseInt(activePeriod, 10) - 1;
  const pyLabel = activePeriod === 'ytd' ? `YTD ${prevYr}` : `${prevYr}`;
  const pyFullLabel = `Full ${prevYr}`;

  return (
    <div className="flex flex-col gap-[var(--spacing-sm)]" role="grid" aria-label="KPI cards">
      <div className="grid grid-cols-[3fr_2fr] gap-[var(--spacing-sm)] max-lg:grid-cols-1 max-lg:gap-[var(--spacing-base)]">
        <HeroRevenueCard
          kpis={kpis}
          monthlyRevenue={monthlyRevenue}
          activePeriod={activePeriod}
          showDetails={showDetails}
          onExpand={() => openModal('Total Revenue', (
            <HeroRevenueModalContent
              kpis={kpis}
              monthlyRevenue={monthlyRevenue}
              entityLabel={entityLabel}
              perCustomer={consolidatedEntities ? {
                entities: consolidatedEntities,
                getValue: (e) => e.revenue,
                getPrevPeriodValue: (e) => e.prevYearRevenue,
                getPrevFullValue: (e) => e.prevYearRevenueFull,
                formatValue: (v) => v == null ? '\u2014' : roundCurrency(v),
              } : undefined}
            />
          ))}
          cardRef={setCardRef(0)}
          onCardFocus={onCardFocus(0)}
          onCardBlur={onCardBlur}
        />
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
                    entityLabel={entityLabel}
                    perCustomer={consolidatedEntities ? {
                      entities: consolidatedEntities,
                      getValue: (e) => {
                        if (cfg.label === 'Orders') return e.orderCount;
                        if (cfg.label === 'Avg. Order') return e.avgOrder;
                        if (cfg.label === 'Margin %') return e.marginPercent;
                        if (cfg.label === 'Margin $') return e.marginAmount;
                        if (cfg.label === 'Frequency') return e.frequency;
                        return null;
                      },
                      getPrevPeriodValue: (e) => {
                        if (cfg.label === 'Orders') return e.prevYearOrderCount;
                        if (cfg.label === 'Avg. Order') return e.prevYearAvgOrder;
                        if (cfg.label === 'Margin %') return e.prevYearMarginPercent;
                        if (cfg.label === 'Margin $') return e.prevYearMarginAmount;
                        if (cfg.label === 'Frequency') return e.prevYearFrequency;
                        return null;
                      },
                      getPrevFullValue: (e) => {
                        if (cfg.label === 'Orders') return e.prevYearOrderCountFull;
                        if (cfg.label === 'Avg. Order') return e.prevYearAvgOrderFull;
                        if (cfg.label === 'Margin %') return e.prevYearMarginPercentFull;
                        if (cfg.label === 'Margin $') return e.prevYearMarginAmountFull;
                        if (cfg.label === 'Frequency') return e.prevYearFrequencyFull;
                        return null;
                      },
                      formatValue: (v) => v == null ? '\u2014' : cfg.formatter(v),
                      valueLabel: cfg.label,
                    } : undefined}
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
              <KPIModalContent
                value={kpis.lastOrderDays === null ? 'No orders' : formatDays(Math.round(kpis.lastOrderDays))}
                entityLabel={entityLabel}
                perCustomer={consolidatedEntities ? {
                  entities: consolidatedEntities,
                  getValue: (e) => {
                    if (!e.lastOrderDate) return null;
                    const diff = (Date.now() - new Date(e.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24);
                    return Math.round(diff);
                  },
                  /** WHY: No prev-year last-order date on EntityListItem — these columns show —. */
                  getPrevPeriodValue: () => null,
                  getPrevFullValue: () => null,
                  formatValue: (d) => d == null ? '\u2014' : `${d}d`,
                  valueLabel: 'Days ago',
                  invertedTrend: true,
                } : undefined}
              />
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
