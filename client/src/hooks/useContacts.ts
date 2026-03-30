// FILE: client/src/hooks/useContacts.ts
// PURPOSE: TanStack Query hook for fetching contacts — only when Contacts tab is active
// USED BY: client/src/hooks/useDashboardState.ts, components/right-panel/TabsSection.tsx
// EXPORTS: useContacts

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
