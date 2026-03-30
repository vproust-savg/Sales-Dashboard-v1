// FILE: client/src/hooks/useDimension.ts
// PURPOSE: Active dimension state + switching logic (resets handled by parent — spec 13.1)
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useDimension

import { useState, useCallback } from 'react';
import type { Dimension } from '@shared/types/dashboard';

export function useDimension() {
  const [activeDimension, setActiveDimension] = useState<Dimension>('customer');

  const switchDimension = useCallback((dimension: Dimension) => {
    setActiveDimension(dimension);
    // WHY: Spec Section 13.1 says switching dimensions resets filters, search, sort,
    // selection. The parent hook (useDashboardState) handles resetting other state
    // to keep this hook focused on a single concern.
  }, []);

  return { activeDimension, switchDimension };
}
