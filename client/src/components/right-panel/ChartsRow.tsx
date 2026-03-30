// FILE: client/src/components/right-panel/ChartsRow.tsx
// PURPOSE: CSS Grid row containing Product Mix donut (3fr) and Top 10 list (5fr)
// USED BY: client/src/components/right-panel/RightPanel.tsx
// EXPORTS: ChartsRow

import type { ProductMixSegment, TopSellerItem } from '@shared/types/dashboard';
import { ProductMixDonut } from './ProductMixDonut';
import { TopTenBestSellers } from './TopTenBestSellers';

interface ChartsRowProps {
  productMix: ProductMixSegment[];
  topSellers: TopSellerItem[];
}

export function ChartsRow({ productMix, topSellers }: ChartsRowProps) {
  return (
    <div className="grid grid-cols-[3fr_5fr] gap-[var(--spacing-lg)]">
      {/* Product Mix donut card — spec: 16px 20px padding, border-radius 16px */}
      <div className="flex flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
        <h2 className="mb-[var(--spacing-lg)] text-[14px] font-semibold text-[var(--color-text-primary)]">
          Product Mix
        </h2>
        <div className="flex flex-1 items-center justify-center">
          <ProductMixDonut data={productMix} />
        </div>
      </div>

      {/* Top 10 Best Sellers card */}
      <div className="flex flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
        <h2 className="mb-[var(--spacing-lg)] text-[14px] font-semibold text-[var(--color-text-primary)]">
          Top 10 Best Sellers
        </h2>
        <TopTenBestSellers data={topSellers} />
      </div>
    </div>
  );
}
