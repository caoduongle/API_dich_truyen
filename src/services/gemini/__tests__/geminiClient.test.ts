import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGemini } from '../geminiClient';
import { GeminiRequestError } from '../types';
import { localQuotaTracker } from '../../localQuotaTracker';

describe('geminiClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    localQuotaTracker.resetMetrics();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws error when no API keys are provided', async () => {
    await expect(
      callGemini({
        apiKeys: [],
        prompt: 'test',
      })
    ).rejects.toThrow('Không tìm thấy API Key nào');
  });

  it('successfully calls API and records tokens', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Response text' }],
              role: 'model',
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      }),
    });

    const res = await callGemini({
      apiKeys: ['test-key-1'],
      prompt: 'Hello',
    });

    expect(res.text).toBe('Response text');
    expect(res.successKeyIndex).toBe(0);

    const status = localQuotaTracker.getQuotaStatus(['test-key-1']);
    expect(status.keys[0].tokensTotal).toBe(15);
  });

  it('rotates to next key on 429 rate limit', async () => {
    const calledKeys: string[] = [];
    global.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const key = init.headers['x-goog-api-key'];
      calledKeys.push(key);
      if (key === 'KEY_1') {
        return {
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Too many requests' } }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Success on Key 2' }], role: 'model' } }],
        }),
      };
    });

    const res = await callGemini({
      apiKeys: ['KEY_1', 'KEY_2'],
      prompt: 'Hello',
    });

    expect(calledKeys).toEqual(['KEY_1', 'KEY_2']);
    expect(res.successKeyIndex).toBe(1);
    expect(res.text).toBe('Success on Key 2');
  });

  it('records failure exactly once on HTTP 429/403 errors (no double counting)', async () => {
    const recordFailureSpy = vi.spyOn(localQuotaTracker, 'recordFailure');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ error: { message: 'Resource exhausted', details: [{ reason: 'RATE_LIMIT_EXCEEDED' }] } }),
    });

    await expect(
      callGemini({
        apiKeys: ['SINGLE_KEY'],
        prompt: 'Hello',
      })
    ).rejects.toThrow();

    // Phải gọi recordFailure đúng 1 lần duy nhất cho lượt thử của SINGLE_KEY, không bị catch block gọi lặp lần 2
    expect(recordFailureSpy).toHaveBeenCalledTimes(1);

    const status = localQuotaTracker.getQuotaStatus(['SINGLE_KEY']);
    expect(status.keys[0].errorsTotal).toBe(1);
    expect(status.summary?.failedAttemptsTotal).toBe(1);
  });

  it('records failure exactly once on network fetch exception', async () => {
    const recordFailureSpy = vi.spyOn(localQuotaTracker, 'recordFailure');

    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      callGemini({
        apiKeys: ['NETWORK_FAIL_KEY'],
        prompt: 'Hello',
      })
    ).rejects.toThrow();

    expect(recordFailureSpy).toHaveBeenCalledTimes(1);

    const status = localQuotaTracker.getQuotaStatus(['NETWORK_FAIL_KEY']);
    expect(status.keys[0].errorsTotal).toBe(1);
  });

  it('increments failedRequestsTotal when all keys fail in logical request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Daily limit reached' } }),
    });

    await expect(
      callGemini({
        apiKeys: ['FAIL_KEY_1', 'FAIL_KEY_2'],
        prompt: 'Hello',
      })
    ).rejects.toThrow();

    const status = localQuotaTracker.getQuotaStatus(['FAIL_KEY_1', 'FAIL_KEY_2']);
    expect(status.summary?.logicalRequestsTotal).toBe(1);
    expect(status.summary?.failedRequestsTotal).toBe(1);
    expect(status.summary?.failedRequestsToday).toBe(1);
    expect(status.summary?.failedAttemptsTotal).toBe(2);
  });

  it('increments retriesTotal only when rotating/retrying, not on single unretryable error', async () => {
    // 1. Single key fails with 401 Auth Failed -> Không có lần rotate/retry nào
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'API key not valid' } }),
    });

    await expect(
      callGemini({
        apiKeys: ['AUTH_FAIL_KEY'],
        prompt: 'Hello',
      })
    ).rejects.toThrow();

    let status = localQuotaTracker.getQuotaStatus(['AUTH_FAIL_KEY']);
    expect(status.summary?.failedAttemptsTotal).toBe(1);
    expect(status.summary?.retriesTotal).toBe(0); // Không rotate vì chỉ có 1 key

    // 2. Hai keys: Key 1 bị 429 và rotate sang Key 2 thành công -> retriesTotal tăng 1
    localQuotaTracker.resetMetrics();
    global.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const key = init.headers['x-goog-api-key'];
      if (key === 'ROTATE_1') {
        return { ok: false, status: 429, json: async () => ({ error: { message: '429' } }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Done' }], role: 'model' } }],
        }),
      };
    });

    const res = await callGemini({
      apiKeys: ['ROTATE_1', 'ROTATE_2'],
      prompt: 'Hello',
    });

    expect(res.text).toBe('Done');
    status = localQuotaTracker.getQuotaStatus(['ROTATE_1', 'ROTATE_2']);
    expect(status.summary?.retriesTotal).toBe(1);
    expect(status.summary?.failedRequestsTotal).toBe(0); // Thành công nên failedRequestsTotal = 0
    expect(status.summary?.successfulRequestsTotal).toBe(1);
  });

  it('immediately throws on HTTP 404 without rotating keys or incrementing retries', async () => {
    const calledKeys: string[] = [];
    global.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const key = init.headers['x-goog-api-key'];
      calledKeys.push(key);
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          error: {
            code: 404,
            status: 'NOT_FOUND',
            message: 'models/gemini-pro is not found for API version v1beta',
          },
        }),
      };
    });

    await expect(
      callGemini({
        apiKeys: ['KEY_1', 'KEY_2', 'KEY_3'],
        prompt: 'Hello',
      })
    ).rejects.toThrow('Gemini API Error [Key #1]: models/gemini-pro is not found');

    // Phải fail-fast ngay ở key 1, không được rotate sang KEY_2 hay KEY_3
    expect(calledKeys).toEqual(['KEY_1']);

    const status = localQuotaTracker.getQuotaStatus(['KEY_1', 'KEY_2', 'KEY_3']);
    expect(status.summary?.retriesTotal).toBe(0);
    expect(status.summary?.failedAttemptsTotal).toBe(0);
    expect(status.summary?.failedRequestsTotal).toBe(1);
    expect(status.keys[0].errorsTotal).toBe(0);
    expect(status.keys[0].healthState).toBe('Healthy');
    expect(status.keys[0].runtime.isBlacklisted).toBe(false);
  });

  it('throws on empty candidate text without marking key as exhausted', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '' }] } }],
      }),
    });

    await expect(
      callGemini({
        apiKeys: ['KEY_EMPTY'],
        prompt: 'Hello',
      })
    ).rejects.toThrow('AI trả về phản hồi rỗng.');

    const status = localQuotaTracker.getQuotaStatus(['KEY_EMPTY']);
    expect(status.keys[0].healthState).not.toBe('QuotaExhausted');
  });

  describe('Content Moderation & Safety Filter Handling (User Story 3)', () => {
    it('halts immediately and throws CONTENT_BLOCKED without rotating to subsequent keys when finishReason is SAFETY', async () => {
      const calledKeys: string[] = [];
      const retrySpy = vi.spyOn(localQuotaTracker, 'recordRetry');

      global.fetch = vi.fn().mockImplementation(async (_url, init) => {
        const key = init.headers['x-goog-api-key'];
        calledKeys.push(key);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                finishReason: 'SAFETY',
                content: { parts: [{ text: '' }] },
              },
            ],
          }),
        };
      });

      await expect(
        callGemini({
          apiKeys: ['KEY_1', 'KEY_2', 'KEY_3'],
          prompt: 'Content that triggers safety filter',
        })
      ).rejects.toMatchObject({
        code: 'CONTENT_BLOCKED',
        category: 'CONTENT_BLOCKED',
      });

      // Assert only KEY_1 was called, KEY_2 and KEY_3 were NEVER called
      expect(calledKeys).toEqual(['KEY_1']);
      expect(retrySpy).not.toHaveBeenCalled();
    });

    it('halts immediately and throws CONTENT_BLOCKED when promptFeedback blockReason is SAFETY', async () => {
      const calledKeys: string[] = [];
      const retrySpy = vi.spyOn(localQuotaTracker, 'recordRetry');

      global.fetch = vi.fn().mockImplementation(async (_url, init) => {
        const key = init.headers['x-goog-api-key'];
        calledKeys.push(key);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            promptFeedback: {
              blockReason: 'SAFETY',
              safetyRatings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'HIGH' }],
            },
            candidates: [],
          }),
        };
      });

      await expect(
        callGemini({
          apiKeys: ['KEY_1', 'KEY_2'],
          prompt: 'Unsafe prompt',
        })
      ).rejects.toMatchObject({
        code: 'CONTENT_BLOCKED',
        category: 'CONTENT_BLOCKED',
      });

      expect(calledKeys).toEqual(['KEY_1']);
      expect(retrySpy).not.toHaveBeenCalled();
    });

    it('halts immediately on HTTP 400 with SAFETY error message without rotating keys', async () => {
      const calledKeys: string[] = [];
      const retrySpy = vi.spyOn(localQuotaTracker, 'recordRetry');

      global.fetch = vi.fn().mockImplementation(async (_url, init) => {
        const key = init.headers['x-goog-api-key'];
        calledKeys.push(key);
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: {
              message: 'Request blocked by SAFETY filter: policy violation',
              status: 'INVALID_ARGUMENT',
            },
          }),
        };
      });

      await expect(
        callGemini({
          apiKeys: ['KEY_1', 'KEY_2'],
          prompt: 'Blocked prompt',
        })
      ).rejects.toMatchObject({
        code: 'CONTENT_BLOCKED',
      });

      expect(calledKeys).toEqual(['KEY_1']);
      expect(retrySpy).not.toHaveBeenCalled();
    });
  });

  describe('Cumulative Request Deadline (US4)', () => {
    it('terminates request with TimeoutError when cumulative deadline is exceeded across key attempts', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return {
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: async () => ({ error: { message: 'Overloaded' } }),
        };
      });

      await expect(
        callGemini({
          apiKeys: ['KEY_1', 'KEY_2', 'KEY_3'],
          prompt: 'Hello',
          timeoutMs: 50,
        })
      ).rejects.toThrow(/Quá hạn thời gian yêu cầu Gemini API/);
    });

    it('passes remaining time budget and succeeds on next key within overall deadline', async () => {
      let firstAttemptDone = false;
      global.fetch = vi.fn().mockImplementation(async () => {
        if (!firstAttemptDone) {
          firstAttemptDone = true;
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Error',
            json: async () => ({ error: { message: 'Server error' } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Success on key 2' }] } }],
          }),
        };
      });

      const res = await callGemini({
        apiKeys: ['KEY_1', 'KEY_2'],
        prompt: 'Hello',
        timeoutMs: 10000,
      });

      expect(res.text).toBe('Success on key 2');
      expect(res.successKeyIndex).toBe(1);
    });

    it('immediately aborts with TimeoutError when remaining deadline is <= 50ms without dispatching network request', async () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      await expect(
        callGemini({
          apiKeys: ['KEY_1'],
          prompt: 'Hello',
          timeoutMs: 30, // <= 50ms
        })
      ).rejects.toThrow(/Quá hạn thời gian yêu cầu Gemini API/);

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('Comprehensive Structured GeminiRequestError Taxonomy (US3)', () => {
    it('throws typed GeminiRequestError with RESOURCE_NOT_FOUND on HTTP 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          error: { message: 'Model not found' },
        }),
      });

      try {
        await callGemini({
          apiKeys: ['KEY_404'],
          prompt: 'Hello',
        });
        expect.unreachable();
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GeminiRequestError);
        const reqErr = err as GeminiRequestError;
        expect(reqErr.code).toBe('RESOURCE_NOT_FOUND');
        expect(reqErr.category).toBe('RESOURCE_NOT_FOUND');
        expect(reqErr.status).toBe(404);
        expect(reqErr.isRetryable).toBe(false);
      }
    });

    it('throws typed GeminiRequestError with BAD_REQUEST on HTTP 400', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: { message: 'Invalid payload structure' },
        }),
      });

      try {
        await callGemini({
          apiKeys: ['KEY_400'],
          prompt: 'Hello',
        });
        expect.unreachable();
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GeminiRequestError);
        const reqErr = err as GeminiRequestError;
        expect(reqErr.code).toBe('BAD_REQUEST');
        expect(reqErr.status).toBe(400);
        expect(reqErr.isRetryable).toBe(false);
      }
    });

    it('throws typed GeminiRequestError with ALL_KEYS_EXHAUSTED when all keys 429', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: { message: 'Quota exhausted for this key' },
        }),
      });

      try {
        await callGemini({
          apiKeys: ['KEY_EX_1', 'KEY_EX_2'],
          prompt: 'Hello',
        });
        expect.unreachable();
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GeminiRequestError);
        const reqErr = err as GeminiRequestError;
        expect(reqErr.code).toBe('ALL_KEYS_EXHAUSTED');
        expect(reqErr.category).toBe('QUOTA_EXHAUSTED_RPD');
        expect(reqErr.isRetryable).toBe(false);
      }
    });

    it('throws typed GeminiRequestError with ETIMEDOUT when remaining time is depleted', async () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      try {
        await callGemini({
          apiKeys: ['KEY_TIMEOUT'],
          prompt: 'Hello',
          timeoutMs: 40, // <= 50ms triggers immediate deadline throw
        });
        expect.unreachable();
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GeminiRequestError);
        const reqErr = err as GeminiRequestError;
        expect(reqErr.code).toBe('ETIMEDOUT');
        expect(reqErr.category).toBe('NETWORK_FAILURE');
        expect(reqErr.isRetryable).toBe(true);
      }
    });
  });

  describe('Spec 162 User Story 2: Permissive Safety Configuration', () => {
    it('sends permissive safetySettings with BLOCK_NONE in request payload to Gemini API', async () => {
      let capturedPayload: any = null;
      global.fetch = vi.fn().mockImplementation(async (_url, init) => {
        capturedPayload = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Bản dịch an toàn' }],
                  role: 'model',
                },
              },
            ],
          }),
        };
      });

      const res = await callGemini({
        apiKeys: ['KEY_SAFETY_TEST'],
        prompt: 'Chương 1: Trảm yêu trừ ma, đao quang kiếm ảnh',
      });

      expect(res.text).toBe('Bản dịch an toàn');
      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.safetySettings).toHaveLength(4);
      expect(capturedPayload.safetySettings.every((s: any) => s.threshold === 'BLOCK_NONE')).toBe(true);
      const categories = capturedPayload.safetySettings.map((s: any) => s.category);
      expect(categories).toContain('HARM_CATEGORY_HARASSMENT');
      expect(categories).toContain('HARM_CATEGORY_HATE_SPEECH');
      expect(categories).toContain('HARM_CATEGORY_SEXUALLY_EXPLICIT');
      expect(categories).toContain('HARM_CATEGORY_DANGEROUS_CONTENT');
    });
  });
});

