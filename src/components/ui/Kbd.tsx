import React from 'react';
import { cn } from '../../lib/cn';

/**
 * Hiển thị phím tắt. App đã có useHotkeys (Alt+1..5, Alt+,, Escape) nhưng
 * không nơi nào cho người dùng biết chúng tồn tại - Kbd expose lại chức năng
 * có sẵn thay vì chỉ trang trí.
 */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[2px] border border-parchment-2 bg-ink text-text-muted text-[9px] font-mono font-semibold leading-none',
        className
      )}
    >
      {children}
    </kbd>
  );
}

export default Kbd;
