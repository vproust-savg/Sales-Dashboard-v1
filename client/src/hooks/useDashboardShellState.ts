// FILE: client/src/hooks/useDashboardShellState.ts
// PURPOSE: URL-backed core shell state for the dashboard (dimension, period, entity, tab, search, sort)
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useDashboardShellState, DashboardShellState

import { useCallback, useEffect, useState } from 'react';
import type { Dimension, Period } from '@shared/types/dashboard';
import type { DetailTab } from '../components/right-panel/detail-tab-types';
import type { SortDirection, SortField } from './useSort';

export interface DashboardShellState {
  activeDimension: Dimension;
  activePeriod: Period;
  activeEntityId: string | null;
  activeTab: DetailTab;
  searchTerm: string;
  sortField: SortField;
  sortDirection: SortDirection;
}

type HistoryMode = 'push' | 'replace';

const DEFAULT_STATE: DashboardShellState = {
  activeDimension: 'customer',
  activePeriod: 'ytd',
  activeEntityId: null,
  activeTab: 'orders',
  searchTerm: '',
  sortField: 'id',
  sortDirection: 'asc',
};

const VALID_DIMENSIONS = new Set<Dimension>([
  'customer', 'zone', 'vendor', 'brand', 'product_type', 'product',
]);
const VALID_TABS = new Set<DetailTab>(['orders', 'items', 'contacts']);
const VALID_SORT_FIELDS = new Set<SortField>([
  'id', 'name', 'revenue', 'orders', 'avgOrder', 'marginPercent', 'frequency', 'lastOrder',
]);
const VALID_SORT_DIRECTIONS = new Set<SortDirection>(['asc', 'desc']);

function parseSearch(): DashboardShellState {
  if (typeof window === 'undefined') return DEFAULT_STATE;

  const params = new URLSearchParams(window.location.search);
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

function buildSearch(state: DashboardShellState): string {
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

function writeUrl(nextState: DashboardShellState, mode: HistoryMode): void {
  if (typeof window === 'undefined') return;

  const nextSearch = buildSearch(nextState);
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl === currentUrl) return;
  window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', nextUrl);
}

export function useDashboardShellState() {
  const [state, setState] = useState<DashboardShellState>(() => parseSearch());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePopState = () => setState(parseSearch());
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const updateState = useCallback((
    updater: DashboardShellState | ((prev: DashboardShellState) => DashboardShellState),
    mode: HistoryMode,
  ) => {
    setState((prev) => {
      const next = typeof updater === 'function'
        ? (updater as (prev: DashboardShellState) => DashboardShellState)(prev)
        : updater;
      writeUrl(next, mode);
      return next;
    });
  }, []);

  const switchDimension = useCallback((dimension: Dimension) => {
    updateState((prev) => ({
      ...prev,
      activeDimension: dimension,
      activeEntityId: null,
      searchTerm: '',
      sortField: DEFAULT_STATE.sortField,
      sortDirection: DEFAULT_STATE.sortDirection,
    }), 'push');
  }, [updateState]);

  const switchPeriod = useCallback((period: Period) => {
    updateState((prev) => ({ ...prev, activePeriod: period }), 'push');
  }, [updateState]);

  const setActiveEntityId = useCallback((entityId: string | null) => {
    updateState((prev) => ({ ...prev, activeEntityId: entityId }), 'push');
  }, [updateState]);

  const setActiveTab = useCallback((tab: DetailTab) => {
    updateState((prev) => ({ ...prev, activeTab: tab }), 'push');
  }, [updateState]);

  const setSearchTerm = useCallback((searchTerm: string) => {
    updateState((prev) => ({ ...prev, searchTerm }), 'replace');
  }, [updateState]);

  const resetSearch = useCallback(() => {
    updateState((prev) => ({ ...prev, searchTerm: '' }), 'replace');
  }, [updateState]);

  const setSort = useCallback((field: SortField) => {
    updateState((prev) => {
      if (prev.sortField === field) {
        return {
          ...prev,
          sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        ...prev,
        sortField: field,
        sortDirection: 'desc',
      };
    }, 'replace');
  }, [updateState]);

  const resetSort = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      sortField: DEFAULT_STATE.sortField,
      sortDirection: DEFAULT_STATE.sortDirection,
    }), 'replace');
  }, [updateState]);

  return {
    ...state,
    switchDimension,
    switchPeriod,
    setActiveEntityId,
    setActiveTab,
    setSearchTerm,
    resetSearch,
    setSort,
    resetSort,
  };
}
