// FILE: client/src/components/right-panel/TopTenBestSellers.tsx
// PURPOSE: Two-column ranked list of top 10 products by revenue
// USED BY: client/src/components/right-panel/ChartsRow.tsx
// EXPORTS: TopTenBestSellers

import type { TopSellerItem } from '@shared/types/dashboard';
import { formatCurrency } from '@shared/utils/formatting';

interface TopTenBestSellersProps {
  data: TopSellerItem[];
}

/** WHY gold vs neutral: spec says top 3 get gold badges, 4-10 get neutral */
function rankBadgeClasses(rank: number): string {
  if (rank <= 3) {
    return 'bg-[var(--color-gold-primary)] text-white';
  }
  return 'bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)]';
}

function SellerRow({ item }: { item: TopSellerItem }) {
  return (
    <div
      className="flex items-center gap-[var(--spacing-md)] border-b border-[#f5f1eb] py-[7px]"
    >
      {/* Rank badge — spec: 20x20px, border-radius 6px */}
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[10px] font-semibold ${rankBadgeClasses(item.rank)}`}
      >
        {item.rank}
      </span>

      {/* Product name + SKU */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[13px] font-medium leading-tight text-[var(--color-text-primary)]"
          title={item.name}
        >
          {item.name}
        </p>
        <p
          className="truncate text-[10px] text-[var(--color-text-faint)]"
          title={item.sku}
        >
          {item.sku}
        </p>
      </div>

      {/* Revenue + units — spec: right-aligned */}
      <div className="shrink-0 text-right">
        <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          {formatCurrency(item.revenue)}
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)]">
          {item.units.toLocaleString('en-US')} units
        </p>
      </div>
    </div>
  );
}

export function TopTenBestSellers({ data }: TopTenBestSellersProps) {
  const leftColumn = data.filter(item => item.rank <= 5);
  const rightColumn = data.filter(item => item.rank > 5 && item.rank <= 10);

  return (
    <div className="grid grid-cols-2 gap-[var(--spacing-4xl)]">
      {/* Left column — #1-#5 with vertical divider on right */}
      <div className="border-r border-[var(--color-gold-subtle)] pr-[var(--spacing-4xl)]">
        {leftColumn.map(item => (
          <SellerRow key={item.rank} item={item} />
        ))}
      </div>

      {/* Right column — #6-#10 */}
      <div>
        {rightColumn.map(item => (
          <SellerRow key={item.rank} item={item} />
        ))}
      </div>
    </div>
  );
}
