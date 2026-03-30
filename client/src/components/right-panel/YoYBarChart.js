import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// FILE: client/src/components/right-panel/YoYBarChart.tsx
// PURPOSE: SVG bar chart showing 12 months of current vs previous year revenue
// USED BY: HeroRevenueCard.tsx
// EXPORTS: YoYBarChart
import { useState, useMemo } from 'react';
import { formatCurrencyCompact } from '@shared/utils/formatting';
const CHART_HEIGHT = 120;
const Y_LABEL_WIDTH = 36;
const X_LABEL_HEIGHT = 16;
const LEGEND_HEIGHT = 20;
const BAR_AREA_HEIGHT = CHART_HEIGHT - X_LABEL_HEIGHT - LEGEND_HEIGHT;
const BAR_RADIUS = 2;
/** WHY calendar order: spec 20.1 says chart always shows Jan-Dec regardless of fiscal year */
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function YoYBarChart({ data }) {
    const [hoveredMonth, setHoveredMonth] = useState(null);
    const calendarData = useMemo(() => {
        const byIndex = new Map(data.map((d) => [d.monthIndex, d]));
        return MONTH_LABELS.map((label, i) => ({
            label,
            index: i,
            currentYear: byIndex.get(i)?.currentYear ?? 0,
            previousYear: byIndex.get(i)?.previousYear ?? 0,
        }));
    }, [data]);
    const maxVal = useMemo(() => Math.max(...calendarData.map((d) => Math.max(d.currentYear, d.previousYear)), 1), [calendarData]);
    /* WHY nice ceiling: rounds up to clean axis labels like $10K, $20K, $30K */
    const niceMax = useMemo(() => {
        const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
        return Math.ceil(maxVal / magnitude) * magnitude;
    }, [maxVal]);
    const gridLines = useMemo(() => {
        const mid = niceMax / 2;
        return [0, mid, niceMax];
    }, [niceMax]);
    return (_jsx("div", { className: "w-full", role: "img", "aria-label": "Year-over-year revenue bar chart", children: _jsxs("svg", { width: "100%", height: CHART_HEIGHT, viewBox: `0 0 400 ${CHART_HEIGHT}`, preserveAspectRatio: "none", className: "overflow-visible", children: [gridLines.map((val) => {
                    const y = BAR_AREA_HEIGHT - (val / niceMax) * BAR_AREA_HEIGHT;
                    return (_jsxs("g", { children: [_jsx("line", { x1: Y_LABEL_WIDTH, y1: y, x2: 400, y2: y, stroke: "var(--color-gold-subtle)", strokeWidth: 1, strokeDasharray: "4,4" }), _jsx("text", { x: Y_LABEL_WIDTH - 4, y: y + 3, textAnchor: "end", fill: "#bbb", fontSize: 9, fontFamily: "var(--font-sans)", children: formatCurrencyCompact(val) })] }, val));
                }), calendarData.map((month, i) => {
                    const groupWidth = (400 - Y_LABEL_WIDTH) / 12;
                    const groupX = Y_LABEL_WIDTH + i * groupWidth;
                    const barWidth = groupWidth * 0.28;
                    const gap = 2;
                    const prevX = groupX + (groupWidth - barWidth * 2 - gap) / 2;
                    const currX = prevX + barWidth + gap;
                    const prevH = (month.previousYear / niceMax) * BAR_AREA_HEIGHT;
                    const currH = (month.currentYear / niceMax) * BAR_AREA_HEIGHT;
                    const isHovered = hoveredMonth === i;
                    const isDimmed = hoveredMonth !== null && !isHovered;
                    return (_jsxs("g", { onMouseEnter: () => setHoveredMonth(i), onMouseLeave: () => setHoveredMonth(null), style: { cursor: 'pointer' }, opacity: isDimmed ? 0.4 : 1, children: [_jsx("rect", { x: prevX, y: BAR_AREA_HEIGHT - prevH, width: barWidth, height: Math.max(prevH, 0), fill: "#e8e0d0", opacity: isHovered ? 0.7 : 0.5, rx: BAR_RADIUS, ry: BAR_RADIUS }), _jsx("rect", { x: currX, y: BAR_AREA_HEIGHT - currH, width: barWidth, height: Math.max(currH, 0), fill: "#d4c5a9", opacity: isHovered ? 1 : 1, rx: BAR_RADIUS, ry: BAR_RADIUS, filter: isHovered ? 'brightness(1.05)' : undefined }), _jsx("text", { x: groupX + groupWidth / 2, y: BAR_AREA_HEIGHT + 12, textAnchor: "middle", fill: "#bbb", fontSize: 9, fontFamily: "var(--font-sans)", children: month.label })] }, month.index));
                }), _jsxs("g", { transform: `translate(${Y_LABEL_WIDTH}, ${CHART_HEIGHT - 4})`, children: [_jsx("circle", { cx: 0, cy: -3, r: 3, fill: "#e8e0d0" }), _jsx("text", { x: 8, y: 0, fill: "#888", fontSize: 11, fontFamily: "var(--font-sans)", children: "Previous Year" }), _jsx("circle", { cx: 96, cy: -3, r: 3, fill: "#d4c5a9" }), _jsx("text", { x: 104, y: 0, fill: "#888", fontSize: 11, fontFamily: "var(--font-sans)", children: "This Year" })] })] }) }));
}
