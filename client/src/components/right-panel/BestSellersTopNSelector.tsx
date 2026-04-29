// FILE: client/src/components/right-panel/BestSellersTopNSelector.tsx
// PURPOSE: Segmented pill selector for Top 20 / 50 / 100 in the Best Sellers modal
// USED BY: client/src/components/right-panel/ChartsRow.tsx (via headerActions slot)
// EXPORTS: BestSellersTopNSelector, type TopNValue

export type TopNValue = 20 | 50 | 100;

const OPTIONS: TopNValue[] = [20, 50, 100];

interface Props {
  value: TopNValue;
  onChange: (next: TopNValue) => void;
  /** Total rows available (server cap is 100). Pills exceeding this are disabled. */
  available: number;
}

export function BestSellersTopNSelector({ value, onChange, available }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Number of products to display"
      className="inline-flex items-center rounded-[var(--radius-full)] bg-[var(--color-gold-subtle)] p-[2px]"
    >
      {OPTIONS.map(opt => {
        const disabled = available < opt && opt !== OPTIONS[0];
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={disabled}
            disabled={disabled}
            onClick={() => onChange(opt)}
            title={disabled ? `Only ${available} products in this view` : undefined}
            className={[
              'min-w-[40px] cursor-pointer rounded-[var(--radius-full)] px-[var(--spacing-md)] py-[4px]',
              'text-[12px] font-semibold transition-colors',
              active
                ? 'bg-[var(--color-gold-primary)] text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
              disabled ? 'cursor-not-allowed opacity-40 hover:text-[var(--color-text-muted)]' : '',
            ].join(' ')}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
