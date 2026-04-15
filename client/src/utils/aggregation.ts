// FILE: client/src/utils/aggregation.ts
// PURPOSE: Client-side aggregation utilities (currently empty — server handles consolidated aggregation)
// USED BY: none (previously used by useDashboardState for client-side consolidation)
// EXPORTS: none

// WHY: aggregateForConsolidated was removed because the server now handles
// consolidated aggregation via the entityIds parameter on /api/sales/fetch-all
// (View Consolidated routes through the unified Report SSE pipeline post-D3).
// The legacy /api/sales/dashboard?entityIds path still exists server-side for
// backward compat but is no longer called by the client — see Commit 2b cleanup.
// This file is kept as a placeholder for future client-side aggregation needs.
