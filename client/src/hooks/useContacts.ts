// FILE: client/src/hooks/useContacts.ts
// PURPOSE: TanStack Query hooks for contacts — single customer or multi-customer (consolidated)
// USED BY: client/src/hooks/useDashboardState.ts, components/right-panel/TabsSection.tsx
// EXPORTS: useContacts, useConsolidatedContacts

import { useQuery } from '@tanstack/react-query';
import type { Contact } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

async function fetchContacts(customerId: string): Promise<Contact[]> {
  const params = new URLSearchParams({ customerId });
  const response = await fetch(`/api/sales/contacts?${params}`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result = (await response.json()) as ApiResponse<Contact[]>;
  return result.data;
}

async function fetchConsolidatedContacts(customerIds: string[]): Promise<Contact[]> {
  const params = new URLSearchParams({ customerIds: customerIds.join(',') });
  const response = await fetch(`/api/sales/contacts?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = (await response.json()) as ApiResponse<Contact[]>;
  return result.data;
}

/**
 * Fetches contacts on demand for a specific customer.
 * Only fires when enabled=true AND customerId is not null.
 * staleTime: 30 minutes — contacts rarely change within a session.
 */
export function useContacts(customerId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['contacts', customerId],
    queryFn: () => fetchContacts(customerId!),
    enabled: enabled && customerId !== null,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Fetches contacts for multiple customers. Each Contact in the returned array is
 * annotated with `customerName` so the ConsolidatedContactsTable can show a Customer column.
 * Only fires when the Consolidated view is active and ids.length > 0.
 * WHY: Adversarial review H5 — consolidated contacts had no viable data source.
 */
export function useConsolidatedContacts(customerIds: string[], enabled: boolean) {
  // WHY: Sorted IDs produce a stable queryKey so TanStack dedupes equivalent selections.
  const sortedIds = [...customerIds].sort();
  return useQuery({
    queryKey: ['contacts-consolidated', sortedIds.join(',')],
    queryFn: () => fetchConsolidatedContacts(sortedIds),
    enabled: enabled && sortedIds.length > 0,
    staleTime: 30 * 60 * 1000,
  });
}
