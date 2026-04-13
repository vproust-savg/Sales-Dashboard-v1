// FILE: client/src/components/right-panel/ResizeDivider.tsx
// PURPOSE: Invisible divider element with gold line on hover, drag cursor
// USED BY: KPISection.tsx, RightPanel.tsx
// EXPORTS: ResizeDivider

interface ResizeDividerProps {
  direction: 'horizontal' | 'vertical';
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

export function ResizeDivider({ direction, isDragging, onMouseDown, onTouchStart }: ResizeDividerProps) {
  const isHorizontal = direction === 'horizontal';

  return (
    <div
      role="separator"
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      className={`group/divider relative shrink-0 ${
        isHorizontal
          ? 'w-[6px] cursor-col-resize'
          : 'h-[6px] cursor-row-resize'
      }`}
    >
      {/* WHY: Visible line only on hover/drag — invisible by default for clean aesthetic */}
      <div
        className={`absolute transition-colors duration-150 ${
          isHorizontal
            ? 'left-[2px] top-0 h-full w-[2px]'
            : 'left-0 top-[2px] h-[2px] w-full'
        } ${
          isDragging
            ? 'bg-[var(--color-gold-primary)]'
            : 'bg-transparent group-hover/divider:bg-[var(--color-gold-muted)]'
        }`}
      />
    </div>
  );
}
