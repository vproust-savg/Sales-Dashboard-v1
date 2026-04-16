// FILE: server/src/services/entity-subset-filter.ts
// PURPOSE: Filter raw orders to a specific subset of entity IDs across all dimensions.
//   Used by the SSE fetch-all route when View Consolidated narrows the result to selected customers.
// USED BY: server/src/routes/fetch-all.ts
// EXPORTS: filterOrdersByEntityIds

import type { RawOrder, RawCustomer } from './priority-queries.js';
import type { Dimension } from '@shared/types/dashboard';

export function filterOrdersByEntityIds(
  orders: RawOrder[],
  entityIds: Set<string>,
  dimension: Dimension,
  customers: RawCustomer[],
): RawOrder[] {
  switch (dimension) {
    case 'customer':
      return orders.filter(o => entityIds.has(o.CUSTNAME));
    case 'zone': {
      const custInZones = new Set(
        customers.filter(c => entityIds.has(c.ZONECODE)).map(c => c.CUSTNAME),
      );
      return orders.filter(o => custInZones.has(o.CUSTNAME));
    }
    case 'vendor':
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i => entityIds.has(i.Y_1159_5_ESH ?? '')),
      );
    case 'brand':
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i => entityIds.has(i.Y_9952_5_ESH ?? '')),
      );
    case 'product_type':
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i =>
          entityIds.has(i.Y_3020_5_ESH ?? i.Y_3021_5_ESH ?? ''),
        ),
      );
    case 'product':
      return orders.filter(o =>
        (o.ORDERITEMS_SUBFORM ?? []).some(i => entityIds.has(i.PARTNAME)),
      );
    default:
      return orders;
  }
}
