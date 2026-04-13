// FILE: client/src/components/right-panel/BestSellers.tsx
// PURPOSE: Paginated two-column ranked list of best-selling products (up to 25)
// USED BY: client/src/components/right-panel/ChartsRow.tsx
// EXPORTS: BestSellers

import { useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TopSellerItem } from '@shared/types/dashboard';
import { formatCurrency } from '@shared/utils/formatting';
import { CopyableId } from '../shared/CopyableId';
import { Tooltip } from '../shared/Tooltip';

interface BestSellersProps {
  data: TopSellerItem[];
}

/** WHY gold vs neutral: spec says top 3 get gold badges, 4+ get neutral */
function rankBadgeClasses(rank: number): string {
  if (rank <= 3) {
    return 'bg-[var(--color-gold-primary)] text-white';
  }
  return 'bg-[var(--color-gold-subtle)] text-[var(--color-text-muted)]';
}

function SellerRow({ item }: { item: TopSellerItem }) {
  const nameRef = useRef<HTMLParagraphElement>(null);
  /** WHY: Only show tooltip when text is actually truncated by CSS ellipsis */
  const [isTruncated, setIsTruncated] = useState(false);

  function checkTruncation() {
    const el = nameRef.current;
    if (el) setIsTruncated(el.scrollWidth > el.clientWidth);
  }

  const nameElement = (
    <p ref={nameRef} onMouseEnter={checkTruncation} className="truncate text-[14px] font-medium leading-tight text-[var(--color-text-primary)]">
      {item.name}
    </p>
  );

  return (
    <div className="flex items-center gap-[var(--spacing-md)] border-b border-[#f5f1eb] py-[7px]">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[10px] font-semibold ${rankBadgeClasses(item.rank)}`}
      >
        {item.rank}
      </span>
      <div className="min-w-0 flex-1">
        {isTruncated ? <Tooltip content={item.name}>{nameElement}</Tooltip> : nameElement}
        <CopyableId value={item.sku} label="SKU" className="block truncate text-[12px] text-[var(--color-text-muted)]" />
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          {formatCurrency(item.revenue)}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {item.units.toLocaleString('en-US')} {item.unit}
        </p>
      </div>
    </div>
  );
}

/** WHY: Modal shows full unpaginated list — up to 20 items in single column for easy scanning */
export function BestSellersExpanded({ data }: BestSellersProps) {
  const items = data.filter(item => item.revenue > 0).slice(0, 20);
  return (
    <div className="flex flex-col gap-[var(--spacing-xs)]">
      {items.map((item) => (
        <div key={item.sku} className="flex items-center gap-[var(--spacing-md)] border-b border-[#f5f1eb] py-[var(--spacing-md)]">
          <span className={`flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)] text-[11px] font-bold ${rankBadgeClasses(item.rank)}`}>
            {item.rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{item.name}</div>
            <div className="text-[10px] text-[var(--color-text-faint)]">{item.sku}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[13px] font-semibold tabular-nums text-[var(--color-text-primary)]">{formatCurrency(item.revenue)}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{item.units.toLocaleString('en-US')} {item.unit}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** WHY page size 5: each arrow click shifts by 5 items, two columns show 10 at a time */
const PAGE_STEP = 5;
const VISIBLE_COUNT = 10;

export function BestSellers({ data }: BestSellersProps) {
  const [startIdx, setStartIdx] = useState(0);
  const [direction, setDirection] = useState(0);
  const filtered = data.filter(item => item.revenue > 0);
  const total = filtered.length;
  const maxStart = Math.max(0, total - VISIBLE_COUNT);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setStartIdx(prev => Math.max(0, prev - PAGE_STEP));
  }, []);

  const goNext = useCallback(() => {
    setDirection(1);
    setStartIdx(prev => Math.min(maxStart, prev + PAGE_STEP));
  }, [maxStart]);

  const visible = filtered.slice(startIdx, startIdx + VISIBLE_COUNT);
  const leftColumn = visible.slice(0, 5);
  const rightColumn = visible.slice(5, 10);
  const isFirst = startIdx === 0;
  const isLast = startIdx >= maxStart;

  return (
    <div className="flex flex-col">
      {/* Header with title + pagination arrows */}
      <div className="mb-[var(--spacing-lg)] flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
          Best Sellers
        </h2>
        {total > VISIBLE_COUNT && (
          <div className="flex items-center gap-[var(--spacing-sm)]">
            <button
              type="button"
              onClick={goPrev}
              disabled={isFirst}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold-primary)] disabled:cursor-default disabled:opacity-30"
              aria-label="Previous sellers"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {startIdx + 1}-{Math.min(startIdx + VISIBLE_COUNT, total)} of {total}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={isLast}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold-primary)] disabled:cursor-default disabled:opacity-30"
              aria-label="Next sellers"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Two-column grid with slide animation */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={startIdx}
          initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-2 gap-[var(--spacing-4xl)]"
        >
          <div className="border-r border-[var(--color-gold-subtle)] pr-[var(--spacing-4xl)]">
            {leftColumn.map(item => (
              <SellerRow key={item.rank} item={item} />
            ))}
          </div>
          <div>
            {rightColumn.map(item => (
              <SellerRow key={item.rank} item={item} />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
