// FILE: client/src/components/right-panel/RightPanel.tsx
// PURPOSE: Right panel container — header, KPIs, charts, tabs with real data
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: RightPanel

import { useMemo } from 'react';
import type {
  EntityListItem, KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType,
  TopSellerItem, SparklineData, OrderRow, FlatItem, Contact, Period, Dimension,
  BestSellersExportRequest,
} from '@shared/types/dashboard';
import { DIMENSION_PLURAL_LABELS } from '@shared/types/dashboard';
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
  activePeriod: Period;
  activeTab: DetailTab;
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
  sparklines, orders, items, contacts, activePeriod, activeTab,
  onTabChange, onExport,
  consolidatedMode, consolidatedEntities, perEntityProductMixes, perEntityTopSellers, hideDetailHeader,
}: RightPanelProps) {
  /** WHY: Best Sellers Excel export needs a human-readable entity label + date range
   *  for the workbook title row, subtitle row, and download filename. Composed from
   *  existing in-scope state — no new global plumbing. */
  const entityContext = useMemo<{
    entityType: BestSellersExportRequest['context']['entityType'];
    entityLabel: string;
    dateRangeLabel: string;
  }>(() => {
    const entityType: BestSellersExportRequest['context']['entityType'] = activeDimension;
    let entityLabel: string;
    if (entity?.name) {
      entityLabel = entity.name;
    } else if (consolidatedEntities && consolidatedEntities.length > 0) {
      entityLabel = `${consolidatedEntities.length} selected ${DIMENSION_PLURAL_LABELS[activeDimension]}`;
    } else {
      entityLabel = `All ${DIMENSION_PLURAL_LABELS[activeDimension]}`;
    }
    const dateRangeLabel = activePeriod === 'ytd'
      ? `YTD ${new Date().getUTCFullYear()}`
      : activePeriod;
    return { entityType, entityLabel, dateRangeLabel };
  }, [activeDimension, entity, consolidatedEntities, activePeriod]);

  return (
    <>
      {!hideDetailHeader && (
        <DetailHeader
          entity={entity} activeDimension={activeDimension} onExport={onExport}
        />
      )}
      <section aria-label="KPI summary">
        <KPISection
          kpis={kpis} monthlyRevenue={monthlyRevenue} sparklines={sparklines}
          activePeriod={activePeriod}
          activeDimension={activeDimension}
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
          entityContext={entityContext}
        />
      </section>
      <TabsSection
        activeTab={activeTab} onTabChange={onTabChange}
        orders={orders} items={items} contacts={contacts}
        consolidatedMode={consolidatedMode}
        dimension={activeDimension}
      />
    </>
  );
}
