// FILE: client/src/layouts/dashboard-layout-types.ts
// PURPOSE: Props interface for DashboardLayout — extracted to keep component file under 200 lines
// USED BY: DashboardLayout.tsx, App.tsx (via DashboardLayout)
// EXPORTS: DashboardLayoutProps

import type { DashboardPayload, EntityListItem, Contact, Dimension, Period } from '@shared/types/dashboard';
import type { FilterCondition } from '../hooks/useFilters';
import type { SortField, SortDirection } from '../hooks/sort-types';
import type { ApiResponse } from '@shared/types/api-responses';
import type { DetailTab } from '../components/right-panel/detail-tab-types';
import type { UseReportReturn } from '../hooks/useReport';

export interface DashboardLayoutProps {
  dashboard: DashboardPayload | null;
  entities: EntityListItem[];
  allEntities: EntityListItem[];
  contacts: Contact[];
  isLoading: boolean;
  isDetailLoading: boolean;
  loadingStage: string | null;
  error: string | null;
  detailError: string | null;
  retryDetail: () => void;
  meta: ApiResponse<unknown>['meta'] | null;
  yearsAvailable: string[];
  activeDimension: Dimension;
  activePeriod: Period;
  activeEntityId: string | null;
  activeTab: DetailTab;
  selectedEntityIds: string[];
  searchTerm: string;
  filterConditions: FilterCondition[];
  filterOpen: boolean;
  filterCount: number;
  sortField: SortField;
  sortDirection: SortDirection;
  switchDimension: (dim: Dimension) => void;
  switchPeriod: (period: Period) => void;
  selectEntity: (id: string) => void;
  setActiveTab: (tab: DetailTab) => void;
  toggleCheckbox: (id: string) => void;
  clearSelection: () => void;
  resetSelection: () => void;
  setSearchTerm: (term: string) => void;
  addCondition: () => void;
  updateCondition: (id: string, updates: Partial<FilterCondition>) => void;
  removeCondition: (id: string) => void;
  clearFilters: () => void;
  toggleFilterPanel: () => void;
  setSort: (field: SortField) => void;
  panelCollapsed: boolean;
  togglePanel: () => void;
  report: UseReportReturn;
}
