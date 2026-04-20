// FILE: server/src/routes/filter-options.ts
// PURPOSE: GET /api/sales/filter-options — distinct values for the Rep / Zone / Customer Type
//   dropdowns shown inside the left-panel filter panel. Sourced from Priority master tables.
// USED BY: client/src/hooks/useFilterOptions.ts
// EXPORTS: filterOptionsRouter

import { Router } from 'express';
import { priorityClient } from '../services/priority-instance.js';
import { fetchAgents, fetchZones, fetchCustomerTypes } from '../services/priority-queries.js';
import { cachedFetch } from '../cache/cache-layer.js';
import { cacheKey, getTTL } from '../cache/cache-keys.js';
import type { ApiResponse, FilterOptions } from '@shared/types/api-responses';

export const filterOptionsRouter = Router();

filterOptionsRouter.get('/filter-options', async (_req, res, next) => {
  try {
    const [agentsResult, zonesResult, customerTypesResult] = await Promise.all([
      cachedFetch(cacheKey('agents', 'all'), getTTL('agents'),
        () => fetchAgents(priorityClient)),
      cachedFetch(cacheKey('zones', 'all'), getTTL('zones'),
        () => fetchZones(priorityClient)),
      cachedFetch(cacheKey('customer_types', 'all'), getTTL('customer_types'),
        () => fetchCustomerTypes(priorityClient)),
    ]);

    // WHY sort+dedupe here (not in the fetchers): fetchers return the raw master rows so
    // they can be reused by other callers (e.g., entity-list-builder). The distinct-string
    // projection is specific to the filter-dropdown use case.
    const reps = uniqueSorted(agentsResult.data.map(a => a.AGENTNAME));
    // WHY zones from DISTRLINES.ZONEDES: customer entities are tagged with ZONEDES, so the
    // dropdown must offer ZONEDES values to match. DISTRLINES is the canonical source —
    // multiple distribution lines may roll up to one zone; we dedupe.
    const zones = uniqueSorted(zonesResult.data.map(z => z.ZONEDES));
    const customerTypes = uniqueSorted(customerTypesResult.data.map(t => t.CTYPENAME));

    const data: FilterOptions = { reps, zones, customerTypes };
    const response: ApiResponse<FilterOptions> = {
      data,
      meta: {
        cached: agentsResult.cached && zonesResult.cached && customerTypesResult.cached,
        cachedAt: null,
        period: 'all',
        dimension: 'filter-options',
        entityCount: reps.length + zones.length + customerTypes.length,
      },
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const v of values) {
    const trimmed = v?.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}
