// FILE: client/src/hooks/useContainerSize.ts
// PURPOSE: ResizeObserver wrapper — returns [ref-callback, { width, height }] of a container.
//   Uses a state-backed callback ref so the observer re-attaches when the observed element
//   conditionally unmounts and remounts (e.g. a chart container that's hidden by a toggle).
// USED BY: HeroRevenueCard.tsx, kpi-modal-content.tsx
// EXPORTS: useContainerSize

import { useState, useEffect, useCallback } from 'react';

interface ContainerSize {
  width: number;
  height: number;
}

type ContainerRefCallback = (el: HTMLDivElement | null) => void;

export function useContainerSize(): [ContainerRefCallback, ContainerSize] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });

  // WHY: Keep the returned ref callback stable so React doesn't treat it as "changed"
  // on every render — that would detach and re-attach the observer each commit.
  const ref = useCallback<ContainerRefCallback>((el) => { setNode(el); }, []);

  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [ref, size];
}
