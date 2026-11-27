import { describe, it, expect } from 'vitest';
import { classifyGeminiError, extractRetryDelayMs } from '../geminiErrorClassifier';

describe('classifyGeminiError', () => {
  it('classifies QuotaFailure with daily violation as QUOTA_EXHAUSTED_RPD', () => {
    const errorBody = {
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: 'Resource has been exhausted (e.g. check quota).',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [
              {
                subject: 'project:123456789',
                description: 'Quota exceeded for quota metric Generate Content API requests per day',
              },
            ],
          },
        ],
      },
    };

    const classified = classifyGeminiError(429, errorBody);
    expect(classified.category).toBe('QUOTA_EXHAUSTED_RPD');
    expect(classified.recommendedCooldownMs).toBe(-1);
    expect(classified.isRetryable).toBe(true);
  });

  it('classifies ErrorInfo with Minute metadata as RATE_LIMIT_RPM', () => {
    const errorBody = {
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: 'Resource has been exhausted (e.g. check quota).',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
            reason: 'RATE_LIMIT_EXCEEDED',
            metadata: {
              quota_limit: 'GenerateContentRequestsPerMinutePerProjectPerRegion',
              quota_limit_value: '15',
            },
          },
        ],
      },
    };

    const classified = classifyGeminiError(429, errorBody);
    expect(classified.category).toBe('RATE_LIMIT_RPM');
    expect(classified.recommendedCooldownMs).toBe(45_000);
    expect(classified.isRetryable).toBe(true);
  });

  it('classifies 401 and 403 as AUTH_FAILURE with MAX_SAFE_INTEGER cooldown', () => {
    const classified401 = classifyGeminiError(401, { error: { message: 'API key not valid' } });
    expect(classified401.category).toBe('AUTH_FAILURE');
    expect(classified401.isRetryable).toBe(false);
    expect(classified401.recommendedCooldownMs).toBe(Number.MAX_SAFE_INTEGER);

    const classified403 = classifyGeminiError(403, { error: { message: 'Permission denied' } });
    expect(classified403.category).toBe('AUTH_FAILURE');
    expect(classified403.isRetryable).toBe(false);
  });

  it('classifies 503 and 500 as SERVICE_OVERLOAD with 15s cooldown', () => {
    const classified503 = classifyGeminiError(503, { error: { message: 'Service Unavailable' } });
    expect(classified503.category).toBe('SERVICE_OVERLOAD');
    expect(classified503.recommendedCooldownMs).toBe(15_000);
    expect(classified503.isRetryable).toBe(true);

    const classified500 = classifyGeminiError(500, { error: { message: 'Internal error' } });
    expect(classified500.category).toBe('SERVICE_OVERLOAD');
    expect(classified500.isRetryable).toBe(true);
  });

  it('classifies network and abort errors appropriately', () => {
    const netErr = new TypeError('Failed to fetch');
    const classifiedNet = classifyGeminiError(0, undefined, netErr);
    expect(classifiedNet.category).toBe('NETWORK_FAILURE');
    expect(classifiedNet.isRetryable).toBe(true);

    const abortErr = new Error('The user aborted a request.');
    abortErr.name = 'AbortError';
    const classifiedAbort = classifyGeminiError(0, undefined, abortErr);
    expect(classifiedAbort.category).toBe('NETWORK_FAILURE');
    expect(classifiedAbort.isRetryable).toBe(false);
  });

  it('falls back to message inspection when details is missing', () => {
    const dailyMsg = classifyGeminiError(429, { error: { message: 'Daily limit exceeded for model' } });
    expect(dailyMsg.category).toBe('QUOTA_EXHAUSTED_RPD');

    const defaultRpm = classifyGeminiError(429, { error: { message: 'Too many requests' } });
    expect(defaultRpm.category).toBe('RATE_LIMIT_RPM');
  });

  it('classifies 404 and NOT_FOUND as non-retryable RESOURCE_NOT_FOUND', () => {
    const classified404 = classifyGeminiError(404, {
      error: { message: 'models/gemini-pro is not found for API version v1beta' },
    });
    expect(classified404.category).toBe('RESOURCE_NOT_FOUND');
    expect(classified404.isRetryable).toBe(false);
    expect(classified404.recommendedCooldownMs).toBe(0);

    const classifiedRpcNotFound = classifyGeminiError(404, {
      error: { status: 'NOT_FOUND', message: 'Resource not found' },
    });
    expect(classifiedRpcNotFound.category).toBe('RESOURCE_NOT_FOUND');
    expect(classifiedRpcNotFound.isRetryable).toBe(false);
  });

  it('classifies real Google Free Tier 15 RPM 429 message with "Please retry in 36.580235449s" as RATE_LIMIT_RPM (Feature 168)', () => {
    const googleFreeTierMessage =
      'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://aistudio.google.com/docs/rate-limits.\n' +
      '* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 15, model: gemini-3.5-flash-lite, description: Generate content requests per minute limit exceeded on Free Tier. See https://aistudio.google.com/docs/rate-limits.\n' +
      'Please retry in 36.580235449s.';

    const classified = classifyGeminiError(429, {
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: googleFreeTierMessage,
      },
    });

    expect(classified.category).toBe('RATE_LIMIT_RPM');
    expect(classified.isRetryable).toBe(true);
    // 36581ms + 1500ms safety buffer = 38081ms
    expect(classified.recommendedCooldownMs).toBeGreaterThanOrEqual(38_000);
    expect(classified.recommendedCooldownMs).toBeLessThanOrEqual(39_000);
  });

  it('extracts retryDelay from RetryInfo details and HTTP Retry-After header', () => {
    const fromDetails = extractRetryDelayMs('Resource exhausted', [
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '22.4s' },
    ]);
    expect(fromDetails).toBe(23_900);

    const fromHeader = extractRetryDelayMs('Too many requests', [], '18');
    expect(fromHeader).toBe(19_500);
  });
});

