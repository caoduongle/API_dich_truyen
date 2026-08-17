import React from 'react';

export interface SealStampProps {
  char?: string;
  character?: string;
  text?: string;
  title?: string;
  className?: string;
}

/**
 * Con dấu chu sa triện (朱砂印) - Dấu ấn thủ công xác nhận thuật ngữ / bản thảo
 */
export const SealStamp = React.memo(function SealStamp({
  char,
  character,
  text,
  title = 'Đã thẩm định & xác nhận vào từ điển',
  className = '',
}: SealStampProps) {
  const displayChar = character || text || char || '確';

  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center w-[18px] h-[18px] min-w-[18px] min-h-[18px] bg-polish text-white font-serif text-[10px] leading-none font-bold rounded-[2px] border border-[#8F2D1E] shadow-[0_1px_2px_rgba(0,0,0,0.35)] -rotate-3 select-none tracking-tighter shrink-0 cursor-default transition-transform hover:rotate-0 hover:scale-105 ${className}`}
      style={{
        boxShadow: 'inset 0 0 1px rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.4)'
      }}
    >
      {displayChar}
    </span>
  );
});

export default SealStamp;
