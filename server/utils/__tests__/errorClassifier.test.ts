import { describe, it, expect } from 'vitest';
import { AIErrorCode } from '../../constants/errors';
import {
  normalizeUpstreamError,
  isRetryableError,
  isOverloadError,
  isSafetyOrEmptyError,
  shouldRotateKey,
} from '../errorClassifier';

describe('Error Taxonomy & Smart Retry Classifier', () => {
  const secretKey = 'AIzaSySecretApiKey123456';

  describe('All 12 Error Taxonomy Categories Classification', () => {
    it('1. RATE_LIMITED: classifies 429 RPM/TPM sliding window limit', () => {
      const err = { status: 429, message: 'Resource has been exhausted (e.g. check quota)' };
      const normalized = normalizeUpstreamError(err, [secretKey]);

      expect(normalized.code).toBe(AIErrorCode.RATE_LIMITED);
      expect(normalized.isRetryable).toBe(true);
      expect(normalized.recommendedAction).toBe('cooldown_key');
      expect(normalized.httpStatus).toBe(429);
      expect(shouldRotateKey(err)).toBe(true);
    });

    it('2. QUOTA_EXCEEDED: classifies daily RPD exhaustion', () => {
      const err = { status: 429, message: 'Daily request limit exceeded (RPD exhausted)' };
      const normalized = normalizeUpstreamError(err);

      expect(normalized.code).toBe(AIErrorCode.QUOTA_EXCEEDED);
      expect(normalized.isRetryable).toBe(false);
      expect(normalized.recommendedAction).toBe('rotate_key');
      expect(normalized.httpStatus).toBe(429);
      expect(shouldRotateKey(err)).toBe(true);
    });

    it('3. AUTH_FAILED: classifies 401 / 403 / API_KEY_INVALID', () => {
      const err = { status: 401, message: `API_KEY_INVALID: key ${secretKey} is not recognized` };
      const normalized = normalizeUpstreamError(err, [secretKey]);

      expect(normalized.code).toBe(AIErrorCode.AUTH_FAILED);
      expect(normalized.isRetryable).toBe(false);
      expect(normalized.recommendedAction).toBe('disable_key');
      expect(normalized.httpStatus).toBe(401);
      expect(normalized.message).not.toContain(secretKey);
      expect(shouldRotateKey(err)).toBe(true);
    });

    it('4. MODEL_NOT_FOUND: classifies 404 model not found', () => {
      const err = { status: 404, message: 'models/gemini-invalid-id is not found for api version v1beta' };
      const normalized = normalizeUpstreamError(err);

      expect(normalized.code).toBe(AIErrorCode.MODEL_NOT_FOUND);
      expect(normalized.isRetryable).toBe(false);
      expect(normalized.recommendedAction).toBe('fail_immediately');
      expect(normalized.httpStatus).toBe(404);
      expect(isRetryableError(err)).toBe(false);
    });

    it('5. MODEL_UNSUPPORTED: classifies model lacking generateContent capability', () => {
      const err = { status: 400, message: 'Unsupported method: generateContent is not supported for this model' };
      const normalized = normalizeUpstreamError(err);

      expect(normalized.code).toBe(AIErrorCode.MODEL_UNSUPPORTED);
      expect(normalized.isRetryable).toBe(false);
      expect(normalized.recommendedAction).toBe('fail_immediately');
      expect(normalized.httpStatus).toBe(400);
    });

    it('6. INVALID_REQUEST: classifies 400 INVALID_ARGUMENT', () => {
      const err = { status: 400, error: { status: 'INVALID_ARGUMENT', message: 'Invalid JSON schema specification' } };
      const normalized = normalizeUpstreamError(err);

      expect(normalized.code).toBe(AIErrorCode.INVALID_REQUEST);
      expect(normalized.isRetryable).toBe(false);
      expect(normalized.recommendedAction).toBe('fail_immediately');
      expect(normalized.httpStatus).toBe(400);
    });

    it('7. SAFETY_BLOCKED: classifies safety and recitation filters', () => {
      const err = { finishReason: 'SAFETY', message: 'Content was blocked due to safety policies' };
      const normalized = normalizeUpstreamError(err);

      expect(normalized.code).toBe(AIErrorCode.SAFETY_BLOCKED);
      expect(normalized.isRetryable).toBe(false);
      expect(normalized.recommendedAction).toBe('fail_immediately');
      expect(normalized.httpStatus).toBe(400);
      expect(isSafetyOrEmptyError(err)).toBe(true);
    });

    it('8. OVERLOADED: classifies 503 UNAVAILABLE / high demand', () => {
      const err = { status: 503, error: { status: 'UNAVAILABLE' }, message: 'Model is currently overloaded' };
      const normalized = normalizeUpstreamError(err);

      expect(normalized.code).toBe(AIErrorCode.OVERLOADED);
      expect(normalized.isRetryable).toBe(true);
      expect(normalized.recommendedAction).toBe('retry');
      expect(normalized.httpStatus).toBe(503);
      expect(isOverloadError(err)).toBe(true);
    });

    it('9. NETWORK_ERROR: classifies ECONNRESET / ENOTFOUND / fetch failed', () => {
      const err = { code: 'ECONNRESET', message: 'socket hang up during fetch' };
      const normalized = normalizeUpstreamError(err);

      expect(normalized.code).toBe(AIErrorCode.NETWORK_ERROR);
      expect(normalized.isRetryable).toBe(true);
      expect(normalized.recommendedAction).toBe('retry');
      expect(normalized.httpStatus).toBe(502);
      expect(isRetryableError(err)).toBe(true);
    });

    it('10. TIMEOUT: classifies ETIMEDOUT / AbortError / 504', () => {
      const err = { name: 'AbortError', message: 'The operation was aborted due to timeout' };
      const normalized = normalizeUpstreamError(err);

      expect(normalized.code).toBe(AIErrorCode.TIMEOUT);
      expect(normalized.isRetryable).toBe(true);
      expect(normalized.recommendedAction).toBe('retry');
      expect(normalized.httpStatus).toBe(504);
      expect(isRetryableError(err)).toBe(true);
    });

    it('11. SERVER_ERROR: classifies 500 INTERNAL', () => {
      const err = { status: 500, message: 'Internal server error occurred in AI backend' };
      const normalized = normalizeUpstreamError(err);

      expect(normalized.code).toBe(AIErrorCode.SERVER_ERROR);
      expect(normalized.isRetryable).toBe(true);
      expect(normalized.recommendedAction).toBe('retry');
      expect(normalized.httpStatus).toBe(500);
    });

    it('12. UNKNOWN: classifies completely unexpected non-matching exceptions', () => {
      const err = new Error('Some bizarre unexpected error string');
      const normalized = normalizeUpstreamError(err);

      expect(normalized.code).toBe(AIErrorCode.UNKNOWN);
      expect(normalized.isRetryable).toBe(true);
      expect(normalized.recommendedAction).toBe('retry');
      expect(normalized.httpStatus).toBe(500);
    });
  });

  describe('Structural Property Precedence over String Matching', () => {
    it('prioritizes status code property even when message is ambiguous', () => {
      const err = { status: 401, message: 'An unexpected processing event' };
      const normalized = normalizeUpstreamError(err);

      expect(normalized.code).toBe(AIErrorCode.AUTH_FAILED);
      expect(normalized.recommendedAction).toBe('disable_key');
    });

    it('handles null and undefined gracefully', () => {
      const normalized = normalizeUpstreamError(null);
      expect(normalized.code).toBe(AIErrorCode.UNKNOWN);
      expect(normalized.isRetryable).toBe(true);
    });
  });

  describe('Key Redaction in Error Messages', () => {
    it('sanitizes all provided API keys from error message', () => {
      const key1 = 'AIzaSyKeyOne987654321';
      const key2 = 'AIzaSyKeyTwo123456789';
      const err = new Error(`Request failed with keys ${key1} and ${key2}`);

      const normalized = normalizeUpstreamError(err, [key1, key2]);
      expect(normalized.message).not.toContain(key1);
      expect(normalized.message).not.toContain(key2);
    });
  });
});
