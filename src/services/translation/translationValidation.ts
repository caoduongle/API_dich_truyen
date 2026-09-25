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

import { GeminiRequestError } from '../gemini/types';
import { TranslationOutcomeType } from './types';

export {
  separateChapterTitleAndBody,
  ensureChapterTitlePreserved,
  validateTranslationOutput,
  validatePolishIntegrity,
  validateParagraphParity,
};

export interface ClassifiedTranslationOutcome {
  type: TranslationOutcomeType;
  isRetryable: boolean;
  canSplitRetry: boolean;
  reason: string;
  isContentBlocked: boolean;
}

/**
 * Phân loại kết quả dịch thuật và lỗi có cấu trúc
 */
export function classifyTranslationOutcome(err: unknown): ClassifiedTranslationOutcome {
  if (!err) {
    return {
      type: 'SUCCESS',
      isRetryable: false,
      canSplitRetry: false,
      reason: 'No error',
      isContentBlocked: false,
    };
  }

  // 1. Kiểm tra GeminiRequestError có cấu trúc
  if (err instanceof GeminiRequestError) {
    const isContentBlocked =
      err.category === 'CONTENT_BLOCKED' ||
      err.code === 'CONTENT_BLOCKED';

    if (isContentBlocked) {
      return {
        type: 'TERMINAL',
        isRetryable: false, // cấm xoay key và cấm retry cùng prompt
        canSplitRetry: true, // chia nhỏ văn cảnh để cô lập câu bị chặn
        reason: 'CONTENT_BLOCKED',
        isContentBlocked: true,
      };
    }

    if (
      err.category === 'AUTH_FAILURE' ||
      err.code === 'AUTH_FAILURE' ||
      err.category === 'RESOURCE_NOT_FOUND' ||
      err.code === 'RESOURCE_NOT_FOUND' ||
      err.category === 'QUOTA_EXHAUSTED_RPD'
    ) {
      return {
        type: 'TERMINAL',
        isRetryable: false,
        canSplitRetry: false,
        reason: err.category || err.code,
        isContentBlocked: false,
      };
    }

    if (
      err.category === 'RATE_LIMIT_RPM' ||
      err.category === 'SERVICE_OVERLOAD' ||
      err.category === 'NETWORK_FAILURE'
    ) {
      return {
        type: 'RETRYABLE',
        isRetryable: true,
        canSplitRetry: true,
        reason: err.category,
        isContentBlocked: false,
      };
    }
  }

  // 2. Kiểm tra AbortError
  const errObj = err as { name?: string; message?: string };
  if (errObj?.name === 'AbortError' || errObj?.message?.includes('aborted')) {
    return {
      type: 'TERMINAL',
      isRetryable: false,
      canSplitRetry: false,
      reason: 'AbortError',
      isContentBlocked: false,
    };
  }

  // 3. Kiểm tra các lỗi nghiệp vụ xác thực (Domain Validation Errors)
  const msg = errObj?.message || String(err || '');
  const lowerMsg = msg.toLowerCase();

  const isSafetyMsg =
    lowerMsg.includes('bộ lọc an toàn') ||
    lowerMsg.includes('safety') ||
    lowerMsg.includes('chặn bởi bộ lọc') ||
    lowerMsg.includes('content_blocked');

  if (isSafetyMsg) {
    return {
      type: 'TERMINAL',
      isRetryable: false,
      canSplitRetry: true,
      reason: 'CONTENT_BLOCKED',
      isContentBlocked: true,
    };
  }

  // 3. Kiểm tra lỗi schema cấu trúc không thỏa mãn (không được cứu nguy bằng split)
  if (
    msg.includes('không thỏa mãn cấu trúc yêu cầu') ||
    msg.includes('SCHEMA_INVALID')
  ) {
    return {
      type: 'TERMINAL',
      isRetryable: false,
      canSplitRetry: false,
      reason: 'SCHEMA_INVALID',
      isContentBlocked: false,
    };
  }

  // 4. Kiểm tra các lỗi nghiệp vụ xác thực (Domain Validation Errors có thể chia đoạn để phục hồi)
  const isDomainValidationError =
    msg.includes('UNTRANSLATED_CHINESE_LEFTOVER') ||
    msg.includes('POLISH_TRUNCATION_DETECTED') ||
    msg.includes('PARAGRAPH_STRUCTURE_DIVERGENCE') ||
    msg.includes('phản hồi rỗng') ||
    msg.includes('kết quả trả về trống') ||
    msg.includes('EMPTY_RESPONSE');

  if (isDomainValidationError) {
    return {
      type: 'RETRYABLE',
      isRetryable: true,
      canSplitRetry: true,
      reason: msg,
      isContentBlocked: false,
    };
  }

  // 5. Mặc định cho các lỗi không nhận diện (không split retry để tránh nuốt lỗi cấu trúc)
  return {
    type: 'TERMINAL',
    isRetryable: false,
    canSplitRetry: false,
    reason: msg || 'UNKNOWN_ERROR',
    isContentBlocked: false,
  };
}

/**
 * Tương thích ngược: kiểm tra xem lỗi có nên kích hoạt phân đoạn thích ứng không
 */
export function isAdaptiveSplitRetryableError(err: any): boolean {
  return classifyTranslationOutcome(err).canSplitRetry;
}

export function isSafetyOrEmptyErrorDirect(err: any): boolean {
  return isAdaptiveSplitRetryableError(err);
}
