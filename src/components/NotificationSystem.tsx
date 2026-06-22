import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, RotateCcw } from 'lucide-react';

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

  const showToast = useCallback((options: ToastOptions | string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const opts: ToastOptions = typeof options === 'string' ? { message: options } : options;
    const type = opts.type || 'info';
    const duration = opts.duration ?? (opts.onUndo ? 6000 : 4000); // 6s for undoable toasts, 4s for normal

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
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }
      }, 50);

      // Clean up interval on unmount/remove if needed
      return () => clearInterval(intervalId);
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
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const isUndoable = !!toast.onUndo;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                className={`pointer-events-auto relative overflow-hidden rounded-xl border p-4 shadow-xl backdrop-blur-md flex gap-3.5 items-start ${
                  toast.type === 'success'
                    ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
                    : toast.type === 'warning'
                    ? 'bg-amber-50/95 border-amber-200 text-amber-900'
                    : toast.type === 'error'
                    ? 'bg-rose-50/95 border-rose-200 text-rose-900'
                    : 'bg-white/95 border-slate-200 text-slate-900'
                }`}
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0">
                  {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                  {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-500" />}
                  {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-500" />}
                </div>

                {/* Message & Actions */}
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-xs font-semibold leading-relaxed font-sans pr-2">
                    {toast.message}
                  </p>
                  {isUndoable && (
                    <button
                      onClick={() => handleUndo(toast)}
                      className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-indigo-650 hover:text-indigo-800 transition-colors pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {toast.undoLabel || 'Hoàn tác'}
                    </button>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={() => handleRemoveToast(toast.id)}
                  className="text-slate-400 hover:text-slate-600 rounded p-0.5 transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Progress bar countdown */}
                {toast.duration && toast.duration > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100/50">
                    <div
                      className={`h-full transition-all duration-75 ${
                        toast.type === 'success'
                          ? 'bg-emerald-500'
                          : toast.type === 'warning'
                          ? 'bg-amber-500'
                          : toast.type === 'error'
                          ? 'bg-rose-500'
                          : 'bg-indigo-600'
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
          <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleConfirmResolve(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.35 }}
              className="relative bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl p-6 overflow-hidden pointer-events-auto space-y-4"
            >
              {/* Top Warning/Info Header Bar */}
              <div className="flex gap-4 items-start">
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    confirmModal.type === 'danger'
                      ? 'bg-rose-50 text-rose-600'
                      : confirmModal.type === 'warning'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-indigo-50 text-indigo-650'
                  }`}
                >
                  {confirmModal.type === 'danger' ? (
                    <AlertCircle className="w-6 h-6" />
                  ) : confirmModal.type === 'warning' ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <Info className="w-6 h-6" />
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                    {confirmModal.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => handleConfirmResolve(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-650 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  {confirmModal.cancelText || 'Hủy'}
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmResolve(true)}
                  className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition-colors cursor-pointer ${
                    confirmModal.type === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : confirmModal.type === 'warning'
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : 'bg-indigo-650 hover:bg-indigo-700'
                  }`}
                >
                  {confirmModal.confirmText || 'Xác nhận'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
};
