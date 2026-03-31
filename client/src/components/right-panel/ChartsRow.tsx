// FILE: client/src/components/right-panel/ChartsRow.tsx
// PURPOSE: CSS Grid row containing Product Mix carousel (3fr) and Best Sellers list (5fr)
// USED BY: client/src/components/right-panel/RightPanel.tsx
// EXPORTS: ChartsRow

import type { ProductMixSegment, ProductMixType, TopSellerItem } from '@shared/types/dashboard';
import { ProductMixCarousel } from './ProductMixCarousel';
import { BestSellers } from './BestSellers';

interface ChartsRowProps {
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
}

export function ChartsRow({ productMixes, topSellers }: ChartsRowProps) {
  return (
    <div className="grid grid-cols-[3fr_5fr] gap-[var(--spacing-lg)] max-lg:grid-cols-1">
      {/* Product Mix carousel card */}
      <div className="flex flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
        <ProductMixCarousel mixes={productMixes} />
      </div>

      {/* Best Sellers card — title + arrows are inside BestSellers component */}
      <div className="flex flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
        <BestSellers data={topSellers} />
      </div>
    </div>
  );
}
