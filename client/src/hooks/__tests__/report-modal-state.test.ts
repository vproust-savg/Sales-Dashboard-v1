// FILE: client/src/hooks/__tests__/report-modal-state.test.ts
// PURPOSE: Verify the pure helper that maps useReport state to ReportProgressModal props.
// USED BY: vitest

import { describe, it, expect } from 'vitest';
import { computeReportModalState } from '../report-modal-state';
import type { UseReportReturn } from '../useReport';

function makeReport(overrides: Partial<UseReportReturn>): UseReportReturn {
  return {
    state: 'idle',
    progress: null,
    payload: null,
    error: null,
    filters: {},
    open: () => {},
    cancel: () => {},
    cancelFetch: () => {},
    retry: () => {},
    startReport: () => {},
    abort: () => {},
    reset: () => {},
    ...overrides,
  } as UseReportReturn;
}

describe('computeReportModalState', () => {
  it('returns closed for idle state (MS-T1)', () => {
    const result = computeReportModalState(makeReport({ state: 'idle' }));
    expect(result).toEqual({ isOpen: false, mode: null, errorMessage: null });
  });

  it('returns open + fetching for fetching state (MS-T2)', () => {
    const result = computeReportModalState(makeReport({ state: 'fetching' }));
    expect(result).toEqual({ isOpen: true, mode: 'fetching', errorMessage: null });
  });

  it('returns open + error + message for error state (MS-T3)', () => {
    const result = computeReportModalState(makeReport({ state: 'error', error: 'Priority timeout' }));
    expect(result).toEqual({ isOpen: true, mode: 'error', errorMessage: 'Priority timeout' });
  });

  it('returns closed for loaded state (MS-T4)', () => {
    const result = computeReportModalState(makeReport({ state: 'loaded' }));
    expect(result).toEqual({ isOpen: false, mode: null, errorMessage: null });
  });

  it('returns closed for configuring state (MS-T5)', () => {
    const result = computeReportModalState(makeReport({ state: 'configuring' }));
    expect(result).toEqual({ isOpen: false, mode: null, errorMessage: null });
  });
});
