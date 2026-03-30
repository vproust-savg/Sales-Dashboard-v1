// FILE: client/src/hooks/useExport.ts
// PURPOSE: Generates and downloads CSV export of dashboard data for the active entity
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: useExport

import { useCallback } from 'react';
import type {
  KPIs, OrderRow, ItemCategory, Period,
} from '@shared/types/dashboard';
import {
  formatCurrency, formatPercent, formatDate,
} from '@shared/utils/formatting';

interface ExportData {
  entityName: string;
  period: Period;
  kpis: KPIs;
  orders: OrderRow[];
  items: ItemCategory[];
}

/** WHY: escape CSV values that contain commas, quotes, or newlines */
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsvContent(data: ExportData): string {
  const lines: string[] = [];

  // --- KPI Section ---
  lines.push('=== Key Performance Indicators ===');
  lines.push('Metric,Value');
  lines.push(`Total Revenue,${escapeCsv(formatCurrency(data.kpis.totalRevenue))}`);
  lines.push(`Previous Year Revenue,${escapeCsv(formatCurrency(data.kpis.prevYearRevenue))}`);
  lines.push(`YoY Change,${data.kpis.revenueChangePercent !== null ? formatPercent(data.kpis.revenueChangePercent) : 'N/A'}`);
  lines.push(`Orders,${data.kpis.orders}`);
  lines.push(`Avg Order,${data.kpis.avgOrder !== null ? escapeCsv(formatCurrency(data.kpis.avgOrder)) : 'N/A'}`);
  lines.push(`Margin %,${data.kpis.marginPercent !== null ? formatPercent(data.kpis.marginPercent) : 'N/A'}`);
  lines.push(`Margin $,${escapeCsv(formatCurrency(data.kpis.marginAmount))}`);
  lines.push('');

  // --- Orders Section ---
  lines.push('=== Orders ===');
  lines.push('Date,Order Number,Items,Amount,Margin %,Margin $,Status');
  for (const order of data.orders) {
    lines.push([
      formatDate(order.date),
      escapeCsv(order.orderNumber),
      String(order.itemCount),
      escapeCsv(formatCurrency(order.amount)),
      formatPercent(order.marginPercent),
      escapeCsv(formatCurrency(order.marginAmount)),
      order.status,
    ].join(','));
  }
  lines.push('');

  // --- Items Section ---
  lines.push('=== Items by Category ===');
  lines.push('Category,Product,SKU,Value,Margin %,Margin $');
  for (const cat of data.items) {
    for (const product of cat.products) {
      lines.push([
        escapeCsv(cat.category),
        escapeCsv(product.name),
        escapeCsv(product.sku),
        escapeCsv(formatCurrency(product.value)),
        formatPercent(product.marginPercent),
        escapeCsv(formatCurrency(product.marginAmount)),
      ].join(','));
    }
  }

  return lines.join('\n');
}

/** WHY: triggers browser download of a CSV file without a server round-trip */
function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildFilename(entityName: string, period: Period): string {
  const datePart = new Date().toISOString().split('T')[0];
  const safeName = entityName.replace(/[^a-zA-Z0-9]/g, '_');
  const periodLabel = period === 'ytd' ? 'YTD' : period;
  return `${safeName}_${periodLabel}_${datePart}.csv`;
}

export function useExport(data: ExportData | null) {
  const exportCsv = useCallback(() => {
    if (!data) return;
    const content = buildCsvContent(data);
    const filename = buildFilename(data.entityName, data.period);
    downloadCsv(filename, content);
  }, [data]);

  return { exportCsv };
}
