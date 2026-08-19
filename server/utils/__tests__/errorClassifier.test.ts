import { describe, it, expect } from 'vitest';
import { normalizeUpstreamError } from '../errorClassifier';
import { AIErrorCode } from '../../constants/errors';
import { SafetyFilterError } from '../../services/geminiService';

describe('Error Taxonomy & Classifier', () => {
  it('should classify SafetyFilterError as SAFETY_BLOCKED with fail_immediately', () => {
    const safetyErr = new SafetyFilterError('Nội dung bị chặn bởi bộ lọc an toàn', {
      finishReason: 'SAFETY',
    });
    const normalized = normalizeUpstreamError(safetyErr);
    expect(normalized.code).toBe(AIErrorCode.SAFETY_BLOCKED);
    expect(normalized.isRetryable).toBe(false);
    expect(normalized.recommendedAction).toBe('fail_immediately');
    expect(normalized.httpStatus).toBe(400);
  });

  it('should classify 401 / 403 as AUTH_FAILED with disable_key', () => {
    const authErr = new Error('API key not valid. Please pass a valid API key.');
    (authErr as any).status = 400; // Google API sometimes returns 400 with API_KEY_INVALID message
    const normalized = normalizeUpstreamError(authErr);
    expect(normalized.code).toBe(AIErrorCode.AUTH_FAILED);
    expect(normalized.isRetryable).toBe(false);
    expect(normalized.recommendedAction).toBe('disable_key');
    expect(normalized.httpStatus).toBe(401);
  });

  it('should classify 404 model not found as MODEL_NOT_FOUND', () => {
    const notFoundErr = new Error('models/gemini-old-123 is not found for api version v1beta');
    (notFoundErr as any).status = 404;
    const normalized = normalizeUpstreamError(notFoundErr);
    expect(normalized.code).toBe(AIErrorCode.MODEL_NOT_FOUND);
    expect(normalized.isRetryable).toBe(false);
    expect(normalized.recommendedAction).toBe('fail_immediately');
  });

  it('should classify 429 rate limits and quota exceeded properly', () => {
    const rateLimitErr = new Error('429 Too Many Requests: Resource has been exhausted (e.g. check quota)');
    (rateLimitErr as any).status = 429;
    const normalized = normalizeUpstreamError(rateLimitErr);
    expect(normalized.code).toBe(AIErrorCode.RATE_LIMITED);
    expect(normalized.isRetryable).toBe(true);
    expect(normalized.recommendedAction).toBe('cooldown_key');

    const dailyErr = new Error('Daily request limit (RPD) reached for this key');
    const normalizedDaily = normalizeUpstreamError(dailyErr);
    expect(normalizedDaily.code).toBe(AIErrorCode.QUOTA_EXCEEDED);
    expect(normalizedDaily.isRetryable).toBe(false);
    expect(normalizedDaily.recommendedAction).toBe('rotate_key');
  });

  it('should classify 503 Overload as SERVER_ERROR with retry', () => {
    const overloadErr = new Error('503 The model is overloaded. Please try again later.');
    (overloadErr as any).status = 503;
    const normalized = normalizeUpstreamError(overloadErr);
    expect(normalized.code).toBe(AIErrorCode.SERVER_ERROR);
    expect(normalized.isRetryable).toBe(true);
    expect(normalized.recommendedAction).toBe('retry');
    expect(normalized.httpStatus).toBe(503);
  });

  it('should classify timeout and network failures', () => {
    const timeoutErr = new Error('Request timed out');
    (timeoutErr as any).name = 'AbortError';
    const normalizedTimeout = normalizeUpstreamError(timeoutErr);
    expect(normalizedTimeout.code).toBe(AIErrorCode.TIMEOUT);
    expect(normalizedTimeout.isRetryable).toBe(true);

    const netErr = new Error('fetch failed: ECONNRESET');
    const normalizedNet = normalizeUpstreamError(netErr);
    expect(normalizedNet.code).toBe(AIErrorCode.NETWORK_ERROR);
    expect(normalizedNet.isRetryable).toBe(true);
  });
});
