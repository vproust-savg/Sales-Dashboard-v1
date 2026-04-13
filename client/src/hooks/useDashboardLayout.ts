// FILE: client/src/hooks/useDashboardLayout.ts
// PURPOSE: Central layout state — presets, panel collapse, resize ratios, localStorage persistence
// USED BY: DashboardLayout.tsx, DetailHeader.tsx, KPISection.tsx, RightPanel.tsx
// EXPORTS: useDashboardLayout, DashboardLayoutState, LayoutPreset

import { useState, useCallback, useMemo } from 'react';

export type LayoutPreset = 'compact' | 'balanced' | 'spacious' | 'custom';

export interface DashboardLayoutState {
  preset: LayoutPreset;
  panelCollapsed: boolean;
  heroKpiRatio: [number, number];
  kpiChartsRatio: [number, number];
}

interface StoredLayout {
  version: number;
  preset: LayoutPreset;
  panelCollapsed: boolean;
  heroKpiRatio: [number, number];
  kpiChartsRatio: [number, number];
}

const STORAGE_KEY = 'sg-dashboard-layout';
const SCHEMA_VERSION = 1;

const PRESET_VALUES: Record<Exclude<LayoutPreset, 'custom'>, Pick<DashboardLayoutState, 'heroKpiRatio' | 'kpiChartsRatio'>> = {
  compact:  { heroKpiRatio: [2, 3], kpiChartsRatio: [6, 5] },
  balanced: { heroKpiRatio: [3, 2], kpiChartsRatio: [1, 1] },
  spacious: { heroKpiRatio: [3, 2], kpiChartsRatio: [5, 6] },
};

function detectDefaultPreset(): Exclude<LayoutPreset, 'custom'> {
  if (typeof window === 'undefined') return 'balanced';
  return window.innerWidth < 1280 ? 'compact' : 'balanced';
}

function loadFromStorage(): DashboardLayoutState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredLayout = JSON.parse(raw);
    if (parsed.version !== SCHEMA_VERSION) return null;
    return {
      preset: parsed.preset,
      panelCollapsed: parsed.panelCollapsed,
      heroKpiRatio: parsed.heroKpiRatio,
      kpiChartsRatio: parsed.kpiChartsRatio,
    };
  } catch {
    return null;
  }
}

function saveToStorage(state: DashboardLayoutState): void {
  const stored: StoredLayout = { version: SCHEMA_VERSION, ...state };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function buildDefaults(): DashboardLayoutState {
  const preset = detectDefaultPreset();
  return {
    preset,
    panelCollapsed: typeof window !== 'undefined' && window.innerWidth < 1280,
    ...PRESET_VALUES[preset],
  };
}

export function useDashboardLayout() {
  const [state, setState] = useState<DashboardLayoutState>(() => loadFromStorage() ?? buildDefaults());

  const persist = useCallback((next: DashboardLayoutState) => {
    setState(next);
    saveToStorage(next);
  }, []);

  const setPreset = useCallback((preset: Exclude<LayoutPreset, 'custom'>) => {
    persist({ ...state, preset, ...PRESET_VALUES[preset] });
  }, [state, persist]);

  const togglePanel = useCallback(() => {
    persist({ ...state, panelCollapsed: !state.panelCollapsed });
  }, [state, persist]);

  const setHeroKpiRatio = useCallback((ratio: [number, number]) => {
    persist({ ...state, heroKpiRatio: ratio, preset: 'custom' });
  }, [state, persist]);

  const setKpiChartsRatio = useCallback((ratio: [number, number]) => {
    persist({ ...state, kpiChartsRatio: ratio, preset: 'custom' });
  }, [state, persist]);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    const defaults = buildDefaults();
    setState(defaults);
    saveToStorage(defaults);
  }, []);

  /** WHY useMemo: Stable grid template string avoids re-renders when ratio hasn't changed */
  const heroKpiTemplate = useMemo(
    () => `${state.heroKpiRatio[0]}fr ${state.heroKpiRatio[1]}fr`,
    [state.heroKpiRatio],
  );

  return {
    layout: state,
    heroKpiTemplate,
    setPreset,
    togglePanel,
    setHeroKpiRatio,
    setKpiChartsRatio,
    reset,
  };
}
