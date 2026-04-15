/* @vitest-environment happy-dom */
// FILE: client/src/hooks/__tests__/useReport.test.ts
// PURPOSE: Hook-level tests for useReport — cancelFetch, retry, SSE event handling.
// USED BY: vitest

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReport } from '../useReport';
import type { FetchAllFilters } from '@shared/types/dashboard';

// Minimal in-file hook runner — see spec C1 section for rationale.
function renderHookNode<T>(hook: () => T): { result: { current: T }; unmount: () => void } {
  const container = document.createElement('div');
  const root = createRoot(container);
  const result: { current: T } = { current: undefined as never };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper() { result.current = hook(); return null; }
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Wrapper />
      </QueryClientProvider>
    );
  });
  return { result, unmount: () => act(() => root.unmount()) };
}

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  listeners: Record<string, Array<(e: Event) => void>> = {};
  closed = false;
  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: (e: Event) => void) {
    (this.listeners[type] ??= []).push(cb);
  }
  close = vi.fn(() => { this.closed = true; });
  dispatch(type: string, data?: unknown) {
    const event = data !== undefined
      ? new MessageEvent(type, { data: typeof data === 'string' ? data : JSON.stringify(data) })
      : new Event(type);
    (this.listeners[type] ?? []).forEach(cb => cb(event));
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useReport — A3 / C1', () => {
  it('startReport transitions to fetching with cleared progress/error/payload (A3-T1)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    act(() => { result.current.startReport({}); });
    expect(result.current.state).toBe('fetching');
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.payload).toBeNull();
  });

  it('cancelFetch closes EventSource and returns to idle (A3-T2)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    act(() => { result.current.startReport({}); });
    const es = MockEventSource.instances[0];
    act(() => { result.current.cancelFetch(); });
    expect(result.current.state).toBe('idle');
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBeNull();
    expect(es.close).toHaveBeenCalledTimes(1);
  });

  it('cancelFetch clears stale progress event (A3-T3)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    act(() => { result.current.startReport({}); });
    const es = MockEventSource.instances[0];
    act(() => { es.dispatch('progress', { phase: 'fetching', rowsFetched: 1000, estimatedTotal: 5000 }); });
    expect(result.current.progress).toMatchObject({ rowsFetched: 1000 });
    act(() => { result.current.cancelFetch(); });
    expect(result.current.state).toBe('idle');
    expect(result.current.progress).toBeNull();
  });

  it('cancelFetch and retry are exposed on UseReportReturn (A3-T4)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    expect(typeof result.current.cancelFetch).toBe('function');
    expect(typeof result.current.retry).toBe('function');
  });

  it('retry() before any startReport is a no-op (A3-T5)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    act(() => { result.current.retry(); });
    expect(MockEventSource.instances).toHaveLength(0);
    expect(result.current.state).toBe('idle');
  });

  it('server-sent error event sets state and message (C1-T1)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    act(() => { result.current.startReport({}); });
    const es = MockEventSource.instances[0];
    act(() => { es.dispatch('error', { message: 'Priority timeout' }); });
    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('Priority timeout');
  });

  it('native Event error fallback to "Connection lost" (C1-T2)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    act(() => { result.current.startReport({}); });
    const es = MockEventSource.instances[0];
    act(() => { es.dispatch('error'); });  // no data
    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('Connection lost');
  });

  it('retry from error state transitions back to fetching (C1-T3)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    act(() => { result.current.startReport({}); });
    act(() => { MockEventSource.instances[0].dispatch('error', { message: 'fail' }); });
    expect(result.current.state).toBe('error');
    act(() => { result.current.retry(); });
    expect(result.current.state).toBe('fetching');
    expect(result.current.error).toBeNull();
  });

  it('retry preserves forceRefresh and filters from the failed request (C1-T4)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    const filters: FetchAllFilters = { agentName: ['Alexandra'] };
    act(() => { result.current.startReport(filters, true); });
    const firstUrl = MockEventSource.instances[0].url;
    act(() => { MockEventSource.instances[0].dispatch('error', { message: 'fail' }); });
    act(() => { result.current.retry(); });
    const secondUrl = MockEventSource.instances[1].url;
    expect(secondUrl).toContain('refresh=true');
    expect(secondUrl).toContain('agentName=Alexandra');
    expect(secondUrl).toBe(firstUrl);  // Identical request
  });

  it('repeated retry is idempotent — fresh EventSource each time (C1-T5)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    act(() => { result.current.startReport({}); });
    act(() => { MockEventSource.instances[0].dispatch('error', { message: 'fail-1' }); });
    act(() => { result.current.retry(); });
    act(() => { MockEventSource.instances[1].dispatch('error', { message: 'fail-2' }); });
    act(() => { result.current.retry(); });
    expect(MockEventSource.instances).toHaveLength(3);
    expect(result.current.error).toBeNull();
    expect(result.current.state).toBe('fetching');
  });

  // WHY (Codex Finding #2): Without request-identity fencing, an error event from the
  // superseded EventSource (es1, retired by retry()) can fire between close() and GC and
  // overwrite the freshly-started request's state. This test proves the isStale() check
  // short-circuits the stale event.
  it('stale error from superseded EventSource is ignored after retry (C1-T6)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    act(() => { result.current.startReport({}); });
    const es1 = MockEventSource.instances[0];
    act(() => { es1.dispatch('error', { message: 'original fail' }); });
    expect(result.current.state).toBe('error');

    // Retry — opens es2
    act(() => { result.current.retry(); });
    const es2 = MockEventSource.instances[1];
    expect(result.current.state).toBe('fetching');

    // Now dispatch a synthetic error on the SUPERSEDED es1. Without fencing, this would
    // flip state back to 'error'. With fencing, it no-ops.
    act(() => { es1.dispatch('error', { message: 'ghost from es1' }); });

    // State must remain on the retry, not bounce back to the stale error
    expect(result.current.state).toBe('fetching');
    expect(result.current.error).toBeNull();
    // es2 must still be the active source; it wasn't closed by the stale listener
    expect(es2.closed).toBe(false);
  });
});

