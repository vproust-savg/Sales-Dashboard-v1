// FILE: client/src/components/shared/Badge.tsx
// PURPOSE: Reusable badge component with three variants (count, rank, status)
// USED BY: FilterSortToolbar (count), TopTenBestSellers (rank), OrdersTable (status), TabsSection (count)
// EXPORTS: Badge

/** WHY three variants: spec Section 8.4 defines distinct badge shapes for
 *  different contexts — circle for counts, square for ranks, pill for status. */

interface BadgeProps {
  variant: 'count' | 'rank' | 'status';
  value: string | number;
  /** For 'count': bg color (default gold-primary). For 'rank': bg color. For 'status': semantic color key. */
  color?: string;
  /** WHY invertColors: filter button in active (dark) state needs white bg + dark text */
  invertColors?: boolean;
}

/** Status color map — 15% opacity bg with matching text per spec Section 8.4 */
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  green: { bg: 'rgba(34, 197, 94, 0.15)', text: 'var(--color-green)' },
  yellow: { bg: 'rgba(234, 179, 8, 0.15)', text: 'var(--color-yellow)' },
  blue: { bg: 'rgba(59, 130, 246, 0.15)', text: 'var(--color-blue)' },
  red: { bg: 'rgba(239, 68, 68, 0.15)', text: 'var(--color-red)' },
};

/** Maps order status text to semantic color */
const STATUS_TO_COLOR: Record<string, string> = {
  Delivered: 'green',
  Pending: 'yellow',
  Processing: 'blue',
};

export function Badge({ variant, value, color, invertColors }: BadgeProps) {
  if (variant === 'count') {
    return <CountBadge value={value} color={color} invertColors={invertColors} />;
  }
  if (variant === 'rank') {
    return <RankBadge value={value} color={color} />;
  }
  return <StatusBadge value={value} color={color} />;
}

/** Circle badge — 18px diameter, white text on colored bg (spec Section 8.4) */
function CountBadge({
  value,
  color,
  invertColors,
}: {
  value: string | number;
  color?: string;
  invertColors?: boolean;
}) {
  const bgColor = invertColors
    ? 'var(--color-bg-card)'
    : (color ?? 'var(--color-gold-primary)');
  const textColor = invertColors
    ? 'var(--color-dark)'
    : '#fff';

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center leading-none"
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        backgroundColor: bgColor,
        color: textColor,
        fontSize: 9,
        fontWeight: 600,
      }}
      aria-hidden="true"
    >
      {value}
    </span>
  );
}

/** Square badge — 20x20px, border-radius 6px (spec Section 8.4) */
function RankBadge({ value, color }: { value: string | number; color?: string }) {
  const rank = typeof value === 'string' ? parseInt(value, 10) : value;
  /** WHY conditional: top 3 get gold-primary, 4-10 get gold-subtle per spec */
  const bgColor = color ?? (rank <= 3 ? 'var(--color-gold-primary)' : 'var(--color-gold-subtle)');
  const textColor = rank <= 3 ? '#fff' : 'var(--color-text-secondary)';

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center leading-none"
      style={{
        width: 20,
        height: 20,
        borderRadius: 6,
        backgroundColor: bgColor,
        color: textColor,
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      {value}
    </span>
  );
}

/** Pill badge — colored bg at 15% opacity + matching text (spec Section 8.4) */
function StatusBadge({ value, color }: { value: string | number; color?: string }) {
  const colorKey = color ?? STATUS_TO_COLOR[String(value)] ?? 'blue';
  const colors = STATUS_COLORS[colorKey] ?? STATUS_COLORS.blue;

  return (
    <span
      className="inline-flex items-center leading-none"
      style={{
        padding: '2px 8px',
        borderRadius: 4,
        backgroundColor: colors.bg,
        color: colors.text,
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {value}
    </span>
  );
}
