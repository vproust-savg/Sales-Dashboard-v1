// FILE: client/src/utils/orders-filter.ts
// PURPOSE: Filter OrderRow[] by time range — pure function, no side effects
// USED BY: OrdersTab.tsx
// EXPORTS: filterOrdersByTimeRange, OrderTimeFilter, ORDER_FILTER_OPTIONS

import type { OrderRow } from '@shared/types/dashboard';

export type OrderTimeFilter = 'last30' | '3months' | '6months' | '2026' | '2025';

export interface OrderFilterOption {
  key: OrderTimeFilter;
  label: string;
}

export const ORDER_FILTER_OPTIONS: OrderFilterOption[] = [
  { key: 'last30', label: 'Last 30 Days' },
  { key: '3months', label: '3 Months' },
  { key: '6months', label: '6 Months' },
  { key: '2026', label: '2026' },
  { key: '2025', label: '2025' },
];

/** WHY pure function: easy to test, no React dependency */
export function filterOrdersByTimeRange(
  orders: OrderRow[],
  filter: OrderTimeFilter | null,
): OrderRow[] {
  if (!filter) return orders;

  const now = new Date();

  switch (filter) {
    case 'last30': {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);
      return orders.filter(o => new Date(o.date) >= cutoff);
    }
    case '3months': {
      const cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - 3);
      return orders.filter(o => new Date(o.date) >= cutoff);
    }
    case '6months': {
      const cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - 6);
      return orders.filter(o => new Date(o.date) >= cutoff);
    }
    case '2026':
      return orders.filter(o => o.date.startsWith('2026'));
    case '2025':
      return orders.filter(o => o.date.startsWith('2025'));
  }
}
