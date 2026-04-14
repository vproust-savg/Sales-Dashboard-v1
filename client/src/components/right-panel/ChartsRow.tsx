// FILE: client/src/components/right-panel/ChartsRow.tsx
// PURPOSE: CSS Grid row containing Product Mix carousel (3fr) and Best Sellers list (5fr)
// USED BY: client/src/components/right-panel/RightPanel.tsx
// EXPORTS: ChartsRow

import type { ProductMixSegment, ProductMixType, TopSellerItem } from '@shared/types/dashboard';
import { ProductMixCarousel, ProductMixExpanded } from './ProductMixCarousel';
import { BestSellers, BestSellersExpanded } from './BestSellers';
import { useModal } from '../shared/ModalProvider';

interface ChartsRowProps {
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
}

export function ChartsRow({ productMixes, topSellers }: ChartsRowProps) {
  const { openModal } = useModal();

  return (
    <div className="grid grid-cols-[3fr_5fr] gap-[var(--spacing-lg)] max-lg:grid-cols-1">
      {/* Product Mix carousel card */}
      <div
        className="group relative flex cursor-pointer flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        onClick={() => { openModal('Product Mix', <ProductMixExpanded mixes={productMixes} />); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal('Product Mix', <ProductMixExpanded mixes={productMixes} />);
          }
        }}
      >
        <ProductMixCarousel mixes={productMixes} />
      </div>

      {/* Best Sellers card */}
      <div
        className="group relative flex cursor-pointer flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        onClick={() => { openModal('Best Sellers', <BestSellersExpanded data={topSellers} />); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal('Best Sellers', <BestSellersExpanded data={topSellers} />);
          }
        }}
      >
        <BestSellers data={topSellers} />
      </div>
    </div>
  );
}
