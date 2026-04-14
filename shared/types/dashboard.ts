// FILE: shared/types/dashboard.ts
// PURPOSE: Shared types for dashboard data exchanged between server and client
// USED BY: server/services/data-aggregator.ts, client/hooks/useDashboardData.ts
// EXPORTS: DashboardPayload, EntityListItem, KPIs, MonthlyRevenue, ProductMixSegment, ProductMixType, PRODUCT_MIX_LABELS, PRODUCT_MIX_ORDER, TopSellerItem, OrderLineItem, OrderRow, FlatItem, Contact

/** One entity in the left-panel list (customer, zone, vendor, brand, product type, or product) */
export interface EntityListItem {
  id: string;
  name: string;
  meta1: string;        // Line 2 left (e.g., zone + rep, or SKU + brand)
  meta2: string | null;  // Line 2 right (e.g., "22 orders"), null when not loaded
  revenue: number | null;      // null when metrics not loaded
  orderCount: number | null;   // null when metrics not loaded
  // WHY: Enrichment fields enable client-side filter + sort on all spec-defined fields.
  // Computed by dimension-grouper from the same order data already fetched.
  avgOrder: number | null;                // revenue / orderCount, null when not loaded
  marginPercent: number | null;           // (totalProfit / totalRevenue) * 100
  marginAmount: number | null;            // total profit in dollars
  frequency: number | null;        // orders per month, null when period < 1 month
  lastOrderDate: string | null;    // ISO date of most recent order, null when no orders
  rep: string | null;              // sales agent name (customer dimension only, null otherwise)
  zone: string | null;             // zone name (customer dimension only, null otherwise)
  customerType: string | null;     // customer type (customer dimension only, null otherwise)
}

/** Per-metric breakdown for KPI cards — mirrors the hero card sub-items pattern */
export interface KPIMetricBreakdown {
  prevYear: number;      // same-period previous year (apples-to-apples)
  prevYearFull: number;  // full previous year (all 12 months)
  thisQuarter: number;
  quarterLabel: string;  // e.g. "Q1" — the effective completed quarter (may differ from calendar quarter)
  lastMonth: number;
  lastMonthName: string;
  bestMonth: { name: string; value: number };
}

/** KPI values for the right panel — spec Section 10.1 */
export interface KPIs {
  totalRevenue: number;
  prevYearRevenue: number;       // same-period previous year
  prevYearRevenueFull: number;   // full previous year (all 12 months)
  revenueChangePercent: number | null;  // null when no prev year
  revenueChangeAmount: number;
  thisQuarterRevenue: number;
  lastQuarterRevenue: number;
  lastMonthRevenue: number;
  lastMonthName: string;           // e.g. "Feb" — label for the sub-item
  quarterLabel: string;            // e.g. "Q1" — the effective completed quarter
  bestMonth: { name: string; amount: number };
  orders: number;
  ordersChange: number;          // vs prev quarter
  avgOrder: number | null;       // null when 0 orders
  marginPercent: number | null;
  marginAmount: number;
  marginChangepp: number | null; // percentage points vs prev year
  frequency: number | null;      // orders/month, null when 0 months
  frequencyChange: number | null;
  lastOrderDays: number | null;  // null when no orders
  fillRate: number | null;       // 0-100, null when no items ordered
  fillRateChangepp: number | null;
  // Per-metric breakdowns for KPI cards (this quarter, last month, best month, prev year)
  ordersBreakdown: KPIMetricBreakdown;
  avgOrderBreakdown: KPIMetricBreakdown;
  marginPercentBreakdown: KPIMetricBreakdown;
  marginAmountBreakdown: KPIMetricBreakdown;
  frequencyBreakdown: KPIMetricBreakdown;
}

/** One month in the YoY bar chart — spec Section 20.1 */
export interface MonthlyRevenue {
  month: string;           // "Jan", "Feb", etc.
  monthIndex: number;      // 0-11
  currentYear: number;     // Revenue this period
  previousYear: number;    // Revenue prev period
}

/** One segment in the Product Mix donut — spec Section 20.2 */
export interface ProductMixSegment {
  category: string;
  value: number;
  percentage: number;
}

/** One item in the Top 10 Best Sellers — spec Section 22.5 */
export interface TopSellerItem {
  rank: number;
  name: string;
  sku: string;
  revenue: number;
  units: number;
  unit: string;           // Unit of measure from TUNITNAME (e.g., "cs", "ea", "lb")
}

/** The 5 donut categorizations for the product mix carousel */
export type ProductMixType = 'productType' | 'productFamily' | 'brand' | 'countryOfOrigin' | 'foodServiceRetail';

