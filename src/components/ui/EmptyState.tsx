import React from 'react';
import { cn } from '../../lib/cn';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Trạng thái rỗng có chủ đích (thay vì lưới trống không lời giải thích).
 * Dùng khi danh sách/bảng chưa có dữ liệu: chưa có dự án, chưa có thuật ngữ,
 * chưa có chương... Luôn đi kèm 1 hành động rõ ràng khi có thể.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-3 py-16 px-6 border border-dashed border-parchment-2 rounded-md bg-parchment/40',
        className
      )}
    >
      <div className="w-11 h-11 rounded-[3px] bg-ink border border-parchment-2 flex items-center justify-center text-text-muted">
        {icon}
      </div>
      <div className="space-y-1 max-w-sm">
        <h3 className="text-sm font-display font-bold text-text-main">{title}</h3>
        {description && <p className="text-xs text-text-muted leading-relaxed">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export default EmptyState;
