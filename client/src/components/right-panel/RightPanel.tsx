// FILE: client/src/components/right-panel/RightPanel.tsx
// PURPOSE: Right panel container — header, KPIs, charts, tabs
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: RightPanel

import type {
  EntityListItem, KPIs, MonthlyRevenue, ProductMixSegment,
  TopSellerItem, SparklineData, OrderRow, ItemCategory, Contact, Period,
} from '@shared/types/dashboard';
import { DetailHeader } from './DetailHeader';
import { KPISection } from './KPISection';
import { ChartsRow } from './ChartsRow';

interface RightPanelProps {
  entity: EntityListItem | null;
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMix: ProductMixSegment[];
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: ItemCategory[];
  contacts: Contact[];
  yearsAvailable: string[];
  activePeriod: Period;
}

export function RightPanel({
  entity, kpis, monthlyRevenue, productMix, topSellers,
  sparklines, yearsAvailable, activePeriod,
}: RightPanelProps) {
  return (
    <>
      <DetailHeader
        entity={entity}
        activePeriod={activePeriod}
        yearsAvailable={yearsAvailable}
        onPeriodChange={() => {/* WHY no-op: wired in Plan C with state management */}}
        onExport={() => {/* WHY no-op: wired in Plan C */}}
      />
      <KPISection
        kpis={kpis}
        monthlyRevenue={monthlyRevenue}
        sparklines={sparklines}
      />
      <ChartsRow productMix={productMix} topSellers={topSellers} />
      <div className="flex-1 rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)]">
        <p className="p-4 text-xs text-[var(--color-text-muted)]">TabsSection</p>
      </div>
    </>
  );
}
