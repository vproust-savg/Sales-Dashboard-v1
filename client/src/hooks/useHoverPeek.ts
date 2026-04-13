// FILE: client/src/hooks/useHoverPeek.ts
// PURPOSE: Hover delay timer + floating panel positioning for card peek previews
// USED BY: KPICard, HeroRevenueCard, ChartsRow cards
// EXPORTS: useHoverPeek

import { useState, useCallback, useRef, useEffect } from 'react';

interface PeekPosition {
  top: number;
  left: number;
  arrowSide: 'left' | 'right' | 'top';
}

export interface UseHoverPeekReturn {
  isVisible: boolean;
  position: PeekPosition | null;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  /** WHY: Call on peek panel mouse enter/leave to keep peek open when cursor moves to it */
  onPeekMouseEnter: () => void;
  onPeekMouseLeave: () => void;
}

const PEEK_DELAY = 400;
const PEEK_WIDTH = 320;
const PEEK_MARGIN = 12;

export function useHoverPeek(): UseHoverPeekReturn {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<PeekPosition | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOverRef = useRef({ trigger: false, peek: false });

  const calculatePosition = useCallback((): PeekPosition | null => {
    const el = triggerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;

    /** WHY: Prefer right side, fall back to left, fall back to below */
    if (rect.right + PEEK_MARGIN + PEEK_WIDTH < vw) {
      return { top: rect.top, left: rect.right + PEEK_MARGIN, arrowSide: 'left' };
    } else if (rect.left - PEEK_MARGIN - PEEK_WIDTH > 0) {
      return { top: rect.top, left: rect.left - PEEK_MARGIN - PEEK_WIDTH, arrowSide: 'right' };
    }
    return { top: rect.bottom + PEEK_MARGIN, left: rect.left, arrowSide: 'top' };
  }, []);

  const startClose = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (!isOverRef.current.trigger && !isOverRef.current.peek) {
        setIsVisible(false);
      }
    }, 150);
  }, []);

  const onMouseEnter = useCallback(() => {
    isOverRef.current.trigger = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setPosition(calculatePosition());
      setIsVisible(true);
    }, PEEK_DELAY);
  }, [calculatePosition]);

  const onMouseLeave = useCallback(() => {
    isOverRef.current.trigger = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    startClose();
  }, [startClose]);

  const onPeekMouseEnter = useCallback(() => {
    isOverRef.current.peek = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const onPeekMouseLeave = useCallback(() => {
    isOverRef.current.peek = false;
    startClose();
  }, [startClose]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return { isVisible, position, triggerRef, onMouseEnter, onMouseLeave, onPeekMouseEnter, onPeekMouseLeave };
}
