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
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
