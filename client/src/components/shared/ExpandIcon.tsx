// FILE: client/src/components/shared/ExpandIcon.tsx
// PURPOSE: Tiny expand icon that fades in on card hover — signals click-to-expand
// USED BY: KPICard.tsx, HeroRevenueCard.tsx, ChartsRow.tsx
// EXPORTS: ExpandIcon

export function ExpandIcon() {
  return (
    <div className="absolute right-[var(--spacing-md)] top-[var(--spacing-md)] flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-gold-subtle)] text-[var(--color-text-faint)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M1 9L9 1M9 1H4M9 1v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
