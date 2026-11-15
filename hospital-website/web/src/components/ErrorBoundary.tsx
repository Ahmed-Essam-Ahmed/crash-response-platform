import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled dashboard error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-dvh place-items-center px-4">
          <div className="card max-w-md space-y-3 p-6 text-sm">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-muted">
              The dashboard could not render. Reload the page to start from a clean view.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
            >
              Reload dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
