// FILE: client/src/components/right-panel/ConsolidatedOrdersTab.tsx
// PURPOSE: Wraps the consolidated Orders view with time-range filter tabs
//          matching the classic single-entity OrdersTab. Defaults to Last 30 Days.
// USED BY: TabsSection.tsx (when consolidatedMode=true)
// EXPORTS: ConsolidatedOrdersTab

import { useState, useMemo } from 'react';
import type { OrderRow } from '@shared/types/dashboard';
import type { OrderTimeFilter } from '../../utils/orders-filter';
import { filterOrdersByTimeRange } from '../../utils/orders-filter';
import { OrdersFilterBar } from './OrdersFilterBar';
import { ConsolidatedOrdersTable } from './ConsolidatedOrdersTable';

interface ConsolidatedOrdersTabProps {
  orders: OrderRow[];
}

export function ConsolidatedOrdersTab({ orders }: ConsolidatedOrdersTabProps) {
  /** WHY default 'last30': matches classic OrdersTab; most common user intent. */
  const [activeFilter, setActiveFilter] = useState<OrderTimeFilter | null>('last30');

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
      <ConsolidatedOrdersTable orders={filteredOrders} />
    </>
  );
}
