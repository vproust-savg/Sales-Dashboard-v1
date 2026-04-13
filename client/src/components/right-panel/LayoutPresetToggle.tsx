// FILE: client/src/components/right-panel/LayoutPresetToggle.tsx
// PURPOSE: 3-segment pill toggle: Compact / Balanced / Spacious — matches PeriodSelector style
// USED BY: DetailHeader.tsx
// EXPORTS: LayoutPresetToggle

import { motion } from 'framer-motion';
import type { LayoutPreset } from '../../hooks/useDashboardLayout';

interface LayoutPresetToggleProps {
  activePreset: LayoutPreset;
  onPresetChange: (preset: Exclude<LayoutPreset, 'custom'>) => void;
}

const PRESETS: { key: Exclude<LayoutPreset, 'custom'>; label: string }[] = [
  { key: 'compact', label: 'Compact' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'spacious', label: 'Spacious' },
];

export function LayoutPresetToggle({ activePreset, onPresetChange }: LayoutPresetToggleProps) {
  return (
    <div
      className="flex gap-[var(--spacing-2xs)] rounded-[var(--radius-lg)] bg-[var(--color-bg-page)] p-[3px]"
      role="radiogroup"
      aria-label="Layout density"
    >
      {PRESETS.map(({ key, label }) => {
        const isActive = activePreset === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onPresetChange(key)}
            className="relative cursor-pointer rounded-[var(--radius-base)] px-[var(--spacing-lg)] py-[var(--spacing-xs)] text-[11px] font-medium transition-colors"
            style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
          >
            {isActive && (
              <motion.span
                layoutId="preset-active-pill"
                className="absolute inset-0 rounded-[var(--radius-base)] bg-[var(--color-bg-card)]"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
