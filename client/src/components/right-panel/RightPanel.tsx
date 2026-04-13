// FILE: client/src/components/right-panel/RightPanel.tsx
// PURPOSE: Right panel container — header, KPIs, charts, tabs with real data
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: RightPanel

import type {
  EntityListItem, KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType,
  TopSellerItem, SparklineData, OrderRow, FlatItem, Contact, Period,
} from '@shared/types/dashboard';
import type { LayoutPreset } from '../../hooks/useDashboardLayout';
import type { DetailTab } from './detail-tab-types';
import { DetailHeader } from './DetailHeader';
import { KPISection } from './KPISection';
import { ChartsRow } from './ChartsRow';
import { TabsSection } from './TabsSection';
import { useResizablePanel } from '../../hooks/useResizablePanel';
import { ResizeDivider } from './ResizeDivider';

interface RightPanelProps {
  entity: EntityListItem | null;
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: FlatItem[];
  contacts: Contact[];
  yearsAvailable: string[];
  activePeriod: Period;
  activeTab: DetailTab;
  onPeriodChange: (period: Period) => void;
  onTabChange: (tab: DetailTab) => void;
  onExport: () => void;
  heroKpiGridTemplate: string;
  heroKpiRatio: [number, number];
  kpiChartsRatio: [number, number];
  onHeroKpiRatioChange: (ratio: [number, number]) => void;
  onKpiChartsRatioChange: (ratio: [number, number]) => void;
  activePreset: LayoutPreset;
  onPresetChange: (preset: Exclude<LayoutPreset, 'custom'>) => void;
  onResetLayout: () => void;
}

export function RightPanel({
  entity, kpis, monthlyRevenue, productMixes, topSellers,
  sparklines, orders, items, contacts, yearsAvailable, activePeriod, activeTab,
  onPeriodChange, onTabChange, onExport, heroKpiGridTemplate, heroKpiRatio, kpiChartsRatio,
  onHeroKpiRatioChange, onKpiChartsRatioChange,
  activePreset, onPresetChange, onResetLayout,
}: RightPanelProps) {
  const { containerRef: vertRef, isDragging: vertDragging, handleMouseDown: vertMouseDown } = useResizablePanel({
    direction: 'vertical',
    defaultRatio: kpiChartsRatio,
    minPercent: 25,
    maxPercent: 75,
    onRatioChange: onKpiChartsRatioChange,
  });

  return (
    <>
      <DetailHeader
        entity={entity} activePeriod={activePeriod} yearsAvailable={yearsAvailable}
        onPeriodChange={onPeriodChange} onExport={onExport}
        activePreset={activePreset} onPresetChange={onPresetChange} onResetLayout={onResetLayout}
      />
      <div ref={vertRef} className="flex flex-1 flex-col gap-0 min-h-0">
        <section style={{ flex: `${kpiChartsRatio[0]} 1 0%` }} className="min-h-[200px] overflow-hidden" aria-label="KPI summary">
          <KPISection
            kpis={kpis} monthlyRevenue={monthlyRevenue} sparklines={sparklines}
            activePeriod={activePeriod} heroKpiGridTemplate={heroKpiGridTemplate}
            heroKpiRatio={heroKpiRatio} onHeroKpiRatioChange={onHeroKpiRatioChange}
          />
        </section>
        <ResizeDivider direction="vertical" isDragging={vertDragging} onMouseDown={vertMouseDown} onTouchStart={vertMouseDown} />
        <section style={{ flex: `${kpiChartsRatio[1]} 1 0%` }} className="min-h-[200px] overflow-hidden" aria-label="Charts">
          <ChartsRow productMixes={productMixes} topSellers={topSellers} />
        </section>
      </div>
      <TabsSection activeTab={activeTab} onTabChange={onTabChange} orders={orders} items={items} contacts={contacts} />
    </>
  );
}
