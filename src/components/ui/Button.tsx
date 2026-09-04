import React from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
}

// Rút ra từ các className lặp lại ở ~15 nơi (ProjectList, ProjectCard, ApiSettings,
// AuthModal, NotificationSystem...). Bo góc [2px]/[3px] và không dùng rounded-full,
// giữ đúng ngôn ngữ hình khối vuông/triện đã có sẵn của app thay vì bo tròn mặc định.
const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-polish text-white font-bold hover:bg-[#A03522] active:bg-[#8F2D1E] shadow-xs',
  secondary:
    'bg-ink text-text-main font-semibold border border-parchment-2 hover:bg-parchment-2',
  outline:
    'bg-transparent text-text-muted font-semibold border border-parchment-2 hover:bg-parchment-2 hover:text-text-main',
  ghost:
    'bg-transparent text-text-muted font-medium hover:bg-parchment-2 hover:text-text-main',
  danger:
    'bg-transparent text-text-muted font-medium hover:bg-polish/15 hover:text-polish',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-2 sm:py-1.5 min-h-[38px] sm:min-h-[32px] gap-1.5',
  md: 'text-sm px-4 py-2.5 sm:py-2 min-h-[44px] sm:min-h-[38px] gap-2',
  icon: 'p-2.5 sm:p-1.5 min-w-[38px] min-h-[38px] sm:min-w-[32px] sm:min-h-[32px]',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'sm', type = 'button', icon, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-[2px] cursor-pointer transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-polish/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
});

export default Button;
