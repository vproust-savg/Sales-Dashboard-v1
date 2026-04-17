// FILE: server/src/services/__tests__/fetch-orders-filter-precedence.test.ts
// PURPOSE: Regression guard for an OData operator-precedence bug. fetchOrders appends
//   `extraFilter` to the date+status clause with `and`. OData binds `and` tighter than `or`,
//   so an OR-chain extraFilter like `CUSTNAME eq 'A' or CUSTNAME eq 'B'` would associate as
//   `(dateFilter and CUSTNAME eq 'A') or CUSTNAME eq 'B'` — disjunct B escapes the date
//   filter and pulls that customer's entire historical order set. Live repro (2026-04-17):
//   2-customer narrow fetch returned 3747 rows instead of ~150.
//   The fix wraps `extraFilter` in parentheses so it's always an atomic sub-expression.
//   These tests assert the wrapping stays in place.
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect, beforeEach } from 'vitest';
import { PriorityClient } from '../priority-client.js';
import { fetchOrders } from '../priority-queries.js';

describe('fetchOrders — OData filter-precedence wrapping', () => {
  // WHY: fetchAllPages is generic; replace it with a vi.fn() directly rather than spyOn'ing
  // the generic method (vi.spyOn struggles with generic method types in strict mode).
  // Module-level typing preserves strong types on the `opts` captured for assertions.
  interface CapturedCall { entity: string; opts: { filter?: string } }
  let captured: CapturedCall[];
  const client = new PriorityClient({ baseUrl: 'https://ignored/', username: 'u', password: 'p' });

  beforeEach(() => {
    captured = [];
    // Replace the method with a typed fake so calls are recorded for assertions.
    (client as unknown as { fetchAllPages: (entity: string, opts: { filter?: string }) => Promise<unknown[]> })
      .fetchAllPages = async (entity, opts) => { captured.push({ entity, opts }); return []; };
  });

  it('wraps a single-term extraFilter in parentheses (defensive, harmless)', async () => {
    await fetchOrders(client, '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', true,
      "CUSTNAME eq 'C7826'");

    const opts = captured[0].opts as { filter: string };
    // The whole extraFilter clause must be parenthesised.
    expect(opts.filter).toContain("and (CUSTNAME eq 'C7826')");
  });

  it('wraps an OR-chain extraFilter in parentheses — the critical case', async () => {
    // WHY critical: without parens, OData parses
    //   `date and status and CUSTNAME eq 'A' or CUSTNAME eq 'B'`
    // as `(date and status and A) or B` — B matches across ALL years of that customer's
    // history because `or` splits out of the date range. Production impact: 2-customer
    // View Consolidated returned 3747 rows (should be ~150) and took 66s instead of 2s.
    await fetchOrders(client, '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', true,
      "CUSTNAME eq 'C7826' or CUSTNAME eq 'C7825'");

    const opts = captured[0].opts as { filter: string };
    expect(opts.filter).toContain("and (CUSTNAME eq 'C7826' or CUSTNAME eq 'C7825')");
    // Anti-regression: the BARE unparenthesised form would let OR escape the date range.
    expect(opts.filter).not.toMatch(/and CUSTNAME eq 'C7826' or CUSTNAME eq 'C7825'/);
  });

  it('omits the extraFilter clause entirely when undefined', async () => {
    await fetchOrders(client, '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', true);

    const opts = captured[0].opts as { filter: string };
    // No trailing `and (...)` when caller didn't pass extraFilter.
    expect(opts.filter).not.toMatch(/and \(/);
    // But the date + status portion is still present.
    expect(opts.filter).toContain("CURDATE ge 2026-01-01T00:00:00Z");
    expect(opts.filter).toContain("ORDSTATUSDES ne 'Canceled'");
  });

  it('preserves internal OR-chain semantics after wrapping (no redundant nesting)', async () => {
    await fetchOrders(client, '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', true,
      "CUSTNAME eq 'A' or CUSTNAME eq 'B' or CUSTNAME eq 'C'");

    const opts = captured[0].opts as { filter: string };
    // Single wrapping, not double.
    expect(opts.filter).toContain("and (CUSTNAME eq 'A' or CUSTNAME eq 'B' or CUSTNAME eq 'C')");
    expect(opts.filter).not.toContain("((CUSTNAME");
  });
});
