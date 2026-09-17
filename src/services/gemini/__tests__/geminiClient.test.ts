import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGemini } from '../geminiClient';
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
    expect(status.summary?.failedAttemptsTotal).toBe(1);
    expect(status.summary?.failedRequestsTotal).toBe(1);
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
});

