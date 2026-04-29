// FILE: server/src/services/best-sellers-workbook.ts
// PURPOSE: Build a formatted .xlsx workbook from best-seller rows + context
// USED BY: server/src/routes/export.ts
// EXPORTS: buildBestSellersWorkbook

import ExcelJS from 'exceljs';
import type { BestSellersExportRequest } from '@shared/types/dashboard';

const SHEET_NAME = 'Best Sellers';
const HEADER_FILL = 'FFB8A88A'; // gold-primary, alpha+RGB for exceljs
const HEADERS = ['Rank', 'SKU', 'Product', 'Revenue', 'Units', 'Unit'];
const COLUMN_WIDTHS = [6, 14, 50, 16, 10, 8];

/** Build a workbook for the given rows + context. Pure function — no I/O. */
export function buildBestSellersWorkbook(req: BestSellersExportRequest): ExcelJS.Workbook {
  const { rows, context } = req;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sales Dashboard';
  wb.created = new Date();

  const ws = wb.addWorksheet(SHEET_NAME);

  ws.mergeCells('A1:F1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `${context.entityLabel} — Top ${context.topN} Best Sellers`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

  ws.mergeCells('A2:F2');
  const subtitleCell = ws.getCell('A2');
  subtitleCell.value = `${context.dateRangeLabel} · Generated ${new Date().toISOString()}`;
  subtitleCell.font = { italic: true, color: { argb: 'FF6B6B6B' } };

  const headerRow = ws.getRow(4);
  headerRow.values = HEADERS;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell({ includeEmpty: false }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle' };
  });

  rows.forEach((r, i) => {
    const row = ws.getRow(5 + i);
    row.values = [r.rank, r.sku, r.name, r.revenue, r.units, r.unit];
    row.getCell(4).numFmt = '$#,##0.00';
    row.getCell(5).numFmt = '#,##0';
  });

  COLUMN_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  ws.views = [{ state: 'frozen', ySplit: 4 }];

  return wb;
}
