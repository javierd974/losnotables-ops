import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

export type Toast = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  timeoutMs?: number;
};

type ToastContextValue = {
  push: (t: Omit<Toast, 'id'>) => void;
  remove: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID?.() ?? String(Date.now()) + Math.random().toString(16).slice(2);
    const toast: Toast = { id, timeoutMs: 3200, ...t };
    setToasts(prev => [...prev, toast]);

    const ms = toast.timeoutMs ?? 3200;
    if (ms > 0) setTimeout(() => remove(id), ms);
  }, [remove]);

  const value = useMemo(() => ({ push, remove }), [push, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toaster */}
      <div style={{
        position: 'fixed',
        right: 14,
        bottom: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 9999,
        maxWidth: 500
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--border-color)',
            borderLeft: `4px solid ${
              t.type === 'success' ? 'var(--color-secondary)' :
              t.type === 'error' ? 'var(--color-danger)' :
              t.type === 'warning' ? 'var(--color-warning)' :
              'var(--color-primary)'
            }`,
            borderRadius: 12,
            padding: '10px 12px',
            boxShadow: '0 10px 30px rgba(0,0,0,.35)',
            color: 'white'
          }}>
            {t.title && <div style={{ fontWeight: 800, marginBottom: 2 }}>{t.title}</div>}
            <div style={{ fontSize: 18, color: 'var(--color-text-muted)' }}>{t.message}</div>

            <button
              onClick={() => remove(t.id)}
              style={{
                position: 'absolute',
                opacity: 0,
                pointerEvents: 'none'
              }}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};
