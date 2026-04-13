// FILE: client/src/components/shared/HoverPeek.tsx
// PURPOSE: Floating preview panel with arrow, rendered via portal
// USED BY: KPICard, HeroRevenueCard, ChartsRow cards
// EXPORTS: HoverPeek

import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface HoverPeekProps {
  isVisible: boolean;
  position: { top: number; left: number; arrowSide: 'left' | 'right' | 'top' } | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  children: ReactNode;
}

export function HoverPeek({ isVisible, position, onMouseEnter, onMouseLeave, children }: HoverPeekProps) {
  return createPortal(
    <AnimatePresence>
      {isVisible && position && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="fixed z-50 w-[320px] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-dropdown)]"
          style={{ top: position.top, left: position.left }}
        >
          {/* Arrow indicator */}
          {position.arrowSide === 'left' && (
            <div className="absolute -left-[6px] top-[20px] h-3 w-3 rotate-45 bg-[var(--color-bg-card)]" style={{ boxShadow: '-2px 2px 4px rgba(0,0,0,0.06)' }} />
          )}
          {position.arrowSide === 'right' && (
            <div className="absolute -right-[6px] top-[20px] h-3 w-3 rotate-45 bg-[var(--color-bg-card)]" style={{ boxShadow: '2px -2px 4px rgba(0,0,0,0.06)' }} />
          )}
          {position.arrowSide === 'top' && (
            <div className="absolute -top-[6px] left-[20px] h-3 w-3 rotate-45 bg-[var(--color-bg-card)]" style={{ boxShadow: '-2px -2px 4px rgba(0,0,0,0.06)' }} />
          )}
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
