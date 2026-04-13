// FILE: client/src/hooks/useResizablePanel.ts
// PURPOSE: Mouse/touch drag logic for section resize dividers
// USED BY: KPISection.tsx (horizontal), RightPanel.tsx (vertical)
// EXPORTS: useResizablePanel

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseResizablePanelOptions {
  direction: 'horizontal' | 'vertical';
  defaultRatio: [number, number];
  minPercent?: number;
  maxPercent?: number;
  onRatioChange: (ratio: [number, number]) => void;
}

export function useResizablePanel({
  direction,
  defaultRatio,
  minPercent = 30,
  maxPercent = 70,
  onRatioChange,
}: UseResizablePanelOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ pos: 0, ratio: defaultRatio });

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const clientPos = 'touches' in e
      ? (direction === 'horizontal' ? e.touches[0].clientX : e.touches[0].clientY)
      : (direction === 'horizontal' ? e.clientX : e.clientY);

    startRef.current = { pos: clientPos, ratio: [...defaultRatio] as [number, number] };
    setIsDragging(true);
  }, [direction, defaultRatio]);

  useEffect(() => {
    if (!isDragging) return;

    const container = containerRef.current;
    if (!container) return;

    const totalSize = direction === 'horizontal' ? container.offsetWidth : container.offsetHeight;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientPos = 'touches' in e
        ? (direction === 'horizontal' ? e.touches[0].clientX : e.touches[0].clientY)
        : (direction === 'horizontal' ? e.clientX : e.clientY);

      const delta = clientPos - startRef.current.pos;
      const deltaPercent = (delta / totalSize) * 100;
      const [a, b] = startRef.current.ratio;
      const totalParts = a + b;
      const originalPercent = (a / totalParts) * 100;
      const newPercent = Math.max(minPercent, Math.min(maxPercent, originalPercent + deltaPercent));
      /** WHY round to integers: Fractional fr values cause subpixel rendering jitter */
      const newA = Math.round(newPercent);
      const newB = 100 - newA;
      onRatioChange([newA, newB]);
    };

    const handleUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, direction, minPercent, maxPercent, onRatioChange]);

  return { containerRef, isDragging, handleMouseDown };
}
