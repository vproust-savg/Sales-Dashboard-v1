// FILE: client/src/components/right-panel/ChartsRow.tsx
// PURPOSE: CSS Grid row containing Product Mix carousel (3fr) and Best Sellers list (5fr)
// USED BY: client/src/components/right-panel/RightPanel.tsx
// EXPORTS: ChartsRow

import { useState } from 'react';
import type { ProductMixSegment, ProductMixType, TopSellerItem, EntityListItem } from '@shared/types/dashboard';
import { ProductMixCarousel, ProductMixExpanded } from './ProductMixCarousel';
import { BestSellers, BestSellersExpanded } from './BestSellers';
import { useModal } from '../shared/ModalProvider';
import { PerCustomerToggle, type PerCustomerMode } from './PerCustomerToggle';
import { PerCustomerChartTable } from './PerCustomerChartTable';

interface ChartsRowProps {
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
  /** WHY: Enables per-customer toggle in modals when in consolidated mode */
  consolidatedEntities?: EntityListItem[];
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
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

interface BestSellersExpandedWithToggleProps {
  data: TopSellerItem[];
  consolidatedEntities?: EntityListItem[];
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
}

function BestSellersExpandedWithToggle({ data, consolidatedEntities, perEntityTopSellers }: BestSellersExpandedWithToggleProps) {
  const [mode, setMode] = useState<PerCustomerMode>('aggregated');
  const showToggle = !!consolidatedEntities && !!perEntityTopSellers;

  if (!showToggle) {
    return <BestSellersExpanded data={data} />;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      <div className="flex justify-end">
        <PerCustomerToggle mode={mode} onChange={setMode} />
      </div>
      {mode === 'aggregated' ? (
        <BestSellersExpanded data={data} />
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

export function ChartsRow({ productMixes, topSellers, consolidatedEntities, perEntityProductMixes, perEntityTopSellers }: ChartsRowProps) {
  const { openModal } = useModal();

  return (
    <div className="grid grid-cols-[3fr_5fr] gap-[var(--spacing-lg)] max-lg:grid-cols-1">
      {/* Product Mix carousel card */}
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

      {/* Best Sellers card */}
      <div
        className="group relative flex cursor-pointer flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        onClick={() => {
          openModal('Best Sellers', (
            <BestSellersExpandedWithToggle
              data={topSellers}
              consolidatedEntities={consolidatedEntities}
              perEntityTopSellers={perEntityTopSellers}
            />
          ));
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal('Best Sellers', (
              <BestSellersExpandedWithToggle
                data={topSellers}
                consolidatedEntities={consolidatedEntities}
                perEntityTopSellers={perEntityTopSellers}
              />
            ));
          }
        }}
      >
        <BestSellers data={topSellers} />
      </div>
    </div>
  );
}
