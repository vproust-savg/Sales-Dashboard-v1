// FILE: shared/types/api-responses.ts
// PURPOSE: API response envelope types for all endpoints
// USED BY: server/routes/*.ts, client/hooks/*.ts
// EXPORTS: ApiResponse, ApiError

export interface ApiResponse<T> {
  data: T;
  meta: {
    cached: boolean;
    cachedAt: string | null;  // ISO timestamp when cached
    period: string;
    dimension: string;
    entityCount: number;
    /** WHY: True when orders cache was warm and entity metrics were computed from orders.
     *  False means entities are master-data stubs with null metrics — client uses this to
     *  decide whether to aggressively poll for enriched data (see useEntityList in Task 5.2). */
    enriched?: boolean;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
