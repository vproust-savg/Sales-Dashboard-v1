// FILE: shared/types/dashboard.ts
// PURPOSE: Shared types for dashboard data exchanged between server and client
// USED BY: server/services/data-aggregator.ts, client/hooks/useDashboardData.ts
// EXPORTS: DashboardPayload, EntityListItem, KPIs, MonthlyRevenue, ProductMixSegment, TopSellerItem, OrderRow, ItemCategory, Contact

/** One entity in the left-panel list (customer, zone, vendor, brand, product type, or product) */
export interface EntityListItem {
  id: string;
  name: string;
  meta1: string;        // Line 2 left (e.g., zone + rep, or SKU + brand)
  meta2: string;        // Line 2 right (e.g., "22 orders")
  revenue: number;      // For sort + display
  orderCount: number;   // For sort + display
  // WHY: Enrichment fields enable client-side filter + sort on all spec-defined fields.
  // Computed by dimension-grouper from the same order data already fetched.
  avgOrder: number;                // revenue / orderCount, 0 when no orders
  marginPercent: number;           // (totalProfit / totalRevenue) * 100
  marginAmount: number;            // total profit in dollars
  frequency: number | null;        // orders per month, null when period < 1 month
  lastOrderDate: string | null;    // ISO date of most recent order, null when no orders
  rep: string | null;              // sales agent name (customer dimension only, null otherwise)
  zone: string | null;             // zone name (customer dimension only, null otherwise)
  customerType: string | null;     // customer type (customer dimension only, null otherwise)
}

/** KPI values for the right panel — spec Section 10.1 */
export interface KPIs {
  totalRevenue: number;
  prevYearRevenue: number;
  revenueChangePercent: number | null;  // null when no prev year
  revenueChangeAmount: number;
  thisQuarterRevenue: number;
  lastQuarterRevenue: number;
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
}

/** KPI sparkline data — spec Section 20.3 */
export interface SparklineData {
  values: number[];  // 6 monthly values, most recent last
}

/** One order row in the Orders tab — spec Section 13.6 */
export interface OrderRow {
  date: string;           // ISO date
  orderNumber: string;
  itemCount: number;
  amount: number;
  marginPercent: number;
  marginAmount: number;
  status: 'Delivered' | 'Pending' | 'Processing';
}

/** Category + products for the Items tab accordion — spec Section 4.4 */
export interface ItemCategory {
  category: string;
  totalValue: number;
  marginPercent: number;
  marginAmount: number;
  itemCount: number;
  products: ItemProduct[];
}

export interface ItemProduct {
  name: string;
  sku: string;
  value: number;
  marginPercent: number;
  marginAmount: number;
}

/** Contact in the Contacts tab — spec Section 18.4 */
export interface Contact {
  fullName: string;
  position: string;
  phone: string;
  email: string;
}

/** Available dimensions — spec Section 5 */
export type Dimension = 'customer' | 'zone' | 'vendor' | 'brand' | 'product_type' | 'product';

/** Period selection */
export type Period = 'ytd' | string;  // 'ytd' or a year like '2025'

/** The full dashboard payload returned by GET /api/sales/dashboard */
export interface DashboardPayload {
  entities: EntityListItem[];
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMix: ProductMixSegment[];
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: ItemCategory[];
  yearsAvailable: string[];
}
