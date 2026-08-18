import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, RotateCcw } from 'lucide-react';
import { Button } from './ui/Button';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number; // ms
  onUndo?: () => void | Promise<void>;
  undoLabel?: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ToastItem extends ToastOptions {
  id: string;
  progress: number;
}

interface NotificationContextProps {
  showToast: (options: ToastOptions | string) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmOptions | null>(null);
  const confirmResolver = useRef<((value: boolean) => void) | null>(null);
  const toastIntervals = useRef<Map<string, any>>(new Map());

  // Clean up all intervals on unmount
  useEffect(() => {
    return () => {
      toastIntervals.current.forEach((intervalId) => clearInterval(intervalId));
      toastIntervals.current.clear();
    };
  }, []);

  const showToast = useCallback((options: ToastOptions | string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const opts: ToastOptions = typeof options === 'string' ? { message: options } : options;
    const type = opts.type || 'info';
    const duration = opts.duration ?? (opts.onUndo ? 6000 : 4000);

    setToasts((prev) => [...prev, { ...opts, id, type, duration, progress: 100 }]);

    if (duration > 0) {
      const startTime = Date.now();
      const intervalId = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remainingPercentage = Math.max(0, 100 - (elapsed / duration) * 100);

        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, progress: remainingPercentage } : t))
        );

        if (elapsed >= duration) {
          clearInterval(intervalId);
          toastIntervals.current.delete(id);
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }
      }, 50);

      toastIntervals.current.set(id, intervalId);
    }
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions) => {
    setConfirmModal(options);
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
    });
  }, []);

  const handleConfirmResolve = (value: boolean) => {
    if (confirmResolver.current) {
      confirmResolver.current(value);
      confirmResolver.current = null;
    }
    setConfirmModal(null);
  };

  const handleRemoveToast = (id: string) => {
    const intervalId = toastIntervals.current.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      toastIntervals.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUndo = async (toast: ToastItem) => {
    if (toast.onUndo) {
      try {
        await toast.onUndo();
      } catch (err) {
        console.error('Failed to undo:', err);
      }
    }
    handleRemoveToast(toast.id);
  };

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Floating Toasts Stack */}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const isUndoable = !!toast.onUndo;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                className={`pointer-events-auto relative overflow-hidden rounded-[3px] border p-3.5 shadow-2xl flex gap-3 items-start bg-parchment text-text-main ${
                  toast.type === 'success'
                    ? 'border-polish/50'
                    : toast.type === 'warning'
                    ? 'border-amber-800/60'
                    : toast.type === 'error'
                    ? 'border-polish/50'
                    : 'border-parchment-2'
                }`}
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0">
                  {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-polish" />}
                  {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-polish" />}
                  {toast.type === 'info' && <Info className="w-4 h-4 text-text-muted" />}
                </div>

                {/* Message & Actions */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-xs font-medium leading-relaxed font-sans pr-2 text-text-main">
                    {toast.message}
                  </p>
                  {isUndoable && (
                    <button
                      onClick={() => handleUndo(toast)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-polish hover:underline transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {toast.undoLabel || 'Hoàn tác'}
                    </button>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={() => handleRemoveToast(toast.id)}
                  className="text-text-muted hover:text-text-main rounded p-0.5 transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Progress bar countdown */}
                {toast.duration && toast.duration > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-parchment-2">
                    <div
                      className={`h-full transition-all duration-75 ${
                        toast.type === 'success'
                          ? 'bg-polish'
                          : toast.type === 'warning'
                          ? 'bg-amber-500'
                          : toast.type === 'error'
                          ? 'bg-polish'
                          : 'bg-draft'
                      }`}
                      style={{ width: `${toast.progress}%` }}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleConfirmResolve(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative bg-parchment border border-parchment-2 rounded-md max-w-md w-full shadow-2xl p-6 overflow-hidden pointer-events-auto space-y-4"
            >
              {/* Top Warning/Info Header Bar */}
              <div className="flex gap-3.5 items-start">
                <div
                  className={`p-2 rounded-[3px] shrink-0 border ${
                    confirmModal.type === 'danger'
                      ? 'bg-polish/10 border-polish/40 text-polish'
                      : confirmModal.type === 'warning'
                      ? 'bg-amber-950/30 border-amber-800/50 text-amber-400'
                      : 'bg-ink border-parchment-2 text-text-main'
                  }`}
                >
                  {confirmModal.type === 'danger' ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : confirmModal.type === 'warning' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Info className="w-5 h-5" />
                  )}
                </div>

                <div className="space-y-1 flex-1">
                  <h3 className="text-sm font-display font-bold text-text-main leading-snug">
                    {confirmModal.title}
                  </h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 justify-end pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleConfirmResolve(false)}
                >
                  {confirmModal.cancelText || 'Hủy'}
                </Button>
                <Button
                  type="button"
                  variant={confirmModal.type === 'danger' ? 'primary' : confirmModal.type === 'warning' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleConfirmResolve(true)}
                >
                  {confirmModal.confirmText || 'Xác nhận'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
};
