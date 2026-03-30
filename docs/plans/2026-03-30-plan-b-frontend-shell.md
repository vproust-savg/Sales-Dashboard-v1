# Plan B: Frontend Shell — React + Tailwind CSS v4 + Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every visual component of the dashboard with static/mock data. After this plan, the full UI renders pixel-perfect to the mockup — but with hardcoded data. Plan C wires it to the real backend.

**Architecture:** React 19 + Vite + Tailwind CSS v4 using CSS-native `@theme` (not `tailwind.config.js`). Framer Motion for animations. All design tokens defined as CSS custom properties. Components are presentational (props in, UI out) — no data fetching in this plan.

**Tech Stack:** React 19, Vite, Tailwind CSS v4, Framer Motion, TypeScript strict

**Spec reference:** `docs/specs/2026-03-29-sales-dashboard-design.md` — Sections 1-4 (layout + design), 8 (states), 9 (accessibility), 12 (animations), 20-21 (charts, polish), 22-25 (handoff measurements)

**Depends on:** Plan A (shared types in `shared/types/dashboard.ts`)
**Produces:** Pixel-perfect dashboard UI at `localhost:5173` with mock data

---

## File Structure

```
client/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.tsx                              — React entry point
    App.tsx                               — Root with layout, mock data provider
    mock-data.ts                          — Static mock data matching DashboardPayload shape
    styles/
      index.css                           — Tailwind v4 @theme + all design tokens from spec Section 25.1
    layouts/
      DashboardLayout.tsx                 — Master-detail flex layout (left 280px + right flex:1)
    components/
      left-panel/
        LeftPanel.tsx                     — Container: dim toggles + search + filter + list + selection bar
        DimensionToggles.tsx              — 2x3 grid of pill buttons
        SearchBox.tsx                     — Search input with magnifying glass icon
        FilterSortToolbar.tsx             — Filter + Sort buttons side by side
        FilterPanel.tsx                   — Expandable filter conditions (AnimatePresence)
        FilterCondition.tsx               — Single condition row (field + operator + value)
        EntityList.tsx                    — Scrollable list with sticky header
        EntityListItem.tsx                — Single list row (name, meta, checkbox, active state)
        SelectionBar.tsx                  — Multi-select bottom bar with "View Consolidated"
      right-panel/
        RightPanel.tsx                    — Container: header + KPIs + charts + tabs
        DetailHeader.tsx                  — Entity name + subtitle + period selector + export btn
        PeriodSelector.tsx                — Pill tabs with sliding active indicator
        KPISection.tsx                    — CSS Grid: hero card (left) + KPI grid (right)
        HeroRevenueCard.tsx               — Total Revenue with YoY bar chart
        KPICard.tsx                       — Individual KPI with sparkline
        YoYBarChart.tsx                   — SVG bar chart (12 months, paired bars)
        Sparkline.tsx                     — 60x24 SVG sparkline
        ChartsRow.tsx                     — CSS Grid: donut (3fr) + top 10 (5fr)
        ProductMixDonut.tsx               — SVG donut with center text + legend
        TopTenBestSellers.tsx             — Two-column ranked list
        TabsSection.tsx                   — Tab bar + content panels
        OrdersTable.tsx                   — Orders data table
        ItemsAccordion.tsx                — Category accordion with expandable products
        ContactsTable.tsx                 — Contacts table with email links
      shared/
        Badge.tsx                         — Count, Rank, Status badge variants
        Skeleton.tsx                      — Shimmer skeleton components
        EmptyState.tsx                    — Empty state with illustration + message
        AnimatedNumber.tsx                — Counter animation for KPI values
```

**Every file under 200 lines.** Intent block at top of each file.

---

## Task 0: Client Project Scaffolding

**Files:**
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`

- [ ] **Step 1: Create client/package.json**

```json
{
  "name": "sales-dashboard-client",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "framer-motion": "^12.0.0",
    "@tanstack/react-query": "^5.64.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create client/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@shared/*": ["../shared/*"],
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "../shared/**/*"]
}
```

- [ ] **Step 3: Create client/vite.config.ts**

```typescript
// FILE: client/vite.config.ts
// PURPOSE: Vite dev server config with Tailwind v4 plugin and API proxy
// USED BY: npm run dev, npm run build
// EXPORTS: Vite config

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

