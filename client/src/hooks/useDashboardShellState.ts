// FILE: client/src/hooks/useDashboardShellState.ts
// PURPOSE: URL-backed core shell state for the dashboard (dimension, period, entity, tab, search, sort)
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useDashboardShellState, DashboardShellState (re-export)

import { useCallback, useEffect, useState } from 'react';
import type { Dimension, Period } from '@shared/types/dashboard';
import type { DetailTab } from '../components/right-panel/detail-tab-types';
import type { SortField } from './sort-types';
import { parseSearchParams, buildSearch, DEFAULT_STATE } from './shell-state-url';
import type { DashboardShellState } from './shell-state-url';

export type { DashboardShellState };

type HistoryMode = 'push' | 'replace';

/** WHY: Thin wrapper around parseSearchParams that reads window.location */
function parseSearch(): DashboardShellState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  return parseSearchParams(new URLSearchParams(window.location.search));
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

  const togglePanel = useCallback(() => {
    updateState((prev) => ({ ...prev, panelCollapsed: !prev.panelCollapsed }), 'replace');
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
    togglePanel,
  };
}
