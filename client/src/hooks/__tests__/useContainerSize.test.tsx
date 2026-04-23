/* @vitest-environment happy-dom */
// FILE: client/src/hooks/__tests__/useContainerSize.test.tsx
// PURPOSE: Contract tests for useContainerSize — re-observes on DOM node swap, updates size state
//   when the newly attached observer fires, and disconnects the old observer on swap.
// USED BY: vitest

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useContainerSize } from '../useContainerSize';

// WHY: React 18+ requires this flag for act() in non-RTL test harnesses.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// WHY: happy-dom lacks ResizeObserver. Stub with a spy class we can fire manually.
// Each instance tracks its observed elements and exposes `fire(w, h)` so tests drive
// the reactive loop without waiting on real layout.
class MockResizeObserver {
  static all: MockResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
    MockResizeObserver.all.push(this);
  }
  observe(el: Element): void { this.observed.push(el); }
  unobserve(el: Element): void { this.observed = this.observed.filter(x => x !== el); }
  disconnect(): void { this.disconnected = true; }
  fire(width: number, height: number): void {
    const entry = {
      contentRect: { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) },
    } as unknown as ResizeObserverEntry;
    this.cb([entry], this as unknown as ResizeObserver);
  }
}

beforeEach(() => {
  MockResizeObserver.all = [];
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Which = 'A' | 'B' | 'none';

function mountHarness(Harness: (props: { which: Which }) => React.ReactNode): {
  container: HTMLDivElement;
  root: Root;
  setWhich: (w: Which) => void;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const setWhich = (w: Which): void => {
    act(() => { root.render(<Harness which={w} />); });
  };
  const unmount = (): void => {
    act(() => { root.unmount(); });
    container.remove();
  };
  return { container, root, setWhich, unmount };
}

describe('useContainerSize — re-observe on DOM node swap', () => {
  it('T1: attaches a new observer to the remounted element after the observed node unmounts and remounts', () => {
    const Harness = ({ which }: { which: Which }): React.ReactNode => {
      const [ref] = useContainerSize();
      if (which === 'none') return null;
      return <div ref={ref} data-testid={which} />;
    };
    const h = mountHarness(Harness);
    h.setWhich('A');
    const divA = h.container.querySelector('[data-testid="A"]') as HTMLDivElement;
    expect(divA).toBeTruthy();
    expect(MockResizeObserver.all.length).toBe(1);
    expect(MockResizeObserver.all[0].observed).toContain(divA);

    h.setWhich('none');
    h.setWhich('B');
    const divB = h.container.querySelector('[data-testid="B"]') as HTMLDivElement;
    expect(divB).toBeTruthy();

    // Contract: some active (not-disconnected) observer must currently be observing divB.
    const activelyObservingB = MockResizeObserver.all.filter(
      o => !o.disconnected && o.observed.includes(divB),
    );
    expect(activelyObservingB.length).toBeGreaterThanOrEqual(1);
    h.unmount();
  });

  it('T2: size state updates when the observer attached to the remounted element fires', () => {
    let capturedSize = { width: 0, height: 0 };
    const Harness = ({ which }: { which: Which }): React.ReactNode => {
      const [ref, size] = useContainerSize();
      capturedSize = size;
      if (which === 'none') return null;
      return <div ref={ref} data-testid={which} />;
    };
    const h = mountHarness(Harness);
    h.setWhich('A');
    h.setWhich('none');
    h.setWhich('B');
    const divB = h.container.querySelector('[data-testid="B"]') as HTMLDivElement;

    // Find the observer tied to the remounted element and fire it with a real measurement.
    const obsForB = MockResizeObserver.all.find(
      o => !o.disconnected && o.observed.includes(divB),
    );
    expect(obsForB).toBeDefined();
    act(() => { obsForB!.fire(640, 300); });

    expect(capturedSize).toEqual({ width: 640, height: 300 });
    h.unmount();
  });

  it('T3: old observer is disconnected when the observed element swaps', () => {
    const Harness = ({ which }: { which: Which }): React.ReactNode => {
      const [ref] = useContainerSize();
      if (which === 'none') return null;
      return <div ref={ref} data-testid={which} />;
    };
    const h = mountHarness(Harness);
    h.setWhich('A');
    const first = MockResizeObserver.all[0];
    expect(first).toBeDefined();

    h.setWhich('none');
    h.setWhich('B');

    // The original observer must have been disconnected so it doesn't keep writing
    // zero-size callbacks from the detached element into state.
    expect(first.disconnected).toBe(true);
    h.unmount();
  });
});
