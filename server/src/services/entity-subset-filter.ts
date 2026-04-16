// FILE: server/src/services/entity-subset-filter.ts
// PURPOSE: Filter and scope raw orders by dimension + entity-id set. Two exports with
//   distinct semantics: filterOrdersByEntityIds is a predicate (items/TOTPRICE untouched);
//   scopeOrders also narrows items and rewrites TOTPRICE for item-based dimensions.
// USED BY: server/src/routes/fetch-all.ts (filterOrdersByEntityIds);
//   server/src/services/data-aggregator.ts (scopeOrders — global pre-scope + per-entity loop).
// EXPORTS: filterOrdersByEntityIds, scopeOrders

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
          // WHY ||: Y_3020_5_ESH can be '' (empty string from API); || falls back to
          // Y_3021_5_ESH in that case. ?? would not, since '' is not null/undefined.
          entityIds.has(i.Y_3020_5_ESH || i.Y_3021_5_ESH || ''),
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

/** Scope orders to a dimension + entity-id set. For item-based dims, narrows each order's
 *  ORDERITEMS_SUBFORM to matching items AND rewrites TOTPRICE = Σ QPRICE of remaining items.
 *  This lets downstream aggregators (computeKPIs, computeMonthlyRevenue, etc.) remain
 *  dimension-agnostic — they sum TOTPRICE as they always have, and it's correct by construction.
 *  WHY not mutate: callers may reuse the input orders array for other scopes (consolidated
 *  perEntity loop). Return new objects. */
export function scopeOrders(
  orders: RawOrder[],
  dimension: Dimension,
  entityIds: Set<string>,
  customers: RawCustomer[],
): RawOrder[] {
  if (entityIds.size === 0) return [];

  if (dimension === 'customer') {
    return orders.filter(o => entityIds.has(o.CUSTNAME));
  }

  if (dimension === 'zone') {
    const custInZones = new Set(
      customers.filter(c => entityIds.has(c.ZONECODE)).map(c => c.CUSTNAME),
    );
    return orders.filter(o => custInZones.has(o.CUSTNAME));
  }

  // Item-based dims: narrow items + rewrite TOTPRICE
  const itemKey = (i: RawOrder['ORDERITEMS_SUBFORM'][number]): string => {
    switch (dimension) {
      case 'vendor':       return i.Y_1159_5_ESH ?? '';
      case 'brand':        return i.Y_9952_5_ESH ?? '';
      // WHY ||: Y_3020_5_ESH can be '' (empty string from API); || falls back to
      // Y_3021_5_ESH in that case. ?? would not, since '' is not null/undefined.
      case 'product_type': return i.Y_3020_5_ESH || i.Y_3021_5_ESH || '';
      case 'product':      return i.PARTNAME;
      default:
        // WHY throw: customer/zone are handled by early-return guards above. This default
        // is structurally unreachable today, but a future Dimension added without updating
        // this switch would silently drop all items (empty key never matches entityIds).
        throw new Error(`scopeOrders: unexpected dimension ${dimension}`);
    }
  };

  return orders.reduce<RawOrder[]>((acc, o) => {
    const items = (o.ORDERITEMS_SUBFORM ?? []).filter(i => entityIds.has(itemKey(i)));
    if (items.length === 0) return acc;
    const scopedTotprice = items.reduce((s, i) => s + i.QPRICE, 0);
    acc.push({ ...o, ORDERITEMS_SUBFORM: items, TOTPRICE: scopedTotprice });
    return acc;
  }, []);
}
