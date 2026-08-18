import React from 'react';
import { Seal } from './ui/Seal';

export interface SealStampProps {
  char?: string;
  character?: string;
  text?: string;
  title?: string;
  className?: string;
}

/**
 * Con dấu chu sa triện (朱砂印) - Dấu ấn thủ công xác nhận thuật ngữ / bản thảo.
 * Wrapper giữ nguyên API cũ, dựng trên Seal (mô-típ triện dùng chung toàn app).
 */
export const SealStamp = React.memo(function SealStamp({
  char,
  character,
  text,
  title = 'Đã thẩm định & xác nhận vào từ điển',
  className = '',
}: SealStampProps) {
  const displayChar = character || text || char || '確';
  return <Seal character={displayChar} tone="polish" title={title} className={className} />;
});

export default SealStamp;
