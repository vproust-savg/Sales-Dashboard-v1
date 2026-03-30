// FILE: client/src/components/left-panel/SearchBox.tsx
// PURPOSE: Search input with magnifying glass icon for filtering the entity list
// USED BY: client/src/components/left-panel/LeftPanel.tsx
// EXPORTS: SearchBox

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function SearchBox({ value, onChange, placeholder }: SearchBoxProps) {
  return (
    <div className="flex h-[36px] items-center gap-[var(--spacing-md)] rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] px-[var(--spacing-xl)] py-[var(--spacing-base)] shadow-[var(--shadow-card)]">
      {/* WHY: inline SVG avoids an icon library dependency for a single icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="shrink-0 text-[var(--color-text-muted)]"
      >
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <input
        type="text"
        role="searchbox"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-faint)]"
      />
    </div>
  );
}
