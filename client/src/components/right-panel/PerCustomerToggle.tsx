// FILE: client/src/components/right-panel/PerCustomerToggle.tsx
// PURPOSE: Two-state switch used inside expanded KPI/chart modals to flip between aggregated and per-customer views
// USED BY: kpi-modal-content.tsx, ProductMixExpanded, BestSellersExpanded, ItemsExplorer (expanded)
// EXPORTS: PerCustomerToggle, PerCustomerMode

export type PerCustomerMode = 'aggregated' | 'per-customer';

interface PerCustomerToggleProps {
  mode: PerCustomerMode;
  onChange: (mode: PerCustomerMode) => void;
  entityLabel?: string;
}

export function PerCustomerToggle({ mode, onChange, entityLabel }: PerCustomerToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="View mode"
      className="inline-flex rounded-full bg-[var(--color-gold-subtle)] p-[2px]"
    >
      <ToggleOption label="Aggregated" active={mode === 'aggregated'} onClick={() => onChange('aggregated')} />
      <ToggleOption label={`Per ${entityLabel ?? 'Customer'}`} active={mode === 'per-customer'} onClick={() => onChange('per-customer')} />
    </div>
  );
}

function ToggleOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`
        rounded-full px-[var(--spacing-2xl)] py-[var(--spacing-xs)]
        text-[11px] font-medium transition-colors duration-150
        ${active
          ? 'bg-[var(--color-gold-primary)] text-white'
          : 'bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}
      `}
    >
      {label}
    </button>
  );
}
