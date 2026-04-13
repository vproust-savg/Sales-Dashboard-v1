// FILE: client/src/hooks/useCardNavigation.ts
// PURPOSE: Arrow key navigation between KPI card grid cells
// USED BY: KPISection.tsx
// EXPORTS: useCardNavigation

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * WHY: KPI section has a 2-column grid (hero occupies left column, 6 cards in right 2x3 grid).
 * Navigation order: Hero(0) → Orders(1) → AvgOrder(2) → Margin%(3) → Margin$(4) → Frequency(5) → LastOrder(6)
 * Arrow keys move through this flat index. Enter opens modal, Space triggers peek.
 */
export function useCardNavigation(cardCount: number) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const setCardRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    cardRefs.current[index] = el;
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (focusedIndex === null) return;
    /** WHY: Don't capture keys when user is typing in search/filter inputs */
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    let next = focusedIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      next = Math.min(focusedIndex + 1, cardCount - 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      next = Math.max(focusedIndex - 1, 0);
    }

    if (next !== focusedIndex) {
      setFocusedIndex(next);
      cardRefs.current[next]?.focus();
    }
  }, [focusedIndex, cardCount]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const onCardFocus = useCallback((index: number) => () => setFocusedIndex(index), []);
  const onCardBlur = useCallback(() => setFocusedIndex(null), []);

  return { focusedIndex, setCardRef, onCardFocus, onCardBlur };
}
