// FILE: client/src/components/right-panel/YoYBarChart.tsx
// PURPOSE: SVG bar chart showing 12 months of current vs previous year revenue
// USED BY: HeroRevenueCard.tsx
// EXPORTS: YoYBarChart

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { MonthlyRevenue } from '@shared/types/dashboard';
import { formatCurrency, formatCurrencyCompact } from '@shared/utils/formatting';

interface YoYBarChartProps {
  data: MonthlyRevenue[];
  /** WHY: Dynamic width from container to avoid letterboxing on large cards. */
  width?: number;
  /** WHY: Dynamic height from container via ResizeObserver. Clamped externally to [80, 400]. */
  height?: number;
}

const Y_LABEL_WIDTH = 36;
const X_LABEL_HEIGHT = 16;
const LEGEND_HEIGHT = 20;
const BAR_RADIUS = 2;
const DEFAULT_HEIGHT = 120;

/** WHY calendar order: spec 20.1 says chart always shows Jan-Dec regardless of fiscal year */
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function YoYBarChart({ data, width: rawWidth, height: rawHeight }: YoYBarChartProps) {
  const chartWidth = rawWidth || 400;
  const chartHeight = rawHeight ?? DEFAULT_HEIGHT;
  const barAreaHeight = chartHeight - X_LABEL_HEIGHT - LEGEND_HEIGHT;
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const calendarData = useMemo(() => {
    const byIndex = new Map(data.map((d) => [d.monthIndex, d]));
    return MONTH_LABELS.map((label, i) => ({
      label,
      index: i,
      currentYear: byIndex.get(i)?.currentYear ?? 0,
      previousYear: byIndex.get(i)?.previousYear ?? 0,
    }));
  }, [data]);

  const maxVal = useMemo(
    () => Math.max(...calendarData.map((d) => Math.max(d.currentYear, d.previousYear)), 1),
    [calendarData],
  );

  /* WHY nice ceiling: rounds up to clean axis labels like $10K, $20K, $30K */
  const niceMax = useMemo(() => {
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
    return Math.ceil(maxVal / magnitude) * magnitude;
  }, [maxVal]);

  const gridLines = useMemo(() => {
    const mid = niceMax / 2;
    return [0, mid, niceMax];
  }, [niceMax]);

  return (
    <div className="w-full" role="img" aria-label="Year-over-year revenue bar chart">
      <svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="xMinYMin meet"
        className="overflow-visible"
      >
        {/* Dashed grid lines */}
        {gridLines.map((val) => {
          const y = barAreaHeight - (val / niceMax) * barAreaHeight;
          return (
            <g key={val}>
              <line
                x1={Y_LABEL_WIDTH}
                y1={y}
                x2={chartWidth}
                y2={y}
                stroke="var(--color-gold-subtle)"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <text
                x={Y_LABEL_WIDTH - 4}
                y={y + 3}
                textAnchor="end"
                fill="var(--color-text-faint)"
                fontSize={9}
                fontFamily="var(--font-sans)"
              >
                {formatCurrencyCompact(val)}
              </text>
            </g>
          );
        })}

        {/* Bar pairs */}
        {calendarData.map((month, i) => {
          const groupWidth = (chartWidth - Y_LABEL_WIDTH) / 12;
          const groupX = Y_LABEL_WIDTH + i * groupWidth;
          const barWidth = groupWidth * 0.28;
          const gap = 2;
          const prevX = groupX + (groupWidth - barWidth * 2 - gap) / 2;
          const currX = prevX + barWidth + gap;
          const prevH = (month.previousYear / niceMax) * barAreaHeight;
          const currH = (month.currentYear / niceMax) * barAreaHeight;
          const isHovered = hoveredMonth === i;
          const isDimmed = hoveredMonth !== null && !isHovered;

          return (
            <g
              key={month.index}
              onMouseEnter={() => setHoveredMonth(i)}
              onMouseLeave={() => setHoveredMonth(null)}
              style={{ cursor: 'pointer' }}
              opacity={isDimmed ? 0.4 : 1}
            >
              {/* WHY: Invisible hit area covers entire month column so hover applies to full month, not individual bars */}
              <rect x={groupX} y={0} width={groupWidth} height={barAreaHeight + X_LABEL_HEIGHT} fill={isHovered ? 'var(--color-gold-hover)' : 'transparent'} />
              {/* WHY motion.rect: bars grow from bottom with staggered 30ms delay per spec 21.1 */}
              {/* Previous year bar */}
              <motion.rect
                x={prevX}
                y={barAreaHeight - prevH}
                width={barWidth}
                height={Math.max(prevH, 0)}
                fill="var(--color-gold-muted)"
                opacity={isHovered ? 0.7 : 0.5}
                rx={BAR_RADIUS}
                ry={BAR_RADIUS}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: i * 0.03, duration: 0.4, ease: 'easeOut' }}
                style={{ transformOrigin: `${prevX}px ${barAreaHeight}px` }}
              />
              {/* Current year bar */}
              <motion.rect
                x={currX}
                y={barAreaHeight - currH}
                width={barWidth}
                height={Math.max(currH, 0)}
                fill="var(--color-gold-light)"
                opacity={isHovered ? 1 : 1}
                rx={BAR_RADIUS}
                ry={BAR_RADIUS}
                filter={isHovered ? 'brightness(1.05)' : undefined}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: i * 0.03 + 0.05, duration: 0.4, ease: 'easeOut' }}
                style={{ transformOrigin: `${currX}px ${barAreaHeight}px` }}
              />
              {/* X-axis month label */}
              <text
                x={groupX + groupWidth / 2}
                y={barAreaHeight + 12}
                textAnchor="middle"
                fill="var(--color-text-faint)"
                fontSize={9}
                fontFamily="var(--font-sans)"
              >
                {month.label}
              </text>
            </g>
          );
        })}

        {/* Tooltip — appears above hovered bar pair */}
        {hoveredMonth !== null && (() => {
          const m = calendarData[hoveredMonth];
          const groupWidth = (chartWidth - Y_LABEL_WIDTH) / 12;
          const tooltipX = Y_LABEL_WIDTH + hoveredMonth * groupWidth + groupWidth / 2;
          const tallestBar = Math.max(m.currentYear, m.previousYear);
          const tooltipY = barAreaHeight - (tallestBar / niceMax) * barAreaHeight - 8;
          const currText = formatCurrency(Math.round(m.currentYear));
          const prevText = formatCurrency(Math.round(m.previousYear));
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={tooltipX - 48}
                y={tooltipY - 28}
                width={96}
                height={28}
                rx={4}
                fill="var(--color-dark)"
                opacity={0.95}
              />
              <text x={tooltipX} y={tooltipY - 16} textAnchor="middle" fill="white" fontSize={9} fontWeight={600} fontFamily="var(--font-sans)">
                {currText}
              </text>
              <text x={tooltipX} y={tooltipY - 6} textAnchor="middle" fill="var(--color-gold-muted)" fontSize={8} fontFamily="var(--font-sans)">
                prev: {prevText}
              </text>
            </g>
          );
        })()}

        {/* Legend */}
        <g transform={`translate(${Y_LABEL_WIDTH}, ${chartHeight - 4})`}>
          <circle cx={0} cy={-3} r={3} fill="var(--color-gold-muted)" />
          <text x={8} y={0} fill="var(--color-text-muted)" fontSize={11} fontFamily="var(--font-sans)">
            Previous Year
          </text>
          <circle cx={96} cy={-3} r={3} fill="var(--color-gold-light)" />
          <text x={104} y={0} fill="var(--color-text-muted)" fontSize={11} fontFamily="var(--font-sans)">
            This Year
          </text>
        </g>
      </svg>
    </div>
  );
}
