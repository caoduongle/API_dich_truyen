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
});
