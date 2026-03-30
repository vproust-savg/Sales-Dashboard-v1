import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FILE: client/src/components/right-panel/ProductMixDonut.tsx
// PURPOSE: SVG donut chart with center text and color legend for product mix
// USED BY: client/src/components/right-panel/ChartsRow.tsx
// EXPORTS: ProductMixDonut
import { useState } from 'react';
import { formatCurrencyCompact } from '@shared/utils/formatting';
/** WHY these specific colors: spec Section 20.2 defines 7 warm-palette donut colors */
const SEGMENT_COLORS = [
    '#b8a88a', // gold-primary
    '#d4c5a9', // gold-light
    '#8B7355', // darker warm brown
    '#C4A882', // light warm tan
    '#e8e0d0', // gold-muted
    '#A09070', // medium brown
    '#f0ece5', // gold-subtle
];
const CENTER_X = 60;
const CENTER_Y = 60;
const OUTER_R = 54;
const INNER_R = 36;
/** WHY stroke approach: uses stroke-based ring (radius = midpoint, stroke-width = thickness) */
const MID_R = (OUTER_R + INNER_R) / 2;
const STROKE_W = OUTER_R - INNER_R;
const CIRCUMFERENCE = 2 * Math.PI * MID_R;
/** WHY 2px gap: spec requires visible gap between segments */
const GAP_PX = 2;
export function ProductMixDonut({ data }) {
    const [hoveredIdx, setHoveredIdx] = useState(null);
    const segments = data.slice(0, 7);
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    const totalCount = segments.length;
    /** WHY cumulative offset: each segment starts where the previous one ended */
    let cumulativeOffset = 0;
    const arcs = segments.map((seg, i) => {
        const fraction = seg.value / total;
        const dashLen = fraction * CIRCUMFERENCE - GAP_PX;
        const gapLen = CIRCUMFERENCE - dashLen;
        const offset = -cumulativeOffset + CIRCUMFERENCE * 0.25;
        cumulativeOffset += fraction * CIRCUMFERENCE;
        return { seg, i, dashLen, gapLen, offset, color: SEGMENT_COLORS[i] };
    });
    const centerLabel = hoveredIdx !== null ? segments[hoveredIdx].category : 'Total';
    const centerValue = hoveredIdx !== null
        ? formatCurrencyCompact(segments[hoveredIdx].value)
        : String(totalCount);
    return (_jsxs("div", { className: "flex flex-col items-center gap-[var(--spacing-lg)]", children: [_jsxs("svg", { width: "160", height: "160", viewBox: "0 0 120 120", className: "cursor-pointer", role: "img", "aria-label": "Product mix donut chart", children: [arcs.map(({ i, dashLen, gapLen, offset, color }) => (_jsx("circle", { cx: CENTER_X, cy: CENTER_Y, r: MID_R, fill: "none", stroke: color, strokeWidth: STROKE_W, strokeDasharray: `${Math.max(dashLen, 0)} ${gapLen}`, strokeDashoffset: offset, strokeLinecap: "round", style: {
                            opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.5 : 1,
                            transform: hoveredIdx === i ? 'scale(1.04)' : 'scale(1)',
                            transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
                            transition: 'opacity 200ms, transform 200ms',
                        }, onMouseEnter: () => setHoveredIdx(i), onMouseLeave: () => setHoveredIdx(null) }, i))), _jsx("text", { x: CENTER_X, y: CENTER_Y - 5, textAnchor: "middle", fill: "#999", fontSize: "10", fontWeight: "400", children: centerLabel }), _jsx("text", { x: CENTER_X, y: CENTER_Y + 10, textAnchor: "middle", fill: "#1a1a1a", fontSize: "17", fontWeight: "700", children: centerValue })] }), _jsx("div", { className: "flex flex-col gap-[var(--spacing-xs)]", children: segments.map((seg, i) => (_jsxs("div", { className: "flex items-center gap-[var(--spacing-md)] text-[13px] text-[var(--color-text-secondary)]", onMouseEnter: () => setHoveredIdx(i), onMouseLeave: () => setHoveredIdx(null), children: [_jsx("span", { className: "inline-block h-2 w-2 shrink-0 rounded-full", style: { backgroundColor: SEGMENT_COLORS[i] } }), _jsxs("span", { className: "font-medium", children: [seg.percentage, "%"] }), _jsx("span", { children: seg.category })] }, seg.category))) })] }));
}
