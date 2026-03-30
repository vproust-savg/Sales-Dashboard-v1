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
