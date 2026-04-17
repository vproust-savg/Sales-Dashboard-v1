// FILE: client/src/components/right-panel/PerCustomerKPITable.tsx
// PURPOSE: Sortable 4-column per-entity KPI table: Customer | YTD(+arrow) | LY same period | LY full year
// USED BY: kpi-modal-content.tsx
// EXPORTS: PerCustomerKPITable

import { useMemo, useState } from 'react';
import type { EntityListItem } from '@shared/types/dashboard';
import { TrendArrow } from '../shared/TrendArrow';

type SortKey = 'name' | 'value' | 'prevPeriod' | 'prevFull';
type SortDir = 'asc' | 'desc';

interface PerCustomerKPITableProps {
  entities: EntityListItem[];
  /** Extract the YTD metric value */
  getValue: (e: EntityListItem) => number | null;
  /** Extract the same-period previous year value */
  getPrevPeriodValue: (e: EntityListItem) => number | null;
  /** Extract the full previous year value */
  getPrevFullValue: (e: EntityListItem) => number | null;
  /** Format any metric value for display */
  formatValue: (v: number | null) => string;
  /** Column header for the YTD value column */
  valueLabel: string;
  entityLabel?: string;
  /** WHY: inverted for metrics where lower is better (e.g., days-since-order) */
  invertedTrend?: boolean;
}

export function PerCustomerKPITable({
  entities,
  getValue,
  getPrevPeriodValue,
  getPrevFullValue,
  formatValue,
  valueLabel,
  entityLabel,
  invertedTrend = false,
}: PerCustomerKPITableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const rows = useMemo(() => {
    const mapped = entities.map(e => ({
      id: e.id,
      name: e.name,
      value: getValue(e),
      prevPeriod: getPrevPeriodValue(e),
      prevFull: getPrevFullValue(e),
    }));
    mapped.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'value') cmp = (a.value ?? -Infinity) - (b.value ?? -Infinity);
      else if (sortKey === 'prevPeriod') cmp = (a.prevPeriod ?? -Infinity) - (b.prevPeriod ?? -Infinity);
      else cmp = (a.prevFull ?? -Infinity) - (b.prevFull ?? -Infinity);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return mapped;
  }, [entities, getValue, getPrevPeriodValue, getPrevFullValue, sortKey, sortDir]);

  const onHeaderClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="max-h-[400px] overflow-auto rounded-[var(--radius-base)] border border-[var(--color-gold-subtle)]">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-[var(--color-bg-card)]">
          <tr className="border-b border-[var(--color-gold-subtle)]">
            <Th label={entityLabel ?? 'Customer'} sortKey="name" active={sortKey} dir={sortDir} onClick={onHeaderClick} />
            <Th label={valueLabel} sortKey="value" active={sortKey} dir={sortDir} onClick={onHeaderClick} align="right" />
            <Th label="LY same period" sortKey="prevPeriod" active={sortKey} dir={sortDir} onClick={onHeaderClick} align="right" />
            <Th label="LY full year" sortKey="prevFull" active={sortKey} dir={sortDir} onClick={onHeaderClick} align="right" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-[var(--color-gold-subtle)] last:border-b-0 hover:bg-[var(--color-gold-subtle)]">
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-primary)]">{r.name}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-secondary)]">
                <span className="mr-[var(--spacing-xs)]">
                  <TrendArrow current={r.value} prev={r.prevPeriod} inverted={invertedTrend} />
                </span>
                {r.value == null ? '\u2014' : formatValue(r.value)}
              </td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-muted)]">
                {r.prevPeriod == null ? '\u2014' : formatValue(r.prevPeriod)}
              </td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-muted)]">
                {r.prevFull == null ? '\u2014' : formatValue(r.prevFull)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={4} className="p-[var(--spacing-2xl)] text-center text-[var(--color-text-muted)]">No entities</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label, sortKey, active, dir, onClick, align = 'left',
}: {
  label: string; sortKey: SortKey; active: SortKey; dir: SortDir; onClick: (k: SortKey) => void; align?: 'left' | 'right';
}) {
  const isActive = active === sortKey;
  return (
    <th
      onClick={() => onClick(sortKey)}
      className={`cursor-pointer select-none px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] ${align === 'right' ? 'text-right' : 'text-left'} hover:text-[var(--color-text-secondary)]`}
    >
      {label}{isActive ? (dir === 'asc' ? ' \u2191' : ' \u2193') : ''}
    </th>
  );
}
