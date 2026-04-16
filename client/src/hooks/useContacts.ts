// FILE: client/src/hooks/useContacts.ts
// PURPOSE: TanStack Query hooks for contacts — single (dimension+entityId) or consolidated
//   (dimension+entityIds). Server route now accepts dimension-aware queries.
// USED BY: client/src/hooks/useDashboardState.ts, components/right-panel/TabsSection.tsx
// EXPORTS: useContacts, useConsolidatedContacts

import { useQuery } from '@tanstack/react-query';
import type { Contact, Dimension } from '@shared/types/dashboard';
import type { ApiResponse } from '@shared/types/api-responses';

async function fetchContacts(dimension: Dimension, entityId: string): Promise<Contact[]> {
  const params = new URLSearchParams({ dimension, entityId });
  const response = await fetch(`/api/sales/contacts?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = (await response.json()) as ApiResponse<Contact[]>;
  return result.data;
}

async function fetchConsolidatedContacts(dimension: Dimension, entityIds: string[]): Promise<Contact[]> {
  const params = new URLSearchParams({ dimension, entityIds: entityIds.join(',') });
  const response = await fetch(`/api/sales/contacts?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = (await response.json()) as ApiResponse<Contact[]>;
  return result.data;
}

/** Fetches contacts on demand for a specific entity.
 *  For customer dim: contacts for that customer (unchanged).
 *  For non-customer dims: contacts for customers that buy from this vendor/product_type/etc.
 *  (server resolves customer list via scopeOrders). Only fires when enabled AND entityId set. */
export function useContacts(dimension: Dimension, entityId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['contacts', dimension, entityId],
    queryFn: () => fetchContacts(dimension, entityId!),
    enabled: enabled && entityId !== null,
    staleTime: 30 * 60 * 1000,
  });
}

/** Fetches contacts for multiple entities (consolidated view). Each row annotated with
 *  customerName (server-side). For non-customer dims, entityIds are the dim's entity IDs
 *  (e.g., vendor codes) — server resolves to a customer list then applies multi-customer logic. */
export function useConsolidatedContacts(dimension: Dimension, entityIds: string[], enabled: boolean) {
  const sortedIds = [...entityIds].sort();
  return useQuery({
    queryKey: ['contacts-consolidated', dimension, sortedIds.join(',')],
    queryFn: () => fetchConsolidatedContacts(dimension, sortedIds),
    enabled: enabled && sortedIds.length > 0,
    staleTime: 30 * 60 * 1000,
  });
}
