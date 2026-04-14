// FILE: client/src/layouts/__tests__/select-display-dashboard.test.ts
// PURPOSE: Tests for the pure function that decides which dashboard payload to render
// USED BY: test runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { selectDisplayDashboard } from '../select-display-dashboard';
import type { DashboardPayload } from '@shared/types/dashboard';

const allDashboard = { entities: [] } as unknown as DashboardPayload;
const consolDashboard = { entities: [] } as unknown as DashboardPayload;
const singleDashboard = { entities: [] } as unknown as DashboardPayload;

describe('selectDisplayDashboard', () => {
  it('returns dashboard (consolidated payload) when isConsolidated=true, even with __ALL__ + allDashboard present', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: true, activeEntityId: '__ALL__', allDashboard, dashboard: consolDashboard })
    ).toBe(consolDashboard);
  });

  it('returns allDashboard when activeEntityId=__ALL__, allDashboard exists, and not consolidated', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: false, activeEntityId: '__ALL__', allDashboard, dashboard: singleDashboard })
    ).toBe(allDashboard);
  });

  it('returns dashboard when activeEntityId=__ALL__ but allDashboard is null', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: false, activeEntityId: '__ALL__', allDashboard: null, dashboard: singleDashboard })
    ).toBe(singleDashboard);
  });

  it('returns dashboard when activeEntityId is a regular entity ID', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: false, activeEntityId: 'C7826', allDashboard, dashboard: singleDashboard })
    ).toBe(singleDashboard);
  });

  it('returns null when no entity is selected and nothing is loaded', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: false, activeEntityId: null, allDashboard: null, dashboard: null })
    ).toBeNull();
  });

  it('returns dashboard (consolidated) when isConsolidated=true and activeEntityId is a regular entity', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: true, activeEntityId: 'C7826', allDashboard, dashboard: consolDashboard })
    ).toBe(consolDashboard);
  });

  it('returns null when isConsolidated=true but consolidated data is still loading (dashboard=null)', () => {
    expect(
      selectDisplayDashboard({ isConsolidated: true, activeEntityId: '__ALL__', allDashboard, dashboard: null })
    ).toBeNull();
  });
});
