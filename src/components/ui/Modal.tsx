import React, { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl' | 'full';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  size?: ModalSize;
  className?: string;
  bodyClassName?: string;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}

const SIZE_STYLES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-[95vw] h-[92vh]',
};

/**
 * Modal dialog chuẩn hóa theo hệ thống "Mực & Chu Sa".
 * - Thang z-index: z-50 cho overlay backdrop
 * - Phím Escape & click backdrop để đóng
 * - Focus management & lock scroll nền
 * - Bo góc chuẩn rounded-md, viền border-parchment-2, nền bg-parchment
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  headerExtra,
  footer,
  children,
  size = 'md',
  className,
  bodyClassName,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  // Escape key handler
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (!open) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [open]);

  // Focus trap
  useEffect(() => {
    if (!open || !dialogRef.current) return;

    const dialog = dialogRef.current;
    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (firstElement) {
      firstElement.focus();
    }

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    dialog.addEventListener('keydown', handleTabKey);
    return () => dialog.removeEventListener('keydown', handleTabKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-parchment border border-parchment-2 rounded-md shadow-2xl text-text-main flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 outline-none',
          SIZE_STYLES[size],
          className
        )}
      >
        {/* Modal Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-parchment-2 shrink-0 bg-ink/30">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              {icon && (
                <div className="w-8 h-8 rounded-[3px] bg-ink border border-parchment-2 flex items-center justify-center text-polish shrink-0 shadow-xs">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  <h3
                    id={titleId}
                    className="text-sm font-display font-bold text-text-main truncate flex items-center gap-2"
                  >
                    {title}
                  </h3>
                )}
                {description && (
                  <p id={descId} className="text-[11px] text-text-muted mt-0.5 leading-snug">
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerExtra}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Đóng"
                  className="text-text-muted hover:text-text-main hover:bg-parchment-2 p-1.5 rounded-[2px] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className={cn('overflow-y-auto flex-1 p-5 custom-scrollbar', bodyClassName)}>
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-parchment-2 bg-ink/20 flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