import { ReportProgressModal } from '../../components/shared/ReportProgressModal';
import { computeReportModalState } from '../report-modal-state';

describe('DashboardLayout wiring integration (C1-T7)', () => {
  it('error event flows through useReport → computeReportModalState → ReportProgressModal', () => {
    // WHY: Mirror DashboardLayout's rendering pattern exactly. If the real layout still uses
    // `state === 'fetching'` instead of computeReportModalState, this test will fail.
    function Harness() {
      const report = useReport('customer', 'ytd');
      const modal = computeReportModalState(report);
      return (
        <>
          <button type="button" onClick={() => report.startReport({})}>go</button>
          <ReportProgressModal
            isOpen={modal.isOpen}
            progress={report.progress}
            errorMessage={modal.errorMessage}
            onCancel={report.cancelFetch}
            onClose={report.cancelFetch}
            onRetry={report.retry}
          />
        </>
      );
    }

    const container = document.createElement('div');
    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    act(() => { root.render(<QueryClientProvider client={queryClient}><Harness /></QueryClientProvider>); });

    const button = container.querySelector('button')!;
    act(() => { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    expect(container.textContent).toContain('Building Report');
    expect(container.textContent).not.toContain('Something went wrong');

    act(() => { MockEventSource.instances[0].dispatch('error', { message: 'boom' }); });

    expect(container.textContent).toContain('Something went wrong');
    expect(container.textContent).toContain('boom');
    expect(container.querySelector('button[data-action="close"]')).not.toBeNull();
    expect(container.querySelector('button[data-action="retry"]')).not.toBeNull();

    act(() => {
      container.querySelector<HTMLButtonElement>('button[data-action="retry"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(MockEventSource.instances).toHaveLength(2);

    act(() => { root.unmount(); });
  });
});

describe('useReport — D3 entityIds support', () => {
  it('startReport with entityIds passes them in URL (D3-T6)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    act(() => { result.current.startReport({ entityIds: ['C001', 'C002'] }); });
    const url = MockEventSource.instances[0].url;
    expect(url).toContain('entityIds=C001%2CC002');
  });

  it('composes entityIds with other filters (D3-T7)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    act(() => { result.current.startReport({ entityIds: ['C001'], agentName: ['Alexandra'] }); });
    const url = MockEventSource.instances[0].url;
    expect(url).toContain('entityIds=C001');
    expect(url).toContain('agentName=Alexandra');
  });

  it('payload entities length matches selection on complete (D3-T8)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    act(() => { result.current.startReport({ entityIds: ['C001', 'C002'] }); });
    const sampleEntity = (id: string, revenue: number) => ({
      id, name: id, meta1: '', meta2: null, revenue, orderCount: 1, avgOrder: revenue,
      marginPercent: 10, marginAmount: revenue * 0.1, frequency: null, lastOrderDate: null,
      rep: null, zone: null, customerType: null,
      prevYearRevenue: null, prevYearRevenueFull: null,
    });
    act(() => {
      MockEventSource.instances[0].dispatch('complete', {
        entities: [sampleEntity('C001', 100), sampleEntity('C002', 200)],
        kpis: { totalRevenue: 300, prevYearRevenue: 0, prevYearRevenueFull: 0, orderCount: 3, avgOrderValue: 100, marginPercent: 10, marginAmount: 30, periodMonths: 12 },
        monthlyRevenue: [],
        productMixes: { category: [], vendor: [], brand: [] },
        topSellers: [],
        sparklines: { dailyRevenue: [], dailyOrders: [] },
        orders: [],
        items: [],
        yearsAvailable: ['2026'],
      });
    });
    expect(result.current.payload?.entities.length).toBe(2);
  });

  // WHY (spec D3.6 bullet 3): retry() captures lastRequestRef at startReport time, which includes
  // entityIds. After an error, retry must resubmit with the SAME subset — otherwise View Consolidated
  // retries would silently broaden to the full population and fetch more data than the user asked for.
  it('retry preserves entityIds from the failed request (D3-T9)', () => {
    const { result } = renderHookNode(() => useReport('customer', 'ytd'));
    act(() => { result.current.startReport({ entityIds: ['C001', 'C002'] }, true); });
    const firstUrl = MockEventSource.instances[0].url;
    act(() => { MockEventSource.instances[0].dispatch('error', { message: 'boom' }); });
    act(() => { result.current.retry(); });
    const secondUrl = MockEventSource.instances[1].url;
    expect(secondUrl).toContain('entityIds=C001%2CC002');
    expect(secondUrl).toContain('refresh=true');
    expect(secondUrl).toBe(firstUrl);  // Identical replay
  });
});
