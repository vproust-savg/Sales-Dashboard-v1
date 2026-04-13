// FILE: client/src/components/right-panel/OrdersTab.tsx
// PURPOSE: Orchestrates orders time filter state + OrdersFilterBar + OrdersTable + consolidated items
// USED BY: TabsSection.tsx
// EXPORTS: OrdersTab

import { useState, useMemo } from 'react';
import type { OrderRow } from '@shared/types/dashboard';
import type { OrderTimeFilter } from '../../utils/orders-filter';
import { filterOrdersByTimeRange } from '../../utils/orders-filter';
import { consolidateOrderItems } from '../../utils/consolidate-order-items';
import { OrdersFilterBar } from './OrdersFilterBar';
import { OrdersTable } from './OrdersTable';
import { OrdersConsolidatedItems } from './OrdersConsolidatedItems';

interface OrdersTabProps {
  orders: OrderRow[];
}

export function OrdersTab({ orders }: OrdersTabProps) {
  /** WHY: Pre-select "Last 30 Days" so users see recent orders immediately */
  const [activeFilter, setActiveFilter] = useState<OrderTimeFilter | null>('last30');

  const filteredOrders = useMemo(
    () => filterOrdersByTimeRange(orders, activeFilter),
    [orders, activeFilter],
  );

  /** WHY: Aggregate filtered orders by SKU so users see what was bought in the selected period */
  const consolidatedItems = useMemo(
    () => consolidateOrderItems(filteredOrders),
    [filteredOrders],
  );

  return (
    <>
      <OrdersFilterBar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        filteredCount={filteredOrders.length}
        totalCount={orders.length}
      />
      <OrdersTable orders={filteredOrders} />
      <OrdersConsolidatedItems items={consolidatedItems} />
    </>
  );
}
