// FILE: client/src/components/right-panel/ItemsAccordion.tsx
// PURPOSE: Category accordion — expandable rows showing products per category
// USED BY: TabsSection (Items tab)
// EXPORTS: ItemsAccordion

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ItemCategory } from '@shared/types/dashboard';
import { formatCurrency, formatPercent } from '@shared/utils/formatting';
import { EmptyState } from '../shared/EmptyState';

interface ItemsAccordionProps {
  items: ItemCategory[];
}

export function ItemsAccordion({ items }: ItemsAccordionProps) {
  /** WHY Set for expanded — supports multiple categories open at once */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (items.length === 0) {
    return (
      <EmptyState
        title="No items for this period."
        description="Product categories will appear here when available."
      />
    );
  }

  function toggleCategory(category: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  /** WHY sorted by totalValue desc — spec Section 13.6 */
  const sorted = [...items].sort((a, b) => b.totalValue - a.totalValue);

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center border-b border-[var(--color-gold-subtle)] px-[var(--spacing-3xl)] py-[var(--spacing-lg)]">
        <span className="flex-1 text-[11px] font-semibold uppercase text-[#888] tracking-wide">
          Category / Product
        </span>
        <span className="w-24 text-right text-[11px] font-semibold uppercase text-[#888] tracking-wide">
          Value
        </span>
        <span className="w-20 text-right text-[11px] font-semibold uppercase text-[#888] tracking-wide">
          Margin %
        </span>
        <span className="w-24 text-right text-[11px] font-semibold uppercase text-[#888] tracking-wide">
          Margin $
        </span>
      </div>

      {sorted.map((cat) => (
        <CategoryRow
          key={cat.category}
          category={cat}
          isExpanded={expanded.has(cat.category)}
          onToggle={() => toggleCategory(cat.category)}
        />
      ))}
    </div>
  );
}

/* --- Category row + expandable products --- */

interface CategoryRowProps {
  category: ItemCategory;
  isExpanded: boolean;
  onToggle: () => void;
}

function CategoryRow({ category, isExpanded, onToggle }: CategoryRowProps) {
  return (
    <div className="border-b border-[var(--color-bg-page)]">
      {/* Category header — clickable */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center px-[var(--spacing-3xl)] py-[var(--spacing-base)] text-left hover:bg-[var(--color-gold-hover)] transition-colors duration-150"
        aria-expanded={isExpanded}
      >
        {/* Chevron — rotates on expand */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className={`mr-2 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          <path d="M5 3l4 4-4 4" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <span className="flex-1 text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
          {category.category}
        </span>

        {/* Item count badge */}
        <span className="mx-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-gold-subtle)] px-1 text-[9px] font-semibold text-[#888]">
          {category.itemCount}
        </span>

        <span className="w-24 text-right text-[13px] tabular-nums text-[var(--color-text-primary)]">
          {formatCurrency(category.totalValue)}
        </span>
        <span className="w-20 text-right text-[13px] tabular-nums text-[var(--color-text-secondary)]">
          {formatPercent(category.marginPercent)}
        </span>
        <span className="w-24 text-right text-[13px] tabular-nums text-[var(--color-text-secondary)]">
          {formatCurrency(category.marginAmount)}
        </span>
      </button>

      {/* Expanded products */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="products"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {[...category.products]
              .sort((a, b) => b.value - a.value)
              .map((product) => (
                <div
                  key={product.sku}
                  className="flex items-center border-b border-[var(--color-bg-page)] py-[var(--spacing-md)]"
                  /** WHY 44px left padding — spec Section 4.4 child product indentation */
                  style={{ paddingLeft: '44px', paddingRight: 'var(--spacing-3xl)' }}
                >
                  <div className="flex-1 min-w-0">
                    <span className="block text-[12px] text-[var(--color-text-secondary)] truncate">
                      {product.name}
                    </span>
                    <span className="block text-[10px] text-[var(--color-text-faint)]">
                      {product.sku}
                    </span>
                  </div>
                  <span className="w-24 text-right text-[12px] tabular-nums text-[var(--color-text-secondary)]">
                    {formatCurrency(product.value)}
                  </span>
                  <span className="w-20 text-right text-[12px] tabular-nums text-[var(--color-text-muted)]">
                    {formatPercent(product.marginPercent)}
                  </span>
                  <span className="w-24 text-right text-[12px] tabular-nums text-[var(--color-text-muted)]">
                    {formatCurrency(product.marginAmount)}
                  </span>
                </div>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
