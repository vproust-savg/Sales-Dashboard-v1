// FILE: client/src/hooks/useContainerSize.ts
// PURPOSE: ResizeObserver wrapper — returns { width, height } of a container element
// USED BY: HeroRevenueCard.tsx (chart container)
// EXPORTS: useContainerSize

import { useState, useEffect, useRef, type RefObject } from 'react';

interface ContainerSize {
  width: number;
  height: number;
}

export function useContainerSize(): [RefObject<HTMLDivElement | null>, ContainerSize] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
