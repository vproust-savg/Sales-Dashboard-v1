// FILE: client/src/components/left-panel/ViewConsolidated2Button.tsx
// PURPOSE: "View Consolidated 2" button inside SelectionBar — second row below v1 button
// USED BY: client/src/components/left-panel/SelectionBar.tsx
// EXPORTS: ViewConsolidated2Button

interface ViewConsolidated2ButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function ViewConsolidated2Button({ onClick, disabled = false }: ViewConsolidated2ButtonProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? 'No entities selected' : 'View consolidated data for selected entities'}
      className={`
        h-[32px] rounded-[var(--radius-base)] bg-[var(--color-gold-primary)]
        px-[var(--spacing-lg)] py-[5px] text-[11px] font-medium text-white
        transition-colors duration-150
        ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-[var(--color-gold-hover)]'}
      `}
      aria-label="View Consolidated 2"
    >
      View Consolidated 2
    </button>
  );
}
