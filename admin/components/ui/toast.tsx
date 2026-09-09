'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, tone, message }]);

      /**
       * Errors stay until dismissed.
       *
       * A success can vanish — the table behind it already shows the new state.
       * An error is often the only place the reason exists, and auto-hiding it
       * after four seconds means an admin who looked away never learns why
       * their action did not take.
       */
      if (tone === 'success') {
        window.setTimeout(() => dismiss(id), 4000);
      }
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex animate-fade-in items-start gap-3 rounded-lg border p-3 shadow-lg',
              toast.tone === 'success'
                ? 'border-brand/30 bg-surface-raised'
                : 'border-danger/40 bg-surface-raised',
            )}
          >
            {toast.tone === 'success' ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
            )}
            <p className="flex-1 text-sm text-ink">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="text-ink-subtle transition-colors duration-snap hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
