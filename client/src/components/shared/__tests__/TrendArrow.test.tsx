/* @vitest-environment happy-dom */
// FILE: client/src/components/shared/__tests__/TrendArrow.test.tsx
// PURPOSE: TDD tests for TrendArrow — verifies up/down/neutral arrows and inverted-metric support
// USED BY: vitest

import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { TrendArrow } from '../TrendArrow';

function renderIntoContainer(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(ui); });
  return {
    container,
    unmount: () => act(() => { root.unmount(); document.body.removeChild(container); }),
  };
}

describe('TrendArrow', () => {
  it('renders up arrow with trend-positive class when current > prev', () => {
    const { container, unmount } = renderIntoContainer(<TrendArrow current={100} prev={50} />);
    const el = container.querySelector('[data-testid="trend-arrow"]')!;
    expect(el.textContent).toBe('▲');
    expect(el.className).toContain('trend-positive');
    unmount();
  });

  it('renders down arrow with trend-negative class when current < prev', () => {
    const { container, unmount } = renderIntoContainer(<TrendArrow current={50} prev={100} />);
    const el = container.querySelector('[data-testid="trend-arrow"]')!;
    expect(el.textContent).toBe('▼');
    expect(el.className).toContain('trend-negative');
    unmount();
  });

  it('renders em-dash when prev is null', () => {
    const { container, unmount } = renderIntoContainer(<TrendArrow current={100} prev={null} />);
    const el = container.querySelector('[data-testid="trend-arrow"]')!;
    expect(el.textContent).toBe('—');
    unmount();
  });

  it('renders em-dash when current is null', () => {
    const { container, unmount } = renderIntoContainer(<TrendArrow current={null} prev={50} />);
    const el = container.querySelector('[data-testid="trend-arrow"]')!;
    expect(el.textContent).toBe('—');
    unmount();
  });

  it('renders em-dash when current === prev (no change)', () => {
    const { container, unmount } = renderIntoContainer(<TrendArrow current={100} prev={100} />);
    const el = container.querySelector('[data-testid="trend-arrow"]')!;
    expect(el.textContent).toBe('—');
    unmount();
  });

  it('inverts arrow direction when inverted=true (lower is better)', () => {
    // current(30) < prev(100) → raw down → inverted → up (good!)
    const { container, unmount } = renderIntoContainer(<TrendArrow current={30} prev={100} inverted={true} />);
    const el = container.querySelector('[data-testid="trend-arrow"]')!;
    expect(el.textContent).toBe('▲');
    expect(el.className).toContain('trend-positive');
    unmount();
  });

  it('inverted=true with current > prev shows down arrow (higher is worse)', () => {
    const { container, unmount } = renderIntoContainer(<TrendArrow current={100} prev={30} inverted={true} />);
    const el = container.querySelector('[data-testid="trend-arrow"]')!;
    expect(el.textContent).toBe('▼');
    expect(el.className).toContain('trend-negative');
    unmount();
  });
});
