// FILE: client/src/components/right-panel/RightPanel.tsx
// PURPOSE: Right panel container — header, KPIs, charts, tabs with real data
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: RightPanel

import type {
  EntityListItem, KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType,
  TopSellerItem, SparklineData, OrderRow, ItemCategory, Contact, Period,
} from '@shared/types/dashboard';
import { DetailHeader } from './DetailHeader';
import { KPISection } from './KPISection';
import { ChartsRow } from './ChartsRow';
import { TabsSection } from './TabsSection';

interface RightPanelProps {
  entity: EntityListItem | null;
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: ItemCategory[];
  contacts: Contact[];
  yearsAvailable: string[];
  activePeriod: Period;
  onPeriodChange: (period: Period) => void;
  onExport: () => void;
}

export function RightPanel({
  entity, kpis, monthlyRevenue, productMixes, topSellers,
  sparklines, orders, items, contacts, yearsAvailable, activePeriod,
  onPeriodChange, onExport,
}: RightPanelProps) {
  return (
    <>
      <DetailHeader
        entity={entity}
        activePeriod={activePeriod}
        yearsAvailable={yearsAvailable}
        onPeriodChange={onPeriodChange}
        onExport={onExport}
      />
      <KPISection
        kpis={kpis}
        monthlyRevenue={monthlyRevenue}
        sparklines={sparklines}
        activePeriod={activePeriod}
      />
      <ChartsRow productMixes={productMixes} topSellers={topSellers} />
      <TabsSection orders={orders} items={items} contacts={contacts} />
    </>
  );
}
