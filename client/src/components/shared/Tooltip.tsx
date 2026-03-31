// FILE: client/src/components/shared/Tooltip.tsx
// PURPOSE: Reusable hover tooltip — dark background, positioned below trigger element
// USED BY: client/src/components/right-panel/BestSellers.tsx
// EXPORTS: Tooltip

import { useState, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), 200);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 z-50 mt-1 whitespace-nowrap rounded-[var(--radius-base)] bg-[var(--color-dark)] px-[10px] py-[6px] text-[12px] text-white shadow-[var(--shadow-card)]"
            role="tooltip"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
