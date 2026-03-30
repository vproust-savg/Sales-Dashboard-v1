// FILE: client/src/components/shared/AnimatedNumber.tsx
// PURPOSE: Counter animation for KPI values using Framer Motion useSpring
// USED BY: HeroRevenueCard.tsx, KPICard.tsx
// EXPORTS: AnimatedNumber

import { useEffect, useRef } from 'react';
import { useSpring, useMotionValue, useTransform, motion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  formatter: (n: number) => string;
}

/** WHY useSpring + useTransform: gives smooth digit rolling with slight overshoot per spec 21.3 */
const SPRING_CONFIG = { stiffness: 100, damping: 20, mass: 0.5 };

export function AnimatedNumber({ value, formatter }: AnimatedNumberProps) {
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, SPRING_CONFIG);
  const displayed = useTransform(springVal, (latest) => formatter(latest));
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      motionVal.set(0);
    }
    motionVal.set(value);
  }, [value, motionVal]);

  return (
    <motion.span className="tabular-nums">
      {displayed}
    </motion.span>
  );
}
