import { createContext, useContext } from 'react';

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

export interface NotificationContextProps {
  showToast: (options: ToastOptions | string) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

export const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const useNotifications = (): NotificationContextProps => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