- [ ] **Step 4: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sales Dashboard</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Install dependencies**

Run: `cd client && npm install`
Expected: `node_modules/` created, 0 errors

- [ ] **Step 6: Commit**

```bash
git add client/package.json client/tsconfig.json client/vite.config.ts client/index.html client/package-lock.json
git commit -m "chore(client): scaffold React 19 + Vite + Tailwind v4 + Framer Motion"
```

---

## Task 1: Design Tokens — Tailwind v4 CSS Custom Properties

**Files:**
- Create: `client/src/styles/index.css`

This is the single source of truth for all visual values. Every measurement from spec Section 25.1.

- [ ] **Step 1: Write index.css with all design tokens**

```css
/* FILE: client/src/styles/index.css */
/* PURPOSE: Tailwind v4 @theme with all design tokens from spec Section 24-25 */
/* USED BY: Every component via Tailwind utility classes */

@import "tailwindcss";

@theme {
  /* Spacing scale — spec Section 24.1 */
  --spacing-2xs: 2px;
  --spacing-xs: 4px;
  --spacing-sm: 6px;
  --spacing-md: 8px;
  --spacing-base: 10px;
  --spacing-lg: 12px;
  --spacing-xl: 14px;
  --spacing-2xl: 16px;
  --spacing-3xl: 20px;
  --spacing-4xl: 24px;

  /* Colors — spec Section 2 */
  --color-bg-page: #f5f1eb;
  --color-bg-card: #ffffff;
  --color-gold-primary: #b8a88a;
  --color-gold-light: #d4c5a9;
  --color-gold-muted: #e8e0d0;
  --color-gold-subtle: #f0ece5;
  --color-gold-hover: #faf8f4;
  --color-dark: #2c2a26;
  --color-dark-hover: #3d3a35;
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #555555;
  --color-text-muted: #999999;
  --color-text-faint: #bbbbbb;
  --color-green: #22c55e;
  --color-red: #ef4444;
  --color-yellow: #eab308;
  --color-blue: #3b82f6;

  /* Border radius — spec Section 24.1 */
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-base: 8px;
  --radius-lg: 10px;
  --radius-xl: 12px;
  --radius-2xl: 14px;
  --radius-3xl: 16px;

  /* Shadows — spec Section 24.1 */
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.04);
  --shadow-active: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-dropdown: 0 4px 16px rgba(0, 0, 0, 0.12);
  --shadow-glow: -2px 0 8px rgba(184, 168, 138, 0.3);

  /* Font family */
  --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
}

/* Global styles */
html, body, #root {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: var(--font-sans);
  background: var(--color-bg-page);
  color: var(--color-text-primary);
  -webkit-font-smoothing: antialiased;
}

/* Focus ring — spec Section 24.4 */
*:focus-visible {
  outline: 2px solid var(--color-gold-primary);
  outline-offset: 2px;
}

/* Custom scrollbar — spec Section 21.5 */
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: var(--color-gold-subtle);
}
::-webkit-scrollbar-thumb {
  background: var(--color-gold-light);
  border-radius: var(--radius-xs);
}

/* Skeleton shimmer animation — spec Section 8.3 */
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}

.skeleton {
  background: linear-gradient(90deg, var(--color-gold-subtle) 0%, var(--color-gold-hover) 50%, var(--color-gold-subtle) 100%);
  background-size: 400px 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

/* Tabular numbers for animated counters — spec Section 21.6 */
.tabular-nums {
  font-feature-settings: 'tnum';
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 2: Verify Tailwind builds**

Run: `cd client && npx vite build --mode development 2>&1 | head -5`
Expected: Build starts without CSS errors

- [ ] **Step 3: Commit**

```bash
git add client/src/styles/index.css
git commit -m "feat(client): add Tailwind v4 @theme with all design tokens from spec"
```

---

## Task 2: App Entry + Mock Data

**Files:**
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/mock-data.ts`

