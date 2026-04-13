// FILE: client/src/utils/consolidate-order-items.ts
// PURPOSE: Aggregate OrderRow[] line items by SKU for the Orders tab summary
// USED BY: OrdersTab.tsx
// EXPORTS: consolidateOrderItems, ConsolidatedOrderItem

import type { OrderRow } from '@shared/types/dashboard';

export interface ConsolidatedOrderItem {
  sku: string;
  productName: string;
  totalQuantity: number;
  totalValue: number;
  orderCount: number;
  lastPrice: number;
  unit: string;
}

/** WHY: Sort orders date-desc so first encounter of each SKU captures the most recent price */
export function consolidateOrderItems(orders: OrderRow[]): ConsolidatedOrderItem[] {
  if (orders.length === 0) return [];

  const sorted = [...orders].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const bySku = new Map<string, ConsolidatedOrderItem & { orderNumbers: Set<string> }>();

  sorted.forEach(order => {
    order.items.forEach(item => {
      const existing = bySku.get(item.sku);
      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.totalValue += item.lineTotal;
        existing.orderNumbers.add(order.orderNumber);
      } else {
        bySku.set(item.sku, {
          sku: item.sku,
          productName: item.productName,
          totalQuantity: item.quantity,
          totalValue: item.lineTotal,
          orderCount: 0,
          lastPrice: item.unitPrice,
          unit: item.unit,
          orderNumbers: new Set([order.orderNumber]),
        });
      }
    });
  });

  return [...bySku.values()]
    .map(({ orderNumbers, ...rest }) => ({ ...rest, orderCount: orderNumbers.size }))
    .sort((a, b) => b.totalValue - a.totalValue);
}
