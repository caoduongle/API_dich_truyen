/**
 * Translation Validation & Error Recognition
 * Kiểm tra tính hợp lệ của văn bản dịch, bảo tồn tiêu đề chương và nhận diện lỗi có thể retry đệ quy
 */

import {
  separateChapterTitleAndBody,
  ensureChapterTitlePreserved,
  validateTranslationOutput,
  validatePolishIntegrity,
  validateParagraphParity,
} from '../../lib/text';

export {
  separateChapterTitleAndBody,
  ensureChapterTitlePreserved,
  validateTranslationOutput,
  validatePolishIntegrity,
  validateParagraphParity,
};

export function isAdaptiveSplitRetryableError(err: any): boolean {
  const msg = err?.message || '';
  return (
    msg.includes('bộ lọc an toàn') ||
    msg.includes('phản hồi rỗng') ||
    msg.includes('SAFETY') ||
    msg.includes('kết quả trả về trống') ||
    msg.includes('UNTRANSLATED_CHINESE_LEFTOVER') ||
    msg.includes('POLISH_TRUNCATION_DETECTED') ||
    msg.includes('PARAGRAPH_STRUCTURE_DIVERGENCE')
  );
}

export function isSafetyOrEmptyErrorDirect(err: any): boolean {
  return isAdaptiveSplitRetryableError(err);
}
