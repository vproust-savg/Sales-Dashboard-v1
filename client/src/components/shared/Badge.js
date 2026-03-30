import { jsx as _jsx } from "react/jsx-runtime";
/** Status color map — 15% opacity bg with matching text per spec Section 8.4 */
const STATUS_COLORS = {
    green: { bg: 'rgba(34, 197, 94, 0.15)', text: 'var(--color-green)' },
    yellow: { bg: 'rgba(234, 179, 8, 0.15)', text: 'var(--color-yellow)' },
    blue: { bg: 'rgba(59, 130, 246, 0.15)', text: 'var(--color-blue)' },
    red: { bg: 'rgba(239, 68, 68, 0.15)', text: 'var(--color-red)' },
};
/** Maps order status text to semantic color */
const STATUS_TO_COLOR = {
    Delivered: 'green',
    Pending: 'yellow',
    Processing: 'blue',
};
export function Badge({ variant, value, color, invertColors }) {
    if (variant === 'count') {
        return _jsx(CountBadge, { value: value, color: color, invertColors: invertColors });
    }
    if (variant === 'rank') {
        return _jsx(RankBadge, { value: value, color: color });
    }
    return _jsx(StatusBadge, { value: value, color: color });
}
/** Circle badge — 18px diameter, white text on colored bg (spec Section 8.4) */
function CountBadge({ value, color, invertColors, }) {
    const bgColor = invertColors
        ? 'var(--color-bg-card)'
        : (color ?? 'var(--color-gold-primary)');
    const textColor = invertColors
        ? 'var(--color-dark)'
        : '#fff';
    return (_jsx("span", { className: "inline-flex shrink-0 items-center justify-center leading-none", style: {
            width: 18,
            height: 18,
            borderRadius: '50%',
            backgroundColor: bgColor,
            color: textColor,
            fontSize: 9,
            fontWeight: 600,
        }, "aria-hidden": "true", children: value }));
}
/** Square badge — 20x20px, border-radius 6px (spec Section 8.4) */
function RankBadge({ value, color }) {
    const rank = typeof value === 'string' ? parseInt(value, 10) : value;
    /** WHY conditional: top 3 get gold-primary, 4-10 get gold-subtle per spec */
    const bgColor = color ?? (rank <= 3 ? 'var(--color-gold-primary)' : 'var(--color-gold-subtle)');
    const textColor = rank <= 3 ? '#fff' : 'var(--color-text-secondary)';
    return (_jsx("span", { className: "inline-flex shrink-0 items-center justify-center leading-none", style: {
            width: 20,
            height: 20,
            borderRadius: 6,
            backgroundColor: bgColor,
            color: textColor,
            fontSize: 10,
            fontWeight: 700,
        }, children: value }));
}
/** Pill badge — colored bg at 15% opacity + matching text (spec Section 8.4) */
function StatusBadge({ value, color }) {
    const colorKey = color ?? STATUS_TO_COLOR[String(value)] ?? 'blue';
    const colors = STATUS_COLORS[colorKey] ?? STATUS_COLORS.blue;
    return (_jsx("span", { className: "inline-flex items-center leading-none", style: {
            padding: '2px 8px',
            borderRadius: 4,
            backgroundColor: colors.bg,
            color: colors.text,
            fontSize: 11,
            fontWeight: 500,
        }, children: value }));
}
