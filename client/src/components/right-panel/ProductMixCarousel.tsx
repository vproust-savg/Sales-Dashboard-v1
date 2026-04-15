// FILE: client/src/components/right-panel/ProductMixCarousel.tsx
// PURPOSE: Left/right carousel wrapping ProductMixDonut — cycles through 5 mix types
// USED BY: client/src/components/right-panel/ChartsRow.tsx
// EXPORTS: ProductMixCarousel, ProductMixExpanded

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProductMixSegment, ProductMixType } from '@shared/types/dashboard';
import { PRODUCT_MIX_LABELS, PRODUCT_MIX_ORDER } from '@shared/types/dashboard';
import { formatCurrencyCompact } from '@shared/utils/formatting';
import { ProductMixDonut, SEGMENT_COLORS } from './ProductMixDonut';

interface ProductMixCarouselProps {
  mixes: Record<ProductMixType, ProductMixSegment[]>;
}

/** WHY inline SVG: avoids icon library dependency for two simple chevrons */
function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** WHY: Separate export for modal — donut left + 2-column legend right, up to 15 categories */
export function ProductMixExpanded({ mixes }: ProductMixCarouselProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const types = PRODUCT_MIX_ORDER;
  const activeType = types[activeIdx];
  const segments = mixes[activeType] ?? [];

  /** WHY ceil: left column gets the extra item when count is odd */
  const half = Math.ceil(segments.length / 2);
  const col1 = segments.slice(0, half);
  const col2 = segments.slice(half);

  return (
    <div className="flex flex-col gap-[var(--spacing-2xl)]">
      {/* Tab bar */}
      <div className="flex gap-[var(--spacing-md)]">
        {types.map((type, i) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveIdx(i)}
            className={`cursor-pointer rounded-[var(--radius-base)] px-[var(--spacing-lg)] py-[var(--spacing-xs)] text-[12px] font-medium transition-colors ${
              i === activeIdx ? 'bg-[var(--color-dark)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-gold-subtle)]'
            }`}
          >
            {PRODUCT_MIX_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Side-by-side: donut left, 2-column legend right */}
      <div className="flex items-start gap-[var(--spacing-3xl)]">
        {/* Donut without legend — legend rendered below in 2 columns */}
        <ProductMixDonut data={segments} showLegend={false} maxSegments={15} />

        {/* 2-column legend grid */}
        <div className="flex flex-1 gap-[var(--spacing-xl)]">
          {[col1, col2].map((col, colIdx) => (
            <div key={colIdx} className="flex flex-1 flex-col gap-[var(--spacing-sm)]">
              {col.map((seg, rowIdx) => {
                const globalIdx = colIdx === 0 ? rowIdx : half + rowIdx;
                return (
                  <div
                    key={seg.category}
                    className="flex items-center gap-[var(--spacing-sm)] text-[12px]"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: SEGMENT_COLORS[globalIdx] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[var(--color-text-secondary)]">
                      {seg.category}
                    </span>
                    <span className="ml-1 font-semibold text-[var(--color-text-primary)]">
                      {seg.percentage}%
                    </span>
                    <span className="ml-1 whitespace-nowrap text-[var(--color-text-muted)]">
                      {formatCurrencyCompact(seg.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductMixCarousel({ mixes }: ProductMixCarouselProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [direction, setDirection] = useState(0);
  const count = PRODUCT_MIX_ORDER.length;

  const goTo = useCallback((next: number, dir: number) => {
    setDirection(dir);
    setActiveIdx(next);
  }, []);

  const goPrev = useCallback(() => {
    goTo((activeIdx - 1 + count) % count, -1);
  }, [activeIdx, count, goTo]);

  const goNext = useCallback(() => {
    goTo((activeIdx + 1) % count, 1);
  }, [activeIdx, count, goTo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
  }, [goPrev, goNext]);

  const activeMixType = PRODUCT_MIX_ORDER[activeIdx];
  const activeData = mixes[activeMixType];

  return (
    <div
      className="flex flex-col"
      role="tablist"
      aria-label="Product mix chart types"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header with arrows */}
      <div className="mb-[var(--spacing-lg)] flex items-center justify-between">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold-primary)]"
          aria-label="Previous chart type"
        >
          <ChevronLeft />
        </button>
        <h2
          className="text-[15px] font-semibold text-[var(--color-text-primary)]"
          role="tab"
          aria-selected="true"
        >
          Product Mix — {PRODUCT_MIX_LABELS[activeMixType]}
        </h2>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold-primary)]"
          aria-label="Next chart type"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Donut with slide animation — compact view keeps default maxSegments=7 */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={activeMixType}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
            transition={{ duration: 0.2 }}
          >
            <ProductMixDonut data={activeData} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="mt-[var(--spacing-lg)] flex items-center justify-center gap-[var(--spacing-sm)]">
        {PRODUCT_MIX_ORDER.map((mixType, i) => (
          <button
            key={mixType}
            type="button"
            onClick={(e) => { e.stopPropagation(); goTo(i, i > activeIdx ? 1 : -1); }}
            className={`h-[6px] w-[6px] cursor-pointer rounded-full transition-colors ${
              i === activeIdx
                ? 'bg-[var(--color-gold-primary)]'
                : 'bg-[var(--color-gold-subtle)]'
            }`}
            role="tab"
            aria-selected={i === activeIdx}
            aria-label={PRODUCT_MIX_LABELS[mixType]}
          />
        ))}
      </div>
    </div>
  );
}
