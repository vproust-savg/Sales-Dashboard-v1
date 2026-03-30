// FILE: client/src/components/shared/ErrorBoundary.tsx
// PURPOSE: Catch React runtime errors and show a fallback UI instead of white screen
// USED BY: client/src/App.tsx
// EXPORTS: ErrorBoundary

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// WHY: React error boundaries must be class components — no hook equivalent exists.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-[var(--color-bg-page)]">
          <div className="max-w-[400px] rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] p-[var(--spacing-4xl)] text-center shadow-[var(--shadow-card)]">
            <h2 className="text-[18px] font-bold text-[var(--color-text-primary)]">
              Something went wrong
            </h2>
            <p className="mt-[var(--spacing-md)] text-[13px] text-[var(--color-text-muted)]">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-[var(--spacing-xl)] rounded-[var(--radius-base)] bg-[var(--color-dark)] px-[var(--spacing-2xl)] py-[var(--spacing-md)] text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-dark-hover)]"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
