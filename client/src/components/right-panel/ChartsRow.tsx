// FILE: client/src/components/right-panel/ChartsRow.tsx
// PURPOSE: CSS Grid row containing Product Mix carousel (3fr) and Best Sellers list (5fr)
// USED BY: client/src/components/right-panel/RightPanel.tsx
// EXPORTS: ChartsRow

import { useState, useCallback, useEffect } from 'react';
import type { ProductMixSegment, ProductMixType, TopSellerItem, EntityListItem } from '@shared/types/dashboard';
import { ProductMixCarousel, ProductMixExpanded } from './ProductMixCarousel';
import { BestSellers, BestSellersExpanded } from './BestSellers';
import { useModal } from '../shared/ModalProvider';
import { PerCustomerToggle, type PerCustomerMode } from './PerCustomerToggle';
import { PerCustomerChartTable } from './PerCustomerChartTable';
import { BestSellersTopNSelector, type TopNValue } from './BestSellersTopNSelector';
import { BestSellersExportButton } from './BestSellersExportButton';
import type { BestSellersExportRequest } from '@shared/types/dashboard';

interface ChartsRowProps {
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
  /** WHY: Enables per-customer toggle in modals when in consolidated mode */
  consolidatedEntities?: EntityListItem[];
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
  /** WHY: needed by the Best Sellers Excel export to populate the workbook title + filename. */
  entityContext?: {
    entityType: BestSellersExportRequest['context']['entityType'];
    entityLabel: string;
    dateRangeLabel: string;
  };
}

interface ProductMixExpandedWithToggleProps {
  mixes: Record<ProductMixType, ProductMixSegment[]>;
  consolidatedEntities?: EntityListItem[];
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
}

function ProductMixExpandedWithToggle({ mixes, consolidatedEntities, perEntityProductMixes }: ProductMixExpandedWithToggleProps) {
  const [mode, setMode] = useState<PerCustomerMode>('aggregated');
  const showToggle = !!consolidatedEntities && !!perEntityProductMixes;

  if (!showToggle) {
    return <ProductMixExpanded mixes={mixes} />;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      <div className="flex justify-end">
        <PerCustomerToggle mode={mode} onChange={setMode} />
      </div>
      {mode === 'aggregated' ? (
        <ProductMixExpanded mixes={mixes} />
      ) : (
        <PerCustomerChartTable
          mode="product-mix"
          entities={consolidatedEntities!}
          perEntityProductMixes={perEntityProductMixes}
          productMixType="brand"
        />
      )}
    </div>
  );
}

interface BestSellersModalContentProps {
  data: TopSellerItem[];
  consolidatedEntities?: EntityListItem[];
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
  entityContext?: ChartsRowProps['entityContext'];
}

/** WHY: lives as long as the modal is open. Owns topN state. Renders the body inline and
 *  pushes the toolbar (selector + export button) into the modal header via setHeaderActions
 *  whenever topN changes. The toolbar and body share state because they originate from
 *  the same component instance. */
function BestSellersModalContent({
  data,
  consolidatedEntities,
  perEntityTopSellers,
  entityContext,
}: BestSellersModalContentProps) {
  const { setHeaderActions } = useModal();
  const [topN, setTopN] = useState<TopNValue>(20);
  const [mode, setMode] = useState<PerCustomerMode>('aggregated');

  const filtered = data.filter(item => item.revenue > 0);
  const showToggle = !!consolidatedEntities && !!perEntityTopSellers;

  /** WHY: keep header toolbar in sync with topN. Cleanup clears the toolbar on unmount so
   *  the next modal (e.g. Product Mix) doesn't inherit a stale Best Sellers toolbar. */
  useEffect(() => {
    const actions = (
      <>
        <BestSellersTopNSelector
          value={topN}
          onChange={setTopN}
          available={filtered.length}
        />
        {entityContext && (
          <BestSellersExportButton
            rows={filtered.slice(0, topN)}
            context={{ ...entityContext, topN }}
          />
        )}
      </>
    );
    setHeaderActions(actions);
    return () => setHeaderActions(null);
  }, [topN, filtered, entityContext, setHeaderActions]);

  if (!showToggle) {
    return <BestSellersExpanded data={data} topN={topN} />;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      <div className="flex justify-end">
        <PerCustomerToggle mode={mode} onChange={setMode} />
      </div>
      {mode === 'aggregated' ? (
        <BestSellersExpanded data={data} topN={topN} />
      ) : (
        <PerCustomerChartTable
          mode="top-sellers"
          entities={consolidatedEntities!}
          perEntityTopSellers={perEntityTopSellers}
        />
      )}
    </div>
  );
}

interface BestSellersCardProps {
  data: TopSellerItem[];
  consolidatedEntities?: EntityListItem[];
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
  entityContext?: ChartsRowProps['entityContext'];
}

function BestSellersCard({ data, consolidatedEntities, perEntityTopSellers, entityContext }: BestSellersCardProps) {
  const { openModal } = useModal();

  const open = useCallback(() => {
    openModal(
      'Best Sellers',
      <BestSellersModalContent
        data={data}
        consolidatedEntities={consolidatedEntities}
        perEntityTopSellers={perEntityTopSellers}
        entityContext={entityContext}
      />,
    );
  }, [data, consolidatedEntities, perEntityTopSellers, entityContext, openModal]);

  return (
    <div
      className="group relative flex cursor-pointer flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
    >
      <BestSellers data={data} />
    </div>
  );
}

export function ChartsRow({
  productMixes,
  topSellers,
  consolidatedEntities,
  perEntityProductMixes,
  perEntityTopSellers,
  entityContext,
}: ChartsRowProps) {
  const { openModal } = useModal();

  return (
    <div className="grid grid-cols-[3fr_5fr] gap-[var(--spacing-lg)] max-lg:grid-cols-1">
      {/* Product Mix card — unchanged: keep the existing div + onClick + onKeyDown block here */}
      <div
        className="group relative flex cursor-pointer flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        onClick={() => {
          openModal('Product Mix', (
            <ProductMixExpandedWithToggle
              mixes={productMixes}
              consolidatedEntities={consolidatedEntities}
              perEntityProductMixes={perEntityProductMixes}
            />
          ));
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal('Product Mix', (
              <ProductMixExpandedWithToggle
                mixes={productMixes}
                consolidatedEntities={consolidatedEntities}
                perEntityProductMixes={perEntityProductMixes}
              />
            ));
          }
        }}
      >
        <ProductMixCarousel mixes={productMixes} />
      </div>

      {/* Best Sellers card — now its own component */}
      <BestSellersCard
        data={topSellers}
        consolidatedEntities={consolidatedEntities}
        perEntityTopSellers={perEntityTopSellers}
        entityContext={entityContext}
      />
    </div>
  );
}
