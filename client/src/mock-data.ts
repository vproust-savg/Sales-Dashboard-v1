// FILE: client/src/mock-data.ts
// PURPOSE: Static mock data for building the UI before backend integration
// USED BY: client/src/App.tsx (temporary — removed in Plan C)
// EXPORTS: MOCK_DASHBOARD, MOCK_CONTACTS

import type { DashboardPayload, Contact } from '@shared/types/dashboard';

export const MOCK_DASHBOARD: DashboardPayload = {
  entities: [
    { id: 'C001', name: 'Boulangerie Paul - Paris 5e', meta1: 'North \u00B7 Sarah M.', meta2: '22 orders', revenue: 134600, orderCount: 22, avgOrder: 6118, marginPercent: 19.2, marginAmount: 25843, frequency: 7.3, lastOrderDate: '2026-03-28', rep: 'Sarah M.', zone: 'North', customerType: 'Bakery', prevYearRevenue: null, prevYearRevenueFull: null },
    { id: 'C002', name: 'Acme Corporation', meta1: 'North \u00B7 Sarah M.', meta2: '32 orders', revenue: 240200, orderCount: 32, avgOrder: 7506, marginPercent: 18.4, marginAmount: 44197, frequency: 10.7, lastOrderDate: '2026-03-26', rep: 'Sarah M.', zone: 'North', customerType: 'Wholesale', prevYearRevenue: null, prevYearRevenueFull: null },
    { id: 'C003', name: 'Boulangerie Paul - Paris 11e', meta1: 'East \u00B7 Rachel K.', meta2: '18 orders', revenue: 98400, orderCount: 18, avgOrder: 5467, marginPercent: 16.1, marginAmount: 15842, frequency: 6.0, lastOrderDate: '2026-03-20', rep: 'Rachel K.', zone: 'East', customerType: 'Bakery', prevYearRevenue: null, prevYearRevenueFull: null },
    { id: 'C004', name: '\u00C9tablissements Gastronomiques', meta1: 'South \u00B7 Marc D.', meta2: '12 orders', revenue: 67200, orderCount: 12, avgOrder: 5600, marginPercent: 22.3, marginAmount: 14986, frequency: 4.0, lastOrderDate: '2026-03-15', rep: 'Marc D.', zone: 'South', customerType: 'Restaurant', prevYearRevenue: null, prevYearRevenueFull: null },
    { id: 'C005', name: 'Metro Cash & Carry', meta1: 'West \u00B7 Sarah M.', meta2: '28 orders', revenue: 180000, orderCount: 28, avgOrder: 6429, marginPercent: 15.8, marginAmount: 28440, frequency: 9.3, lastOrderDate: '2026-03-29', rep: 'Sarah M.', zone: 'West', customerType: 'Retail', prevYearRevenue: null, prevYearRevenueFull: null },
  ],
  kpis: {
    totalRevenue: 240200, prevYearRevenue: 213800, prevYearRevenueFull: 285600,
    revenueChangePercent: 12.4, revenueChangeAmount: 26400,
    thisQuarterRevenue: 68400, lastQuarterRevenue: 62100,
    lastMonthRevenue: 21000, lastMonthName: 'Feb', quarterLabel: 'Q1',
    bestMonth: { name: 'Sep', amount: 32400 },
    orders: 32, ordersChange: 4,
    avgOrder: 7506, marginPercent: 18.4, marginAmount: 44200,
    marginChangepp: -1.2, frequency: 2.7, frequencyChange: 0.3,
    lastOrderDays: 4, fillRate: 94.2, fillRateChangepp: 1.8,
    ordersBreakdown: { prevYear: 28, prevYearFull: 42, thisQuarter: 10, quarterLabel: 'Q1', lastMonth: 4, lastMonthName: 'Feb', bestMonth: { name: 'Sep', value: 6 } },
    avgOrderBreakdown: { prevYear: 7636, prevYearFull: 6800, thisQuarter: 6840, quarterLabel: 'Q1', lastMonth: 5250, lastMonthName: 'Feb', bestMonth: { name: 'Jan', value: 8500 } },
    marginPercentBreakdown: { prevYear: 19.6, prevYearFull: 18.8, thisQuarter: 17.2, quarterLabel: 'Q1', lastMonth: 16.1, lastMonthName: 'Feb', bestMonth: { name: 'Jul', value: 22.3 } },
    marginAmountBreakdown: { prevYear: 41900, prevYearFull: 53700, thisQuarter: 11770, quarterLabel: 'Q1', lastMonth: 3381, lastMonthName: 'Feb', bestMonth: { name: 'Sep', value: 6500 } },
    frequencyBreakdown: { prevYear: 2.3, prevYearFull: 3.5, thisQuarter: 3.3, quarterLabel: 'Q1', lastMonth: 4, lastMonthName: 'Feb', bestMonth: { name: 'Sep', value: 5 } },
  },
  monthlyRevenue: [
    { month: 'Apr', monthIndex: 3, currentYear: 15000, previousYear: 12000 },
    { month: 'May', monthIndex: 4, currentYear: 18000, previousYear: 14000 },
    { month: 'Jun', monthIndex: 5, currentYear: 13000, previousYear: 11000 },
    { month: 'Jul', monthIndex: 6, currentYear: 22000, previousYear: 17000 },
    { month: 'Aug', monthIndex: 7, currentYear: 17000, previousYear: 15000 },
    { month: 'Sep', monthIndex: 8, currentYear: 25000, previousYear: 19000 },
    { month: 'Oct', monthIndex: 9, currentYear: 20000, previousYear: 18000 },
    { month: 'Nov', monthIndex: 10, currentYear: 15000, previousYear: 13000 },
    { month: 'Dec', monthIndex: 11, currentYear: 21000, previousYear: 16000 },
    { month: 'Jan', monthIndex: 0, currentYear: 27000, previousYear: 22000 },
    { month: 'Feb', monthIndex: 1, currentYear: 26000, previousYear: 20000 },
    { month: 'Mar', monthIndex: 2, currentYear: 24000, previousYear: 22000 },
  ],
  productMixes: {
    productType: [
      { category: 'Packaging', value: 91200, percentage: 38 },
      { category: 'Raw Materials', value: 60000, percentage: 25 },
      { category: 'Equipment', value: 36000, percentage: 15 },
      { category: 'Consumables', value: 31200, percentage: 13 },
      { category: 'Other', value: 21600, percentage: 9 },
    ],
    productFamily: [
      { category: 'Family A', value: 100000, percentage: 42 },
      { category: 'Family B', value: 80000, percentage: 33 },
      { category: 'Family C', value: 60200, percentage: 25 },
    ],
    brand: [
      { category: 'BrandX', value: 120000, percentage: 50 },
      { category: 'BrandY', value: 72000, percentage: 30 },
      { category: 'BrandZ', value: 48200, percentage: 20 },
    ],
    countryOfOrigin: [
      { category: 'USA', value: 144000, percentage: 60 },
      { category: 'France', value: 72000, percentage: 30 },
      { category: 'Other', value: 24200, percentage: 10 },
    ],
    foodServiceRetail: [
      { category: 'Food Service', value: 168000, percentage: 70 },
      { category: 'Retail', value: 72200, percentage: 30 },
    ],
  },
  topSellers: [
    { rank: 1, name: 'Kraft Mailer Box 300x200', sku: 'PKG-KM-300', revenue: 42800, units: 1240, unit: 'cs' },
    { rank: 2, name: 'PE Film Roll 500mm', sku: 'RAW-PE-500', revenue: 38200, units: 860, unit: 'ea' },
    { rank: 3, name: 'Corrugated Sheet A4', sku: 'PKG-CS-A4', revenue: 31500, units: 2100, unit: 'ea' },
    { rank: 4, name: 'Adhesive Tape Industrial', sku: 'CON-AT-IND', revenue: 24600, units: 3400, unit: 'ea' },
    { rank: 5, name: 'Bubble Wrap Roll 1200mm', sku: 'PKG-BW-1200', revenue: 18900, units: 520, unit: 'ea' },
    { rank: 6, name: 'Stretch Wrap 450mm', sku: 'PKG-SW-450', revenue: 16400, units: 780, unit: 'ea' },
    { rank: 7, name: 'Foam Insert Custom', sku: 'PKG-FI-CST', revenue: 14200, units: 640, unit: 'ea' },
    { rank: 8, name: 'Packing Peanuts 50L', sku: 'CON-PP-50L', revenue: 11800, units: 1960, unit: 'lb' },
    { rank: 9, name: 'Label Roll Thermal A6', sku: 'CON-LR-A6', revenue: 9600, units: 4200, unit: 'ea' },
    { rank: 10, name: 'Void Fill Paper Roll', sku: 'PKG-VF-ROL', revenue: 8300, units: 310, unit: 'ea' },
    { rank: 11, name: 'Cardboard Corner Protectors', sku: 'PKG-CP-100', revenue: 7200, units: 5600, unit: 'ea' },
    { rank: 12, name: 'Poly Bag 200x300', sku: 'PKG-PB-200', revenue: 6100, units: 8200, unit: 'ea' },
    { rank: 13, name: 'Kraft Paper Roll 900mm', sku: 'RAW-KP-900', revenue: 5400, units: 180, unit: 'ea' },
    { rank: 14, name: 'Sealing Tape Clear 48mm', sku: 'CON-ST-48C', revenue: 4800, units: 2400, unit: 'ea' },
    { rank: 15, name: 'Edge Board Protector 1m', sku: 'PKG-EB-100', revenue: 4200, units: 1100, unit: 'ea' },
  ],
  sparklines: {
    revenue: { values: [18000, 22000, 25000, 21000, 27000, 24000] },
    orders: { values: [4, 6, 7, 5, 8, 6] },
  },
  orders: [
    { date: '2026-03-28T00:00:00Z', orderNumber: 'SO-26-0142', itemCount: 8, amount: 12400, marginPercent: 18.2, marginAmount: 2257, status: 'Closed', items: [
      { productName: 'Kraft Mailer Box', sku: 'PKG-KM-300', quantity: 50, unit: 'cs', unitPrice: 124, lineTotal: 6200, marginPercent: 19.5 },
      { productName: 'Bubble Wrap Roll', sku: 'PKG-BW-1200', quantity: 30, unit: 'ea', unitPrice: 206.67, lineTotal: 6200, marginPercent: 16.8 },
    ] },
    { date: '2026-03-15T00:00:00Z', orderNumber: 'SO-26-0128', itemCount: 5, amount: 8900, marginPercent: 20.1, marginAmount: 1789, status: 'Partially Filled', items: [
      { productName: 'Corrugated Sheet A4', sku: 'PKG-CS-A4', quantity: 100, unit: 'ea', unitPrice: 89, lineTotal: 8900, marginPercent: 20.1 },
    ] },
    { date: '2026-02-28T00:00:00Z', orderNumber: 'SO-26-0098', itemCount: 12, amount: 18200, marginPercent: 16.5, marginAmount: 3003, status: 'Open', items: [
      { productName: 'Packing Tape Clear', sku: 'PKG-PT-CLR', quantity: 200, unit: 'ea', unitPrice: 45.5, lineTotal: 9100, marginPercent: 18.2 },
      { productName: 'Stretch Film 500mm', sku: 'PKG-SF-500', quantity: 80, unit: 'ea', unitPrice: 113.75, lineTotal: 9100, marginPercent: 14.8 },
    ] },
  ],
  items: [
    { name: 'Kraft Mailer Box 300x200', sku: 'PKG-KM-300', value: 42800, marginPercent: 21.3, marginAmount: 9116, productType: 'Packaging', productFamily: 'Boxes', brand: 'BrandX', countryOfOrigin: 'USA', foodServiceRetail: 'Food Service', vendor: 'Vendor A', totalUnits: 850, unitName: 'cs', lastPrice: 50.35, purchaseFrequency: 2.5, lastOrderDate: '2026-03-20T00:00:00Z', prevYearValue: 39200, prevYearMarginPercent: 19.8, prevYearUnits: 780 },
    { name: 'Corrugated Sheet A4', sku: 'PKG-CS-A4', value: 31500, marginPercent: 18.1, marginAmount: 5702, productType: 'Packaging', productFamily: 'Sheets', brand: 'BrandX', countryOfOrigin: 'USA', foodServiceRetail: 'Food Service', vendor: 'Vendor A', totalUnits: 1200, unitName: 'ea', lastPrice: 26.25, purchaseFrequency: 1.8, lastOrderDate: '2026-03-15T00:00:00Z', prevYearValue: 28400, prevYearMarginPercent: 17.2, prevYearUnits: 1100 },
    { name: 'Bubble Wrap Roll 1200mm', sku: 'PKG-BW-1200', value: 16900, marginPercent: 15.9, marginAmount: 2687, productType: 'Packaging', productFamily: 'Wrapping', brand: 'BrandY', countryOfOrigin: 'China', foodServiceRetail: 'Retail', vendor: 'Vendor B', totalUnits: 340, unitName: 'ea', lastPrice: 49.71, purchaseFrequency: 1.2, lastOrderDate: '2026-02-28T00:00:00Z', prevYearValue: 15200, prevYearMarginPercent: 14.5, prevYearUnits: 310 },
    { name: 'PE Film Roll 500mm', sku: 'RAW-PE-500', value: 38200, marginPercent: 16.2, marginAmount: 6188, productType: 'Raw Materials', productFamily: 'Films', brand: 'BrandZ', countryOfOrigin: 'Germany', foodServiceRetail: 'Food Service', vendor: 'Vendor C', totalUnits: 600, unitName: 'ea', lastPrice: 63.67, purchaseFrequency: 3.0, lastOrderDate: '2026-03-22T00:00:00Z', prevYearValue: 35100, prevYearMarginPercent: 15.0, prevYearUnits: 560 },
    { name: 'Stretch Wrap 450mm', sku: 'PKG-SW-450', value: 21800, marginPercent: 15.1, marginAmount: 3292, productType: 'Raw Materials', productFamily: 'Wrapping', brand: 'BrandY', countryOfOrigin: 'USA', foodServiceRetail: 'Retail', vendor: 'Vendor B', totalUnits: 420, unitName: 'ea', lastPrice: 51.90, purchaseFrequency: 1.5, lastOrderDate: '2026-03-10T00:00:00Z', prevYearValue: 19800, prevYearMarginPercent: 14.0, prevYearUnits: 390 },
  ],
  yearsAvailable: ['2026', '2025', '2024', '2023'],
};

export const MOCK_CONTACTS: Contact[] = [
  { fullName: 'Marie Dupont', position: 'Purchasing Manager', phone: '+33 1 42 68 53 21', email: 'm.dupont@acme-corp.fr' },
  { fullName: 'Jean-Pierre Martin', position: 'Finance Director', phone: '+33 1 42 68 53 22', email: 'jp.martin@acme-corp.fr' },
  { fullName: 'Nathie Laurent', position: 'Head Chef', phone: '+33 6 12 34 56 78', email: 'n.laurent@acme-corp.fr' },
];