/** Human-readable labels for each mix type — used by carousel UI */
export const PRODUCT_MIX_LABELS: Record<ProductMixType, string> = {
  productType: 'Product Type',
  productFamily: 'Product Family',
  brand: 'Brand',
  countryOfOrigin: 'Country of Origin',
  foodServiceRetail: 'FS vs Retail',
};

/** Ordered list of mix types for carousel navigation */
export const PRODUCT_MIX_ORDER: ProductMixType[] = [
  'productType', 'productFamily', 'brand', 'countryOfOrigin', 'foodServiceRetail',
];

/** KPI sparkline data — spec Section 20.3 */
export interface SparklineData {
  values: number[];  // 6 monthly values, most recent last
}

/** One line item inside an expanded order row */
export interface OrderLineItem {
  productName: string;   // PDES
  sku: string;           // PARTNAME
  quantity: number;      // TQUANT
  unit: string;          // TUNITNAME, fallback "units"
  unitPrice: number;     // PRICE
  lineTotal: number;     // QPRICE
  marginPercent: number; // PERCENT
}

/** One order row in the Orders tab — spec Section 13.6 */
export interface OrderRow {
  date: string;           // ISO date
  orderNumber: string;
  /** WHY: Populated only in consolidated mode (Report 2 / View Consolidated 2). Absent in single-entity mode. */
  customerName?: string;
  itemCount: number;
  amount: number;
  marginPercent: number;
  marginAmount: number;
  status: 'Open' | 'Closed' | 'Partially Filled';
  items: OrderLineItem[];
}

/** Flat item for the Items tab explorer — aggregated by SKU, enriched with category fields */
export interface FlatItem {
  name: string;
  sku: string;
  /** WHY: Populated only in per-customer toggle view within consolidated mode. Null in main page (SKU-aggregated). */
  customerName?: string;
  value: number;
  marginPercent: number;
  marginAmount: number;
  productType: string;
  productFamily: string;
  brand: string;
  countryOfOrigin: string;
  foodServiceRetail: string;
  vendor: string;
  /** Sum of TQUANT across all current-period orders containing this SKU */
  totalUnits: number;
  /** Unit of measure — "cs", "lb", "ea", fallback "units" */
  unitName: string;
  /** PRICE from the most recent order containing this SKU */
  lastPrice: number;
  /** Unique orders containing this SKU / months in period */
  purchaseFrequency: number;
  /** ISO date of most recent order containing this SKU, null if none */
  lastOrderDate: string | null;
  /** Sum of QPRICE from previous year, 0 if no prev data */
  prevYearValue: number;
  /** Avg margin % from previous year, 0 if no prev data */
  prevYearMarginPercent: number;
  /** Sum of TQUANT from previous year, 0 if no prev data */
  prevYearUnits: number;
}

/** Contact in the Contacts tab — spec Section 18.4 */
export interface Contact {
  fullName: string;
  position: string;
  phone: string;
  email: string;
  /** WHY: Populated only in consolidated mode (Report 2 / View Consolidated 2). */
  customerName?: string;
}

/** Available dimensions — spec Section 5 */
export type Dimension = 'customer' | 'zone' | 'vendor' | 'brand' | 'product_type' | 'product';

/** Period selection */
export type Period = 'ytd' | string;  // 'ytd' or a year like '2025'

/** Load state for the "All {Dimension}" fetch — per dimension+period */
export type EntityListLoadState = 'not-loaded' | 'loading' | 'loaded' | 'error';

/** Filter params for the fetch-all dialog — narrows the server-side OData query */
export interface FetchAllFilters {
  agentName?: string[];
  zone?: string[];
  customerType?: string[];
}

/** SSE progress events from GET /api/sales/fetch-all */
export type SSEProgressEvent =
  | { phase: 'fetching'; rowsFetched: number; estimatedTotal: number }
  | { phase: 'incremental'; message: string; rowsFetched: number }
  | { phase: 'merging'; message: string }
  | { phase: 'processing'; message: string };

/** The full dashboard payload returned by GET /api/sales/dashboard */
export interface DashboardPayload {
  entities: EntityListItem[];
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMixes: Record<ProductMixType, ProductMixSegment[]>;
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: FlatItem[];
  yearsAvailable: string[];

  /** WHY: Per-entity breakdowns — populated only in consolidated mode for per-customer toggle tables. */
  perEntityProductMixes?: Record<string, Record<ProductMixType, ProductMixSegment[]>>;
  perEntityTopSellers?: Record<string, TopSellerItem[]>;
  perEntityMonthlyRevenue?: Record<string, MonthlyRevenue[]>;
}

/** Response shape from GET /api/sales/cache-status — enables iframe-reload resilience */
export interface CacheStatus {
  raw: boolean;
  lastFetchDate: string | null;
  rowCount: number;
  filterHashes: string[];
}
