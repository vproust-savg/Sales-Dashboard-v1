// FILE: client/src/components/left-panel/ViewConsolidatedButton.tsx
// PURPOSE: "View Consolidated" button inside SelectionBar
// USED BY: client/src/components/left-panel/SelectionBar.tsx
// EXPORTS: ViewConsolidatedButton

interface ViewConsolidatedButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function ViewConsolidatedButton({ onClick, disabled = false }: ViewConsolidatedButtonProps) {
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
      aria-label="View Consolidated"
    >
      View Consolidated
    </button>
  );
}
