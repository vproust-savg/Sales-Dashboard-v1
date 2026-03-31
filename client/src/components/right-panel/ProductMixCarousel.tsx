// FILE: client/src/components/right-panel/ProductMixCarousel.tsx
// PURPOSE: Left/right carousel wrapping ProductMixDonut — cycles through 5 mix types
// USED BY: client/src/components/right-panel/ChartsRow.tsx
// EXPORTS: ProductMixCarousel

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProductMixSegment, ProductMixType } from '@shared/types/dashboard';
import { PRODUCT_MIX_LABELS, PRODUCT_MIX_ORDER } from '@shared/types/dashboard';
import { ProductMixDonut } from './ProductMixDonut';

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
          onClick={goPrev}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold-primary)]"
          aria-label="Previous chart type"
        >
          <ChevronLeft />
        </button>
        <h2
          className="text-[14px] font-semibold text-[var(--color-text-primary)]"
          role="tab"
          aria-selected="true"
        >
          Product Mix — {PRODUCT_MIX_LABELS[activeMixType]}
        </h2>
        <button
          type="button"
          onClick={goNext}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-gold-primary)]"
          aria-label="Next chart type"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Donut with slide animation */}
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
            onClick={() => goTo(i, i > activeIdx ? 1 : -1)}
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
