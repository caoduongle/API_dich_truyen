import { describe, it, expect } from 'vitest';
import {
  classifyTranslationOutcome,
  isAdaptiveSplitRetryableError,
} from '../translationValidation';
import { GeminiRequestError } from '../../gemini/types';

describe('classifyTranslationOutcome', () => {
  it('returns SUCCESS when there is no error', () => {
    const outcome = classifyTranslationOutcome(null);
    expect(outcome.type).toBe('SUCCESS');
    expect(outcome.isRetryable).toBe(false);
    expect(outcome.canSplitRetry).toBe(false);
    expect(outcome.isContentBlocked).toBe(false);
  });

  describe('GeminiRequestError classification', () => {
    it('classifies CONTENT_BLOCKED as TERMINAL with canSplitRetry=true and isRetryable=false', () => {
      const err = new GeminiRequestError('Prompt was blocked by safety filters', {
        code: 'CONTENT_BLOCKED',
        category: 'CONTENT_BLOCKED',
        isRetryable: false,
      });

      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('TERMINAL');
      expect(outcome.isRetryable).toBe(false); // Do not retry same prompt / do not rotate key
      expect(outcome.canSplitRetry).toBe(true); // Can split into smaller segments
      expect(outcome.isContentBlocked).toBe(true);
    });

    it('classifies AUTH_FAILURE as TERMINAL with canSplitRetry=false', () => {
      const err = new GeminiRequestError('API key invalid', {
        code: 'AUTH_FAILURE',
        category: 'AUTH_FAILURE',
        isRetryable: false,
      });

      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('TERMINAL');
      expect(outcome.isRetryable).toBe(false);
      expect(outcome.canSplitRetry).toBe(false);
    });

    it('classifies RATE_LIMIT_RPM as RETRYABLE with canSplitRetry=true', () => {
      const err = new GeminiRequestError('Rate limit exceeded', {
        code: 'UNRECOGNIZED',
        category: 'RATE_LIMIT_RPM',
        isRetryable: true,
      });

      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('RETRYABLE');
      expect(outcome.isRetryable).toBe(true);
      expect(outcome.canSplitRetry).toBe(true);
    });

    it('classifies SERVICE_OVERLOAD as RETRYABLE', () => {
      const err = new GeminiRequestError('Backend 503 unavailable', {
        code: 'UNRECOGNIZED',
        category: 'SERVICE_OVERLOAD',
        isRetryable: true,
      });

      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('RETRYABLE');
      expect(outcome.isRetryable).toBe(true);
      expect(outcome.canSplitRetry).toBe(true);
    });
  });

  describe('AbortError classification', () => {
    it('classifies AbortError as non-retryable TERMINAL', () => {
      const err = new Error('The user aborted the request.');
      err.name = 'AbortError';

      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('TERMINAL');
      expect(outcome.isRetryable).toBe(false);
      expect(outcome.canSplitRetry).toBe(false);
    });
  });

  describe('Domain validation errors', () => {
    it('classifies UNTRANSLATED_CHINESE_LEFTOVER as RETRYABLE split candidate', () => {
      const err = new Error('Tỷ lệ chữ Hán còn sót quá cao: UNTRANSLATED_CHINESE_LEFTOVER');
      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('RETRYABLE');
      expect(outcome.canSplitRetry).toBe(true);
      expect(outcome.isContentBlocked).toBe(false);
    });

    it('classifies POLISH_TRUNCATION_DETECTED as RETRYABLE split candidate', () => {
      const err = new Error('Phát hiện bản chuốt bị cắt cụt: POLISH_TRUNCATION_DETECTED');
      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('RETRYABLE');
      expect(outcome.canSplitRetry).toBe(true);
    });

    it('classifies safety string message fallback as CONTENT_BLOCKED', () => {
      const err = new Error('Nội dung bị chặn bởi bộ lọc an toàn Google Gemini');
      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('TERMINAL');
      expect(outcome.isContentBlocked).toBe(true);
      expect(outcome.canSplitRetry).toBe(true);
      expect(outcome.isRetryable).toBe(false);
    });
  });

  describe('isAdaptiveSplitRetryableError backward compatibility', () => {
    it('returns true for CONTENT_BLOCKED and domain errors', () => {
      expect(isAdaptiveSplitRetryableError(new Error('UNTRANSLATED_CHINESE_LEFTOVER'))).toBe(true);
      expect(isAdaptiveSplitRetryableError(new Error('bộ lọc an toàn'))).toBe(true);
    });

    it('returns false for AbortError and AUTH_FAILURE', () => {
      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      expect(isAdaptiveSplitRetryableError(abortErr)).toBe(false);

      const authErr = new GeminiRequestError('Auth error', {
        code: 'AUTH_FAILURE',
        category: 'AUTH_FAILURE',
        isRetryable: false,
      });
      expect(isAdaptiveSplitRetryableError(authErr)).toBe(false);
    });
  });
});
