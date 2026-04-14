// FILE: client/src/utils/dimension-config.ts
// PURPOSE: Per-dimension labels, search placeholders, filter fields — spec Section 15
// USED BY: client/src/components/left-panel/LeftPanel.tsx, CollapsedPanel.tsx, SearchBox.tsx, FilterPanel.tsx
// EXPORTS: DIMENSION_CONFIG, DimensionConfig

import type { Dimension } from '@shared/types/dashboard';

export interface DimensionConfig {
  label: string;
  singularLabel: string;
  pluralLabel: string;
  searchPlaceholder: string;
  allLabel: string;
  filterFields: string[];
}

export const DIMENSION_CONFIG: Record<Dimension, DimensionConfig> = {
  customer: {
    label: 'Customers',
    singularLabel: 'customer',
    pluralLabel: 'CUSTOMERS',
    searchPlaceholder: 'Search customers...',
    allLabel: 'Report',
    filterFields: [
      'Rep', 'Customer Type', 'Zone', 'Last Order Date',
      'Margin %', 'Margin $', 'Total Revenue', 'Average Order',
      'Frequency', 'Outstanding',
    ],
  },
  zone: {
    label: 'Zone',
    singularLabel: 'zone',
    pluralLabel: 'ZONES',
    searchPlaceholder: 'Search zones...',
    allLabel: 'Report',
    filterFields: [
      'Rep', 'Last Order Date', 'Margin %', 'Margin $',
      'Total Revenue', 'Average Order', 'Frequency', 'Outstanding',
    ],
  },
  vendor: {
    label: 'Vendors',
    singularLabel: 'vendor',
    pluralLabel: 'VENDORS',
    searchPlaceholder: 'Search vendors...',
    allLabel: 'Report',
    filterFields: [
      'Last Order Date', 'Margin %', 'Margin $', 'Total Revenue',
      'Average Order', 'Frequency', 'Outstanding',
    ],
  },
  brand: {
    label: 'Brands',
    singularLabel: 'brand',
    pluralLabel: 'BRANDS',
    searchPlaceholder: 'Search brands...',
    allLabel: 'Report',
    filterFields: [
      'Last Order Date', 'Margin %', 'Margin $', 'Total Revenue',
      'Average Order', 'Frequency', 'Outstanding',
    ],
  },
  product_type: {
    label: 'Prod. Type',
    singularLabel: 'product type',
    pluralLabel: 'PRODUCT TYPES',
    searchPlaceholder: 'Search product types...',
    allLabel: 'Report',
    filterFields: [
      'Last Order Date', 'Margin %', 'Margin $', 'Total Revenue',
      'Average Order', 'Frequency', 'Outstanding',
    ],
  },
  product: {
    label: 'Products',
    singularLabel: 'product',
    pluralLabel: 'PRODUCTS',
    searchPlaceholder: 'Search products...',
    allLabel: 'Report',
    filterFields: [
      'Last Order Date', 'Margin %', 'Margin $', 'Total Revenue',
      'Average Order', 'Frequency', 'Outstanding',
    ],
  },
};
