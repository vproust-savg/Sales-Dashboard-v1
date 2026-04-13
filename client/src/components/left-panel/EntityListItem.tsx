// FILE: client/src/components/left-panel/EntityListItem.tsx
// PURPOSE: Single row in the entity list — checkbox, name, meta1
// USED BY: client/src/components/left-panel/EntityList.tsx
// EXPORTS: EntityListItem (component)

import { motion } from 'framer-motion';
import type { EntityListItem as EntityListItemType } from '@shared/types/dashboard';

interface EntityListItemProps {
  entity: EntityListItemType;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onCheck: (id: string) => void;
  animationDelay?: number;
}

export function EntityListItem({ entity, isActive, isSelected, onSelect, onCheck, animationDelay = 0 }: EntityListItemProps) {
  /** WHY: active state uses asymmetric padding — 13px left compensates for 3px border */
  const paddingClass = isActive
    ? 'py-[var(--spacing-lg)] pr-[var(--spacing-2xl)] pl-[13px]'
    : 'py-[var(--spacing-lg)] px-[var(--spacing-2xl)]';

  const bgClass = isActive
    ? 'bg-[#f0ebe3]'
    : isSelected
      ? 'bg-[#f7f3ed]'
      : 'bg-transparent hover:bg-[var(--color-gold-hover)]';

  return (
    <motion.div
      role="option"
      aria-selected={isSelected}
      aria-current={isActive || undefined}
      tabIndex={isActive ? 0 : -1}
      onClick={() => onSelect(entity.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(entity.id);
        }
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay, duration: 0.2 }}
      className={`
        relative flex cursor-pointer items-start gap-[var(--spacing-md)]
        ${paddingClass} ${bgClass}
        transition-colors duration-100
      `}
    >
      {/* WHY: 3px gold left border indicates active item — spec Section 3.5 */}
      {isActive && (
        <div className="absolute left-0 top-0 h-full w-[3px] rounded-r-[2px] bg-[var(--color-gold-primary)]" />
      )}

      {/* Circular checkbox — 18x18, gold fill when selected */}
      <button
        type="button"
        aria-label={`Select ${entity.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onCheck(entity.id);
        }}
        className={`
          mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center
          rounded-full border transition-colors duration-100
          ${isSelected
            ? 'border-[var(--color-gold-primary)] bg-[var(--color-gold-primary)]'
            : 'border-[var(--color-gold-muted)] bg-transparent hover:border-[var(--color-gold-primary)]'
          }
        `}
      >
        {isSelected && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Entity content — name, meta1 */}
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-2xs)]">
        <span className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
          {entity.name}
        </span>
        <span className="truncate text-[11px] text-[var(--color-text-muted)]">
          {entity.meta1}
        </span>
      </div>
    </motion.div>
  );
}
