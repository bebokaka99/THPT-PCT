import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';

export const API_ERROR_EVENT = 'thpt-pct-pt:api-error';

export type ToastType = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  addToast: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  removeToast: (id: number) => void;
  clearToasts: () => void;
};

type ApiErrorEventDetail = {
  message?: unknown;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);
let nextToastId = 1;

const toastStyles: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  error: 'border-red-200 bg-red-50 text-red-950',
  info: 'border-blue-200 bg-blue-50 text-blue-950',
};

const toastIcons = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastsRef = useRef<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const removeToast = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => {
      const next = current.filter((toast) => toast.id !== id);
      toastsRef.current = next;
      return next;
    });
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const normalizedMessage = message.trim();
      if (!normalizedMessage) return;

      if (
        toastsRef.current.some(
          (toast) => toast.type === type && toast.message === normalizedMessage,
        )
      ) {
        return;
      }

      const id = nextToastId++;
      const next = [...toastsRef.current.slice(-3), { id, type, message: normalizedMessage }];
      toastsRef.current = next;
      setToasts(next);
      timers.current.set(id, setTimeout(() => removeToast(id), 5000));
    },
    [removeToast],
  );

  const success = useCallback((message: string) => addToast('success', message), [addToast]);
  const error = useCallback((message: string) => addToast('error', message), [addToast]);
  const info = useCallback((message: string) => addToast('info', message), [addToast]);
  const clearToasts = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    toastsRef.current = [];
    setToasts([]);
  }, []);

  useEffect(() => {
    const handleApiError = (event: Event) => {
      const detail = (event as CustomEvent<ApiErrorEventDetail>).detail;
      if (typeof detail?.message === 'string') {
        error(detail.message);
      }
    };

    window.addEventListener(API_ERROR_EVENT, handleApiError);
    return () => {
      window.removeEventListener(API_ERROR_EVENT, handleApiError);
      clearToasts();
    };
  }, [clearToasts, error]);

  const value = useMemo(
    () => ({ addToast, success, error, info, removeToast, clearToasts }),
    [addToast, clearToasts, error, info, removeToast, success],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => {
          const Icon = toastIcons[toast.type];
          return (
            <div
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${toastStyles[toast.type]}`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-sm font-medium leading-5">{toast.message}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded p-0.5 opacity-70 transition hover:bg-black/5 hover:opacity-100"
                aria-label="Đóng thông báo"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
