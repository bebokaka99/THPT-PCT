import { QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './routes/AppRoutes';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ToastProvider } from './stores/toast-context';
import { queryClient } from './lib/query-client';

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