- [ ] **Step 1: Write mock data matching DashboardPayload**

```typescript
// FILE: client/src/mock-data.ts
// PURPOSE: Static mock data for building the UI before backend integration
// USED BY: client/src/App.tsx (temporary — removed in Plan C)
// EXPORTS: MOCK_DASHBOARD

import type { DashboardPayload, Contact } from '@shared/types/dashboard';

export const MOCK_DASHBOARD: DashboardPayload = {
  entities: [
    { id: 'C001', name: 'Boulangerie Paul - Paris 5e', meta1: 'North \u00B7 Sarah M.', meta2: '22 orders', revenue: 134600, orderCount: 22 },
    { id: 'C002', name: 'Acme Corporation', meta1: 'North \u00B7 Sarah M.', meta2: '32 orders', revenue: 240200, orderCount: 32 },
    { id: 'C003', name: 'Boulangerie Paul - Paris 11e', meta1: 'East \u00B7 Rachel K.', meta2: '18 orders', revenue: 98400, orderCount: 18 },
    { id: 'C004', name: '\u00C9tablissements Gastronomiques', meta1: 'South \u00B7 Marc D.', meta2: '12 orders', revenue: 67200, orderCount: 12 },
    { id: 'C005', name: 'Metro Cash & Carry', meta1: 'West \u00B7 Sarah M.', meta2: '28 orders', revenue: 180000, orderCount: 28 },
  ],
  kpis: {
    totalRevenue: 240200, prevYearRevenue: 213800,
    revenueChangePercent: 12.4, revenueChangeAmount: 26400,
    thisQuarterRevenue: 68400, lastQuarterRevenue: 62100,
    bestMonth: { name: 'Sep', amount: 32400 },
    orders: 32, ordersChange: 4,
    avgOrder: 7506, marginPercent: 18.4, marginAmount: 44200,
    marginChangepp: -1.2, frequency: 2.7, frequencyChange: 0.3,
    lastOrderDays: 4, fillRate: 94.2, fillRateChangepp: 1.8,
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
  productMix: [
    { category: 'Packaging', value: 91200, percentage: 38 },
    { category: 'Raw Materials', value: 60000, percentage: 25 },
    { category: 'Equipment', value: 36000, percentage: 15 },
    { category: 'Consumables', value: 31200, percentage: 13 },
    { category: 'Other', value: 21600, percentage: 9 },
  ],
  topSellers: [
    { rank: 1, name: 'Kraft Mailer Box 300x200', sku: 'PKG-KM-300', revenue: 42800, units: 1240 },
    { rank: 2, name: 'PE Film Roll 500mm', sku: 'RAW-PE-500', revenue: 38200, units: 860 },
    { rank: 3, name: 'Corrugated Sheet A4', sku: 'PKG-CS-A4', revenue: 31500, units: 2100 },
    { rank: 4, name: 'Adhesive Tape Industrial', sku: 'CON-AT-IND', revenue: 24600, units: 3400 },
    { rank: 5, name: 'Bubble Wrap Roll 1200mm', sku: 'PKG-BW-1200', revenue: 18900, units: 520 },
    { rank: 6, name: 'Stretch Wrap 450mm', sku: 'PKG-SW-450', revenue: 16400, units: 780 },
    { rank: 7, name: 'Foam Insert Custom', sku: 'PKG-FI-CST', revenue: 14200, units: 640 },
    { rank: 8, name: 'Packing Peanuts 50L', sku: 'CON-PP-50L', revenue: 11800, units: 1960 },
    { rank: 9, name: 'Label Roll Thermal A6', sku: 'CON-LR-A6', revenue: 9600, units: 4200 },
    { rank: 10, name: 'Void Fill Paper Roll', sku: 'PKG-VF-ROL', revenue: 8300, units: 310 },
  ],
  sparklines: {
    revenue: { values: [18000, 22000, 25000, 21000, 27000, 24000] },
    orders: { values: [4, 6, 7, 5, 8, 6] },
  },
  orders: [
    { date: '2026-03-28T00:00:00Z', orderNumber: 'SO-26-0142', itemCount: 8, amount: 12400, marginPercent: 18.2, marginAmount: 2257, status: 'Delivered' },
    { date: '2026-03-15T00:00:00Z', orderNumber: 'SO-26-0128', itemCount: 5, amount: 8900, marginPercent: 20.1, marginAmount: 1789, status: 'Pending' },
    { date: '2026-02-28T00:00:00Z', orderNumber: 'SO-26-0098', itemCount: 12, amount: 18200, marginPercent: 16.5, marginAmount: 3003, status: 'Processing' },
  ],
  items: [
    {
      category: 'Packaging', totalValue: 91200, marginPercent: 19.2, marginAmount: 17510, itemCount: 6,
      products: [
        { name: 'Kraft Mailer Box 300x200', sku: 'PKG-KM-300', value: 42800, marginPercent: 21.3, marginAmount: 9116 },
        { name: 'Corrugated Sheet A4', sku: 'PKG-CS-A4', value: 31500, marginPercent: 18.1, marginAmount: 5702 },
        { name: 'Bubble Wrap Roll 1200mm', sku: 'PKG-BW-1200', value: 16900, marginPercent: 15.9, marginAmount: 2687 },
      ],
    },
    {
      category: 'Raw Materials', totalValue: 60000, marginPercent: 15.8, marginAmount: 9480, itemCount: 3,
      products: [
        { name: 'PE Film Roll 500mm', sku: 'RAW-PE-500', value: 38200, marginPercent: 16.2, marginAmount: 6188 },
        { name: 'Stretch Wrap 450mm', sku: 'PKG-SW-450', value: 21800, marginPercent: 15.1, marginAmount: 3292 },
      ],
    },
  ],
  yearsAvailable: ['2026', '2025', '2024', '2023'],
};

export const MOCK_CONTACTS: Contact[] = [
  { fullName: 'Marie Dupont', position: 'Purchasing Manager', phone: '+33 1 42 68 53 21', email: 'm.dupont@acme-corp.fr' },
  { fullName: 'Jean-Pierre Martin', position: 'Finance Director', phone: '+33 1 42 68 53 22', email: 'jp.martin@acme-corp.fr' },
  { fullName: 'Nathie Laurent', position: 'Head Chef', phone: '+33 6 12 34 56 78', email: 'n.laurent@acme-corp.fr' },
];
```

