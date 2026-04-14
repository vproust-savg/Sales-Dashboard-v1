// FILE: client/src/hooks/sort-types.ts
// PURPOSE: Sort field + direction types shared across hooks, utils, and components
// USED BY: useDashboardShellState.ts, shell-state-url.ts, sort-engine.ts, LeftPanel.tsx, dashboard-layout-types.ts
// EXPORTS: SortField, SortDirection

export type SortField =
  | 'id'
  | 'name'
  | 'revenue'
  | 'orders'
  | 'avgOrder'
  | 'marginPercent'
  | 'frequency'
  | 'lastOrder';

export type SortDirection = 'asc' | 'desc';
