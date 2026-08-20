import React from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'neutral' | 'polish' | 'warning' | 'danger' | 'solid';

// Chủ ý KHÔNG dùng rounded-full: mọi badge trong app đều bo góc [2px] để đồng bộ
// với input/button/card. Badge chỉ hiển thị số liệu/trạng thái thật (số thuật ngữ,
// số chương chờ duyệt...), không phải nhãn trang trí kiểu "AI Powered/Beta".
const TONE_STYLES: Record<BadgeTone, string> = {
  neutral: 'bg-parchment-2 text-text-main border-parchment-2',
  polish: 'bg-polish/15 text-polish border-polish/40',
  warning: 'bg-amber-950/40 text-amber-300 border-amber-800/50',
  danger: 'bg-polish/10 text-polish border-polish/40',
  solid: 'bg-polish text-white border-[#8F2D1E] uppercase tracking-wider',
};

export function Badge({
  tone = 'neutral',
  className,
  title,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] border shrink-0',
        TONE_STYLES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export default Badge;
