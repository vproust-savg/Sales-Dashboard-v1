// FILE: client/src/utils/dimension-config.ts
// PURPOSE: Per-dimension labels, search placeholders, filter fields — spec Section 15
// USED BY: client/src/components/left-panel/LeftPanel.tsx, SearchBox.tsx, FilterPanel.tsx
// EXPORTS: DIMENSION_CONFIG, DimensionConfig

import type { Dimension } from '@shared/types/dashboard';

export interface DimensionConfig {
  label: string;
  pluralLabel: string;
  searchPlaceholder: string;
  allLabel: string;
  filterFields: string[];
}

export const DIMENSION_CONFIG: Record<Dimension, DimensionConfig> = {
  customer: {
    label: 'Customers',
    pluralLabel: 'CUSTOMERS',
    searchPlaceholder: 'Search customers...',
    allLabel: 'All Customers',
    filterFields: [
      'Rep', 'Customer Type', 'Zone', 'Last Order Date',
      'Margin %', 'Margin $', 'Total Revenue', 'Average Order',
      'Frequency', 'Outstanding',
    ],
  },
  zone: {
    label: 'Zone',
    pluralLabel: 'ZONES',
    searchPlaceholder: 'Search zones...',
    allLabel: 'All Zones',
    filterFields: [
      'Rep', 'Last Order Date', 'Margin %', 'Margin $',
      'Total Revenue', 'Average Order', 'Frequency', 'Outstanding',
    ],
  },
  vendor: {
    label: 'Vendors',
    pluralLabel: 'VENDORS',
    searchPlaceholder: 'Search vendors...',
    allLabel: 'All Vendors',
    filterFields: [
      'Last Order Date', 'Margin %', 'Margin $', 'Total Revenue',
      'Average Order', 'Frequency', 'Outstanding',
    ],
  },
  brand: {
    label: 'Brands',
    pluralLabel: 'BRANDS',
    searchPlaceholder: 'Search brands...',
    allLabel: 'All Brands',
    filterFields: [
      'Last Order Date', 'Margin %', 'Margin $', 'Total Revenue',
      'Average Order', 'Frequency', 'Outstanding',
    ],
  },
  product_type: {
    label: 'Prod. Type',
    pluralLabel: 'PRODUCT TYPES',
    searchPlaceholder: 'Search product types...',
    allLabel: 'All Product Types',
    filterFields: [
      'Last Order Date', 'Margin %', 'Margin $', 'Total Revenue',
      'Average Order', 'Frequency', 'Outstanding',
    ],
  },
  product: {
    label: 'Products',
    pluralLabel: 'PRODUCTS',
    searchPlaceholder: 'Search products...',
    allLabel: 'All Products',
    filterFields: [
      'Last Order Date', 'Margin %', 'Margin $', 'Total Revenue',
      'Average Order', 'Frequency', 'Outstanding',
    ],
  },
};
