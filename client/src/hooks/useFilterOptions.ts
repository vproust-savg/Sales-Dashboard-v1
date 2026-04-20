// FILE: client/src/hooks/useFilterOptions.ts
// PURPOSE: Fetch distinct values for the Rep / Zone / Customer Type filter dropdowns.
// USED BY: client/src/components/left-panel/FilterPanel.tsx
// EXPORTS: useFilterOptions

import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, FilterOptions } from '@shared/types/api-responses';

const EMPTY_OPTIONS: FilterOptions = { reps: [], zones: [], customerTypes: [] };

async function fetchFilterOptions(): Promise<FilterOptions> {
  const response = await fetch('/api/sales/filter-options');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = (await response.json()) as ApiResponse<FilterOptions>;
  return result.data;
}

/** WHY staleTime=Infinity: Agents, zones, and customer types change rarely. The server
 *  warm-caches these on startup and on a 1h/24h TTL — client-side refetch adds no value.
 *  A full page refresh pulls the latest list if someone edits Priority. */
export function useFilterOptions() {
  const query = useQuery({
    queryKey: ['filter-options'],
    queryFn: fetchFilterOptions,
    staleTime: Infinity,
    retry: 1,
  });
  return {
    options: query.data ?? EMPTY_OPTIONS,
    isLoading: query.isLoading,
  };
}
