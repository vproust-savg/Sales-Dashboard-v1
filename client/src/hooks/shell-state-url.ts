// FILE: client/src/hooks/shell-state-url.ts
// PURPOSE: Pure functions for parsing/building URL search params for dashboard shell state
// USED BY: useDashboardShellState.ts, shell-state-url.test.ts
// EXPORTS: parseSearchParams, buildSearch, DEFAULT_STATE, DashboardShellState, VALID_DIMENSIONS, VALID_TABS, VALID_SORT_FIELDS, VALID_SORT_DIRECTIONS

import type { Dimension, Period } from '@shared/types/dashboard';
import type { DetailTab } from '../components/right-panel/detail-tab-types';
import type { SortDirection, SortField } from './sort-types';

export interface DashboardShellState {
  activeDimension: Dimension;
  activePeriod: Period;
  activeEntityId: string | null;
  activeTab: DetailTab;
  searchTerm: string;
  sortField: SortField;
  sortDirection: SortDirection;
}

export const DEFAULT_STATE: DashboardShellState = {
  activeDimension: 'customer',
  activePeriod: 'ytd',
  activeEntityId: null,
  activeTab: 'orders',
  searchTerm: '',
  sortField: 'id',
  sortDirection: 'asc',
};

export const VALID_DIMENSIONS = new Set<Dimension>(['customer', 'zone', 'vendor', 'brand', 'product_type', 'product']);
export const VALID_TABS = new Set<DetailTab>(['orders', 'items', 'contacts']);
export const VALID_SORT_FIELDS = new Set<SortField>(['id', 'name', 'revenue', 'orders', 'avgOrder', 'marginPercent', 'frequency', 'lastOrder']);
export const VALID_SORT_DIRECTIONS = new Set<SortDirection>(['asc', 'desc']);

/** WHY: Accepts URLSearchParams instead of reading window.location -- testable without JSDOM */
export function parseSearchParams(params: URLSearchParams): DashboardShellState {
  const dim = params.get('dim');
  const period = params.get('period');
  const entity = params.get('entity');
  const tab = params.get('tab');
  const q = params.get('q');
  const sort = params.get('sort');
  const dir = params.get('dir');

  return {
    activeDimension: VALID_DIMENSIONS.has(dim as Dimension) ? dim as Dimension : DEFAULT_STATE.activeDimension,
    activePeriod: period && period.trim() ? period : DEFAULT_STATE.activePeriod,
    activeEntityId: entity && entity.trim() ? entity : null,
    activeTab: VALID_TABS.has(tab as DetailTab) ? tab as DetailTab : DEFAULT_STATE.activeTab,
    searchTerm: q ?? DEFAULT_STATE.searchTerm,
    sortField: VALID_SORT_FIELDS.has(sort as SortField) ? sort as SortField : DEFAULT_STATE.sortField,
    sortDirection: VALID_SORT_DIRECTIONS.has(dir as SortDirection) ? dir as SortDirection : DEFAULT_STATE.sortDirection,
  };
}

export function buildSearch(state: DashboardShellState): string {
  const params = new URLSearchParams();

  if (state.activeDimension !== DEFAULT_STATE.activeDimension) params.set('dim', state.activeDimension);
  if (state.activePeriod !== DEFAULT_STATE.activePeriod) params.set('period', state.activePeriod);
  if (state.activeEntityId) params.set('entity', state.activeEntityId);
  if (state.activeTab !== DEFAULT_STATE.activeTab) params.set('tab', state.activeTab);
  if (state.searchTerm) params.set('q', state.searchTerm);
  if (
    state.sortField !== DEFAULT_STATE.sortField
    || state.sortDirection !== DEFAULT_STATE.sortDirection
  ) {
    params.set('sort', state.sortField);
    params.set('dir', state.sortDirection);
  }

  return params.toString();
}
