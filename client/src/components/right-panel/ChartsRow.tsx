// FILE: client/src/components/right-panel/ChartsRow.tsx
// PURPOSE: CSS Grid row containing Product Mix carousel (3fr) and Best Sellers list (5fr)
// USED BY: client/src/components/right-panel/RightPanel.tsx
// EXPORTS: ChartsRow

import type { ProductMixSegment, ProductMixType, TopSellerItem } from '@shared/types/dashboard';
import { formatCurrency } from '@shared/utils/formatting';
import { PRODUCT_MIX_LABELS, PRODUCT_MIX_ORDER } from '@shared/types/dashboard';
import { ProductMixCarousel, ProductMixExpanded } from './ProductMixCarousel';
import { BestSellers, BestSellersExpanded } from './BestSellers';
import { useModal } from '../shared/ModalProvider';
import { ExpandIcon } from '../shared/ExpandIcon';
import { useHoverPeek } from '../../hooks/useHoverPeek';
import { HoverPeek } from '../shared/HoverPeek';

interface ChartsRowProps {
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
}

export function ChartsRow({ productMixes, topSellers }: ChartsRowProps) {
  const { openModal } = useModal();
  const mixPeek = useHoverPeek();
  const sellersPeek = useHoverPeek();

  /** WHY: Show first mix type in peek — simple summary without carousel */
  const firstMixType = PRODUCT_MIX_ORDER[0];
  const firstMixSegments = productMixes[firstMixType] ?? [];
  const top5Sellers = topSellers.filter(s => s.revenue > 0).slice(0, 5);

  return (
    <div className="grid grid-cols-[3fr_5fr] gap-[var(--spacing-lg)] max-lg:grid-cols-1">
      {/* Product Mix carousel card */}
      <div
        ref={mixPeek.triggerRef}
        onMouseEnter={mixPeek.onMouseEnter}
        onMouseLeave={mixPeek.onMouseLeave}
        className="group relative flex cursor-pointer flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        onClick={() => { mixPeek.onMouseLeave(); openModal('Product Mix', <ProductMixExpanded mixes={productMixes} />); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') openModal('Product Mix', <ProductMixExpanded mixes={productMixes} />); }}
      >
        <ExpandIcon />
        <ProductMixCarousel mixes={productMixes} />
      </div>
      <HoverPeek isVisible={mixPeek.isVisible} position={mixPeek.position} onMouseEnter={mixPeek.onPeekMouseEnter} onMouseLeave={mixPeek.onPeekMouseLeave}>
        <div className="flex flex-col gap-[var(--spacing-md)]">
          <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-muted)]">Product Mix — {PRODUCT_MIX_LABELS[firstMixType]}</span>
          {firstMixSegments.slice(0, 5).map((seg) => (
            <div key={seg.category} className="flex items-center justify-between gap-[var(--spacing-md)] text-[13px]">
              <span className="text-[var(--color-text-primary)]">{seg.category}</span>
              <span className="font-semibold tabular-nums text-[var(--color-text-secondary)]">{seg.percentage}%</span>
            </div>
          ))}
        </div>
      </HoverPeek>

      {/* Best Sellers card */}
      <div
        ref={sellersPeek.triggerRef}
        onMouseEnter={sellersPeek.onMouseEnter}
        onMouseLeave={sellersPeek.onMouseLeave}
        className="group relative flex cursor-pointer flex-col rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-3xl)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        onClick={() => { sellersPeek.onMouseLeave(); openModal('Best Sellers', <BestSellersExpanded data={topSellers} />); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') openModal('Best Sellers', <BestSellersExpanded data={topSellers} />); }}
      >
        <ExpandIcon />
        <BestSellers data={topSellers} />
      </div>
      <HoverPeek isVisible={sellersPeek.isVisible} position={sellersPeek.position} onMouseEnter={sellersPeek.onPeekMouseEnter} onMouseLeave={sellersPeek.onPeekMouseLeave}>
        <div className="flex flex-col gap-[var(--spacing-xs)]">
          <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--color-text-muted)]">Top 5 Best Sellers</span>
          {top5Sellers.map((item) => (
            <div key={item.sku} className="flex items-center justify-between gap-[var(--spacing-md)] text-[13px]">
              <span className="truncate text-[var(--color-text-primary)]">{item.rank}. {item.name}</span>
              <span className="shrink-0 font-semibold tabular-nums text-[var(--color-text-secondary)]">{formatCurrency(item.revenue)}</span>
            </div>
          ))}
        </div>
      </HoverPeek>
    </div>
  );
}
