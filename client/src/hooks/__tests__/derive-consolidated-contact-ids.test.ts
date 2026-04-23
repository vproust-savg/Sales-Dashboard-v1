// FILE: client/src/hooks/__tests__/derive-consolidated-contact-ids.test.ts
// PURPOSE: Tests for deriveConsolidatedContactIds — decides when the consolidated contacts
//   query may fire, based on the report's filters.entityIds (View Consolidated discriminator).
// USED BY: vitest

import { describe, it, expect } from 'vitest';
import type { DashboardPayload, FetchAllFilters } from '@shared/types/dashboard';
import { deriveConsolidatedContactIds } from '../derive-consolidated-contact-ids';
import type { ReportState } from '../useReport';

// WHY: A small stub payload suffices — the helper only cares about presence/absence,
// not the entity shape. Cast via `as DashboardPayload` to avoid hand-building every field.
const stubPayload = (ids: string[]): DashboardPayload =>
  ({ entities: ids.map(id => ({ id })) } as unknown as DashboardPayload);

describe('deriveConsolidatedContactIds', () => {
  it('returns [] when report.filters has no entityIds (regular Report)', () => {
    expect(
      deriveConsolidatedContactIds({
        state: 'loaded',
        payload: stubPayload(Array.from({ length: 1876 }, (_, i) => `C${i}`)),
        filters: { agentName: ['Alex'] } satisfies FetchAllFilters,
      }),
    ).toEqual([]);
  });

  it('returns the selected entityIds when View Consolidated fires', () => {
    expect(
      deriveConsolidatedContactIds({
        state: 'loaded',
        payload: stubPayload(['C001', 'C002']),
        filters: { entityIds: ['C001', 'C002'] },
      }),
    ).toEqual(['C001', 'C002']);
  });

  it.each<ReportState>(['idle', 'configuring', 'fetching', 'error'])(
    'returns [] for non-loaded state: %s',
    (state) => {
      expect(
        deriveConsolidatedContactIds({
          state,
          payload: stubPayload(['C001']),
          filters: { entityIds: ['C001'] },
        }),
      ).toEqual([]);
    },
  );

  it('returns [] when filters.entityIds is an empty array', () => {
    expect(
      deriveConsolidatedContactIds({
        state: 'loaded',
        payload: stubPayload(['C001']),
        filters: { entityIds: [] },
      }),
    ).toEqual([]);
  });

  it('returns [] when payload is null even in loaded state', () => {
    expect(
      deriveConsolidatedContactIds({
        state: 'loaded',
        payload: null,
        filters: { entityIds: ['C001'] },
      }),
    ).toEqual([]);
  });
});
