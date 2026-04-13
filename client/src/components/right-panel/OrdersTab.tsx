// FILE: client/src/components/right-panel/OrdersTab.tsx
// PURPOSE: Orchestrates orders time filter state + OrdersFilterBar + OrdersTable
// USED BY: TabsSection.tsx
// EXPORTS: OrdersTab

import { useState, useMemo } from 'react';
import type { OrderRow } from '@shared/types/dashboard';
import type { OrderTimeFilter } from '../../utils/orders-filter';
import { filterOrdersByTimeRange } from '../../utils/orders-filter';
import { OrdersFilterBar } from './OrdersFilterBar';
import { OrdersTable } from './OrdersTable';

interface OrdersTabProps {
  orders: OrderRow[];
}

export function OrdersTab({ orders }: OrdersTabProps) {
  const [activeFilter, setActiveFilter] = useState<OrderTimeFilter | null>(null);

  const filteredOrders = useMemo(
    () => filterOrdersByTimeRange(orders, activeFilter),
    [orders, activeFilter],
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
    </>
  );
}
