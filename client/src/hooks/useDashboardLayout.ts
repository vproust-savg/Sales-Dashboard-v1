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

  /** WHY functional updaters: Callbacks stay stable across renders — critical during drag
   *  where mousemove fires many times between re-renders. Using `prev =>` avoids stale closures. */
  const setPreset = useCallback((preset: Exclude<LayoutPreset, 'custom'>) => {
    setState(prev => {
      const next = { ...prev, preset, ...PRESET_VALUES[preset] };
      saveToStorage(next);
      return next;
    });
  }, []);

  const togglePanel = useCallback(() => {
    setState(prev => {
      const next = { ...prev, panelCollapsed: !prev.panelCollapsed };
      saveToStorage(next);
      return next;
    });
  }, []);

  const setHeroKpiRatio = useCallback((ratio: [number, number]) => {
    setState(prev => {
      const next: DashboardLayoutState = { ...prev, heroKpiRatio: ratio, preset: 'custom' };
      saveToStorage(next);
      return next;
    });
  }, []);

  const setKpiChartsRatio = useCallback((ratio: [number, number]) => {
    setState(prev => {
      const next: DashboardLayoutState = { ...prev, kpiChartsRatio: ratio, preset: 'custom' };
      saveToStorage(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    const defaults = buildDefaults();
    setState(defaults);
    saveToStorage(defaults);
  }, []);

  /** WHY useMemo: Stable grid template string avoids re-renders when ratio hasn't changed.
   *  Includes 6px divider column so consumers don't need to split and rebuild. */
  const heroKpiGridTemplate = useMemo(
    () => `${state.heroKpiRatio[0]}fr 6px ${state.heroKpiRatio[1]}fr`,
    [state.heroKpiRatio],
  );

  return {
    layout: state,
    heroKpiGridTemplate,
    setPreset,
    togglePanel,
    setHeroKpiRatio,
    setKpiChartsRatio,
    reset,
  };
}
