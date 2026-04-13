// FILE: client/src/layouts/dashboard-layout-types.ts
// PURPOSE: Props interface for DashboardLayout — extracted to keep component file under 200 lines
// USED BY: DashboardLayout.tsx, App.tsx (via DashboardLayout)
// EXPORTS: DashboardLayoutProps

import type { DashboardPayload, EntityListItem, Contact, Dimension, Period, EntityListLoadState, SSEProgressEvent, FetchAllFilters } from '@shared/types/dashboard';
import type { FilterCondition } from '../hooks/useFilters';
import type { SortField, SortDirection } from '../hooks/useSort';
import type { ApiResponse } from '@shared/types/api-responses';

export interface DashboardLayoutProps {
  dashboard: DashboardPayload | null;
  entities: EntityListItem[];
  allEntities: EntityListItem[];
  contacts: Contact[];
  isLoading: boolean;
  isDetailLoading: boolean;
  loadingStage: string | null;
  error: string | null;
  meta: ApiResponse<unknown>['meta'] | null;
  yearsAvailable: string[];
  activeDimension: Dimension;
  activePeriod: Period;
  activeEntityId: string | null;
  selectedEntityIds: string[];
  searchTerm: string;
  filterConditions: FilterCondition[];
  filterOpen: boolean;
  filterCount: number;
  sortField: SortField;
  sortDirection: SortDirection;
  dataLoaded: boolean;
  fetchAllLoadState: EntityListLoadState;
  fetchAllProgress: SSEProgressEvent | null;
  allDashboard: DashboardPayload | null;
  startFetchAll: (filters: FetchAllFilters, forceRefresh?: boolean) => void;
  abortFetch: () => void;
  switchDimension: (dim: Dimension) => void;
  switchPeriod: (period: Period) => void;
  selectEntity: (id: string) => void;
  toggleCheckbox: (id: string) => void;
  viewConsolidated: () => void;
  clearSelection: () => void;
  setSearchTerm: (term: string) => void;
  addCondition: () => void;
  updateCondition: (id: string, updates: Partial<FilterCondition>) => void;
  removeCondition: (id: string) => void;
  clearFilters: () => void;
  toggleFilterPanel: () => void;
  setSort: (field: SortField) => void;
}
