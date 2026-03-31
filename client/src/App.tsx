// FILE: client/src/App.tsx
// PURPOSE: Root component — provides TanStack Query context and wires dashboard state
// USED BY: client/src/main.tsx
// EXPORTS: App

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { CopyToastProvider } from './components/shared/CopyToast';
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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* WHY: reducedMotion="user" tells Framer Motion to respect OS-level
         *  prefers-reduced-motion setting, suppressing all motion.* animations */}
        <MotionConfig reducedMotion="user">
          <CopyToastProvider>
            <DashboardApp />
          </CopyToastProvider>
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
