// FILE: client/src/components/right-panel/RightPanel.tsx
// PURPOSE: Right panel container — header, KPIs, charts, tabs with real data
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: RightPanel

import type {
  EntityListItem, KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType,
  TopSellerItem, SparklineData, OrderRow, FlatItem, Contact, Period, Dimension,
} from '@shared/types/dashboard';
import type { DetailTab } from './detail-tab-types';
import { DetailHeader } from './DetailHeader';
import { KPISection } from './KPISection';
import { ChartsRow } from './ChartsRow';
import { TabsSection } from './TabsSection';

interface RightPanelProps {
  entity: EntityListItem | null;
  activeDimension?: Dimension;
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
  consolidatedMode?: boolean;
  consolidatedEntities?: EntityListItem[];
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
  hideDetailHeader?: boolean;
}

export function RightPanel({
  entity, activeDimension = 'customer', kpis, monthlyRevenue, productMixes, topSellers,
  sparklines, orders, items, contacts, yearsAvailable, activePeriod, activeTab,
  onPeriodChange, onTabChange, onExport,
  consolidatedMode, consolidatedEntities, perEntityProductMixes, perEntityTopSellers, hideDetailHeader,
}: RightPanelProps) {
  return (
    <>
      {!hideDetailHeader && (
        <DetailHeader
          entity={entity} activeDimension={activeDimension} activePeriod={activePeriod} yearsAvailable={yearsAvailable}
          onPeriodChange={onPeriodChange} onExport={onExport}
        />
      )}
      <section aria-label="KPI summary">
        <KPISection
          kpis={kpis} monthlyRevenue={monthlyRevenue} sparklines={sparklines}
          activePeriod={activePeriod}
          consolidatedEntities={consolidatedEntities}
        />
      </section>
      <section aria-label="Charts">
        <ChartsRow
          productMixes={productMixes}
          topSellers={topSellers}
          consolidatedEntities={consolidatedEntities}
          perEntityProductMixes={perEntityProductMixes}
          perEntityTopSellers={perEntityTopSellers}
        />
      </section>
      <TabsSection
        activeTab={activeTab} onTabChange={onTabChange}
        orders={orders} items={items} contacts={contacts}
        consolidatedMode={consolidatedMode}
      />
    </>
  );
}