- [ ] **Step 2: Write main.tsx**

```tsx
// FILE: client/src/main.tsx
// PURPOSE: React entry point — mounts App to DOM
// USED BY: index.html
// EXPORTS: none (side effect: renders to #root)

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 3: Write App.tsx (shell with mock data)**

```tsx
// FILE: client/src/App.tsx
// PURPOSE: Root component — provides mock data to dashboard layout
// USED BY: client/src/main.tsx
// EXPORTS: App

import { DashboardLayout } from './layouts/DashboardLayout';
import { MOCK_DASHBOARD, MOCK_CONTACTS } from './mock-data';

export function App() {
  return (
    <DashboardLayout
      dashboard={MOCK_DASHBOARD}
      contacts={MOCK_CONTACTS}
      activeDimension="customer"
      activePeriod="ytd"
      activeEntityId="C002"
      selectedEntityIds={['C001', 'C003']}
    />
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/main.tsx client/src/App.tsx client/src/mock-data.ts
git commit -m "feat(client): add React entry point, App shell, and mock dashboard data"
```

---

## Task 3: Dashboard Layout

**Files:**
- Create: `client/src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Write the master-detail layout — spec Section 22.1**

```tsx
// FILE: client/src/layouts/DashboardLayout.tsx
// PURPOSE: Master-detail layout — left panel (280px) + right panel (flex:1)
// USED BY: client/src/App.tsx
// EXPORTS: DashboardLayout

import type { DashboardPayload, Contact, Dimension, Period } from '@shared/types/dashboard';
import { LeftPanel } from '../components/left-panel/LeftPanel';
import { RightPanel } from '../components/right-panel/RightPanel';

interface DashboardLayoutProps {
  dashboard: DashboardPayload;
  contacts: Contact[];
  activeDimension: Dimension;
  activePeriod: Period;
  activeEntityId: string | null;
  selectedEntityIds: string[];
}

export function DashboardLayout({
  dashboard, contacts, activeDimension, activePeriod,
  activeEntityId, selectedEntityIds,
}: DashboardLayoutProps) {
  const activeEntity = dashboard.entities.find(e => e.id === activeEntityId) ?? null;

  return (
    <div
      className="mx-auto flex h-[calc(100vh-32px)] max-w-[1440px] gap-[var(--spacing-2xl)] p-[var(--spacing-2xl)]"
      role="application"
      aria-label="Sales Dashboard"
    >
      {/* Left panel — 280px fixed */}
      <div className="flex w-[280px] shrink-0 flex-col gap-[var(--spacing-base)]">
        <LeftPanel
          entities={dashboard.entities}
          activeDimension={activeDimension}
          activeEntityId={activeEntityId}
          selectedEntityIds={selectedEntityIds}
        />
      </div>

      {/* Right panel — fills remaining space */}
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-base)] overflow-y-auto pr-[var(--spacing-xs)]">
        <RightPanel
          entity={activeEntity}
          kpis={dashboard.kpis}
          monthlyRevenue={dashboard.monthlyRevenue}
          productMix={dashboard.productMix}
          topSellers={dashboard.topSellers}
          sparklines={dashboard.sparklines}
          orders={dashboard.orders}
          items={dashboard.items}
          contacts={contacts}
          yearsAvailable={dashboard.yearsAvailable}
          activePeriod={activePeriod}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create placeholder LeftPanel and RightPanel**

Create `client/src/components/left-panel/LeftPanel.tsx`:

```tsx
// FILE: client/src/components/left-panel/LeftPanel.tsx
// PURPOSE: Left panel container — dimension toggles, search, filter, entity list, selection bar
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: LeftPanel

import type { EntityListItem, Dimension } from '@shared/types/dashboard';

interface LeftPanelProps {
  entities: EntityListItem[];
  activeDimension: Dimension;
  activeEntityId: string | null;
  selectedEntityIds: string[];
}

export function LeftPanel({ entities, activeDimension, activeEntityId, selectedEntityIds }: LeftPanelProps) {
  return (
    <>
      <div className="rounded-[var(--radius-2xl)] bg-[var(--color-bg-card)] p-[var(--spacing-sm)] shadow-[var(--shadow-card)]">
        <p className="text-center text-xs text-[var(--color-text-muted)]">DimensionToggles — Task 4</p>
      </div>
      <div className="rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] px-[var(--spacing-xl)] py-[var(--spacing-base)] shadow-[var(--shadow-card)]">
        <p className="text-xs text-[var(--color-text-muted)]">SearchBox — Task 5</p>
      </div>
      <div className="flex-1 rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)]">
        <p className="p-4 text-xs text-[var(--color-text-muted)]">{entities.length} entities — Tasks 6-8</p>
      </div>
    </>
  );
}
```

Create `client/src/components/right-panel/RightPanel.tsx`:

```tsx
// FILE: client/src/components/right-panel/RightPanel.tsx
// PURPOSE: Right panel container — header, KPIs, charts, tabs
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: RightPanel

import type {
  EntityListItem, KPIs, MonthlyRevenue, ProductMixSegment,
  TopSellerItem, SparklineData, OrderRow, ItemCategory, Contact, Period,
} from '@shared/types/dashboard';

interface RightPanelProps {
  entity: EntityListItem | null;
  kpis: KPIs;
  monthlyRevenue: MonthlyRevenue[];
  productMix: ProductMixSegment[];
  topSellers: TopSellerItem[];
  sparklines: Record<string, SparklineData>;
  orders: OrderRow[];
  items: ItemCategory[];
  contacts: Contact[];
  yearsAvailable: string[];
  activePeriod: Period;
}

export function RightPanel({ entity, kpis, activePeriod, yearsAvailable }: RightPanelProps) {
  return (
    <>
      <div className="rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-4xl)] py-[var(--spacing-xl)] shadow-[var(--shadow-card)]">
        <p className="text-xl font-bold">{entity?.name ?? 'All Customers'}</p>
      </div>
      <div className="rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]">
        <p className="text-xs text-[var(--color-text-muted)]">KPISection — Task 9-11</p>
      </div>
      <div className="flex-1 rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)]">
        <p className="p-4 text-xs text-[var(--color-text-muted)]">TabsSection — Tasks 14-16</p>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify it renders**

Run: `cd client && npm run dev`
Expected: Opens at `localhost:5173`, shows the two-panel layout with placeholder text on `#f5f1eb` background

- [ ] **Step 4: Commit**

```bash
git add client/src/layouts/ client/src/components/
git commit -m "feat(client): add master-detail DashboardLayout with placeholder panels"
```

---

## Tasks 4–16: Component Implementation

The remaining tasks follow the same pattern. Each task:
1. Creates one component file
2. Replaces a placeholder in the parent
3. Verifies it renders correctly in the browser

**Due to plan size, tasks 4–16 are listed as specifications. Each follows the same step pattern as Tasks 0–3: write file → replace placeholder → verify in browser → commit.**

### Task 4: DimensionToggles
**File:** `client/src/components/left-panel/DimensionToggles.tsx`
**Spec:** Section 3.1, 22.2 — 2x3 grid, active state `#2c2a26`, `role="tablist"`, keyboard `←`/`→`
**Props:** `activeDimension: Dimension, onDimensionChange: (d: Dimension) => void`

### Task 5: SearchBox
**File:** `client/src/components/left-panel/SearchBox.tsx`
**Spec:** Section 3.2, 22.2 — 280×36px, `border-radius: 12px`, `role="searchbox"`, magnifying glass icon
**Props:** `value: string, onChange: (v: string) => void, placeholder: string`

### Task 6: EntityList + EntityListItem
**Files:** `client/src/components/left-panel/EntityList.tsx`, `EntityListItem.tsx`
**Spec:** Section 3.5, 22.2 — Sticky header "CUSTOMERS (8 OF 42)", scrollable list, `role="listbox"`, active state with 3px gold left border + `#f0ebe3` bg, asymmetric padding `12px 16px 12px 13px` on selected
**Props:** `entities: EntityListItem[], activeId: string | null, selectedIds: string[], onSelect, onCheck`

### Task 7: Badge (shared component)
**File:** `client/src/components/shared/Badge.tsx`
**Spec:** Section 8.4 — Three variants: Count (circle), Rank (square), Status (pill). Color props.
**Props:** `variant: 'count' | 'rank' | 'status', value: string | number, color?: string`

### Task 8: SelectionBar + FilterSortToolbar
**Files:** `client/src/components/left-panel/SelectionBar.tsx`, `FilterSortToolbar.tsx`
**Spec:** Section 3.6, 22.2 — Slide-up bar with `backdrop-filter: blur(8px)`, "View Consolidated" dark button, AnimatePresence for enter/exit

### Task 9: KPISection + HeroRevenueCard
**Files:** `client/src/components/right-panel/KPISection.tsx`, `HeroRevenueCard.tsx`
**Spec:** Section 4.2, 22.4 — CSS Grid `1fr 1fr`, hero card 460×281px with `30px/800` hero value, sub-items row, Previous Year right-aligned

### Task 10: YoYBarChart (SVG)
**File:** `client/src/components/right-panel/YoYBarChart.tsx`
**Spec:** Section 20.1 — Full-width 120px height SVG, paired bars (prev = `#e8e0d0` 50% opacity, current = `#d4c5a9`), `border-radius: 2px` top, grid lines dashed, Y-axis labels, hover highlights pair + dims others

### Task 11: KPICard + Sparkline + AnimatedNumber
**Files:** `client/src/components/right-panel/KPICard.tsx`, `Sparkline.tsx`, `client/src/components/shared/AnimatedNumber.tsx`
**Spec:** Section 22.4, 20.3, 21.3 — 226×88px cards, `10px` uppercase label, `17px/700` value, sparkline 60×24px SVG, counter animation via Framer Motion `useSpring`

### Task 12: DetailHeader + PeriodSelector
**Files:** `client/src/components/right-panel/DetailHeader.tsx`, `PeriodSelector.tsx`
**Spec:** Section 4.1, 22.3, 21.9 — Header card with entity name/subtitle, period pill tabs with Framer Motion `layoutId` sliding indicator, Export button

### Task 13: ChartsRow + ProductMixDonut + TopTenBestSellers
**Files:** `client/src/components/right-panel/ChartsRow.tsx`, `ProductMixDonut.tsx`, `TopTenBestSellers.tsx`
**Spec:** Section 4.3, 20.2, 22.5 — CSS Grid `3fr 5fr`, SVG donut 160×160 with center text + legend, two-column Top 10 with rank badges + vertical divider

### Task 14: TabsSection
**File:** `client/src/components/right-panel/TabsSection.tsx`
**Spec:** Section 4.4, 22.6 — Tab bar with gold underline on active, count badges, `role="tablist"`, keyboard `←`/`→`

### Task 15: OrdersTable + ItemsAccordion
**Files:** `client/src/components/right-panel/OrdersTable.tsx`, `ItemsAccordion.tsx`
**Spec:** Section 13.6, 22.6 — Orders table with status badges, Items accordion with category rows (chevron + progress bar) and expandable products

### Task 16: ContactsTable + EmptyState
**Files:** `client/src/components/right-panel/ContactsTable.tsx`, `client/src/components/shared/EmptyState.tsx`
**Spec:** Section 4.4, 11.2 — Contacts with gold email links, EmptyState with SVG illustration

---

## Task 17: FilterPanel + FilterCondition

**Files:** `client/src/components/left-panel/FilterPanel.tsx`, `FilterCondition.tsx`
**Spec:** Section 3.4, 22.7 — Expandable panel with AnimatePresence, stacked conditions in `#faf8f4` cards, AND/OR conjunctions, field/operator/value selectors

---

## Task 18: Skeleton Loading Components

**File:** `client/src/components/shared/Skeleton.tsx`
**Spec:** Section 8.3 — Shimmer animation, left panel skeleton (8 rows), right panel skeleton (header + KPIs + charts + tabs). Progressive loading order.

---

## Task 19: Final Frontend Verification

- [ ] **Step 1: Verify TypeScript compiles**

Run: `cd client && npx tsc -b --noEmit`
Expected: 0 errors

- [ ] **Step 2: Verify Vite builds**

Run: `cd client && npm run build`
Expected: Build succeeds, `dist/` created

- [ ] **Step 3: Visual comparison with mockup**

Open `localhost:5173` side-by-side with the mockup at `docs/specs/dashboard-mockup-v5-reference.png`. Verify:
- Two-panel layout with correct widths (280px / flex:1)
- All design tokens match (colors, fonts, spacing, radii)
- Component hierarchy matches the spec
- All 6 KPI cards render with correct labels/values
- Bar chart, donut, and Top 10 render
- Tab section shows Orders/Items/Contacts

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(client): Plan B complete — all components rendering with mock data"
```

---

## Plan B Summary

| Task | Component(s) | Spec Sections |
|------|-------------|---------------|
| 0 | Project scaffolding | — |
| 1 | Design tokens (index.css) | 24, 25 |
| 2 | App entry + mock data | — |
| 3 | DashboardLayout | 1, 22.1 |
| 4 | DimensionToggles | 3.1, 22.2 |
| 5 | SearchBox | 3.2, 22.2 |
| 6 | EntityList + EntityListItem | 3.5, 22.2 |
| 7 | Badge (shared) | 8.4 |
| 8 | SelectionBar + FilterSortToolbar | 3.6, 22.2 |
| 9 | KPISection + HeroRevenueCard | 4.2, 22.4 |
| 10 | YoYBarChart (SVG) | 20.1 |
| 11 | KPICard + Sparkline + AnimatedNumber | 22.4, 20.3, 21.3 |
| 12 | DetailHeader + PeriodSelector | 4.1, 22.3, 21.9 |
| 13 | ChartsRow + Donut + Top10 | 4.3, 20.2, 22.5 |
| 14 | TabsSection | 4.4, 22.6 |
| 15 | OrdersTable + ItemsAccordion | 13.6, 22.6 |
| 16 | ContactsTable + EmptyState | 4.4, 11.2 |
| 17 | FilterPanel + FilterCondition | 3.4, 22.7 |
| 18 | Skeleton loading components | 8.3 |
| 19 | Final verification | — |

**Total: 20 tasks, ~30 files created**

**Note:** Tasks 4–18 are specified but not expanded with full code. The implementing agent should use the spec sections referenced in each task for exact measurements, colors, and behavior. Each component follows the same file pattern: intent block, typed props interface, presentational component, Tailwind classes using design token CSS variables.

---

## Parallelization Map

Use `dispatching-parallel-agents` to run independent tasks concurrently. Plan B has high parallelism because components are presentational (no shared state).

```
Sequential prerequisites:
  Task 0 (scaffolding) → Task 1 (design tokens) → Task 2 (App + mock data) → Task 3 (layout)

After Task 3, these component groups are INDEPENDENT:
  ┌─ Agent 1 (Left Panel):  Task 4 (DimToggles) → Task 5 (Search) → Task 6 (EntityList) → Task 8 (SelectionBar + Toolbar)
  ├─ Agent 2 (Right KPIs):  Task 9 (KPISection + Hero) → Task 10 (YoYBarChart) → Task 11 (KPICard + Sparkline)
  ├─ Agent 3 (Right Charts): Task 12 (Header + Period) → Task 13 (Charts + Donut + Top10)
  ├─ Agent 4 (Tabs):        Task 14 (TabsSection) → Task 15 (Orders + Items) → Task 16 (Contacts + EmptyState)
  └─ Agent 5 (Shared):      Task 7 (Badge) + Task 17 (FilterPanel) + Task 18 (Skeletons)

After all agents complete:
  Task 19 (final verification)
```

**Why these are independent:**
- Agent 1 writes only to `components/left-panel/`
- Agent 2 writes only to `components/right-panel/KPI*.tsx`, `Sparkline.tsx`, `AnimatedNumber.tsx`
- Agent 3 writes only to `components/right-panel/DetailHeader.tsx`, `PeriodSelector.tsx`, `ChartsRow.tsx`, `ProductMixDonut.tsx`, `TopTenBestSellers.tsx`
- Agent 4 writes only to `components/right-panel/TabsSection.tsx`, `OrdersTable.tsx`, `ItemsAccordion.tsx`, `ContactsTable.tsx`
- Agent 5 writes only to `components/shared/` and `components/left-panel/Filter*.tsx`

**No shared state conflicts:** Each agent writes to different files. All import from `shared/types/dashboard.ts` (read-only) and use design tokens from `index.css` (read-only).

### Agent Prompt Template (example for Agent 2)

```
Implement Tasks 9-11 from docs/plans/2026-03-30-plan-b-frontend-shell.md.

Context: You're building the KPI section of a sales dashboard. This includes:
- KPISection: CSS Grid layout (1fr 1fr) containing hero card + KPI grid
- HeroRevenueCard: Total Revenue hero with YoY bar chart (460x281px)
- KPICard: Individual KPI card (226x88px) with sparkline
- YoYBarChart: SVG bar chart (12 months, paired bars)
- Sparkline: 60x24px SVG mini chart
- AnimatedNumber: Counter animation using Framer Motion useSpring

Exact measurements: docs/specs/2026-03-29-sales-dashboard-design.md Sections 4.2, 20.1, 20.3, 21.3, 22.4
Design tokens: client/src/styles/index.css (already created)
Types: shared/types/dashboard.ts (already created)
Mock data: client/src/mock-data.ts (use for prop values)

Constraints: Only write to client/src/components/right-panel/ and client/src/components/shared/AnimatedNumber.tsx
Pattern: Intent block at top of each file. Tailwind classes using CSS variable tokens. Under 200 lines per file.
Output: Summary of components built + screenshot comparison with mockup
```
