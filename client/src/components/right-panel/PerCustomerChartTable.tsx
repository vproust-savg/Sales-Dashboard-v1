// FILE: client/src/components/right-panel/PerCustomerChartTable.tsx
// PURPOSE: Per-entity breakdown for Product Mix and Best Sellers modals
// USED BY: ProductMixExpanded, BestSellersExpanded (via toggle)
// EXPORTS: PerCustomerChartTable

import { useMemo } from 'react';
import type { EntityListItem, ProductMixSegment, ProductMixType, TopSellerItem } from '@shared/types/dashboard';
import { formatCurrency } from '@shared/utils/formatting';

type Mode = 'product-mix' | 'top-sellers';

interface PerCustomerChartTableProps {
  mode: Mode;
  entities: EntityListItem[];
  /** Per-entity product mix segments (keyed by entity id) */
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
  /** Only used when mode='product-mix' */
  productMixType?: ProductMixType;
  /** Per-entity top sellers (keyed by entity id) */
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
}

export function PerCustomerChartTable({ mode, entities, perEntityProductMixes, productMixType, perEntityTopSellers }: PerCustomerChartTableProps) {
  const rows = useMemo(() => {
    if (mode === 'product-mix') {
      if (!perEntityProductMixes || !productMixType) return [];
      return entities.map(e => {
        const mix = perEntityProductMixes[e.id]?.[productMixType] ?? [];
        const top = mix[0] ?? null;
        return {
          id: e.id,
          name: e.name,
          label: top?.category ?? '\u2014',
          value: top?.value ?? 0,
          percent: top?.percentage ?? 0,
        };
      }).sort((a, b) => b.value - a.value);
    }

    if (!perEntityTopSellers) return [];
    return entities.map(e => {
      const topSellers = perEntityTopSellers[e.id] ?? [];
      const top = topSellers[0] ?? null;
      return {
        id: e.id,
        name: e.name,
        label: top?.name ?? '\u2014',
        value: top?.revenue ?? 0,
        percent: 0, // not used in top-sellers mode
      };
    }).sort((a, b) => b.value - a.value);
  }, [mode, entities, perEntityProductMixes, productMixType, perEntityTopSellers]);

  const valueHeader = mode === 'product-mix' ? 'Revenue' : 'Top SKU Revenue';
  const categoryHeader = mode === 'product-mix' ? 'Top Category' : 'Top SKU';

  return (
    <div className="max-h-[400px] overflow-auto rounded-[var(--radius-base)] border border-[var(--color-gold-subtle)]">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-[var(--color-bg-card)]">
          <tr className="border-b border-[var(--color-gold-subtle)]">
            <th className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-left text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Customer</th>
            <th className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-left text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{categoryHeader}</th>
            <th className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{valueHeader}</th>
            {mode === 'product-mix' && (
              <th className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">% of Revenue</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-[var(--color-gold-subtle)] last:border-b-0 hover:bg-[var(--color-gold-subtle)]">
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-primary)]">{r.name}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-secondary)]">{r.label}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-secondary)]">{formatCurrency(r.value)}</td>
              {mode === 'product-mix' && (
                <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-muted)]">{r.percent}%</td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={mode === 'product-mix' ? 4 : 3} className="p-[var(--spacing-2xl)] text-center text-[var(--color-text-muted)]">No entity breakdown available</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export type { Mode as PerCustomerChartMode };
