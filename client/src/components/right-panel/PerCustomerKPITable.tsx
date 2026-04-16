// FILE: client/src/components/right-panel/PerCustomerKPITable.tsx
// PURPOSE: Sortable per-entity KPI table rendered inside KPI modals when toggled to Per Customer mode
// USED BY: kpi-modal-content.tsx
// EXPORTS: PerCustomerKPITable

import { useMemo, useState } from 'react';
import type { EntityListItem } from '@shared/types/dashboard';
import { formatPercent } from '@shared/utils/formatting';

type SortKey = 'name' | 'value' | 'yoy';
type SortDir = 'asc' | 'desc';

interface PerCustomerKPITableProps {
  entities: EntityListItem[];
  /** Extract the metric value shown in the Value column */
  getValue: (e: EntityListItem) => number | null;
  /** Format the metric value */
  formatValue: (v: number) => string;
  /** Optional per-entity previous-year value for YoY calculation */
  getPrevValue?: (e: EntityListItem) => number | null;
  valueLabel: string;
  entityLabel?: string;
}

function yoy(current: number | null, prev: number | null | undefined): number | null {
  if (current === null || prev == null || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

export function PerCustomerKPITable({ entities, getValue, formatValue, getPrevValue, valueLabel, entityLabel }: PerCustomerKPITableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const rows = useMemo(() => {
    const mapped = entities.map(e => {
      const v = getValue(e);
      const prev = getPrevValue?.(e) ?? null;
      return { id: e.id, name: e.name, value: v, yoy: yoy(v, prev) };
    });
    mapped.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'value') cmp = (a.value ?? -Infinity) - (b.value ?? -Infinity);
      else cmp = (a.yoy ?? -Infinity) - (b.yoy ?? -Infinity);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return mapped;
  }, [entities, getValue, getPrevValue, sortKey, sortDir]);

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
            <Th label="YoY" sortKey="yoy" active={sortKey} dir={sortDir} onClick={onHeaderClick} align="right" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-[var(--color-gold-subtle)] last:border-b-0 hover:bg-[var(--color-gold-subtle)]">
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-[var(--color-text-primary)]">{r.name}</td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums text-[var(--color-text-secondary)]">
                {r.value == null ? '\u2014' : formatValue(r.value)}
              </td>
              <td className="px-[var(--spacing-md)] py-[var(--spacing-sm)] text-right tabular-nums">
                {r.yoy == null ? (
                  <span className="text-[var(--color-text-faint)]">\u2014</span>
                ) : (
                  <span style={{ color: r.yoy >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {formatPercent(r.yoy, { showSign: true })}
                  </span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} className="p-[var(--spacing-2xl)] text-center text-[var(--color-text-muted)]">No entities</td></tr>
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
