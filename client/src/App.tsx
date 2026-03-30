// FILE: client/src/App.tsx
// PURPOSE: Root component — provides TanStack Query context and wires dashboard state
// USED BY: client/src/main.tsx
// EXPORTS: App

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from './layouts/DashboardLayout';
import { useDashboardState } from './hooks/useDashboardState';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false, // WHY: iframe environment makes focus events unreliable
    },
  },
});

function DashboardApp() {
  const state = useDashboardState();
  return <DashboardLayout {...state} />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardApp />
    </QueryClientProvider>
  );
}
