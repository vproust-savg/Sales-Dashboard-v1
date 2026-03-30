import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** WHY no hover interaction: spec 20.3 says sparklines are decorative, not interactive */
export function Sparkline({ data, width = 60, height = 24, color = 'var(--color-gold-light)', }) {
    if (data.length < 2)
        return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const points = data.map((val, i) => {
        const x = padding + (i / (data.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((val - min) / range) * chartHeight;
        return { x, y };
    });
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    /* WHY area fill: spec 20.3 calls for gradient from color at 20% opacity to transparent */
    const areaPath = `${linePath} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;
    const gradientId = `sparkline-grad-${Math.random().toString(36).slice(2, 8)}`;
    return (_jsxs("svg", { width: width, height: height, viewBox: `0 0 ${width} ${height}`, "aria-hidden": "true", className: "shrink-0", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: gradientId, x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: color, stopOpacity: 0.2 }), _jsx("stop", { offset: "100%", stopColor: color, stopOpacity: 0 })] }) }), _jsx("path", { d: areaPath, fill: `url(#${gradientId})` }), _jsx("path", { d: linePath, fill: "none", stroke: color, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
