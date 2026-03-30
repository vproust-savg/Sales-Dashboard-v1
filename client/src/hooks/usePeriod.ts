// FILE: client/src/hooks/usePeriod.ts
// PURPOSE: Active period state (YTD, 2025, 2024, etc.)
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: usePeriod

import { useState, useCallback } from 'react';
import type { Period } from '@shared/types/dashboard';

export function usePeriod() {
  const [activePeriod, setActivePeriod] = useState<Period>('ytd');

  const switchPeriod = useCallback((period: Period) => {
    setActivePeriod(period);
  }, []);

  return { activePeriod, switchPeriod };
}
