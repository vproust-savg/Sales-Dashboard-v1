// FILE: client/src/components/right-panel/BestSellersExportButton.tsx
// PURPOSE: Button that POSTs the current best-sellers rows + context to the export API
//          and triggers an .xlsx download in the browser.
// USED BY: client/src/components/right-panel/ChartsRow.tsx (via headerActions slot)
// EXPORTS: BestSellersExportButton

import { useState } from 'react';
import type { TopSellerItem, BestSellersExportRequest } from '@shared/types/dashboard';

type EntityType = BestSellersExportRequest['context']['entityType'];

interface Props {
  rows: TopSellerItem[];
  context: {
    entityType: EntityType;
    entityLabel: string;
    dateRangeLabel: string;
    topN: 20 | 50 | 100;
  };
}

export function BestSellersExportButton({ rows, context }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleClick() {
    if (state === 'loading') return;
    setState('loading');
    setErrorMsg(null);
    try {
      const body: BestSellersExportRequest = { rows, context };
      const res = await fetch('/api/sales/export/best-sellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);

      const blob = await res.blob();
      const filename = parseFilename(res.headers.get('Content-Disposition'))
        ?? `best-sellers-${context.topN}.xlsx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setState('idle');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Export failed');
      setState('error');
    }
  }

  return (
    <div className="flex items-center gap-[var(--spacing-sm)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'loading' || rows.length === 0}
        className="inline-flex cursor-pointer items-center gap-[6px] rounded-[var(--radius-full)] bg-[var(--color-gold-primary)] px-[var(--spacing-lg)] py-[6px] text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Export best sellers to Excel"
      >
        {state === 'loading' ? (
          <Spinner />
        ) : (
          <DownloadIcon />
        )}
        <span>{state === 'loading' ? 'Exporting…' : 'Export'}</span>
      </button>
      {state === 'error' && errorMsg && (
        <span role="alert" className="text-[11px] text-red-600">{errorMsg}</span>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1v7m0 0L3 5m3 3l3-3M2 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="animate-spin">
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
      <path d="M10 6a4 4 0 0 0-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Parse `attachment; filename="foo.xlsx"` → `foo.xlsx`. Returns null if missing/malformed. */
function parseFilename(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/filename="([^"]+)"/);
  return match ? match[1] : null;
}
