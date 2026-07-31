import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CircleAlert, RotateCcw } from 'lucide-react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui:error-boundary]', {
      error,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <section className="w-full max-w-lg rounded-lg border border-red-200 bg-white p-6 text-center shadow-sm">
          <CircleAlert className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-bold text-slate-950">Không thể hiển thị trang</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Giao diện đã gặp lỗi ngoài dự kiến. Hãy tải lại trang để tiếp tục.
          </p>
          {import.meta.env.DEV && this.state.error?.message ? (
            <p className="mt-3 rounded bg-red-50 px-3 py-2 text-left font-mono text-xs text-red-800">
              {this.state.error.message}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Tải lại trang
          </button>
        </section>
      </main>
    );
  }
}
