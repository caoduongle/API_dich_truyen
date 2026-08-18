import React from 'react';
import { cn } from '../../lib/cn';

export type SealTone = 'polish' | 'ink' | 'muted';

export interface SealProps {
  /** Ký tự Hán/Hán-Việt duy nhất hiển thị trong con dấu */
  character: string;
  /** polish = chu sa đỏ (dùng riêng cho ý nghĩa "đã xác nhận"); ink = trung tính; muted = mờ, phụ */
  tone?: SealTone;
  size?: 'sm' | 'md';
  title?: string;
  className?: string;
}

const TONE_STYLES: Record<SealTone, string> = {
  polish: 'bg-polish text-white border-[#8F2D1E]',
  ink: 'bg-ink text-text-main border-parchment-2',
  muted: 'bg-parchment-2/60 text-text-muted border-parchment-2',
};

const SIZE_STYLES: Record<'sm' | 'md', string> = {
  sm: 'w-[18px] h-[18px] min-w-[18px] min-h-[18px] text-[10px]',
  md: 'w-[22px] h-[22px] min-w-[22px] min-h-[22px] text-[12px]',
};

/**
 * Con dấu triện vuông xoay nhẹ - mô-típ nhận diện xuyên suốt ứng dụng
 * (lấy cảm hứng từ ấn triện thư pháp Trung-Việt). Dùng cho: xác nhận thuật
 * ngữ (tone="polish", xem SealStamp.tsx), và nhãn thể loại truyện
 * (tone="ink"/"muted", xem GenreMark.tsx). Giữ tone riêng biệt theo ý nghĩa
 * để "đã xác nhận" và "thể loại" không bị người dùng nhầm lẫn trực quan.
 */
export const Seal = React.memo(function Seal({
  character,
  tone = 'ink',
  size = 'sm',
  title,
  className = '',
}: SealProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center justify-center font-serif leading-none font-bold rounded-[2px] border -rotate-3 select-none tracking-tighter shrink-0 cursor-default transition-transform hover:rotate-0 hover:scale-105',
        TONE_STYLES[tone],
        SIZE_STYLES[size],
        className
      )}
      style={{
        boxShadow:
          tone === 'polish'
            ? 'inset 0 0 1px rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.4)'
            : 'inset 0 0 1px rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.3)',
      }}
    >
      {character}
    </span>
  );
});

export default Seal;
